"use strict";

// Couvre serveStatic() : sert web/index.html par defaut, le telechargement
// d'un export sous /output/, et les 404 pour ce qui n'existe pas.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
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

// Audit du 2026-09-13 (securite) : le confinement des fichiers statiques sous
// web/ (server.js, garde filePath !== webDir && startsWith(webDir + path.sep))
// n'etait couvert par AUCUN test -- le seul test de liste blanche vise /output/,
// jamais la branche webDir. La garde n'etait donc pas eprouvee. Ce test la met
// face a l'attaque qu'elle existe pour arreter : remonter hors de web/ pour se
// faire servir un fichier du depot. Il est discriminant : sans la garde,
// path.normalize() resout bien vers <racine>/server.js, qui existe, et le code
// source du serveur serait renvoye en 200.
test("GET d'un chemin qui remonte hors de web/ renvoie 404 et ne sert pas le fichier vise", async t => {
  const server = await startServer();
  t.after(() => server.stop());

  const res = await request(server.baseUrl, "GET", "/..%2Fserver.js");

  assert.equal(res.status, 404);
  assert.doesNotMatch(res.text, /safeTemplatePath|createServer/,
    "le code source du serveur ne doit jamais etre servi par la route statique");
});

test("GET /output/<repertoire>.pptx renvoie une erreur geree, sans faire tomber le serveur", async t => {
  const server = await startServer();
  t.after(() => server.stop());

  // fs.existsSync() est vrai pour un repertoire : createReadStream() echoue
  // seulement une fois le stream demarre (EISDIR), apres res.writeHead(200).
  // Avant le correctif, l'erreur du stream n'etait pas geree et faisait
  // planter tout le process node (DoS : une seule requete coupe le serveur
  // pour tout le monde).
  fs.mkdirSync(path.join(server.dataRoot, "output", "piege.pptx"));

  // Le stream echoue APRES l'envoi des entetes (200, ecrits avant le pipe) :
  // le statut ne peut plus changer, la connexion est coupee proprement cote
  // serveur -- le client voit une erreur reseau, pas un code HTTP.
  await assert.rejects(() => request(server.baseUrl, "GET", "/output/piege.pptx"));

  // Ce qui compte reellement : le serveur repond encore a la requete
  // suivante. Avant le correctif, l'erreur de stream non geree faisait
  // planter tout le process node (DoS).
  const suivante = await request(server.baseUrl, "GET", "/output/inexistant.pptx");
  assert.equal(suivante.status, 404);
});
