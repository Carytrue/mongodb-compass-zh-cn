'use strict';
const crypto = require('crypto');

// Builds a small but format-correct asar archive in memory.
//   files: { 'build/a.renderer.js': 'text', ... }    packed files
//   unpacked: [ 'native/x.node' ]                    entries flagged `unpacked` (no data stored)
function makeAsar(files, unpacked = []) {
  const root = { files: {} };
  const chunks = [];
  let off = 0;
  const put = (p, node) => {
    const parts = p.split('/');
    let dir = root;
    for (const d of parts.slice(0, -1)) dir = dir.files[d] ??= { files: {} };
    dir.files[parts.at(-1)] = node;
  };
  for (const [p, text] of Object.entries(files)) {
    const data = Buffer.from(text, 'utf8');
    const hash = crypto.createHash('sha256').update(data).digest('hex');
    put(p, { size: data.length, offset: String(off), integrity: { algorithm: 'SHA256', hash, blockSize: 4194304, blocks: [hash] } });
    chunks.push(data);
    off += data.length;
  }
  for (const p of unpacked) put(p, { size: 3, unpacked: true });
  const json = Buffer.from(JSON.stringify(root), 'utf8');
  const pad = (4 - (json.length % 4)) % 4;
  const head = Buffer.alloc(16);
  head.writeUInt32LE(4, 0);
  head.writeUInt32LE(json.length + pad + 8, 4);
  head.writeUInt32LE(json.length + pad + 4, 8);
  head.writeUInt32LE(json.length, 12);
  return Buffer.concat([head, json, Buffer.alloc(pad), ...chunks]);
}

module.exports = { makeAsar };
