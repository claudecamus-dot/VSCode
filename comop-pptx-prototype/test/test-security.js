"use strict";

// Couvre le garde-fou safeTemplatePath() : c'est le seul point du serveur qui
// construit un chemin disque a partir d'une entree utilisateur (nom de
// template), donc le seul risque de traversee de repertoire (ADR implicite
// du prototype). Verifie via de vraies requetes HTTP sur un serveur reel.

const test = require("node:test");
const assert = require("node:assert/strict");
const { startServer, request } = require("../test-support/helpers");

test("route rejette une tentative de traversee de repertoire (DELETE)", async t => {
  const server = await startServer();
  t.after(() => server.stop());

  const res = await request(server.baseUrl, "DELETE", "/api/templates/..%2F..%2Fserver.js");
  const body = JSON.parse(res.text);

  // path.basename() neutralise la traversee : le nom est reduit a "server.js",
  // qui n'a pas l'extension .pptx attendue -> rejet 400, pas 200/500.
  assert.equal(res.status, 400);
  assert.match(body.error, /invalide/i);
});

test("route rejette un nom de template sans extension .pptx (upload)", async t => {
  const server = await startServer();
  t.after(() => server.stop());

  const res = await request(server.baseUrl, "POST", "/api/templates", {
    headers: { "x-template-name": "pas-un-pptx.txt" },
    body: Buffer.from("contenu factice")
  });
  const body = JSON.parse(res.text);

  assert.equal(res.status, 400);
  assert.match(body.error, /invalide/i);
});

test("route rejette un fichier .pptx dont le contenu n'est pas une archive ZIP", async t => {
  // Audit du 2026-09-02 (securite) : seul le NOM etait valide (extension
  // .pptx) -- un fichier arbitraire portant cette extension etait accepte,
  // ecrit durablement, et liste par GET /api/templates comme un template
  // valide, sans jamais verifier le CONTENU avant cette route.
  const server = await startServer();
  t.after(() => server.stop());

  const res = await request(server.baseUrl, "POST", "/api/templates", {
    headers: { "x-template-name": "faux-pptx.pptx" },
    body: Buffer.from("ceci n'est pas une archive zip, juste du texte")
  });
  const body = JSON.parse(res.text);

  assert.equal(res.status, 400);
  assert.match(body.error, /zip|ooxml/i);

  const liste = await request(server.baseUrl, "GET", "/api/templates");
  const templates = JSON.parse(liste.text).templates;
  assert.ok(!templates.some(t => t.file === "faux-pptx.pptx"), (
    "le faux template rejete ne doit pas avoir ete ecrit ni liste"));
});

test("route accepte un nom de template valide (zones) meme si le fichier n'existe pas encore -> 404, pas 500", async t => {
  const server = await startServer();
  t.after(() => server.stop());

  const res = await request(server.baseUrl, "GET", "/api/templates/inconnu.pptx/zones");
  const body = JSON.parse(res.text);

  assert.equal(res.status, 404);
  assert.match(body.error, /introuvable/i);
});
