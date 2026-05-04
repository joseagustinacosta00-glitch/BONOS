// ===== TradingView widget oficial (instrumentos publicos) =====
const symbolSelect = document.querySelector("#tvSymbolSelect");
const symbolInput = document.querySelector("#tvSymbolInput");
const loadButton = document.querySelector("#tvLoadButton");
const chartContainerId = "tradingviewChart";

let activeSymbol = symbolSelect.value;

symbolSelect.addEventListener("change", () => {
  activeSymbol = symbolSelect.value;
  symbolInput.value = "";
  renderTradingView(activeSymbol);
});

loadButton.addEventListener("click", () => {
  const customSymbol = symbolInput.value.trim().toUpperCase();
  activeSymbol = customSymbol || symbolSelect.value;
  renderTradingView(activeSymbol);
});

symbolInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    loadButton.click();
  }
});

function renderTradingView(symbol) {
  const container = document.querySelector(`#${chartContainerId}`);
  container.innerHTML = "";
  if (!window.TradingView) {
    container.textContent = "No se pudo cargar TradingView.";
    return;
  }
  new window.TradingView.widget({
    autosize: true,
    symbol,
    interval: "D",
    timezone: "America/Argentina/Buenos_Aires",
    theme: "dark",
    style: "1",
    locale: "es",
    toolbar_bg: "#0c121c",
    enable_publishing: false,
    allow_symbol_change: true,
    container_id: chartContainerId,
    hide_side_toolbar: false,
    withdateranges: true,
    studies: ["Volume@tv-basicstudies"],
  });
}

renderTradingView(activeSymbol);

// ===== Mis datos (Lightweight Charts conectado a /api/historical-data) =====

const ownTicker = document.querySelector("#ownTicker");
const ownTickerOptions = document.querySelector("#ownTickerOptions");
const ownMetric = document.querySelector("#ownMetric");
const ownMarket = document.querySelector("#ownMarket");
const ownSettlement = document.querySelector("#ownSettlement");
const ownPlot = document.querySelector("#ownPlot");
const ownAddOverlay = document.querySelector("#ownAddOverlay");
const ownOverlayList = document.querySelector("#ownOverlayList");
const ownDataStatus = document.querySelector("#ownDataStatus");
const ownDataChartContainer = document.querySelector("#ownDataChart");

const METRIC_LABEL = {
  parity: "Paridad",
  dirty_price: "Precio dirty",
  clean_price: "Precio clean",
  ytm: "TIR",
  tem: "TEM",
  tna: "TNA",
  volume: "Volumen",
};

const SERIES_COLORS = ["#38bdf8", "#fb923c", "#a3e635", "#f472b6", "#facc15", "#22d3ee", "#c084fc", "#fb7185"];

let ownChart = null;
let ownOverlays = [];

function setOwnStatus(kind, text) {
  ownDataStatus.dataset.kind = kind;
  ownDataStatus.textContent = text;
}

function ensureOwnChart() {
  if (ownChart) return ownChart;
  if (!window.LightweightCharts) {
    setOwnStatus("error", "No se pudo cargar Lightweight Charts");
    return null;
  }
  ownChart = window.LightweightCharts.createChart(ownDataChartContainer, {
    autoSize: true,
    layout: {
      background: { color: "#05080d" },
      textColor: "#e8eef6",
    },
    grid: {
      vertLines: { color: "#1a2738" },
      horzLines: { color: "#1a2738" },
    },
    rightPriceScale: { borderColor: "#24384f" },
    timeScale: { borderColor: "#24384f", timeVisible: false },
    crosshair: { mode: 1 },
    localization: { locale: "es-AR" },
  });
  window.addEventListener("resize", () => ownChart?.timeScale().fitContent());
  return ownChart;
}

function clearOwnChart() {
  if (!ownChart) return;
  ownOverlays.forEach((entry) => {
    try { ownChart.removeSeries(entry.series); } catch (_) {}
  });
  ownOverlays = [];
  renderOverlayList();
}

function buildSeriesKey(spec) {
  return `${spec.ticker}|${spec.metric}|${spec.market}|${spec.settlement}`;
}

function buildSeriesLabel(spec) {
  return `${spec.ticker} · ${METRIC_LABEL[spec.metric] || spec.metric} · ${spec.market.toUpperCase()} · T+${spec.settlement === "t0" ? "0" : "1"}`;
}

async function fetchSeriesPoints(spec) {
  const params = new URLSearchParams({
    ticker: spec.ticker,
    metric_type: spec.metric,
    price_market: spec.market,
    settlement_type: spec.settlement,
    limit: "5000",
  });
  const response = await fetch(`/api/historical-data?${params.toString()}`);
  if (!response.ok) throw new Error("No se pudieron leer datos historicos");
  const payload = await response.json();
  const items = payload.items || [];
  const points = items
    .map((item) => ({
      time: item.value_date,
      value: Number(item.value),
    }))
    .filter((p) => p.time && Number.isFinite(p.value))
    .sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
  // Lightweight requires unique times
  const unique = [];
  let prevTime = null;
  for (const p of points) {
    if (p.time !== prevTime) {
      unique.push(p);
      prevTime = p.time;
    }
  }
  return unique;
}

async function plotMainSeries() {
  const spec = readSpec();
  if (!spec.ticker) {
    setOwnStatus("error", "Eligi un ticker");
    return;
  }
  setOwnStatus("draft", "Cargando serie...");
  try {
    const points = await fetchSeriesPoints(spec);
    if (!points.length) {
      setOwnStatus("error", `Sin datos para ${spec.ticker} ${spec.metric} ${spec.market} ${spec.settlement}`);
      return;
    }
    const chart = ensureOwnChart();
    if (!chart) return;
    clearOwnChart();
    addSeriesToChart(spec, points, true);
    setOwnStatus("ok", `Graficados ${points.length} puntos`);
  } catch (error) {
    setOwnStatus("error", error.message || "Error al graficar");
    console.error(error);
  }
}

async function addOverlaySeries() {
  const spec = readSpec();
  if (!spec.ticker) {
    setOwnStatus("error", "Eligi un ticker");
    return;
  }
  if (!ownChart) {
    setOwnStatus("error", "Primero apreta Graficar para crear el chart");
    return;
  }
  const key = buildSeriesKey(spec);
  if (ownOverlays.some((entry) => entry.key === key)) {
    setOwnStatus("error", "Esa serie ya esta cargada");
    return;
  }
  setOwnStatus("draft", "Cargando overlay...");
  try {
    const points = await fetchSeriesPoints(spec);
    if (!points.length) {
      setOwnStatus("error", "Sin datos para esa serie");
      return;
    }
    addSeriesToChart(spec, points, false);
    setOwnStatus("ok", `Overlay agregado (${points.length} puntos)`);
  } catch (error) {
    setOwnStatus("error", error.message || "Error al agregar overlay");
    console.error(error);
  }
}

function addSeriesToChart(spec, points, isMain) {
  const chart = ensureOwnChart();
  if (!chart) return;
  const color = SERIES_COLORS[ownOverlays.length % SERIES_COLORS.length];
  const series = chart.addLineSeries({
    color,
    lineWidth: isMain ? 2 : 2,
    priceLineVisible: false,
    lastValueVisible: true,
  });
  series.setData(points);
  const entry = {
    key: buildSeriesKey(spec),
    label: buildSeriesLabel(spec),
    color,
    series,
  };
  ownOverlays.push(entry);
  renderOverlayList();
  chart.timeScale().fitContent();
}

function removeOverlay(key) {
  const idx = ownOverlays.findIndex((entry) => entry.key === key);
  if (idx === -1) return;
  const entry = ownOverlays[idx];
  try { ownChart.removeSeries(entry.series); } catch (_) {}
  ownOverlays.splice(idx, 1);
  renderOverlayList();
  if (!ownOverlays.length) {
    setOwnStatus("draft", "Sin series");
  }
}

function renderOverlayList() {
  if (!ownOverlays.length) {
    ownOverlayList.innerHTML = '<span class="tv-subtle">Sin series cargadas. Apreta Graficar.</span>';
    return;
  }
  ownOverlayList.innerHTML = ownOverlays.map((entry) => `
    <span class="tv-chip" style="border-color:${entry.color}">
      <span class="tv-chip-dot" style="background:${entry.color}"></span>
      ${entry.label}
      <button type="button" class="tv-chip-x" data-overlay-key="${entry.key}" title="Quitar">×</button>
    </span>
  `).join("");
  ownOverlayList.querySelectorAll("[data-overlay-key]").forEach((btn) => {
    btn.addEventListener("click", () => removeOverlay(btn.dataset.overlayKey));
  });
}

function readSpec() {
  return {
    ticker: ownTicker.value.trim().toUpperCase(),
    metric: ownMetric.value,
    market: ownMarket.value,
    settlement: ownSettlement.value,
  };
}

async function loadOwnTickerOptions() {
  try {
    const response = await fetch("/api/data/tickers");
    if (!response.ok) return;
    const payload = await response.json();
    const tickers = payload.tickers || [];
    ownTickerOptions.innerHTML = tickers.map((t) => `<option value="${t}">`).join("");
  } catch (_) {
    /* ignore */
  }
}

ownPlot.addEventListener("click", () => plotMainSeries());
ownAddOverlay.addEventListener("click", () => addOverlaySeries());
ownTicker.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    plotMainSeries();
  }
});

loadOwnTickerOptions();
renderOverlayList();
setOwnStatus("draft", "Sin serie");
