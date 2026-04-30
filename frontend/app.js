const quotesBody = document.querySelector("#quotesBody");
const marketTableHead = document.querySelector("#marketTableHead");
const sourceLabel = document.querySelector("#sourceLabel");
const updatedAt = document.querySelector("#updatedAt");
const instrumentCount = document.querySelector("#instrumentCount");
const connectionDot = document.querySelector("#connectionDot");
const connectionText = document.querySelector("#connectionText");
const searchInput = document.querySelector("#searchInput");
const currencyFilter = document.querySelector("#currencyFilter");
const lecapSettlementFilter = document.querySelector("#lecapSettlementFilter");
const marketView = document.querySelector("#marketView");
const bcraView = document.querySelector("#bcraView");
const calculatorsView = document.querySelector("#calculatorsView");
const bcraBody = document.querySelector("#bcraBody");
const bcraSeriesLabel = document.querySelector("#bcraSeriesLabel");
const bcraLatest = document.querySelector("#bcraLatest");
const bcraCount = document.querySelector("#bcraCount");
const bcraFrom = document.querySelector("#bcraFrom");
const bcraTo = document.querySelector("#bcraTo");
const bcraRefresh = document.querySelector("#bcraRefresh");
const calculatorTitle = document.querySelector("#calculatorTitle");
const calculatorStatus = document.querySelector("#calculatorStatus");
const bondDraftForm = document.querySelector("#bondDraftForm");
const issueDate = document.querySelector("#issueDate");
const maturityDate = document.querySelector("#maturityDate");
const faceValue = document.querySelector("#faceValue");
const cashflowPreview = document.querySelector("#cashflowPreview");
const lecapTicker = document.querySelector("#lecapTicker");
const temEmission = document.querySelector("#temEmission");
const saveLecap = document.querySelector("#saveLecap");
const savedLecaps = document.querySelector("#savedLecaps");

let currentCurrency = "all";
let currentMarketList = "bonds";
let currentLecapSettlement = "t1";
let currentView = "market";
let currentBcraSeries = "cer";
let currentBondModel = "pesos_fixed_rate";
let latestLecapCalculation = null;
let latestLecapMarket = [];
let lecapMarketLoading = false;
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

const BOND_MODEL_LABELS = {
  pesos_fixed_rate: "Tasa fija",
  cer: "Bonos CER",
  tamar: "Bonos TAMAR",
  hard_dollar: "Bonos Hard Dollar",
};

function formatNumber(value, options = {}) {
  if (value === null || value === undefined || value === "") {
    return '<span class="empty-cell">s/d</span>';
  }
  return new Intl.NumberFormat("es-AR", options).format(value);
}

function formatPercent(value, fractionDigits = 2) {
  if (value === null || value === undefined || value === "") {
    return '<span class="empty-cell">s/d</span>';
  }
  return `${formatNumber(value * 100, { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits })}%`;
}

function formatTime(value) {
  if (!value) return '<span class="empty-cell">s/d</span>';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "America/Argentina/Buenos_Aires",
  });
}

function formatDate(value) {
  if (!value) return "-";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function renderQuotes() {
  if (currentMarketList === "lecaps") {
    renderLecapMarket();
    return;
  }

  marketTableHead.innerHTML = `
    <tr>
      <th scope="col">Ticker</th>
      <th scope="col">Familia</th>
      <th scope="col">Moneda</th>
      <th scope="col" class="text-end">Compra</th>
      <th scope="col" class="text-end">Venta</th>
      <th scope="col" class="text-end">Ultimo</th>
      <th scope="col" class="text-end">Var %</th>
      <th scope="col" class="text-end">Volumen</th>
      <th scope="col" class="text-end">TIR</th>
      <th scope="col" class="text-end">Hora</th>
    </tr>
  `;

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

function renderLecapMarket() {
  marketTableHead.innerHTML = `
    <tr>
      <th scope="col">Ticker</th>
      <th scope="col">Vencimiento</th>
      <th scope="col">Pago</th>
      <th scope="col" class="text-end">Dias</th>
      <th scope="col" class="text-end">Bid</th>
      <th scope="col" class="text-end">Offer</th>
      <th scope="col" class="text-end">Last</th>
      <th scope="col" class="text-end">TNA Bid</th>
      <th scope="col" class="text-end">TNA Offer</th>
      <th scope="col" class="text-end">TNA Last</th>
      <th scope="col" class="text-end">TIR Last</th>
      <th scope="col" class="text-end">TEM Last</th>
      <th scope="col" class="text-end">Duration</th>
      <th scope="col" class="text-end">Mod Dur</th>
      <th scope="col" class="text-end">Convexity</th>
      <th scope="col" class="text-end">Hora</th>
    </tr>
  `;

  const text = searchInput.value.trim().toUpperCase();
  const rows = latestLecapMarket.filter((item) => !text || item.ticker.includes(text));
  instrumentCount.textContent = rows.length;

  if (!rows.length) {
    quotesBody.innerHTML = '<tr><td colspan="16" class="empty-state">Sin LECAPs guardadas para mostrar</td></tr>';
    return;
  }

  quotesBody.innerHTML = rows.map((item) => `
    <tr>
      <td class="ticker">${item.ticker}</td>
      <td>${formatDate(item.maturity_date)}</td>
      <td>${formatDate(item.effective_payment_date)}</td>
      <td class="text-end">${formatNumber(item.days_to_payment)}</td>
      <td class="text-end">${formatNumber(item.bid, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</td>
      <td class="text-end">${formatNumber(item.offer, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</td>
      <td class="text-end">${formatNumber(item.last, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</td>
      <td class="text-end">${formatPercent(item.tna_bid, 2)}</td>
      <td class="text-end">${formatPercent(item.tna_offer, 2)}</td>
      <td class="text-end">${formatPercent(item.tna_last, 2)}</td>
      <td class="text-end">${formatPercent(item.tir_last, 2)}</td>
      <td class="text-end">${formatPercent(item.tem_last, 2)}</td>
      <td class="text-end">${formatNumber(item.duration, { minimumFractionDigits: 4, maximumFractionDigits: 4 })}</td>
      <td class="text-end">${formatNumber(item.modified_duration, { minimumFractionDigits: 4, maximumFractionDigits: 4 })}</td>
      <td class="text-end">${formatNumber(item.convexity, { minimumFractionDigits: 4, maximumFractionDigits: 4 })}</td>
      <td class="text-end">${formatTime(item.updated_at)}</td>
    </tr>
  `).join("");
}

function renderBcraSeries(payload) {
  const series = payload.series
    ? payload.series.find((candidate) => candidate.key === currentBcraSeries)
    : payload;

  if (!series) {
    bcraBody.innerHTML = '<tr><td colspan="3" class="empty-state">Sin datos para la serie</td></tr>';
    return;
  }

  bcraSeriesLabel.textContent = series.label;
  bcraLatest.textContent = series.latest
    ? `${formatDate(series.latest.date)} - ${formatNumber(series.latest.value, { maximumFractionDigits: 4 })}`
    : "-";
  bcraCount.textContent = formatNumber(series.count || series.data.length);

  const rows = [...series.data].reverse();
  bcraBody.innerHTML = rows.map((point) => `
    <tr>
      <td>${formatDate(point.date)}</td>
      <td class="text-end">${formatNumber(point.value, { minimumFractionDigits: 4, maximumFractionDigits: 6 })}</td>
      <td>${series.unit}</td>
    </tr>
  `).join("");
}

async function fetchBcraSeries(refresh = false) {
  bcraBody.innerHTML = '<tr><td colspan="3" class="empty-state">Cargando datos BCRA</td></tr>';

  const params = new URLSearchParams({ limit: "700" });
  if (bcraFrom.value) params.set("desde", bcraFrom.value);
  if (bcraTo.value) params.set("hasta", bcraTo.value);
  if (refresh) params.set("refresh", "true");

  const response = await fetch(`/api/bcra/series?${params.toString()}`);
  if (!response.ok) throw new Error("No se pudo leer BCRA");
  renderBcraSeries(await response.json());
}

function applySnapshot(snapshot) {
  latestQuotes = snapshot.quotes || [];
  sourceLabel.textContent = snapshot.source || "-";
  updatedAt.textContent = formatTime(snapshot.updated_at);
  renderQuotes();
  if (currentMarketList === "lecaps") {
    fetchLecapMarket();
  }
}

function setConnection(state, message) {
  connectionDot.classList.toggle("live", state === "live");
  connectionDot.classList.toggle("error", state === "error");
  connectionText.textContent = message;
}

function setView(view) {
  currentView = view;
  marketView.classList.toggle("active", view === "market");
  bcraView.classList.toggle("active", view === "bcra");
  calculatorsView.classList.toggle("active", view === "calculators");
  document.querySelectorAll("[data-view]").forEach((button) => {
    const active = button.dataset.view === view;
    button.classList.toggle("active", active);
    button.classList.toggle("btn-dark", active);
    button.classList.toggle("btn-outline-dark", !active);
  });

  if (view === "bcra") fetchBcraSeries().catch(() => {
    bcraBody.innerHTML = '<tr><td colspan="3" class="empty-state">No se pudieron cargar datos BCRA</td></tr>';
  });
  if (view === "calculators") fetchSavedLecaps().catch(() => {
    savedLecaps.innerHTML = '<tr><td colspan="9" class="empty-state">No se pudieron cargar las LECAPs guardadas</td></tr>';
  });
}

function setCalculatorStatus(state, text) {
  calculatorStatus.classList.toggle("ok", state === "ok");
  calculatorStatus.classList.toggle("error", state === "error");
  calculatorStatus.textContent = text;
}

function setBondModel(model) {
  currentBondModel = model;
  calculatorTitle.textContent = BOND_MODEL_LABELS[model] || "Calculadora";
  setCalculatorStatus("draft", "Borrador");
  cashflowPreview.innerHTML = '<tr><td colspan="9" class="empty-state">Completa los datos iniciales</td></tr>';
  latestLecapCalculation = null;
  saveLecap.disabled = true;

  document.querySelectorAll("[data-bond-model]").forEach((button) => {
    button.classList.toggle("active", button.dataset.bondModel === model);
  });
}

function renderLecapCalculation(payload) {
  cashflowPreview.innerHTML = payload.cashflows.map((cashflow) => `
    <tr>
      <td>${cashflow.number}</td>
      <td>${formatDate(cashflow.payment_date)}</td>
      <td>${formatDate(cashflow.effective_payment_date)}</td>
      <td class="text-end">${formatNumber(cashflow.applicable_days)}</td>
      <td class="text-end">${formatNumber(cashflow.amortization_vn, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
      <td class="text-end">${formatNumber(cashflow.amortization_vr, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
      <td class="text-end">${formatPercent(cashflow.applicable_rate, 4)}</td>
      <td class="text-end">${formatNumber(cashflow.interest, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</td>
      <td class="text-end">${formatNumber(cashflow.total, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</td>
    </tr>
  `).join("");

  latestLecapCalculation = payload;
  saveLecap.disabled = false;
  setCalculatorStatus("ok", `${payload.ticker} calculada`);
}

function renderSavedLecaps(payload) {
  const items = payload.items || [];
  if (!items.length) {
    savedLecaps.innerHTML = '<tr><td colspan="9" class="empty-state">Todavia no hay LECAPs guardadas</td></tr>';
    return;
  }

  savedLecaps.innerHTML = items.map((item) => {
    const cashflow = item.calculation.cashflows[0];
    return `
      <tr>
        <td class="ticker">${item.ticker}</td>
        <td>${formatDate(item.issue_date)}</td>
        <td>${formatDate(item.maturity_date)}</td>
        <td>${formatDate(cashflow.effective_payment_date)}</td>
        <td class="text-end">${formatNumber(cashflow.applicable_days)}</td>
        <td class="text-end">${formatNumber(item.face_value, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
        <td class="text-end">${formatNumber(item.tem_emission_percent, { minimumFractionDigits: 4, maximumFractionDigits: 4 })}%</td>
        <td class="text-end">${formatNumber(cashflow.interest, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</td>
        <td class="text-end">${formatNumber(cashflow.total, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</td>
      </tr>
    `;
  }).join("");
}

async function fetchSavedLecaps() {
  const response = await fetch("/api/calculators/lecaps/saved");
  if (!response.ok) throw new Error("No se pudieron leer LECAPs guardadas");
  renderSavedLecaps(await response.json());
}

async function fetchLecapMarket() {
  if (lecapMarketLoading) return;
  lecapMarketLoading = true;
  try {
    const response = await fetch(`/api/market/lecaps?settlement=${currentLecapSettlement}`);
    if (!response.ok) throw new Error("No se pudieron leer LECAPs de mercado");
    const payload = await response.json();
    latestLecapMarket = payload.items || [];
    sourceLabel.textContent = payload.source || "-";
    updatedAt.textContent = formatTime(payload.updated_at);
    renderLecapMarket();
  } catch {
    quotesBody.innerHTML = '<tr><td colspan="16" class="empty-state">No se pudieron cargar las LECAPs</td></tr>';
  } finally {
    lecapMarketLoading = false;
  }
}

async function saveLatestLecap() {
  if (!latestLecapCalculation) return;
  saveLecap.disabled = true;
  setCalculatorStatus("draft", "Guardando");

  const response = await fetch("/api/calculators/lecaps/saved", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ticker: latestLecapCalculation.ticker,
      issue_date: latestLecapCalculation.issue_date,
      maturity_date: latestLecapCalculation.maturity_date,
      face_value: latestLecapCalculation.face_value,
      tem_emission_percent: latestLecapCalculation.tem_emission * 100,
    }),
  });

  if (!response.ok) {
    setCalculatorStatus("error", "No se pudo guardar");
    saveLecap.disabled = false;
    return;
  }

  await fetchSavedLecaps();
  setCalculatorStatus("ok", `${latestLecapCalculation.ticker} guardada`);
}

async function submitBondDraft(event) {
  event.preventDefault();
  setCalculatorStatus("draft", "Calculando");

  const response = await fetch("/api/calculators/lecaps", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ticker: lecapTicker.value,
      issue_date: issueDate.value,
      maturity_date: maturityDate.value,
      face_value: Number(faceValue.value),
      tem_emission_percent: Number(temEmission.value),
    }),
  });

  if (!response.ok) {
    setCalculatorStatus("error", "Revisar datos");
    cashflowPreview.innerHTML = '<tr><td colspan="9" class="empty-state">No se pudo calcular la LECAP</td></tr>';
    latestLecapCalculation = null;
    saveLecap.disabled = true;
    return;
  }

  renderLecapCalculation(await response.json());
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

document.querySelectorAll("[data-market-list]").forEach((button) => {
  button.addEventListener("click", () => {
    currentMarketList = button.dataset.marketList;
    document.querySelectorAll("[data-market-list]").forEach((candidate) => {
      const active = candidate === button;
      candidate.classList.toggle("active", active);
      candidate.classList.toggle("btn-dark", active);
      candidate.classList.toggle("btn-outline-dark", !active);
    });
    currencyFilter.classList.toggle("d-none", currentMarketList === "lecaps");
    lecapSettlementFilter.classList.toggle("active", currentMarketList === "lecaps");
    if (currentMarketList === "lecaps") {
      quotesBody.innerHTML = '<tr><td colspan="16" class="empty-state">Cargando LECAPs</td></tr>';
      fetchLecapMarket();
    } else {
      renderQuotes();
    }
  });
});

document.querySelectorAll("[data-lecap-settlement]").forEach((button) => {
  button.addEventListener("click", () => {
    currentLecapSettlement = button.dataset.lecapSettlement;
    document.querySelectorAll("[data-lecap-settlement]").forEach((candidate) => {
      const active = candidate === button;
      candidate.classList.toggle("active", active);
      candidate.classList.toggle("btn-dark", active);
      candidate.classList.toggle("btn-outline-dark", !active);
    });
    fetchLecapMarket();
  });
});

document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.view));
});

document.querySelectorAll("[data-bcra-series]").forEach((button) => {
  button.addEventListener("click", () => {
    currentBcraSeries = button.dataset.bcraSeries;
    document.querySelectorAll("[data-bcra-series]").forEach((candidate) => {
      const active = candidate === button;
      candidate.classList.toggle("active", active);
      candidate.classList.toggle("btn-dark", active);
      candidate.classList.toggle("btn-outline-dark", !active);
    });
    fetchBcraSeries().catch(() => {
      bcraBody.innerHTML = '<tr><td colspan="3" class="empty-state">No se pudieron cargar datos BCRA</td></tr>';
    });
  });
});

document.querySelectorAll("[data-bond-model]").forEach((button) => {
  button.addEventListener("click", () => setBondModel(button.dataset.bondModel));
});

bcraRefresh.addEventListener("click", () => {
  fetchBcraSeries(true).catch(() => {
    bcraBody.innerHTML = '<tr><td colspan="3" class="empty-state">No se pudieron actualizar datos BCRA</td></tr>';
  });
});

bondDraftForm.addEventListener("submit", submitBondDraft);
saveLecap.addEventListener("click", () => {
  saveLatestLecap().catch(() => {
    setCalculatorStatus("error", "No se pudo guardar");
    saveLecap.disabled = false;
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
