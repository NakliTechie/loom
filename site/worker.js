// Loom worker: one emulated transputer per Worker. Boots once, runs in bounded quanta on a
// virtual clock, posts console output and ticks, returns the working directory on halt.
importScripts("t4.js");

let mod = null, halted = 0, stopRequested = false, keys = null;
const QUANTUM = 2_000_000;

function keyRing(sab) {
  // Int32Array: [0]=head (consumer), [1]=tail (producer), [2..]=slots
  const a = new Int32Array(sab), N = a.length - 2;
  return {
    has: () => Atomics.load(a, 0) !== Atomics.load(a, 1),
    get: () => {
      for (;;) {
        const h = Atomics.load(a, 0), t = Atomics.load(a, 1);
        if (h !== t) { const v = a[2 + (h % N)]; Atomics.store(a, 0, h + 1); return v; }
        Atomics.wait(a, 1, t);
      }
    },
  };
}

function listDir(FS, dir) {
  const out = {};
  for (const name of FS.readdir(dir)) {
    if (name === "." || name === "..") continue;
    const p = dir + "/" + name, st = FS.stat(p);
    if (FS.isDir(st.mode)) Object.assign(out, listDir(FS, p));
    else out[p] = FS.readFile(p);
  }
  return out;
}

self.onmessage = async (e) => {
  const m = e.data;
  if (m.type === "stop") { stopRequested = true; return; }
  if (m.type !== "boot") return;
  if (m.keys) keys = keyRing(m.keys);
  let pending = "";
  const flush = () => { if (pending) { postMessage({ type: "out", text: pending }); pending = ""; } };
  mod = await createT4({
    noInitialRun: true,
    print: (s) => { pending += s + "\n"; },
    printErr: (s) => { pending += s + "\n"; },
    preRun: [(M) => {
      // char-level stdout so prompts without newlines reach the console
      M.FS.init(null, (c) => { if (c !== null) pending += String.fromCharCode(c); }, (c) => { if (c !== null) pending += String.fromCharCode(c); });
      Object.assign(M.ENV, m.env || {});
      M.loomHasKey = () => (keys ? keys.has() : false);
      M.loomGetKey = () => (keys ? keys.get() : -1);
    }],
  });
  const FS = mod.FS;
  for (const [path, bytes] of Object.entries(m.files)) {
    const dir = path.slice(0, path.lastIndexOf("/"));
    if (dir) FS.mkdirTree(dir);
    FS.writeFile(path, bytes);
  }
  FS.mkdirTree(m.cwd || "/work"); FS.chdir(m.cwd || "/work");
  let rc;
  try { rc = mod.callMain(m.args); } catch (err) { postMessage({ type: "out", text: `boot failed: ${err}\n` }); }
  flush();
  postMessage({ type: "booted" });
  const t0 = performance.now();
  let lastTick = 0;
  while (!halted && !stopRequested) {
    halted = mod._t4_run(QUANTUM);
    flush();
    const instr = mod._t4_instr(), now = performance.now();
    if (now - lastTick > 50 || halted) { postMessage({ type: "tick", instr, usec: instr / 10, ms: now - t0 }); lastTick = now; }
    await new Promise((r) => setTimeout(r, 0));
  }
  try { mod._t4_finish(); } catch (err) {}
  flush();
  const files = listDir(FS, m.cwd || "/work");
  const transfer = Object.values(files).map((u) => u.buffer);
  postMessage({ type: "halted", reason: stopRequested ? 3 : halted, instr: mod._t4_instr(), ms: performance.now() - t0, files }, transfer);
};
