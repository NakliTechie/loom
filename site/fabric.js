// Loom fabric: N emulated transputers in lockstep on one virtual clock.
// Works on the main thread with Workers, or in node with worker_threads-free in-process modules (tests/fabric-node.mjs).
// Each node runs one quantum (Q instructions) then barriers. Link messages written during a quantum are
// delivered at the barrier, so every run with the same inputs produces the same trace.
export const SCH_DATA = 2;              // 2-byte length prefix in each slot (see processor.h)
export function parseMap(text) {
  // icollect .map / spy.net: "Connect HOST to processor 0 link 0", "Connect processor A link X to processor B link Y"
  const links = [];
  let nodes = 0;
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/Connect\s+processor\s+(\d+)\s+link\s+(\d+)\s+to\s+processor\s+(\d+)\s+link\s+(\d+)/i);
    if (m) { const [a, x, b, y] = m.slice(1).map(Number); links.push({ a, x, b, y }); nodes = Math.max(nodes, a + 1, b + 1); continue; }
    const h = line.match(/Connect\s+HOST\s+to\s+processor\s+(\d+)\s+link\s+(\d+)/i);
    if (h) nodes = Math.max(nodes, Number(h[1]) + 1);
  }
  return { nodes, links };
}
export function topologyToMap(topo) {
  const out = ["-- Loom topology", "Connect HOST to processor 0 link 0"];
  for (const { a, x, b, y } of topo.links) out.push(`Connect processor ${a} link ${x} to processor ${b} link ${y}`);
  return out.join("\n") + "\n";
}
// slot index of node N's link L inbox within the mirror region (8 slots per node; In = 4+L)
export const inSlot = (n, l) => n * 8 + 4 + l;

export class Fabric {
  constructor(nodes, { quantum = 50_000, maxQuanta = Infinity, onTick, onOut, onHalt, onLink } = {}) {
    this.maxQuanta = maxQuanta;
    this.nodes = nodes;                 // [{ post(msg), onmessage }] adapters, created by the caller
    this.n = nodes.length;
    this.Q = quantum;
    this.onTick = onTick; this.onOut = onOut; this.onHalt = onHalt; this.onLink = onLink;
    this.pending = [];                  // messages waiting for a free inbox: {to, slot, bytes, from, fromSlot}
    this.inboxFull = new Set();         // "node:slot" currently holding an undelivered message
    this.k = 0; this.stopped = false; this.idleStreak = 0;
    this.stats = { bytes: 0, msgs: 0, perLink: new Map() };
  }
  async start(topo, boot) {
    this.topo = topo;
    // connection lookup: sender writes into the mirror slot of (b, y); we route by that slot id
    this.route = new Map();
    for (const { a, x, b, y } of topo.links) {
      this.route.set(`${a}:${inSlot(b, y)}`, { to: b, slot: inSlot(b, y), link: `${a}.${x}→${b}.${y}` });
      this.route.set(`${b}:${inSlot(a, x)}`, { to: a, slot: inSlot(a, x), link: `${b}.${y}→${a}.${x}` });
    }
    await Promise.all(this.nodes.map((nd, i) => nd.call({ type: "boot", ...boot(i) })));
    return this.loop();
  }
  async loop() {
    while (!this.stopped) {
      const vt = (this.k + 1) * this.Q;
      const results = await Promise.all(this.nodes.map((nd, i) => nd.call({ type: "quantum", budget: this.Q, vt, nslots: 8 * this.n, deliver: this.take(i) })));
      let anyHalt = false, allIdle = true;
      for (let i = 0; i < this.n; i++) {
        const r = results[i];
        if (r.out) this.onOut?.(i, r.out);
        for (const s of r.freed) this.inboxFull.delete(`${i}:${s}`);
        for (const o of r.outs) {
          const rt = this.route.get(`${i}:${o.slot}`);
          if (!rt) continue;
          this.pending.push({ to: rt.to, slot: rt.slot, bytes: o.bytes, from: i, fromSlot: o.slot, link: rt.link });
        }
        if (r.halted) { anyHalt = true; this.haltReason = r.halted; this.onHalt?.(i, r); }
        if (!r.idle) allIdle = false;
      }
      // deliver what fits; a message leaves the sender's mirror only once accepted
      const clears = new Map();
      this.pending = this.pending.filter((m) => {
        const key = `${m.to}:${m.slot}`;
        if (this.inboxFull.has(key)) return true;
        this.inboxFull.add(key);
        (this.deliverNext ||= new Map()); const d = this.deliverNext.get(m.to) || []; d.push({ slot: m.slot, bytes: m.bytes }); this.deliverNext.set(m.to, d);
        const c = clears.get(m.from) || []; c.push(m.fromSlot); clears.set(m.from, c);
        this.stats.bytes += m.bytes.length; this.stats.msgs++;
        this.stats.perLink.set(m.link, (this.stats.perLink.get(m.link) || 0) + m.bytes.length);
        this.onLink?.(m.link, m.bytes.length, this.k);
        return false;
      });
      this.clearsNext = clears;
      this.lastInstr = results.map((r) => r.instr);
      this.k++;
      this.onTick?.(this.k, vt, results);
      if (anyHalt || this.k >= this.maxQuanta) break;
      this.idleStreak = allIdle && this.pending.length === 0 && this.deliverNext.size === 0 ? this.idleStreak + 1 : 0;
      if (this.idleStreak > 200) { this.onOut?.(-1, "fabric: every node idle and no traffic for 200 quanta; stopping\n"); break; }
    }
    this.stopped = true;
    await Promise.all(this.nodes.map((nd) => nd.call({ type: "finish" })));
  }
  take(i) {
    const d = { inbox: this.deliverNext?.get(i) || [], clear: this.clearsNext?.get(i) || [] };
    this.deliverNext?.delete(i); this.clearsNext?.delete(i);
    return d;
  }
  stop() { this.stopped = true; }
}
