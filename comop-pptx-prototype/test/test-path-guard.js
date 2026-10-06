"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { isInside } = require("../src/path-guard");

test("isInside accepts children and rejects sibling directories sharing the prefix", () => {
  const dir = path.resolve("/x/templates");
  assert.equal(isInside(dir, path.join(dir, "a.pptx")), true);
  assert.equal(isInside(dir, dir), true);
  assert.equal(isInside(dir, path.resolve("/x/templates-evil/a.pptx")), false);
  assert.equal(isInside(dir, path.resolve("/x/other/a.pptx")), false);
});
