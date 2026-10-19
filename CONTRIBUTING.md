# 贡献指南 / Contributing

## 补充或修正翻译

词典在 `data/dict.json`：`"英文原文": "中文译文"`。

1. 找到还是英文的界面文字，把**原文逐字**（含标点、结尾空格）作为键。
2. 先试跑，看有没有匹配上：

   ```bash
   node bin/compass-zh.js patch --dry --verbose
   ```

   末尾“未匹配的词条”里出现你的键，说明这个词没有出现在已知的显示位置（见 `src/rules.js` 开头的说明）。
3. 没匹配上时，找出它在压缩代码里的写法（见下文“定位英文原文”），把那一小段原文片段加到 `data/raw.json`：

   ```json
   ["cond?\"Select files…\":\"Select a file…\"", "cond?\"选择多个文件…\":\"选择文件…\""]
   ```

   需要匹配不同变量名或空白时，可以用正则条目：`["re:(foo\\()\"Hi\"\\)", "$1\"你好\")"]`。
4. 提交前：`npm test`，并在**一份测试副本**上验证（见下文）。

### 翻译约定

- 术语：集合（collection）、文档（document）、架构（schema）、索引（index）、聚合管道（aggregation pipeline）、阶段（stage）、副本集（replica set）、分片（shard）、执行计划（explain plan）、连接字符串（connection string）。
- 品牌和技术名词保留英文：MongoDB、Atlas、Compass、TLS/SSL、OIDC、Kerberos、X.509、KMS、SRV、URI、JSON、BSON。
- 不要翻译：发送给 AI 模型的提示词、工具定义、程序内部的标识符（页签 `type`、事件名等）。
- 句子被链接或加粗拆成几段时，按拆分后的片段逐段翻译，并保证拼起来读得通。

## 定位英文原文

1. 解包一份原版 asar 到临时目录（不要修改安装目录里的文件）：

   ```bash
   npx @electron/asar extract app.asar.orig /tmp/compass-src
   ```

2. 在 `/tmp/compass-src/build/*.renderer.js` 里搜索那句英文，看它前后的代码是 `label:"..."`、`createElement(X,null,"...")`，还是三元表达式 / 模板字符串。
3. 只改显示用的文字，不要改 `type:"..."`、`case"..."`、`===` 比较里的字符串。

## 在测试副本里验证界面

不要在你正在使用的 Compass 上试。把整个 `app-x.y.z` 目录复制一份，替换副本里的 `resources/app.asar`，再用独立的数据目录启动：

```bash
MongoDBCompass.exe --ignore-additional-command-line-flags --user-data-dir=<临时目录> --remote-debugging-port=9333
```

`tools/cdp.js` 可以通过调试端口执行页面脚本并截图，用来批量检查界面（见脚本顶部说明）。**不要用它连接你的真实数据库。**

## 适配新版本

1. `node bin/compass-zh.js patch --src <新版 app.asar> --dry --verbose`，看匹配率和未匹配词条。
2. 对未匹配的 `raw.json` 条目，在新版代码里找到对应写法，更新片段。
3. 验证通过后，把版本号加入 `src/patch.js` 的 `TESTED_VERSIONS`，并更新 README 里的“已验证版本”。

## 提交 PR

- 一个 PR 只做一类修改（翻译 / 新版本适配 / 工具代码）。
- 不要提交任何 `.asar` 文件或从 Compass 解包出来的代码。
