"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const net = require("net");
const http = require("http");
const { spawn } = require("child_process");

const projectRoot = path.join(__dirname, "..");

// Isole templates/output/data dans un dossier temporaire (via COMOP_DATA_ROOT,
// cf. server.js) pour ne jamais ecrire de fichier de test dans les dossiers
// reels du prototype. Le serveur execute reste le vrai server.js du projet
// (pas une copie) pour que la coverage c8 s'attribue au fichier reel.
function makeDataRoot() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "comop-test-"));
  fs.mkdirSync(path.join(dir, "data"), { recursive: true });
  fs.copyFileSync(
    path.join(projectRoot, "data", "sample-comop.json"),
    path.join(dir, "data", "sample-comop.json")
  );
  fs.mkdirSync(path.join(dir, "templates"), { recursive: true });
  fs.mkdirSync(path.join(dir, "output"), { recursive: true });
  return dir;
}

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(err => (err ? reject(err) : resolve(port)));
    });
    srv.on("error", reject);
  });
}

async function startServer() {
  const dataRoot = makeDataRoot();
  const port = await freePort();
  const child = spawn(process.execPath, ["server.js"], {
    cwd: projectRoot,
    env: { ...process.env, PORT: String(port), COMOP_DATA_ROOT: dataRoot },
    windowsHide: true
  });

  let ready = false;
  let startupOutput = "";
  child.stdout.on("data", chunk => { startupOutput += chunk.toString(); });
  child.stderr.on("data", chunk => { startupOutput += chunk.toString(); });

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Le serveur ne demarre pas (port ${port}) :\n${startupOutput}`));
    }, 8000);
    const check = setInterval(() => {
      if (startupOutput.includes("disponible sur")) {
        ready = true;
        clearInterval(check);
        clearTimeout(timer);
        resolve();
      }
    }, 50);
    child.on("exit", code => {
      if (!ready) {
        clearInterval(check);
        clearTimeout(timer);
        reject(new Error(`Le serveur s'est arrete (code ${code}) avant d'etre pret :\n${startupOutput}`));
      }
    });
  });

  const baseUrl = `http://127.0.0.1:${port}`;

  async function stop() {
    const exited = new Promise(resolve => child.once("exit", resolve));
    child.stdin.end();
    const timeout = setTimeout(() => child.kill(), 3000);
    await exited;
    clearTimeout(timeout);
    fs.rmSync(dataRoot, { recursive: true, force: true });
  }

  return { baseUrl, dataRoot, stop };
}

function request(baseUrl, method, urlPath, { headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(baseUrl + urlPath, { method, headers }, res => {
      const chunks = [];
      res.on("data", c => chunks.push(c));
      res.on("end", () => {
        const raw = Buffer.concat(chunks);
        resolve({ status: res.statusCode, headers: res.headers, raw, text: raw.toString("utf8") });
      });
    });
    req.on("error", reject);
    if (body !== undefined) req.write(body);
    req.end();
  });
}

module.exports = { startServer, request };
