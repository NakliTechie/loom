// node tests/occ.mjs <dir-with-hello.occ+hello.pgm+hello.lah> <toolset-root>
// Runs the D7205A toolset inside the WASM emulator: oc → ilink → occonf → icollect → run.
import createT4 from "../build/t4-node.js";
import { resolve } from "node:path";

const [work, tools] = process.argv.slice(2).map((p) => resolve(p));
async function t4(args, { cwd = "/work", quiet = false } = {}) {
  let out = "";
  const mod = await createT4({ print: (s) => { out += s + "\n"; if (!quiet) console.log(s); }, printErr: (s) => console.error(s), noInitialRun: true,
    preRun: [(m) => Object.assign(m.ENV, { D7205: "/d7205", ISEARCH: "/d7205/libs/", IBOARDSIZE: "#200000", ITERM: "/d7205/iterms/ansi.itm" })] });
  mod.FS.mkdir("/work"); mod.FS.mount(mod.FS.filesystems.NODEFS, { root: work }, "/work");
  mod.FS.mkdir("/d7205"); mod.FS.mount(mod.FS.filesystems.NODEFS, { root: tools }, "/d7205");
  mod.FS.chdir(cwd);
  const t0 = performance.now();
  mod.callMain(["-se", ...args]);
  let halted; while (!(halted = mod._t4_run(4_000_000)));
  mod._t4_finish();
  const instr = mod._t4_instr(), ms = performance.now() - t0;
  console.error(`  [${args[1]} ${args.slice(2).join(" ")}] halted=${halted} instr=${instr} ${ms.toFixed(0)} ms ${(instr / ms / 1000).toFixed(1)} MIPS`);
  return { halted, out };
}
await t4(["-sb", "/d7205/itools/oc.btl", "hello", "-ta", "-h", "-o", "hello.tah"]);
await t4(["-sb", "/d7205/itools/ilink.btl", "-f", "hello.lah", "-ta", "-h", "-o", "hello.cah"]);
await t4(["-sb", "/d7205/itools/occonf.btl", "hello.pgm", "-o", "hello.cfb"]);
await t4(["-sb", "/d7205/itools/icollect.btl", "hello.cfb", "-o", "hello.btl"]);
const r = await t4(["-sb", "hello.btl"]);
console.log(r.out.includes("Hello world") ? "PASS: compiled in-browser-build and ran" : "FAIL");
