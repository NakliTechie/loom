// Minimal tar reader (ustar / GNU), gzip via DecompressionStream. Returns {path: Uint8Array}.
export async function untar(arrayBuffer, { gzip = true } = {}) {
  let buf = new Uint8Array(arrayBuffer);
  if (gzip || (buf[0] === 0x1f && buf[1] === 0x8b)) {
    const ds = new DecompressionStream("gzip");
    const resp = new Response(new Blob([buf]).stream().pipeThrough(ds));
    buf = new Uint8Array(await resp.arrayBuffer());
  }
  const files = {}, dec = new TextDecoder();
  const str = (o, n) => dec.decode(buf.subarray(o, o + n)).replace(/\0.*$/s, "");
  let off = 0, longName = null;
  while (off + 512 <= buf.length) {
    if (buf[off] === 0) break;
    let name = str(off, 100);
    const size = parseInt(str(off + 124, 12).trim() || "0", 8), type = String.fromCharCode(buf[off + 156]);
    const prefix = str(off + 345, 155);
    if (prefix) name = prefix + "/" + name;
    if (longName) { name = longName; longName = null; }
    const data = buf.subarray(off + 512, off + 512 + size);
    if (type === "L") longName = dec.decode(data).replace(/\0.*$/s, "");
    else if (type === "0" || type === "\0" || type === "") files[name] = data.slice();
    off += 512 + Math.ceil(size / 512) * 512;
  }
  return files;
}
