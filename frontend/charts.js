const chartTickerA = document.querySelector("#chartTickerA");
const chartTickerB = document.querySelector("#chartTickerB");
const chartMetric = document.querySelector("#chartMetric");
const chartMarket = document.querySelector("#chartMarket");
const chartSettlement = document.querySelector("#chartSettlement");
const zscoreWindow = document.querySelector("#zscoreWindow");
const drawCharts = document.querySelector("#drawCharts");
const chartStatus = document.querySelector("#chartStatus");
const lineTitle = document.querySelector("#lineTitle");
const lineSource = document.querySelector("#lineSource");
const latestZScore = document.querySelector("#latestZScore");

let lineChart;
let spreadChart;
let zscoreChart;
let curveChart;
let availableSeries = [];

const metricLabels = {
  parity: "Paridad",
  dirty_price: "Precio dirty",
  clean_price: "Precio clean",
  ytm: "TIR",
  tem: "TEM",
  tna: "TNA",
  volume: "Volumen",
};

const mockSeriesA = [
  ["2026-01-02", 55.4],
  ["2026-01-05", 55.9],
  ["2026-01-06", 56.2],
  ["2026-01-07", 55.7],
  ["2026-01-08", 57.1],
  ["2026-01-09", 57.8],
  ["2026-01-12", 58.4],
  ["2026-01-13", 58.1],
  ["2026-01-14", 59.2],
  ["2026-01-15", 60.0],
  ["2026-01-16", 59.5],
  ["2026-01-19", 60.8],
  ["2026-01-20", 61.3],
  ["2026-01-21", 61.0],
  ["2026-01-22", 62.4],
  ["2026-01-23", 63.1],
].map(([date, value]) => ({ date, value }));

const mockSeriesB = mockSeriesA.map((point, index) => ({
  date: point.date,
  value: point.value - 1.2 + Math.sin(index / 2) * 0.5,
}));

const mockCurve = [
  { ticker: "AL30", md: 2.8, tir: 12.5 },
  { ticker: "AL35", md: 5.1, tir: 13.2 },
  { ticker: "AE38", md: 6.4, tir: 13.6 },
  { ticker: "AL41", md: 7.2, tir: 13.9 },
  { ticker: "GD30", md: 2.9, tir: 11.8 },
  { ticker: "GD35", md: 5.2, tir: 12.4 },
];

function chartDefaults() {
  Chart.defaults.color = "#8ea0b2";
  Chart.defaults.borderColor = "#263545";
  Chart.defaults.font.family = "Arial, Helvetica, sans-serif";
}

function destroyChart(instance) {
  if (instance) instance.destroy();
}

function makeLineChart(canvasId, points, label, color, extra = {}) {
  const ctx = document.querySelector(`#${canvasId}`);
  return new Chart(ctx, {
    type: "line",
    data: {
      labels: points.map((point) => point.date),
      datasets: [{
        label,
        data: points.map((point) => point.value),
        borderColor: color,
        backgroundColor: `${color}22`,
        pointRadius: 0,
        pointHoverRadius: 3,
        borderWidth: 2,
        tension: 0.25,
        fill: false,
        ...extra,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: { backgroundColor: "#101923", borderColor: "#263545", borderWidth: 1 },
      },
      scales: {
        x: { ticks: { maxTicksLimit: 8 } },
        y: { grid: { color: "#1f2d3a" } },
      },
    },
  });
}

function makeZScoreChart(points) {
  const ctx = document.querySelector("#zscoreChart");
  return new Chart(ctx, {
    type: "line",
    data: {
      labels: points.map((point) => point.date),
      datasets: [
        {
          label: "Z-score",
          data: points.map((point) => point.zscore),
          borderColor: "#d6a84f",
          pointRadius: 0,
          borderWidth: 2,
          tension: 0.2,
        },
        ...[2, 1, 0, -1, -2].map((level) => ({
          label: `${level}`,
          data: points.map(() => level),
          borderColor: level === 0 ? "#63778a" : "#334657",
          borderDash: level === 0 ? [] : [4, 4],
          borderWidth: 1,
          pointRadius: 0,
        })),
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { backgroundColor: "#101923", borderColor: "#263545", borderWidth: 1 },
      },
      scales: {
        x: { ticks: { maxTicksLimit: 8 } },
        y: { suggestedMin: -3, suggestedMax: 3 },
      },
    },
  });
}

function makeCurveChart(points) {
  const ctx = document.querySelector("#curveChart");
  return new Chart(ctx, {
    type: "scatter",
    data: {
      datasets: [{
        label: "Bonos HD",
        data: points.map((point) => ({ x: point.md, y: point.tir, ticker: point.ticker })),
        borderColor: "#4fa3c7",
        backgroundColor: "#4fa3c788",
        pointRadius: 5,
        pointHoverRadius: 7,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#101923",
          borderColor: "#263545",
          borderWidth: 1,
          callbacks: {
            label: (context) => {
              const raw = context.raw;
              return `${raw.ticker}: MD ${raw.x.toFixed(2)} / TIR ${raw.y.toFixed(2)}%`;
            },
          },
        },
      },
      scales: {
        x: { title: { display: true, text: "Modified duration" } },
        y: { title: { display: true, text: "TIR" } },
      },
    },
  });
}

function calculateRollingZScore(points, windowSize = 20) {
  const size = Math.max(Number(windowSize) || 20, 2);
  return points.map((point, index) => {
    if (index + 1 < size) return { ...point, zscore: null };
    const windowPoints = points.slice(index + 1 - size, index + 1);
    const values = windowPoints.map((item) => item.value);
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
    const stdev = Math.sqrt(variance);
    return { ...point, zscore: stdev === 0 ? null : (point.value - mean) / stdev };
  });
}

function calculateSpread(seriesA, seriesB) {
  const bByDate = new Map(seriesB.map((point) => [point.date, point.value]));
  return seriesA
    .filter((point) => bByDate.has(point.date))
    .map((point) => ({ date: point.date, value: point.value - bByDate.get(point.date) }));
}

async function loadAvailableSeries() {
  try {
    const response = await fetch("/api/historical-data?limit=1");
    if (!response.ok) throw new Error("No historical endpoint");
    const payload = await response.json();
    availableSeries = payload.series || [];
  } catch {
    availableSeries = [];
  }
}

function populateTickerSelects() {
  const tickers = [...new Set(availableSeries.map((item) => item.ticker))].sort();
  const fallback = ["AL30", "GD30", "AL35", "GD35", "AE38", "AL41"];
  const options = (tickers.length ? tickers : fallback)
    .map((ticker) => `<option value="${ticker}">${ticker}</option>`)
    .join("");
  chartTickerA.innerHTML = options;
  chartTickerB.innerHTML = options;
  chartTickerB.selectedIndex = Math.min(1, chartTickerB.options.length - 1);
}

async function fetchSeries(ticker) {
  const params = new URLSearchParams({
    ticker,
    metric_type: chartMetric.value,
    price_market: chartMarket.value,
    settlement_type: chartSettlement.value,
    limit: "5000",
  });
  const response = await fetch(`/api/historical-data?${params.toString()}`);
  if (!response.ok) return [];
  const payload = await response.json();
  return (payload.items || [])
    .map((item) => ({ date: item.value_date, value: Number(item.value) }))
    .filter((item) => Number.isFinite(item.value))
    .reverse();
}

async function drawAllCharts() {
  chartStatus.textContent = "Cargando datos";
  const [realA, realB] = await Promise.all([
    fetchSeries(chartTickerA.value),
    fetchSeries(chartTickerB.value),
  ]);
  const hasRealData = realA.length > 1 && realB.length > 1;
  const seriesA = hasRealData ? realA : mockSeriesA;
  const seriesB = hasRealData ? realB : mockSeriesB;
  const spread = calculateSpread(seriesA, seriesB);
  const zscores = calculateRollingZScore(spread, Number(zscoreWindow.value));
  const latest = [...zscores].reverse().find((point) => point.zscore !== null);

  destroyChart(lineChart);
  destroyChart(spreadChart);
  destroyChart(zscoreChart);
  destroyChart(curveChart);

  lineTitle.textContent = `${chartTickerA.value} - ${metricLabels[chartMetric.value] || chartMetric.value}`;
  lineSource.textContent = hasRealData ? "historicos" : "mock";
  latestZScore.textContent = latest ? latest.zscore.toFixed(2) : "-";

  lineChart = makeLineChart("lineChart", seriesA, chartTickerA.value, "#4fa3c7");
  spreadChart = makeLineChart("spreadChart", spread, "Spread", "#7fb069");
  zscoreChart = makeZScoreChart(zscores);
  curveChart = makeCurveChart(mockCurve);

  chartStatus.textContent = hasRealData
    ? "Graficos con datos historicos cargados"
    : "No hubo dos series compatibles; mostrando datos mock";
}

async function initChartsDemo() {
  chartDefaults();
  await loadAvailableSeries();
  populateTickerSelects();
  await drawAllCharts();
}

drawCharts.addEventListener("click", () => {
  drawAllCharts().catch(() => {
    chartStatus.textContent = "No se pudieron graficar los datos";
  });
});

initChartsDemo().catch(() => {
  chartStatus.textContent = "No se pudo inicializar la demo";
});
