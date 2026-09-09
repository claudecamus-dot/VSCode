const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

const root = __dirname;
// COMOP_DATA_ROOT permet aux tests de rediriger templates/output/data vers un
// dossier temporaire isole, sans jamais toucher aux vrais templates/exports
// du prototype ; non defini en usage normal, le comportement est inchange.
const dataRoot = process.env.COMOP_DATA_ROOT ? path.resolve(process.env.COMOP_DATA_ROOT) : root;
const webDir = path.join(root, "web");
const templatesDir = path.join(dataRoot, "templates");
const outputDir = path.join(dataRoot, "output");
const requestDataDir = path.join(outputDir, "_data");
const dataDir = path.join(dataRoot, "data");
const port = Number(process.env.PORT || 5177);
const serverLog = path.join(outputDir, "server-runtime.log");
const OUTPUT_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const TEMPLATE_UPLOAD_MAX_BYTES = 25 * 1024 * 1024; // 25 Mo (gabarit connu : 1.4 Mo)
// Audit du 2026-09-02 (robustesse) : ce plafond vivait comme un nombre magique
// (1_000_000) a l'interieur de readRequestBody, mesure en LONGUEUR DE STRING
// (donc en caracteres, pas en octets -- imprecis des qu'un corps contient du
// multi-octet UTF-8) alors que TEMPLATE_UPLOAD_MAX_BYTES est nomme et mesure en
// octets exacts sur les Buffer recus. Nomme et aligne sur la meme precision.
const MAX_JSON_BODY_BYTES = 1 * 1024 * 1024; // 1 Mo (formulaire COMOP : quelques Ko en usage normal)
// Audit 09-07 (risque technique) : le chemin de timeout (server.js:195-207)
// n'etait exerce par aucun test HTTP -- attendre un vrai timeout de 60s dans
// la suite serait disproportionne. Meme pattern que COMOP_DATA_ROOT :
// override non defini en usage normal (comportement inchange), les tests le
// reduisent pour declencher le timeout en quelques centaines de ms.
const POWERSHELL_TIMEOUT_MS = Number(process.env.COMOP_POWERSHELL_TIMEOUT_MS) || 60 * 1000; // un script bloque (zip pathologique...) ne doit pas pendre indefiniment
// Audit du 2026-09-02 (securite) : seule extension jamais servie par /output/ --
// avant ce garde, n'importe quel fichier depose dans outputDir (server-runtime.log,
// qui contient des traces d'erreur completes avec chemins internes) etait
// telecharge tel quel des que son nom passait path.basename().
const ALLOWED_OUTPUT_EXTENSIONS = new Set([".pptx"]);

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation"
};

function send(res, status, body, type = "application/json; charset=utf-8") {
  res.writeHead(status, { "Content-Type": type });
  res.end(body);
}

function sendJson(res, status, body) {
  send(res, status, JSON.stringify(body), "application/json; charset=utf-8");
}

// Audit du 2026-09-02 (securite) : plusieurs routes renvoyaient
// `{ error: error.message }` en 500 -- le message brut d'une exception (stack
// PowerShell, chemin disque, detail de parseur) part alors au client. Le detail
// va au log serveur (deja consulte via server-runtime.log), le client ne voit
// qu'un message generique qui ne fuite rien d'exploitable.
function sendInternalError(res, error) {
  log(`ERROR ${error && error.stack ? error.stack : (error && error.message) || error}`);
  sendJson(res, 500, { error: "Erreur interne du serveur" });
}

// Audit du 2026-09-02 (robustesse) : decodeURIComponent() leve une URIError sur
// une sequence % malformee ; aucun appelant ne l'attrapait, l'exception non geree
// remontait au try global du createServer -> 500 avec le message brut du
// decodeur. Une URI malformee est une faute d'appelant (400), pas une panne serveur.
function safeDecodeURIComponent(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

// Audit 09-07 (performance) : mkdirSync + appendFileSync bloquaient la
// boucle d'evenements sur CHAQUE requete /api/ (log() est le premier appel
// de handleApi). fs.appendFile est asynchrone -- le dossier est cree une
// seule fois au demarrage (cf. plus bas), avec un repli defensif (ENOENT) au
// cas ou il aurait disparu en cours de route. Une erreur de log ne doit
// jamais faire echouer la requete qui l'a declenchee : purement best-effort.
const LOG_MAX_BYTES = 5 * 1024 * 1024; // 5 Mo
const LOG_ROTATE_CHECK_EVERY = 200; // eviter un fs.stat() a chaque requete
let logCallsSinceRotationCheck = 0;

function rotateLogIfTooLarge() {
  fs.stat(serverLog, (error, stats) => {
    if (error || stats.size <= LOG_MAX_BYTES) return;
    fs.rename(serverLog, `${serverLog}.1`, () => {});
  });
}

function log(message) {
  const line = `[${new Date().toISOString()}] ${message}\n`;
  fs.appendFile(serverLog, line, "utf8", error => {
    if (!error || error.code !== "ENOENT") return;
    fs.mkdir(outputDir, { recursive: true }, mkdirError => {
      if (mkdirError) return;
      fs.appendFile(serverLog, line, "utf8", () => {});
    });
  });
  logCallsSinceRotationCheck += 1;
  if (logCallsSinceRotationCheck >= LOG_ROTATE_CHECK_EVERY) {
    logCallsSinceRotationCheck = 0;
    rotateLogIfTooLarge();
  }
}

function purgeOldOutputs() {
  const cutoff = Date.now() - OUTPUT_TTL_MS;
  const purgeDir = (dir, ext) => {
    if (!fs.existsSync(dir)) return;
    fs.readdirSync(dir).filter(f => f.endsWith(ext)).forEach(f => {
      try {
        const full = path.join(dir, f);
        if (fs.statSync(full).mtimeMs < cutoff) fs.unlinkSync(full);
      } catch (_) {}
    });
  };
  purgeDir(outputDir, ".pptx");
  purgeDir(requestDataDir, ".json");
  // Audit 09-07 (performance) : server-runtime.log n'etait jamais tourne ni
  // purge par ce mecanisme (qui ne traitait que .pptx/.json) -- verifie ici
  // aussi, en plus du controle periodique de rotateLogIfTooLarge() (§ log).
  rotateLogIfTooLarge();
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let length = 0;
    let rejected = false;
    req.on("data", chunk => {
      // Trouve en ecrivant le test du plafond harmonise (2026-09-02) : un
      // req.destroy() immediat ici coupe la connexion AVANT que le 413 ne
      // parte -- le client voit un ECONNRESET au lieu d'une reponse propre.
      // On arrete d'accumuler (mémoire bornee) mais on laisse le flux se
      // vider normalement jusqu'a 'end', pour que la reponse d'erreur soit
      // reellement livree.
      if (rejected) return;
      length += chunk.length;
      if (length > MAX_JSON_BODY_BYTES) {
        rejected = true;
        reject(new Error("Payload trop volumineux"));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (!rejected) resolve(Buffer.concat(chunks).toString("utf8"));
    });
    req.on("error", reject);
  });
}

// Un corps JSON malforme est une faute d'appelant (400), pas une panne serveur.
// Sans ce garde, le JSON.parse des routes remontait au try global du
// createServer, qui repondait 500 en recopiant le message brut du parseur
// (« Expected property name or '}' in JSON at position 1 ») : mauvais code de
// statut ET fuite d'un detail d'implementation. Rend INVALID_BODY apres avoir
// deja repondu — l'appelant doit sortir immediatement. Le sentinelle evite de
// confondre l'echec avec un corps valant litteralement `null`.
const INVALID_BODY = Symbol("corps JSON invalide");

async function readJsonBody(req, res) {
  let raw;
  try {
    raw = await readRequestBody(req);
  } catch (error) {
    // Avant ce correctif : le rejet de readRequestBody (payload trop
    // volumineux) n'etait rattrape nulle part ici, remontait au try global du
    // createServer -> 500 avec le message brut, alors que le meme depassement
    // sur un upload binaire (readBinaryBody) renvoie 413 depuis longtemps.
    // Plafond asymetrique en TRAITEMENT de l'erreur, pas seulement en valeur.
    sendJson(res, 413, { error: error.message });
    return INVALID_BODY;
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    sendJson(res, 400, { error: "Corps JSON invalide" });
    return INVALID_BODY;
  }
  // Audit du 2026-09-02 (robustesse) : un corps JSON valant litteralement
  // `null` (ou un tableau/nombre/chaine) passe JSON.parse sans erreur ; les
  // routes qui lisent ensuite `body.xxx` plantaient avec un TypeError non
  // rattrape -> 500 avec le message brut de Node au lieu d'un 400 propre.
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    sendJson(res, 400, { error: "Corps JSON invalide (objet attendu)" });
    return INVALID_BODY;
  }
  return parsed;
}

function readBinaryBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let length = 0;
    let rejected = false;
    req.on("data", chunk => {
      // Meme correctif que readRequestBody : ne pas detruire la requete tout
      // de suite, pour laisser le 413 partir au lieu d'un ECONNRESET.
      if (rejected) return;
      length += chunk.length;
      if (length > maxBytes) {
        rejected = true;
        reject(new Error("Fichier trop volumineux"));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (!rejected) resolve(Buffer.concat(chunks));
    });
    req.on("error", reject);
  });
}

// Audit 09-07 (securite) : au timeout, child.kill() est une terminaison
// abrupte (TerminateProcess sous Windows) -- le bloc `finally` du script
// PowerShell, qui nettoie normalement son repertoire de travail temporaire,
// n'est jamais execute : le dossier extrait (potentiellement volumineux)
// reste dans %TEMP%. Quand l'appelant fournit `workDir` (repertoire cree par
// Node AVANT le lancement du script, cf. les 4 sites d'appel ci-dessous),
// c'est Node qui le supprime lui-meme sur ce chemin -- il en connait le
// chemin exact, contrairement a un balayage global de %TEMP% qui risquerait
// de supprimer le repertoire d'un autre processus en cours.
function runPowerShell(args, { workDir } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", ...args], {
      cwd: root,
      windowsHide: true
    });
    let stdout = "";
    let stderr = "";
    let regle = false;
    const horsDelai = setTimeout(() => {
      regle = true;
      child.kill();
      if (workDir) {
        try {
          fs.rmSync(workDir, { recursive: true, force: true });
        } catch (error) {
          log(`CLEANUP ${error.message}`);
        }
      }
      reject(new Error(`PowerShell script timed out after ${POWERSHELL_TIMEOUT_MS}ms`));
    }, POWERSHELL_TIMEOUT_MS);
    // Audit 09-07 (robustesse) : sans ce handler, un echec de spawn
    // (powershell.exe absent du PATH, EACCES...) emet un evenement 'error'
    // non ecoute -> exception non rattrapee -> process.on('uncaughtException')
    // -> process.exit(1), soit tout le serveur arrete par une seule requete.
    child.on("error", error => {
      if (regle) return;
      regle = true;
      clearTimeout(horsDelai);
      reject(error);
    });
    child.stdout.on("data", data => { stdout += data.toString(); });
    child.stderr.on("data", data => { stderr += data.toString(); });
    child.on("close", code => {
      if (regle) return; // deja rejete par le timeout ou 'error', la requete HTTP a deja recu sa reponse
      clearTimeout(horsDelai);
      if (code !== 0) {
        reject(new Error(stderr || stdout || `PowerShell exit ${code}`));
        return;
      }
      resolve(stdout.trim());
    });
  });
}

// Audit 09-07 (robustesse, MESURE M11) : un nom de fichier reserve Windows
// (x-template-name: NUL.pptx) passait ce garde tel quel -- Node ecrivait un
// vrai fichier sur disque (fs.existsSync vrai) mais PowerShell, qui resout
// NUL comme le peripherique nul du systeme et non un fichier, ne le voyait
// jamais (Test-Path false) : template fantome liste, inutilisable.
const RESERVED_WINDOWS_DEVICE_NAMES = new Set([
  "CON", "PRN", "AUX", "NUL",
  "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
  "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9"
]);

function safeTemplatePath(name) {
  const fileName = path.basename(name || "");
  const templatePath = path.join(templatesDir, fileName);
  const baseNameUpper = fileName.replace(/\.pptx$/i, "").toUpperCase();
  if (!fileName.endsWith(".pptx") || !templatePath.startsWith(templatesDir) || RESERVED_WINDOWS_DEVICE_NAMES.has(baseNameUpper)) {
    throw new Error("Template invalide");
  }
  return templatePath;
}

function readTemplateMeta(file) {
  const metaPath = path.join(templatesDir, file.replace(/\.pptx$/, ".meta.json"));
  if (!fs.existsSync(metaPath)) return { file, name: file };
  try {
    const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
    return { file, name: meta.name || file };
  } catch (_) {
    return { file, name: file };
  }
}

async function handleApi(req, res) {
  log(`${req.method} ${req.url}`);

  if (req.method === "GET" && req.url === "/api/templates") {
    const files = fs.existsSync(templatesDir)
      ? fs.readdirSync(templatesDir).filter(f => f.endsWith(".pptx"))
      : [];
    sendJson(res, 200, { templates: files.map(readTemplateMeta) });
    return;
  }

  if (req.method === "POST" && req.url === "/api/templates") {
    const rawName = safeDecodeURIComponent(req.headers["x-template-name"] || "");
    if (rawName === null) {
      sendJson(res, 400, { error: "En-tete x-template-name : URI invalide" });
      return;
    }
    let templatePath;
    try {
      templatePath = safeTemplatePath(rawName);
    } catch (error) {
      sendJson(res, 400, { error: error.message });
      return;
    }
    if (fs.existsSync(templatePath)) {
      sendJson(res, 409, { error: "Un template du meme nom existe deja" });
      return;
    }

    let buffer;
    try {
      buffer = await readBinaryBody(req, TEMPLATE_UPLOAD_MAX_BYTES);
    } catch (error) {
      sendJson(res, 413, { error: error.message });
      return;
    }

    // Audit du 2026-09-02 (securite) : rien ne validait que le contenu est une
    // archive ZIP/OOXML avant ecriture durable et inscription dans la
    // bibliotheque des templates -- un fichier arbitraire renomme en .pptx
    // etait accepte tel quel, et n'echouait que plus tard, au moment d'une
    // extraction ZIP dans une autre route. Signature ZIP locale ("PK\x03\x04"
    // ou "PK\x05\x06" pour une archive vide) : verification en memoire, avant
    // toute ecriture, qui ne depend d'aucun sous-processus PowerShell.
    const SIGNATURE_ZIP = Buffer.from([0x50, 0x4b]); // "PK"
    if (buffer.length < 4 || !buffer.subarray(0, 2).equals(SIGNATURE_ZIP)) {
      sendJson(res, 400, { error: "Fichier invalide : ce n'est pas une archive ZIP/OOXML" });
      return;
    }

    fs.mkdirSync(templatesDir, { recursive: true });
    fs.writeFileSync(templatePath, buffer);

    // Audit 09-07 (robustesse, MESURE M7) : auparavant, l'echec de
    // validate-template.ps1 etait seulement LOGGE -- le fichier restait
    // ecrit, liste par GET /api/templates, et chaque GET /zones ulterieur
    // relancait PowerShell pour echouer a nouveau (pas de cache pour un
    // template qui n'a jamais reussi une seule extraction) : template
    // fantome, 500 en boucle. validate-template.ps1 ouvre l'archive
    // (ZipFile.OpenRead, qui exige un central directory valide) : s'il LEVE
    // une exception plutot que de rendre un statut valide/incomplet,
    // l'archive elle-meme n'est pas exploitable -- c'est le signal retenu
    // pour rejeter, avant d'essayer l'extraction de charte (best-effort,
    // cosmetique, testee separement plus bas).
    let validation;
    try {
      const validationRaw = await runPowerShell([
        "-File",
        path.join(root, "src", "validate-template.ps1"),
        "-TemplatePath",
        templatePath
      ]);
      validation = JSON.parse(validationRaw);
    } catch (error) {
      log(`VALIDATION ${error.message}`);
      try { fs.unlinkSync(templatePath); } catch (_) { /* deja absent */ }
      sendJson(res, 422, { error: "Fichier invalide : impossible de lire l'archive comme un template OOXML" });
      return;
    }

    let branding = null;
    try {
      const brandingWorkDir = fs.mkdtempSync(path.join(os.tmpdir(), "comop-branding-"));
      await runPowerShell([
        "-File",
        path.join(root, "src", "extract-template-branding.ps1"),
        "-TemplatePath",
        templatePath,
        "-WorkDir",
        brandingWorkDir
      ], { workDir: brandingWorkDir });
      const brandingPath = templatePath.replace(/\.pptx$/, ".branding.json");
      if (fs.existsSync(brandingPath)) {
        let brandingRaw = fs.readFileSync(brandingPath, "utf8");
        if (brandingRaw.charCodeAt(0) === 0xFEFF) brandingRaw = brandingRaw.slice(1);
        branding = JSON.parse(brandingRaw);
      }
    } catch (error) {
      log(`EXTRACTION ${error.message}`);
    }

    const fileName = path.basename(templatePath);
    sendJson(res, 200, { ...readTemplateMeta(fileName), branding, validation });
    return;
  }

  if (req.method === "DELETE" && req.url.startsWith("/api/templates/")) {
    const rawName = safeDecodeURIComponent(req.url.slice("/api/templates/".length));
    if (rawName === null) {
      sendJson(res, 400, { error: "URI invalide" });
      return;
    }
    let templatePath;
    try {
      templatePath = safeTemplatePath(rawName);
    } catch (error) {
      sendJson(res, 400, { error: error.message });
      return;
    }
    if (!fs.existsSync(templatePath)) {
      sendJson(res, 404, { error: "Template introuvable" });
      return;
    }

    const base = templatePath.replace(/\.pptx$/, "");
    for (const ext of [".pptx", ".branding.json", ".meta.json", ".zones.json"]) {
      const sidecar = base + ext;
      if (fs.existsSync(sidecar)) fs.unlinkSync(sidecar);
    }

    sendJson(res, 200, { file: path.basename(templatePath) });
    return;
  }

  if (req.method === "GET" && req.url.startsWith("/api/templates/") && req.url.endsWith("/zones")) {
    const rawName = safeDecodeURIComponent(req.url.slice("/api/templates/".length, -"/zones".length));
    if (rawName === null) {
      sendJson(res, 400, { error: "URI invalide" });
      return;
    }
    let templatePath;
    try {
      templatePath = safeTemplatePath(rawName);
    } catch (error) {
      sendJson(res, 400, { error: error.message });
      return;
    }
    if (!fs.existsSync(templatePath)) {
      sendJson(res, 404, { error: "Template introuvable" });
      return;
    }

    const zonesPath = templatePath.replace(/\.pptx$/, ".zones.json");
    if (!fs.existsSync(zonesPath)) {
      try {
        const zonesWorkDir = fs.mkdtempSync(path.join(os.tmpdir(), "comop-zones-"));
        await runPowerShell([
          "-File",
          path.join(root, "src", "detect-template-zones.ps1"),
          "-TemplatePath",
          templatePath,
          "-WorkDir",
          zonesWorkDir
        ], { workDir: zonesWorkDir });
      } catch (error) {
        sendInternalError(res, error);
        return;
      }
    }

    if (!fs.existsSync(zonesPath)) {
      sendJson(res, 500, { error: "Detection des zones impossible" });
      return;
    }

    let zonesRaw = fs.readFileSync(zonesPath, "utf8");
    if (zonesRaw.charCodeAt(0) === 0xFEFF) zonesRaw = zonesRaw.slice(1);
    send(res, 200, zonesRaw, "application/json; charset=utf-8");
    return;
  }

  if (req.method === "POST" && req.url.startsWith("/api/templates/") && req.url.endsWith("/remove-shape")) {
    const rawName = safeDecodeURIComponent(req.url.slice("/api/templates/".length, -"/remove-shape".length));
    if (rawName === null) {
      sendJson(res, 400, { error: "URI invalide" });
      return;
    }
    let templatePath;
    try {
      templatePath = safeTemplatePath(rawName);
    } catch (error) {
      sendJson(res, 400, { error: error.message });
      return;
    }
    if (!fs.existsSync(templatePath)) {
      sendJson(res, 404, { error: "Template introuvable" });
      return;
    }

    const body = await readJsonBody(req, res);
    if (body === INVALID_BODY) return;
    const slideIndex = Number(body.slideIndex);
    const shapeName = String(body.shapeName || "");
    if (!Number.isInteger(slideIndex) || slideIndex < 1 || !shapeName) {
      sendJson(res, 400, { error: "Parametres invalides (slideIndex, shapeName)" });
      return;
    }

    try {
      const removeShapeWorkDir = fs.mkdtempSync(path.join(os.tmpdir(), "comop-remove-shape-"));
      await runPowerShell([
        "-File",
        path.join(root, "src", "remove-template-shape.ps1"),
        "-TemplatePath",
        templatePath,
        "-SlideIndex",
        String(slideIndex),
        "-ShapeName",
        shapeName,
        "-WorkDir",
        removeShapeWorkDir
      ], { workDir: removeShapeWorkDir });
    } catch (error) {
      sendInternalError(res, error);
      return;
    }

    const zonesPath = templatePath.replace(/\.pptx$/, ".zones.json");
    if (fs.existsSync(zonesPath)) fs.unlinkSync(zonesPath);

    sendJson(res, 200, { file: path.basename(templatePath), slideIndex, shapeName });
    return;
  }

  if (req.method === "GET" && req.url === "/api/sample") {
    const sample = fs.readFileSync(path.join(dataDir, "sample-comop.json"), "utf8");
    send(res, 200, sample, "application/json; charset=utf-8");
    return;
  }

  if (req.method === "POST" && req.url === "/api/generate") {
    const body = await readJsonBody(req, res);
    if (body === INVALID_BODY) return;
    let templatePath;
    try {
      templatePath = safeTemplatePath(body.template);
    } catch (err) {
      sendJson(res, 400, { error: err.message });
      return;
    }
    if (!fs.existsSync(templatePath)) {
      sendJson(res, 404, { error: "Template introuvable" });
      return;
    }

    fs.mkdirSync(outputDir, { recursive: true });
    fs.mkdirSync(requestDataDir, { recursive: true });
    const id = crypto.randomUUID();
    const dataPath = path.join(requestDataDir, `request-${id}.json`);
    const outputPath = path.join(outputDir, `comop-${id}.pptx`);
    fs.writeFileSync(dataPath, JSON.stringify(body.fields || {}, null, 2), "utf8");

    try {
      const generateWorkDir = fs.mkdtempSync(path.join(os.tmpdir(), "comop-generate-"));
      await runPowerShell([
        "-File",
        path.join(root, "src", "generate-comop.ps1"),
        "-TemplatePath",
        templatePath,
        "-DataPath",
        dataPath,
        "-OutputPath",
        outputPath,
        "-WorkDir",
        generateWorkDir
      ], { workDir: generateWorkDir });
    } catch (error) {
      sendInternalError(res, error);
      return;
    }

    sendJson(res, 200, {
      fileName: path.basename(outputPath),
      downloadUrl: `/output/${path.basename(outputPath)}`
    });
    return;
  }

  sendJson(res, 404, { error: "Route API inconnue" });
}

function serveStatic(req, res) {
  let url;
  if (req.url === "/") {
    url = "/index.html";
  } else {
    url = safeDecodeURIComponent(req.url);
    if (url === null) {
      send(res, 400, "URI invalide", "text/plain; charset=utf-8");
      return;
    }
  }
  if (url.startsWith("/output/")) {
    const filePath = path.join(outputDir, path.basename(url));
    // Audit du 2026-09-02 (securite) : /output/ servait n'importe quel fichier
    // present dans outputDir (server-runtime.log, artefacts intermediaires...),
    // sans liste blanche d'extension -- seule limite reelle etait
    // path.basename() contre la traversee de repertoire.
    if (!ALLOWED_OUTPUT_EXTENSIONS.has(path.extname(filePath).toLowerCase()) || !fs.existsSync(filePath)) {
      send(res, 404, "Fichier introuvable", "text/plain; charset=utf-8");
      return;
    }
    res.writeHead(200, {
      "Content-Type": contentTypes[".pptx"],
      "Content-Disposition": `attachment; filename="${path.basename(filePath)}"`
    });
    const fileStream = fs.createReadStream(filePath);
    fileStream.on("error", (error) => {
      if (!res.headersSent) {
        sendInternalError(res, error);
        return;
      }
      res.destroy();
    });
    fileStream.pipe(res);
    return;
  }

  const filePath = path.normalize(path.join(webDir, url));
  // Audit 09-07 (securite, latent) : filePath.startsWith(webDir) sans exiger
  // de separateur laisserait passer un repertoire frere dont le nom commence
  // par "web" (ex. "webXxx") comme s'il etait sous web/.
  if ((filePath !== webDir && !filePath.startsWith(webDir + path.sep)) || !fs.existsSync(filePath)) {
    send(res, 404, "Page introuvable", "text/plain; charset=utf-8");
    return;
  }
  const ext = path.extname(filePath);
  send(res, 200, fs.readFileSync(filePath), contentTypes[ext] || "application/octet-stream");
}

// Audit du 2026-09-02 (securite) : le serveur n'ecoute que sur 127.0.0.1, mais
// ca ne protege pas contre le "DNS rebinding" / une page web ouverte ailleurs
// dans le navigateur qui appelle fetch("http://127.0.0.1:5177/api/...") --
// n'importe quel onglet du poste peut alors piloter l'API locale. On verifie
// que le Host vise bien ce serveur et, si un Origin est fourni (requete
// navigateur), qu'il correspond au meme host:port. Une requete d'outil (curl,
// test) n'envoie pas d'Origin : elle n'est pas bloquee par ce controle.
// Audit du 2026-09-07 (securite) : residu du controle ci-dessus. Le test
// "si un Origin est fourni" laisse passer le cas ou le navigateur n'en envoie
// PAS -- un GET no-cors (<img src>, <iframe>, navigation depuis un autre site)
// n'a pas d'Origin et vise bien 127.0.0.1:<port>. MESURE M8 de l'audit : un
// GET cross-site sur /zones repondait 200 en executant reellement
// detect-template-zones.ps1 (4 626 ms de CPU par appel, relance a chaque appel
// tant qu'aucun cache n'existe). Sec-Fetch-Site est pose par le navigateur
// lui-meme et n'est pas modifiable depuis une page : "cross-site" sur /api/
// signifie "declenche par un autre site", jamais par l'interface locale (qui
// envoie "same-origin"). Un outil (curl, test) n'envoie pas cet en-tete et
// reste accepte, comme pour Origin.
function isRequestAllowed(req) {
  const allowedHosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
  if (!allowedHosts.has(req.headers.host || "")) return false;
  if (req.url.startsWith("/api/") && req.headers["sec-fetch-site"] === "cross-site") return false;
  const origin = req.headers.origin;
  if (origin) {
    const allowedOrigins = new Set([`http://127.0.0.1:${port}`, `http://localhost:${port}`]);
    if (!allowedOrigins.has(origin)) return false;
  }
  return true;
}

const server = http.createServer(async (req, res) => {
  try {
    if (!isRequestAllowed(req)) {
      sendJson(res, 403, { error: "Origine non autorisee" });
      return;
    }
    if (req.url.startsWith("/api/")) {
      await handleApi(req, res);
      return;
    }
    serveStatic(req, res);
  } catch (error) {
    sendInternalError(res, error);
  }
});

process.on("uncaughtException", error => {
  log(`UNCAUGHT ${error.stack || error.message}`);
  process.exit(1);
});

process.on("unhandledRejection", error => {
  log(`UNHANDLED ${error.stack || error.message}`);
  process.exit(1);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Prototype COMOP disponible sur http://localhost:${port}`);
  purgeOldOutputs();
  setInterval(purgeOldOutputs, OUTPUT_TTL_MS);
});

// Arret propre quand le pipe stdin est ferme par le parent (le kill Windows
// habituel termine le process sans laisser V8 ecrire sa coverage) : permet
// aux tests de fermer le serveur proprement plutot que de le tuer. Actif
// UNIQUEMENT sous COMOP_DATA_ROOT (signal "lance par les tests") pour ne
// jamais changer le cycle de vie du serveur en usage normal (un stdin ferme
// par un lanceur non interactif — service, tache planifiee — ne doit pas
// arreter le serveur de production).
if (process.env.COMOP_DATA_ROOT) {
  process.stdin.on("end", () => {
    server.close(() => process.exit(0));
  });
  process.stdin.resume();
}
