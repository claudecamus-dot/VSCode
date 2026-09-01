"use strict";

// Couvre le routage de l'API (/api/*) : jusqu'ici entierement non teste, la
// seule verification existante (smoke-test.ps1) passe par generate-comop.ps1
// et ne parle jamais HTTP au serveur Node.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
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

// Finding server-api-corps-json (diagnostic 2026-09-01) : un corps JSON malforme
// tombait dans le try global du createServer, rendant un 500 portant le message
// brut du parseur (« Expected property name or '}' in JSON at position 1 »).
// Le contrat d'API attendu est un 400 sans fuite du message d'implementation.
test("POST /api/generate renvoie 400 sur un corps JSON malforme", async t => {
  const server = await startServer();
  t.after(() => server.stop());

  const payload = "{ceci n'est pas du JSON";
  const res = await request(server.baseUrl, "POST", "/api/generate", {
    headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) },
    body: payload
  });
  const body = JSON.parse(res.text);

  assert.equal(res.status, 400);
  assert.equal(body.error, "Corps JSON invalide");
});

test("POST /remove-shape renvoie 400 sur un corps JSON malforme", async t => {
  const server = await startServer();
  t.after(() => server.stop());

  // Le controle d'existence du template precede le parse : sans ce fichier la
  // route repondrait 404 et le defaut ne serait pas atteignable par ce chemin.
  fs.writeFileSync(path.join(server.dataRoot, "templates", "bidon.pptx"), "pptx factice");

  const payload = "{ceci n'est pas du JSON";
  const res = await request(server.baseUrl, "POST", "/api/templates/bidon.pptx/remove-shape", {
    headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) },
    body: payload
  });
  const body = JSON.parse(res.text);

  assert.equal(res.status, 400);
  assert.equal(body.error, "Corps JSON invalide");
});
