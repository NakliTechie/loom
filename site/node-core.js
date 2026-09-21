// Loom fabric node: one emulated transputer that runs in quanta under the fabric's clock.
// Same code drives a browser Worker (node-worker.js) and the node test harness (tests/fabric-node.mjs).
// call(msg) -> { reply, transfer }
//   boot     {files, args, env, cwd}                              -> {out}
//   quantum  {budget, vt, nslots, deliver:{inbox:[{slot,bytes}], clear:[slot]}}
//            -> {instr, ran, idle, halted, out, outs:[{slot,bytes}], freed:[slot]}
//   finish   {}                                                   -> {out, files}
export function makeNode(createT4) {
  let mod, FS, SCH = 1024, base = 0, pending = "";
  const full = new Set();          // slots I currently hold: my inboxes with an unread message, my outbox mirrors awaiting forward
  const addr = (s) => base + s * SCH;
  const len = (s) => mod.HEAPU8[addr(s)] | (mod.HEAPU8[addr(s) + 1] << 8);
  function listDir(dir) {
    const out = {};
    for (const name of FS.readdir(dir)) {
      if (name === "." || name === "..") continue;
      const p = dir + "/" + name, st = FS.stat(p);
      if (FS.isDir(st.mode)) Object.assign(out, listDir(p)); else out[p] = FS.readFile(p);
    }
    return out;
  }
  return {
    async call(m) {
      if (m.type === "boot") {
        mod = await createT4({
          noInitialRun: true, print: (s) => (pending += s + "\n"), printErr: (s) => (pending += s + "\n"),
          preRun: [(M) => {
            M.FS.init(null, (c) => { if (c !== null) pending += String.fromCharCode(c); }, (c) => { if (c !== null) pending += String.fromCharCode(c); });
            Object.assign(M.ENV, m.env || {});
            // keys: a queue seeded at boot (tests, scripted runs) or a SharedArrayBuffer ring (browser, node 0)
            const q = [...(m.keys || "")].map((c) => c.charCodeAt(0));
            const ring = m.keyRing ? new Int32Array(m.keyRing) : null;
            const ringHas = () => ring && Atomics.load(ring, 0) !== Atomics.load(ring, 1);
            const ringGet = () => { for (;;) { const h = Atomics.load(ring, 0), t = Atomics.load(ring, 1); if (h !== t) { const v = ring[2 + (h % (ring.length - 2))]; Atomics.store(ring, 0, h + 1); return v; } Atomics.wait(ring, 1, t); } };
            M.loomHasKey = () => q.length > 0 || ringHas();
            M.loomGetKey = () => (q.length ? q.shift() : ring ? ringGet() : -1);
          }],
        });
        FS = mod.FS;
        for (const [path, bytes] of Object.entries(m.files)) { const d = path.slice(0, path.lastIndexOf("/")); if (d) FS.mkdirTree(d); FS.writeFile(path, bytes); }
        FS.mkdirTree(m.cwd); FS.chdir(m.cwd);
        try { mod.callMain(m.args); } catch (err) { pending += `boot failed: ${err}\n`; }
        base = mod._t4_links(); SCH = mod._t4_sch_size();
        const out = pending; pending = "";
        return { reply: { out } };
      }
      if (m.type === "quantum") {
        if (!base) base = mod._t4_links();
        for (const { slot, bytes } of m.deliver.inbox) { const a = addr(slot); mod.HEAPU8.set(bytes, a + 2); mod.HEAPU8[a] = bytes.length & 255; mod.HEAPU8[a + 1] = bytes.length >> 8; full.add(slot); }
        for (const slot of m.deliver.clear) { const a = addr(slot); mod.HEAPU8[a] = 0; mod.HEAPU8[a + 1] = 0; full.delete(slot); }
        const t0 = mod._t4_instr();
        const halted = mod._t4_run(m.budget);
        const idleCode = mod._t4_idle(), idle = idleCode === 1, timer = idleCode === 2;
        if (mod._t4_instr() < m.vt) mod._t4_set_instr(m.vt);   // the clock ends every quantum at vt
        const outs = [], freed = [], me = mod._t4_node();
        for (let s = 0; s < m.nslots && base; s++) {
          const l = len(s), mine = Math.floor(s / 8) === me;
          if (mine) { if (l === 0 && full.has(s)) { full.delete(s); freed.push(s); } }
          else if (l > 0 && !full.has(s)) { full.add(s); outs.push({ slot: s, bytes: mod.HEAPU8.slice(addr(s) + 2, addr(s) + 2 + l) }); }
        }
        const out = pending; pending = "";
        return { reply: { instr: mod._t4_instr(), ran: mod._t4_instr() - t0, idle, timer, halted, out, outs, freed }, transfer: outs.map((o) => o.bytes.buffer) };
      }
      if (m.type === "finish") {
        try { mod._t4_finish(); } catch (err) {}
        const files = listDir("/work"), out = pending; pending = "";
        return { reply: { out, files }, transfer: Object.values(files).map((u) => u.buffer) };
      }
      return { reply: {} };
    },
  };
}
