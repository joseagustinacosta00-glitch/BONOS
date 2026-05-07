(function () {
  "use strict";

  console.log("[fx] v=hd80 loaded");

  // ============================================================
  // Estado global del módulo
  // ============================================================
  const state = {
    showAvg: loadPref("mt:fx:show_avg", false),
    avgWindows: loadPref("mt:fx:avg_windows", [5, 60]),
    brechaFilters: loadPref("mt:fx:brecha_filters", {
      op: ["spread"],
      num: ["MEP"],
      den: ["Spot"],
    }),
    chartTc: loadPref("mt:fx:chart_tc", { instr: "MEP", field: "last", period: "1M" }),
    chartBr: loadPref("mt:fx:chart_br", { op: "relativo", num: "CCL", den: "Spot", period: "1M" }),
    snapshot: null,
    prevClose: { spot: null, mep: null, ccl: null }, // intra-sesion: primer valor visto del dia
    samples: { t0: [], t1: [] },                      // muestras en memoria para promedios moviles
    averages: { 5: null, 60: null },
  };

  function loadPref(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch { return fallback; }
  }
  function savePref(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
  }

  // ============================================================
  // Formatters
  // ============================================================
  const fmtAR = (n, dec = 2) => Number(n).toLocaleString("es-AR", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });
  const fmtPct = (n, dec = 2) => `${n >= 0 ? "+ " : "− "}${fmtAR(Math.abs(n), dec)} %`;
  const fmtSigned = (n, dec = 2) => `${n >= 0 ? "+ " : "− "}${fmtAR(Math.abs(n), dec)}`;
  const fmtTime = (d) => d.toLocaleTimeString("es-AR", { hour12: false });
  const fmtDate = (d) => {
    const days = ["DOM","LUN","MAR","MIÉ","JUE","VIE","SÁB"];
    const months = ["ENE","FEB","MAR","ABR","MAY","JUN","JUL","AGO","SEP","OCT","NOV","DIC"];
    return `${days[d.getDay()]} · ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  };
  function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }
  function formatIsoTime(iso) {
    if (!iso) return "";
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString("es-AR", { hour12: false });
    } catch { return ""; }
  }
  function formatIsoDate(iso) {
    if (!iso) return "";
    const parts = String(iso).split("-");
    if (parts.length !== 3) return iso;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  // ============================================================
  // Reloj y fecha del header
  // ============================================================
  function tickClock() {
    const now = new Date();
    const dEl = document.getElementById("fxDate");
    const cEl = document.getElementById("fxClock");
    if (dEl) dEl.textContent = fmtDate(now);
    if (cEl) cEl.textContent = fmtTime(now);
  }
  setInterval(tickClock, 1000);
  tickClock();

  // ============================================================
  // Toggle de promedios
  // ============================================================
  function initPromToggle() {
    const tog = document.getElementById("fxPromToggle");
    const inputs = document.getElementById("fxPromInputs");
    if (!tog || !inputs) return;

    function apply() {
      tog.classList.toggle("is-on", state.showAvg);
      inputs.hidden = !state.showAvg;
      renderTables();
    }
    apply();

    tog.addEventListener("click", () => {
      state.showAvg = !state.showAvg;
      savePref("mt:fx:show_avg", state.showAvg);
      apply();
    });

    const inputA = document.getElementById("fxPromA");
    const inputB = document.getElementById("fxPromB");
    inputA.value = state.avgWindows[0];
    inputB.value = state.avgWindows[1];

    let timer;
    [inputA, inputB].forEach((el) => {
      el.addEventListener("input", () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          const a = Math.max(1, parseInt(inputA.value) || 5);
          const b = Math.max(1, parseInt(inputB.value) || 60);
          state.avgWindows = [a, b];
          savePref("mt:fx:avg_windows", state.avgWindows);
          recomputeAverages();
          renderTables();
        }, 300);
      });
    });
  }

  // ============================================================
  // Filtros chips (componente reutilizable)
  // ============================================================
  function initChipBar(barId, onChange) {
    const bar = document.getElementById(barId);
    if (!bar) return;
    bar.querySelectorAll(".fx-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        const dim = chip.getAttribute("data-dim");
        const isMulti = bar.getAttribute("data-chip-group") === "brecha";
        if (isMulti) {
          // Multi: no permitir vaciar dim (siempre minimo 1)
          const sameDim = bar.querySelectorAll(`.fx-chip[data-dim="${dim}"].is-active`);
          if (chip.classList.contains("is-active") && sameDim.length === 1) return;
          chip.classList.toggle("is-active");
        } else {
          bar.querySelectorAll(`.fx-chip[data-dim="${dim}"]`).forEach((c) => c.classList.remove("is-active"));
          chip.classList.add("is-active");
        }
        onChange(readChipBar(bar, isMulti));
      });
    });
  }

  function readChipBar(bar, isMulti) {
    const out = {};
    bar.querySelectorAll(".fx-chip.is-active").forEach((chip) => {
      const dim = chip.getAttribute("data-dim");
      const val = chip.getAttribute("data-val");
      if (isMulti) {
        if (!out[dim]) out[dim] = [];
        out[dim].push(val);
      } else {
        out[dim] = val;
      }
    });
    return out;
  }

  // ============================================================
  // Brechas
  // ============================================================
  function calcBrecha(numerador, denominador, op) {
    if (numerador == null || denominador == null) return null;
    if (op === "spread") return numerador - denominador;
    if (op === "relativo") return denominador !== 0 ? ((numerador / denominador) - 1) * 100 : null;
    return null;
  }

  function getValueForLeg(leg) {
    const s = state.snapshot;
    if (!s) return null;
    if (leg === "Spot") return s.spot;
    if (leg === "DLK") return s.dlk;
    if (leg === "DLK_LF") return s.dlk_lecap_fut;
    if (leg === "MEP") return s.mep && s.mep.last;
    if (leg === "CCL") return s.ccl && s.ccl.last;
    return null;
  }

  function renderBrechas() {
    const grid = document.getElementById("fxBrechasGrid");
    if (!grid) return;

    const f = state.brechaFilters;
    const ops = f.op || [];
    const nums = f.num || [];
    const dens = f.den || [];

    const cells = [];
    ops.forEach((op) => {
      nums.forEach((num) => {
        dens.forEach((den) => {
          const numVal = getValueForLeg(num);
          const denVal = getValueForLeg(den);
          const val = calcBrecha(numVal, denVal, op);
          const opLbl = op === "spread" ? "Spread" : "Relativo";
          const denLbl = den === "DLK_LF" ? "DLK L+F" : den;
          cells.push({ label: `${opLbl} ${num} / ${denLbl}`, val, op });
        });
      });
    });

    while (cells.length < 4) cells.push({ label: "—", val: null, filtered: true });

    grid.innerHTML = cells.slice(0, 6).map((c) => {
      if (c.filtered || c.val == null) {
        return `<div>
          <p class="fx-brecha-cell-label">${escapeHtml(c.label)}</p>
          <p class="fx-brecha-cell-val fx-num is-filtered">— filtrado</p>
        </div>`;
      }
      const isPct = c.op === "relativo";
      const sign = c.val >= 0 ? "+ " : "− ";
      const num = isPct ? fmtAR(Math.abs(c.val), 2) + " %" : fmtAR(Math.abs(c.val), 2);
      const unit = isPct ? "" : `<span class="fx-brecha-unit">ARS</span>`;
      return `<div>
        <p class="fx-brecha-cell-label">${escapeHtml(c.label)}</p>
        <p class="fx-brecha-cell-val fx-num">${sign}${num} ${unit}</p>
      </div>`;
    }).join("");
  }

  // ============================================================
  // Tablas T+0 / T+1
  // ============================================================
  function renderTableHead(trEl, withAvg) {
    if (!trEl) return;
    const cols = [
      `<th class="first">Instr.</th>`,
      `<th>Bid</th>`,
      `<th>Last</th>`,
      `<th>Offer</th>`,
    ];
    if (withAvg) {
      cols.push(`<th>Δ d-1</th>`);
      cols.push(`<th class="prom">${state.avgWindows[0]}m</th>`);
      cols.push(`<th class="prom last">${state.avgWindows[1]}m</th>`);
    } else {
      cols.push(`<th class="last">Δ d-1</th>`);
    }
    trEl.innerHTML = cols.join("");
  }

  function renderTableBody(tableId, settlement) {
    const tbody = document.querySelector(`#${tableId} tbody`);
    if (!tbody) return;
    const s = state.snapshot;
    if (!s) { tbody.innerHTML = ""; return; }
    const data = s[settlement] || {};
    const withAvg = state.showAvg;

    const rows = ["MEP", "CCL", "Canje"].map((instr) => {
      const r = data[instr.toLowerCase()] || {};
      const isPct = instr === "Canje";
      const fmt = isPct ? (n) => `${fmtAR(n, 2)} %` : (n) => fmtAR(n, 2);
      const deltaCls = r.delta_abs != null
        ? (r.delta_abs > 0 ? "delta-up" : r.delta_abs < 0 ? "delta-down" : "")
        : "";
      const deltaSign = r.delta_abs > 0 ? "+ " : r.delta_abs < 0 ? "− " : "";
      const deltaAbs = r.delta_abs != null ? `${deltaSign}${fmtAR(Math.abs(r.delta_abs), 2)}` : "—";
      const deltaPct = isPct
        ? `<span class="pct">pp</span>`
        : (r.delta_pct != null ? `<span class="pct">${r.delta_pct >= 0 ? "+" : "−"} ${fmtAR(Math.abs(r.delta_pct), 2)}%</span>` : "");

      let html = `<tr>
        <td class="first">${instr}</td>
        <td>${r.bid != null ? fmt(r.bid) : "—"}</td>
        <td>${r.last != null ? fmt(r.last) : "—"}</td>
        <td>${r.offer != null ? fmt(r.offer) : "—"}</td>`;
      const deltaClsFull = `${deltaCls}${withAvg ? "" : " last"}`;
      html += `<td class="${deltaClsFull}">${deltaAbs}${deltaPct}</td>`;
      if (withAvg) {
        const wA = state.avgWindows[0];
        const wB = state.avgWindows[1];
        const valA = state.averages[wA] && state.averages[wA][settlement] && state.averages[wA][settlement][instr.toLowerCase()];
        const valB = state.averages[wB] && state.averages[wB][settlement] && state.averages[wB][settlement][instr.toLowerCase()];
        html += `<td class="prom">${valA != null ? fmt(valA) : "—"}</td>`;
        html += `<td class="prom last">${valB != null ? fmt(valB) : "—"}</td>`;
      }
      html += `</tr>`;
      return html;
    }).join("");
    tbody.innerHTML = rows;
  }

  function renderTables() {
    if (!state.snapshot) return;
    renderTableHead(document.getElementById("fxT0Head"), state.showAvg);
    renderTableHead(document.getElementById("fxT1Head"), state.showAvg);
    renderTableBody("fxTableT0", "t0");
    renderTableBody("fxTableT1", "t1");
  }

  // Promedios moviles in-memory (las muestras se acumulan con cada poll)
  function pushSample(settlement, snap) {
    const ts = Date.now();
    const sample = {
      ts,
      mep:   snap[settlement] && snap[settlement].mep   ? snap[settlement].mep.last   : null,
      ccl:   snap[settlement] && snap[settlement].ccl   ? snap[settlement].ccl.last   : null,
      canje: snap[settlement] && snap[settlement].canje ? snap[settlement].canje.last : null,
    };
    state.samples[settlement].push(sample);
    // Limitar buffer (4 horas máx asumiendo poll cada 5s = 2880 samples)
    const MAX = 5000;
    if (state.samples[settlement].length > MAX) {
      state.samples[settlement] = state.samples[settlement].slice(-MAX);
    }
  }

  function recomputeAverages() {
    const now = Date.now();
    state.averages = {};
    [state.avgWindows[0], state.avgWindows[1]].forEach((minutes) => {
      const cutoff = now - minutes * 60 * 1000;
      const acc = { t0: { mep: [], ccl: [], canje: [] }, t1: { mep: [], ccl: [], canje: [] } };
      ["t0", "t1"].forEach((settlement) => {
        for (const s of state.samples[settlement]) {
          if (s.ts < cutoff) continue;
          if (s.mep   != null) acc[settlement].mep.push(s.mep);
          if (s.ccl   != null) acc[settlement].ccl.push(s.ccl);
          if (s.canje != null) acc[settlement].canje.push(s.canje);
        }
      });
      const avg = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
      state.averages[minutes] = {
        t0: { mep: avg(acc.t0.mep), ccl: avg(acc.t0.ccl), canje: avg(acc.t0.canje) },
        t1: { mep: avg(acc.t1.mep), ccl: avg(acc.t1.ccl), canje: avg(acc.t1.canje) },
      };
    });
  }

  // ============================================================
  // Spot / A3500
  // ============================================================
  function renderSpotAndA3500() {
    const s = state.snapshot;
    if (!s) return;
    const sv = document.getElementById("fxSpotValue");
    const sts = document.getElementById("fxSpotTs");
    const sda = document.getElementById("fxSpotDeltaAbs");
    const sdp = document.getElementById("fxSpotDeltaPct");
    if (sv) sv.textContent = s.spot != null ? fmtAR(s.spot, 2) : "—";
    if (sts) sts.textContent = s.spot_ts || "—";
    if (sda) sda.textContent = s.spot_delta_abs != null ? fmtSigned(s.spot_delta_abs, 2) : "";
    if (sdp) sdp.textContent = s.spot_delta_pct != null ? `(${fmtPct(s.spot_delta_pct, 2)})` : "";

    const av = document.getElementById("fxA3500Value");
    const am = document.getElementById("fxA3500Meta");
    if (av) av.textContent = s.a3500 != null ? fmtAR(s.a3500, 2) : "—";
    if (am) am.textContent = s.a3500_meta || "—";
  }

  // ============================================================
  // Charts (placeholder hasta tener historico)
  // ============================================================
  let _chartTc = null;
  let _chartBr = null;

  function makePlaceholderData() {
    // Genera una serie sintetica solo para que el chart se vea.
    // Cuando exista endpoint historico real, reemplazar por fetch.
    const N = 30;
    const out = [];
    let v = 100;
    for (let i = 0; i < N; i++) {
      v += (Math.random() - 0.5) * 1.2;
      out.push({ x: i, y: v });
    }
    return out;
  }

  function renderChart(canvasId, color, title) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || typeof Chart === "undefined") return null;
    const data = makePlaceholderData();
    const ctx = canvas.getContext("2d");
    return new Chart(ctx, {
      type: "line",
      data: {
        labels: data.map(d => d.x),
        datasets: [{
          data: data.map(d => d.y),
          borderColor: color,
          backgroundColor: color + "14",
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0.25,
          fill: true,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: { legend: { display: false }, tooltip: { enabled: true } },
        scales: {
          x: { display: false },
          y: { ticks: { font: { size: 9 }, color: "#8A8470" }, grid: { color: "rgba(184,174,149,0.15)" } },
        },
      },
    });
  }

  function updateChartTitles() {
    const tcTitle = document.getElementById("fxChartTcTitle");
    if (tcTitle) {
      tcTitle.innerHTML = `${state.chartTc.instr} <span class="fx-muted-italic-sm">${state.chartTc.field} · ${state.chartTc.period}</span>`;
    }
    const brTitle = document.getElementById("fxChartBrTitle");
    if (brTitle) {
      const opLbl = state.chartBr.op === "spread" ? "Spread" : "Relativo";
      brTitle.innerHTML = `${opLbl} ${state.chartBr.num} / ${state.chartBr.den} <span class="fx-muted-italic-sm">· ${state.chartBr.period}</span>`;
    }
  }

  // ============================================================
  // Fetch del snapshot desde el backend actual
  // ============================================================
  async function fetchSnapshot() {
    try {
      const [rs, rr] = await Promise.all([
        fetch("/api/fx/spot",   { credentials: "same-origin" }),
        fetch("/api/fx/ratios", { credentials: "same-origin" }),
      ]);
      const spotJson = rs.ok ? await rs.json() : null;
      const ratJson  = rr.ok ? await rr.json() : null;

      // Spot live + A3500
      const spotLive = spotJson && (spotJson.spot_live || spotJson.spot);
      const a3500    = spotJson && spotJson.a3500;
      const spot     = spotLive && spotLive.last != null ? Number(spotLive.last) : null;

      if (state.prevClose.spot == null && spot != null) state.prevClose.spot = spot;

      // Ratios MEP / CCL
      const items = (ratJson && ratJson.items) || [];
      const findByLabel = (lbl) => items.find(it => String(it.label || "").toUpperCase() === lbl);
      const mepIt = findByLabel("MEP");
      const cclIt = findByLabel("CCL");
      const mepLast = mepIt && mepIt.ratio != null ? Number(mepIt.ratio) : null;
      const cclLast = cclIt && cclIt.ratio != null ? Number(cclIt.ratio) : null;

      if (state.prevClose.mep == null && mepLast != null) state.prevClose.mep = mepLast;
      if (state.prevClose.ccl == null && cclLast != null) state.prevClose.ccl = cclLast;

      const canje = (mepLast != null && cclLast != null && mepLast !== 0)
        ? ((cclLast / mepLast) - 1) * 100
        : null;

      function makeRow(last, prev) {
        if (last == null) return null;
        const dAbs = prev != null ? last - prev : null;
        const dPct = prev != null && prev !== 0 ? (last / prev - 1) * 100 : null;
        return { bid: null, last, offer: null, delta_abs: dAbs, delta_pct: dPct };
      }

      // Por ahora T+0 y T+1 usan las mismas cotizaciones (no tenemos
      // settlement-specific FX en el backend actual).
      const mepRow   = makeRow(mepLast, state.prevClose.mep);
      const cclRow   = makeRow(cclLast, state.prevClose.ccl);
      const canjeRow = canje != null
        ? { bid: null, last: canje, offer: null, delta_abs: null, delta_pct: null }
        : null;

      state.snapshot = {
        spot,
        spot_ts: spotLive && spotLive.updated_at ? formatIsoTime(spotLive.updated_at) : null,
        spot_delta_abs: spot != null && state.prevClose.spot != null ? spot - state.prevClose.spot : null,
        spot_delta_pct: spot != null && state.prevClose.spot != null && state.prevClose.spot !== 0
          ? (spot / state.prevClose.spot - 1) * 100 : null,
        a3500: a3500 && a3500.last != null ? Number(a3500.last) : null,
        a3500_meta: a3500
          ? `Comunicación A 3500 · ${formatIsoDate(a3500.value_date || "")}`
          : null,
        mep:  mepRow ? { ...mepRow, last: mepLast } : null,
        ccl:  cclRow ? { ...cclRow, last: cclLast } : null,
        // dlk / dlk_lecap_fut: pendientes de endpoint dedicado
        dlk: null,
        dlk_lecap_fut: null,
        t0: { mep: mepRow, ccl: cclRow, canje: canjeRow },
        t1: { mep: mepRow, ccl: cclRow, canje: canjeRow },
      };

      // Push samples para promedios
      pushSample("t0", state.snapshot);
      pushSample("t1", state.snapshot);
      recomputeAverages();

      renderAll();
    } catch (err) {
      console.error("[fx] fetchSnapshot fallo", err);
    }
  }

  // ============================================================
  // Render orquestado
  // ============================================================
  function renderAll() {
    renderSpotAndA3500();
    renderBrechas();
    renderTables();
  }

  // ============================================================
  // Init
  // ============================================================
  function init() {
    initPromToggle();

    // Brechas (multi-select)
    initChipBar("fxBrechaChips", (vals) => {
      state.brechaFilters = vals;
      savePref("mt:fx:brecha_filters", vals);
      renderBrechas();
    });

    // Charts (single-select)
    initChipBar("fxChartTcChips", (vals) => {
      state.chartTc = { ...state.chartTc, ...vals };
      savePref("mt:fx:chart_tc", state.chartTc);
      updateChartTitles();
    });
    initChipBar("fxChartBrChips", (vals) => {
      state.chartBr = { ...state.chartBr, ...vals };
      savePref("mt:fx:chart_br", state.chartBr);
      updateChartTitles();
    });

    // Tabs de período (charts)
    document.querySelectorAll(".fx-period-tabs").forEach((bar) => {
      const which = bar.getAttribute("data-chart");
      bar.querySelectorAll(".fx-tab").forEach((tab) => {
        tab.addEventListener("click", () => {
          bar.querySelectorAll(".fx-tab").forEach(t => t.classList.remove("is-active"));
          tab.classList.add("is-active");
          const period = tab.getAttribute("data-period");
          if (which === "tc") {
            state.chartTc.period = period;
            savePref("mt:fx:chart_tc", state.chartTc);
          } else if (which === "br") {
            state.chartBr.period = period;
            savePref("mt:fx:chart_br", state.chartBr);
          }
          updateChartTitles();
        });
      });
    });

    // Inicializar charts con placeholder data
    _chartTc = renderChart("fxChartTc", "#1F3D2E");
    _chartBr = renderChart("fxChartBr", "#C9A961");
    updateChartTitles();

    // Primera carga + polling
    fetchSnapshot();
    setInterval(fetchSnapshot, 5000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
