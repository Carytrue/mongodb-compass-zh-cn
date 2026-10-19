#!/usr/bin/env node
'use strict';
// Drive a *test copy* of Compass over the Chrome DevTools Protocol, to check the localized UI.
//
//   1. Start a copy of Compass (never your real install) with a throw-away profile:
//        MongoDBCompass.exe --ignore-additional-command-line-flags \
//          --user-data-dir=<temp dir> --remote-debugging-port=9333
//   2. node tools/cdp.js <out-prefix> <steps-file.js>   (port: CDP_PORT, default 9333)
//
// The steps file exports an array of { js?, wait?, shot? }:
//   js   - expression evaluated in the page; its value is printed
//   wait - milliseconds to wait afterwards
//   shot - screenshot name, saved as <out-prefix><name>.png
//
// Example steps file:
//   const clickText = t => `[...document.querySelectorAll('button,[role=tab],a')]
//     .find(x => x.textContent.trim() === ${JSON.stringify(t)})?.click()`;
//   module.exports = [
//     { js: clickText('添加新连接'), wait: 1000 },
//     { js: 'document.body.innerText.slice(0, 500)', shot: 'dialog' },
//   ];
//
// Do not point this at a database you care about.

const fs = require('fs');
const path = require('path');

async function main() {
  const [prefix, stepsFile] = process.argv.slice(2);
  if (!prefix || !stepsFile) {
    console.error('usage: node tools/cdp.js <out-prefix> <steps-file.js>');
    process.exit(1);
  }
  const port = process.env.CDP_PORT || 9333;
  const pages = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  const page = pages.find(t => t.type === 'page');
  if (!page) throw new Error('no page found on port ' + port);

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => { ws.onopen = r; });
  let id = 0;
  const pending = new Map();
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  };
  const send = (method, params = {}) => new Promise(resolve => {
    const i = ++id;
    pending.set(i, resolve);
    ws.send(JSON.stringify({ id: i, method, params }));
  });

  for (const step of require(path.resolve(stepsFile))) {
    if (step.js) {
      const r = await send('Runtime.evaluate', { expression: step.js, awaitPromise: true, returnByValue: true });
      console.log('js ->', JSON.stringify(r.result?.result?.value ?? r.result?.exceptionDetails?.text));
    }
    if (step.wait) await new Promise(r => setTimeout(r, step.wait));
    if (step.shot) {
      const r = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(`${prefix}${step.shot}.png`, Buffer.from(r.result.data, 'base64'));
      console.log('shot', step.shot);
    }
  }
  ws.close();
}

main().catch(err => { console.error(err.message); process.exit(1); });
