// node tests/run-btl.mjs <file.btl> [args...]  — boots a bootable in the node build, drives it in quanta, prints console output.
import createT4 from "../build/t4-node.js";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, join } from "node:path";

const [btl, ...args] = process.argv.slice(2);
let out = "";
const mod = await createT4({
  print: (s) => { out += s + "\n"; process.stdout.write(s + "\n"); },
  printErr: (s) => process.stderr.write(s + "\n"),
  noInitialRun: true,
});
// mirror the bootable's directory into MEMFS /work and chdir there
const dir = dirname(btl);
mod.FS.mkdir("/work");
for (const f of readdirSync(dir)) {
  const p = join(dir, f);
  if (statSync(p).isFile()) mod.FS.writeFile("/work/" + f, readFileSync(p));
}
mod.FS.chdir("/work");
const t0 = performance.now();
const rc = mod.callMain(["-se", "-sb", basename(btl), ...args]);
let halted = 0, quanta = 0;
while (!(halted = mod._t4_run(2_000_000))) quanta++;
mod._t4_finish();
const ms = performance.now() - t0;
const instr = mod._t4_instr();
process.stderr.write(`halted=${halted} quanta=${quanta} instr=${instr} ${ms.toFixed(0)} ms ${(instr / ms / 1000).toFixed(1)} MIPS\n`);
