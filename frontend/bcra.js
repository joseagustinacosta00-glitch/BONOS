(function () {
  "use strict";
  console.log("[bcra] v=hd82 loaded");

  const SERIES_DEFS = {
    cer: {
      label: "CER",
      title: "CER · Coeficiente de Estabilización de Referencia",
      decimals: 6,
      unit: "Indice base 2.2.02=1",
    },
    tamar_private_banks_na: {
      label: "TAMAR",
      title: "TAMAR · Bancos privados (% n.a.)",
      decimals: 4,
      unit: "% nominal anual",
    },
    usd_mayorista_a3500: {
      label: "A3500",
      title: "USD Mayorista · Comunicación A 3500",
      decimals: 4,
      unit: "ARS por USD",
    },
  };

  const state = {
    seriesKey: localStorage.getItem("mt:bcra:series") || "cer",
    period: localStorage.getItem("mt:bcra:period") || "90",
    chart: null,
    raw: [],
  };

  const fmtAR = (n, dec = 2) => Number(n).toLocaleString("es-AR", {
    minimumFractionDigits: dec, maximumFractionDigits: dec,
  });
  const fmtTime = (d) => d.toLocaleTimeString("es-AR", { hour12: false });
  const fmtDate = (d) => {
    const days = ["DOM","LUN","MAR","MIÉ","JUE","VIE","SÁB"];
    const months = ["ENE","FEB","MAR","ABR","MAY","JUN","JUL","AGO","SEP","OCT","NOV","DIC"];
    return `${days[d.getDay()]} · ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  };
  function formatIsoDate(iso) {
    if (!iso) return "—";
    const parts = String(iso).split("-");
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : iso;
  }

  function tickClock() {
    const now = new Date();
    const dEl = document.getElementById("bcraDate");
    const cEl = document.getElementById("bcraClock");
    if (dEl) dEl.textContent = fmtDate(now);
    if (cEl) cEl.textContent = fmtTime(now);
  }
  setInterval(tickClock, 1000);
  tickClock();

  function syncChips() {
    document.querySelectorAll("#bcraSeriesChips .fx-chip").forEach((c) => {
      c.classList.toggle("is-active", c.getAttribute("data-val") === state.seriesKey);
    });
    document.querySelectorAll("#bcraPeriodTabs .fx-tab").forEach((t) => {
      t.classList.toggle("is-active", t.getAttribute("data-period") === state.period);
    });
  }

  function _periodWindow(periodDays) {
    const days = parseInt(periodDays, 10);
    if (!days || days <= 0) return null; // "Todo"
    const hasta = new Date();
    const desde = new Date();
    desde.setDate(desde.getDate() - days);
    const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return { desde: iso(desde), hasta: iso(hasta) };
  }

  function makeChart(canvas) {
    if (!canvas || !window.Chart) return null;
    return new Chart(canvas.getContext("2d"), {
      type: "line",
      data: { labels: [], datasets: [{
        data: [], borderColor: "#1F3D2E", borderWidth: 1.5,
        pointRadius: 0, pointHoverRadius: 4, pointHoverBackgroundColor: "#C9A961",
        fill: true, backgroundColor: "rgba(31,61,46,0.06)", tension: 0.2,
      }]},
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "#FBF9F2", borderColor: "#D4CBB3", borderWidth: 0.5,
            titleColor: "#2A3528", bodyColor: "#6B6452", displayColors: false,
            titleFont: { family: "Georgia, serif", size: 11 },
            bodyFont:  { family: "Georgia, serif", size: 11 },
            padding: 8,
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              color: "#8A8470",
              font: { family: "Georgia, serif", size: 10 },
              maxRotation: 0, autoSkipPadding: 24,
            },
          },
          y: {
            grid: { color: "#E8DFC8", drawBorder: false },
            ticks: {
              color: "#8A8470",
              font: { family: "-apple-system, sans-serif", size: 10 },
            },
          },
        },
      },
    });
  }

  function renderAll() {
    const def = SERIES_DEFS[state.seriesKey];
    if (!def) return;

    const labelEl = document.getElementById("bcraCardLabel");
    if (labelEl) labelEl.textContent = def.label;
    const titleEl = document.getElementById("bcraChartTitle");
    if (titleEl) titleEl.textContent = def.title;
    const unitEl = document.getElementById("bcraChartUnit");
    if (unitEl) unitEl.textContent = def.unit;

    const points = state.raw.slice().sort((a, b) => String(a.date).localeCompare(String(b.date)));
    if (!points.length) {
      _setText("bcraLastValue", "—");
      _setText("bcraLastMeta", "Sin datos");
      _setText("bcraDelta", "—");
      _setText("bcraDeltaMeta", "—");
      _setText("bcraMinMax", "— / —");
      _setText("bcraSamplesCount", "0 puntos");
      _renderTable([]);
      _renderChart([], def);
      return;
    }

    const last = points[points.length - 1];
    const first = points[0];
    const values = points.map((p) => Number(p.value));
    const min = Math.min(...values);
    const max = Math.max(...values);

    _setText("bcraLastValue", fmtAR(last.value, def.decimals));
    _setText("bcraLastMeta", `${formatIsoDate(last.date)}`);

    const delta = first.value !== 0 ? ((last.value / first.value) - 1) * 100 : null;
    if (delta != null) {
      const sign = delta >= 0 ? "+ " : "− ";
      _setText("bcraDelta", `${sign}${fmtAR(Math.abs(delta), 2)} %`);
      const ld = document.getElementById("bcraDelta");
      if (ld) ld.style.color = delta >= 0 ? "var(--mt-up)" : "var(--mt-down)";
    } else {
      _setText("bcraDelta", "—");
    }
    _setText("bcraDeltaMeta", `${formatIsoDate(first.date)} → ${formatIsoDate(last.date)}`);

    _setText("bcraMinMax", `${fmtAR(min, def.decimals)}  /  ${fmtAR(max, def.decimals)}`);
    _setText("bcraSamplesCount", `${points.length} puntos en el período`);

    _renderTable(points.slice(-30).reverse(), def);
    _renderChart(points, def);
  }

  function _setText(id, txt) {
    const el = document.getElementById(id);
    if (el) el.textContent = txt;
  }

  function _renderTable(points, def) {
    const body = document.getElementById("bcraTableBody");
    if (!body) return;
    if (!points.length) {
      body.innerHTML = '<tr><td colspan="2" style="text-align:center;color:var(--mt-muted);font-style:italic;padding:14px;">Sin puntos</td></tr>';
      return;
    }
    body.innerHTML = points.map((p) => `
      <tr>
        <td class="first">${formatIsoDate(p.date)}</td>
        <td class="last">${fmtAR(p.value, def.decimals)}</td>
      </tr>
    `).join("");
  }

  function _renderChart(points, def) {
    const canvas = document.getElementById("bcraChart");
    if (!state.chart) state.chart = makeChart(canvas);
    if (!state.chart) return;

    const labels = points.map((p) => formatIsoDate(p.date));
    const data = points.map((p) => Number(p.value));
    state.chart.data.labels = labels;
    state.chart.data.datasets[0].data = data;
    state.chart.update();
  }

  async function fetchSeries() {
    const def = SERIES_DEFS[state.seriesKey];
    if (!def) return;
    const wnd = _periodWindow(state.period);
    const params = new URLSearchParams({ limit: "3000" });
    if (wnd) {
      params.set("desde", wnd.desde);
      params.set("hasta", wnd.hasta);
    }
    try {
      const r = await fetch(`/api/bcra/series/${state.seriesKey}?${params.toString()}`, {
        credentials: "same-origin",
      });
      if (!r.ok) throw new Error("http " + r.status);
      const j = await r.json();
      // Backend devuelve { data: [{date, value}], ... } — defensivo por si la key es distinta
      state.raw = j.data || j.points || j.items || [];
      renderAll();
    } catch (err) {
      console.error("[bcra] fetch error", err);
      state.raw = [];
      renderAll();
    }
  }

  function init() {
    syncChips();

    document.querySelectorAll("#bcraSeriesChips .fx-chip").forEach((c) => {
      c.addEventListener("click", () => {
        state.seriesKey = c.getAttribute("data-val");
        try { localStorage.setItem("mt:bcra:series", state.seriesKey); } catch {}
        syncChips();
        fetchSeries();
      });
    });

    document.querySelectorAll("#bcraPeriodTabs .fx-tab").forEach((t) => {
      t.addEventListener("click", () => {
        state.period = t.getAttribute("data-period");
        try { localStorage.setItem("mt:bcra:period", state.period); } catch {}
        syncChips();
        fetchSeries();
      });
    });

    fetchSeries();
    // Refrescamos cada 5 min — la BCRA actualiza una vez por día.
    setInterval(fetchSeries, 5 * 60 * 1000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
