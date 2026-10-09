from pathlib import Path

path = Path("tests/sqlite-regressions.test.mjs")
text = path.read_text()
old = 'await Promise.all([put({ language: "en" }), put({ accent: "blue" })]);\n  const saved = await repository.settings(); assert.equal(saved["ui.language"], "en"); assert.equal(saved["ui.accent"], "blue");'
new = 'await Promise.all([put({ language: "en" }), put({ accent: "otty-blue" })]);\n  const saved = await repository.settings(); assert.equal(saved["ui.language"], "en"); assert.equal(saved["ui.accent"], "otty-blue");'
if old not in text:
    raise SystemExit("missing sqlite accent assertion")
path.write_text(text.replace(old, new, 1))

path = Path("tests/storage.test.mjs")
text = path.read_text()
old = 'assert.equal(reloaded.settings.theme, "dark"); assert.equal(reloaded.settings.language, "en"); assert.equal(reloaded.settings.accent, "blue");'
new = 'assert.equal(reloaded.settings.theme, "dark"); assert.equal(reloaded.settings.language, "en"); assert.equal(reloaded.settings.accent, "otty-blue");'
if old not in text:
    raise SystemExit("missing storage accent assertion")
path.write_text(text.replace(old, new, 1))
