// Loom main thread: the disk, the console, and one run at a time on a Worker.
import { untar } from "./tar.js";

const $ = (id) => document.getElementById(id);
const disk = new Map();          // path -> Uint8Array   (/work/... user files, /d7205/... toolset)
let selected = null, worker = null, keysSab = null, keyRing = null, running = false;
const runs = [];

// ---------- keyboard ring (SharedArrayBuffer, only when cross-origin isolated) ----------
if (self.crossOriginIsolated && typeof SharedArrayBuffer !== "undefined") {
  keysSab = new SharedArrayBuffer(4 * (2 + 256));
  keyRing = new Int32Array(keysSab);
  $("k-kbd").textContent = "live (SAB)";
} else {
  $("k-kbd").textContent = "unavailable (no COOP/COEP)";
}
function pushKey(code) {
  if (!keyRing) return;
  const t = Atomics.load(keyRing, 1);
  keyRing[2 + (t % 256)] = code;
  Atomics.store(keyRing, 1, t + 1);
  Atomics.notify(keyRing, 1);
}
$("stdin").addEventListener("keydown", (e) => {
  if (!running) return;
  if (e.key === "Enter") { for (const ch of $("stdin").value) pushKey(ch.charCodeAt(0)); pushKey(13); $("stdin").value = ""; e.preventDefault(); }
});

// ---------- console ----------
const con = $("console");
function print(text, cls) {
  const span = document.createElement("span");
  if (cls) span.className = cls;
  span.textContent = text;
  con.appendChild(span);
  con.scrollTop = con.scrollHeight;
}
const fmt = (n) => n.toLocaleString("en-US");
const fmtUs = (us) => us >= 1e6 ? (us / 1e6).toFixed(3) + " s" : us >= 1e3 ? (us / 1e3).toFixed(1) + " ms" : Math.round(us) + " µs";

// ---------- disk ----------
function renderFiles() {
  const el = $("files"); el.innerHTML = "";
  const paths = [...disk.keys()].sort((a, b) => (a.startsWith("/work") === b.startsWith("/work") ? a.localeCompare(b) : a.startsWith("/work") ? -1 : 1));
  for (const p of paths) {
    const d = document.createElement("div");
    d.className = "file" + (p === selected ? " sel" : "");
    const dir = p.slice(0, p.lastIndexOf("/") + 1), name = p.slice(dir.length);
    d.innerHTML = `<span><span class="dir">${dir.replace(/^\/work\//, "")}</span>${name}</span><span class="sz">${disk.get(p).length}</span>`;
    d.onclick = () => { selected = p; renderFiles(); };
    el.appendChild(d);
  }
  const hasTools = disk.has("/d7205/itools/oc.btl");
  $("run").disabled = running || !(selected && selected.endsWith(".btl"));
  $("build").disabled = running || !(selected && selected.endsWith(".occ") && hasTools);
  $("download").disabled = !selected;
  $("delete").disabled = running || !selected;
  $("nodes").textContent = "1";
}
async function addFile(name, bytes) {
  if (/\.(tar\.gz|tgz|tar)$/i.test(name)) {
    print(`untar ${name} …\n`, "sys");
    const files = await untar(bytes.buffer, { gzip: !/\.tar$/i.test(name) });
    let n = 0;
    for (const [p, data] of Object.entries(files)) {
      const rel = p.replace(/^(\.\/)?(d7205\/)?/, "");
      if (/^(itools\/[^/]+\.btl|libs\/[^/]+|iterms\/[^/]+)$/.test(rel)) { disk.set("/d7205/" + rel, data); n++; }
    }
    print(`toolset: ${n} files under /d7205 (itools/*.btl, libs/, iterms/); nothing was uploaded anywhere\n`, "sys");
  } else {
    disk.set("/work/" + name, bytes);
    selected = "/work/" + name;
  }
  renderFiles();

// ---------- agent face: the same verbs the buttons use, callable from a script or a test ----------
self.loom = {
  disk, runs,
  load: (name, bytes) => addFile(name, bytes instanceof Uint8Array ? bytes : new TextEncoder().encode(bytes)),
  fetchInto: async (url, name) => addFile(name || url.split("/").pop(), new Uint8Array(await (await fetch(url)).arrayBuffer())),
  select: (path) => { selected = path; renderFiles(); },
  run: (path) => { if (path) selected = path; return runOnce(["-s8", "-se", "-sb", selected.slice(6)]); },
  build: (path) => { if (path) selected = path; return build(); },
  text: (path) => new TextDecoder().decode(disk.get(path)),
  console: () => con.textContent,
};
}
const drop = $("drop");
for (const ev of ["dragenter", "dragover"]) drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); });
for (const ev of ["dragleave", "drop"]) drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("over"); });
drop.addEventListener("drop", async (e) => {
  for (const f of e.dataTransfer.files) await addFile(f.name, new Uint8Array(await f.arrayBuffer()));
});
drop.addEventListener("click", () => {
  const inp = document.createElement("input"); inp.type = "file"; inp.multiple = true;
  inp.onchange = async () => { for (const f of inp.files) await addFile(f.name, new Uint8Array(await f.arrayBuffer())); };
  inp.click();
});
$("download").onclick = () => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([disk.get(selected)])); a.download = selected.split("/").pop(); a.click();
};
$("delete").onclick = () => { disk.delete(selected); selected = null; renderFiles(); };

// ---------- runs ----------
const ENV = { D7205: "/d7205", ISEARCH: "/d7205/libs/", IBOARDSIZE: "#200000", ITERM: "/d7205/iterms/ansi.itm" };
function setState(s) { $("state").dataset.s = s; $("state").textContent = s; }

function runOnce(args, { label } = {}) {
  return new Promise((resolve) => {
    running = true; renderFiles(); setState("running"); $("stop").disabled = false;
    $("k-boot").textContent = label || args.join(" ");
    $("k-halt").textContent = "—";
    print(`\n$ t4 ${args.join(" ")}\n`, "sys");
    const files = {};
    for (const [p, b] of disk) files[p] = b;
    worker = new Worker("worker.js");
    const t0 = performance.now();
    worker.onmessage = (e) => {
      const m = e.data;
      if (m.type === "out") print(m.text);
      else if (m.type === "tick") {
        $("instr").textContent = fmt(m.instr); $("vtime").textContent = fmtUs(m.usec);
        $("k-instr").textContent = fmt(m.instr); $("k-vt").textContent = fmtUs(m.usec);
        $("k-ht").textContent = (m.ms / 1000).toFixed(2) + " s";
        $("mips").textContent = (m.instr / m.ms / 1000).toFixed(1) + " MIPS";
      } else if (m.type === "halted") {
        const why = { 1: "server exit", 2: "error flag", 3: "stopped" }[m.reason] || `reason ${m.reason}`;
        $("k-halt").textContent = why;
        for (const [p, b] of Object.entries(m.files)) disk.set(p, new Uint8Array(b));
        worker.terminate(); worker = null; running = false; setState("halted"); $("stop").disabled = true;
        const rec = { args, instr: m.instr, ms: m.ms, why };
        runs.unshift(rec); renderRuns();
        print(`[${why} · ${fmt(m.instr)} instr · ${fmtUs(m.instr / 10)} virtual · ${(m.ms / 1000).toFixed(2)} s host]\n`, "sys");
        renderFiles(); resolve(rec);
      }
    };
    worker.postMessage({ type: "boot", files, args, env: ENV, cwd: "/work", keys: keysSab });
  });
}
function renderRuns() {
  const el = $("runs"); el.innerHTML = "";
  for (const r of runs.slice(0, 40)) {
    const d = document.createElement("div"); d.className = "run";
    d.innerHTML = `<div class="cmd">t4 ${r.args.join(" ")}</div><div class="n">${fmt(r.instr)} instr · ${fmtUs(r.instr / 10)} · ${(r.ms / 1000).toFixed(2)} s · ${r.why}</div>`;
    el.appendChild(d);
  }
}
$("stop").onclick = () => { if (worker) worker.postMessage({ type: "stop" }); };
$("run").onclick = () => runOnce(["-s8", "-se", "-sb", selected.slice(6)]);
async function build() {
  const stem = selected.slice(6).replace(/\.occ$/, "");
  const enc = new TextEncoder();
  if (!disk.has(`/work/${stem}.lah`)) disk.set(`/work/${stem}.lah`, enc.encode(`${stem}.t8h\nhostio.lib\nconvert.lib\n#INCLUDE occama.lnk\n`));
  if (!disk.has(`/work/${stem}.pgm`)) {
    const src = new TextDecoder().decode(disk.get(selected));
    const proc = (src.match(/^\s*PROC\s+([A-Za-z0-9.]+)/m) || [, stem])[1];
    disk.set(`/work/${stem}.pgm`, enc.encode(`VAL k IS 1024 :\nVAL m IS k * k :\nNODE p :\nARC hostlink :\nNETWORK n\n  DO\n    SET p (type, memsize := "T800", 2 * m )\n    CONNECT p[link][0] TO HOST WITH hostlink\n:\nNODE application:\nMAPPING\n  DO\n    MAP application ONTO p\n:\n#INCLUDE "hostio.inc"\n#USE "${stem}.c8h"\nCONFIG\n  CHAN OF SP fs, ts :\n  PLACE fs, ts ON hostlink :\n  PLACED PAR\n    PROCESSOR application\n      ${proc} ( fs, ts )\n:\n`));
  }
  const steps = [
    ["-se", "-sb", "/d7205/itools/oc.btl", stem, "-t8", "-h", "-o", `${stem}.t8h`],
    ["-se", "-sb", "/d7205/itools/ilink.btl", "-f", `${stem}.lah`, "-t8", "-h", "-o", `${stem}.c8h`],
    ["-se", "-sb", "/d7205/itools/occonf.btl", `${stem}.pgm`, "-o", `${stem}.cfb`],
    ["-se", "-sb", "/d7205/itools/icollect.btl", `${stem}.cfb`, "-o", `${stem}.btl`],
  ];
  for (const s of steps) { const r = await runOnce(s); if (r.why !== "server exit" || !disk.has(`/work/${s[s.length - 1]}`)) { print(`build stopped at ${s[2].split("/").pop()}\n`, "err"); return; } }
  selected = `/work/${stem}.btl`; renderFiles();

// ---------- agent face: the same verbs the buttons use, callable from a script or a test ----------
self.loom = {
  disk, runs,
  load: (name, bytes) => addFile(name, bytes instanceof Uint8Array ? bytes : new TextEncoder().encode(bytes)),
  fetchInto: async (url, name) => addFile(name || url.split("/").pop(), new Uint8Array(await (await fetch(url)).arrayBuffer())),
  select: (path) => { selected = path; renderFiles(); },
  run: (path) => { if (path) selected = path; return runOnce(["-s8", "-se", "-sb", selected.slice(6)]); },
  build: (path) => { if (path) selected = path; return build(); },
  text: (path) => new TextDecoder().decode(disk.get(path)),
  console: () => con.textContent,
};
  print(`built ${stem}.btl — press run\n`, "sys");
};

// ---------- first paint: a precomputed trace so the page says something before any file is dropped ----------
fetch("traces/hello.json").then((r) => r.json()).then((t) => {
  print(`Loom · one T800 in this tab. Precomputed trace of ${t.program} (${t.note}):\n`, "sys");
  print(t.output);
  print(`[${t.halt} · ${fmt(t.instr)} instr · ${fmtUs(t.instr / 10)} virtual]\n`, "sys");
  print(`Drop a .btl to run it here, or the D7205A toolset plus a .occ to build one.\n`, "sys");
}).catch(() => {});
renderFiles();

// ---------- agent face: the same verbs the buttons use, callable from a script or a test ----------
self.loom = {
  disk, runs,
  load: (name, bytes) => addFile(name, bytes instanceof Uint8Array ? bytes : new TextEncoder().encode(bytes)),
  fetchInto: async (url, name) => addFile(name || url.split("/").pop(), new Uint8Array(await (await fetch(url)).arrayBuffer())),
  select: (path) => { selected = path; renderFiles(); },
  run: (path) => { if (path) selected = path; return runOnce(["-s8", "-se", "-sb", selected.slice(6)]); },
  build: (path) => { if (path) selected = path; return build(); },
  text: (path) => new TextDecoder().decode(disk.get(path)),
  console: () => con.textContent,
};
