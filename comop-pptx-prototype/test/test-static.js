"use strict";

// Couvre serveStatic() : sert web/index.html par defaut, le telechargement
// d'un export sous /output/, et les 404 pour ce qui n'existe pas.

const test = require("node:test");
const assert = require("node:assert/strict");
const { startServer, request } = require("../test-support/helpers");

test("GET / sert web/index.html", async t => {
  const server = await startServer();
  t.after(() => server.stop());

  const res = await request(server.baseUrl, "GET", "/");

  assert.equal(res.status, 200);
  assert.match(res.headers["content-type"], /text\/html/);
  assert.match(res.text, /<html/i);
});

test("GET /output/inexistant.pptx renvoie 404", async t => {
  const server = await startServer();
  t.after(() => server.stop());

  const res = await request(server.baseUrl, "GET", "/output/inexistant.pptx");

  assert.equal(res.status, 404);
});

test("GET d'une page inconnue hors /api et /output renvoie 404", async t => {
  const server = await startServer();
  t.after(() => server.stop());

  const res = await request(server.baseUrl, "GET", "/rien-du-tout.html");

  assert.equal(res.status, 404);
});
