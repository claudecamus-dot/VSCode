const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
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

function log(message) {
  fs.mkdirSync(outputDir, { recursive: true });
  fs.appendFileSync(serverLog, `[${new Date().toISOString()}] ${message}\n`, "utf8");
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
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Payload trop volumineux"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
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
  const raw = await readRequestBody(req);
  try {
    return JSON.parse(raw);
  } catch {
    sendJson(res, 400, { error: "Corps JSON invalide" });
    return INVALID_BODY;
  }
}

function readBinaryBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let length = 0;
    req.on("data", chunk => {
      length += chunk.length;
      if (length > maxBytes) {
        reject(new Error("Fichier trop volumineux"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function runPowerShell(args) {
  return new Promise((resolve, reject) => {
    const child = spawn("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", ...args], {
      cwd: root,
      windowsHide: true
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", data => { stdout += data.toString(); });
    child.stderr.on("data", data => { stderr += data.toString(); });
    child.on("close", code => {
      if (code !== 0) {
        reject(new Error(stderr || stdout || `PowerShell exit ${code}`));
        return;
      }
      resolve(stdout.trim());
    });
  });
}

function safeTemplatePath(name) {
  const fileName = path.basename(name || "");
  const templatePath = path.join(templatesDir, fileName);
  if (!fileName.endsWith(".pptx") || !templatePath.startsWith(templatesDir)) {
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
    const rawName = decodeURIComponent(req.headers["x-template-name"] || "");
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

    fs.mkdirSync(templatesDir, { recursive: true });
    fs.writeFileSync(templatePath, buffer);

    let branding = null;
    try {
      await runPowerShell([
        "-File",
        path.join(root, "src", "extract-template-branding.ps1"),
        "-TemplatePath",
        templatePath
      ]);
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
    sendJson(res, 200, { ...readTemplateMeta(fileName), branding });
    return;
  }

  if (req.method === "DELETE" && req.url.startsWith("/api/templates/")) {
    const rawName = decodeURIComponent(req.url.slice("/api/templates/".length));
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
    const rawName = decodeURIComponent(req.url.slice("/api/templates/".length, -"/zones".length));
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
        await runPowerShell([
          "-File",
          path.join(root, "src", "detect-template-zones.ps1"),
          "-TemplatePath",
          templatePath
        ]);
      } catch (error) {
        sendJson(res, 500, { error: error.message });
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
    const rawName = decodeURIComponent(req.url.slice("/api/templates/".length, -"/remove-shape".length));
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
      await runPowerShell([
        "-File",
        path.join(root, "src", "remove-template-shape.ps1"),
        "-TemplatePath",
        templatePath,
        "-SlideIndex",
        String(slideIndex),
        "-ShapeName",
        shapeName
      ]);
    } catch (error) {
      sendJson(res, 500, { error: error.message });
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

    await runPowerShell([
      "-File",
      path.join(root, "src", "generate-comop.ps1"),
      "-TemplatePath",
      templatePath,
      "-DataPath",
      dataPath,
      "-OutputPath",
      outputPath
    ]);

    sendJson(res, 200, {
      fileName: path.basename(outputPath),
      downloadUrl: `/output/${path.basename(outputPath)}`
    });
    return;
  }

  sendJson(res, 404, { error: "Route API inconnue" });
}

function serveStatic(req, res) {
  const url = req.url === "/" ? "/index.html" : decodeURIComponent(req.url);
  if (url.startsWith("/output/")) {
    const filePath = path.join(outputDir, path.basename(url));
    if (!fs.existsSync(filePath)) {
      send(res, 404, "Fichier introuvable", "text/plain; charset=utf-8");
      return;
    }
    res.writeHead(200, {
      "Content-Type": contentTypes[".pptx"],
      "Content-Disposition": `attachment; filename="${path.basename(filePath)}"`
    });
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  const filePath = path.normalize(path.join(webDir, url));
  if (!filePath.startsWith(webDir) || !fs.existsSync(filePath)) {
    send(res, 404, "Page introuvable", "text/plain; charset=utf-8");
    return;
  }
  const ext = path.extname(filePath);
  send(res, 200, fs.readFileSync(filePath), contentTypes[ext] || "application/octet-stream");
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.url.startsWith("/api/")) {
      await handleApi(req, res);
      return;
    }
    serveStatic(req, res);
  } catch (error) {
    log(`ERROR ${error.stack || error.message}`);
    sendJson(res, 500, { error: error.message });
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
