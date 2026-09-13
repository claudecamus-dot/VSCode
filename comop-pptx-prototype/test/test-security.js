"use strict";

// Couvre le garde-fou safeTemplatePath() : c'est le seul point du serveur qui
// construit un chemin disque a partir d'une entree utilisateur (nom de
// template), donc le seul risque de traversee de repertoire (ADR implicite
// du prototype). Verifie via de vraies requetes HTTP sur un serveur reel.
//
// Couvre aussi les findings de l'audit du 2026-09-02 : controle Origin/Host,
// liste blanche d'extension sur /output/, et le cablage de validate-template.ps1
// sur l'upload de template (risque technique : le script existait sans jamais
// etre appele).

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { spawnSync } = require("node:child_process");
const { startServer, request } = require("../test-support/helpers");

const projectRoot = path.join(__dirname, "..");
const realTemplate = path.join(projectRoot, "templates", "comop-template.pptx");
const powershell = process.platform === "win32" ? "powershell.exe" : null;

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

// Audit du 2026-09-13 (securite) : le test ci-dessus passe par la clause
// d'extension, et la branche !startsWith(templatesDir) de safeTemplatePath est
// INATTEIGNABLE puisque path.basename() a deja neutralise le chemin -- la garde
// est saine, mais aucune variante d'evasion propre a Windows n'etait essayee, si
// bien que rien ne le PROUVAIT. On eprouve ici chaque forme qu'un attaquant
// tenterait reellement : separateur antislash, chemin absolu de lecteur, chemin
// UNC, double-encodage. Propriete verifiee : le chemin obtenu reste TOUJOURS
// dans templates/ -- soit rejete en 400, soit rebase sur le dossier des
// templates (la suppression porte alors sur le fichier de templates/, jamais sur
// la cible hors perimetre designee par le nom).
test("aucune variante d'evasion Windows ne fait sortir safeTemplatePath de templates/", async t => {
  const server = await startServer();
  t.after(() => server.stop());

  const templatesDir = path.join(server.dataRoot, "templates");
  const leurre = path.join(templatesDir, "evasion.pptx");

  // Rejetees en 400 : apres basename(), le nom restant n'a pas l'extension .pptx.
  for (const variante of [
    "..%5C..%5Cserver.js",              // separateur Windows (antislash)
    "..%252F..%252Fserver.js",          // double-encodage (%252F -> %2F litteral)
    "C%3A%5CWindows%5Cwin.ini"          // chemin absolu de lecteur
  ]) {
    const res = await request(server.baseUrl, "DELETE", `/api/templates/${variante}`);
    assert.equal(res.status, 400, `la variante ${variante} doit etre rejetee, recu ${res.status}`);
  }

  // Rebasees dans templates/ : le nom se termine bien par .pptx, mais le chemin
  // qui le precede est ignore. La preuve porte sur l'EFFET : c'est le fichier de
  // templates/ qui disparait, donc le chemin hostile n'a jamais ete suivi.
  for (const variante of [
    "C%3A%5CWindows%5CTemp%5Cevasion.pptx",   // chemin absolu de lecteur
    "%5C%5Cserveur%5Cpartage%5Cevasion.pptx", // chemin UNC
    "..%5C..%5Cevasion.pptx"                  // remontee en antislash
  ]) {
    fs.writeFileSync(leurre, "leurre");
    const res = await request(server.baseUrl, "DELETE", `/api/templates/${variante}`);
    assert.equal(res.status, 200, `la variante ${variante} devait etre rebasee dans templates/, recu ${res.text}`);
    assert.equal(fs.existsSync(leurre), false,
      `la variante ${variante} doit agir sur templates/evasion.pptx, pas sur la cible hors perimetre`);
  }
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

// Audit 09-07 (robustesse, MESURE M7) : un fichier qui passe la signature
// "PK" (2 octets) mais n'est pas une archive ZIP valide (central directory
// absent) etait ecrit durablement, liste par GET /api/templates, puis
// faisait 500 en boucle sur GET /zones -- template fantome. Desormais rejete
// avant d'etre inscrit : validate-template.ps1 leve une exception sur cette
// archive, le fichier ecrit est retire, 422 renvoye.
test("route rejette un .pptx a signature PK valide mais dont l'archive est illisible (pas de template fantome)", { skip: !powershell }, async t => {
  const server = await startServer();
  t.after(() => server.stop());

  const buffer = Buffer.concat([
    Buffer.from([0x50, 0x4b, 0x03, 0x04]), // "PK\x03\x04" : signature locale valide
    Buffer.from("mais rien de plus n'est un vrai zip -- pas de central directory")
  ]);
  const res = await request(server.baseUrl, "POST", "/api/templates", {
    headers: { "x-template-name": "signature-seule.pptx" },
    body: buffer
  });

  assert.equal(res.status, 422);
  const body = JSON.parse(res.text);
  assert.match(body.error, /invalide/i);

  const liste = await request(server.baseUrl, "GET", "/api/templates");
  const templates = JSON.parse(liste.text).templates;
  assert.ok(!templates.some(t => t.file === "signature-seule.pptx"),
    "le template rejete ne doit pas rester ecrit ni liste");
});

// Audit du 2026-09-13 (securite, finding GRAVE) : la garde anti-zip-bomb
// (Assert-ZipDecompressedSizeWithinLimit) cablee le 2026-09-07 dans 6 scripts
// n'avait jamais ete branchee dans validate-template.ps1 -- qui est pourtant le
// PREMIER script lance sur un upload (POST /api/templates) : l'archive etait
// ouverte et ses slides concatenees dans un StringBuilder non borne avant tout
// controle de volume, la garde des scripts suivants n'entrant en jeu qu'apres.
// Preuve qu'AVANT le correctif ce test echouait : sur cette archive (320 Mo
// annonces decompresses pour 1,4 Mo sur disque, donc sous le plafond d'upload de
// 25 Mo), validate-template.ps1 sortait en 0 avec status "incomplet" et le
// serveur repondait 200 en inscrivant le template dans la bibliotheque.
test("route rejette un template dont le volume decompresse annonce depasse la limite (zip bomb)", { skip: !powershell }, async t => {
  const server = await startServer();
  t.after(() => server.stop());

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "comop-zip-bomb-"));
  const bombe = path.join(dir, "bombe.pptx");
  try {
    const prep = spawnSync(
      powershell,
      [
        "-NoProfile", "-ExecutionPolicy", "Bypass",
        "-File", path.join(projectRoot, "test-support", "fabrique-zip-bomb.ps1"),
        "-Destination", bombe
      ],
      { encoding: "utf8", windowsHide: true }
    );
    assert.equal(prep.status, 0, `fabrication de l'archive piegee en echec :\n${prep.stderr}`);

    const res = await request(server.baseUrl, "POST", "/api/templates", {
      headers: { "x-template-name": "bombe.pptx" },
      body: fs.readFileSync(bombe)
    });

    assert.equal(res.status, 422,
      "une archive au volume decompresse hors limite doit etre rejetee, pas inscrite");

    const liste = await request(server.baseUrl, "GET", "/api/templates");
    const templates = JSON.parse(liste.text).templates;
    assert.ok(!templates.some(t => t.file === "bombe.pptx"),
      "l'archive piegee ne doit pas rester ecrite ni listee");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// Audit 09-07 (robustesse, MESURE M11) : x-template-name: NUL.pptx passait
// safeTemplatePath tel quel -- Node ecrivait un vrai fichier NUL.pptx que
// PowerShell (qui resout NUL comme le peripherique nul du systeme) ne
// voyait jamais : template fantome liste, inutilisable.
test("route rejette un nom de template reserve Windows (NUL.pptx)", async t => {
  const server = await startServer();
  t.after(() => server.stop());

  const buffer = fs.readFileSync(realTemplate);
  const res = await request(server.baseUrl, "POST", "/api/templates", {
    headers: { "x-template-name": "NUL.pptx" },
    body: buffer
  });
  const body = JSON.parse(res.text);

  assert.equal(res.status, 400);
  assert.match(body.error, /invalide/i);

  const liste = await request(server.baseUrl, "GET", "/api/templates");
  const templates = JSON.parse(liste.text).templates;
  assert.ok(!templates.some(t => t.file.toUpperCase().startsWith("NUL")),
    "un nom de peripherique reserve ne doit jamais etre ecrit ni liste");
});

test("route accepte un nom de template valide (zones) meme si le fichier n'existe pas encore -> 404, pas 500", async t => {
  const server = await startServer();
  t.after(() => server.stop());

  const res = await request(server.baseUrl, "GET", "/api/templates/inconnu.pptx/zones");
  const body = JSON.parse(res.text);

  assert.equal(res.status, 404);
  assert.match(body.error, /introuvable/i);
});

// Risque technique (audit) : validate-template.ps1 existait dans src/ sans
// jamais etre appele par le serveur -- code mort. Point d'appel logique
// cable : l'upload de template (POST /api/templates) lance maintenant aussi
// la validation des placeholders et remonte le resultat au client.
test("POST /api/templates cable validate-template.ps1 : un template complet remonte validation.status = valide", { skip: !powershell }, async t => {
  const server = await startServer();
  t.after(() => server.stop());

  const buffer = fs.readFileSync(realTemplate);
  const res = await request(server.baseUrl, "POST", "/api/templates", {
    headers: { "x-template-name": "complet.pptx" },
    body: buffer
  });
  const body = JSON.parse(res.text);

  assert.equal(res.status, 200);
  assert.ok(body.validation, "la reponse d'upload doit porter un champ validation");
  assert.equal(body.validation.status, "valide");
  assert.deepEqual(body.validation.missing, []);
});

test("POST /api/templates cable validate-template.ps1 : un template incomplet remonte validation.status = incomplet avec le placeholder manquant", { skip: !powershell }, async t => {
  const server = await startServer();
  t.after(() => server.stop());

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "comop-validate-incomplet-"));
  const incomplet = path.join(dir, "incomplet.pptx");
  try {
    const prep = spawnSync(
      powershell,
      [
        "-NoProfile", "-ExecutionPolicy", "Bypass",
        "-File", path.join(projectRoot, "test-support", "retire-placeholder.ps1"),
        "-Source", realTemplate,
        "-Destination", incomplet,
        "-Placeholder", "equipe"
      ],
      { encoding: "utf8", windowsHide: true }
    );
    assert.equal(prep.status, 0, `preparation du template incomplet en echec :\n${prep.stderr}`);

    const buffer = fs.readFileSync(incomplet);
    const res = await request(server.baseUrl, "POST", "/api/templates", {
      headers: { "x-template-name": "incomplet.pptx" },
      body: buffer
    });
    const body = JSON.parse(res.text);

    assert.equal(res.status, 200);
    assert.ok(body.validation, "la reponse d'upload doit porter un champ validation");
    assert.equal(body.validation.status, "incomplet");
    assert.ok(body.validation.missing.includes("equipe"),
      `"equipe" devrait etre signale manquant, recu : ${JSON.stringify(body.validation.missing)}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// Audit du 2026-09-02 (securite) : /output/ servait n'importe quel fichier
// depose dans outputDir, sans liste blanche d'extension -- server-runtime.log
// (traces d'erreur completes, chemins internes) etait telechargeable tel quel.
test("GET /output/<fichier non-.pptx> renvoie 404 (liste blanche d'extension)", async t => {
  const server = await startServer();
  t.after(() => server.stop());

  fs.writeFileSync(path.join(server.dataRoot, "output", "server-runtime.log"), "[secret interne] stack trace...");

  const res = await request(server.baseUrl, "GET", "/output/server-runtime.log");
  assert.equal(res.status, 404);
  assert.doesNotMatch(res.text, /secret interne/, "le contenu du fichier non-pptx ne doit jamais etre renvoye");
});

// Audit du 2026-09-02 (securite) : le serveur n'ecoute que sur 127.0.0.1 mais
// ne verifiait ni Host ni Origin -- une page web ouverte ailleurs dans le
// navigateur peut appeler fetch() vers un serveur local (DNS rebinding /
// pilotage cross-origin de l'API locale).
test("une requete avec un Origin etranger est rejetee (403)", async t => {
  const server = await startServer();
  t.after(() => server.stop());

  const res = await request(server.baseUrl, "GET", "/api/sample", {
    headers: { Origin: "https://attaquant.example" }
  });

  assert.equal(res.status, 403);
});

test("une requete avec un Host etranger est rejetee (403)", async t => {
  const server = await startServer();
  t.after(() => server.stop());

  const res = await request(server.baseUrl, "GET", "/api/sample", {
    headers: { Host: "attaquant.example" }
  });

  assert.equal(res.status, 403);
});

test("une requete sans Origin (outil, pas navigateur) sur le meme Host reste acceptee", async t => {
  const server = await startServer();
  t.after(() => server.stop());

  const res = await request(server.baseUrl, "GET", "/api/sample");
  assert.equal(res.status, 200);
});

// Audit du 2026-09-07 (securite) : residu du controle ci-dessus -- un navigateur
// n'envoie PAS d'Origin sur un GET no-cors (<img src>, <iframe>, navigation) et
// le Host vise reste 127.0.0.1:<port>, donc le controle passait. MESURE M8 de
// l'audit : GET /api/templates/<n>/zones en cross-site sans Origin -> 200,
// detect-template-zones.ps1 reellement execute (4 626 ms de CPU par appel).
// Le garde doit refuser AVANT d'atteindre la route (ici : 403, pas le 404 que
// renverrait la route sur un template absent).
// Audit du 2026-09-13 (securite) : ce test prouvait bien le 403 (rouge sans la
// garde) mais PAS la propriete qu'il annonce dans son nom -- templates/ etant
// vide dans le harnais, detect-template-zones.ps1 n'aurait de toute facon pas
// tourne, quel que soit le sort de la garde. La non-execution est desormais
// mesuree : on seme le vrai template, la route visee devient reellement
// servable, et son execution laisse une trace observable (le sidecar de cache
// .zones.json, ecrit par la route apres detection).
test("un GET cross-site sans Origin (img/iframe) est rejete sur /api/ (403), sans atteindre la route", { skip: !powershell }, async t => {
  const server = await startServer();
  t.after(() => server.stop());

  const templatePath = path.join(server.dataRoot, "templates", "comop-template.pptx");
  fs.copyFileSync(realTemplate, templatePath);
  const zonesCache = templatePath.replace(/\.pptx$/, ".zones.json");

  const res = await request(server.baseUrl, "GET", "/api/templates/comop-template.pptx/zones", {
    headers: { "Sec-Fetch-Site": "cross-site", "Sec-Fetch-Mode": "no-cors" }
  });

  assert.equal(res.status, 403);
  assert.equal(fs.existsSync(zonesCache), false,
    "la route ne doit pas avoir ete atteinte : aucune detection de zones ne doit avoir tourne");

  // Contre-epreuve, sans laquelle l'assertion ci-dessus resterait vraie par
  // construction : la MEME requete en same-origin atteint bien la route et
  // declenche reellement la detection (4 626 ms de CPU par appel, MESURE M8 de
  // l'audit du 09-07). Le 403 vient donc de la garde, pas d'une route inerte.
  const meme = await request(server.baseUrl, "GET", "/api/templates/comop-template.pptx/zones", {
    headers: { "Sec-Fetch-Site": "same-origin" }
  });

  assert.equal(meme.status, 200, `la route doit etre servable en same-origin, recu : ${meme.text}`);
  assert.equal(fs.existsSync(zonesCache), true,
    "la detection de zones doit avoir reellement tourne sur le chemin autorise");
});

test("un GET same-origin (page de l'outil) reste accepte", async t => {
  const server = await startServer();
  t.after(() => server.stop());

  const res = await request(server.baseUrl, "GET", "/api/sample", {
    headers: { "Sec-Fetch-Site": "same-origin" }
  });

  assert.equal(res.status, 200);
});

// Meme correctif que le plafond JSON (test-routes.js) : readBinaryBody()
// detruisait la requete des le depassement, avant que le 413 ne parte --
// ECONNRESET cote client au lieu d'une reponse propre. Verifie sur le chemin
// binaire (upload de template, 25 Mo) que la reponse est bien livree.
test("POST /api/templates renvoie 413 (pas un ECONNRESET) sur un upload de plus de 25 Mo", async t => {
  const server = await startServer();
  t.after(() => server.stop());

  const buffer = Buffer.alloc(25 * 1024 * 1024 + 1024, 0x41);
  const res = await request(server.baseUrl, "POST", "/api/templates", {
    headers: { "x-template-name": "trop-gros.pptx" },
    body: buffer
  });
  const body = JSON.parse(res.text);

  assert.equal(res.status, 413);
  assert.match(body.error, /volumineux/i);

  const suivant = await request(server.baseUrl, "GET", "/api/sample");
  assert.equal(suivant.status, 200);
});
