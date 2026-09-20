"use strict";

// Filet de caracterisation de src/detect-template-zones.ps1.
//
// Pose avant le correctif de performance du finding "accumulation par +=" :
// la refonte des quatre accumulations de tableau en List<object> ne doit rien
// changer au document produit. Ce test verrouille la STRUCTURE detectee sur le
// gabarit reellement versionne (nombre de slides, dimensions du support, nombre
// et ORDRE des zones par slide, presence d'un nom et d'une position sur chaque
// zone). Aucun texte du template n'est recopie ici : le champ `apercu` porte du
// contenu client, on n'en verifie que la presence/absence.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const projectRoot = path.join(__dirname, "..");
const script = path.join(projectRoot, "src", "detect-template-zones.ps1");
const template = path.join(projectRoot, "templates", "comop-template.pptx");

// Scripts PowerShell : rien a executer hors Windows, meme convention que
// test-prepare-ag2r-template.js / test-pptx-integrity.js.
const powershell = process.platform === "win32" ? "powershell.exe" : null;
const disponible = Boolean(powershell) && fs.existsSync(template);

// Ordre attendu des zones, par slide. Il n'est pas arbitraire : le script
// parcourt les p:sp (texte), PUIS les p:graphicFrame (tableau/graphique/
// diagramme), PUIS les p:pic (image) -- toute inversion de ces passes, ou toute
// zone perdue par une accumulation cassee, se voit ici.
const ATTENDU = [
  { index: 1, types: ["texte"] },
  { index: 2, types: [...Array(14).fill("texte"), "image"] },
  { index: 3, types: [...Array(8).fill("texte"), "tableau", "image"] },
  { index: 4, types: Array(10).fill("texte") }
];

function detecter() {
  const sortie = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "zones-test-")), "zones.json");
  const res = spawnSync(
    powershell,
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script,
      "-TemplatePath", template, "-OutputPath", sortie],
    { encoding: "utf8", windowsHide: true }
  );
  return { res, sortie };
}

test("detect-template-zones rend la meme arborescence de zones que le gabarit versionne",
  { skip: !disponible }, () => {
    const { res, sortie } = detecter();
    assert.equal(res.status, 0, `echec du script :\n${res.stdout}\n${res.stderr}`);
    assert.ok(fs.existsSync(sortie), "aucun fichier de zones ecrit");

    let brut = fs.readFileSync(sortie, "utf8");
    if (brut.charCodeAt(0) === 0xFEFF) brut = brut.slice(1);
    const zones = JSON.parse(brut);

    assert.equal(zones.schema_version, 1);
    assert.deepEqual(zones.dimensions, { largeur: 9144000, hauteur: 5143500 });
    assert.equal(zones.slides.length, ATTENDU.length, "nombre de slides detectees");

    const total = zones.slides.reduce((n, s) => n + s.zones.length, 0);
    assert.equal(total, 36, "nombre total de zones detectees");

    zones.slides.forEach((slide, i) => {
      assert.equal(slide.index, ATTENDU[i].index, `index de la slide en position ${i}`);
      assert.deepEqual(slide.zones.map(z => z.type), ATTENDU[i].types,
        `types et ordre des zones de la slide ${ATTENDU[i].index}`);
      for (const zone of slide.zones) {
        assert.ok(typeof zone.nom === "string" && zone.nom.length > 0,
          `zone sans nom sur la slide ${slide.index}`);
        assert.ok(zone.position && Number.isInteger(zone.position.largeur) && Number.isInteger(zone.position.hauteur),
          `zone sans position exploitable sur la slide ${slide.index}`);
      }
    });

    // Le resume rendu sur stdout doit concorder avec le fichier ecrit : c'est
    // lui que server.js remonte au client.
    const resume = JSON.parse(res.stdout);
    assert.equal(resume.status, "zones_detectees");
    assert.equal(resume.slides, ATTENDU.length);
    assert.equal(resume.zones_total, total);
  });
