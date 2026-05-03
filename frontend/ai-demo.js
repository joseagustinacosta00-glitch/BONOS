const memoryForm = document.querySelector("#memory-form");
const memoryList = document.querySelector("#memory-list");
const refreshMemory = document.querySelector("#refresh-memory");
const assistantForm = document.querySelector("#assistant-form");
const assistantOutput = document.querySelector("#assistant-output");
const studyForm = document.querySelector("#study-form");
const studyOutput = document.querySelector("#study-output");

memoryForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = {
    title: document.querySelector("#memory-title").value,
    category: document.querySelector("#memory-category").value,
    tags: document.querySelector("#memory-tags").value,
    content: document.querySelector("#memory-content").value,
  };
  await apiFetch("/api/ai/memory", { method: "POST", body: JSON.stringify(payload) });
  memoryForm.reset();
  await loadMemory();
});

refreshMemory.addEventListener("click", loadMemory);

assistantForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  assistantOutput.textContent = "Consultando...";
  const data = await apiFetch("/api/assistant/message", {
    method: "POST",
    body: JSON.stringify({ message: document.querySelector("#assistant-message").value }),
  });
  assistantOutput.textContent = data.answer || JSON.stringify(data, null, 2);
});

studyForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  studyOutput.textContent = "Calculando...";
  const dato = document.querySelector("#study-dato").value;
  const mercado = document.querySelector("#study-mercado").value;
  const liquidacion = document.querySelector("#study-liquidacion").value;
  const payload = {
    series_a: {
      ticker: document.querySelector("#study-ticker-a").value,
      dato,
      mercado,
      liquidacion,
    },
    series_b: {
      ticker: document.querySelector("#study-ticker-b").value,
      dato,
      mercado,
      liquidacion,
    },
    window: Number(document.querySelector("#study-window").value || 20),
    mode: "spread",
  };
  const data = await apiFetch("/api/ai/study/spread-zscore", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  studyOutput.textContent = JSON.stringify(data, null, 2);
});

async function loadMemory() {
  memoryList.textContent = "Cargando...";
  const data = await apiFetch("/api/ai/memory");
  const items = data.items || [];
  if (!items.length) {
    memoryList.textContent = "Todavia no hay notas.";
    return;
  }
  memoryList.innerHTML = items.map(renderNote).join("");
}

function renderNote(note) {
  return `
    <article class="ai-note">
      <h3>${escapeHtml(note.title)}</h3>
      <p>${escapeHtml(note.content)}</p>
      <div class="ai-note-meta">${escapeHtml(note.category)} · ${escapeHtml(note.tags || "sin tags")}</div>
    </article>
  `;
}

async function apiFetch(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }
  return data;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

loadMemory().catch((error) => {
  memoryList.textContent = error.message;
});
