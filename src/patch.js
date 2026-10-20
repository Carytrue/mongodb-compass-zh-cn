'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const asar = require('./asar');
const { buildRules, applyRules } = require('./rules');

const DATA_DIR = path.join(__dirname, '..', 'data');
const MARKER = '/* compass-zh-cn */';
// Compass versions the dictionary has been checked against (see README).
const TESTED_VERSIONS = ['1.53.0'];

// data/dict.json + any data/dict-*.json (merged, later files win); data/raw.json + data/raw-*.json (concatenated)
function loadData(dir = DATA_DIR) {
  const files = fs.readdirSync(dir).sort();
  const pick = prefix => files.filter(f => f === prefix + '.json' || (f.startsWith(prefix + '-') && f.endsWith('.json')));
  const dict = Object.assign({}, ...pick('dict').map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))));
  const raw = [].concat(...pick('raw').map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))));
  return { dict, raw };
}

// Renderer bundles hold almost all UI text. The native menu bar lives in a main-process chunk;
// its file name is a number that changes between releases, so we recognise it by content.
function isTarget(p, getText) {
  if (/^build\/[^/]+\.renderer\.js$/.test(p)) return true;
  return /^build\/[^/]+\.js$/.test(p) && getText().includes('role:"selectAll"');
}

function appVersion(buf) {
  try {
    const { header, dataStart } = asar.parse(buf);
    for (const [p, n] of asar.entries(header)) {
      if (p === 'package.json') return JSON.parse(asar.readEntry(buf, dataStart, n).toString('utf8')).version;
    }
  } catch { /* ignore */ }
  return undefined;
}

function isPatched(buf) {
  return buf.includes(Buffer.from(MARKER));
}

// Patch an app.asar held in a Buffer. Never touches the disk.
//   opts.marker (default true): append MARKER to every patched file so we can detect double patching.
//   opts.onMatch(en, source, match): debug hook.
function patchAsar(buf, { dict, raw }, opts = {}) {
  const marker = opts.marker !== false;
  const rules = buildRules(dict);
  const stats = { counts: new Map(), raw: new Map() };
  const { header, dataStart } = asar.parse(buf);
  const replacements = new Map();

  for (const [p, n] of asar.entries(header)) {
    if (!asar.isPacked(n)) continue;
    let text;
    const getText = () => (text ??= asar.readEntry(buf, dataStart, n).toString('utf8'));
    if (!isTarget(p, getText)) continue;
    const before = getText();
    let after = applyRules(before, rules, raw, stats, opts.onMatch);
    if (after === before) continue;
    if (marker) after += '\n' + MARKER;
    try {
      new vm.Script(after, { filename: p }); // syntax check: never ship a file that no longer parses
    } catch (err) {
      throw new Error(`patched ${p} has a syntax error (${err.message}); aborting`);
    }
    replacements.set(p, Buffer.from(after, 'utf8'));
  }

  const matchedEntries = Object.keys(dict).filter(k => stats.counts.get(k)).length;
  const unmatchedEntries = Object.keys(dict).filter(k => !stats.counts.get(k));
  const unmatchedRaw = raw.map(r => r[0]).filter(k => !stats.raw.get(k));
  return {
    out: replacements.size ? asar.rebuild(buf, replacements) : buf,
    files: [...replacements.keys()],
    stats, matchedEntries, unmatchedEntries, unmatchedRaw,
    total: Object.keys(dict).length,
  };
}

module.exports = { loadData, patchAsar, appVersion, isPatched, TESTED_VERSIONS, MARKER };
