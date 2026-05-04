console.log("[Monitor] app.js v=hd27 cargado - HD: 'Devenga desde' visible + gracia colapsable");
const quotesBody = document.querySelector("#quotesBody");
const marketTableHead = document.querySelector("#marketTableHead");
const fxBody = document.querySelector("#fxBody");
const fxTableWrap = document.querySelector("#fxTableWrap");
const futBody = document.querySelector("#futBody");
const futTableWrap = document.querySelector("#futTableWrap");
const mainTableWrap = quotesBody ? quotesBody.closest(".table-wrap") : null;
const sourceLabel = document.querySelector("#sourceLabel");
const updatedAt = document.querySelector("#updatedAt");
const instrumentCount = document.querySelector("#instrumentCount");
const connectionDot = document.querySelector("#connectionDot");
const connectionText = document.querySelector("#connectionText");
const searchInput = document.querySelector("#searchInput");
const currencyFilter = document.querySelector("#currencyFilter");
const marketSettlementFilter = document.querySelector("#marketSettlementFilter");
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
const hdTicker = document.querySelector("#hdTicker");
const hdIssueDate = document.querySelector("#hdIssueDate");
const hdMaturityDate = document.querySelector("#hdMaturityDate");
const hdModeSwitch = document.querySelector("#hdModeSwitch");
const hdSearchPanel = document.querySelector("#hdSearchPanel");
const hdNewPanel = document.querySelector("#hdNewPanel");
const hdSearchTicker = document.querySelector("#hdSearchTicker");
const hdSearchSubmit = document.querySelector("#hdSearchSubmit");
const hdSavedList = document.querySelector("#hdSavedList");
const hdSavedDetail = document.querySelector("#hdSavedDetail");
const hdSavedDetailTitle = document.querySelector("#hdSavedDetailTitle");
const hdSavedDetailMeta = document.querySelector("#hdSavedDetailMeta");
const hdSavedDetailBody = document.querySelector("#hdSavedDetailBody");
const hdSaveCashflow = document.querySelector("#hdSaveCashflow");
const hdSaveStatus = document.querySelector("#hdSaveStatus");
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
const hdGraceSection = document.querySelector("#hdGraceSection");
const hdGraceMode = document.querySelector("#hdGraceMode");
const hdGracePeriodWrap = document.querySelector("#hdGracePeriodWrap");
const hdGracePeriod = document.querySelector("#hdGracePeriod");
const hdGraceYearWrap = document.querySelector("#hdGraceYearWrap");
const hdGraceYear = document.querySelector("#hdGraceYear");
const hdGraceMonthWrap = document.querySelector("#hdGraceMonthWrap");
const hdGraceMonth = document.querySelector("#hdGraceMonth");
const hdGraceApply = document.querySelector("#hdGraceApply");
const hdGraceStatus = document.querySelector("#hdGraceStatus");
const hdAmortFromYear = document.querySelector("#hdAmortFromYear");
const hdAmortFromPeriod = document.querySelector("#hdAmortFromPeriod");
const hdAmortPctPerPeriod = document.querySelector("#hdAmortPctPerPeriod");
const hdAmortApplyUniform = document.querySelector("#hdAmortApplyUniform");
const hdAmortYearRows = document.querySelector("#hdAmortYearRows");
const hdAmortDistribute = document.querySelector("#hdAmortDistribute");
const hdCouponsSection = document.querySelector("#hdCouponsSection");
const hdCouponsBody = document.querySelector("#hdCouponsBody");
const hdDatesFile = document.querySelector("#hdDatesFile");
const hdDatesText = document.querySelector("#hdDatesText");
const hdImportDates = document.querySelector("#hdImportDates");
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
let currentMarketCategory = "general";
let currentMarketSettlement = "t1";
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

// Caches para evitar parpadeo: las funciones de render son sincronicas
// y se pintan desde estos caches. Los pollers actualizan los caches
// y llaman a renderQuotes() cuando hay cambios.
let fxRatiosCache = null;       // null = todavia no llego, [] = sin datos, [...] = items
let fxRatiosLoadedOnce = false;
let futuresCache = null;
let futuresLoadedOnce = false;

// Track del layout actual de la tabla de mercado para no re-renderizar el header
// y poder diferenciar ediciones in place vs reemplazo total.
let currentTableLayout = "";
let lastQuotesHtml = "";        // body html anterior para no reescribir si no cambio

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

function setMarketTableLayout(layoutKey, headerHtml) {
  // Solo reescribe el header si cambia el layout. El body NO se blanquea
  // unconditionally: patchMarketBody se encarga de remover lo que no aplica
  // y de mantener firmes las filas con datos.
  if (currentTableLayout === layoutKey) return false;
  marketTableHead.innerHTML = headerHtml;
  currentTableLayout = layoutKey;
  lastQuotesHtml = "";
  // Al cambiar de layout (cantidad de columnas distinta) si o si hay que limpiar
  // las filas viejas porque sus celdas no coinciden con los headers nuevos.
  quotesBody.innerHTML = "";
  return true;
}

function writeQuotesBody(html) {
  // Solo escribe si el HTML cambia (usado SOLO para placeholder de carga / vacio).
  // NUNCA pisa filas que ya tienen data-key (datos reales): si hay filas,
  // ignoramos el placeholder asi no tapamos los valores.
  if (quotesBody.querySelector("tr[data-key]")) return;
  if (html === lastQuotesHtml) return;
  quotesBody.innerHTML = html;
  lastQuotesHtml = html;
}

// Patch del cuerpo celda por celda: NO destruye los <tr>, solo actualiza el
// textContent/innerHTML de la celda cuyo valor cambio. Asi nunca queda en
// blanco la tabla entre updates.
function patchMarketBody(rows, columns, keyOf) {
  lastQuotesHtml = ""; // invalida el cache de innerHTML
  const tbody = quotesBody;

  // 1) Quitar SOLO los nodos que sean placeholders (sin data-key), preservando
  // los <tr> existentes con datos para no parpadear.
  for (const child of Array.from(tbody.children)) {
    if (!(child.dataset && child.dataset.key)) child.remove();
  }

  // 2) Indexar filas existentes por key
  const existing = new Map();
  for (const tr of Array.from(tbody.children)) {
    existing.set(tr.dataset.key, tr);
  }

  // 3) Construir/actualizar in place
  let lastSibling = null;
  for (const row of rows) {
    const key = String(keyOf(row));
    let tr = existing.get(key);
    let isNew = false;
    if (!tr) {
      tr = document.createElement("tr");
      tr.dataset.key = key;
      for (let i = 0; i < columns.length; i++) {
        tr.appendChild(document.createElement("td"));
      }
      isNew = true;
    } else {
      existing.delete(key);
    }
    for (let i = 0; i < columns.length; i++) {
      const col = columns[i];
      const td = tr.children[i];
      const newHtml = col.html(row);
      if (td.innerHTML !== newHtml) td.innerHTML = newHtml;
      const cls = typeof col.className === "function" ? col.className(row) : (col.className || "");
      const trimmed = String(cls || "").trim();
      if (td.className !== trimmed) td.className = trimmed;
    }
    // Posicionar en orden (insertBefore mueve nodos sin recrearlos)
    const expectedAfter = lastSibling ? lastSibling.nextSibling : tbody.firstChild;
    if (tr !== expectedAfter) {
      tbody.insertBefore(tr, expectedAfter);
    }
    lastSibling = tr;
  }
  // 4) Borrar filas que ya no estan
  for (const tr of existing.values()) tr.remove();
}

function showMarketTable(which) {
  // which: "main" | "fx" | "fut"
  if (mainTableWrap) mainTableWrap.style.display = which === "main" ? "" : "none";
  if (fxTableWrap)   fxTableWrap.style.display   = which === "fx"   ? "" : "none";
  if (futTableWrap)  futTableWrap.style.display  = which === "fut"  ? "" : "none";
}

function renderQuotes() {
  if (currentMarketList === "lecaps") {
    showMarketTable("main");
    renderLecapMarket();
    return;
  }

  if (currentMarketCategory === "fx") {
    showMarketTable("fx");
    renderFxRatios();
    return;
  }

  if (currentMarketCategory === "futuros_dlk") {
    showMarketTable("fut");
    renderFuturosDlk();
    return;
  }

  showMarketTable("main");
  setMarketTableLayout("general", `
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
  `);

  const text = searchInput.value.trim().toUpperCase();
  const rows = latestQuotes.filter((quote) => {
    const currencyMatch = currentCurrency === "all" || quote.currency === currentCurrency;
    const textMatch = !text || quote.symbol.includes(text) || quote.family.includes(text);
    const categoryMatch = currentMarketCategory === "general" || quote.category === currentMarketCategory;
    return currencyMatch && textMatch && categoryMatch;
  });

  instrumentCount.textContent = latestQuotes.length;
  patchMarketBody(rows, [
    { html: (q) => q.symbol, className: "ticker" },
    { html: (q) => q.family },
    { html: (q) => `<span class="currency-pill">${q.currency}</span>` },
    { html: (q) => formatNumber(q.bid, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), className: "text-end" },
    { html: (q) => formatNumber(q.ask, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), className: "text-end" },
    { html: (q) => formatNumber(q.last, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), className: "text-end" },
    {
      html: (q) => formatNumber(q.change, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      className: (q) => "text-end " + (q.change > 0 ? "positive" : q.change < 0 ? "negative" : ""),
    },
    { html: (q) => formatNumber(q.volume), className: "text-end" },
    { html: (q) => formatPercent(q.ytm, 2), className: "text-end" },
    { html: (q) => formatTime(q.updated_at), className: "text-end" },
  ], (q) => q.symbol);
}

// Tabla FX: filas y celdas se crean UNA sola vez y se guardan referencias.
// Despues solo se modifica td.textContent. NUNCA innerHTML, NUNCA blanqueo.
const fxRowRefs = new Map(); // key -> { tr, cells: {ars, fx, ratio, time} }

function fxFormatNum(value, dec) {
  if (value === null || value === undefined || value === "") return "s/d";
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  }).format(value);
}
function fxFormatTime(value) {
  if (!value) return "s/d";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleTimeString("es-AR", {
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    timeZone: "America/Argentina/Buenos_Aires",
  });
}

function ensureFxRow(name, label) {
  let ref = fxRowRefs.get(name);
  if (ref) return ref;
  const tr = document.createElement("tr");
  tr.dataset.key = name;
  const tdName = document.createElement("td");
  tdName.innerHTML = `<strong>${name}</strong>`;
  const tdLabel = document.createElement("td");
  tdLabel.textContent = label || "";
  const tdArs = document.createElement("td");  tdArs.className = "text-end";  tdArs.textContent = "s/d";
  const tdFx = document.createElement("td");   tdFx.className = "text-end";   tdFx.textContent = "s/d";
  const tdRatio = document.createElement("td"); tdRatio.className = "text-end";
  const ratioStrong = document.createElement("strong");
  ratioStrong.textContent = "s/d";
  tdRatio.appendChild(ratioStrong);
  const tdTime = document.createElement("td"); tdTime.className = "text-end"; tdTime.textContent = "s/d";
  tr.append(tdName, tdLabel, tdArs, tdFx, tdRatio, tdTime);
  fxBody.appendChild(tr);
  ref = { tr, label: tdLabel, cells: { ars: tdArs, fx: tdFx, ratioStrong, time: tdTime } };
  fxRowRefs.set(name, ref);
  return ref;
}

// Pre-seed las dos filas conocidas asi la tabla NUNCA esta vacia.
function seedFxRows() {
  ensureFxRow("AL30/AL30D", "MEP");
  ensureFxRow("AL30/AL30C", "CCL");
}

function renderFxRatios() {
  // Garantia de que las filas existen siempre (no depende de cache).
  if (!fxRowRefs.size) seedFxRows();
  if (!fxRatiosCache || !fxRatiosCache.length) return;

  for (const item of fxRatiosCache) {
    const ref = ensureFxRow(item.name, item.label);
    if (item.label && ref.label.textContent !== item.label) ref.label.textContent = item.label;
    const ars = fxFormatNum(item.ars_last, 4);
    const fx = fxFormatNum(item.fx_last, 4);
    const ratio = fxFormatNum(item.ratio, 4);
    const time = fxFormatTime(item.updated_at);
    if (ref.cells.ars.textContent !== ars) ref.cells.ars.textContent = ars;
    if (ref.cells.fx.textContent !== fx) ref.cells.fx.textContent = fx;
    if (ref.cells.ratioStrong.textContent !== ratio) ref.cells.ratioStrong.textContent = ratio;
    if (ref.cells.time.textContent !== time) ref.cells.time.textContent = time;
  }
}

// Tabla Futuros y DLK: misma estrategia que FX.
const futRowRefs = new Map(); // key -> { tr, cells: {tipo, venc, bid, ask, last, change, volume, time} }

function ensureFutRow(symbol) {
  let ref = futRowRefs.get(symbol);
  if (ref) return ref;
  const tr = document.createElement("tr");
  tr.dataset.key = symbol;
  const tdSym = document.createElement("td");
  tdSym.innerHTML = `<strong>${symbol}</strong>`;
  const tdTipo = document.createElement("td"); tdTipo.textContent = "-";
  const tdVenc = document.createElement("td"); tdVenc.textContent = "-";
  const tdBid = document.createElement("td");  tdBid.className = "text-end";  tdBid.textContent = "s/d";
  const tdAsk = document.createElement("td");  tdAsk.className = "text-end";  tdAsk.textContent = "s/d";
  const tdLast = document.createElement("td"); tdLast.className = "text-end"; tdLast.textContent = "s/d";
  const tdChg = document.createElement("td");  tdChg.className = "text-end";  tdChg.textContent = "s/d";
  const tdVol = document.createElement("td");  tdVol.className = "text-end";  tdVol.textContent = "s/d";
  const tdTime = document.createElement("td"); tdTime.className = "text-end"; tdTime.textContent = "s/d";
  tr.append(tdSym, tdTipo, tdVenc, tdBid, tdAsk, tdLast, tdChg, tdVol, tdTime);
  futBody.appendChild(tr);
  ref = { tr, cells: { tipo: tdTipo, venc: tdVenc, bid: tdBid, ask: tdAsk, last: tdLast, chg: tdChg, vol: tdVol, time: tdTime } };
  futRowRefs.set(symbol, ref);
  return ref;
}

function seedFutRows() {
  // DLK siempre presentes
  for (const sym of ["D30S6", "TZV26", "TZV27", "TZV28"]) {
    const ref = ensureFutRow(sym);
    ref.cells.tipo.textContent = "DLK";
  }
}

function applyFutRow(row) {
  const ref = ensureFutRow(row.symbol);
  if (ref.cells.tipo.textContent !== row.tipo) ref.cells.tipo.textContent = row.tipo;
  if (ref.cells.venc.textContent !== row.venc) ref.cells.venc.textContent = row.venc;
  const bidTxt = fxFormatNum(row.bid, 4);
  const askTxt = fxFormatNum(row.ask, 4);
  const lastTxt = fxFormatNum(row.last, 4);
  const chgTxt = (row.change === null || row.change === undefined) ? "s/d" : `${fxFormatNum(row.change, 2)}%`;
  const volTxt = (row.volume === null || row.volume === undefined) ? "s/d" : new Intl.NumberFormat("es-AR").format(row.volume);
  const timeTxt = fxFormatTime(row.updated_at);
  const chgCls = "text-end " + (row.change > 0 ? "positive" : row.change < 0 ? "negative" : "");
  if (ref.cells.bid.textContent !== bidTxt) ref.cells.bid.textContent = bidTxt;
  if (ref.cells.ask.textContent !== askTxt) ref.cells.ask.textContent = askTxt;
  if (ref.cells.last.textContent !== lastTxt) ref.cells.last.textContent = lastTxt;
  if (ref.cells.chg.textContent !== chgTxt) ref.cells.chg.textContent = chgTxt;
  if (ref.cells.chg.className !== chgCls) ref.cells.chg.className = chgCls;
  if (ref.cells.vol.textContent !== volTxt) ref.cells.vol.textContent = volTxt;
  if (ref.cells.time.textContent !== timeTxt) ref.cells.time.textContent = timeTxt;
}

function renderFuturosDlk() {
  if (!futRowRefs.size) seedFutRows();

  const dlkRows = latestQuotes
    .filter((q) => q.category === "dlk")
    .map((q) => ({
      symbol: q.symbol, tipo: "DLK", venc: "-",
      bid: q.bid, ask: q.ask, last: q.last, change: q.change,
      volume: q.volume, updated_at: q.updated_at,
    }));
  const futuresRows = (futuresCache || []).map((q) => ({
    symbol: q.symbol,
    tipo: q.underlying ? `Futuro ${q.underlying}` : "Futuro",
    venc: q.expiration ? String(q.expiration).slice(0, 10) : "-",
    bid: q.bid, ask: q.ask, last: q.last, change: q.change,
    volume: q.volume, updated_at: q.updated_at,
  }));

  for (const row of dlkRows) applyFutRow(row);
  for (const row of futuresRows) applyFutRow(row);
}

async function pollFxRatios() {
  try {
    const response = await fetch("/api/fx/ratios");
    if (!response.ok) throw new Error("ratios");
    const payload = await response.json();
    fxRatiosCache = payload.items || [];
  } catch (_) {
    if (fxRatiosCache === null) fxRatiosCache = [];
  } finally {
    fxRatiosLoadedOnce = true;
    if (currentMarketCategory === "fx" && currentMarketList !== "lecaps") {
      renderFxRatios();
    }
  }
}

async function pollFutures() {
  try {
    const response = await fetch("/api/futures");
    if (!response.ok) throw new Error("futures");
    const payload = await response.json();
    futuresCache = payload.items || [];
  } catch (_) {
    if (futuresCache === null) futuresCache = [];
  } finally {
    futuresLoadedOnce = true;
    if (currentMarketCategory === "futuros_dlk" && currentMarketList !== "lecaps") {
      renderFuturosDlk();
    }
  }
}

function renderLecapMarket() {
  setMarketTableLayout("lecap", `
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
  `);

  const text = searchInput.value.trim().toUpperCase();
  const rows = latestLecapMarket.filter((item) => !text || item.ticker.includes(text));
  instrumentCount.textContent = rows.length;

  if (!rows.length) {
    writeQuotesBody('<tr><td colspan="16" class="empty-state">Sin LECAPs guardadas para mostrar</td></tr>');
    return;
  }

  patchMarketBody(rows, [
    { html: (it) => it.ticker, className: "ticker" },
    { html: (it) => formatDate(it.maturity_date) },
    { html: (it) => formatDate(it.effective_payment_date) },
    { html: (it) => formatNumber(it.days_to_payment), className: "text-end" },
    { html: (it) => formatNumber(it.bid, { minimumFractionDigits: 3, maximumFractionDigits: 3 }), className: "text-end" },
    { html: (it) => formatNumber(it.offer, { minimumFractionDigits: 3, maximumFractionDigits: 3 }), className: "text-end" },
    { html: (it) => formatNumber(it.last, { minimumFractionDigits: 3, maximumFractionDigits: 3 }), className: "text-end" },
    { html: (it) => formatPercent(it.tna_bid, 2), className: "text-end" },
    { html: (it) => formatPercent(it.tna_offer, 2), className: "text-end" },
    { html: (it) => formatPercent(it.tna_last, 2), className: "text-end" },
    { html: (it) => formatPercent(it.tir_last, 2), className: "text-end" },
    { html: (it) => formatPercent(it.tem_last, 2), className: "text-end" },
    { html: (it) => formatNumber(it.duration, { minimumFractionDigits: 4, maximumFractionDigits: 4 }), className: "text-end" },
    { html: (it) => formatNumber(it.modified_duration, { minimumFractionDigits: 4, maximumFractionDigits: 4 }), className: "text-end" },
    { html: (it) => formatNumber(it.convexity, { minimumFractionDigits: 4, maximumFractionDigits: 4 }), className: "text-end" },
    { html: (it) => formatTime(it.updated_at), className: "text-end" },
  ], (it) => it.ticker);
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
    setHdMode("search");
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
let hdAnnualAmortByYear = {};
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

function parseDdmmYyyy(text) {
  if (!text) return null;
  const trimmed = String(text).trim().replace(/-/g, "/");
  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const year = parseInt(match[3], 10);
  if (day < 1 || day > 31 || month < 1 || month > 12 || year < 1900) return null;
  const probe = new Date(year, month - 1, day);
  if (probe.getFullYear() !== year || probe.getMonth() !== month - 1 || probe.getDate() !== day) {
    return null;
  }
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

function isoToDdmmYyyy(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function attachDdmmAutoformat(input) {
  if (!input) return;
  input.addEventListener("input", (event) => {
    const target = event.target;
    const digits = target.value.replace(/\D/g, "").slice(0, 8);
    let formatted = digits;
    if (digits.length > 4) {
      formatted = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    } else if (digits.length > 2) {
      formatted = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    }
    if (target.value !== formatted) {
      target.value = formatted;
    }
  });
  input.addEventListener("blur", (event) => {
    const iso = parseDdmmYyyy(event.target.value);
    if (iso) {
      event.target.value = isoToDdmmYyyy(iso);
      event.target.classList.remove("is-invalid");
    } else if (event.target.value.trim() !== "") {
      event.target.classList.add("is-invalid");
    } else {
      event.target.classList.remove("is-invalid");
    }
  });
}

function getHdIssueIso() { return parseDdmmYyyy(hdIssueDate?.value); }
function getHdMaturityIso() { return parseDdmmYyyy(hdMaturityDate?.value); }

function normalizeFamilyTicker(value) {
  const ticker = String(value || "").toUpperCase().trim();
  if (ticker.length > 1 && (ticker.endsWith("D") || ticker.endsWith("C")) && /\d/.test(ticker.slice(0, -1))) {
    return ticker.slice(0, -1);
  }
  return ticker;
}

function setHdSaveStatus(kind, text) {
  if (!hdSaveStatus) return;
  hdSaveStatus.dataset.kind = kind;
  hdSaveStatus.textContent = text;
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
  const issueIso = getHdIssueIso();
  const maturityIso = getHdMaturityIso();
  if (!issueIso || !maturityIso) return [];
  const start = new Date(`${issueIso}T00:00:00`);
  const end = new Date(`${maturityIso}T00:00:00`);
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

// Periodo de gracia: marca cupones anteriores al "primer flujo que paga" como
// in_grace=true y setea su annual_rate_percent en 0.
let hdGraceConfig = { mode: "none", first_period_index: null };

function findFirstPaymentIndex() {
  const mode = hdGraceMode?.value || "none";
  if (mode === "none" || !hdCoupons.length) return 0;
  if (mode === "period") {
    const idx = parseInt(hdGracePeriod?.value, 10);
    if (!Number.isFinite(idx)) return 0;
    return Math.max(0, Math.min(idx, hdCoupons.length - 1));
  }
  if (mode === "year") {
    const targetYear = String(hdGraceYear?.value || "");
    if (!targetYear) return 0;
    const found = hdCoupons.findIndex((c) => c.payment_date && c.payment_date.slice(0, 4) >= targetYear);
    return found === -1 ? hdCoupons.length : found;
  }
  if (mode === "year_month") {
    const targetYear = String(hdGraceYear?.value || "");
    const targetMonth = parseInt(hdGraceMonth?.value, 10);
    if (!targetYear || !Number.isFinite(targetMonth)) return 0;
    const targetKey = `${targetYear}-${String(targetMonth).padStart(2, "0")}`;
    const found = hdCoupons.findIndex((c) => c.payment_date && c.payment_date.slice(0, 7) >= targetKey);
    return found === -1 ? hdCoupons.length : found;
  }
  return 0;
}

function applyHdGracePeriod() {
  if (!hdCoupons.length) return;
  const firstIdx = findFirstPaymentIndex();
  hdGraceConfig = { mode: hdGraceMode?.value || "none", first_period_index: firstIdx };
  hdCoupons = hdCoupons.map((coupon, index) => {
    const inGrace = index < firstIdx;
    const yearRate = coupon.payment_date ? getHdAnnualRateForYear(coupon.payment_date.slice(0, 4)) : 0;
    return {
      ...coupon,
      in_grace: inGrace,
      annual_rate_percent: inGrace ? 0 : yearRate,
    };
  });
  if (hdGraceStatus) {
    if (firstIdx === 0) {
      hdGraceStatus.textContent = "Sin gracia (paga desde flujo 1)";
    } else {
      hdGraceStatus.textContent = `${firstIdx} flujos en gracia, primer pago en flujo ${firstIdx + 1}`;
    }
  }
  renderHdCouponsTable();
}

function renderHdGraceControls() {
  if (!hdGraceSection) return;
  if (!hdCoupons.length) {
    hdGraceSection.classList.add("d-none");
    return;
  }
  hdGraceSection.classList.remove("d-none");

  // Poblar select de "primer flujo que paga"
  if (hdGracePeriod) {
    hdGracePeriod.innerHTML = hdCoupons.map((c, i) =>
      `<option value="${i}">Flujo ${i + 1} - ${formatDateDisplay(c.payment_date)}</option>`
    ).join("");
  }
  // Poblar select de "primer año"
  if (hdGraceYear) {
    const years = getHdYearsFromCoupons();
    const currentYear = hdGraceYear.value;
    hdGraceYear.innerHTML = years
      .map((y) => `<option value="${y}" ${y === currentYear ? "selected" : ""}>${y}</option>`)
      .join("");
  }
  // Mostrar/ocultar inputs segun modo
  const mode = hdGraceMode?.value || "none";
  hdGracePeriodWrap?.classList.toggle("d-none", mode !== "period");
  hdGraceYearWrap?.classList.toggle("d-none", mode !== "year" && mode !== "year_month");
  hdGraceMonthWrap?.classList.toggle("d-none", mode !== "year_month");
}

function refreshHdCouponRates() {
  if (!hdCoupons.length) return;
  hdCoupons = hdCoupons.map((coupon) => ({
    ...coupon,
    annual_rate_percent: coupon.in_grace ? 0 : getHdAnnualRateForYear(coupon.payment_date.slice(0, 4)),
  }));
  recomputePeriodAmortizations();
  renderHdCouponsTable();
}

async function generateHdSchedule() {
  const issueIso = getHdIssueIso();
  const maturityIso = getHdMaturityIso();
  if (!issueIso || !maturityIso) {
    setHdStatus("error", "Completa emision y vencimiento como DD/MM/AAAA");
    return;
  }
  setHdStatus("draft", "Generando cupones...");
  try {
    const response = await fetch("/api/calculators/bond-hd/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        issue_date: issueIso,
        maturity_date: maturityIso,
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
      in_grace: false,
    }));
    renderHdAnnualAmortRows();
    recomputePeriodAmortizations();
    renderHdGraceControls();
    applyHdGracePeriod();
    renderHdCouponsTable();
    hdCouponsSection.classList.remove("d-none");
    hdCalculate.disabled = hdCoupons.length === 0;
    setHdStatus("ok", `Generados ${hdCoupons.length} cupones`);
  } catch (error) {
    setHdStatus("error", error.message || "Error al generar cupones");
  }
}

function getHdYearsFromCoupons() {
  const years = new Set();
  for (const coupon of hdCoupons) {
    if (coupon.payment_date) years.add(coupon.payment_date.slice(0, 4));
  }
  return Array.from(years).sort();
}

function recomputePeriodAmortizations() {
  if (!hdCoupons.length) return;
  if (hdBondType.value !== "amortizable") {
    hdCoupons = hdCoupons.map((coupon) => ({ ...coupon, amortization_percent: 0 }));
    return;
  }
  const countByYear = {};
  for (const coupon of hdCoupons) {
    if (!coupon.payment_date) continue;
    const year = coupon.payment_date.slice(0, 4);
    countByYear[year] = (countByYear[year] || 0) + 1;
  }
  hdCoupons = hdCoupons.map((coupon) => {
    const year = coupon.payment_date ? coupon.payment_date.slice(0, 4) : "";
    const annualPercent = hdAnnualAmortByYear[year] || 0;
    const periodsInYear = countByYear[year] || 1;
    return { ...coupon, amortization_percent: annualPercent / periodsInYear };
  });
}

function getHdPeriodIndicesForYear(year) {
  const indices = [];
  hdCoupons.forEach((coupon, index) => {
    if (coupon.payment_date && coupon.payment_date.startsWith(year)) {
      indices.push(index);
    }
  });
  return indices;
}

function refreshHdAmortFromPeriodOptions() {
  if (!hdAmortFromPeriod || !hdAmortFromYear) return;
  const year = hdAmortFromYear.value;
  if (!year) {
    hdAmortFromPeriod.innerHTML = "";
    return;
  }
  const indices = getHdPeriodIndicesForYear(year);
  hdAmortFromPeriod.innerHTML = indices.map((globalIdx, localIdx) => {
    const coupon = hdCoupons[globalIdx];
    return `<option value="${globalIdx}">Periodo ${localIdx + 1} - ${formatDateDisplay(coupon.payment_date)}</option>`;
  }).join("");
}

function renderHdAnnualAmortRows() {
  if (!hdAmortYearRows || !hdAmortFromYear) return;
  const years = getHdYearsFromCoupons();
  if (!years.length) {
    hdAmortYearRows.innerHTML = '<span class="empty-cell">Generar la tabla de cupones primero.</span>';
    hdAmortFromYear.innerHTML = "";
    if (hdAmortFromPeriod) hdAmortFromPeriod.innerHTML = "";
    return;
  }
  const currentFrom = hdAmortFromYear.value;
  hdAmortFromYear.innerHTML = years
    .map((year) => `<option value="${year}" ${year === currentFrom ? "selected" : ""}>${year}</option>`)
    .join("");
  if (!hdAmortFromYear.value) hdAmortFromYear.value = years[0];
  refreshHdAmortFromPeriodOptions();

  for (const year of years) {
    if (!(year in hdAnnualAmortByYear)) hdAnnualAmortByYear[year] = 0;
  }
  Object.keys(hdAnnualAmortByYear).forEach((year) => {
    if (!years.includes(year)) delete hdAnnualAmortByYear[year];
  });

  hdAmortYearRows.innerHTML = years.map((year) => `
    <label>
      <span>${year}</span>
      <input class="form-control form-control-sm" type="number" step="0.0001" min="0" data-hd-amort-year="${year}" value="${(hdAnnualAmortByYear[year] || 0).toFixed(4)}">
    </label>
  `).join("");

  hdAmortYearRows.querySelectorAll("input[data-hd-amort-year]").forEach((input) => {
    input.addEventListener("input", (event) => {
      const year = event.target.dataset.hdAmortYear;
      hdAnnualAmortByYear[year] = parseFloat(event.target.value) || 0;
      recomputePeriodAmortizations();
      renderHdCouponsTable();
    });
  });
}

function applyUniformPctFromPeriod() {
  if (!hdCoupons.length) {
    setHdStatus("error", "Primero genera la tabla de cupones");
    return;
  }
  if (hdBondType.value !== "amortizable") {
    setHdStatus("error", "Disponible solo para bonos amortizables");
    return;
  }
  const fromGlobalIndex = parseInt(hdAmortFromPeriod?.value, 10);
  if (Number.isNaN(fromGlobalIndex) || fromGlobalIndex < 0 || fromGlobalIndex >= hdCoupons.length) {
    setHdStatus("error", "Periodo desde invalido");
    return;
  }
  const pct = parseFloat(hdAmortPctPerPeriod?.value);
  if (!Number.isFinite(pct) || pct < 0) {
    setHdStatus("error", "Cargar un % por periodo valido");
    hdAmortPctPerPeriod?.focus();
    return;
  }
  hdCoupons = hdCoupons.map((coupon, index) => ({
    ...coupon,
    amortization_percent: index >= fromGlobalIndex ? pct : (coupon.amortization_percent || 0),
  }));
  hdAnnualAmortByYear = {};
  for (const coupon of hdCoupons) {
    if (!coupon.payment_date) continue;
    const year = coupon.payment_date.slice(0, 4);
    hdAnnualAmortByYear[year] = (hdAnnualAmortByYear[year] || 0) + (coupon.amortization_percent || 0);
  }
  renderHdAnnualAmortRows();
  renderHdCouponsTable();
  const start = hdCoupons[fromGlobalIndex];
  const periodsAffected = hdCoupons.length - fromGlobalIndex;
  setHdStatus(
    "ok",
    `Aplicado ${pct}% a ${periodsAffected} periodos desde ${formatDateDisplay(start.payment_date)}`
  );
}

function distributeAmortization() {
  if (!hdCoupons.length) {
    setHdStatus("error", "Primero genera la tabla de cupones");
    return;
  }
  if (hdBondType.value !== "amortizable") {
    setHdStatus("error", "Distribucion solo disponible para bonos amortizables");
    return;
  }
  const fromGlobalIndex = parseInt(hdAmortFromPeriod?.value, 10);
  if (Number.isNaN(fromGlobalIndex) || fromGlobalIndex < 0 || fromGlobalIndex >= hdCoupons.length) {
    setHdStatus("error", "Periodo desde invalido");
    return;
  }
  const remaining = hdCoupons.length - fromGlobalIndex;
  const eachPerPeriod = 100 / remaining;
  hdCoupons = hdCoupons.map((coupon, index) => ({
    ...coupon,
    amortization_percent: index >= fromGlobalIndex ? eachPerPeriod : 0,
  }));
  hdAnnualAmortByYear = {};
  for (const coupon of hdCoupons) {
    if (!coupon.payment_date) continue;
    const year = coupon.payment_date.slice(0, 4);
    hdAnnualAmortByYear[year] = (hdAnnualAmortByYear[year] || 0) + coupon.amortization_percent;
  }
  renderHdAnnualAmortRows();
  renderHdCouponsTable();
  const startCoupon = hdCoupons[fromGlobalIndex];
  setHdStatus(
    "ok",
    `Amortizacion distribuida en ${remaining} cupones desde ${formatDateDisplay(startCoupon.payment_date)}`
  );
}

function renderHdCouponsTable() {
  if (!hdCoupons.length) {
    hdCouponsBody.innerHTML = '<tr><td colspan="6" class="empty-state">Generar tabla con la frecuencia elegida</td></tr>';
    return;
  }
  const issueIso = getHdIssueIso();
  hdCouponsBody.innerHTML = hdCoupons.map((coupon, index) => {
    const inGrace = coupon.in_grace === true;
    const stateBadge = inGrace
      ? '<span class="badge bg-secondary">GRACIA (no devenga)</span>'
      : '<span class="badge bg-success">PAGA</span>';
    // "Devenga desde": flujo 1 desde emision, resto desde el flujo anterior.
    let accrualFrom = "-";
    if (index === 0) {
      accrualFrom = issueIso ? formatDateDisplay(issueIso) : '<span class="empty-cell">cargar emision</span>';
    } else {
      const prev = hdCoupons[index - 1];
      accrualFrom = prev?.payment_date ? formatDateDisplay(prev.payment_date) : "-";
    }
    const accrualBadge = (index === 0 && issueIso)
      ? `<span class="hd-derived" title="Acumulado desde la emision">${accrualFrom} <small>(emision)</small></span>`
      : `<span class="hd-derived">${accrualFrom}</span>`;
    return `
    <tr class="${inGrace ? 'hd-grace-row' : ''}">
      <td>${index + 1}</td>
      <td>${accrualBadge}</td>
      <td>
        <input type="text" inputmode="numeric" maxlength="10" placeholder="DD/MM/AAAA" autocomplete="off" class="form-control form-control-sm" data-hd-coupon-date="${index}" value="${formatDateDisplay(coupon.payment_date)}">
      </td>
      <td>${stateBadge}</td>
      <td class="text-end"><span class="hd-derived" data-hd-coupon-rate-display="${index}">${formatNumber(coupon.annual_rate_percent, { minimumFractionDigits: 4, maximumFractionDigits: 4 })}%</span></td>
      <td class="text-end">
        <input type="number" step="0.0001" min="0" class="form-control form-control-sm text-end hd-amort-input" data-hd-coupon-amort="${index}" value="${(coupon.amortization_percent || 0).toFixed(4)}" ${hdBondType.value === "amortizable" ? "" : "disabled"}>
      </td>
    </tr>
  `;
  }).join("");

  hdCouponsBody.querySelectorAll("input[data-hd-coupon-date]").forEach((input) => {
    attachDdmmAutoformat(input);
    input.addEventListener("blur", (event) => {
      const idx = parseInt(event.target.dataset.hdCouponDate, 10);
      const iso = parseDdmmYyyy(event.target.value);
      if (!iso) {
        if (event.target.value.trim() === "") {
          hdCoupons[idx].payment_date = "";
        }
        return;
      }
      hdCoupons[idx].payment_date = iso;
      hdCoupons[idx].annual_rate_percent = getHdAnnualRateForYear(iso.slice(0, 4));
      recomputePeriodAmortizations();
      renderHdAnnualAmortRows();
      renderHdCouponsTable();
    });
  });

  hdCouponsBody.querySelectorAll("input[data-hd-coupon-amort]").forEach((input) => {
    input.addEventListener("input", (event) => {
      const idx = parseInt(event.target.dataset.hdCouponAmort, 10);
      const value = parseFloat(event.target.value) || 0;
      hdCoupons[idx].amortization_percent = value;
      // Recalcular tabla anual para que refleje la nueva suma
      hdAnnualAmortByYear = {};
      for (const coupon of hdCoupons) {
        if (!coupon.payment_date) continue;
        const year = coupon.payment_date.slice(0, 4);
        hdAnnualAmortByYear[year] = (hdAnnualAmortByYear[year] || 0) + (coupon.amortization_percent || 0);
      }
      renderHdAnnualAmortRows();
    });
  });
}

function setHdMode(mode) {
  if (!hdSearchPanel || !hdNewPanel) return;
  const isSearch = mode === "search";
  hdSearchPanel.classList.toggle("d-none", !isSearch);
  hdNewPanel.classList.toggle("d-none", isSearch);
  hdModeSwitch?.querySelectorAll("[data-hd-mode]").forEach((button) => {
    const active = button.dataset.hdMode === mode;
    button.classList.toggle("active", active);
    button.classList.toggle("btn-dark", active);
    button.classList.toggle("btn-outline-dark", !active);
  });
  if (isSearch) fetchHdSavedList().catch(() => {});
}

async function fetchHdSavedList() {
  if (!hdSavedList) return;
  try {
    const response = await fetch("/api/calculators/bond-hd/saved");
    if (!response.ok) throw new Error("No se pudo leer la lista");
    const payload = await response.json();
    renderHdSavedList(payload.items || []);
  } catch (error) {
    hdSavedList.innerHTML = '<span class="empty-cell">No se pudo leer la lista de bonos guardados</span>';
    console.error("[Bono HD] lista guardados", error);
  }
}

function renderHdSavedList(items) {
  if (!hdSavedList) return;
  if (!items.length) {
    hdSavedList.innerHTML = '<span class="empty-cell">Todavia no guardaste ningun Bono HD.</span>';
    return;
  }
  const filter = (hdSearchTicker?.value || "").trim().toUpperCase();
  const filtered = filter
    ? items.filter((item) => String(item.ticker || "").toUpperCase().includes(filter))
    : items;
  if (!filtered.length) {
    hdSavedList.innerHTML = '<span class="empty-cell">Sin resultados para ese ticker.</span>';
    return;
  }
  hdSavedList.innerHTML = filtered.map((item) => `
    <div class="hd-saved-row">
      <button type="button" class="hd-saved-item" data-hd-saved-ticker="${item.ticker}">
        <strong>${item.ticker}</strong>
        <small>${formatDateDisplay(item.issue_date)} → ${formatDateDisplay(item.maturity_date)} · ${item.bond_type} · ${item.frequency}</small>
      </button>
      <button type="button" class="btn btn-sm btn-outline-danger hd-saved-delete" data-hd-saved-delete="${item.ticker}" title="Eliminar">x</button>
    </div>
  `).join("");
  hdSavedList.querySelectorAll("[data-hd-saved-ticker]").forEach((button) => {
    button.addEventListener("click", () => loadHdSaved(button.dataset.hdSavedTicker));
  });
  hdSavedList.querySelectorAll("[data-hd-saved-delete]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      deleteHdSaved(button.dataset.hdSavedDelete);
    });
  });
}

async function loadHdSaved(ticker) {
  if (!ticker) return;
  setHdSaveStatus("draft", "Cargando...");
  try {
    const response = await fetch(`/api/calculators/bond-hd/saved/${encodeURIComponent(ticker)}`);
    if (!response.ok) throw new Error("No se pudo cargar el bono");
    const payload = await response.json();
    const item = payload.item || {};
    renderHdSavedDetail(item);
    fetchHdSavedQuotes(item.ticker).catch((err) => console.error("[Bono HD] quotes", err));
    setHdSaveStatus("ok", `${item.ticker} cargado`);
  } catch (error) {
    setHdSaveStatus("error", "Error al cargar");
    console.error("[Bono HD] cargar guardado", error);
  }
}

async function fetchHdSavedQuotes(family) {
  const body = document.querySelector("#hdSavedQuotesBody");
  const meta = document.querySelector("#hdQuotesSourceMeta");
  if (!body) return;
  if (!family) {
    body.innerHTML = '<tr><td colspan="8" class="empty-state">Sin ticker</td></tr>';
    return;
  }
  try {
    const response = await fetch("/api/quotes");
    if (!response.ok) throw new Error("No se pudo leer /api/quotes");
    const payload = await response.json();
    const quotes = (payload.quotes || []).filter((q) => String(q.family || "").toUpperCase() === String(family).toUpperCase());
    if (meta) {
      const source = payload.source || "-";
      const updated = payload.updated_at ? formatTime(payload.updated_at) : "-";
      meta.textContent = `Fuente: ${source} · Status: ${payload.status || "-"} · Actualizado: ${updated}`;
    }
    if (!quotes.length) {
      body.innerHTML = `<tr><td colspan="8" class="empty-state">No hay cotizaciones para la familia ${family}</td></tr>`;
      return;
    }
    body.innerHTML = quotes.map((q) => `
      <tr>
        <td>${q.symbol || ""}</td>
        <td>${q.currency || ""}</td>
        <td class="text-end">${formatNumber(q.bid, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
        <td class="text-end">${formatNumber(q.ask, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
        <td class="text-end">${formatNumber(q.last, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
        <td class="text-end">${formatNumber(q.change_percent, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</td>
        <td class="text-end">${formatNumber(q.volume)}</td>
        <td class="text-end">${q.updated_at ? formatTime(q.updated_at) : '<span class="empty-cell">s/d</span>'}</td>
      </tr>
    `).join("");
  } catch (error) {
    body.innerHTML = '<tr><td colspan="8" class="empty-state">No se pudieron leer cotizaciones</td></tr>';
    if (meta) meta.textContent = "";
    throw error;
  }
}

function renderHdSavedDetail(item) {
  if (!hdSavedDetail || !hdSavedDetailBody) return;
  hdSavedDetail.classList.remove("d-none");
  if (hdSavedDetailTitle) hdSavedDetailTitle.textContent = `Cashflow guardado · ${item.ticker || ""}`;
  if (hdSavedDetailMeta) {
    hdSavedDetailMeta.textContent = `Emision ${formatDateDisplay(item.issue_date)} · Vencimiento ${formatDateDisplay(item.maturity_date)} · VNO ${item.face_value} · ${item.bond_type} · ${item.frequency} · ${item.convention}`;
  }
  const cashflows = (item.payload && item.payload.cashflows) || [];
  if (!cashflows.length) {
    hdSavedDetailBody.innerHTML = '<tr><td colspan="10" class="empty-state">El cashflow guardado esta vacio</td></tr>';
    return;
  }
  hdSavedDetailBody.innerHTML = cashflows.map((row) => `
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

async function saveHdCashflow() {
  if (!hdLastCalculation) {
    setHdSaveStatus("error", "Calcula el cashflow primero");
    return;
  }
  const ticker = normalizeFamilyTicker(hdTicker?.value);
  if (!ticker) {
    setHdSaveStatus("error", "Cargar ticker (ej: AL30)");
    hdTicker?.focus();
    return;
  }
  setHdSaveStatus("draft", "Guardando...");
  try {
    const response = await fetch("/api/calculators/bond-hd/saved", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ticker,
        issue_date: hdLastCalculation.issue_date,
        maturity_date: hdLastCalculation.maturity_date,
        face_value: hdLastCalculation.face_value,
        bond_type: hdLastCalculation.bond_type,
        frequency: hdLastCalculation.frequency,
        convention: hdLastCalculation.convention,
        payload: hdLastCalculation,
      }),
    });
    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      throw new Error(typeof detail.detail === "string" ? detail.detail : "No se pudo guardar");
    }
    setHdSaveStatus("ok", `${ticker} guardado`);
    fetchHdSavedList().catch(() => {});
  } catch (error) {
    setHdSaveStatus("error", error.message || "Error al guardar");
    console.error("[Bono HD] guardar", error);
  }
}

let tesseractLoadPromise = null;
function loadTesseractJs() {
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  if (tesseractLoadPromise) return tesseractLoadPromise;
  tesseractLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
    script.async = true;
    script.onload = () => {
      if (window.Tesseract) resolve(window.Tesseract);
      else reject(new Error("Tesseract no inicializo"));
    };
    script.onerror = () => {
      tesseractLoadPromise = null;
      reject(new Error("No se pudo cargar tesseract.js"));
    };
    document.head.appendChild(script);
  });
  return tesseractLoadPromise;
}

async function runOcrOnImage(file) {
  setHdStatus("draft", "Cargando motor OCR...");
  const Tesseract = await loadTesseractJs();
  setHdStatus("draft", "Extrayendo texto de la imagen (puede tardar)...");
  const recognized = await Tesseract.recognize(file, "spa", {
    logger: (info) => {
      if (info && info.status) {
        const pct = info.progress ? `${Math.round(info.progress * 100)}%` : "";
        setHdStatus("draft", `OCR: ${info.status} ${pct}`);
      }
    },
  });
  return (recognized?.data?.text || "").trim();
}

async function deleteHdSaved(ticker) {
  if (!ticker) return;
  if (!window.confirm(`Eliminar bono HD guardado: ${ticker}?`)) return;
  try {
    const response = await fetch(`/api/calculators/bond-hd/saved/${encodeURIComponent(ticker)}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      throw new Error(typeof detail.detail === "string" ? detail.detail : "No se pudo eliminar");
    }
    setHdSaveStatus("ok", `${ticker} eliminado`);
    if (hdSavedDetail) hdSavedDetail.classList.add("d-none");
    await fetchHdSavedList();
  } catch (error) {
    setHdSaveStatus("error", error.message || "Error al eliminar");
    console.error("[Bono HD] eliminar guardado", error);
  }
}

function isImageFile(file) {
  if (!file) return false;
  if (file.type && file.type.startsWith("image/")) return true;
  const name = (file.name || "").toLowerCase();
  return /\.(png|jpe?g|gif|bmp|webp|tif?f)$/.test(name);
}

async function importHdDates() {
  const file = hdDatesFile?.files?.[0];
  const pastedText = (hdDatesText?.value || "").trim();
  if (!file && !pastedText) {
    setHdStatus("error", "Subir archivo o pegar texto con fechas");
    return;
  }

  let combinedText = pastedText;
  let fileForBackend = null;

  if (file) {
    if (isImageFile(file)) {
      try {
        const ocrText = await runOcrOnImage(file);
        if (!ocrText && !combinedText) {
          setHdStatus("error", "OCR no detecto texto en la imagen");
          return;
        }
        combinedText = combinedText ? `${combinedText}\n\n${ocrText}` : ocrText;
      } catch (error) {
        setHdStatus("error", error.message || "OCR fallo");
        console.error("[Bono HD] OCR", error);
        return;
      }
    } else {
      fileForBackend = file;
    }
  }

  setHdStatus("draft", "Parseando fechas...");
  const formData = new FormData();
  if (fileForBackend) formData.append("file", fileForBackend);
  if (combinedText) formData.append("text", combinedText);
  // Para que el parser pueda expandir patrones tipo "10/07 y 09/01 de cada año"
  const issueIso = getHdIssueIso();
  const maturityIso = getHdMaturityIso();
  if (issueIso) formData.append("issue_date", issueIso);
  if (maturityIso) formData.append("maturity_date", maturityIso);

  try {
    const response = await fetch("/api/calculators/bond-hd/parse-dates", {
      method: "POST",
      body: formData,
    });
    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      throw new Error(typeof detail.detail === "string" ? detail.detail : "No se pudieron parsear fechas");
    }
    const payload = await response.json();
    const dates = payload.dates || [];
    if (!dates.length) {
      setHdStatus("error", "No se detectaron fechas");
      return;
    }
    hdCoupons = dates.map((paymentDate) => ({
      payment_date: paymentDate,
      annual_rate_percent: getHdAnnualRateForYear(paymentDate.slice(0, 4)),
      amortization_percent: 0,
      in_grace: false,
    }));
    renderHdAnnualAmortRows();
    recomputePeriodAmortizations();
    renderHdGraceControls();
    applyHdGracePeriod();
    renderHdCouponsTable();
    hdCouponsSection.classList.remove("d-none");
    if (hdCalculate) hdCalculate.disabled = false;
    setHdStatus("ok", `Importadas ${dates.length} fechas`);
  } catch (error) {
    setHdStatus("error", error.message || "Error al parsear fechas");
  }
}

async function calculateHdCashflow() {
  if (!hdCoupons.length) {
    setHdStatus("error", "Generar la tabla de cupones primero");
    return;
  }
  const issueIso = getHdIssueIso();
  const maturityIso = getHdMaturityIso();
  if (!issueIso || !maturityIso || !hdFaceValue.value) {
    setHdStatus("error", "Completa emision (DD/MM/AAAA), vencimiento (DD/MM/AAAA) y VNO");
    return;
  }
  setHdStatus("draft", "Calculando...");
  const lastIndex = hdCoupons.length - 1;
  const adjustedCoupons = hdCoupons.map((coupon, index) => ({
    payment_date: index === lastIndex ? maturityIso : coupon.payment_date,
    annual_rate_percent: coupon.annual_rate_percent,
    amortization_percent: coupon.amortization_percent,
  }));
  try {
    const response = await fetch("/api/calculators/bond-hd", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        issue_date: issueIso,
        maturity_date: maturityIso,
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
    if (hdSaveCashflow) hdSaveCashflow.disabled = false;
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

  const issueIso = parseDdmmYyyy(issueDate.value);
  const maturityIso = parseDdmmYyyy(maturityDate.value);
  if (!issueIso || !maturityIso) {
    setCalculatorStatus("error", "Fechas invalidas (DD/MM/AAAA)");
    return;
  }

  const response = await fetch("/api/calculators/lecaps", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ticker: lecapTicker.value,
      issue_date: issueIso,
      maturity_date: maturityIso,
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
    if (marketSettlementFilter) marketSettlementFilter.classList.toggle("active", currentMarketList === "lecaps");
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

document.querySelectorAll("[data-market-category]").forEach((button) => {
  button.addEventListener("click", () => {
    currentMarketCategory = button.dataset.marketCategory;
    document.querySelectorAll("[data-market-category]").forEach((candidate) => {
      const active = candidate === button;
      candidate.classList.toggle("active", active);
      candidate.classList.toggle("btn-dark", active);
      candidate.classList.toggle("btn-outline-dark", !active);
    });
    renderQuotes();
    // Poll inmediato al entrar al sub-tab para no esperar al intervalo
    if (currentMarketCategory === "fx") pollFxRatios();
    if (currentMarketCategory === "futuros_dlk") pollFutures();
  });
});

document.querySelectorAll("[data-market-settlement]").forEach((button) => {
  button.addEventListener("click", () => {
    currentMarketSettlement = button.dataset.marketSettlement;
    currentLecapSettlement = currentMarketSettlement;
    document.querySelectorAll("[data-market-settlement]").forEach((candidate) => {
      const active = candidate === button;
      candidate.classList.toggle("active", active);
      candidate.classList.toggle("btn-dark", active);
      candidate.classList.toggle("btn-outline-dark", !active);
    });
    renderQuotes();
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
attachDdmmAutoformat(hdIssueDate);
attachDdmmAutoformat(hdMaturityDate);
attachDdmmAutoformat(issueDate);
attachDdmmAutoformat(maturityDate);
hdIssueDate?.addEventListener("blur", renderHardDollarCouponInputs);
hdMaturityDate?.addEventListener("blur", renderHardDollarCouponInputs);
hdCouponType?.addEventListener("change", renderHardDollarCouponInputs);
hdBondType?.addEventListener("change", () => {
  renderHardDollarCouponInputs();
  if (hdBondType.value === "amortizable") {
    renderHdAnnualAmortRows();
  } else {
    hdAnnualAmortByYear = {};
  }
  recomputePeriodAmortizations();
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
hdAmortFromYear?.addEventListener("change", refreshHdAmortFromPeriodOptions);
hdAmortDistribute?.addEventListener("click", distributeAmortization);
hdAmortApplyUniform?.addEventListener("click", applyUniformPctFromPeriod);
hdImportDates?.addEventListener("click", () => {
  console.log("[Bono HD] click importar fechas");
  importHdDates().catch((err) => {
    console.error("[Bono HD] importar fechas fallo", err);
    setHdStatus("error", "Error al importar fechas");
  });
});

hdModeSwitch?.querySelectorAll("[data-hd-mode]").forEach((button) => {
  button.addEventListener("click", () => setHdMode(button.dataset.hdMode));
});
hdSearchSubmit?.addEventListener("click", () => {
  fetchHdSavedList().catch(() => setHdSaveStatus("error", "No se pudo buscar"));
});
hdSearchTicker?.addEventListener("input", () => {
  fetchHdSavedList().catch(() => {});
});
hdSaveCashflow?.addEventListener("click", () => {
  saveHdCashflow().catch((err) => {
    console.error("[Bono HD] saveHdCashflow fallo", err);
    setHdSaveStatus("error", "Error al guardar");
  });
});
hdCalculate?.addEventListener("click", () => {
  console.log("[Bono HD] click calcular");
  calculateHdCashflow().catch((err) => {
    console.error("[Bono HD] calcular fallo", err);
    setHdStatus("error", "Error al calcular");
  });
});

// Periodo de gracia
hdGraceMode?.addEventListener("change", () => {
  renderHdGraceControls();
  if (hdGraceMode.value === "none") applyHdGracePeriod();
});
hdGraceApply?.addEventListener("click", applyHdGracePeriod);
hdGracePeriod?.addEventListener("change", applyHdGracePeriod);
hdGraceYear?.addEventListener("change", applyHdGracePeriod);
hdGraceMonth?.addEventListener("change", applyHdGracePeriod);

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

// Pollers de FX y Futuros: independientes del WebSocket para no parpadear.
pollFxRatios();
pollFutures();
window.setInterval(pollFxRatios, 3000);
window.setInterval(pollFutures, 5000);

tplusRate.disabled = tplusAutoRate.checked;
renderQuotes();

// ===== Backup / restore de la base de datos =====
const backupDownload = document.querySelector("#backupDownload");
const backupDownloadJson = document.querySelector("#backupDownloadJson");
const backupCreate = document.querySelector("#backupCreate");
const backupRestoreFile = document.querySelector("#backupRestoreFile");
const backupRestore = document.querySelector("#backupRestore");
const backupStatus = document.querySelector("#backupStatus");
const backupList = document.querySelector("#backupList");

function setBackupStatus(kind, text) {
  if (!backupStatus) return;
  backupStatus.dataset.kind = kind;
  backupStatus.textContent = text;
}

async function refreshBackupList() {
  if (!backupList) return;
  try {
    const response = await fetch("/api/data/backups");
    if (!response.ok) throw new Error("No se pudo leer backups");
    const payload = await response.json();
    const items = payload.items || [];
    if (!items.length) {
      backupList.innerHTML = '<li class="empty-cell">Sin backups todavia</li>';
      return;
    }
    backupList.innerHTML = items.map((item) => {
      const sizeKb = (item.size_bytes / 1024).toFixed(1);
      const date = new Date(item.modified_at * 1000).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" });
      return `<li><strong>${item.name}</strong> · ${sizeKb} KB · ${date}</li>`;
    }).join("");
  } catch (error) {
    backupList.innerHTML = '<li class="empty-cell">No se pudieron leer backups</li>';
  }
}

backupDownload?.addEventListener("click", () => {
  setBackupStatus("draft", "Generando .db...");
  window.location.href = "/api/data/backup/download";
  setBackupStatus("ok", "Descarga iniciada");
});

backupDownloadJson?.addEventListener("click", async () => {
  setBackupStatus("draft", "Generando JSON...");
  try {
    const response = await fetch("/api/data/backup/json");
    if (!response.ok) throw new Error("No se pudo generar el backup JSON");
    const payload = await response.json();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    a.href = url;
    a.download = `user_data_backup_${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setBackupStatus("ok", "Descargado JSON");
  } catch (error) {
    setBackupStatus("error", error.message || "Error al generar JSON");
  }
});

backupCreate?.addEventListener("click", async () => {
  setBackupStatus("draft", "Creando backup en el server...");
  try {
    const response = await fetch("/api/data/backup/now", { method: "POST" });
    if (!response.ok) throw new Error("No se pudo crear backup");
    const payload = await response.json();
    setBackupStatus("ok", `Creado: ${payload.created}`);
    await refreshBackupList();
  } catch (error) {
    setBackupStatus("error", error.message || "Error al crear backup");
  }
});

backupRestore?.addEventListener("click", async () => {
  const file = backupRestoreFile?.files?.[0];
  if (!file) {
    setBackupStatus("error", "Eligi un archivo .db para restaurar");
    return;
  }
  if (!window.confirm(`Restaurar la base con ${file.name}? La base actual se reemplaza (se hace un backup defensivo previo).`)) return;
  setBackupStatus("draft", "Subiendo y restaurando...");
  try {
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch("/api/data/restore", { method: "POST", body: formData });
    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      throw new Error(typeof detail.detail === "string" ? detail.detail : "No se pudo restaurar");
    }
    setBackupStatus("ok", "Restaurado. Recarga la pagina para ver los datos.");
    await refreshBackupList();
  } catch (error) {
    setBackupStatus("error", error.message || "Error al restaurar");
  }
});

if (backupList) refreshBackupList();

// ===== Estado del sistema =====
const systemStatusBody = document.querySelector("#systemStatusBody");
const systemStatusRefresh = document.querySelector("#systemStatusRefresh");

function formatBytes(n) {
  if (!n || n < 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v >= 100 ? 0 : 1)} ${units[i]}`;
}

function dot(kind) {
  const colors = { ok: "#15803d", warn: "#f59e0b", err: "#b91c1c" };
  return `<span class="status-dot-mini" style="background:${colors[kind] || "#94a3b8"}"></span>`;
}

async function refreshSystemStatus() {
  if (!systemStatusBody) return;
  systemStatusBody.innerHTML = '<span class="empty-cell">Cargando...</span>';
  try {
    const response = await fetch("/api/system/health");
    if (!response.ok) throw new Error("No se pudo leer estado");
    const payload = await response.json();
    renderSystemStatus(payload);
  } catch (error) {
    systemStatusBody.innerHTML = `<span class="empty-cell">No se pudo leer estado: ${error.message}</span>`;
  }
}

function renderSystemStatus(p) {
  const sqlite = p.sqlite || {};
  const tables = sqlite.tables || {};
  const backups = sqlite.backups || {};
  const market = p.market_history || {};
  const env = p.environment || {};
  const warnings = p.warnings || [];

  const sqliteOk = sqlite.exists && sqlite.writable;
  const persistentOk = sqlite.is_persistent_path;
  const marketOk = market.connected;
  const marketScheduler = market.scheduler_status || "—";

  const tableRows = Object.keys(tables).map((name) => {
    const count = tables[name];
    const formatted = count >= 0 ? count.toLocaleString("es-AR") : "error";
    return `<tr><td>${name}</td><td class="text-end">${formatted}</td></tr>`;
  }).join("");

  systemStatusBody.innerHTML = `
    <div class="status-grid">
      <div class="status-card">
        <h4>${dot(sqliteOk ? "ok" : "err")}SQLite</h4>
        <p class="status-meta"><strong>Path:</strong> <code>${sqlite.path || "—"}</code></p>
        <p class="status-meta"><strong>Tamaño:</strong> ${formatBytes(sqlite.size_bytes)}</p>
        <p class="status-meta"><strong>Escribible:</strong> ${sqlite.writable ? "✓ Si" : "✗ No"}</p>
        <p class="status-meta"><strong>Disco persistente:</strong> ${dot(persistentOk ? "ok" : "warn")}${persistentOk ? "Si (path /var/data o similar)" : "No detectado — config Render disco persistente"}</p>
        <table class="table table-sm mb-0 mt-2">
          <thead><tr><th>Tabla</th><th class="text-end">Filas</th></tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>

      <div class="status-card">
        <h4>${dot(backups.count > 0 ? "ok" : "warn")}Backups</h4>
        <p class="status-meta"><strong>Cantidad:</strong> ${backups.count || 0}</p>
        <p class="status-meta"><strong>Total:</strong> ${formatBytes(backups.total_size_bytes)}</p>
        <p class="status-meta"><strong>Ultimo:</strong> ${backups.latest || "—"}</p>
        <p class="status-meta"><strong>Directorio:</strong> <code>${backups.directory || "—"}</code></p>
      </div>

      <div class="status-card">
        <h4>${dot(marketOk ? "ok" : (market.configured ? "warn" : "err"))}Market history (Postgres)</h4>
        <p class="status-meta"><strong>Configurado:</strong> ${market.configured ? "✓ Si" : "✗ No (DATABASE_URL ausente)"}</p>
        <p class="status-meta"><strong>Conectado:</strong> ${marketOk ? "✓ Si" : "✗ No"}</p>
        <p class="status-meta"><strong>Scheduler:</strong> ${marketScheduler}</p>
        <p class="status-meta"><strong>Instrumentos activos:</strong> ${market.active_instruments ?? "—"}</p>
        <p class="status-meta"><strong>Ticks hoy:</strong> ${(market.ticks_today ?? 0).toLocaleString("es-AR")}</p>
        <p class="status-meta"><strong>Ultimo tick:</strong> ${market.last_tick_ts || "—"}</p>
        <p class="status-meta"><strong>Ultimo daily summary:</strong> ${market.last_summary_date || "—"}</p>
      </div>

      <div class="status-card">
        <h4>${dot("ok")}Entorno</h4>
        <p class="status-meta"><strong>Market source:</strong> ${env.market_source}</p>
        <p class="status-meta"><strong>pyRofex env:</strong> ${env.rofex_environment} ${env.rofex_user_set ? "(credenciales OK)" : "(sin credenciales)"}</p>
        <p class="status-meta"><strong>Horario:</strong> ${env.market_open_local} → ${env.market_close_local}</p>
        <p class="status-meta"><strong>Hoy es habil:</strong> ${env.is_business_day ? "Si" : "No"}</p>
        <p class="status-meta"><strong>Ahora:</strong> ${env.now_argentina}</p>
      </div>
    </div>

    ${warnings.length ? `
      <div class="status-warnings">
        <h4>Avisos</h4>
        <ul>${warnings.map((w) => `<li>${w}</li>`).join("")}</ul>
      </div>
    ` : ""}
  `;
}

systemStatusRefresh?.addEventListener("click", () => refreshSystemStatus());
if (systemStatusBody) refreshSystemStatus();
