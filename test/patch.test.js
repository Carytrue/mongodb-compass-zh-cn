'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const asar = require('../src/asar');
const { buildRules, applyRules, NBSP } = require('../src/rules');
const { patchAsar, isPatched, MARKER } = require('../src/patch');
const { makeAsar } = require('./helpers');

const run = (src, dict, raw = []) => {
  const stats = { counts: new Map(), raw: new Map() };
  return { out: applyRules(src, buildRules(dict), raw, stats), stats };
};

test('translates display properties', () => {
  const { out } = run('a({label:"Save",title:"Save",buttonText:"Save",placeholder:"Save"})', { Save: '保存' });
  assert.equal(out, 'a({label:"保存",title:"保存",buttonText:"保存",placeholder:"保存"})');
});

test('translates child text of React elements', () => {
  const dict = { Delete: '删除', 'Learn more about views': '了解更多关于视图的信息' };
  assert.equal(run('c(B,{onClick:f},"Delete")', dict).out, 'c(B,{onClick:f},"删除")');
  assert.equal(run('c("p",null,"Delete")', dict).out, 'c("p",null,"删除")');
  assert.equal(run('c(Icon,{glyph:"X"}),"Learn more about views")', dict).out, 'c(Icon,{glyph:"X"}),"了解更多关于视图的信息")');
});

test('never touches identifiers', () => {
  const src = 'switch(t){case"Documents":return 1}if(tab==="Documents"){}x={type:"Documents",id:"Documents"}';
  assert.equal(run(src, { Documents: '文档' }).out, src);
});

test('translates settings tab names only in tab-list shape', () => {
  const dict = { General: '常规' };
  assert.equal(run('{name:"General",id:"general"}', dict).out, '{name:"常规",id:"general"}');
  assert.equal(run('{name:"General",foo:1}', dict).out, '{name:"General",foo:1}');
});

test('long sentences are translated in any quoted context', () => {
  const s = 'Choose which members your reads go to.';
  const { out } = run(`x=a?"${s}":"other"`, { [s]: '选择读操作发往哪些成员。' });
  assert.equal(out, 'x=a?"选择读操作发往哪些成员。":"other"');
});

test('button words are translated in ternary arms, other words are not', () => {
  assert.equal(run('f(a?"Cancel":"Close")', { Cancel: '取消', Close: '关闭' }).out, 'f(a?"取消":"关闭")');
  assert.equal(run('x=a?"Documents":"Indexes"', { Documents: '文档', Indexes: '索引' }).out, 'x=a?"Documents":"Indexes"');
});

test('accepts a non-breaking space where the dictionary has a plain space', () => {
  const key = 'Need help getting started?';
  const { out } = run(`c(F,null,"${key.replace(' ', NBSP)}")`, { [key]: '需要入门帮助？' });
  assert.equal(out, 'c(F,null,"需要入门帮助？")');
});

test('raw entries: literal and regex', () => {
  const raw = [['a?"Options":"More"', 'a?"选项":"更多"'], ['re:(x\\()"Hi"\\)', '$1"你好")']];
  const { out, stats } = run('f(a?"Options":"More");x("Hi")', {}, raw);
  assert.equal(out, 'f(a?"选项":"更多");x("你好")');
  assert.equal(stats.raw.size, 2);
});

test('asar round trip: only target files change, layout and flags are preserved', () => {
  const renderer = 'c(B,null,"Delete");';
  const other = 'var x="Delete";';
  const buf = makeAsar({ 'build/a.renderer.js': renderer, 'build/lib.js': other, 'package.json': '{"version":"9.9.9"}' }, ['build/native.node']);
  const res = patchAsar(buf, { dict: { Delete: '删除' }, raw: [] });
  assert.deepEqual(res.files, ['build/a.renderer.js']);
  assert.ok(isPatched(res.out));

  const { header, dataStart } = asar.parse(res.out);
  const get = p => [...asar.entries(header)].find(e => e[0] === p)[1];
  const text = p => asar.readEntry(res.out, dataStart, get(p)).toString('utf8');
  assert.equal(text('build/a.renderer.js'), 'c(B,null,"删除");\n' + MARKER);
  assert.equal(text('build/lib.js'), other);
  assert.equal(text('package.json'), '{"version":"9.9.9"}');
  assert.equal(get('build/native.node').unpacked, true);
  const n = get('build/a.renderer.js');
  const data = asar.readEntry(res.out, dataStart, n);
  assert.equal(n.integrity.hash, crypto.createHash('sha256').update(data).digest('hex'));
});

test('main-process menu chunk is recognised by content, not by name', () => {
  const menu = 'x=[{label:"Select All",role:"selectAll"}];';
  const buf = makeAsar({ 'build/777.js': menu, 'build/888.js': 'var y="Select All";' });
  const res = patchAsar(buf, { dict: { 'Select All': '全选' }, raw: [] });
  assert.deepEqual(res.files, ['build/777.js']);
});

test('refuses to emit a file that no longer parses', () => {
  const buf = makeAsar({ 'build/a.renderer.js': 'c(B,null,"Delete");' });
  assert.throws(() => patchAsar(buf, { dict: { Delete: '删除' }, raw: [['c(B,null,', 'c(B,null,)))((']] }), /syntax error/);
});

test('without changes the archive is returned untouched', () => {
  const buf = makeAsar({ 'build/a.renderer.js': 'var a=1;' });
  const res = patchAsar(buf, { dict: { Delete: '删除' }, raw: [] });
  assert.equal(res.out, buf);
  assert.equal(res.files.length, 0);
});
