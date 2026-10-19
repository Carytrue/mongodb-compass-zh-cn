'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const cmpVersion = (a, b) => {
  const pa = a.split('.').map(Number), pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d;
  }
  return 0;
};

// Candidate app.asar files of installed Compass versions, newest first.
function findAsars() {
  if (process.platform === 'win32') {
    const base = path.join(process.env.LOCALAPPDATA || '', 'MongoDBCompass');
    if (!fs.existsSync(base)) return [];
    return fs.readdirSync(base)
      .map(d => /^app-(\d+(?:\.\d+)*)$/.exec(d))
      .filter(Boolean)
      .sort((a, b) => cmpVersion(b[1], a[1]))
      .map(m => path.join(base, m[0], 'resources', 'app.asar'))
      .filter(p => fs.existsSync(p));
  }
  const known = process.platform === 'darwin'
    ? ['/Applications/MongoDB Compass.app/Contents/Resources/app.asar']
    : ['/usr/lib/mongodb-compass/resources/app.asar', '/opt/mongodb-compass/resources/app.asar'];
  return known.filter(p => fs.existsSync(p));
}

function compassRunning() {
  try {
    if (process.platform === 'win32') {
      const out = execFileSync('tasklist', ['/FI', 'IMAGENAME eq MongoDBCompass.exe', '/NH'], { encoding: 'utf8' });
      return /MongoDBCompass\.exe/i.test(out);
    }
    execFileSync('pgrep', ['-fi', 'mongodb[ -]compass'], { stdio: 'ignore' });
    return true;
  } catch {
    return false; // pgrep exits non-zero when nothing matches
  }
}

module.exports = { findAsars, compassRunning };
