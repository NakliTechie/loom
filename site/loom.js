// Loom main thread: the disk, the console, and one run at a time on a Worker.
import { untar } from "./tar.js";
import { Fabric, parseMap } from "./fabric.js";

const $ = (id) => document.getElementById(id);
const disk = new Map();          // path -> Uint8Array   (/work/... user files, /d7205/... toolset)
let selected = null, keysSab = null, keyRing = null, running = false;
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

let fabric = null;
function workerNode() {
  const w = new Worker("node-worker.js", { type: "module" });
  let seq = 0; const waiting = new Map();
  w.onmessage = (e) => { const { id, ...rest } = e.data; const r = waiting.get(id); if (r) { waiting.delete(id); r(rest); } };
  return { w, call: (m) => new Promise((res) => { const id = ++seq; waiting.set(id, res); w.postMessage({ id, ...m }); }) };
}
function runOnce(args, { label } = {}) {
  // args: t4 command line for node 0. If <stem>.map exists beside the bootable and names more than one
  // processor, the run is a fabric of that many nodes; otherwise a single node.
  return new Promise((resolve) => {
    running = true; renderFiles(); setState("running"); $("stop").disabled = false;
    $("k-boot").textContent = label || args.join(" ");
    $("k-halt").textContent = "—";
    const btl = args[args.length - 1], stem = btl.replace(/\.[^.]+$/, "");
    const mapName = `${stem}.map`;
    const mapText = disk.has(`/work/${mapName}`) ? new TextDecoder().decode(disk.get(`/work/${mapName}`)) : "";
    const topo = mapText ? parseMap(mapText) : { nodes: 1, links: [] };
    const multi = topo.nodes > 1;
    print(`\n$ t4 ${args.join(" ")}${multi ? `   (${topo.nodes} nodes, ${topo.links.length} links, from ${mapName})` : ""}\n`, "sys");
    const files = {}; for (const [p, b] of disk) files[p] = b;
    const nodes = Array.from({ length: topo.nodes }, workerNode);
    const t0 = performance.now();
    let lastPaint = 0;
    fabric = new Fabric(nodes, {
      quantum: multi ? 50_000 : 2_000_000,
      onOut: (i, text) => print(multi && i > 0 ? text.replace(/^/gm, `[${i}] `) : text, i < 0 ? "sys" : ""),
      onLink: (link, bytes, k) => topoPulse(link, bytes, k),
      onTick: (k, vt) => {
        const now = performance.now();
        if (now - lastPaint < 60) return;
        lastPaint = now;
        const instr = vt; // every node's clock is at vt after a quantum
        $("instr").textContent = fmt(instr); $("vtime").textContent = fmtUs(instr / 10);
        $("k-instr").textContent = fmt(instr); $("k-vt").textContent = fmtUs(instr / 10);
        $("k-ht").textContent = ((now - t0) / 1000).toFixed(2) + " s";
        $("mips").textContent = (instr * topo.nodes / (now - t0) / 1000).toFixed(1) + " MIPS";
        $("k-msgs").textContent = `${fmt(fabric.stats.msgs)} · ${fmt(fabric.stats.bytes)} B`;
        topoPaint(k);
      },
    });
    topoInit(topo);
    fabric.start(topo, (i) => ({
      files, env: { ...ENV, ...(multi ? { SPYNET: mapName } : {}) }, cwd: "/work", keyRing: i === 0 ? keysSab : null,
      args: multi ? (i === 0 ? ["-s8", "-sl", "-sn", "0", ...args] : ["-s8", "-sl", "-sn", String(i)]) : args,
    })).then(async () => {
      const r = await nodes[0].call({ type: "finish" });
      for (const [p, b] of Object.entries(r.files)) disk.set(p, new Uint8Array(b));
      for (const nd of nodes) nd.w.terminate();
      const halted = fabric.haltReason || 0;
      const why = fabric.stopped && fabric.userStopped ? "stopped" : { 1: "server exit", 2: "error flag" }[halted] || (fabric.idleStreak > 200 ? "deadlock: all idle" : "halted");
      const ms = performance.now() - t0, instr = fabric.k * fabric.Q;
      $("k-halt").textContent = why; running = false; setState("halted"); $("stop").disabled = true;
      const rec = { args, instr, ms, why, nodes: topo.nodes, msgs: fabric.stats.msgs, bytes: fabric.stats.bytes };
      runs.unshift(rec); renderRuns();
      print(`[${why} · ${fmt(instr)} instr per node · ${fmtUs(instr / 10)} virtual · ${(ms / 1000).toFixed(2)} s host${multi ? ` · ${fmt(fabric.stats.msgs)} messages, ${fmt(fabric.stats.bytes)} B on links` : ""}]\n`, "sys");
      topoPaint(fabric.k, true);
      fabric = null; renderFiles(); resolve(rec);
    });
  });
}
function renderRuns() {
  const el = $("runs"); el.innerHTML = "";
  for (const r of runs.slice(0, 40)) {
    const d = document.createElement("div"); d.className = "run";
    d.innerHTML = `<div class="cmd">t4 ${r.args.join(" ")}${r.nodes > 1 ? ` × ${r.nodes}` : ""}</div><div class="n">${fmt(r.instr)} instr · ${fmtUs(r.instr / 10)} · ${(r.ms / 1000).toFixed(2)} s · ${r.why}${r.nodes > 1 ? ` · ${fmt(r.msgs)} msgs` : ""}</div>`;
    el.appendChild(d);
  }
}
$("stop").onclick = () => { if (fabric) { fabric.userStopped = true; fabric.stop(); } };
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
  for (const s of steps) { const r = await runOnce(s); if (r.why !== "server exit" || !disk.has(`/work/${s[s.length - 1]}`)) { print(`build stopped at ${s[2].split("/").pop()}\n`, "err"); return false; } }
  selected = `/work/${stem}.btl`; renderFiles();
  print(`built ${stem}.btl — press run\n`, "sys");
  return true;
}
$("build").onclick = build;

renderFiles();

// ---------- topology view: nodes on a circle, links as chords, activity as recent bytes ----------
let topoState = null;
function topoInit(topo) {
  const svg = $("topo"); svg.innerHTML = "";
  const n = topo.nodes, W = 276, H = Math.max(160, Math.min(276, 40 + n * 6)), cx = W / 2, cy = H / 2, R = Math.min(W, H) / 2 - 22;
  const pos = (i) => n === 1 ? [cx, cy] : [cx + R * Math.cos(-Math.PI / 2 + 2 * Math.PI * i / n), cy + R * Math.sin(-Math.PI / 2 + 2 * Math.PI * i / n)];
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  const NS = "http://www.w3.org/2000/svg", el = (t, a) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); return e; };
  const links = new Map();
  for (const { a, x, b, y } of topo.links) {
    const [x1, y1] = pos(a), [x2, y2] = pos(b);
    const line = el("line", { x1, y1, x2, y2, class: "lk" }); svg.appendChild(line);
    links.set(`${a}.${x}→${b}.${y}`, { line, bytes: 0, last: -1 }); links.set(`${b}.${y}→${a}.${x}`, { line, bytes: 0, last: -1 });
  }
  const nodesEl = [];
  for (let i = 0; i < n; i++) {
    const [x, y] = pos(i);
    const g = el("g", { class: "nd" });
    g.appendChild(el("circle", { cx: x, cy: y, r: n > 24 ? 5 : 9 }));
    if (n <= 24) { const t = el("text", { x, y: y + 3.5, "text-anchor": "middle" }); t.textContent = i; g.appendChild(t); }
    svg.appendChild(g); nodesEl.push(g);
  }
  $("nodes").textContent = String(n);
  topoState = { links, nodesEl, k: 0 };
  $("linkstats").innerHTML = "";
}
function topoPulse(link, bytes, k) { const l = topoState?.links.get(link); if (l) { l.bytes += bytes; l.last = k; } }
function topoPaint(k, final = false) {
  if (!topoState) return;
  const seen = new Set();
  for (const [name, l] of topoState.links) {
    if (seen.has(l.line)) continue; seen.add(l.line);
    const hot = !final && k - l.last < 4;
    l.line.classList.toggle("hot", hot);
  }
  const rows = [...topoState.links.entries()].filter(([, l]) => l.bytes > 0).sort((a, b) => b[1].bytes - a[1].bytes).slice(0, 12);
  $("linkstats").innerHTML = rows.map(([name, l]) => `<div><span>${name}</span><span class="n">${fmt(l.bytes)} B</span></div>`).join("");
}

// ---------- first paint: precomputed traces, so the page says something before any file is dropped ----------
fetch("traces/index.json").then((r) => r.json()).then((t) => {
  print(`Loom · one T800 in this tab · virtual clock ${t.clock}. Three precomputed runs:\n`, "sys");
  for (const tr of t.traces) {
    print(`\n$ t4 -s8 -se -sb ${tr.program}   (${tr.note})\n`, "sys");
    print(tr.output);
    print(`[${tr.halt} · ${fmt(tr.instr)} instr · ${fmtUs(tr.instr / 10)} virtual]\n`, "sys");
  }
  print(`\nDrop a .btl to run it here, or the D7205A toolset plus a .occ to build one.\n`, "sys");
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
