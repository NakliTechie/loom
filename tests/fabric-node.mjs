// node tests/fabric-node.mjs <program.btl> <program.map> [menu-keys...]
// Runs a configured multi-transputer bootable on the Loom fabric in-process (no Workers) and writes /work files out.
import createT4 from "../build/t4-node.js";
import { makeNode } from "../site/node-core.js";
import { Fabric, parseMap } from "../site/fabric.js";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { basename, resolve } from "node:path";

const [btl, map, outDir = "/tmp/loom-out", keys = ""] = process.argv.slice(2);
const topo = parseMap(readFileSync(map, "utf8"));
const files = { ["/work/" + basename(btl)]: new Uint8Array(readFileSync(btl)), ["/work/" + basename(map)]: new Uint8Array(readFileSync(map)) };
const env = { SPYNET: basename(map) };
const nodes = Array.from({ length: topo.nodes }, () => makeNode(createT4));
const adapters = nodes.map((nd) => ({ call: async (m) => (await nd.call(m)).reply }));
let out = "";
const t0 = performance.now();
const fab = new Fabric(adapters, {
  quantum: Number(process.env.Q || 50000),
  onOut: (i, text) => { out += text; process.stdout.write(text.replace(/\n/g, `\n[${i}] `)); },
  onHalt: (i, r) => process.stderr.write(`\nnode ${i} halted (${r.halted})\n`),
  onTick: (k, vt) => { if (k % 20 === 0) process.stderr.write(`  k=${k} vt=${(vt / 1e6 / 10).toFixed(2)}s msgs=${fab.stats.msgs} bytes=${fab.stats.bytes}\r`); },
});
await fab.start(topo, (i) => ({ files, env, cwd: "/work", keys: i === 0 ? keys : "", args: i === 0 ? ["-s8", "-sl", "-sn", "0", "-sb", basename(btl)] : ["-s8", "-sl", "-sn", String(i)] }));
const ms = performance.now() - t0;
console.log("pending:", fab.pending.map((m) => `${m.from}:${m.fromSlot}->${m.to}:${m.slot} ${m.bytes.length}B`), "inboxFull:", [...fab.inboxFull]);
console.log(`\nfabric: ${topo.nodes} nodes, ${fab.k} quanta, ${fab.stats.msgs} msgs, ${fab.stats.bytes} bytes, ${(ms / 1000).toFixed(1)} s host`);
for (const [link, b] of fab.stats.perLink) console.log(`  ${link}: ${b} bytes`);
mkdirSync(outDir, { recursive: true });
const r = await nodes[0].call({ type: "finish" });
for (const [p, b] of Object.entries(r.reply.files)) writeFileSync(resolve(outDir, basename(p)), b);
console.log("files:", Object.keys(r.reply.files).join(" "));
