// Determinism + native equivalence: run a bootable twice in the WASM build; outputs and instruction
// counts must match each other, and the output must match a reference text if given.
import createT4 from "../build/t4-node.js";
import { readFileSync, existsSync } from "node:fs";
import { basename, dirname, join } from "node:path";
const [btl, ref, ...args] = process.argv.slice(2);
async function run() {
  let out = "";
  const mod = await createT4({ noInitialRun: true, print: (s) => (out += s + "\n"), printErr: (s) => (out += s + "\n"),
    preRun: [(M) => M.FS.init(null, (c) => { if (c !== null) out += String.fromCharCode(c); }, (c) => { if (c !== null) out += String.fromCharCode(c); })] });
  mod.FS.mkdir("/work"); mod.FS.writeFile("/work/" + basename(btl), readFileSync(btl)); mod.FS.chdir("/work");
  mod.callMain(["-s8", "-se", "-sb", basename(btl), ...args]);
  let h; while (!(h = mod._t4_run(4e6)));
  mod._t4_finish();
  return { out, instr: mod._t4_instr(), h };
}
const a = await run(), b = await run();
const det = a.out === b.out && a.instr === b.instr;
console.log(`${basename(btl)}: instr=${a.instr} halted=${a.h} deterministic=${det}`);
if (ref && existsSync(ref)) {
  const r = readFileSync(ref, "utf8");
  console.log(`  matches native reference: ${r === a.out}`);
  if (r !== a.out) { console.log("--- wasm:\n" + a.out + "--- native:\n" + r); }
}
process.exit(det ? 0 : 1);
