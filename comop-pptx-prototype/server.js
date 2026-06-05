const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const path = require("path");
const { spawn } = require("child_process");

const root = __dirname;
const webDir = path.join(root, "web");
const templatesDir = path.join(root, "templates");
const outputDir = path.join(root, "output");
const dataDir = path.join(root, "data");
const port = Number(process.env.PORT || 5177);
const serverLog = path.join(outputDir, "server-runtime.log");
const OUTPUT_TTL_MS = 24 * 60 * 60 * 1000; // 24h

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
  if (!fs.existsSync(outputDir)) return;
  const cutoff = Date.now() - OUTPUT_TTL_MS;
  fs.readdirSync(outputDir)
    .filter(f => f.endsWith(".pptx") || f.endsWith(".json"))
    .forEach(f => {
      const full = path.join(outputDir, f);
      try {
        if (fs.statSync(full).mtimeMs < cutoff) fs.unlinkSync(full);
      } catch (_) {}
    });
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

  if (req.method === "GET" && req.url === "/api/sample") {
    const sample = fs.readFileSync(path.join(dataDir, "sample-comop.json"), "utf8");
    send(res, 200, sample, "application/json; charset=utf-8");
    return;
  }

  if (req.method === "POST" && req.url === "/api/generate") {
    const body = JSON.parse(await readRequestBody(req));
    const templatePath = safeTemplatePath(body.template);
    if (!fs.existsSync(templatePath)) {
      sendJson(res, 404, { error: "Template introuvable" });
      return;
    }

    fs.mkdirSync(outputDir, { recursive: true });
    const id = crypto.randomUUID();
    const dataPath = path.join(outputDir, `request-${id}.json`);
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

server.listen(port, () => {
  console.log(`Prototype COMOP disponible sur http://localhost:${port}`);
  purgeOldOutputs();
  setInterval(purgeOldOutputs, OUTPUT_TTL_MS);
});
