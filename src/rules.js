'use strict';
// Turns the dictionary (English -> Chinese) into regular expressions that only match
// *user-visible* string literals in Compass' minified JavaScript bundles.
//
// Why not a plain "replace every occurrence"? Many words ("Documents", "Indexes", "Delete", ...)
// are also used as identifiers (tab names, switch cases, event names). Replacing those would break
// the app. So every key is only translated in contexts that are known to be display text:
//   1. as the value of a display property:          label:"Save"   title:"..."   buttonText:"..."
//   2. as a child text of a React element:          createElement(X,{...},"Save")   createElement(X,null,"Save")
//   3. as the name of a settings / form tab:         {name:"General",id:"general"}
//   4. long sentences (>= 30 chars, with spaces):    any quoted literal, because a sentence is never an identifier
//   5. a short whitelist of plain button words:      ternary arms  cond?"Cancel":"Close"
// Anything more exotic goes into raw.json (exact code snippets).

const NBSP = ' ';

const PROPS = '(?:text|label|title|subtitle|placeholder|description|tooltip|header|short|long|children|message|' +
  '[a-zA-Z]+(?:Text|Label|Title|Placeholder|Description|Message))';

// Plain button words that are safe to translate in `),"X")` and ternary-arm positions.
const SAFE = new Set(['Cancel', 'Close', 'Skip', 'Confirm', 'Retry', 'Done', 'Back', 'Next', 'Save',
  'Apply', 'Create', 'Delete', 'Submit', 'Update', 'Insert', 'Stop', 'Reset']);

const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&');

function buildRules(dict) {
  return Object.entries(dict).map(([en, zh]) => {
    // React sometimes emits a non-breaking space where the source has a plain one: accept both.
    const e = escapeRe(en).replace(/ /g, `[ ${NBSP}]`);
    const z = JSON.stringify(zh);
    const patterns = [
      [new RegExp(String.raw`(\b${PROPS}:)"${e}"`, 'g'), `$1${z}`],
      [new RegExp(String.raw`(\},|null,)"${e}"(?=[,)])`, 'g'), `$1${z}`],
      [new RegExp(String.raw`(\bname:)"${e}"(?=,(?:id|component):)`, 'g'), `$1${z}`],
    ];
    if (en.length >= 8 && en.includes(' ')) {
      patterns.push([new RegExp(String.raw`(\),)"${e}"(?=[,)])`, 'g'), `$1${z}`]);
    }
    if (SAFE.has(en)) {
      patterns.push(
        [new RegExp(String.raw`(\),)"${e}"(?=[,)])`, 'g'), `$1${z}`],
        [new RegExp(String.raw`(\?)"${e}"(?=:)`, 'g'), `$1${z}`],
        [new RegExp(String.raw`(:)"${e}"(?=\))`, 'g'), `$1${z}`],
      );
    }
    if (en.length >= 30 && en.includes(' ')) {
      patterns.push([new RegExp('"' + e + '"', 'g'), z]);
    }
    // cheap pre-filter: a rule can only match in files that contain its longest space-free word
    const needle = en.split(/[  ]+/).sort((a, b) => b.length - a.length)[0];
    return { en, zh, needle, patterns };
  });
}

// Applies dictionary rules and raw snippets to one source file.
// stats.counts: Map(en -> n), stats.raw: Map(rawKey -> n).  Returns the new source.
function applyRules(source, rules, raw, stats, onMatch) {
  let s = source;
  for (const r of rules) {
    if (!s.includes(r.needle)) continue;
    for (const [re, rep] of r.patterns) {
      if (onMatch) for (const m of s.matchAll(re)) onMatch(r.en, s, m);
      const n = (s.match(re) || []).length;
      if (n) {
        stats.counts.set(r.en, (stats.counts.get(r.en) || 0) + n);
        s = s.replace(re, rep);
      }
    }
  }
  for (const [from, to] of raw) {
    if (from.startsWith('re:')) { // "re:<regex source>" -> replacement may use $1, $2 ...
      const re = new RegExp(from.slice(3), 'g');
      const n = (s.match(re) || []).length;
      if (n) {
        stats.raw.set(from, (stats.raw.get(from) || 0) + n);
        s = s.replace(re, to);
      }
      continue;
    }
    const parts = s.split(from);
    if (parts.length > 1) {
      stats.raw.set(from, (stats.raw.get(from) || 0) + parts.length - 1);
      s = parts.join(to);
    }
  }
  return s;
}

module.exports = { buildRules, applyRules, NBSP };
