"use strict";

// Couvre le routage de l'API (/api/*) : jusqu'ici entierement non teste, la
// seule verification existante (smoke-test.ps1) passe par generate-comop.ps1
// et ne parle jamais HTTP au serveur Node.

const test = require("node:test");
const assert = require("node:assert/strict");
const { startServer, request } = require("../test-support/helpers");

test("GET /api/templates renvoie une liste vide sur un dossier templates/ vierge", async t => {
  const server = await startServer();
  t.after(() => server.stop());

  const res = await request(server.baseUrl, "GET", "/api/templates");
  const body = JSON.parse(res.text);

  assert.equal(res.status, 200);
  assert.deepEqual(body, { templates: [] });
});

test("GET /api/sample renvoie le JSON d'exemple", async t => {
  const server = await startServer();
  t.after(() => server.stop());

  const res = await request(server.baseUrl, "GET", "/api/sample");
  const body = JSON.parse(res.text);

  assert.equal(res.status, 200);
  assert.equal(typeof body, "object");
});

test("POST /api/generate renvoie 404 quand le template reference n'existe pas", async t => {
  const server = await startServer();
  t.after(() => server.stop());

  const payload = JSON.stringify({ template: "absent.pptx", fields: {} });
  const res = await request(server.baseUrl, "POST", "/api/generate", {
    headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) },
    body: payload
  });
  const body = JSON.parse(res.text);

  assert.equal(res.status, 404);
  assert.match(body.error, /introuvable/i);
});

test("une route API inconnue renvoie 404 explicite", async t => {
  const server = await startServer();
  t.after(() => server.stop());

  const res = await request(server.baseUrl, "GET", "/api/nawak");
  const body = JSON.parse(res.text);

  assert.equal(res.status, 404);
  assert.equal(body.error, "Route API inconnue");
});
