(function () {
  "use strict";

  console.log("[fx] v=hd86 loaded");

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
    chartTc: loadPref("mt:fx:chart_tc", { instr: "MEP", field: "last", period: "1M", scale: "linear" }),
    chartBr: loadPref("mt:fx:chart_br", { op: "relativo", num: "CCL", den: "Spot", period: "1M", scale: "linear" }),
    snapshot: null,
    averages: { 5: null, 60: null },
    // Tracking local para deltas (los endpoints actuales no devuelven prev close)
    prevClose: { spot: null, mep: null, ccl: null },
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
  // ADAPTER LAYER
  // ============================================================
  // Tus endpoints actuales son /api/fx/spot y /api/fx/ratios.
  // Este adapter convierte sus respuestas al "shape canónico" que
  // espera el resto del módulo. Si el shape no coincide, ajustá
  // SOLO estas funciones — el resto del archivo no se toca.
  //
  // Shape canónico esperado:
  // {
  //   spot, spot_ts, spot_delta_abs, spot_delta_pct,
  //   a3500, a3500_meta,
  //   dlk, dlk_lecap_fut,
  //   mep:  { bid, last, offer },
  //   ccl:  { bid, last, offer },
  //   t0: { mep:{bid,last,offer,delta_abs,delta_pct}, ccl:{...}, canje:{...} },
  //   t1: { ... }
  // }
  // ============================================================

  function adaptSpotResponse(raw) {
    if (!raw) return {};

    // Caso real (Marketerminal v1): /api/fx/spot devuelve objetos anidados
    //   { spot_live: {last, updated_at, ...}, a3500: {last, value_date, ...}, ... }
    const live = raw.spot_live || raw.spot || null;
    const a35  = raw.a3500 || null;

    let spot = null;
    let spotTs = null;
    if (live && typeof live === "object") {
      spot = pick(live, ["last", "value", "spot"]);
      const updated = pick(live, ["updated_at", "ts", "timestamp"]);
      if (updated) {
        try {
          spotTs = typeof updated === "string" && /\d{2}:\d{2}/.test(updated)
            ? new Date(updated).toLocaleTimeString("es-AR", { hour12: false })
            : String(updated);
        } catch { spotTs = String(updated); }
      }
    }
    // Fallback: si raw es un objeto plano con spot directo
    if (spot == null) spot = pick(raw, ["spot", "last", "value", "spot_value"]);
    if (spotTs == null) spotTs = pick(raw, ["spot_ts", "ts", "timestamp"]);

    let a3500 = null;
    let a3500Meta = null;
    if (a35 && typeof a35 === "object") {
      a3500 = pick(a35, ["last", "value"]);
      const vd = pick(a35, ["value_date", "date"]);
      if (vd) {
        const parts = String(vd).split("-");
        const fmtVd = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : vd;
        a3500Meta = `Comunicación A 3500 · ${fmtVd}`;
      } else {
        a3500Meta = "Comunicación A 3500";
      }
    }
    // Fallback plano
    if (a3500 == null) a3500 = pick(raw, ["a3500", "comunicacion_a3500"]);
    if (a3500Meta == null) a3500Meta = pick(raw, ["a3500_meta", "a3500_publicado"]);

    return {
      spot,
      spot_ts: spotTs,
      // El backend actual no expone delta vs prev close — lo trackeamos local en updateDeltasFromSnapshot.
      spot_delta_abs: pick(raw, ["spot_delta_abs", "delta_abs"]),
      spot_delta_pct: pick(raw, ["spot_delta_pct", "delta_pct"]),
      a3500,
      a3500_meta: a3500Meta,
      dlk: pick(raw, ["dlk"]),
      dlk_lecap_fut: pick(raw, ["dlk_lecap_fut", "dlk_lf", "dlk_LF"]),
    };
  }

  function adaptRatiosResponse(raw) {
    if (!raw) return { mep: {}, ccl: {}, t0: {}, t1: {} };

    // Caso A: el endpoint devuelve { t0: {...}, t1: {...} } directamente
    if (raw.t0 || raw.t1) {
      return {
        mep: extractInstr(raw.t0, "mep"),
        ccl: extractInstr(raw.t0, "ccl"),
        t0: normalizeTBlock(raw.t0),
        t1: normalizeTBlock(raw.t1),
      };
    }

    // Caso B: devuelve mep_t0, ccl_t0, canje_t0, mep_t1, etc.
    if (raw.mep_t0 || raw.ccl_t0) {
      return {
        mep: raw.mep_t0 || {},
        ccl: raw.ccl_t0 || {},
        t0: {
          mep:   raw.mep_t0   || {},
          ccl:   raw.ccl_t0   || {},
          canje: raw.canje_t0 || {},
        },
        t1: {
          mep:   raw.mep_t1   || {},
          ccl:   raw.ccl_t1   || {},
          canje: raw.canje_t1 || {},
        },
      };
    }

    // Caso C: shape plano (mep, ccl, canje) — asumimos T+0
    if (raw.mep || raw.ccl) {
      return {
        mep: raw.mep || {},
        ccl: raw.ccl || {},
        t0: {
          mep:   raw.mep   || {},
          ccl:   raw.ccl   || {},
          canje: raw.canje || {},
        },
        t1: {},
      };
    }

    // Caso D: Marketerminal v1 — items: [{ label: "MEP"|"CCL", ratio, ratio_bid, ratio_offer, ... }]
    if (Array.isArray(raw.items)) {
      const findByLabel = (lbl) => raw.items.find(it => String(it.label || "").toUpperCase() === lbl);
      const mepIt = findByLabel("MEP");
      const cclIt = findByLabel("CCL");
      const num = (v) => v != null && isFinite(v) ? Number(v) : null;

      const mepLast  = mepIt ? num(mepIt.ratio)       : null;
      const mepBid   = mepIt ? num(mepIt.ratio_bid)   : null;  // BID AL30 / OFFER AL30D
      const mepOffer = mepIt ? num(mepIt.ratio_offer) : null;  // OFFER AL30 / BID AL30D
      const cclLast  = cclIt ? num(cclIt.ratio)       : null;
      const cclBid   = cclIt ? num(cclIt.ratio_bid)   : null;  // BID AL30 / OFFER AL30C
      const cclOffer = cclIt ? num(cclIt.ratio_offer) : null;  // OFFER AL30 / BID AL30C

      // Canje implicito = (CCL/MEP - 1) * 100, en pp. Lo armamos para last/bid/offer si hay data.
      const canje = (n, d) => (n != null && d != null && d !== 0) ? ((n / d) - 1) * 100 : null;

      const mepBlock = (mepLast != null || mepBid != null || mepOffer != null)
        ? { bid: mepBid, last: mepLast, offer: mepOffer } : {};
      const cclBlock = (cclLast != null || cclBid != null || cclOffer != null)
        ? { bid: cclBid, last: cclLast, offer: cclOffer } : {};
      const canjeBlock = (mepLast != null && cclLast != null)
        ? {
            bid:   canje(cclBid,   mepOffer),  // CCL bid / MEP offer (peor caso comprador)
            last:  canje(cclLast,  mepLast),
            offer: canje(cclOffer, mepBid),    // CCL offer / MEP bid (mejor caso vendedor)
          }
        : {};

      // Nota: el endpoint actual no diferencia T+0 de T+1 — usamos los mismos
      // valores en ambas filas hasta que tengamos data settlement-specific.
      return {
        mep: mepBlock,
        ccl: cclBlock,
        t0: { mep: mepBlock, ccl: cclBlock, canje: canjeBlock },
        t1: { mep: mepBlock, ccl: cclBlock, canje: canjeBlock },
      };
    }

    return { mep: {}, ccl: {}, t0: {}, t1: {} };
  }

  function pick(obj, keys) {
    if (!obj || typeof obj !== "object") return null;
    for (const k of keys) if (obj[k] !== undefined && obj[k] !== null) return obj[k];
    return null;
  }

  function extractInstr(block, key) {
    if (!block || !block[key]) return {};
    return block[key];
  }

  function normalizeTBlock(block) {
    if (!block) return {};
    return {
      mep:   block.mep   || {},
      ccl:   block.ccl   || {},
      canje: block.canje || {},
    };
  }

  // Calcula delta_abs / delta_pct vs primer valor visto del dia (intra-sesion)
  // y completa el shape canonico de t0/t1 cuando el backend no los devuelve.
  function updateDeltasFromSnapshot(s) {
    if (!s) return;
    if (s.spot != null && state.prevClose.spot == null) state.prevClose.spot = s.spot;
    const mepLast = s.mep && s.mep.last;
    const cclLast = s.ccl && s.ccl.last;
    if (mepLast != null && state.prevClose.mep == null) state.prevClose.mep = mepLast;
    if (cclLast != null && state.prevClose.ccl == null) state.prevClose.ccl = cclLast;

    if (s.spot != null && state.prevClose.spot != null && s.spot_delta_abs == null) {
      s.spot_delta_abs = s.spot - state.prevClose.spot;
      s.spot_delta_pct = state.prevClose.spot !== 0
        ? (s.spot / state.prevClose.spot - 1) * 100
        : null;
    }

    function fillDeltas(block, prev) {
      if (!block || block.last == null || prev == null) return;
      if (block.delta_abs == null) block.delta_abs = block.last - prev;
      if (block.delta_pct == null && prev !== 0) {
        block.delta_pct = (block.last / prev - 1) * 100;
      }
    }
    if (s.t0) {
      fillDeltas(s.t0.mep, state.prevClose.mep);
      fillDeltas(s.t0.ccl, state.prevClose.ccl);
    }
    if (s.t1) {
      fillDeltas(s.t1.mep, state.prevClose.mep);
      fillDeltas(s.t1.ccl, state.prevClose.ccl);
    }
  }

  // ============================================================
  // Formatters
  // ============================================================
  const fmtAR = (n, dec = 2) => Number(n).toLocaleString("es-AR", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });

  const fmtSigned = (n, dec = 2) =>
    `${n >= 0 ? "+ " : "− "}${fmtAR(Math.abs(n), dec)}`;

  const fmtPct = (n, dec = 2) =>
    `${n >= 0 ? "+ " : "− "}${fmtAR(Math.abs(n), dec)} %`;

  const fmtTime = (d) =>
    d.toLocaleTimeString("es-AR", { hour12: false });

  const fmtDate = (d) => {
    const days = ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"];
    const months = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
    return `${days[d.getDay()]} · ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  };

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
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
      if (state.showAvg) refreshAverages();
    });

    const inputA = document.getElementById("fxPromA");
    const inputB = document.getElementById("fxPromB");
    if (!inputA || !inputB) return;

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
          state.averages = { [a]: null, [b]: null };
          savePref("mt:fx:avg_windows", state.avgWindows);
          refreshAverages();
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
    const isMulti = bar.getAttribute("data-chip-group") === "brecha";

    bar.querySelectorAll(".fx-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        const dim = chip.getAttribute("data-dim");
        if (isMulti) {
          chip.classList.toggle("is-active");
          // Garantizar que cada dim tenga al menos un activo
          const stillActive = bar.querySelectorAll(`.fx-chip[data-dim="${dim}"].is-active`);
          if (stillActive.length === 0) chip.classList.add("is-active");
        } else {
          bar.querySelectorAll(`.fx-chip[data-dim="${dim}"]`)
             .forEach((c) => c.classList.remove("is-active"));
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

  function applyChipBarState(barId, vals, isMulti) {
    const bar = document.getElementById(barId);
    if (!bar) return;
    bar.querySelectorAll(".fx-chip").forEach((chip) => {
      const dim = chip.getAttribute("data-dim");
      const val = chip.getAttribute("data-val");
      const target = vals[dim];
      const active = isMulti
        ? (Array.isArray(target) && target.includes(val))
        : (target === val);
      chip.classList.toggle("is-active", !!active);
    });
  }

  // ============================================================
  // Spot / A3500
  // ============================================================
  function renderSpotAndA3500() {
    const s = state.snapshot;
    if (!s) return;

    const sv  = document.getElementById("fxSpotValue");
    const sts = document.getElementById("fxSpotTs");
    const sda = document.getElementById("fxSpotDeltaAbs");
    const sdp = document.getElementById("fxSpotDeltaPct");

    if (sv && s.spot != null) sv.textContent = fmtAR(s.spot, 2);

    if (sts && s.spot_ts) {
      sts.textContent = typeof s.spot_ts === "string"
        ? s.spot_ts
        : fmtTime(new Date(s.spot_ts));
    }

    if (sda) {
      if (s.spot_delta_abs != null) {
        sda.textContent = fmtSigned(s.spot_delta_abs);
        sda.classList.toggle("fx-up", s.spot_delta_abs >= 0);
        sda.classList.toggle("fx-down", s.spot_delta_abs < 0);
      } else {
        sda.textContent = "";
      }
    }

    if (sdp) {
      sdp.textContent = s.spot_delta_pct != null ? fmtPct(s.spot_delta_pct) : "";
    }

    const a35v = document.getElementById("fxA3500Value");
    const a35m = document.getElementById("fxA3500Meta");
    if (a35v && s.a3500 != null) a35v.textContent = fmtAR(s.a3500, 2);
    if (a35m && s.a3500_meta) a35m.textContent = s.a3500_meta;
  }

  // ============================================================
  // Brechas
  // ============================================================
  function calcBrecha(numerador, denominador, op) {
    if (numerador == null || denominador == null) return null;
    if (op === "spread") return numerador - denominador;
    // Relativo: ((num/den) - 1) * 100 -> porcentaje listo para mostrar.
    if (op === "relativo") return denominador !== 0 ? ((numerador / denominador) - 1) * 100 : null;
    return null;
  }

  function getValueForLeg(leg) {
    const s = state.snapshot;
    if (!s) return null;
    if (leg === "Spot")    return s.spot;
    if (leg === "DLK")     return s.dlk;
    if (leg === "DLK_LF")  return s.dlk_lecap_fut;
    if (leg === "MEP")     return s.mep && s.mep.last;
    if (leg === "CCL")     return s.ccl && s.ccl.last;
    return null;
  }

  function renderBrechas() {
    const grid = document.getElementById("fxBrechasGrid");
    if (!grid) return;

    const f = state.brechaFilters;
    const ops  = f.op  || [];
    const nums = f.num || [];
    const dens = f.den || [];

    const cells = [];
    ops.forEach((op) => {
      nums.forEach((num) => {
        dens.forEach((den) => {
          const numVal = getValueForLeg(num);
          const denVal = getValueForLeg(den);
          const val = calcBrecha(numVal, denVal, op);
          const opLbl  = op === "spread" ? "Spread" : "Relativo";
          const denLbl = den === "DLK_LF" ? "DLK L+F" : den;
          cells.push({
            label: `${opLbl} ${num} / ${denLbl}`,
            val,
            op,
          });
        });
      });
    });

    // Padding para layout estable (mínimo 4 celdas)
    while (cells.length < 4) {
      cells.push({ label: "—", val: null, filtered: true });
    }

    grid.innerHTML = cells.slice(0, 6).map((c) => {
      if (c.filtered || c.val == null) {
        return `<div>
          <p class="fx-brecha-cell-label">${escapeHtml(c.label)}</p>
          <p class="fx-brecha-cell-val fx-num is-filtered">— filtrado</p>
        </div>`;
      }
      const isPct = c.op === "relativo";
      const sign  = c.val >= 0 ? "+ " : "− ";
      const num   = isPct
        ? `${fmtAR(Math.abs(c.val), 2)} %`
        : fmtAR(Math.abs(c.val), 2);
      const unit  = isPct ? "" : `<span class="fx-brecha-unit">ARS</span>`;
      return `<div>
        <p class="fx-brecha-cell-label">${escapeHtml(c.label)}</p>
        <p class="fx-brecha-cell-val fx-num">${sign}${num} ${unit}</p>
      </div>`;
    }).join("");
  }

  // ============================================================
  // Tablas T+0 / T+1
  // ============================================================
  function tableIdToKey(id) {
    return id === "fxTableT0" ? "t0" : "t1";
  }

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

  function renderTableBody(tableId, data) {
    const tbody = document.querySelector(`#${tableId} tbody`);
    if (!tbody) return;

    const withAvg = state.showAvg;
    const tKey = tableIdToKey(tableId);

    const rows = ["MEP", "CCL", "Canje"].map((instr) => {
      const key = instr.toLowerCase();
      const r = (data && data[key]) || {};
      const isPct = instr === "Canje";
      const fmt = isPct ? (n) => `${fmtAR(n, 2)} %` : (n) => fmtAR(n, 2);

      const deltaCls =
        r.delta_abs != null
          ? r.delta_abs > 0
            ? "delta-up"
            : r.delta_abs < 0
              ? "delta-down"
              : ""
          : "";

      const deltaSign =
        r.delta_abs > 0 ? "+ " : r.delta_abs < 0 ? "− " : "";

      const deltaAbs =
        r.delta_abs != null
          ? `${deltaSign}${fmtAR(Math.abs(r.delta_abs), 2)}`
          : "—";

      const deltaPctEl = isPct
        ? `<span class="pct">pp</span>`
        : r.delta_pct != null
            ? `<span class="pct">${r.delta_pct >= 0 ? "+" : "−"} ${fmtAR(Math.abs(r.delta_pct), 2)}%</span>`
            : "";

      const lastDeltaClass = withAvg ? "" : " last";

      let html = `<tr>
        <td class="first">${instr}</td>
        <td>${r.bid   != null ? fmt(r.bid)   : "—"}</td>
        <td>${r.last  != null ? fmt(r.last)  : "—"}</td>
        <td>${r.offer != null ? fmt(r.offer) : "—"}</td>
        <td class="${deltaCls}${lastDeltaClass}">${deltaAbs}${deltaPctEl}</td>`;

      if (withAvg) {
        const winA = state.avgWindows[0];
        const winB = state.avgWindows[1];
        const avgA = state.averages[winA];
        const avgB = state.averages[winB];
        const valA = avgA && avgA[tKey] && avgA[tKey][key];
        const valB = avgB && avgB[tKey] && avgB[tKey][key];
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
    renderTableBody("fxTableT0", state.snapshot.t0 || {});
    renderTableBody("fxTableT1", state.snapshot.t1 || {});
  }

  // ============================================================
  // Charts (Chart.js)
  // ============================================================
  let chartTc, chartBr;

  function chartDefaults() {
    if (!window.Chart) return;
    Chart.defaults.font.family = 'Georgia, "Times New Roman", serif';
    Chart.defaults.font.size = 10;
    Chart.defaults.color = "#8A8470";
  }

  function hexToRgba(hex, a) {
    const h = hex.replace("#", "");
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  }

  function makeChart(canvasId, color) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !window.Chart) return null;
    return new Chart(canvas.getContext("2d"), {
      type: "line",
      data: {
        labels: [],
        datasets: [{
          data: [],
          borderColor: color,
          borderWidth: 1.2,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointHoverBackgroundColor: "#C9A961",
          fill: true,
          backgroundColor: hexToRgba(color, 0.06),
          tension: 0.25,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        // Hover en cualquier punto del eje X (no requiere apuntar al punto exacto)
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "#FBF9F2",
            borderColor: "#D4CBB3",
            borderWidth: 0.5,
            titleColor: "#2A3528",
            bodyColor: "#6B6452",
            titleFont: { family: "Georgia, serif", size: 12, weight: "600" },
            bodyFont:  { family: "-apple-system, BlinkMacSystemFont, sans-serif", size: 13, weight: "600" },
            padding: 10,
            displayColors: false,
            // Mostrar precio + hora en el tooltip
            callbacks: {
              title(ctx) {
                if (!ctx.length) return "";
                const idx = ctx[0].dataIndex;
                const ds = ctx[0].chart.data.datasets[0];
                const labels = ctx[0].chart.data.labels || [];
                return labels[idx] || "";
              },
              label(ctx) {
                const v = ctx.parsed.y;
                if (v == null) return "—";
                return Number(v).toLocaleString("es-AR", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 4,
                });
              },
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: "#8A8470", font: { style: "italic" } },
          },
          y: {
            grid: { color: "#E8DFC8", drawBorder: false },
            ticks: { color: "#8A8470" },
          },
        },
        animation: { duration: 300 },
      },
    });
  }

  function updateChart(chart, series, color, scale) {
    if (!chart) return;
    chart.data.labels = (series || []).map((p) => p.label);
    // Para escala log, los valores <= 0 los pasamos a null (Chart.js los salta).
    const useLog = scale === "log";
    chart.data.datasets[0].data = (series || []).map((p) => {
      if (p.value == null) return null;
      if (useLog && p.value <= 0) return null;
      return p.value;
    });
    chart.data.datasets[0].borderColor = color;
    chart.data.datasets[0].backgroundColor = hexToRgba(color, 0.06);
    // Cambiar tipo de eje Y segun escala
    if (chart.options.scales && chart.options.scales.y) {
      chart.options.scales.y.type = useLog ? "logarithmic" : "linear";
    }
    chart.update();
  }

  // ============================================================
  // Fetching
  // ============================================================
  async function fetchSpot() {
    try {
      const r = await fetch("/api/fx/spot", { credentials: "same-origin" });
      if (!r.ok) return null;
      return adaptSpotResponse(await r.json());
    } catch (e) {
      console.error("[fx] spot error", e);
      return null;
    }
  }

  // Fetcheamos los ratios T+0 y T+1 en paralelo y los componemos en un
  // unico payload con t0 y t1 distintos. Si alguno falla, ese settlement
  // queda vacio y la fila correspondiente muestra "—".
  async function fetchRatios() {
    try {
      const [r0, r1] = await Promise.all([
        fetch("/api/fx/ratios?settlement=t0", { credentials: "same-origin" }),
        fetch("/api/fx/ratios?settlement=t1", { credentials: "same-origin" }),
      ]);
      const j0 = r0.ok ? await r0.json() : null;
      const j1 = r1.ok ? await r1.json() : null;
      const t0 = adaptRatiosSingle(j0);
      const t1 = adaptRatiosSingle(j1);
      // El bloque "MEP/CCL" visible (usado en brechas) sale del settlement
      // que tenga datos, priorizando T+1 (mas liquido).
      const primary = (t1.mep && Object.keys(t1.mep).length) ? t1 : t0;
      return {
        mep: primary.mep,
        ccl: primary.ccl,
        t0: { mep: t0.mep, ccl: t0.ccl, canje: t0.canje },
        t1: { mep: t1.mep, ccl: t1.ccl, canje: t1.canje },
      };
    } catch (e) {
      console.error("[fx] ratios error", e);
      return null;
    }
  }

  // Convierte una respuesta de /api/fx/ratios?settlement=X (un solo settlement)
  // a {mep, ccl, canje} con bid/last/offer.
  function adaptRatiosSingle(json) {
    if (!json || !Array.isArray(json.items)) return { mep: {}, ccl: {}, canje: {} };
    const findByLabel = (lbl) => json.items.find(it => String(it.label || "").toUpperCase() === lbl);
    const mepIt = findByLabel("MEP");
    const cclIt = findByLabel("CCL");
    const num = (v) => v != null && isFinite(v) ? Number(v) : null;
    const mepLast  = mepIt ? num(mepIt.ratio)       : null;
    const mepBid   = mepIt ? num(mepIt.ratio_bid)   : null;
    const mepOffer = mepIt ? num(mepIt.ratio_offer) : null;
    const cclLast  = cclIt ? num(cclIt.ratio)       : null;
    const cclBid   = cclIt ? num(cclIt.ratio_bid)   : null;
    const cclOffer = cclIt ? num(cclIt.ratio_offer) : null;
    const canjeLast  = (mepLast != null && cclLast != null && mepLast !== 0)
      ? ((cclLast / mepLast) - 1) * 100 : null;
    const canjeBid   = (mepOffer != null && cclBid != null && mepOffer !== 0)
      ? ((cclBid / mepOffer) - 1) * 100 : null;
    const canjeOffer = (mepBid != null && cclOffer != null && mepBid !== 0)
      ? ((cclOffer / mepBid) - 1) * 100 : null;
    const mepBlock = (mepLast != null || mepBid != null || mepOffer != null)
      ? { bid: mepBid, last: mepLast, offer: mepOffer } : {};
    const cclBlock = (cclLast != null || cclBid != null || cclOffer != null)
      ? { bid: cclBid, last: cclLast, offer: cclOffer } : {};
    const canjeBlock = (canjeLast != null || canjeBid != null || canjeOffer != null)
      ? { bid: canjeBid, last: canjeLast, offer: canjeOffer } : {};
    return { mep: mepBlock, ccl: cclBlock, canje: canjeBlock };
  }

  async function fetchSnapshot() {
    const [spot, ratios] = await Promise.all([fetchSpot(), fetchRatios()]);
    if (!spot && !ratios) return;
    state.snapshot = { ...(spot || {}), ...(ratios || {}) };
    updateDeltasFromSnapshot(state.snapshot);
    renderSpotAndA3500();
    renderBrechas();
    renderTables();
  }

  async function fetchAverage(windowMin) {
    try {
      const r = await fetch(
        `/api/fx/averages?window_minutes=${windowMin}`,
        { credentials: "same-origin" }
      );
      if (!r.ok) return;
      state.averages[windowMin] = await r.json();
    } catch (e) {
      console.error("[fx] avg error", e);
    }
  }

  async function refreshAverages() {
    if (!state.showAvg) return;
    await Promise.all(state.avgWindows.map(fetchAverage));
    renderTables();
  }

  async function fetchChartTc() {
    const c = state.chartTc;
    try {
      const r = await fetch(
        `/api/fx/history?kind=tc&instr=${c.instr}&field=${c.field}&period=${c.period}`,
        { credentials: "same-origin" }
      );
      if (!r.ok) return;
      const d = await r.json();
      const color = "#1F3D2E";

      updateChart(chartTc, d.series, color, c.scale);

      const titleEl = document.getElementById("fxChartTcTitle");
      if (titleEl) {
        const scaleLbl = c.scale === "log" ? " · log" : "";
        titleEl.innerHTML = `${c.instr} <span class="fx-muted-italic-sm">${c.field} · ${c.period}${scaleLbl}</span>`;
      }

      const mm = document.getElementById("fxChartTcMinmax");
      if (mm && d.min != null) {
        mm.textContent = `Mín ${fmtAR(d.min, 2)} · Máx ${fmtAR(d.max, 2)}`;
      }

      const v = document.getElementById("fxChartTcVar");
      if (v && d.variation != null) {
        v.textContent = fmtPct(d.variation);
        v.classList.toggle("fx-up", d.variation >= 0);
        v.classList.toggle("fx-down", d.variation < 0);
      }
    } catch (e) {
      console.error("[fx] chart tc error", e);
    }
  }

  async function fetchChartBr() {
    const c = state.chartBr;
    try {
      const r = await fetch(
        `/api/fx/history?kind=brecha&op=${c.op}&num=${c.num}&den=${c.den}&period=${c.period}`,
        { credentials: "same-origin" }
      );
      if (!r.ok) return;
      const d = await r.json();
      const color = "#8A7A4F";

      updateChart(chartBr, d.series, color, c.scale);

      const opLbl  = c.op === "spread" ? "Spread" : "Relativo";
      const denLbl = c.den === "DLK_LF" ? "DLK L+F" : c.den;
      const titleEl = document.getElementById("fxChartBrTitle");
      if (titleEl) {
        const scaleLbl = c.scale === "log" ? " · log" : "";
        titleEl.innerHTML = `${opLbl} ${c.num} / ${denLbl} <span class="fx-muted-italic-sm">· ${c.period}${scaleLbl}</span>`;
      }

      const mm = document.getElementById("fxChartBrMinmax");
      if (mm && d.min != null) {
        mm.textContent = `Mín ${fmtAR(d.min, 4)} · Máx ${fmtAR(d.max, 4)}`;
      }

      const v = document.getElementById("fxChartBrVar");
      if (v && d.variation != null) {
        v.textContent = fmtPct(d.variation);
        v.classList.toggle("fx-up", d.variation >= 0);
        v.classList.toggle("fx-down", d.variation < 0);
      }
    } catch (e) {
      console.error("[fx] chart br error", e);
    }
  }

  // ============================================================
  // Init
  // ============================================================
  function init() {
    chartDefaults();
    chartTc = makeChart("fxChartTc", "#1F3D2E");
    chartBr = makeChart("fxChartBr", "#8A7A4F");

    initPromToggle();

    // Aplicar el estado guardado a las chip bars antes de bindear
    applyChipBarState("fxBrechaChips", state.brechaFilters, true);
    applyChipBarState("fxChartTcChips", state.chartTc, false);
    applyChipBarState("fxChartBrChips", state.chartBr, false);

    initChipBar("fxBrechaChips", (vals) => {
      state.brechaFilters = vals;
      savePref("mt:fx:brecha_filters", state.brechaFilters);
      renderBrechas();
    });

    initChipBar("fxChartTcChips", (vals) => {
      state.chartTc = { ...state.chartTc, ...vals };
      savePref("mt:fx:chart_tc", state.chartTc);
      fetchChartTc();
    });

    initChipBar("fxChartBrChips", (vals) => {
      state.chartBr = { ...state.chartBr, ...vals };
      savePref("mt:fx:chart_br", state.chartBr);
      fetchChartBr();
    });

    // Period tabs
    document.querySelectorAll(".fx-period-tabs").forEach((bar) => {
      const which = bar.getAttribute("data-chart");

      // Restaurar tab activa según localStorage
      const savedPeriod = which === "tc" ? state.chartTc.period : state.chartBr.period;
      bar.querySelectorAll(".fx-tab").forEach((t) => {
        t.classList.toggle("is-active", t.getAttribute("data-period") === savedPeriod);
      });

      bar.querySelectorAll(".fx-tab").forEach((tab) => {
        tab.addEventListener("click", () => {
          bar.querySelectorAll(".fx-tab").forEach((t) => t.classList.remove("is-active"));
          tab.classList.add("is-active");
          const period = tab.getAttribute("data-period");
          if (which === "tc") {
            state.chartTc.period = period;
            savePref("mt:fx:chart_tc", state.chartTc);
            fetchChartTc();
          } else {
            state.chartBr.period = period;
            savePref("mt:fx:chart_br", state.chartBr);
            fetchChartBr();
          }
        });
      });
    });

    // Scale chips (Lineal / Log)
    document.querySelectorAll(".fx-chart-scale").forEach((bar) => {
      const which = bar.getAttribute("data-chart");
      const savedScale = which === "tc" ? (state.chartTc.scale || "linear") : (state.chartBr.scale || "linear");
      bar.querySelectorAll(".fx-scale-chip").forEach((c) => {
        c.classList.toggle("is-active", c.getAttribute("data-scale") === savedScale);
      });
      bar.querySelectorAll(".fx-scale-chip").forEach((chip) => {
        chip.addEventListener("click", () => {
          bar.querySelectorAll(".fx-scale-chip").forEach((c) => c.classList.remove("is-active"));
          chip.classList.add("is-active");
          const scale = chip.getAttribute("data-scale");
          if (which === "tc") {
            state.chartTc.scale = scale;
            savePref("mt:fx:chart_tc", state.chartTc);
            fetchChartTc();
          } else {
            state.chartBr.scale = scale;
            savePref("mt:fx:chart_br", state.chartBr);
            fetchChartBr();
          }
        });
      });
    });

    // Carga inicial
    fetchSnapshot();
    fetchChartTc();
    fetchChartBr();
    refreshAverages();

    // Polling: snapshot cada 1s, promedios cada 30s, charts cada 30s
    setInterval(fetchSnapshot, 1000);
    setInterval(refreshAverages, 30000);
    setInterval(() => { fetchChartTc(); fetchChartBr(); }, 30000);

    initLookup();
  }

  // ============================================================
  // Widget de busqueda de dato a un datetime
  // ============================================================
  function initLookup() {
    const kind = document.getElementById("fxLookupKind");
    const submit = document.getElementById("fxLookupSubmit");
    if (!kind || !submit) return;

    function syncFields() {
      const k = kind.value;
      document.querySelectorAll("[data-lookup-tc]").forEach((el) => el.hidden = k !== "tc");
      document.querySelectorAll("[data-lookup-brecha]").forEach((el) => el.hidden = k !== "brecha");
    }
    kind.addEventListener("change", syncFields);
    syncFields();

    // Default fecha = hoy, hora = ahora
    const dateEl = document.getElementById("fxLookupDate");
    const timeEl = document.getElementById("fxLookupTime");
    if (dateEl && !dateEl.value) {
      const now = new Date();
      dateEl.value = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
    }
    if (timeEl && !timeEl.value) {
      const now = new Date();
      timeEl.value = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
    }

    submit.addEventListener("click", performLookup);
    // Enter en cualquier input dispara busqueda
    document.querySelectorAll(".fx-lookup-form select, .fx-lookup-form input").forEach((el) => {
      el.addEventListener("keydown", (e) => { if (e.key === "Enter") performLookup(); });
    });
  }

  async function performLookup() {
    const kind = document.getElementById("fxLookupKind").value;
    const date = document.getElementById("fxLookupDate").value;
    const time = document.getElementById("fxLookupTime").value || "00:00";
    const at = date ? `${date}T${time}:00` : null;

    const params = new URLSearchParams({ kind });
    if (at) params.set("at", at);
    if (kind === "tc") {
      params.set("instr", document.getElementById("fxLookupInstr").value);
      params.set("field", document.getElementById("fxLookupField").value);
    } else {
      params.set("op",  document.getElementById("fxLookupOp").value);
      params.set("num", document.getElementById("fxLookupNum").value);
      params.set("den", document.getElementById("fxLookupDen").value);
    }

    const valEl  = document.getElementById("fxLookupValue");
    const tsEl   = document.getElementById("fxLookupTs");
    const metaEl = document.getElementById("fxLookupResultMeta");
    valEl.textContent = "…";
    tsEl.textContent = "";

    try {
      const r = await fetch(`/api/fx/value-at?${params.toString()}`, { credentials: "same-origin" });
      const j = r.ok ? await r.json() : null;
      if (!j || j.value == null) {
        valEl.textContent = "—";
        tsEl.textContent = "Sin datos para esa fecha/hora";
        if (metaEl) metaEl.textContent = "";
        return;
      }
      // Decidir formato (los relativos vienen ya como porcentaje)
      const isPct = (kind === "brecha" && document.getElementById("fxLookupOp").value === "relativo")
        || (kind === "tc" && document.getElementById("fxLookupInstr").value === "Canje");
      const sign = j.value >= 0 ? "+ " : "− ";
      const fmtVal = (v) => Number(Math.abs(v)).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
      if (kind === "brecha" || isPct) {
        valEl.textContent = `${sign}${fmtVal(j.value)} ${isPct ? "%" : ""}`.trim();
      } else {
        valEl.textContent = fmtVal(j.value);
      }
      // Formatear ts ISO -> "DD/MM/YYYY HH:MM:SS"
      let tsStr = "—";
      if (j.ts) {
        try {
          const d = new Date(j.ts);
          tsStr = `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}:${String(d.getSeconds()).padStart(2,"0")}`;
        } catch { tsStr = j.ts; }
      }
      tsEl.textContent = `Snapshot @ ${tsStr}`;
      if (metaEl) {
        const reqDate = new Date(j.requested);
        const reqStr = `${String(reqDate.getDate()).padStart(2,"0")}/${String(reqDate.getMonth()+1).padStart(2,"0")}/${reqDate.getFullYear()} ${String(reqDate.getHours()).padStart(2,"0")}:${String(reqDate.getMinutes()).padStart(2,"0")}`;
        metaEl.textContent = `Solicitado: ${reqStr}`;
      }
    } catch (e) {
      console.error("[fx] lookup error", e);
      valEl.textContent = "—";
      tsEl.textContent = "Error de red";
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
