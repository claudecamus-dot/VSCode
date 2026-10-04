"use strict";

// Preload de test (NODE_OPTIONS=--require) : n'agit que si les variables
// COMOP_TEST_* sont posees, donc jamais en usage normal du serveur.
const fs = require("fs");

if (process.env.COMOP_TEST_FS_LOG) {
  const logFile = process.env.COMOP_TEST_FS_LOG;
  const realWrite = fs.writeFileSync;
  const realRename = fs.renameSync;
  const note = (op, args) => realWrite.call(fs, logFile, JSON.stringify({ op, args: args.filter(a => typeof a === "string").slice(0, 2) }) + "\n", { flag: "a" });
  fs.writeFileSync = function (file, ...rest) {
    if (typeof file === "string" && file !== logFile) note("write", [file]);
    return realWrite.call(fs, file, ...rest);
  };
  fs.renameSync = function (from, to) {
    note("rename", [from, to]);
    return realRename.call(fs, from, to);
  };
}

if (process.env.COMOP_TEST_REJECT_AFTER_MS) {
  setTimeout(() => { Promise.reject(new Error("rejet de test")); }, Number(process.env.COMOP_TEST_REJECT_AFTER_MS));
}
