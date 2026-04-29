const quotesBody = document.querySelector("#quotesBody");
const sourceLabel = document.querySelector("#sourceLabel");
const updatedAt = document.querySelector("#updatedAt");
const instrumentCount = document.querySelector("#instrumentCount");
const connectionDot = document.querySelector("#connectionDot");
const connectionText = document.querySelector("#connectionText");
const searchInput = document.querySelector("#searchInput");

let currentCurrency = "all";
const DEFAULT_QUOTES = [
  ["AO27", "AO27", "ARS"],
  ["AO27D", "AO27", "USD"],
  ["AO27C", "AO27", "Cable"],
  ["AL29", "AL29", "ARS"],
  ["AL29D", "AL29", "USD"],
  ["AL29C", "AL29", "Cable"],
  ["AL30", "AL30", "ARS"],
  ["AL30D", "AL30", "USD"],
  ["AL30C", "AL30", "Cable"],
  ["AL35", "AL35", "ARS"],
  ["AL35D", "AL35", "USD"],
  ["AL35C", "AL35", "Cable"],
  ["AE38", "AE38", "ARS"],
  ["AE38D", "AE38", "USD"],
  ["AE38C", "AE38", "Cable"],
  ["AL41", "AL41", "ARS"],
  ["AL41D", "AL41", "USD"],
  ["AL41C", "AL41", "Cable"],
].map(([symbol, family, currency]) => ({
  symbol,
  family,
  currency,
  law: "Ley local",
  bid: null,
  ask: null,
  last: null,
  change: null,
  volume: null,
  ytm: null,
  updated_at: null,
}));

let latestQuotes = [...DEFAULT_QUOTES];
let ws;

function formatNumber(value, options = {}) {
  if (value === null || value === undefined || value === "") {
    return '<span class="empty-cell">s/d</span>';
  }
  return new Intl.NumberFormat("es-AR", options).format(value);
}

function formatTime(value) {
  if (!value) return '<span class="empty-cell">s/d</span>';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function renderQuotes() {
  const text = searchInput.value.trim().toUpperCase();
  const rows = latestQuotes.filter((quote) => {
    const currencyMatch = currentCurrency === "all" || quote.currency === currentCurrency;
    const textMatch = !text || quote.symbol.includes(text) || quote.family.includes(text);
    return currencyMatch && textMatch;
  });

  instrumentCount.textContent = latestQuotes.length;
  quotesBody.innerHTML = rows.map((quote) => {
    const changeClass = quote.change > 0 ? "positive" : quote.change < 0 ? "negative" : "";
    return `
      <tr>
        <td class="ticker">${quote.symbol}</td>
        <td>${quote.family}</td>
        <td><span class="currency-pill">${quote.currency}</span></td>
        <td class="text-end">${formatNumber(quote.bid, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td class="text-end">${formatNumber(quote.ask, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td class="text-end">${formatNumber(quote.last, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td class="text-end ${changeClass}">${formatNumber(quote.change, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td class="text-end">${formatNumber(quote.volume)}</td>
        <td class="text-end">${formatNumber(quote.ytm, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td class="text-end">${formatTime(quote.updated_at)}</td>
      </tr>
    `;
  }).join("");
}

function applySnapshot(snapshot) {
  latestQuotes = snapshot.quotes || [];
  sourceLabel.textContent = snapshot.source || "-";
  updatedAt.textContent = formatTime(snapshot.updated_at);
  renderQuotes();
}

function setConnection(state, message) {
  connectionDot.classList.toggle("live", state === "live");
  connectionDot.classList.toggle("error", state === "error");
  connectionText.textContent = message;
}

async function fetchSnapshot() {
  const response = await fetch("/api/quotes");
  if (!response.ok) throw new Error("No se pudo leer /api/quotes");
  applySnapshot(await response.json());
}

function connectWebSocket() {
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  ws = new WebSocket(`${protocol}://${window.location.host}/ws/quotes`);

  ws.addEventListener("open", () => {
    setConnection("live", "En vivo");
  });

  ws.addEventListener("message", (event) => {
    applySnapshot(JSON.parse(event.data));
  });

  ws.addEventListener("close", () => {
    setConnection("error", "Reconectando");
    window.setTimeout(connectWebSocket, 2000);
  });

  ws.addEventListener("error", () => {
    setConnection("error", "Sin conexion");
  });
}

document.querySelectorAll("[data-currency]").forEach((button) => {
  button.addEventListener("click", () => {
    currentCurrency = button.dataset.currency;
    document.querySelectorAll("[data-currency]").forEach((candidate) => {
      candidate.classList.toggle("active", candidate === button);
      candidate.classList.toggle("btn-dark", candidate === button);
      candidate.classList.toggle("btn-outline-dark", candidate !== button);
    });
    renderQuotes();
  });
});

searchInput.addEventListener("input", renderQuotes);

fetchSnapshot()
  .then(() => connectWebSocket())
  .catch(() => {
    sourceLabel.textContent = "static";
    updatedAt.textContent = "-";
    renderQuotes();
    setConnection("error", "Sin backend");
  });

renderQuotes();
