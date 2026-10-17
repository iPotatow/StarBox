import assert from "node:assert/strict";
import test from "node:test";
import { hasJsxComponent } from "../scripts/ui-source-contracts.mjs";

test("COSS component gate accepts JSX props and rejects textual lookalikes", () => {
  for (const source of ["<PageHeader>Stars</PageHeader>", '<PageHeader layout="responsive">Stars</PageHeader>', '<PageHeader\n layout="simple"\n/>']) {
    assert.equal(hasJsxComponent(source, "PageHeader"), true);
  }
  for (const source of ['const example = "<PageHeader>";', '// <PageHeader>\n<div />', '<PageHeaderReplacement />']) {
    assert.equal(hasJsxComponent(source, "PageHeader"), false);
  }
});
