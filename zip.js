// Minimal store-only (uncompressed) ZIP writer. Files stay disk-backed Blobs, so large packs don't load into memory.
const Zip = (() => {
  const TABLE = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    TABLE[n] = c >>> 0;
  }

  async function crc32(blob) {
    let c = 0xffffffff;
    const CHUNK = 8 << 20;
    for (let o = 0; o < blob.size; o += CHUNK) {
      const b = new Uint8Array(await blob.slice(o, o + CHUNK).arrayBuffer());
      for (let i = 0; i < b.length; i++) c = TABLE[(c ^ b[i]) & 255] ^ (c >>> 8);
    }
    return (c ^ 0xffffffff) >>> 0;
  }

  // entries: [{path, blob}]
  async function build(entries, onProgress) {
    const enc = new TextEncoder();
    const d = new Date();
    const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    const parts = [], central = [];
    let off = 0, cdSize = 0;
    for (let i = 0; i < entries.length; i++) {
      const { path, blob } = entries[i];
      const name = enc.encode(path), size = blob.size, crc = await crc32(blob);
      const h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true);
      h.setUint16(10, time, true); h.setUint16(12, date, true); h.setUint32(14, crc, true);
      h.setUint32(18, size, true); h.setUint32(22, size, true); h.setUint16(26, name.length, true);
      parts.push(h.buffer, name, blob);
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true);
      c.setUint16(12, time, true); c.setUint16(14, date, true); c.setUint32(16, crc, true);
      c.setUint32(20, size, true); c.setUint32(24, size, true); c.setUint16(28, name.length, true);
      c.setUint32(42, off, true);
      central.push(c.buffer, name);
      cdSize += 46 + name.length;
      off += 30 + name.length + size;
      if (off + cdSize > 0xfffffff0) throw new Error("Pack is over 4 GB, too big for a ZIP. Lower the samples per bank or save to a folder instead.");
      if (onProgress) onProgress(i + 1, entries.length);
    }
    const e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, entries.length, true); e.setUint16(10, entries.length, true);
    e.setUint32(12, cdSize, true); e.setUint32(16, off, true);
    return new Blob([...parts, ...central, e.buffer], { type: "application/zip" });
  }

  return { build };
})();
