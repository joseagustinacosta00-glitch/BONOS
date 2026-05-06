/* Futures Curve module - dashboard institucional de TNA implicita de futuros DLR.
   Encapsulado: expone window.FuturesCurve = { update(items) }.
   Depende de: Chart.js v4 (cargado por CDN antes que este archivo). */
(function () {
  "use strict";

  const STATE = {
    items: [],
    chart: null,
    initialized: false,
    lastUpdate: null,
    priceFields: new Set(_loadSet("fcPriceFields", ["last"])),
    contractTypes: new Set(_loadSet("fcContractTypes", ["minorista", "mayorista"])),
  };

  function _loadSet(key, def) {
    try {
      const v = JSON.parse(localStorage.getItem(key));
      if (Array.isArray(v) && v.length) return v;
    } catch (_) {}
    return def;
  }
  function _saveSet(key, set) {
    try { localStorage.setItem(key, JSON.stringify([...set])); } catch (_) {}
  }

  // Configuracion visual por price field
  const PRICE_FIELD_DEFS = [
    { id: "bid",        label: "Bid",    stroke: "#16a34a", fill: "rgba(22,163,74,0.06)" },
    { id: "last",       label: "Last",   stroke: "#0d6efd", fill: "rgba(13,110,253,0.06)" },
    { id: "offer",      label: "Offer",  stroke: "#dc2626", fill: "rgba(220,38,38,0.06)" },
    { id: "settlement", label: "Ajuste", stroke: "#7c3aed", fill: "rgba(124,58,237,0.06)" },
  ];
  const PRICE_FIELD_BY_ID = Object.fromEntries(PRICE_FIELD_DEFS.map(d => [d.id, d]));

  // ====================== Helpers numericos ======================
  const fmtPct = (v, dec = 2) =>
    v == null || !isFinite(v) ? "-" : `${v.toFixed(dec)}%`;
  const fmtNum = (v, dec = 2) =>
    v == null || !isFinite(v)
      ? "-"
      : v.toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
  const fmtInt = v =>
    v == null || !isFinite(v) ? "-" : Math.round(v).toLocaleString("es-AR");

  function parseDateISO(s) {
    if (!s) return null;
    const parts = String(s).split("-");
    if (parts.length !== 3) return null;
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return isNaN(d.getTime()) ? null : d;
  }

  function formatMonthYear(s) {
    const d = parseDateISO(s);
    if (!d) return s || "-";
    const m = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"][d.getMonth()];
    return `${m}-${String(d.getFullYear()).slice(-2)}`;
  }

  function formatDateLong(s) {
    const d = parseDateISO(s);
    if (!d) return s || "-";
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  }

  // ====================== Normalizacion / TNA ======================
  function normalizeContract(raw) {
    if (!raw || !raw.symbol) return null;
    const sym = String(raw.symbol);
    return {
      ticker: sym,
      maturityDate: raw.expiration || null,
      daysToMaturity: raw.days_to_maturity != null ? Number(raw.days_to_maturity) : null,
      bid: raw.bid != null ? Number(raw.bid) : null,
      ask: raw.ask != null ? Number(raw.ask) : null,
      last: raw.last != null ? Number(raw.last) : null,
      settlement: raw.settlement_price != null
        ? Number(raw.settlement_price)
        : raw.previous_close != null ? Number(raw.previous_close) : null,
      volume: raw.trade_volume != null
        ? Number(raw.trade_volume)
        : raw.volume != null ? Number(raw.volume) : 0,
      openInterest: raw.open_interest != null ? Number(raw.open_interest) : 0,
      spotLast: raw.spot_used != null ? Number(raw.spot_used) : null,
      spotSource: raw.spot_source_symbol || null,
      isMayorista: raw.is_mayorista === true || /M$/.test(sym),
    };
  }

  function priceForField(c, field) {
    switch (field) {
      case "bid": return c.bid;
      case "ask": case "offer": return c.ask;
      case "settlement": return c.settlement;
      case "last":
      default: return c.last;
    }
  }

  function calculateTNA(price, spot, days) {
    if (price == null || !isFinite(price) || price <= 0) return null;
    if (spot == null || !isFinite(spot) || spot <= 0) return null;
    if (days == null || !isFinite(days) || days <= 0) return null;
    return ((price / spot) - 1) * 365 / days;
  }

  // ====================== Construccion de puntos ======================
  function buildPoints(contracts, priceField, applyVolumeFilter, minVolume) {
    const spotLast = contracts.find(c => c.spotLast != null)?.spotLast || null;
    const spotSource = contracts.find(c => c.spotSource)?.spotSource || null;

    const points = [];
    for (const c of contracts) {
      const price = priceForField(c, priceField);
      const days = c.daysToMaturity;
      const maturityDate = c.maturityDate;
      let exclusionReason = null;
      let isLiquid = true;
      let isIncluded = true;

      if (!maturityDate || days == null || days <= 0) {
        exclusionReason = "Vencimiento invalido";
        isIncluded = false;
        isLiquid = false;
      } else if (price == null || !isFinite(price) || price <= 0) {
        exclusionReason = "Precio no disponible";
        isIncluded = false;
        isLiquid = false;
      } else if (spotLast == null) {
        exclusionReason = "Spot no disponible";
        isIncluded = false;
        isLiquid = false;
      } else if (c.volume <= 0) {
        exclusionReason = "Sin volumen operado";
        isLiquid = false;
        if (applyVolumeFilter) isIncluded = false;
      } else if (applyVolumeFilter && c.volume < minVolume) {
        exclusionReason = `Excluido por filtro (vol ${c.volume} < ${minVolume})`;
        isLiquid = false;
        isIncluded = false;
      }

      const tna = calculateTNA(price, spotLast, days);
      points.push({
        ticker: c.ticker,
        maturityDate,
        daysToMaturity: days,
        priceField,
        selectedPrice: price,
        spotLast,
        spotSource,
        tna,
        tnaPct: tna != null ? tna * 100 : null,
        volume: c.volume,
        openInterest: c.openInterest,
        isLiquid,
        isIncludedInCurve: isIncluded,
        exclusionReason,
        theoreticalTna: null,
        theoreticalTnaPct: null,
        residual: null,
      });
    }
    return { points, spotLast, spotSource };
  }

  // ====================== Modelos de curva ======================

  // Lineal por tramos: dado x dentro del rango de puntos observados, interpola.
  function fitLinear(observed) {
    const sorted = observed.slice().sort((a, b) => a.x - b.x);
    return {
      name: "linear",
      label: "Lineal",
      predict(x) {
        if (sorted.length === 0) return null;
        if (sorted.length === 1) return sorted[0].y;
        if (x <= sorted[0].x) {
          const a = sorted[0], b = sorted[1];
          return a.y + (b.y - a.y) * ((x - a.x) / (b.x - a.x));
        }
        if (x >= sorted[sorted.length - 1].x) {
          const a = sorted[sorted.length - 2], b = sorted[sorted.length - 1];
          return a.y + (b.y - a.y) * ((x - a.x) / (b.x - a.x));
        }
        for (let i = 0; i < sorted.length - 1; i++) {
          const a = sorted[i], b = sorted[i + 1];
          if (x >= a.x && x <= b.x) {
            return a.y + (b.y - a.y) * ((x - a.x) / (b.x - a.x));
          }
        }
        return null;
      },
    };
  }

  // Spline cubico natural sobre puntos ordenados.
  function fitSpline(observed) {
    const pts = observed.slice().sort((a, b) => a.x - b.x);
    if (pts.length < 4) {
      const lin = fitLinear(observed);
      return { ...lin, name: "spline", label: "Spline (fallback lineal)" };
    }
    const n = pts.length;
    const h = new Array(n - 1);
    for (let i = 0; i < n - 1; i++) h[i] = pts[i + 1].x - pts[i].x;
    const alpha = new Array(n);
    for (let i = 1; i < n - 1; i++) {
      alpha[i] = (3 / h[i]) * (pts[i + 1].y - pts[i].y) - (3 / h[i - 1]) * (pts[i].y - pts[i - 1].y);
    }
    const l = new Array(n).fill(0);
    const mu = new Array(n).fill(0);
    const z = new Array(n).fill(0);
    l[0] = 1;
    for (let i = 1; i < n - 1; i++) {
      l[i] = 2 * (pts[i + 1].x - pts[i - 1].x) - h[i - 1] * mu[i - 1];
      mu[i] = h[i] / l[i];
      z[i] = (alpha[i] - h[i - 1] * z[i - 1]) / l[i];
    }
    l[n - 1] = 1;
    const c = new Array(n).fill(0);
    const b = new Array(n - 1).fill(0);
    const d = new Array(n - 1).fill(0);
    for (let j = n - 2; j >= 0; j--) {
      c[j] = z[j] - mu[j] * c[j + 1];
      b[j] = (pts[j + 1].y - pts[j].y) / h[j] - h[j] * (c[j + 1] + 2 * c[j]) / 3;
      d[j] = (c[j + 1] - c[j]) / (3 * h[j]);
    }
    return {
      name: "spline",
      label: "Spline",
      predict(x) {
        if (x <= pts[0].x) return pts[0].y;
        if (x >= pts[n - 1].x) return pts[n - 1].y;
        for (let i = 0; i < n - 1; i++) {
          if (x >= pts[i].x && x <= pts[i + 1].x) {
            const dx = x - pts[i].x;
            return pts[i].y + b[i] * dx + c[i] * dx * dx + d[i] * dx * dx * dx;
          }
        }
        return null;
      },
    };
  }

  // Ajuste polinomico por minimos cuadrados (grado 2 o 3).
  function fitPolynomial(observed, degree = 2) {
    const pts = observed.slice().sort((a, b) => a.x - b.x);
    if (pts.length < degree + 1) {
      const lin = fitLinear(observed);
      return { ...lin, name: "polynomial", label: `Polinomico (fallback lineal)` };
    }
    // Normalizar X para estabilidad numerica
    const xs = pts.map(p => p.x);
    const meanX = xs.reduce((a, b) => a + b, 0) / xs.length;
    const stdX = Math.sqrt(xs.map(x => (x - meanX) ** 2).reduce((a, b) => a + b, 0) / xs.length) || 1;
    const X = pts.map(p => {
      const z = (p.x - meanX) / stdX;
      const row = [1];
      for (let k = 1; k <= degree; k++) row.push(row[k - 1] * z);
      return row;
    });
    const y = pts.map(p => p.y);
    const coefs = solveNormalEquations(X, y);
    if (!coefs) {
      const lin = fitLinear(observed);
      return { ...lin, name: "polynomial", label: "Polinomico (fallback lineal)" };
    }
    return {
      name: "polynomial",
      label: `Polinomico (g${degree})`,
      predict(x) {
        const z = (x - meanX) / stdX;
        let acc = 0, p = 1;
        for (let k = 0; k <= degree; k++) {
          acc += coefs[k] * p;
          p *= z;
        }
        return acc;
      },
    };
  }

  // Resolver (X^T X) b = X^T y por eliminacion gaussiana.
  function solveNormalEquations(X, y) {
    const n = X[0].length;
    const A = Array.from({ length: n }, () => new Array(n + 1).fill(0));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        let s = 0;
        for (let k = 0; k < X.length; k++) s += X[k][i] * X[k][j];
        A[i][j] = s;
      }
      let s = 0;
      for (let k = 0; k < X.length; k++) s += X[k][i] * y[k];
      A[i][n] = s;
    }
    // Eliminacion gaussiana con pivot
    for (let i = 0; i < n; i++) {
      let pivot = i;
      for (let r = i + 1; r < n; r++) if (Math.abs(A[r][i]) > Math.abs(A[pivot][i])) pivot = r;
      if (Math.abs(A[pivot][i]) < 1e-12) return null;
      [A[i], A[pivot]] = [A[pivot], A[i]];
      for (let r = i + 1; r < n; r++) {
        const f = A[r][i] / A[i][i];
        for (let c = i; c <= n; c++) A[r][c] -= f * A[i][c];
      }
    }
    const x = new Array(n);
    for (let i = n - 1; i >= 0; i--) {
      let s = A[i][n];
      for (let j = i + 1; j < n; j++) s -= A[i][j] * x[j];
      x[i] = s / A[i][i];
    }
    return x;
  }

  // Nelson-Siegel: y(t) = b0 + b1*((1-e^-tau)/tau) + b2*((1-e^-tau)/tau - e^-tau)
  // donde tau = t/tauParam. t en anios.
  function nsBasis(t, tauParam) {
    const x = t / tauParam;
    if (x === 0) return [1, 1, 0];
    const expNeg = Math.exp(-x);
    const term = (1 - expNeg) / x;
    return [1, term, term - expNeg];
  }

  function fitNelsonSiegel(observed) {
    if (observed.length < 3) {
      const lin = fitLinear(observed);
      return { ...lin, name: "nelson_siegel", label: "Nelson-Siegel (fallback lineal)" };
    }
    const xs = observed.map(p => p.x / 365); // anios
    const ys = observed.map(p => p.y);
    // Grid search sobre tau, regresion lineal sobre b0/b1/b2 dado tau.
    const tauGrid = [];
    for (let t = 0.1; t <= 5; t += 0.1) tauGrid.push(t);
    let best = null;
    for (const tau of tauGrid) {
      const X = xs.map(t => nsBasis(t, tau));
      const coefs = solveNormalEquations(X, ys);
      if (!coefs) continue;
      let sse = 0;
      for (let i = 0; i < xs.length; i++) {
        const pred = coefs[0] * X[i][0] + coefs[1] * X[i][1] + coefs[2] * X[i][2];
        sse += (ys[i] - pred) ** 2;
      }
      if (best == null || sse < best.sse) best = { tau, coefs, sse };
    }
    if (!best) {
      const lin = fitLinear(observed);
      return { ...lin, name: "nelson_siegel", label: "Nelson-Siegel (fallback lineal)" };
    }
    return {
      name: "nelson_siegel",
      label: "Nelson-Siegel",
      predict(x) {
        const t = x / 365;
        if (t <= 0) return best.coefs[0] + best.coefs[1];
        const basis = nsBasis(t, best.tau);
        return best.coefs[0] * basis[0] + best.coefs[1] * basis[1] + best.coefs[2] * basis[2];
      },
    };
  }

  // Svensson: NS + cuarto termino con tau2.
  function fitSvensson(observed) {
    if (observed.length < 4) {
      const ns = fitNelsonSiegel(observed);
      return { ...ns, name: "svensson", label: "Svensson (fallback NS)" };
    }
    const xs = observed.map(p => p.x / 365);
    const ys = observed.map(p => p.y);
    const tauGrid = [];
    for (let t = 0.2; t <= 5; t += 0.2) tauGrid.push(t);
    let best = null;
    for (const t1 of tauGrid) {
      for (const t2 of tauGrid) {
        if (Math.abs(t1 - t2) < 0.05) continue;
        const X = xs.map(t => {
          const b1 = nsBasis(t, t1);
          const b2 = nsBasis(t, t2);
          return [b1[0], b1[1], b1[2], b2[2]];
        });
        const coefs = solveNormalEquations(X, ys);
        if (!coefs) continue;
        let sse = 0;
        for (let i = 0; i < xs.length; i++) {
          const pred =
            coefs[0] * X[i][0] + coefs[1] * X[i][1] + coefs[2] * X[i][2] + coefs[3] * X[i][3];
          sse += (ys[i] - pred) ** 2;
        }
        if (best == null || sse < best.sse) best = { t1, t2, coefs, sse };
      }
    }
    if (!best) {
      const ns = fitNelsonSiegel(observed);
      return { ...ns, name: "svensson", label: "Svensson (fallback NS)" };
    }
    return {
      name: "svensson",
      label: "Svensson",
      predict(x) {
        const t = x / 365;
        if (t <= 0) return best.coefs[0] + best.coefs[1];
        const b1 = nsBasis(t, best.t1);
        const b2 = nsBasis(t, best.t2);
        return (
          best.coefs[0] * b1[0] +
          best.coefs[1] * b1[1] +
          best.coefs[2] * b1[2] +
          best.coefs[3] * b2[2]
        );
      },
    };
  }

  function fitModel(observed, modelName) {
    const data = observed
      .filter(p => p.isIncludedInCurve && p.tnaPct != null)
      .map(p => ({ x: p.daysToMaturity, y: p.tnaPct }));
    if (data.length < 2) return null;
    switch (modelName) {
      case "spline": return fitSpline(data);
      case "polynomial": return fitPolynomial(data, 2);
      case "nelson_siegel": return fitNelsonSiegel(data);
      case "svensson": return fitSvensson(data);
      case "linear":
      default: return fitLinear(data);
    }
  }

  // Curva forward implicita entre vencimientos consecutivos.
  function calculateForwardCurve(contracts, priceField) {
    const valid = contracts
      .map(c => ({
        ticker: c.ticker,
        days: c.daysToMaturity,
        date: c.maturityDate,
        price: priceForField(c, priceField),
      }))
      .filter(c => c.days != null && c.days > 0 && c.price != null && c.price > 0)
      .sort((a, b) => a.days - b.days);
    const points = [];
    for (let i = 0; i < valid.length - 1; i++) {
      const a = valid[i], b = valid[i + 1];
      const span = b.days - a.days;
      if (span <= 0) continue;
      const fwd = ((b.price / a.price) - 1) * 365 / span;
      // Plot en el punto medio para representar el periodo
      const midDays = (a.days + b.days) / 2;
      points.push({
        x: midDays,
        y: fwd * 100,
        from: a.ticker,
        to: b.ticker,
        fromDays: a.days,
        toDays: b.days,
        spanDays: span,
        fwdPct: fwd * 100,
      });
    }
    return points;
  }

  // ====================== KPIs ======================
  function computeKpis(points, model) {
    const included = points.filter(p => p.isIncludedInCurve && p.tnaPct != null);
    const sortedIncluded = included.slice().sort((a, b) => a.daysToMaturity - b.daysToMaturity);
    const total = points.length;
    const includedCount = included.length;
    const excludedCount = total - includedCount;
    const tnaShort = sortedIncluded.length ? sortedIncluded[0].tnaPct : null;
    const tnaLong = sortedIncluded.length ? sortedIncluded[sortedIncluded.length - 1].tnaPct : null;
    const slope = (tnaShort != null && tnaLong != null) ? (tnaLong - tnaShort) : null;
    return { total, includedCount, excludedCount, tnaShort, tnaLong, slope, model };
  }

  // ====================== Render ======================
  function ensureUI(container) {
    if (STATE.initialized) return;
    container.innerHTML = `
      <div class="futures-curve-header">
        <div>
          <h3 class="futures-curve-title">Curva de Futuros USD <span class="muted">— TNA implicita</span></h3>
          <div class="futures-curve-subtitle" id="fcSubtitle">—</div>
        </div>
        <div class="futures-curve-status" id="fcStatus"></div>
      </div>

      <div class="futures-curve-controls">
        <div class="fc-ctrl">
          <span>Precio</span>
          <div class="fc-toggle-group" data-group="priceField">
            ${PRICE_FIELD_DEFS.map(d => `<button type="button" data-val="${d.id}" style="--fc-color:${d.stroke}">${d.label}</button>`).join("")}
          </div>
        </div>
        <div class="fc-ctrl">
          <span>Contrato</span>
          <div class="fc-toggle-group" data-group="contractType">
            <button type="button" data-val="minorista">Minorista</button>
            <button type="button" data-val="mayorista">Mayorista</button>
          </div>
        </div>
        <label class="fc-ctrl">
          <span>Modelo</span>
          <select id="futuresCurveModel">
            <option value="linear" selected>Lineal</option>
            <option value="spline">Spline</option>
            <option value="nelson_siegel">Nelson-Siegel</option>
            <option value="svensson">Svensson</option>
            <option value="polynomial">Polinomico</option>
          </select>
        </label>
        <label class="fc-ctrl fc-toggle">
          <input type="checkbox" id="futuresCurveApplyVolumeFilter">
          <span>Filtro de volumen</span>
        </label>
        <label class="fc-ctrl">
          <span>Min contratos</span>
          <input type="number" id="futuresCurveMinVolume" min="0" step="1" value="1">
        </label>
        <label class="fc-ctrl fc-toggle">
          <input type="checkbox" id="futuresCurveShowTheoretical" checked>
          <span>Mostrar teoricos</span>
        </label>
        <label class="fc-ctrl fc-toggle">
          <input type="checkbox" id="futuresCurveShowForward">
          <span>Forward implicita</span>
        </label>
      </div>

      <div class="futures-curve-kpis" id="fcKpis"></div>

      <div class="futures-curve-chart-card">
        <div class="futures-curve-warning" id="fcWarning" hidden></div>
        <div class="futures-curve-chart-wrap">
          <canvas id="futuresCurveChart"></canvas>
        </div>
      </div>

      <div class="futures-curve-legend">
        <span class="lg lg-obs">● Observado en curva</span>
        <span class="lg lg-exc">● Excluido / sin volumen</span>
        <span class="lg lg-theo">— Teorico (modelo)</span>
        <span class="lg lg-fwd">— Forward implicita</span>
      </div>
    `;

    // Listeners de inputs/selects
    const ids = [
      "futuresCurveModel",
      "futuresCurveApplyVolumeFilter",
      "futuresCurveMinVolume",
      "futuresCurveShowTheoretical",
      "futuresCurveShowForward",
    ];
    for (const id of ids) {
      const el = document.getElementById(id);
      if (!el) continue;
      const evt = el.tagName === "INPUT" && el.type === "number" ? "input" : "change";
      el.addEventListener(evt, () => render());
    }
    // Listeners de toggle-groups multi-select (priceField, contractType)
    container.querySelectorAll(".fc-toggle-group button[data-val]").forEach(btn => {
      btn.addEventListener("click", () => {
        const group = btn.parentElement.dataset.group;
        const val = btn.dataset.val;
        const set = group === "priceField" ? STATE.priceFields : STATE.contractTypes;
        const storageKey = group === "priceField" ? "fcPriceFields" : "fcContractTypes";
        if (set.has(val)) {
          if (set.size > 1) set.delete(val);
        } else {
          set.add(val);
        }
        _saveSet(storageKey, set);
        render();
      });
    });
    STATE.initialized = true;
  }

  function getControls() {
    return {
      priceFields: [...STATE.priceFields].filter(f => PRICE_FIELD_BY_ID[f]),
      contractTypes: [...STATE.contractTypes],
      modelName: document.getElementById("futuresCurveModel")?.value || "linear",
      applyVolumeFilter: !!document.getElementById("futuresCurveApplyVolumeFilter")?.checked,
      minVolume: Math.max(0, Number(document.getElementById("futuresCurveMinVolume")?.value) || 0),
      showTheoretical: !!document.getElementById("futuresCurveShowTheoretical")?.checked,
      showForward: !!document.getElementById("futuresCurveShowForward")?.checked,
    };
  }

  // Sincroniza el estado activo de los toggle buttons con STATE
  function syncToggleButtons() {
    document.querySelectorAll(".fc-toggle-group button[data-val]").forEach(btn => {
      const group = btn.parentElement.dataset.group;
      const val = btn.dataset.val;
      const set = group === "priceField" ? STATE.priceFields : STATE.contractTypes;
      btn.classList.toggle("active", set.has(val));
    });
  }

  function _filterByContractType(contracts, types) {
    const wantMin = types.includes("minorista");
    const wantMay = types.includes("mayorista");
    return contracts.filter(c => (c.isMayorista ? wantMay : wantMin));
  }

  // Calcula precio teorico a partir de una TNA teorica (en %).
  function _theoreticalPrice(tnaPct, spot, days) {
    if (tnaPct == null || spot == null || days == null || days <= 0) return null;
    return spot * (1 + (tnaPct / 100) * days / 365);
  }

  function render() {
    if (!STATE.initialized) return;
    syncToggleButtons();
    const ctrl = getControls();
    const allContracts = STATE.items.map(normalizeContract).filter(Boolean);
    const contracts = _filterByContractType(allContracts, ctrl.contractTypes);

    // Construir puntos + modelo por price field activo
    const seriesByField = [];
    let spotLast = null;
    let spotSource = null;
    for (const fieldId of ctrl.priceFields) {
      const def = PRICE_FIELD_BY_ID[fieldId];
      if (!def) continue;
      const built = buildPoints(contracts, fieldId, ctrl.applyVolumeFilter, ctrl.minVolume);
      if (spotLast == null) { spotLast = built.spotLast; spotSource = built.spotSource; }
      const model = fitModel(built.points, ctrl.modelName);
      if (model) {
        for (const p of built.points) {
          if (p.daysToMaturity == null) continue;
          const yhat = model.predict(p.daysToMaturity);
          if (yhat != null && isFinite(yhat)) {
            p.theoreticalTnaPct = yhat;
            p.theoreticalTna = yhat / 100;
            if (p.tnaPct != null) p.residual = p.tnaPct - yhat;
            const thPrice = _theoreticalPrice(yhat, p.spotLast, p.daysToMaturity);
            p.theoreticalPrice = thPrice;
            if (thPrice != null && p.selectedPrice != null) {
              p.spreadPrice = p.selectedPrice - thPrice;
            }
          }
        }
      }
      seriesByField.push({ def, points: built.points, model });
    }

    // Subtitulo
    const sub = document.getElementById("fcSubtitle");
    if (sub) {
      const upd = STATE.lastUpdate
        ? STATE.lastUpdate.toLocaleTimeString("es-AR", { hour12: false })
        : "—";
      const spotTxt = spotLast != null ? `${fmtNum(spotLast, 2)}${spotSource ? " (" + spotSource + ")" : ""}` : "—";
      const fieldsTxt = ctrl.priceFields.map(f => PRICE_FIELD_BY_ID[f]?.label || f).join(" · ");
      const ctTxt = ctrl.contractTypes.map(t => t === "mayorista" ? "Mayor." : "Minor.").join(" + ");
      sub.innerHTML = `<span>Spot: <b>${spotTxt}</b></span> · <span>Precio: <b>${fieldsTxt}</b></span> · <span>Contrato: <b>${ctTxt}</b></span> · <span>Modelo: <b>${ctrl.modelName}</b></span> · <span>Filtro vol: <b>${ctrl.applyVolumeFilter ? "ON (≥" + ctrl.minVolume + ")" : "OFF"}</b></span> · <span>Act: <b>${upd}</b></span>`;
    }

    // Warnings
    const totalIncluded = seriesByField.reduce(
      (n, s) => n + s.points.filter(p => p.isIncludedInCurve).length, 0);
    const warn = document.getElementById("fcWarning");
    if (warn) {
      warn.hidden = true;
      warn.textContent = "";
      if (spotLast == null) {
        warn.hidden = false;
        warn.textContent = "Spot last no disponible — no se puede calcular la curva.";
      } else if (!seriesByField.length) {
        warn.hidden = false;
        warn.textContent = "Activá al menos un precio (Bid/Last/Offer/Ajuste).";
      } else if (totalIncluded < 2) {
        warn.hidden = false;
        warn.textContent = "No hay suficientes contratos validos para construir la curva.";
      }
    }

    // KPIs (uso la primera serie como referencia para corta/larga)
    const refSeries = seriesByField[0] || { points: [], model: null };
    const kpis = computeKpis(refSeries.points, refSeries.model ? refSeries.model.label : ctrl.modelName);
    renderKpis(kpis, spotLast, ctrl);

    // Chart
    renderChart(seriesByField, ctrl);
  }

  function renderKpis(kpis, spotLast, ctrl) {
    const el = document.getElementById("fcKpis");
    if (!el) return;
    const fieldsTxt = ctrl.priceFields.map(f => PRICE_FIELD_BY_ID[f]?.label || f).join(" + ");
    const items = [
      { label: "Spot Last", value: fmtNum(spotLast, 2) },
      { label: "Contratos", value: `${kpis.includedCount} / ${kpis.total}` },
      { label: "Excluidos", value: fmtInt(kpis.excludedCount) },
      { label: "TNA corta", value: fmtPct(kpis.tnaShort) },
      { label: "TNA larga", value: fmtPct(kpis.tnaLong) },
      {
        label: "Pendiente",
        value: kpis.slope != null ? `${kpis.slope >= 0 ? "+" : ""}${kpis.slope.toFixed(2)} pp` : "-",
        klass: kpis.slope == null ? "" : kpis.slope >= 0 ? "pos" : "neg",
      },
      { label: "Modelo", value: kpis.model || "-" },
      { label: "Precio(s)", value: fieldsTxt || "-" },
    ];
    el.innerHTML = items
      .map(i => `<div class="fc-kpi"><span class="fc-kpi-label">${i.label}</span><span class="fc-kpi-value ${i.klass || ""}">${i.value}</span></div>`)
      .join("");
  }

  function renderChart(seriesByField, ctrl) {
    const canvas = document.getElementById("futuresCurveChart");
    if (!canvas || typeof Chart === "undefined") return;

    // Universo combinado de puntos (para callback de eje X y rango teorico)
    const allPoints = seriesByField.flatMap(s => s.points)
      .filter(p => p.daysToMaturity != null)
      .sort((a, b) => a.daysToMaturity - b.daysToMaturity);

    const datasets = [];

    // Por cada price field activo: linea observada + scatter incluidos + scatter excluidos + curva teorica
    for (const s of seriesByField) {
      const sorted = s.points
        .filter(p => p.daysToMaturity != null)
        .sort((a, b) => a.daysToMaturity - b.daysToMaturity);
      const incl = sorted.filter(p => p.isIncludedInCurve && p.tnaPct != null);
      const excl = sorted.filter(p => !p.isIncludedInCurve && p.tnaPct != null);
      const c = s.def;

      // Linea observada
      datasets.push({
        type: "line",
        label: `${c.label} — observado`,
        data: incl.map(p => ({ x: p.daysToMaturity, y: p.tnaPct, _p: p })),
        borderColor: c.stroke,
        backgroundColor: c.fill,
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.25,
        order: 2,
        spanGaps: true,
      });
      // Scatter incluidos
      datasets.push({
        type: "scatter",
        label: `${c.label} — puntos`,
        data: incl.map(p => ({ x: p.daysToMaturity, y: p.tnaPct, _p: p })),
        backgroundColor: c.stroke,
        borderColor: c.stroke,
        pointRadius: 4.5,
        pointHoverRadius: 6.5,
        order: 1,
      });
      // Scatter excluidos
      if (excl.length) {
        datasets.push({
          type: "scatter",
          label: `${c.label} — excluidos`,
          data: excl.map(p => ({ x: p.daysToMaturity, y: p.tnaPct, _p: p })),
          backgroundColor: "rgba(148, 163, 184, 0.45)",
          borderColor: "#64748b",
          pointStyle: "rectRot",
          pointRadius: 3.5,
          pointHoverRadius: 5,
          order: 1,
        });
      }
      // Curva teorica densa
      if (ctrl.showTheoretical && s.model && incl.length >= 2) {
        const minX = sorted[0].daysToMaturity;
        const maxX = sorted[sorted.length - 1].daysToMaturity;
        const N = 60;
        const theoLine = [];
        for (let i = 0; i <= N; i++) {
          const x = minX + (maxX - minX) * (i / N);
          const y = s.model.predict(x);
          if (y != null && isFinite(y)) theoLine.push({ x, y });
        }
        datasets.push({
          type: "line",
          label: `${c.label} — teorica`,
          data: theoLine,
          borderColor: c.stroke,
          borderDash: [4, 4],
          borderWidth: 1.2,
          pointRadius: 0,
          tension: 0.0,
          order: 3,
          spanGaps: true,
        });
      }
    }

    // Forward implicita (1 sola, usa el primer price field activo como referencia)
    if (ctrl.showForward && ctrl.priceFields.length) {
      const allContracts = STATE.items.map(normalizeContract).filter(Boolean);
      const filtered = _filterByContractType(allContracts, ctrl.contractTypes);
      const fwd = calculateForwardCurve(filtered, ctrl.priceFields[0]);
      datasets.push({
        type: "line",
        label: "Forward implicita",
        data: fwd.map(f => ({ x: f.x, y: f.y, _fwd: f })),
        borderColor: "#fbbf24",
        backgroundColor: "rgba(251, 191, 36, 0.1)",
        borderDash: [2, 3],
        borderWidth: 1.5,
        pointRadius: 3,
        pointBackgroundColor: "#fbbf24",
        pointHoverRadius: 5,
        order: 4,
        spanGaps: true,
      });
    }

    const sorted = allPoints; // alias para callback de ticks

    const cfg = {
      type: "scatter",
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        layout: { padding: { top: 8, right: 16, bottom: 4, left: 4 } },
        scales: {
          x: {
            type: "linear",
            title: { display: true, text: "Dias al vencimiento", color: "#94a3b8", font: { size: 11 } },
            grid: { color: "rgba(148,163,184,0.08)", drawTicks: false },
            ticks: {
              color: "#94a3b8",
              font: { size: 10 },
              maxRotation: 0,
              callback(v) {
                // Si encontramos un punto con esos dias, mostramos vencimiento corto
                const p = sorted.find(pp => pp.daysToMaturity === v);
                return p ? formatMonthYear(p.maturityDate) : `${Math.round(v)}d`;
              },
            },
            border: { color: "rgba(148,163,184,0.2)" },
          },
          y: {
            title: { display: true, text: "TNA implicita (%)", color: "#94a3b8", font: { size: 11 } },
            grid: { color: "rgba(148,163,184,0.08)", drawTicks: false },
            ticks: {
              color: "#94a3b8",
              font: { size: 10 },
              callback: v => `${Number(v).toFixed(1)}%`,
            },
            border: { color: "rgba(148,163,184,0.2)" },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "rgba(15,23,42,0.95)",
            borderColor: "rgba(148,163,184,0.25)",
            borderWidth: 1,
            padding: 10,
            titleColor: "#f8fafc",
            titleFont: { size: 11, weight: "600" },
            bodyColor: "#cbd5e1",
            bodyFont: { size: 11 },
            displayColors: false,
            callbacks: {
              title(ctx) {
                const it = ctx[0];
                const raw = it.raw;
                if (raw && raw._p) {
                  const p = raw._p;
                  const fLabel = PRICE_FIELD_BY_ID[p.priceField]?.label || p.priceField;
                  return `${p.ticker} · ${fLabel}`;
                }
                if (raw && raw._fwd) return `Forward ${raw._fwd.from} → ${raw._fwd.to}`;
                return it.dataset.label || "";
              },
              label(ctx) {
                const raw = ctx.raw;
                if (raw && raw._p) {
                  const p = raw._p;
                  const lines = [
                    `Precio: ${fmtNum(p.selectedPrice, 2)}`,
                    `Tasa: ${fmtPct(p.tnaPct)}`,
                  ];
                  if (p.spreadPrice != null) {
                    const sign = p.spreadPrice >= 0 ? "+" : "";
                    lines.push(`Spread vs teorico: ${sign}${fmtNum(p.spreadPrice, 2)}`);
                  }
                  return lines;
                }
                if (raw && raw._fwd) {
                  const f = raw._fwd;
                  return [
                    `${f.from} → ${f.to}`,
                    `Forward TNA: ${fmtPct(f.fwdPct)}`,
                  ];
                }
                return `${ctx.dataset.label}: ${fmtPct(raw.y)}`;
              },
            },
          },
        },
      },
    };

    if (STATE.chart) {
      STATE.chart.data = cfg.data;
      STATE.chart.options = cfg.options;
      STATE.chart.resize();
      STATE.chart.update("none");
    } else {
      STATE.chart = new Chart(canvas.getContext("2d"), cfg);
    }
  }

  // ====================== API publica ======================
  function update(items) {
    STATE.items = Array.isArray(items) ? items : [];
    STATE.lastUpdate = new Date();
    const container = document.getElementById("futuresCurveContainer");
    if (!container) return;
    ensureUI(container);
    render();
  }

  window.FuturesCurve = { update };
})();
