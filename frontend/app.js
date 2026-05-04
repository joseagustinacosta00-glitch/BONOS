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
const ratesView = document.querySelector("#ratesView");
const bcraView = document.querySelector("#bcraView");
const calculatorsView = document.querySelector("#calculatorsView");
const historicalView = document.querySelector("#historicalView");
const tplusView = document.querySelector("#tplusView");
const bcraBody = document.querySelector("#bcraBody");
const bcraSeriesLabel = document.querySelector("#bcraSeriesLabel");
const bcraLatest = document.querySelector("#bcraLatest");
const bcraCount = document.querySelector("#bcraCount");
const bcraFrom = document.querySelector("#bcraFrom");
const bcraTo = document.querySelector("#bcraTo");
const bcraRefresh = document.querySelector("#bcraRefresh");
const ratesRefresh = document.querySelector("#ratesRefresh");
const ratesLast = document.querySelector("#ratesLast");
const ratesTerm = document.querySelector("#ratesTerm");
const ratesUpdatedAt = document.querySelector("#ratesUpdatedAt");
const ratesBody = document.querySelector("#ratesBody");
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
const lecapTemplate = document.querySelector("#lecapTemplate");
const hardDollarTemplate = document.querySelector("#hardDollarTemplate");
const lecapSubmenu = document.querySelector("#lecapSubmenu");
const dualSubmenu = document.querySelector("#dualSubmenu");
const calculatorPlaceholder = document.querySelector("#calculatorPlaceholder");
const historicalForm = document.querySelector("#historicalForm");
const historicalUploadForm = document.querySelector("#historicalUploadForm");
const historicalTicker = document.querySelector("#historicalTicker");
const historicalUploadTicker = document.querySelector("#historicalUploadTicker");
const historicalTickerOptions = document.querySelector("#historicalTickerOptions");
const historicalMetricType = document.querySelector("#historicalMetricType");
const historicalUploadMetricType = document.querySelector("#historicalUploadMetricType");
const historicalPriceMarket = document.querySelector("#historicalPriceMarket");
const historicalSettlement = document.querySelector("#historicalSettlement");
const historicalUploadPriceMarket = document.querySelector("#historicalUploadPriceMarket");
const historicalUploadSettlement = document.querySelector("#historicalUploadSettlement");
const historicalDate = document.querySelector("#historicalDate");
const historicalValue = document.querySelector("#historicalValue");
const historicalFile = document.querySelector("#historicalFile");
const historicalStatus = document.querySelector("#historicalStatus");
const historicalBody = document.querySelector("#historicalBody");
const historicalSeries = document.querySelector("#historicalSeries");
const historicalSeriesSearch = document.querySelector("#historicalSeriesSearch");
const historicalDownload = document.querySelector("#historicalDownload");
const hardDollarForm = document.querySelector("#hardDollarForm");
const hdIssueDate = document.querySelector("#hdIssueDate");
const hdMaturityDate = document.querySelector("#hdMaturityDate");
const hdFaceValue = document.querySelector("#hdFaceValue");
const hdFrequency = document.querySelector("#hdFrequency");
const hdBondType = document.querySelector("#hdBondType");
const hdConvention = document.querySelector("#hdConvention");
const hdCouponType = document.querySelector("#hdCouponType");
const hdFixedCouponWrap = document.querySelector("#hdFixedCouponWrap");
const hdFixedCoupon = document.querySelector("#hdFixedCoupon");
const hdStepUpSection = document.querySelector("#hdStepUpSection");
const hdStepUpRows = document.querySelector("#hdStepUpRows");
const hdAmortizationSection = document.querySelector("#hdAmortizationSection");
const hdAmortStart = document.querySelector("#hdAmortStart");
const hdAmortCount = document.querySelector("#hdAmortCount");
const hdAmortDistribute = document.querySelector("#hdAmortDistribute");
const hdCouponsSection = document.querySelector("#hdCouponsSection");
const hdCouponsBody = document.querySelector("#hdCouponsBody");
const hdCashflowBody = document.querySelector("#hdCashflowBody");
const hdGenerateSchedule = document.querySelector("#hdGenerateSchedule");
const hdCalculate = document.querySelector("#hdCalculate");
const hdStatus = document.querySelector("#hdStatus");
const tplusForm = document.querySelector("#tplusForm");
const tplusDirection = document.querySelector("#tplusDirection");
const tplusRate = document.querySelector("#tplusRate");
const tplusPrice = document.querySelector("#tplusPrice");
const tplusAutoRate = document.querySelector("#tplusAutoRate");
const tplusStatus = document.querySelector("#tplusStatus");
const tplusDays = document.querySelector("#tplusDays");
const tplusNextBusinessDay = document.querySelector("#tplusNextBusinessDay");
const tplusOutput = document.querySelector("#tplusOutput");

let currentCurrency = "all";
let currentMarketList = "bonds";
let currentLecapSettlement = "t1";
let currentView = "market";
let currentBcraSeries = "cer";
let currentBondModel = "lecap";
let latestLecapCalculation = null;
let latestLecapMarket = [];
let lecapMarketLoading = false;
let latestHistoricalSeries = [];
let activeHistoricalSeries = null;
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
  lecap: "Lecap",
  hard_dollar: "Bono HD",
  cer: "CER",
  tamar: "TAMAR",
  pesos_fixed_rate: "Tasa fija",
  dual: "DUAL",
};

const HISTORICAL_TYPE_LABELS = {
  parity: "Paridad",
  dirty_price: "Precio dirty",
  clean_price: "Precio clean",
  ytm: "TIR",
  tem: "TEM",
  tna: "TNA",
  volume: "Volumen",
};

const PRICE_MARKET_LABELS = {
  pesos: "PESOS",
  cable: "CABLE",
  mep: "MEP",
  unspecified: "Sin mercado",
};

const SETTLEMENT_LABELS = {
  t0: "T+0",
  t1: "T+1",
  unspecified: "Sin liquidacion",
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
        <td class="text-end">${formatPercent(quote.ytm, 2)}</td>
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
  ratesView.classList.toggle("active", view === "rates");
  bcraView.classList.toggle("active", view === "bcra");
  calculatorsView.classList.toggle("active", view === "calculators");
  historicalView.classList.toggle("active", view === "historical");
  tplusView.classList.toggle("active", view === "tplus");
  document.querySelectorAll("[data-view]").forEach((button) => {
    const active = button.dataset.view === view;
    button.classList.toggle("active", active);
    button.classList.toggle("btn-dark", active);
    button.classList.toggle("btn-outline-dark", !active);
  });

  if (view === "bcra") fetchBcraSeries().catch(() => {
    bcraBody.innerHTML = '<tr><td colspan="3" class="empty-state">No se pudieron cargar datos BCRA</td></tr>';
  });
  if (view === "rates") fetchRates().catch(() => {
    ratesBody.innerHTML = '<tr><td colspan="6" class="empty-state">No se pudo cargar caucion</td></tr>';
  });
  if (view === "calculators") fetchSavedLecaps().catch(() => {
    savedLecaps.innerHTML = '<tr><td colspan="9" class="empty-state">No se pudieron cargar las LECAPs guardadas</td></tr>';
  });
  if (view === "historical") {
    fetchHistoricalTickers().catch(() => {});
    fetchHistoricalData().catch(() => {
      historicalBody.innerHTML = '<tr><td colspan="7" class="empty-state">No se pudieron cargar los datos historicos</td></tr>';
    });
  }
  if (view === "tplus") {
    fetchTplusAutoRate().then(calculateTplus).catch(() => {
      setTplusStatus("error", "Sin caucion");
    });
  }
}

function setCalculatorStatus(state, text) {
  calculatorStatus.classList.toggle("ok", state === "ok");
  calculatorStatus.classList.toggle("error", state === "error");
  calculatorStatus.textContent = text;
}

function setHistoricalStatus(state, text) {
  historicalStatus.classList.toggle("ok", state === "ok");
  historicalStatus.classList.toggle("error", state === "error");
  historicalStatus.textContent = text;
}

function setTplusStatus(state, text) {
  tplusStatus.classList.toggle("ok", state === "ok");
  tplusStatus.classList.toggle("error", state === "error");
  tplusStatus.textContent = text;
}

function setBondModel(model) {
  currentBondModel = model;
  calculatorTitle.textContent = BOND_MODEL_LABELS[model] || "Calculadora";
  setCalculatorStatus("draft", "Borrador");
  cashflowPreview.innerHTML = '<tr><td colspan="9" class="empty-state">Completa los datos iniciales</td></tr>';
  latestLecapCalculation = null;
  saveLecap.disabled = true;

  const isLecap = model === "lecap";
  const isHardDollar = model === "hard_dollar";
  const isDual = model === "dual";
  lecapTemplate.classList.toggle("d-none", !isLecap);
  hardDollarTemplate.classList.toggle("d-none", !isHardDollar);
  lecapSubmenu.classList.toggle("d-none", !isLecap);
  dualSubmenu.classList.toggle("d-none", !isDual);
  calculatorPlaceholder.classList.toggle("d-none", isLecap || isHardDollar);
  if (isLecap) {
    calculatorPlaceholder.textContent = "";
  } else if (isHardDollar) {
    renderHardDollarCouponInputs();
  } else if (isDual) {
    calculatorPlaceholder.textContent = "DUAL queda preparado con CER, TAMAR y FIJA como dualidades seleccionables. El formulario se agrega cuando definamos el flujo.";
  } else {
    calculatorPlaceholder.textContent = "Template seleccionado. El formulario cargable queda pendiente; por ahora el alta con flujo fijo esta disponible solo para LECAPs.";
  }

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

async function fetchHistoricalTickers() {
  const response = await fetch("/api/data/tickers");
  if (!response.ok) throw new Error("No se pudieron leer tickers");
  const payload = await response.json();
  historicalTickerOptions.innerHTML = (payload.tickers || [])
    .map((ticker) => `<option value="${ticker}"></option>`)
    .join("");
}

async function fetchHistoricalData(filters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  const response = await fetch(params.toString() ? `/api/historical-data?${params.toString()}` : "/api/historical-data");
  if (!response.ok) throw new Error("No se pudieron leer historicos");
  renderHistoricalData(await response.json());
}

function renderHistoricalData(payload) {
  const items = payload.items || [];
  latestHistoricalSeries = payload.series || latestHistoricalSeries;
  renderHistoricalSeries();
  if (!items.length) {
    historicalBody.innerHTML = '<tr><td colspan="7" class="empty-state">Todavia no hay datos historicos guardados</td></tr>';
    return;
  }

  historicalBody.innerHTML = items.map((item) => `
    <tr>
      <td class="ticker">${item.ticker}</td>
      <td>${PRICE_MARKET_LABELS[item.price_market] || item.price_market}</td>
      <td>${SETTLEMENT_LABELS[item.settlement_type] || item.settlement_type}</td>
      <td>${HISTORICAL_TYPE_LABELS[item.metric_type] || item.metric_type}</td>
      <td>${formatDate(item.value_date)}</td>
      <td class="text-end">${formatNumber(item.value, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</td>
      <td class="text-end">${formatTime(item.updated_at)}</td>
    </tr>
  `).join("");
}

function renderHistoricalSeries() {
  const text = historicalSeriesSearch.value.trim().toUpperCase();
  const series = latestHistoricalSeries.filter((item) => {
    const family = familyFromTicker(item.ticker);
    return !text || item.ticker.includes(text) || family.includes(text);
  });
  if (!series.length) {
    historicalSeries.innerHTML = '<span class="empty-cell">Sin series cargadas</span>';
    return;
  }

  historicalSeries.innerHTML = series.map((item) => {
    const key = historicalSeriesKey(item);
    const active = activeHistoricalSeries === key;
    return `
      <article class="series-card ${active ? "active" : ""}">
        <div>
          <strong>${familyFromTicker(item.ticker)} / ${item.ticker}</strong>
          <span>${HISTORICAL_TYPE_LABELS[item.metric_type] || item.metric_type} - ${PRICE_MARKET_LABELS[item.price_market] || item.price_market} - ${SETTLEMENT_LABELS[item.settlement_type] || item.settlement_type}</span>
          <small>${formatNumber(item.count)} datos - ${formatDate(item.first_date)} a ${formatDate(item.last_date)}</small>
        </div>
        <button class="btn btn-sm ${active ? "btn-dark" : "btn-outline-dark"}" data-historical-series="${key}" type="button">${active ? "Ocultar" : "Ver"}</button>
      </article>
    `;
  }).join("");
}

async function toggleHistoricalSeries(item) {
  const key = historicalSeriesKey(item);
  if (activeHistoricalSeries === key) {
    activeHistoricalSeries = null;
    historicalDownload.disabled = true;
    historicalBody.innerHTML = '<tr><td colspan="7" class="empty-state">Selecciona una serie para ver la base</td></tr>';
    renderHistoricalSeries();
    return;
  }

  activeHistoricalSeries = key;
  historicalDownload.disabled = false;
  await fetchHistoricalData({
    ticker: item.ticker,
    metric_type: item.metric_type,
    price_market: item.price_market,
    settlement_type: item.settlement_type,
    limit: "5000",
  });
}

function historicalSeriesKey(item) {
  return [item.ticker, item.metric_type, item.price_market, item.settlement_type].join("|");
}

function historicalSeriesFromKey(key) {
  return latestHistoricalSeries.find((item) => historicalSeriesKey(item) === key);
}

function familyFromTicker(ticker) {
  return ticker.replace(/[DC]$/, "");
}

function downloadActiveHistoricalSeries() {
  if (!activeHistoricalSeries) return;
  const item = historicalSeriesFromKey(activeHistoricalSeries);
  if (!item) return;
  const params = new URLSearchParams({
    ticker: item.ticker,
    metric_type: item.metric_type,
    price_market: item.price_market,
    settlement_type: item.settlement_type,
  });
  window.location.href = `/api/historical-data/export?${params.toString()}`;
}

async function saveHistoricalData(event) {
  event.preventDefault();
  setHistoricalStatus("draft", "Guardando");
  const response = await fetch("/api/historical-data", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ticker: historicalTicker.value.trim().toUpperCase(),
      metric_type: historicalMetricType.value,
      price_market: historicalPriceMarket.value,
      settlement_type: historicalSettlement.value,
      value_date: historicalDate.value,
      value: Number(historicalValue.value),
    }),
  });

  if (!response.ok) {
    setHistoricalStatus("error", "Revisar datos");
    return;
  }

  const payload = await response.json();
  historicalValue.value = "";
  await fetchHistoricalTickers();
  await fetchHistoricalData();
  setHistoricalStatus("ok", payload.replaced ? "Dato reemplazado" : "Dato guardado");
}

async function uploadHistoricalData(event) {
  event.preventDefault();
  if (!historicalFile.files.length) return;
  setHistoricalStatus("draft", "Subiendo archivo");

  const body = new FormData();
  body.append("ticker", historicalUploadTicker.value.trim().toUpperCase());
  body.append("metric_type", historicalUploadMetricType.value);
  body.append("price_market", historicalUploadPriceMarket.value);
  body.append("settlement_type", historicalUploadSettlement.value);
  body.append("file", historicalFile.files[0]);

  const response = await fetch("/api/historical-data/upload", {
    method: "POST",
    body,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const detail = Array.isArray(error.detail)
      ? error.detail.map((item) => `Fila ${item.row}: ${item.detail}`).join(" | ")
      : error.detail;
    setHistoricalStatus("error", detail || "No se pudo importar");
    return;
  }

  const payload = await response.json();
  historicalFile.value = "";
  await fetchHistoricalTickers();
  await fetchHistoricalData();
  const replaced = payload.replaced ? `, ${payload.replaced} reemplazados` : "";
  const skipped = payload.errors && payload.errors.length ? `, ${payload.errors.length} filas omitidas` : "";
  setHistoricalStatus("ok", `${payload.imported} datos importados${replaced}${skipped}`);
}

let hdCoupons = [];
let hdLastCalculation = null;

function setHdStatus(kind, text) {
  if (!hdStatus) {
    console.warn("[Bono HD] hdStatus element no encontrado:", kind, text);
    return;
  }
  hdStatus.dataset.kind = kind;
  hdStatus.textContent = text;
  if (kind === "error") {
    console.error("[Bono HD]", text);
  }
}

function formatDateDisplay(value) {
  if (!value) return "";
  const parts = String(value).split("-");
  if (parts.length !== 3) return value;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function renderHardDollarCouponInputs() {
  const isStepUp = hdCouponType.value === "step_up";
  hdFixedCouponWrap.classList.toggle("d-none", isStepUp);
  hdStepUpSection.classList.toggle("d-none", !isStepUp);
  const isAmortizable = hdBondType.value === "amortizable";
  hdAmortizationSection.classList.toggle("d-none", !isAmortizable);

  if (!isStepUp) {
    hdStepUpRows.innerHTML = "";
  } else {
    const years = hardDollarYearLabels();
    if (!years.length) {
      hdStepUpRows.innerHTML = '<span class="empty-cell">Completa emision y vencimiento para abrir los años.</span>';
    } else {
      hdStepUpRows.innerHTML = years.map((year) => `
        <label>
          <span>${year}</span>
          <input class="form-control form-control-sm" type="number" step="0.0001" data-hd-step-year="${year}">
        </label>
      `).join("");
      hdStepUpRows.querySelectorAll("input[data-hd-step-year]").forEach((input) => {
        input.addEventListener("input", refreshHdCouponRates);
      });
    }
  }
  refreshHdCouponRates();
}

function hardDollarYearLabels() {
  if (!hdIssueDate.value || !hdMaturityDate.value) return [];
  const start = new Date(`${hdIssueDate.value}T00:00:00`);
  const end = new Date(`${hdMaturityDate.value}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return [];

  const labels = [];
  let cursor = start.getFullYear();
  while (cursor <= end.getFullYear()) {
    labels.push(String(cursor));
    cursor += 1;
  }
  return labels;
}

function getHdAnnualRateForYear(year) {
  const isStepUp = hdCouponType.value === "step_up";
  if (!isStepUp) {
    return parseFloat(hdFixedCoupon.value) || 0;
  }
  const input = hdStepUpRows.querySelector(`input[data-hd-step-year="${year}"]`);
  if (!input || input.value === "") return 0;
  return parseFloat(input.value) || 0;
}

function refreshHdCouponRates() {
  if (!hdCoupons.length) return;
  hdCoupons = hdCoupons.map((coupon) => ({
    ...coupon,
    annual_rate_percent: getHdAnnualRateForYear(coupon.payment_date.slice(0, 4)),
  }));
  renderHdCouponsTable();
}

async function generateHdSchedule() {
  if (!hdIssueDate.value || !hdMaturityDate.value) {
    setHdStatus("error", "Completa fechas de emision y vencimiento");
    return;
  }
  setHdStatus("draft", "Generando cupones...");
  try {
    const response = await fetch("/api/calculators/bond-hd/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        issue_date: hdIssueDate.value,
        maturity_date: hdMaturityDate.value,
        frequency: hdFrequency.value,
      }),
    });
    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      throw new Error(detail.detail || "No se pudo generar la tabla de cupones");
    }
    const payload = await response.json();
    hdCoupons = (payload.payment_dates || []).map((paymentDate) => ({
      payment_date: paymentDate,
      annual_rate_percent: getHdAnnualRateForYear(paymentDate.slice(0, 4)),
      amortization_percent: 0,
    }));
    applyAmortizationDefaults();
    renderHdCouponsTable();
    hdCouponsSection.classList.remove("d-none");
    hdCalculate.disabled = hdCoupons.length === 0;
    setHdStatus("ok", `Generados ${hdCoupons.length} cupones`);
  } catch (error) {
    setHdStatus("error", error.message || "Error al generar cupones");
  }
}

function applyAmortizationDefaults() {
  if (hdBondType.value !== "amortizable" || !hdCoupons.length) return;
  const start = Math.max(1, parseInt(hdAmortStart.value, 10) || 1);
  const count = Math.max(1, parseInt(hdAmortCount.value, 10) || 1);
  hdCoupons = hdCoupons.map((coupon, index) => {
    const number = index + 1;
    const inWindow = number >= start && number < start + count;
    return {
      ...coupon,
      amortization_percent: inWindow ? 100 / count : 0,
    };
  });
}

function distributeAmortization() {
  if (!hdCoupons.length) {
    setHdStatus("error", "Primero genera la tabla de cupones");
    return;
  }
  applyAmortizationDefaults();
  renderHdCouponsTable();
  setHdStatus("ok", "Amortizacion distribuida");
}

function renderHdCouponsTable() {
  if (!hdCoupons.length) {
    hdCouponsBody.innerHTML = '<tr><td colspan="4" class="empty-state">Generar tabla con la frecuencia elegida</td></tr>';
    return;
  }
  const isAmort = hdBondType.value === "amortizable";
  hdCouponsBody.innerHTML = hdCoupons.map((coupon, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>
        <div class="hd-date-cell">
          <input type="date" lang="es-AR" class="form-control form-control-sm" data-hd-coupon-date="${index}" value="${coupon.payment_date}">
          <small class="hd-date-display" data-hd-coupon-display="${index}">${formatDateDisplay(coupon.payment_date)}</small>
        </div>
      </td>
      <td class="text-end">
        <input type="number" step="0.0001" class="form-control form-control-sm text-end" data-hd-coupon-rate="${index}" value="${coupon.annual_rate_percent}">
      </td>
      <td class="text-end">
        <input type="number" step="0.0001" min="0" class="form-control form-control-sm text-end" data-hd-coupon-amort="${index}" value="${coupon.amortization_percent}" ${isAmort ? "" : "disabled"}>
      </td>
    </tr>
  `).join("");

  hdCouponsBody.querySelectorAll("input[data-hd-coupon-date]").forEach((input) => {
    input.addEventListener("change", (event) => {
      const idx = parseInt(event.target.dataset.hdCouponDate, 10);
      hdCoupons[idx].payment_date = event.target.value;
      hdCoupons[idx].annual_rate_percent = getHdAnnualRateForYear(event.target.value.slice(0, 4));
      const displayCell = hdCouponsBody.querySelector(`[data-hd-coupon-display="${idx}"]`);
      if (displayCell) displayCell.textContent = formatDateDisplay(event.target.value);
    });
  });
  hdCouponsBody.querySelectorAll("input[data-hd-coupon-rate]").forEach((input) => {
    input.addEventListener("input", (event) => {
      const idx = parseInt(event.target.dataset.hdCouponRate, 10);
      hdCoupons[idx].annual_rate_percent = parseFloat(event.target.value) || 0;
    });
  });
  hdCouponsBody.querySelectorAll("input[data-hd-coupon-amort]").forEach((input) => {
    input.addEventListener("input", (event) => {
      const idx = parseInt(event.target.dataset.hdCouponAmort, 10);
      hdCoupons[idx].amortization_percent = parseFloat(event.target.value) || 0;
    });
  });
}

async function calculateHdCashflow() {
  if (!hdCoupons.length) {
    setHdStatus("error", "Generar la tabla de cupones primero");
    return;
  }
  if (!hdIssueDate.value || !hdMaturityDate.value || !hdFaceValue.value) {
    setHdStatus("error", "Completa emision, vencimiento y VNO");
    return;
  }
  setHdStatus("draft", "Calculando...");
  const lastIndex = hdCoupons.length - 1;
  const adjustedCoupons = hdCoupons.map((coupon, index) => ({
    payment_date: index === lastIndex ? hdMaturityDate.value : coupon.payment_date,
    annual_rate_percent: coupon.annual_rate_percent,
    amortization_percent: coupon.amortization_percent,
  }));
  try {
    const response = await fetch("/api/calculators/bond-hd", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        issue_date: hdIssueDate.value,
        maturity_date: hdMaturityDate.value,
        face_value: parseFloat(hdFaceValue.value),
        bond_type: hdBondType.value,
        frequency: hdFrequency.value,
        convention: hdConvention.value,
        coupons: adjustedCoupons,
      }),
    });
    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      throw new Error(typeof detail.detail === "string" ? detail.detail : "No se pudo calcular el cashflow");
    }
    hdLastCalculation = await response.json();
    renderHdCashflowTable(hdLastCalculation);
    setHdStatus("ok", "Cashflow calculado");
  } catch (error) {
    setHdStatus("error", error.message || "Error al calcular");
  }
}

function renderHdCashflowTable(payload) {
  const cashflows = (payload && payload.cashflows) || [];
  if (!cashflows.length) {
    hdCashflowBody.innerHTML = '<tr><td colspan="10" class="empty-state">Sin cashflow para mostrar</td></tr>';
    return;
  }
  hdCashflowBody.innerHTML = cashflows.map((row) => `
    <tr>
      <td>${row.number}</td>
      <td>${formatDate(row.payment_date)}</td>
      <td>${formatDate(row.effective_payment_date)}</td>
      <td class="text-end">${formatNumber(row.amortization_vn_percent, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}%</td>
      <td class="text-end">${formatNumber(row.residual_vn_percent, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}%</td>
      <td class="text-end">${formatNumber(row.annual_rate_percent, { minimumFractionDigits: 4, maximumFractionDigits: 4 })}%</td>
      <td class="text-end">${formatNumber(row.period_rate_percent, { minimumFractionDigits: 4, maximumFractionDigits: 4 })}%</td>
      <td class="text-end">${formatNumber(row.amortization_per_100, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
      <td class="text-end">${formatNumber(row.interest_per_100, { minimumFractionDigits: 4, maximumFractionDigits: 4 })}</td>
      <td class="text-end">${formatNumber(row.total_per_100, { minimumFractionDigits: 4, maximumFractionDigits: 4 })}</td>
    </tr>
  `).join("");
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

async function fetchTplusAutoRate() {
  if (!tplusAutoRate.checked) return null;
  const payload = await fetchRates();
  const quote = payload.shortest || payload.quote || {};
  const last = quote.last;
  if (last !== null && last !== undefined && last !== "") {
    tplusRate.value = String(last);
    setTplusStatus("ok", "Tasa automatica");
  } else {
    setTplusStatus("error", "Sin caucion");
  }
  return payload;
}

async function fetchRates() {
  const response = await fetch("/api/market/cauciones");
  if (!response.ok) throw new Error("No se pudieron leer cauciones");
  const payload = await response.json();
  renderRates(payload);
  return payload;
}

function renderRates(payload) {
  const items = payload.items || [];
  const quote = payload.shortest || payload.quote || items[0] || {};
  const last = quote.last;
  ratesLast.innerHTML = formatPercent(last !== null && last !== undefined ? last / 100 : null, 2);
  ratesTerm.textContent = quote.term_days ? `${formatNumber(quote.term_days)} dias` : "-";
  ratesUpdatedAt.innerHTML = formatTime(quote.updated_at || payload.updated_at);

  if (!items.length) {
    ratesBody.innerHTML = '<tr><td colspan="6" class="empty-state">Sin cauciones detectadas</td></tr>';
    return;
  }

  ratesBody.innerHTML = items.map((item) => `
    <tr>
      <td class="ticker">${item.symbol}</td>
      <td>${item.provider_symbol || item.label || "-"}</td>
      <td class="text-end">${formatNumber(item.bid, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
      <td class="text-end">${formatNumber(item.ask, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
      <td class="text-end">${formatNumber(item.last, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
      <td class="text-end">${formatNumber(item.volume)}</td>
    </tr>
  `).join("");
}

async function calculateTplus() {
  const price = Number(tplusPrice.value);
  const rate = Number(tplusRate.value);
  tplusRate.disabled = tplusAutoRate.checked;

  if (!price || price <= 0) {
    tplusDays.textContent = "-";
    tplusNextBusinessDay.textContent = "-";
    tplusOutput.textContent = "-";
    return;
  }

  const body = {
    direction: tplusDirection.value,
    price,
    use_auto_rate: tplusAutoRate.checked,
    rate_percent: tplusAutoRate.checked ? null : rate,
  };

  if (!body.use_auto_rate && (!Number.isFinite(rate) || rate === 0)) {
    setTplusStatus("error", "Revisar tasa");
    return;
  }

  const response = await fetch("/api/tools/tplus-conversion", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    setTplusStatus("error", "Sin calculo");
    return;
  }

  const payload = await response.json();
  tplusDays.textContent = formatNumber(payload.calendar_days);
  tplusNextBusinessDay.textContent = formatDate(payload.next_business_day);
  tplusOutput.innerHTML = formatNumber(payload.converted_price, {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  });
  tplusRate.value = String(payload.rate_percent);
  setTplusStatus("ok", payload.rate_source === "auto" ? "Tasa automatica" : "Manual");
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
  if (currentBondModel !== "lecap") return;
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

tplusForm.addEventListener("submit", (event) => event.preventDefault());
tplusDirection.addEventListener("change", () => calculateTplus().catch(() => setTplusStatus("error", "Sin calculo")));
tplusPrice.addEventListener("input", () => calculateTplus().catch(() => setTplusStatus("error", "Sin calculo")));
tplusRate.addEventListener("input", () => {
  if (!tplusAutoRate.checked) {
    calculateTplus().catch(() => setTplusStatus("error", "Sin calculo"));
  }
});
tplusAutoRate.addEventListener("change", () => {
  tplusRate.disabled = tplusAutoRate.checked;
  const next = tplusAutoRate.checked ? fetchTplusAutoRate().then(calculateTplus) : calculateTplus();
  next.catch(() => setTplusStatus("error", "Sin caucion"));
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

document.querySelectorAll("[data-dual-model]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-dual-model]").forEach((candidate) => {
      const active = candidate === button;
      candidate.classList.toggle("active", active);
      candidate.classList.toggle("btn-dark", active);
      candidate.classList.toggle("btn-outline-dark", !active);
    });
    setCalculatorStatus("draft", `DUAL ${button.textContent.trim()}`);
  });
});

historicalSeries.addEventListener("click", (event) => {
  const button = event.target.closest("[data-historical-series]");
  if (!button) return;
  const item = historicalSeriesFromKey(button.dataset.historicalSeries);
  if (!item) return;
  toggleHistoricalSeries(item).catch(() => setHistoricalStatus("error", "No se pudo leer la serie"));
});

historicalSeriesSearch.addEventListener("input", renderHistoricalSeries);
historicalDownload.addEventListener("click", downloadActiveHistoricalSeries);

bcraRefresh.addEventListener("click", () => {
  fetchBcraSeries(true).catch(() => {
    bcraBody.innerHTML = '<tr><td colspan="3" class="empty-state">No se pudieron actualizar datos BCRA</td></tr>';
  });
});

ratesRefresh.addEventListener("click", () => {
  fetchRates().catch(() => {
    ratesBody.innerHTML = '<tr><td colspan="6" class="empty-state">No se pudo actualizar caucion</td></tr>';
  });
});

bondDraftForm.addEventListener("submit", submitBondDraft);
historicalForm.addEventListener("submit", saveHistoricalData);
historicalUploadForm.addEventListener("submit", uploadHistoricalData);
hardDollarForm?.addEventListener("submit", (event) => event.preventDefault());
hdIssueDate?.addEventListener("change", renderHardDollarCouponInputs);
hdMaturityDate?.addEventListener("change", renderHardDollarCouponInputs);
hdCouponType?.addEventListener("change", renderHardDollarCouponInputs);
hdBondType?.addEventListener("change", () => {
  renderHardDollarCouponInputs();
  if (hdBondType.value === "amortizable") {
    applyAmortizationDefaults();
  } else {
    hdCoupons = hdCoupons.map((coupon) => ({ ...coupon, amortization_percent: 0 }));
  }
  renderHdCouponsTable();
});
hdFixedCoupon?.addEventListener("input", refreshHdCouponRates);
hdGenerateSchedule?.addEventListener("click", () => {
  console.log("[Bono HD] click generar tabla");
  generateHdSchedule().catch((err) => {
    console.error("[Bono HD] generar tabla fallo", err);
    setHdStatus("error", "Error al generar cupones");
  });
});
hdAmortDistribute?.addEventListener("click", distributeAmortization);
hdAmortStart?.addEventListener("input", () => {
  if (hdBondType.value === "amortizable") {
    applyAmortizationDefaults();
    renderHdCouponsTable();
  }
});
hdAmortCount?.addEventListener("input", () => {
  if (hdBondType.value === "amortizable") {
    applyAmortizationDefaults();
    renderHdCouponsTable();
  }
});
hdCalculate?.addEventListener("click", () => {
  console.log("[Bono HD] click calcular");
  calculateHdCashflow().catch((err) => {
    console.error("[Bono HD] calcular fallo", err);
    setHdStatus("error", "Error al calcular");
  });
});

if (!hdGenerateSchedule || !hdCalculate) {
  console.warn("[Bono HD] elementos de la calculadora no encontrados; revisa que index.html esté actualizado y limpia cache.");
}
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

tplusRate.disabled = tplusAutoRate.checked;
renderQuotes();
