# MongoDB Compass – Simplified Chinese (zh-CN) localization (unofficial)

[简体中文](README.md)

Compass has no built-in i18n, so this tool localizes the desktop app by **reading the `app.asar` you already have installed, replacing UI strings with Chinese according to a dictionary, and writing the result back**. The repository contains no Compass program files – only the patcher and the dictionary.

> Unofficial and not affiliated with MongoDB, Inc. "MongoDB" and "Compass" are trademarks of MongoDB, Inc., used here only to say which software this tool is for.

## Status

- Verified against **Compass 1.53.0** on Windows 11 (Squirrel installer). Other versions are not guaranteed: minified file and variable names change on every release, so some exact-match rules may stop matching. The tool prints how many dictionary entries matched and refuses to install below 60 %.
- ~1450 dictionary entries plus 600+ exact-match rules (all `data/dict*.json` and `data/raw*.json` files are merged) cover the welcome screen, sidebar, New Connection (all advanced options), Settings, collection tabs, import/export, data modeling, the AI assistant panel, the native menu and tab titles.
- Left in English on purpose: brand/technical terms, code samples, prompts that are sent to AI models, and server-side error messages.
- macOS / Linux: untested (macOS builds may verify asar integrity).

## Usage

Requires Node.js 18+.

```bash
node bin/compass-zh.js info            # detected Compass installs and versions
node bin/compass-zh.js install --dry   # dry run: report matches, write nothing
# quit Compass completely, then:
node bin/compass-zh.js install         # backs up app.asar -> app.asar.orig, then installs
node bin/compass-zh.js restore         # put the original back
node bin/compass-zh.js patch --src app.asar.orig --out app.asar.zh-cn   # just write a file
```

`install` always patches from the pristine backup, syntax-checks every modified file, and refuses to run while Compass is running. Compass auto-updates install a new `app-x.y.z` folder in English; re-run `install` after updating (use `--dry` first on new versions).

## How it works

1. `src/asar.js` rewrites only the text files that need changes; layout, `unpacked` flags and integrity hashes of everything else are preserved.
2. `src/rules.js` turns each dictionary entry into regexes that only match *display* positions (`label:"Save"`, React child text, settings tab lists, long sentences, …). Words such as `Documents` or `Delete` are also used as identifiers, so a global replace would break the app.
3. `data/raw.json` holds exact code snippets for ternaries, template literals and split sentences.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). `npm test` runs the unit tests (no Compass needed).

## License

Code and dictionary: [MIT](LICENSE). MongoDB Compass itself is under its own license (SSPL). Do **not** commit or redistribute a patched `app.asar` – it contains Compass code; `.gitignore` excludes such files. The English phrases in the dictionary are minimal match keys.
