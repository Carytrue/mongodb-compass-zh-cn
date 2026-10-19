#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const { loadData, patchAsar, appVersion, isPatched, TESTED_VERSIONS } = require('../src/patch');
const { findAsars, compassRunning } = require('../src/platform');

const HELP = `compass-zh - 非官方 MongoDB Compass 简体中文汉化工具 / unofficial zh-CN patcher

用法 / usage:
  compass-zh info                       显示检测到的 Compass 安装和版本
  compass-zh patch [选项]               生成汉化后的 app.asar（不修改原文件）
  compass-zh install [选项]             备份并安装汉化（需先退出 Compass）
  compass-zh restore [选项]             还原为备份的原版

选项 / options:
  --asar <file>     指定 app.asar（默认自动查找最新安装的 Compass）
  --src <file>      patch：输入文件（默认：备份 app.asar.orig，否则 app.asar）
  --out <file>      patch：输出文件（默认 ./app.asar.zh-cn）
  --dry             只统计匹配情况，不写文件
  --verbose         列出每个词条的匹配次数和未匹配词条
  --no-marker       不在被修改的文件末尾追加标记注释（用于可复现性校验）
  --force           忽略版本/覆盖率检查
`;

function parseArgs(argv) {
  const o = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry') o.dry = true;
    else if (a === '--verbose') o.verbose = true;
    else if (a === '--no-marker') o.noMarker = true;
    else if (a === '--force') o.force = true;
    else if (['--asar', '--src', '--out'].includes(a)) o[a.slice(2)] = argv[++i];
    else if (a === '-h' || a === '--help') o.help = true;
    else o._.push(a);
  }
  return o;
}

const die = msg => { console.error('错误 / error: ' + msg); process.exit(1); };
const MIN_COVERAGE = 0.6;

function report(res, opts, version) {
  const { stats, matchedEntries, total } = res;
  console.log(`Compass 版本: ${version ?? '未知'}${version && !TESTED_VERSIONS.includes(version) ? '  (未测试过的版本，结果可能不完整)' : ''}`);
  console.log(`修改的文件 (${res.files.length}):`);
  for (const f of res.files) console.log('  ' + f);
  console.log(`词条匹配: ${matchedEntries}/${total}，精确替换规则命中: ${stats.raw.size}/${stats.raw.size + res.unmatchedRaw.length}`);
  if (opts.verbose) {
    console.log('未匹配的词条:');
    for (const k of res.unmatchedEntries) console.log('  - ' + k);
    for (const k of res.unmatchedRaw) console.log('  - [raw] ' + k);
  }
}

function runPatch(srcBuf, opts) {
  console.log('正在分析并替换界面文案，约需一分钟…');
  const res = patchAsar(srcBuf, loadData(), { marker: !opts.noMarker });
  const version = appVersion(srcBuf);
  report(res, opts, version);
  const coverage = res.matchedEntries / res.total;
  if (!opts.force && coverage < MIN_COVERAGE) {
    die(`只有 ${(coverage * 100).toFixed(0)}% 的词条匹配，这个 Compass 版本和词典差异较大。可用 --dry --verbose 查看，或加 --force 强行继续。`);
  }
  return res;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const cmd = opts._[0];
  if (opts.help || !cmd) { console.log(HELP); return; }

  const found = findAsars();
  const target = opts.asar || found[0];

  if (cmd === 'info') {
    if (!found.length) die('没有找到 Compass 安装，请用 --asar 指定 app.asar');
    for (const f of found) {
      const buf = fs.readFileSync(f);
      console.log(`${f}\n  版本: ${appVersion(buf) ?? '未知'}  已汉化: ${isPatched(buf) ? '是' : '否'}  备份: ${fs.existsSync(f + '.orig') ? '有' : '无'}`);
    }
    console.log('Compass 正在运行: ' + (compassRunning() ? '是' : '否'));
    return;
  }

  if (cmd === 'patch') {
    const src = opts.src || (target && fs.existsSync(target + '.orig') ? target + '.orig' : target);
    if (!src) die('没有找到 app.asar，请用 --src 指定');
    const buf = fs.readFileSync(src);
    if (isPatched(buf)) die(`${src} 已经是汉化过的版本，请改用原版（备份 app.asar.orig 或重新安装 Compass）`);
    const res = runPatch(buf, opts);
    if (opts.dry) { console.log('（--dry：未写入任何文件）'); return; }
    const out = opts.out || path.resolve('app.asar.zh-cn');
    if (path.resolve(out) === path.resolve(src)) die('--out 不能和输入文件相同');
    fs.writeFileSync(out, res.out);
    console.log('已生成: ' + out);
    return;
  }

  if (cmd === 'install') {
    if (!target) die('没有找到 Compass 安装，请用 --asar 指定 app.asar');
    if (compassRunning() && !opts.dry) die('Compass 正在运行，请先完全退出（包括托盘/后台进程）再安装');
    const backup = target + '.orig';
    const current = fs.readFileSync(target);
    if (!fs.existsSync(backup)) {
      if (isPatched(current)) die(`${target} 已被汉化但找不到备份 ${backup}，请重新安装 Compass 后再试`);
      if (!opts.dry) { fs.copyFileSync(target, backup); console.log('已备份原版: ' + backup); }
    }
    const src = fs.existsSync(backup) ? backup : target;
    const res = runPatch(fs.readFileSync(src), opts);
    if (opts.dry) { console.log('（--dry：未写入任何文件）'); return; }
    const tmp = target + '.zh-tmp';
    fs.writeFileSync(tmp, res.out);
    fs.copyFileSync(tmp, target);
    fs.unlinkSync(tmp);
    console.log('已安装汉化: ' + target + '\n还原请运行: compass-zh restore');
    return;
  }

  if (cmd === 'restore') {
    if (!target) die('没有找到 Compass 安装，请用 --asar 指定 app.asar');
    const backup = target + '.orig';
    if (!fs.existsSync(backup)) die('找不到备份 ' + backup);
    if (compassRunning()) die('Compass 正在运行，请先完全退出再还原');
    fs.copyFileSync(backup, target);
    console.log('已还原: ' + target);
    return;
  }

  die('未知命令: ' + cmd + '\n' + HELP);
}

main();
