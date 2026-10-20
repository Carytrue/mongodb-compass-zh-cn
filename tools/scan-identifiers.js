// Scan a patched asar for translated (CJK) string literals used in comparisons / switch cases /
// includes() / trailing call args -- places where an identifier may have been rewritten by mistake.
const fs = require('fs');
const A = require('../src/asar');
const buf = fs.readFileSync(process.argv[2]);
const { header, dataStart } = A.parse(buf);
const CJ = String.raw`"[^"]*[\u4e00-\u9fff][^"]*"`;
const re = new RegExp(String.raw`(?:[=!]==?\s*${CJ}|${CJ}\s*[=!]==?|case${CJ}:|includes\(${CJ}\)|emit\([^)]*,${CJ}\))`, 'g');
let n = 0;
for (const [p, node] of A.entries(header)) {
  if (!/^build\/.*\.js$/.test(p)) continue;
  const t = A.readEntry(buf, dataStart, node).toString('utf8');
  for (const m of t.matchAll(re)) {
    n++;
    console.log(p.slice(6, 24), '|', t.slice(Math.max(0, m.index - 50), m.index + m[0].length + 30).replace(/\n/g, ' '));
  }
}
console.log('hits', n);
