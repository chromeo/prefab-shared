// Stored (uncompressed) ZIP with UTF-8 names and CRC32; no extra package is needed.
// Each file is { name, text } or { name, bytes } (a Uint8Array, e.g. an image or a PDF).
// Also the container for .xlsx files, which are ZIPs of XML parts. Returns a Uint8Array.
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (bytes) => {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

export const zipBytes = (files) => {
  const enc = new TextEncoder(),
    chunks = [],
    central = [];
  let offset = 0;
  for (const file of files) {
    const name = enc.encode(file.name),
      data = file.bytes || enc.encode(file.text),
      sum = crc32(data),
      header = new Uint8Array(30 + name.length),
      v = new DataView(header.buffer);
    v.setUint32(0, 0x04034b50, true);
    v.setUint16(4, 20, true);
    v.setUint16(6, 0x800, true);
    v.setUint32(14, sum, true);
    v.setUint32(18, data.length, true);
    v.setUint32(22, data.length, true);
    v.setUint16(26, name.length, true);
    header.set(name, 30);
    chunks.push(header, data);
    const c = new Uint8Array(46 + name.length),
      w = new DataView(c.buffer);
    w.setUint32(0, 0x02014b50, true);
    w.setUint16(4, 20, true);
    w.setUint16(6, 20, true);
    w.setUint16(8, 0x800, true);
    w.setUint32(16, sum, true);
    w.setUint32(20, data.length, true);
    w.setUint32(24, data.length, true);
    w.setUint16(28, name.length, true);
    w.setUint32(42, offset, true);
    c.set(name, 46);
    central.push(c);
    offset += header.length + data.length;
  }
  const end = new Uint8Array(22),
    v = new DataView(end.buffer),
    length = central.reduce((n, c) => n + c.length, 0);
  v.setUint32(0, 0x06054b50, true);
  v.setUint16(8, files.length, true);
  v.setUint16(10, files.length, true);
  v.setUint32(12, length, true);
  v.setUint32(16, offset, true);
  const parts = [...chunks, ...central, end];
  const out = new Uint8Array(parts.reduce((n, c) => n + c.length, 0));
  let at = 0;
  for (const c of parts) {
    out.set(c, at);
    at += c.length;
  }
  return out;
};
