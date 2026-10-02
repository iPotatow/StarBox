import assert from "node:assert/strict";
import test from "node:test";
import { translate, uiLocale } from "../.test-build/client/src/lib/translate.js";

test("UI language selects the requested copy and regional date locale", () => {
  assert.equal(translate("zh-CN", "设置", "Settings", "設定"), "设置");
  assert.equal(translate("en", "设置", "Settings", "設定"), "Settings");
  assert.equal(translate("zh-TW", "设置", "Settings", "設定"), "設定");
  assert.equal(uiLocale("zh-TW"), "zh-TW");
  assert.equal(uiLocale("zh-CN"), "zh-CN");
  assert.equal(uiLocale("en"), "en-US");
});

test("interpolated repository names and user text are kept verbatim", () => {
  const name = "owner/软件开发";
  assert.equal(translate("zh-TW", `取消 ${name} 的订阅`, `Unsubscribe ${name}`, `取消 ${name} 的訂閱`), "取消 owner/软件开发 的訂閱");
});
