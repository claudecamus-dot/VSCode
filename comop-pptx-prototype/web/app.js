const form = document.querySelector("#comopForm");
const templateSelect = document.querySelector("#template");
const statusBox = document.querySelector("#status");

function setStatus(message, tone = "neutral") {
  statusBox.textContent = message;
  statusBox.dataset.tone = tone;
}

function collectFields() {
  const data = new FormData(form);
  return Object.fromEntries(data.entries());
}

function fillFields(fields) {
  for (const [key, value] of Object.entries(fields)) {
    const field = form.elements[key];
    if (field) {
      field.value = value;
    }
  }
}

async function loadTemplates() {
  const response = await fetch("/api/templates");
  const { templates } = await response.json();
  templateSelect.innerHTML = "";
  for (const template of templates) {
    const option = document.createElement("option");
    option.value = template.file;
    option.textContent = template.name;
    templateSelect.append(option);
  }
  if (templates.length === 0) {
    const option = document.createElement("option");
    option.textContent = "Aucun template disponible";
    templateSelect.append(option);
    templateSelect.disabled = true;
  }
}

const templateUpload = document.querySelector("#templateUpload");

templateUpload.addEventListener("change", async () => {
  const file = templateUpload.files[0];
  if (!file) return;
  setStatus(`Chargement de ${file.name}…`);
  try {
    const response = await fetch("/api/templates", {
      method: "POST",
      headers: { "X-Template-Name": encodeURIComponent(file.name) },
      body: file
    });
    const result = await response.json();
    if (!response.ok) {
      setStatus(result.error || "Erreur de chargement.", "error");
      return;
    }
    await loadTemplates();
    templateSelect.value = result.file;
    setStatus(`Template "${result.name}" ajoute a la bibliotheque.`, "success");
  } catch (err) {
    setStatus(err.message || "Erreur reseau.", "error");
  } finally {
    templateUpload.value = "";
  }
});

document.querySelector("#loadSample").addEventListener("click", async () => {
  const response = await fetch("/api/sample");
  fillFields(await response.json());
  setStatus("Exemple charge.");
});

const generateBtn = document.querySelector("#generate");

generateBtn.addEventListener("click", async () => {
  if (generateBtn.disabled) return;
  generateBtn.disabled = true;
  const originalLabel = generateBtn.textContent;
  generateBtn.textContent = "Generation en cours…";
  setStatus("Generation en cours…");
  try {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        template: templateSelect.value,
        fields: collectFields()
      })
    });
    const result = await response.json();
    if (!response.ok) {
      setStatus(result.error || "Erreur de generation.", "error");
      return;
    }
    setStatus(`PowerPoint genere : ${result.fileName}`, "success");
    window.location.href = result.downloadUrl;
  } catch (err) {
    setStatus(err.message || "Erreur reseau.", "error");
  } finally {
    generateBtn.disabled = false;
    generateBtn.textContent = originalLabel;
  }
});

loadTemplates().catch(error => setStatus(error.message, "error"));
