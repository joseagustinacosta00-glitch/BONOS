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

const ownTickerSearch = document.querySelector("#ownTickerSearch");
const ownTickerOptions = document.querySelector("#ownTickerOptions");
const ownSearchBtn = document.querySelector("#ownSearchBtn");
const ownSeriesList = document.querySelector("#ownSeriesList");
const ownChartType = document.querySelector("#ownChartType");
const ownChartScale = document.querySelector("#ownChartScale");
const ownClearBtn = document.querySelector("#ownClearBtn");
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

const MARKET_LABEL = { pesos: "Pesos", cable: "Cable", mep: "MEP" };
const SETTLEMENT_LABEL = { t0: "T+0", t1: "T+1" };

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
    rightPriceScale: { borderColor: "#24384f", mode: 0 },
    timeScale: { borderColor: "#24384f", timeVisible: false, rightOffset: 5 },
    crosshair: { mode: 1 },
    localization: { locale: "es-AR" },
  });
  window.addEventListener("resize", () => ownChart?.timeScale().fitContent());
  applyChartScale();
  return ownChart;
}

function applyChartScale() {
  if (!ownChart) return;
  const mode = ownChartScale.value === "log" ? 1 : 0;
  ownChart.priceScale("right").applyOptions({ mode });
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
  return `${spec.ticker} · ${METRIC_LABEL[spec.metric] || spec.metric} (${MARKET_LABEL[spec.market] || spec.market} ${SETTLEMENT_LABEL[spec.settlement] || spec.settlement})`;
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

function aggregateOhlc(points, bucket) {
  // bucket: 'd' (diario, no agrupa), 'w' (semana ISO), 'm' (mes)
  if (!points.length) return [];
  const groups = new Map();
  for (const p of points) {
    let key;
    const [y, m, d] = p.time.split("-").map(Number);
    if (bucket === "d") {
      key = p.time;
    } else if (bucket === "m") {
      key = `${y}-${String(m).padStart(2, "0")}-01`;
    } else {
      // semana ISO: tomamos el lunes
      const dt = new Date(Date.UTC(y, m - 1, d));
      const day = dt.getUTCDay() || 7;
      dt.setUTCDate(dt.getUTCDate() - day + 1);
      key = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
    }
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p.value);
  }
  return Array.from(groups.entries())
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([time, values]) => ({
      time,
      open: values[0],
      high: Math.max(...values),
      low: Math.min(...values),
      close: values[values.length - 1],
    }));
}

async function plotSeries(spec, mode = "main") {
  setOwnStatus("draft", "Cargando serie...");
  try {
    const points = await fetchSeriesPoints(spec);
    if (!points.length) {
      setOwnStatus("error", `Sin datos para ${spec.ticker}`);
      return;
    }
    const chart = ensureOwnChart();
    if (!chart) return;
    if (mode === "main") {
      clearOwnChart();
    } else if (ownOverlays.some((entry) => entry.key === buildSeriesKey(spec))) {
      setOwnStatus("error", "Esa serie ya esta cargada");
      return;
    }
    addSeriesToChart(spec, points);
    setOwnStatus("ok", `Graficados ${points.length} puntos`);
  } catch (error) {
    setOwnStatus("error", error.message || "Error al graficar");
    console.error(error);
  }
}

function addSeriesToChart(spec, points) {
  const chart = ensureOwnChart();
  if (!chart) return;
  const color = SERIES_COLORS[ownOverlays.length % SERIES_COLORS.length];
  const chartType = ownChartType.value;

  let series;
  if (chartType === "candle_d" || chartType === "candle_w" || chartType === "candle_m") {
    const bucket = chartType === "candle_w" ? "w" : chartType === "candle_m" ? "m" : "d";
    const ohlc = aggregateOhlc(points, bucket);
    series = chart.addCandlestickSeries({
      upColor: "#22d3ee",
      downColor: "#fb7185",
      borderVisible: false,
      wickUpColor: "#22d3ee",
      wickDownColor: "#fb7185",
    });
    series.setData(ohlc);
  } else if (chartType === "area") {
    series = chart.addAreaSeries({
      lineColor: color,
      topColor: color + "44",
      bottomColor: color + "00",
      lineWidth: 2,
    });
    series.setData(points);
  } else {
    series = chart.addLineSeries({
      color,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
    });
    series.setData(points);
  }
  const entry = {
    key: buildSeriesKey(spec),
    label: buildSeriesLabel(spec),
    color,
    series,
    spec,
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
  if (!ownOverlays.length) setOwnStatus("draft", "Sin series");
}

function renderOverlayList() {
  if (!ownOverlays.length) {
    ownOverlayList.innerHTML = '<span class="tv-subtle">Sin series cargadas. Buscar y elegir.</span>';
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

async function searchSeriesForTicker() {
  const ticker = ownTickerSearch.value.trim().toUpperCase();
  if (!ticker) {
    setOwnStatus("error", "Cargar un ticker para buscar");
    return;
  }
  setOwnStatus("draft", `Buscando series para ${ticker}...`);
  try {
    const response = await fetch(`/api/historical-data/series?ticker=${encodeURIComponent(ticker)}`);
    if (!response.ok) throw new Error("No se pudo leer el catalogo");
    const payload = await response.json();
    const items = payload.items || [];
    renderSeriesList(items, ticker);
    if (!items.length) {
      setOwnStatus("error", `Sin series cargadas para ${ticker}`);
    } else {
      setOwnStatus("ok", `${items.length} serie(s) encontradas para ${ticker}`);
    }
  } catch (error) {
    setOwnStatus("error", error.message || "Error al buscar");
  }
}

function renderSeriesList(items, ticker) {
  if (!items.length) {
    ownSeriesList.innerHTML = `<span class="tv-subtle">No hay series cargadas para ${ticker}. Carga datos en la pestaña "Datos historicos".</span>`;
    return;
  }
  // Agrupar por metric para que sea mas claro
  const byMetric = {};
  for (const item of items) {
    const metric = item.metric_type;
    if (!byMetric[metric]) byMetric[metric] = [];
    byMetric[metric].push(item);
  }
  const html = Object.keys(byMetric).map((metric) => {
    const variants = byMetric[metric].map((item) => {
      const spec = {
        ticker: item.ticker,
        metric: item.metric_type,
        market: item.price_market,
        settlement: item.settlement_type,
      };
      const dataAttr = encodeURIComponent(JSON.stringify(spec));
      const variantLabel = `${MARKET_LABEL[item.price_market] || item.price_market} ${SETTLEMENT_LABEL[item.settlement_type] || item.settlement_type}`;
      const points = item.count || 0;
      return `
        <div class="tv-series-variant">
          <span class="tv-variant-label">${variantLabel}</span>
          <span class="tv-variant-meta">${points} pts · ${item.first_date || "?"} → ${item.last_date || "?"}</span>
          <div class="tv-variant-actions">
            <button type="button" class="tv-variant-plot" data-spec="${dataAttr}">Graficar</button>
            <button type="button" class="tv-variant-overlay" data-spec="${dataAttr}">+ Overlay</button>
          </div>
        </div>
      `;
    }).join("");
    return `
      <div class="tv-series-group">
        <h4 class="tv-series-metric">${METRIC_LABEL[metric] || metric}</h4>
        ${variants}
      </div>
    `;
  }).join("");
  ownSeriesList.innerHTML = html;
  ownSeriesList.querySelectorAll(".tv-variant-plot").forEach((btn) => {
    btn.addEventListener("click", () => {
      const spec = JSON.parse(decodeURIComponent(btn.dataset.spec));
      plotSeries(spec, "main");
    });
  });
  ownSeriesList.querySelectorAll(".tv-variant-overlay").forEach((btn) => {
    btn.addEventListener("click", () => {
      const spec = JSON.parse(decodeURIComponent(btn.dataset.spec));
      plotSeries(spec, "overlay");
    });
  });
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

ownSearchBtn.addEventListener("click", () => searchSeriesForTicker());
ownTickerSearch.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    searchSeriesForTicker();
  }
});
ownChartScale.addEventListener("change", applyChartScale);
ownChartType.addEventListener("change", () => {
  if (!ownOverlays.length) return;
  // Re-render con nuevo tipo: tomamos los specs y reploteamos
  const specs = ownOverlays.map((e) => e.spec);
  clearOwnChart();
  setOwnStatus("draft", "Re-renderizando...");
  (async () => {
    for (const spec of specs) {
      try {
        const points = await fetchSeriesPoints(spec);
        if (points.length) addSeriesToChart(spec, points);
      } catch (_) { /* ignore */ }
    }
    setOwnStatus("ok", `${ownOverlays.length} serie(s) cargadas`);
  })();
});
ownClearBtn.addEventListener("click", () => {
  clearOwnChart();
  setOwnStatus("draft", "Sin series");
});

loadOwnTickerOptions();
renderOverlayList();
setOwnStatus("draft", "Sin serie");
