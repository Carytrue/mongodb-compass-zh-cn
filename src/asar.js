'use strict';
// Minimal reader/rewriter for Electron asar archives.
// We only need to replace the content of a few packed text files, keeping everything else
// (unpacked flags, executable bits, links, integrity blocks) exactly as it was.

const crypto = require('crypto');

function parse(buf) {
  if (buf.length < 16) throw new Error('not an asar archive (file too small)');
  const jsonLen = buf.readUInt32LE(12);
  const header = JSON.parse(buf.subarray(16, 16 + jsonLen).toString('utf8'));
  const dataStart = 8 + buf.readUInt32LE(4);
  return { header, dataStart };
}

// Yields [path, node] for every file entry, in header order.
function* entries(node, prefix = '') {
  for (const [name, n] of Object.entries(node.files || {})) {
    const p = prefix ? prefix + '/' + name : name;
    if (n.files) yield* entries(n, p);
    else yield [p, n];
  }
}

// Files whose bytes live inside the archive (not in app.asar.unpacked, not links).
const isPacked = n => !n.unpacked && !n.link;

function readEntry(buf, dataStart, n) {
  const off = dataStart + Number(n.offset);
  return buf.subarray(off, off + n.size);
}

function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

// Returns a new archive Buffer where `replacements` (Map path -> Buffer) replaced the given files.
function rebuild(buf, replacements) {
  const { header, dataStart } = parse(buf);
  const chunks = [];
  let off = 0;
  for (const [p, n] of entries(header)) {
    if (!isPacked(n)) continue;
    const replaced = replacements.get(p);
    const data = replaced || readEntry(buf, dataStart, n);
    if (replaced) {
      n.size = data.length;
      if (n.integrity) {
        const bs = n.integrity.blockSize;
        n.integrity.hash = sha256(data);
        n.integrity.blocks = [];
        for (let i = 0; i < data.length; i += bs) n.integrity.blocks.push(sha256(data.subarray(i, i + bs)));
        if (!data.length) n.integrity.blocks = [n.integrity.hash];
      }
    }
    n.offset = String(off);
    off += data.length;
    chunks.push(data);
  }
  const json = Buffer.from(JSON.stringify(header), 'utf8');
  const pad = (4 - (json.length % 4)) % 4;
  const head = Buffer.alloc(16);
  head.writeUInt32LE(4, 0);
  head.writeUInt32LE(json.length + pad + 8, 4);
  head.writeUInt32LE(json.length + pad + 4, 8);
  head.writeUInt32LE(json.length, 12);
  return Buffer.concat([head, json, Buffer.alloc(pad), ...chunks]);
}

module.exports = { parse, entries, isPacked, readEntry, rebuild };
