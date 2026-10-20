# MongoDB Compass 简体中文汉化（非官方）

[English](README.en.md)

给 [MongoDB Compass](https://www.mongodb.com/products/tools/compass) 桌面版做界面汉化的小工具。Compass 本身没有多语言支持，所以这个项目的做法是：**读取你电脑上已安装的 `app.asar`，把界面文案按词典替换成中文，再写回去**。仓库里不包含任何 Compass 的程序文件，只有汉化工具和词典。

> 非官方项目，与 MongoDB, Inc. 无关。“MongoDB”“Compass”是 MongoDB, Inc. 的商标，这里仅用于说明本工具适用的软件。

## 现状

| 项目 | 状态 |
| --- | --- |
| 已验证的 Compass 版本 | **1.53.0**（Windows 11，Squirrel 安装版） |
| 词典 | 约 1450 条，外加 600 多条精确替换规则（`data/dict*.json`、`data/raw*.json` 会合并读取） |
| 已汉化 | 欢迎页、侧边栏、新建连接（含全部高级选项）、设置、集合页（文档/聚合/架构/索引/验证）、导入导出、数据建模、AI 助手面板、原生菜单、页签标题 |
| 有意保留英文 | 品牌/技术名词（MongoDB、Atlas、TLS、OIDC……）、代码示例、发送给 AI 模型的提示词、服务器返回的错误信息 |
| macOS / Linux | 未测试。asar 格式相同，但 macOS 版带有 asar 完整性校验，直接修改很可能无法启动 |

其他版本不保证可用：Compass 每次发布，打包后的文件名和变量名都会变，部分精确替换规则会失效。工具会告诉你匹配了多少词条，匹配率低于 60% 会拒绝安装。

## 使用

需要 [Node.js](https://nodejs.org/) 18 或更新版本。

```bash
git clone https://github.com/Carytrue/mongodb-compass-zh-cn.git
cd mongodb-compass-zh-cn
node bin/compass-zh.js info            # 检查检测到的 Compass 版本
node bin/compass-zh.js install --dry   # 先试跑，只看匹配情况，不写文件
```

确认没问题后，**完全退出 Compass**（包括托盘里的后台进程），再安装：

```bash
node bin/compass-zh.js install
```

`install` 会：

1. 把原版 `app.asar` 备份为同目录下的 `app.asar.orig`（只备份一次）；
2. 始终以这份原版备份为输入生成汉化版，并对每个被修改的文件做语法检查；
3. 覆盖 `app.asar`。

还原：

```bash
node bin/compass-zh.js restore
```

其他命令：

```bash
node bin/compass-zh.js patch --src app.asar.orig --out app.asar.zh-cn   # 只生成文件，不安装
node bin/compass-zh.js patch --dry --verbose                           # 列出未匹配的词条
```

### 注意

- **Compass 自动更新会覆盖汉化**：更新会在 `app-x.y.z` 下生成新版本目录，新版是英文。更新后重新运行 `install` 即可（新版本请先 `--dry` 看匹配率）。想避免被覆盖，可在 Compass 设置里关闭自动更新。
- 汉化只改 `app.asar` 里的文字，**不会动你的连接、数据和配置**。
- 修改 Compass 的程序文件是你自己的行为，出现问题可以用 `restore` 或重新安装 Compass 恢复。

## 工作原理

Compass 是 Electron 应用，界面代码被 webpack 压缩在 `app.asar` 里，文案是写死在代码中的英文字符串。工具做三件事：

1. **解析 asar**（`src/asar.js`）：只替换需要修改的文本文件，其余文件的布局、`unpacked` 标记、完整性哈希原样保留。
2. **按上下文替换**（`src/rules.js`）：不是简单的全局替换。像 `Documents`、`Delete` 这样的词同时被程序当作标识符使用，乱换会让程序出错。所以词典里的每个词只会在已知是“显示文字”的位置被替换，例如 `label:"Save"`、React 元素的子文本、设置里的标签页列表；长句子（≥30 个字符）因为不可能是标识符，会在任何位置替换。
3. **精确替换**（`data/raw.json`）：三元表达式、模板字符串、拼接的句子等特殊写法，用原文片段精确匹配。

## 参与贡献

欢迎补充翻译、修正译法、适配新版本。详见 [CONTRIBUTING.md](CONTRIBUTING.md)。

```bash
npm test      # 单元测试，不需要安装 Compass
```

## 许可

本仓库的代码和词典使用 [MIT](LICENSE) 许可。MongoDB Compass 本身遵循其自身的许可条款（SSPL）。**请不要把汉化后的 `app.asar` 提交或分发**：它包含 Compass 的程序代码，仓库的 `.gitignore` 已排除这类文件。词典里出现的英文短语仅作为匹配用的最小片段。
