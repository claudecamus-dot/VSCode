"use strict";

// Audit 2026-09-07 (risque technique, MESURE c8 : 139 lignes non couvertes
// sur 613, 77,28 %) : les chemins NOMINAUX (succes) de DELETE
// /api/templates/<n>, GET /zones, POST /remove-shape et POST /api/generate
// n'etaient exerces par AUCUN test HTTP -- seul smoke-test.ps1 les couvrait,
// en appelant les scripts PowerShell directement, sans jamais passer par le
// serveur Node (routage, sidecars, invalidation de cache). Couvre aussi le
// chemin PowerShell exit != 0 (server.js:204-207) et le timeout
// (server.js:195-197), via l'override COMOP_POWERSHELL_TIMEOUT_MS.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { startServer, request } = require("../test-support/helpers");

const projectRoot = path.join(__dirname, "..");
const realTemplate = path.join(projectRoot, "templates", "comop-template.pptx");
const powershell = process.platform === "win32" ? "powershell.exe" : null;
// Shape reelle du template du depot, deja utilisee comme golden-file par
// smoke-test.ps1 (slide 2) -- meme reference, meme garantie qu'elle existe.
const REAL_SHAPE_NAME = "Google Shape;305;g3072d353d33_0_186";

function seedRealTemplate(server, fileName = "reel.pptx") {
  const dest = path.join(server.dataRoot, "templates", fileName);
  fs.copyFileSync(realTemplate, dest);
  return dest;
}

test("GET /zones (chemin nominal) detecte reellement les zones et les met en cache", { skip: !powershell }, async t => {
  const server = await startServer();
  t.after(() => server.stop());
  seedRealTemplate(server);

  const res = await request(server.baseUrl, "GET", "/api/templates/reel.pptx/zones");
  const body = JSON.parse(res.text);

  assert.equal(res.status, 200);
  assert.ok(Array.isArray(body.slides) && body.slides.length > 0, "les zones detectees doivent lister au moins une slide");

  const zonesPath = path.join(server.dataRoot, "templates", "reel.zones.json");
  assert.ok(fs.existsSync(zonesPath), "le sidecar .zones.json doit etre ecrit (cache)");

  // Deuxieme appel : sert le cache, ne relance pas PowerShell (verifie
  // indirectement -- une reponse rapide et identique).
  const res2 = await request(server.baseUrl, "GET", "/api/templates/reel.pptx/zones");
  assert.equal(res2.status, 200);
  assert.deepEqual(JSON.parse(res2.text), body);
});

test("POST /remove-shape (chemin nominal) retire la forme et invalide le cache de zones", { skip: !powershell }, async t => {
  const server = await startServer();
  t.after(() => server.stop());
  const templatePath = seedRealTemplate(server);

  // Pre-remplit le cache de zones pour verifier qu'il est bien invalide par
  // la suppression (sinon /zones re-servirait les zones d'AVANT suppression).
  const avant = await request(server.baseUrl, "GET", "/api/templates/reel.pptx/zones");
  assert.equal(avant.status, 200);
  const zonesPath = path.join(server.dataRoot, "templates", "reel.zones.json");
  assert.ok(fs.existsSync(zonesPath));

  const payload = JSON.stringify({ slideIndex: 2, shapeName: REAL_SHAPE_NAME });
  const res = await request(server.baseUrl, "POST", "/api/templates/reel.pptx/remove-shape", {
    headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) },
    body: payload
  });
  const body = JSON.parse(res.text);

  assert.equal(res.status, 200);
  assert.equal(body.shapeName, REAL_SHAPE_NAME);
  assert.ok(fs.existsSync(templatePath), "le template mute doit rester present");
  assert.ok(!fs.existsSync(zonesPath), "le cache de zones doit etre invalide (supprime) apres la mutation");

  const apres = await request(server.baseUrl, "GET", "/api/templates/reel.pptx/zones");
  const zonesApres = JSON.parse(apres.text);
  const slide2 = zonesApres.slides.find(s => s.index === 2);
  assert.ok(!slide2.zones.some(z => z.nom === REAL_SHAPE_NAME), "la forme retiree ne doit plus apparaitre apres re-detection");
});

// server.js:204-207 : PowerShell qui leve une exception (exit != 0) --
// remove-template-shape.ps1 throw quand la forme demandee n'existe pas.
test("POST /remove-shape sur une forme introuvable renvoie 500 gere (PowerShell exit != 0), serveur toujours UP", { skip: !powershell }, async t => {
  const server = await startServer();
  t.after(() => server.stop());
  seedRealTemplate(server);

  const payload = JSON.stringify({ slideIndex: 2, shapeName: "forme-qui-n-existe-pas" });
  const res = await request(server.baseUrl, "POST", "/api/templates/reel.pptx/remove-shape", {
    headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) },
    body: payload
  });
  const body = JSON.parse(res.text);

  assert.equal(res.status, 500);
  assert.equal(body.error, "Erreur interne du serveur");

  const suivant = await request(server.baseUrl, "GET", "/api/sample");
  assert.equal(suivant.status, 200);
});

test("DELETE /api/templates/<n> (chemin nominal) retire le fichier et tous ses sidecars", { skip: !powershell }, async t => {
  const server = await startServer();
  t.after(() => server.stop());
  const templatePath = seedRealTemplate(server, "a-supprimer.pptx");

  // Genere aussi les sidecars (zones + meta) pour verifier qu'ils sont bien
  // tous retires, pas seulement le .pptx.
  const zonesRes = await request(server.baseUrl, "GET", "/api/templates/a-supprimer.pptx/zones");
  assert.equal(zonesRes.status, 200);
  const zonesPath = path.join(server.dataRoot, "templates", "a-supprimer.zones.json");
  const metaPath = path.join(server.dataRoot, "templates", "a-supprimer.meta.json");
  fs.writeFileSync(metaPath, JSON.stringify({ name: "A supprimer" }));
  assert.ok(fs.existsSync(zonesPath) && fs.existsSync(metaPath));

  const res = await request(server.baseUrl, "DELETE", "/api/templates/a-supprimer.pptx");
  const body = JSON.parse(res.text);

  assert.equal(res.status, 200);
  assert.equal(body.file, "a-supprimer.pptx");
  assert.ok(!fs.existsSync(templatePath), "le .pptx doit etre supprime");
  assert.ok(!fs.existsSync(zonesPath), "le sidecar .zones.json doit etre supprime");
  assert.ok(!fs.existsSync(metaPath), "le sidecar .meta.json doit etre supprime");

  const liste = await request(server.baseUrl, "GET", "/api/templates");
  const templates = JSON.parse(liste.text).templates;
  assert.ok(!templates.some(t => t.file === "a-supprimer.pptx"));
});

test("DELETE /api/templates/<n> renvoie 404 si le template n'existe pas", async t => {
  const server = await startServer();
  t.after(() => server.stop());

  const res = await request(server.baseUrl, "DELETE", "/api/templates/absent.pptx");
  const body = JSON.parse(res.text);

  assert.equal(res.status, 404);
  assert.match(body.error, /introuvable/i);
});

test("POST /api/generate (chemin nominal) genere un vrai .pptx telechargeable", { skip: !powershell }, async t => {
  const server = await startServer();
  t.after(() => server.stop());
  seedRealTemplate(server);

  const sample = JSON.parse(fs.readFileSync(path.join(projectRoot, "data", "sample-comop.json"), "utf8"));
  const payload = JSON.stringify({ template: "reel.pptx", fields: sample });
  const res = await request(server.baseUrl, "POST", "/api/generate", {
    headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) },
    body: payload
  });
  const body = JSON.parse(res.text);

  assert.equal(res.status, 200);
  assert.match(body.fileName, /^comop-.*\.pptx$/);
  assert.equal(body.downloadUrl, `/output/${body.fileName}`);

  const telechargement = await request(server.baseUrl, "GET", body.downloadUrl);
  assert.equal(telechargement.status, 200);
  assert.ok(telechargement.raw.length > 0, "le .pptx telecharge ne doit pas etre vide");
  // Signature ZIP locale : un vrai paquet OOXML, pas un fichier vide/place-holder.
  assert.equal(telechargement.raw[0], 0x50);
  assert.equal(telechargement.raw[1], 0x4b);
});

// server.js:195-197 : le timeout PowerShell n'etait exerce par aucun test
// (attendre un vrai timeout de 60s serait disproportionne). Override du
// delai via COMOP_POWERSHELL_TIMEOUT_MS (comportement de prod inchange, non
// defini par defaut) pour le declencher en quelques centaines de ms.
test("un timeout PowerShell renvoie une erreur geree et laisse le serveur UP", { skip: !powershell }, async t => {
  const server = await startServer({ env: { COMOP_POWERSHELL_TIMEOUT_MS: "50" } });
  t.after(() => server.stop());
  seedRealTemplate(server);

  // detect-template-zones.ps1 sur un template sans cache prend plusieurs
  // secondes au demarrage a froid (mesure audit : ~4,6s) -- toujours au-dela
  // de 50ms.
  const res = await request(server.baseUrl, "GET", "/api/templates/reel.pptx/zones");
  const body = JSON.parse(res.text);

  assert.equal(res.status, 500);
  assert.equal(body.error, "Erreur interne du serveur");

  const suivant = await request(server.baseUrl, "GET", "/api/sample");
  assert.equal(suivant.status, 200);
});
