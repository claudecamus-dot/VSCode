"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { createLimiter } = require("../src/concurrency-limit");

test("limiter never runs more than max tasks at once and runs all of them", async () => {
  const run = createLimiter(2);
  let active = 0;
  let peak = 0;
  const task = async () => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise(r => setTimeout(r, 15));
    active -= 1;
    return 1;
  };
  const res = await Promise.all(Array.from({ length: 7 }, () => run(task)));
  assert.equal(res.length, 7);
  assert.equal(peak, 2);
});

test("limiter keeps going after a failing task", async () => {
  const run = createLimiter(1);
  await assert.rejects(run(async () => { throw new Error("x"); }), /x/);
  assert.equal(await run(async () => 5), 5);
});

test("server.js routes every powershell spawn through the limiter", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const src = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
  assert.match(src, /function runPowerShell\(args, opts\) \{\s*return powerShellLimiter\(/);
  assert.equal((src.match(/spawn\("powershell\.exe"/g) || []).length, 1);
});
