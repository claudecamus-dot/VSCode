"use strict";

// Robustesse (audit VSCode) : promesse rejetee, statique non fichier,
// ecriture atomique de request-<id>.json.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { startServer, request } = require("../test-support/helpers");

const preload = path.join(__dirname, "..", "test-support", "robustness-preload.js");
const nodeOpts = `--require "${preload.replace(/\\/g, "/")}"`;

test("une promesse rejetee ne tue pas le serveur", async t => {
  const server = await startServer({ env: { NODE_OPTIONS: nodeOpts, COMOP_TEST_REJECT_AFTER_MS: "200" } });
  t.after(() => server.stop());

  await new Promise(r => setTimeout(r, 800));
  const res = await request(server.baseUrl, "GET", "/");
  assert.equal(res.status, 200);
});

test("GET d'un repertoire sous web/ renvoie 404, pas 500", async t => {
  const server = await startServer();
  t.after(() => server.stop());

  // http.request(URL) normaliserait "/%2e" en "/" : options explicites, chemin brut.
  const { port } = new URL(server.baseUrl);
  const status = await new Promise((resolve, reject) => {
    require("node:http").get({ host: "127.0.0.1", port, path: "/%2e" }, res => {
      res.resume();
      res.on("end", () => resolve(res.statusCode));
    }).on("error", reject);
  });
  assert.equal(status, 404);
});

test("request-<id>.json est ecrit via un fichier temporaire puis rename", async t => {
  const fsLog = path.join(require("node:os").tmpdir(), `comop-fslog-${process.pid}-${Date.now()}.jsonl`);
  const server = await startServer({ env: { NODE_OPTIONS: nodeOpts, COMOP_TEST_FS_LOG: fsLog } });
  t.after(() => { server.stop(); fs.rmSync(fsLog, { force: true }); });

  fs.writeFileSync(path.join(server.dataRoot, "templates", "t.pptx"), "pas un vrai pptx");
  await request(server.baseUrl, "POST", "/api/generate", {
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ template: "t.pptx", fields: { a: 1 } })
  });

  const entries = fs.readFileSync(fsLog, "utf8").trim().split("\n").map(l => JSON.parse(l));
  const isReq = p => /request-[^\\/]+\.json$/.test(p);
  const direct = entries.filter(e => e.op === "write" && isReq(e.args[0]));
  const renamed = entries.filter(e => e.op === "rename" && isReq(e.args[1]));
  assert.equal(direct.length, 0, "aucune ecriture directe sur request-<id>.json");
  assert.equal(renamed.length, 1, "un rename vers request-<id>.json");
  assert.equal(path.dirname(renamed[0].args[0]), path.dirname(renamed[0].args[1]), "tmp dans le meme dossier");
});
