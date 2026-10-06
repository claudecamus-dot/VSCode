"use strict";
const path = require("path");

// True when `target` is `dir` itself or lies under it. A bare
// target.startsWith(dir) would accept the sibling "<dir>-evil/x".
function isInside(dir, target) {
  return target === dir || target.startsWith(dir.endsWith(path.sep) ? dir : dir + path.sep);
}

module.exports = { isInside };
