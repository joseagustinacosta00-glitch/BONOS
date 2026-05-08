console.log("[Monitor] app.js v=hd79 cargado - Login Marketerminal (verde ingles + crema marfil + dorado)");

// ====== AUTH bootstrap (primer cosa al cargar) ======
// Si una request /api/* devuelve 401, redirigimos al login. Para evitar loops
// no interceptamos los propios endpoints /api/auth/login y /me.
(function _installAuth401Interceptor() {
  const origFetch = window.fetch;
  window.fetch = function (input, init) {
    return origFetch.call(this, input, init).then(response => {
      try {
        const url = typeof input === "string" ? input : (input && input.url) || "";
        if (response.status === 401 &&
            !url.includes("/api/auth/login") &&
            !url.includes("/api/auth/me")) {
          // Sesion expirada: redirigimos
          const next = encodeURIComponent(window.location.pathname + window.location.search);
          window.location.href = `/login?next=${next}`;
        }
      } catch (_) {}
      return response;
    });
  };
})();

// ====== Render del usuario logueado en el header ======
async function _initAuthHeader() {
  try {
    const r = await fetch("/api/auth/me", { credentials: "same-origin" });
    if (!r.ok) return;
    const j = await r.json();
    const user = j.user;
    const userEl = document.getElementById("authUser");
    if (userEl) {
      if (user) {
        const role = user.role === "admin" ? "admin" : "user";
        userEl.innerHTML = `${user.username}<span class="auth-role ${role}">${role}</span>`;
      } else {
        userEl.textContent = "Sin sesion";
      }
    }
    // Mostrar tab Usuarios solo si admin
    if (user && user.role === "admin") {
      const adminBtn = document.getElementById("adminTabBtn");
      if (adminBtn) adminBtn.classList.remove("d-none");
    }
    window.__currentUser = user || null;
  } catch (err) {
    console.error("[Auth] me fallo", err);
  }
  // Logout button
  const btn = document.getElementById("authLogout");
  if (btn) {
    btn.addEventListener("click", async () => {
      try {
        await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
      } catch (_) {}
      window.location.href = "/login";
    });
  }
}
_initAuthHeader();

// ====== Admin panel: usuarios + sesiones ======
async function _adminLoadUsers() {
  const body = document.getElementById("adminUsersBody");
  if (!body) return;
  try {
    const r = await fetch("/api/auth/users", { credentials: "same-origin" });
    if (!r.ok) throw new Error("http " + r.status);
    const j = await r.json();
    const users = j.users || [];
    const me = window.__currentUser;
    if (!users.length) {
      body.innerHTML = '<tr><td colspan="5" class="empty-state">Sin usuarios</td></tr>';
      return;
    }
    body.innerHTML = users.map(u => {
      const isMe = me && me.id === u.id;
      const created = u.created_at ? u.created_at.slice(0, 10) : "-";
      return `
        <tr data-uid="${u.id}">
          <td><strong>${u.username}</strong>${isMe ? ' <small style="color:#6b7280">(vos)</small>' : ""}</td>
          <td><span class="admin-role-pill ${u.role}">${u.role}</span></td>
          <td><span class="admin-status-pill ${u.is_active ? "active" : "inactive"}">${u.is_active ? "activo" : "inactivo"}</span></td>
          <td><small style="color:#6b7280">${created}</small></td>
          <td class="text-end">
            <button class="admin-action" data-act="rename">Renombrar</button>
            <button class="admin-action" data-act="passwd">Cambiar pass</button>
            <button class="admin-action" data-act="role">Toggle rol</button>
            ${isMe ? "" : `<button class="admin-action" data-act="active">${u.is_active ? "Desactivar" : "Activar"}</button>`}
            ${isMe ? "" : `<button class="admin-action danger" data-act="delete">Borrar</button>`}
          </td>
        </tr>
      `;
    }).join("");
    body.querySelectorAll("button[data-act]").forEach(btn => {
      btn.addEventListener("click", () => _adminUserAction(btn));
    });
  } catch (err) {
    console.error("[Admin] users", err);
    body.innerHTML = '<tr><td colspan="5" class="empty-state">Error al cargar usuarios</td></tr>';
  }
}

async function _adminUserAction(btn) {
  const tr = btn.closest("tr");
  const uid = tr && tr.dataset.uid;
  if (!uid) return;
  const act = btn.dataset.act;
  let body = null;
  if (act === "passwd") {
    const v = window.prompt("Nueva contraseña (min 4):");
    if (v == null) return;
    body = { password: v };
  } else if (act === "rename") {
    const v = window.prompt("Nuevo nombre de usuario:");
    if (v == null) return;
    body = { username: v };
  } else if (act === "role") {
    const cur = tr.querySelector(".admin-role-pill")?.textContent.trim();
    body = { role: cur === "admin" ? "user" : "admin" };
  } else if (act === "active") {
    const isActive = tr.querySelector(".admin-status-pill")?.classList.contains("active");
    body = { is_active: !isActive };
  } else if (act === "delete") {
    if (!confirm("¿Borrar este usuario? Tambien se cierran sus sesiones activas.")) return;
    try {
      const r = await fetch(`/api/auth/users/${uid}`, { method: "DELETE", credentials: "same-origin" });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        alert("Error: " + (j.detail || r.status));
        return;
      }
      _adminLoadUsers();
      _adminLoadSessions();
    } catch (e) { alert("Error de red"); }
    return;
  }
  if (!body) return;
  try {
    const r = await fetch(`/api/auth/users/${uid}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: "same-origin",
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      alert("Error: " + (j.detail || r.status));
      return;
    }
    _adminLoadUsers();
  } catch (e) { alert("Error de red"); }
}

async function _adminLoadSessions() {
  const body = document.getElementById("adminSessionsBody");
  if (!body) return;
  try {
    const r = await fetch("/api/auth/sessions", { credentials: "same-origin" });
    if (!r.ok) throw new Error("http " + r.status);
    const j = await r.json();
    const sessions = j.sessions || [];
    if (!sessions.length) {
      body.innerHTML = '<tr><td colspan="6" class="empty-state">Sin sesiones activas</td></tr>';
      return;
    }
    body.innerHTML = sessions.map(s => {
      const created = s.created_at ? new Date(s.created_at).toLocaleString("es-AR", { hour12: false }) : "-";
      const last = s.last_seen_at ? new Date(s.last_seen_at).toLocaleString("es-AR", { hour12: false }) : "-";
      const ua = (s.user_agent || "").slice(0, 60);
      return `
        <tr>
          <td><strong>${s.username}</strong></td>
          <td><span class="admin-role-pill ${s.role}">${s.role}</span></td>
          <td><small>${s.ip || "-"}</small></td>
          <td><small style="color:#6b7280">${ua}</small></td>
          <td><small>${created}</small></td>
          <td><small>${last}</small></td>
        </tr>
      `;
    }).join("");
  } catch (err) {
    console.error("[Admin] sessions", err);
    body.innerHTML = '<tr><td colspan="6" class="empty-state">Error al cargar sesiones</td></tr>';
  }
}

(function _initAdminPanel() {
  const form = document.getElementById("adminCreateForm");
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("adminNewUser").value.trim();
    const password = document.getElementById("adminNewPass").value;
    const role = document.getElementById("adminNewRole").value;
    if (!username || !password) return;
    try {
      const r = await fetch("/api/auth/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, role }),
        credentials: "same-origin",
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        alert("Error: " + (j.detail || r.status));
        return;
      }
      document.getElementById("adminNewUser").value = "";
      document.getElementById("adminNewPass").value = "";
      _adminLoadUsers();
    } catch (err) { alert("Error de red"); }
  });
  // Carga al entrar al tab
  document.getElementById("adminTabBtn")?.addEventListener("click", () => {
    _adminLoadUsers();
    _adminLoadSessions();
  });
})();
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
const tamarTemplate = document.querySelector("#tamarTemplate");
const tamarTicker = document.querySelector("#tamarTicker");
const tamarIssueDate = document.querySelector("#tamarIssueDate");
const tamarMaturityDate = document.querySelector("#tamarMaturityDate");
const tamarFaceValue = document.querySelector("#tamarFaceValue");
const tamarFetchReference = document.querySelector("#tamarFetchReference");
const tamarCalculate = document.querySelector("#tamarCalculate");
const tamarTemExtra = document.querySelector("#tamarTemExtra");
const tamarStatus = document.querySelector("#tamarStatus");
const tamarCalcSection = document.querySelector("#tamarCalcSection");
const tamarFixedRateBanner = document.querySelector("#tamarFixedRateBanner");
const tamarCalcWindow = document.querySelector("#tamarCalcWindow");
const tamarCalcAverage = document.querySelector("#tamarCalcAverage");
const tamarCalcBreakdown = document.querySelector("#tamarCalcBreakdown");
const tamarCalcWithSpread = document.querySelector("#tamarCalcWithSpread");
const tamarCalcTem = document.querySelector("#tamarCalcTem");
const tamarCalcVpv = document.querySelector("#tamarCalcVpv");
const tamarCalcDays = document.querySelector("#tamarCalcDays");
const tamarMarketPrice = document.querySelector("#tamarMarketPrice");
const tamarSettlement = document.querySelector("#tamarSettlement");
const tamarSettlementDate = document.querySelector("#tamarSettlementDate");
const tamarDaysToMaturity = document.querySelector("#tamarDaysToMaturity");
const tamarFixedTna = document.querySelector("#tamarFixedTna");
const tamarAsOfDate = document.querySelector("#tamarAsOfDate");
const tamarReferenceSection = document.querySelector("#tamarReferenceSection");
const tamarEmissionValue = document.querySelector("#tamarEmissionValue");
const tamarEmissionRefDate = document.querySelector("#tamarEmissionRefDate");
const tamarProjectionValue = document.querySelector("#tamarProjectionValue");
const tamarProjectionCutoff = document.querySelector("#tamarProjectionCutoff");
const tamarProjectionSamples = document.querySelector("#tamarProjectionSamples");
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
const hdDownloadCashflow = document.querySelector("#hdDownloadCashflow");
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
const hdDeferredSection = document.querySelector("#hdDeferredSection");
const hdDeferredPeriod = document.querySelector("#hdDeferredPeriod");
const hdDeferredApply = document.querySelector("#hdDeferredApply");
const hdDeferredReset = document.querySelector("#hdDeferredReset");
const hdDeferredStatus = document.querySelector("#hdDeferredStatus");
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
const hdStatusBottom = document.querySelector("#hdStatusBottom");
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
let currentBondModel = "lecap";
let currentMarketSettlement = "t1";
let currentView = "market";
let currentBcraSeries = "cer";
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
  hard_dollar: "Hard Dollar",
  cer: "CER",
  tamar: "TAMAR",
  dlk: "Dollar-Linked",
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
  // Curva ARS solo cuando estamos en la categoria ars
  const arsCurveWrap = document.querySelector("#arsCurveWrap");
  if (arsCurveWrap) arsCurveWrap.style.display = (which === "main" && currentMarketCategory === "ars") ? "" : "none";
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

  if (currentMarketCategory === "ars") {
    showMarketTable("main");
    renderArsMarket();
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
    { html: (q) => q.symbol, className: "ticker ticker-clickable-cell" },
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

// ===== Tablas Futuros y DLK =====
// DLK: orden fijo TZV26 -> D30S6 -> TZV27 -> TZV28
// Futuros DLR: 12 columnas con datos extendidos del backend

const DLK_ORDER = ["TZV26", "D30S6", "TZV27", "TZV28"];
const dlkRowRefs = new Map();
const futRowRefs = new Map();

function fmtNumAr(value, dec = 2) {
  if (value === null || value === undefined || value === "" || Number.isNaN(value)) return "-";
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: dec, maximumFractionDigits: dec,
  }).format(value);
}

function fmtIntAr(value) {
  if (value === null || value === undefined || value === "" || Number.isNaN(value)) return "-";
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(value);
}

function _buildDlkRow(symbol) {
  const tr = document.createElement("tr");
  tr.dataset.key = symbol;
  const tdSym = document.createElement("td"); tdSym.className = "ticker"; tdSym.innerHTML = `<strong>${symbol}</strong>`;
  const tdVenc = document.createElement("td");
  tdVenc.style.cursor = "pointer";
  tdVenc.title = "Click para editar fecha de vencimiento";
  tdVenc.textContent = "-";
  // Click sobre la celda Vto: prompt para fecha (DD/MM/YYYY o YYYY-MM-DD), persiste en localStorage
  tdVenc.addEventListener("click", () => {
    const current = DLK_MATURITIES[symbol] || "";
    const v = window.prompt(`Vto de ${symbol} (YYYY-MM-DD o DD/MM/YYYY)`, current);
    if (v == null) return;
    const iso = _parseDateInputToIso(v.trim());
    if (!iso) {
      if (v.trim() === "") {
        delete DLK_MATURITIES[symbol];
      } else {
        alert("Fecha invalida. Usa YYYY-MM-DD o DD/MM/YYYY.");
        return;
      }
    } else {
      DLK_MATURITIES[symbol] = iso;
    }
    try { localStorage.setItem("dlkMaturities", JSON.stringify(DLK_MATURITIES)); } catch (_) {}
    renderFuturosDlk();
  });
  const tdBid = document.createElement("td"); tdBid.className = "text-end"; tdBid.textContent = "-";
  const tdAsk = document.createElement("td"); tdAsk.className = "text-end"; tdAsk.textContent = "-";
  const tdLast = document.createElement("td"); tdLast.className = "text-end"; tdLast.textContent = "-";
  const tdChg = document.createElement("td"); tdChg.className = "text-end"; tdChg.textContent = "-";
  const tdTna = document.createElement("td"); tdTna.className = "text-end"; tdTna.textContent = "-";
  const tdTime = document.createElement("td"); tdTime.className = "text-end"; tdTime.textContent = "-";
  tr.append(tdSym, tdVenc, tdBid, tdAsk, tdLast, tdChg, tdTna, tdTime);
  return { tr, cells: { venc: tdVenc, bid: tdBid, ask: tdAsk, last: tdLast, chg: tdChg, tna: tdTna, time: tdTime } };
}

// ===== DLK maturities (editables por celda Vto, persisten en localStorage) =====
const DLK_DEFAULT_MATURITIES = {
  TZV26: "2026-06-30",
  D30S6: "2026-09-30",
  TZV27: "2027-06-30",
  TZV28: "2028-06-30",
};
const DLK_MATURITIES = (() => {
  try {
    const saved = JSON.parse(localStorage.getItem("dlkMaturities") || "null");
    if (saved && typeof saved === "object") return { ...DLK_DEFAULT_MATURITIES, ...saved };
  } catch (_) {}
  return { ...DLK_DEFAULT_MATURITIES };
})();

function _parseDateInputToIso(s) {
  if (!s) return null;
  // Acepta YYYY-MM-DD o DD/MM/YYYY
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (isoMatch) return s;
  const dmyMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (dmyMatch) {
    const dd = String(dmyMatch[1]).padStart(2, "0");
    const mm = String(dmyMatch[2]).padStart(2, "0");
    return `${dmyMatch[3]}-${mm}-${dd}`;
  }
  return null;
}

// Proximo dia habil simple (skip sabados/domingos). No considera feriados.
function _nextBusinessDayJs(dateIso) {
  const d = new Date(`${dateIso}T00:00:00`);
  d.setDate(d.getDate() + 1);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function _daysBetweenIso(fromIso, toIso) {
  const a = new Date(`${fromIso}T00:00:00`);
  const b = new Date(`${toIso}T00:00:00`);
  return Math.round((b - a) / 86400000);
}

function calcDlkTna(currentPrice, spot, daysToMaturity) {
  if (currentPrice == null || !isFinite(currentPrice) || currentPrice <= 0) return null;
  if (spot == null || !isFinite(spot) || spot <= 0) return null;
  if (daysToMaturity == null || daysToMaturity <= 0) return null;
  // Asumimos pago al vencimiento = 100 nominal * FX_actual (bullet 100, sin cupon)
  const maturityValueArs = 100 * spot;
  return ((maturityValueArs / currentPrice) - 1) * 365 / daysToMaturity * 100;
}

function _buildFutRow(symbol) {
  const tr = document.createElement("tr");
  tr.dataset.key = symbol;
  const tdSym = document.createElement("td"); tdSym.className = "ticker"; tdSym.innerHTML = `<strong>${symbol}</strong>`; tdSym.title = "";
  const tdSzB = document.createElement("td"); tdSzB.className = "text-end"; tdSzB.textContent = "-";
  const tdPxB = document.createElement("td"); tdPxB.className = "text-end"; tdPxB.textContent = "-";
  const tdPxO = document.createElement("td"); tdPxO.className = "text-end"; tdPxO.textContent = "-";
  const tdSzO = document.createElement("td"); tdSzO.className = "text-end"; tdSzO.textContent = "-";
  const tdLast = document.createElement("td"); tdLast.className = "text-end"; tdLast.textContent = "-";
  const tdAj = document.createElement("td"); tdAj.className = "text-end"; tdAj.textContent = "-";
  const tdChgAbs = document.createElement("td"); tdChgAbs.className = "text-end"; tdChgAbs.textContent = "-";
  const tdChgPct = document.createElement("td"); tdChgPct.className = "text-end"; tdChgPct.textContent = "-";
  const tdVCn = document.createElement("td"); tdVCn.className = "text-end"; tdVCn.textContent = "-";
  const tdVN = document.createElement("td"); tdVN.className = "text-end"; tdVN.textContent = "-";
  const tdOI = document.createElement("td"); tdOI.className = "text-end"; tdOI.textContent = "-";
  const tdTna = document.createElement("td"); tdTna.className = "text-end"; tdTna.textContent = "-";
  tr.append(tdSym, tdSzB, tdPxB, tdPxO, tdSzO, tdLast, tdAj, tdChgAbs, tdChgPct, tdVCn, tdVN, tdOI, tdTna);
  return { tr, sym: tdSym, cells: { szB: tdSzB, pxB: tdPxB, pxO: tdPxO, szO: tdSzO, last: tdLast, aj: tdAj, chgAbs: tdChgAbs, chgPct: tdChgPct, vCn: tdVCn, vN: tdVN, oi: tdOI, tna: tdTna } };
}

function ensureDlkRow(symbol) {
  let ref = dlkRowRefs.get(symbol);
  if (ref) return ref;
  ref = _buildDlkRow(symbol);
  document.querySelector("#dlkBody")?.appendChild(ref.tr);
  dlkRowRefs.set(symbol, ref);
  return ref;
}

function ensureFutRow(symbol) {
  let ref = futRowRefs.get(symbol);
  if (ref) return ref;
  ref = _buildFutRow(symbol);
  document.querySelector("#futOnlyBody")?.appendChild(ref.tr);
  futRowRefs.set(symbol, ref);
  return ref;
}

function seedFutRows() {
  // DLK fijo en el orden pedido
  for (const sym of DLK_ORDER) ensureDlkRow(sym);
}

function _setIfChanged(cell, text, cls) {
  if (cell.textContent !== text) cell.textContent = text;
  if (cls != null && cell.className !== cls) cell.className = cls;
}

function renderFuturosDlk() {
  if (!dlkRowRefs.size) seedFutRows();

  // === DLK ===
  const dlkBySymbol = {};
  for (const q of latestQuotes) {
    if (q.category === "dlk") dlkBySymbol[q.symbol] = q;
  }
  // Resolver settlement date para TNA segun T+0 / T+1 (currentMarketSettlement)
  const todayIso = _todayIso();
  const settleIso = currentMarketSettlement === "t1"
    ? _nextBusinessDayJs(todayIso)
    : todayIso;
  const spotForTna = (spotLiveCache && spotLiveCache.last != null)
    ? Number(spotLiveCache.last) : null;

  for (const symbol of DLK_ORDER) {
    const ref = ensureDlkRow(symbol);
    const q = dlkBySymbol[symbol];
    const matIso = DLK_MATURITIES[symbol] || null;
    _setIfChanged(ref.cells.venc, matIso ? formatDateDisplay(matIso) : "—");
    if (!q) {
      _setIfChanged(ref.cells.tna, "-");
      continue;
    }
    _setIfChanged(ref.cells.bid, fmtNumAr(q.bid, 2));
    _setIfChanged(ref.cells.ask, fmtNumAr(q.ask, 2));
    _setIfChanged(ref.cells.last, fmtNumAr(q.last, 2));
    const chgVal = q.change;
    const chgTxt = (chgVal == null) ? "-" : `${fmtNumAr(chgVal, 2)}%`;
    const chgCls = "text-end " + (chgVal > 0 ? "positive" : chgVal < 0 ? "negative" : "");
    _setIfChanged(ref.cells.chg, chgTxt, chgCls);
    // TNA implicita
    let tnaTxt = "-";
    if (matIso && spotForTna != null && q.last != null) {
      const days = _daysBetweenIso(settleIso, matIso);
      const tna = calcDlkTna(Number(q.last), spotForTna, days);
      if (tna != null && isFinite(tna)) {
        tnaTxt = `${fmtNumAr(tna, 2)}%`;
        ref.cells.tna.title = `Spot: ${fmtNumAr(spotForTna, 2)} · Settle: ${formatDateDisplay(settleIso)} (${currentMarketSettlement.toUpperCase()}) · Dias: ${days}`;
      }
    }
    _setIfChanged(ref.cells.tna, tnaTxt);
    _setIfChanged(ref.cells.time, q.updated_at ? formatTime(q.updated_at) : "-");
  }

  // === FUTUROS DLR ===
  // Backend ya los devuelve en orden de la whitelist y enriquecidos con
  // change_abs, tna_percent, expiration.
  const futList = futuresCache || [];
  for (const q of futList) {
    const ref = ensureFutRow(q.symbol);
    if (q.expiration) {
      const expDisp = formatDateDisplay(q.expiration);
      ref.sym.title = `Vencimiento: ${expDisp}`;
    }
    _setIfChanged(ref.cells.szB, fmtIntAr(q.bid_size));
    _setIfChanged(ref.cells.pxB, fmtNumAr(q.bid, 2));
    _setIfChanged(ref.cells.pxO, fmtNumAr(q.ask, 2));
    _setIfChanged(ref.cells.szO, fmtIntAr(q.ask_size));
    _setIfChanged(ref.cells.last, fmtNumAr(q.last, 2));
    // Ajuste / Settlement: si pyRofex no manda SE, fallback al previous_close
    const ajVal = q.settlement_price != null ? q.settlement_price : q.previous_close;
    _setIfChanged(ref.cells.aj, fmtNumAr(ajVal, 2));
    const chgAbsVal = q.change_abs;
    const chgPctVal = q.change;
    const chgAbsTxt = (chgAbsVal == null) ? "-" : fmtNumAr(chgAbsVal, 2);
    const chgPctTxt = (chgPctVal == null) ? "-" : `${fmtNumAr(chgPctVal, 2)}%`;
    const chgAbsCls = "text-end " + (chgAbsVal > 0 ? "positive" : chgAbsVal < 0 ? "negative" : "");
    const chgPctCls = "text-end " + (chgPctVal > 0 ? "positive" : chgPctVal < 0 ? "negative" : "");
    _setIfChanged(ref.cells.chgAbs, chgAbsTxt, chgAbsCls);
    _setIfChanged(ref.cells.chgPct, chgPctTxt, chgPctCls);
    _setIfChanged(ref.cells.vCn, fmtIntAr(q.trade_volume ?? q.volume));
    _setIfChanged(ref.cells.vN, fmtIntAr(q.nominal_volume));
    _setIfChanged(ref.cells.oi, fmtIntAr(q.open_interest));
    _setIfChanged(ref.cells.tna, q.tna_percent != null ? `${fmtNumAr(q.tna_percent, 2)}%` : "-");
  }
  // Reordenar los futuros segun el orden devuelto por el backend (whitelist)
  const futBody = document.querySelector("#futOnlyBody");
  if (futBody) {
    for (const q of futList) {
      const ref = futRowRefs.get(q.symbol);
      if (ref && ref.tr.parentNode === futBody) futBody.appendChild(ref.tr);
    }
  }

  // Curva de Futuros (modulo institucional)
  if (window.FuturesCurve) window.FuturesCurve.update(futList);
  // Curva TNA DLK (reducida, mismo settlement T+0/T+1)
  renderDlkCurve(dlkBySymbol, settleIso, spotForTna);
  // Sinteticas ARS: arbitraje DLK ofrecido vs futuro descontado al fixing
  renderSyntheticArsCurve(dlkBySymbol, settleIso, spotForTna);
}

// ===== Sinteticas ARS · Tasa colocadora =====
// Mapping bono -> simbolo de futuro DLR para arbitrar.
const DLK_TO_FUTURE = {
  TZV26: "DLR/JUN26",
  D30S6: "DLR/SEP26",
  TZV27: "DLR/JUN27",
  TZV28: "DLR/JUN28",
};

// Resta n dias habiles a una fecha ISO (skip sabados/domingos, sin feriados).
function _prevBusinessDays(dateIso, n) {
  const d = new Date(`${dateIso}T00:00:00`);
  let count = 0;
  while (count < n) {
    d.setDate(d.getDate() - 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) count++;
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ===== Curva TNA bonos DLK: estado + helpers + render =====
const DLK_CURVE_STATE = {
  fields: new Set(JSON.parse(localStorage.getItem("dlkCurveFields") || '["last"]')),
  overrides: JSON.parse(localStorage.getItem("dlkCurveOverrides") || "{}"), // { ticker: { type: "tna"|"price", value } }
  initialized: false,
};
const DLK_FIELD_DEFS = {
  bid:   { label: "Bid",   stroke: "#16a34a", fill: "rgba(22,163,74,0.06)" },
  last:  { label: "Last",  stroke: "#0d6efd", fill: "rgba(13,110,253,0.06)" },
  offer: { label: "Offer", stroke: "#dc2626", fill: "rgba(220,38,38,0.06)" },
};
function _saveDlkCurveState() {
  try { localStorage.setItem("dlkCurveFields", JSON.stringify([...DLK_CURVE_STATE.fields])); } catch (_) {}
  try { localStorage.setItem("dlkCurveOverrides", JSON.stringify(DLK_CURVE_STATE.overrides)); } catch (_) {}
}
function _dlkPriceForField(q, field) {
  if (!q) return null;
  if (field === "bid") return q.bid != null ? Number(q.bid) : null;
  if (field === "offer" || field === "ask") return q.ask != null ? Number(q.ask) : null;
  return q.last != null ? Number(q.last) : null;
}

let _dlkCurveChart = null;
let _dlkCurveListenersReady = false;

function _initDlkCurveControls() {
  if (_dlkCurveListenersReady) return;
  // Toggle group bid/last/offer
  document.querySelectorAll(".dlk-toggle-group[data-group='dlkPrice'] button").forEach(btn => {
    btn.addEventListener("click", () => {
      const v = btn.dataset.val;
      if (DLK_CURVE_STATE.fields.has(v)) {
        if (DLK_CURVE_STATE.fields.size > 1) DLK_CURVE_STATE.fields.delete(v);
      } else {
        DLK_CURVE_STATE.fields.add(v);
      }
      _saveDlkCurveState();
      renderFuturosDlk();
    });
  });
  // Modelo select
  const modelSel = document.getElementById("dlkCurveModel");
  if (modelSel) {
    const saved = localStorage.getItem("dlkCurveModel");
    if (saved) modelSel.value = saved;
    modelSel.addEventListener("change", () => {
      try { localStorage.setItem("dlkCurveModel", modelSel.value); } catch (_) {}
      renderFuturosDlk();
    });
  }
  // Toggle Forwards
  const fwdChk = document.getElementById("dlkShowForward");
  if (fwdChk) {
    fwdChk.checked = localStorage.getItem("dlkShowForward") === "1";
    fwdChk.addEventListener("change", () => {
      try { localStorage.setItem("dlkShowForward", fwdChk.checked ? "1" : "0"); } catch (_) {}
      renderFuturosDlk();
    });
  }
  // Reset overrides
  const resetBtn = document.getElementById("dlkResetOverrides");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      if (!Object.keys(DLK_CURVE_STATE.overrides).length) {
        alert("No hay what-ifs activos.");
        return;
      }
      if (confirm("¿Borrar todos los what-ifs?")) {
        DLK_CURVE_STATE.overrides = {};
        _saveDlkCurveState();
        renderFuturosDlk();
      }
    });
  }
  _dlkCurveListenersReady = true;
}

function _syncDlkToggleButtons() {
  document.querySelectorAll(".dlk-toggle-group[data-group='dlkPrice'] button").forEach(btn => {
    btn.classList.toggle("active", DLK_CURVE_STATE.fields.has(btn.dataset.val));
  });
}

// Plugin Chart.js para dibujar labels (TNA + ticker) sobre los puntos.
const _dlkLabelsPlugin = {
  id: "dlkLabels",
  afterDatasetsDraw(chart) {
    const ctx = chart.ctx;
    chart.data.datasets.forEach((ds, dsi) => {
      if (!ds._labelPoints) return;
      const meta = chart.getDatasetMeta(dsi);
      if (!meta || !meta.data) return;
      ctx.save();
      ctx.textAlign = "center";
      meta.data.forEach((point, i) => {
        const raw = ds.data[i];
        if (!raw || !raw._p) return;
        const x = point.x;
        const y = point.y;
        // Linea 1 (mas arriba): TNA en color de la serie, mas grande y bold
        ctx.fillStyle = ds.borderColor || "#cbd5e1";
        ctx.font = "700 13px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
        ctx.fillText(`${raw._p.tna.toFixed(2)}%`, x, y - 28);
        // Linea 2: ticker, blanco brillante y bold
        ctx.fillStyle = "#f1f5f9";
        ctx.font = "700 11px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
        ctx.fillText(raw._p.ticker, x, y - 14);
      });
      ctx.restore();
    });
  },
};

// Modal amigable para editar TNA / precio de un punto en la curva DLK.
let _dlkModalOpenedFor = null;
let _dlkModalMode = "tna";
function _openDlkEditModal(ctx) {
  // ctx: { ticker, tna, price, spot, days, mat }
  const overlay = document.getElementById("dlkEditModal");
  const titleEl = document.getElementById("dlkEditModalTitle");
  const metaEl = document.getElementById("dlkEditModalMeta");
  const inputEl = document.getElementById("dlkEditModalInput");
  const helpEl = document.getElementById("dlkEditModalHelp");
  const deleteBtn = document.getElementById("dlkEditModalDelete");
  if (!overlay || !inputEl) return;
  _dlkModalOpenedFor = ctx;
  // Modo segun lo que haya guardado (si hay) o TNA por default
  const cur = DLK_CURVE_STATE.overrides[ctx.ticker];
  _dlkModalMode = (cur && cur.type) || "tna";
  // Sync toggle visual
  document.querySelectorAll("#dlkEditModalToggle button").forEach(b => {
    b.classList.toggle("active", b.dataset.mode === _dlkModalMode);
  });
  if (titleEl) titleEl.textContent = `Editar ${ctx.ticker}`;
  if (metaEl) {
    metaEl.innerHTML = `
      Mercado: <b>${fmtNumAr(ctx.price, 2)}</b> · TNA <b>${ctx.tna.toFixed(2)}%</b><br>
      Vto: <b>${formatDateDisplay(ctx.mat)}</b> · Dias al vto: <b>${Math.round(ctx.days)}</b>
    `;
  }
  // Default value en el input
  if (cur) {
    inputEl.value = cur.value;
  } else {
    inputEl.value = _dlkModalMode === "tna" ? ctx.tna.toFixed(2) : ctx.price.toFixed(2);
  }
  _updateDlkModalHelp();
  // Boton borrar habilitado solo si hay override
  if (deleteBtn) deleteBtn.style.display = cur ? "" : "none";
  overlay.classList.remove("d-none");
  setTimeout(() => inputEl.focus(), 30);
}

function _updateDlkModalHelp() {
  const helpEl = document.getElementById("dlkEditModalHelp");
  if (!helpEl) return;
  helpEl.textContent = _dlkModalMode === "tna"
    ? "Ingresa una TNA en %. El precio se back-calcula desde la TNA, el spot y los dias al vencimiento."
    : "Ingresa un precio. La TNA se calcula a partir del precio, el spot y los dias al vencimiento.";
}

function _closeDlkEditModal() {
  const overlay = document.getElementById("dlkEditModal");
  if (overlay) overlay.classList.add("d-none");
  _dlkModalOpenedFor = null;
}

function _applyDlkEditModal() {
  if (!_dlkModalOpenedFor) return;
  const inputEl = document.getElementById("dlkEditModalInput");
  if (!inputEl) return;
  const raw = String(inputEl.value || "").trim().replace(",", ".");
  if (raw === "") return;
  const num = Number(raw);
  if (!isFinite(num)) { alert("Valor invalido."); return; }
  DLK_CURVE_STATE.overrides[_dlkModalOpenedFor.ticker] = { type: _dlkModalMode, value: num };
  _saveDlkCurveState();
  _closeDlkEditModal();
  renderFuturosDlk();
}

function _deleteDlkEditModal() {
  if (!_dlkModalOpenedFor) return;
  delete DLK_CURVE_STATE.overrides[_dlkModalOpenedFor.ticker];
  _saveDlkCurveState();
  _closeDlkEditModal();
  renderFuturosDlk();
}

(function _initDlkEditModalListeners() {
  // Hookeamos una sola vez. Como los elementos pueden no existir todavia
  // (si el DOM no termino de parsear), usamos DOMContentLoaded fallback.
  function bind() {
    const overlay = document.getElementById("dlkEditModal");
    if (!overlay) { setTimeout(bind, 50); return; }
    document.getElementById("dlkEditModalClose")?.addEventListener("click", _closeDlkEditModal);
    document.getElementById("dlkEditModalCancel")?.addEventListener("click", _closeDlkEditModal);
    document.getElementById("dlkEditModalApply")?.addEventListener("click", _applyDlkEditModal);
    document.getElementById("dlkEditModalDelete")?.addEventListener("click", _deleteDlkEditModal);
    document.getElementById("dlkEditModalInput")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") _applyDlkEditModal();
      if (e.key === "Escape") _closeDlkEditModal();
    });
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) _closeDlkEditModal();
    });
    document.querySelectorAll("#dlkEditModalToggle button").forEach(btn => {
      btn.addEventListener("click", () => {
        _dlkModalMode = btn.dataset.mode;
        document.querySelectorAll("#dlkEditModalToggle button").forEach(b => {
          b.classList.toggle("active", b === btn);
        });
        _updateDlkModalHelp();
        // Re-poblar input con el valor sugerido del nuevo modo
        const inputEl = document.getElementById("dlkEditModalInput");
        if (inputEl && _dlkModalOpenedFor) {
          inputEl.value = _dlkModalMode === "tna"
            ? _dlkModalOpenedFor.tna.toFixed(2)
            : _dlkModalOpenedFor.price.toFixed(2);
          inputEl.focus();
        }
      });
    });
  }
  bind();
})();

function renderDlkCurve(dlkBySymbol, settleIso, spot) {
  const canvas = document.querySelector("#dlkCurveChart");
  const meta = document.querySelector("#dlkCurveMeta");
  if (!canvas || typeof Chart === "undefined") return;
  _initDlkCurveControls();
  _syncDlkToggleButtons();

  const fields = [...DLK_CURVE_STATE.fields].filter(f => DLK_FIELD_DEFS[f]);
  if (!fields.length) {
    if (meta) meta.textContent = "Activa al menos un precio (Bid/Last/Offer)";
    if (_dlkCurveChart) { _dlkCurveChart.destroy(); _dlkCurveChart = null; }
    const ctx = canvas.getContext("2d"); ctx.clearRect(0, 0, canvas.width, canvas.height);
    return;
  }
  const modelName = document.getElementById("dlkCurveModel")?.value || "linear";

  // Construir puntos por field
  const seriesByField = fields.map(field => {
    const def = DLK_FIELD_DEFS[field];
    const points = [];
    for (const symbol of DLK_ORDER) {
      const matIso = DLK_MATURITIES[symbol];
      const q = dlkBySymbol[symbol];
      if (!matIso || !q) continue;
      const price = _dlkPriceForField(q, field);
      if (price == null || !isFinite(price) || price <= 0) continue;
      const days = _daysBetweenIso(settleIso, matIso);
      const tna = calcDlkTna(price, spot, days);
      if (tna == null || !isFinite(tna)) continue;
      points.push({ x: days, y: tna, ticker: symbol, mat: matIso, price, tna, field });
    }
    points.sort((a, b) => a.x - b.x);
    // Fit del modelo (reutilizamos FuturesCurve.fitModel si esta expuesto)
    let model = null;
    const observed = points.map(p => ({ isIncludedInCurve: true, daysToMaturity: p.x, tnaPct: p.y }));
    if (window.FuturesCurve && window.FuturesCurve.fitModel) {
      model = window.FuturesCurve.fitModel(observed, modelName);
    }
    return { def, field, points, model };
  });

  if (meta) {
    const totalPoints = seriesByField.reduce((n, s) => n + s.points.length, 0);
    if (spot == null) meta.textContent = "Esperando SPOT…";
    else if (!totalPoints) meta.textContent = "Sin datos suficientes";
    else {
      const fieldsTxt = fields.map(f => DLK_FIELD_DEFS[f].label).join(" · ");
      const ovCount = Object.keys(DLK_CURVE_STATE.overrides).length;
      const ovTxt = ovCount > 0 ? ` · ${ovCount} what-if${ovCount > 1 ? "s" : ""}` : "";
      meta.textContent = `Spot: ${fmtNumAr(spot, 2)} · ${currentMarketSettlement.toUpperCase()} · ${fieldsTxt} · Modelo: ${modelName}${ovTxt}`;
    }
  }

  const datasets = [];
  // Por field: linea observada + scatter con labels (solo el primer field activo lleva labels para no saturar) + curva teorica
  for (let si = 0; si < seriesByField.length; si++) {
    const s = seriesByField[si];
    const isFirst = si === 0;
    const c = s.def;
    // Linea observada uniendo puntos
    datasets.push({
      type: "line",
      label: `${c.label} obs`,
      data: s.points.map(p => ({ x: p.x, y: p.y, _p: p })),
      borderColor: c.stroke,
      backgroundColor: c.fill,
      borderWidth: 2,
      pointRadius: 0,
      tension: 0.2,
      order: 2,
      spanGaps: true,
    });
    // Scatter de los puntos (solo el primer field activo lleva labels arriba)
    datasets.push({
      type: "scatter",
      label: `${c.label} puntos`,
      data: s.points.map(p => ({ x: p.x, y: p.y, _p: p })),
      backgroundColor: c.stroke,
      borderColor: c.stroke,
      pointRadius: 5,
      pointHoverRadius: 7,
      order: 1,
      _labelPoints: isFirst,
    });
    // Curva teorica densa
    if (s.model && s.points.length >= 2) {
      const minX = s.points[0].x;
      const maxX = s.points[s.points.length - 1].x;
      const N = 60;
      const theoLine = [];
      for (let i = 0; i <= N; i++) {
        const x = minX + (maxX - minX) * (i / N);
        const y = s.model.predict(x);
        if (y != null && isFinite(y)) theoLine.push({ x, y });
      }
      datasets.push({
        type: "line",
        label: `${c.label} teorica`,
        data: theoLine,
        borderColor: c.stroke,
        borderDash: [4, 4],
        borderWidth: 1.2,
        pointRadius: 0,
        order: 3,
        spanGaps: true,
      });
    }
  }

  // Overrides (what-ifs) — un punto por ticker. Se calcula contra el primer field activo.
  const primaryField = fields[0];
  const overridePoints = [];
  for (const ticker of Object.keys(DLK_CURVE_STATE.overrides)) {
    const matIso = DLK_MATURITIES[ticker];
    if (!matIso) continue;
    const days = _daysBetweenIso(settleIso, matIso);
    if (days <= 0) continue;
    const ov = DLK_CURVE_STATE.overrides[ticker];
    let tna = null, price = null;
    if (ov.type === "tna") {
      tna = ov.value;
      // back-calc precio: tna = ((100 * spot / price) - 1) * 365 / days * 100
      // -> price = 100 * spot / (1 + tna/100 * days/365)
      if (spot != null) price = 100 * spot / (1 + (tna / 100) * days / 365);
    } else if (ov.type === "price") {
      price = ov.value;
      if (spot != null) tna = calcDlkTna(price, spot, days);
    }
    if (tna == null || !isFinite(tna)) continue;
    overridePoints.push({
      x: days, y: tna, ticker, mat: matIso, price, tna, field: primaryField, override: true,
    });
  }
  if (overridePoints.length) {
    datasets.push({
      type: "scatter",
      label: "What-if",
      data: overridePoints.map(p => ({ x: p.x, y: p.y, _p: p })),
      backgroundColor: "#fbbf24",
      borderColor: "#92400e",
      borderWidth: 2,
      pointStyle: "rectRot",
      pointRadius: 7,
      pointHoverRadius: 9,
      order: 0,
      _labelPoints: true,
    });
  }

  // Forward implicita entre vencimientos consecutivos (usando el primer field activo)
  const showForward = !!document.getElementById("dlkShowForward")?.checked;
  if (showForward && seriesByField[0] && seriesByField[0].points.length >= 2) {
    const pts = seriesByField[0].points.slice().sort((a, b) => a.x - b.x);
    const fwdPoints = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const span = b.x - a.x;
      if (span <= 0 || a.price <= 0 || b.price <= 0) continue;
      // forward implicito: ((p_A / p_B) - 1) * 365 / span * 100
      // (DLK: precio mas bajo => yield mas alto, mismo razonamiento que TNA)
      const fwd = ((a.price / b.price) - 1) * 365 / span * 100;
      const midDays = (a.x + b.x) / 2;
      fwdPoints.push({
        x: midDays, y: fwd,
        _fwd: { from: a.ticker, to: b.ticker, fromDays: a.x, toDays: b.x, span, fwd },
      });
    }
    if (fwdPoints.length) {
      datasets.push({
        type: "line",
        label: "Forward",
        data: fwdPoints,
        borderColor: "#fbbf24",
        backgroundColor: "rgba(251,191,36,0.08)",
        borderDash: [3, 3],
        borderWidth: 1.5,
        pointRadius: 4,
        pointBackgroundColor: "#fbbf24",
        pointHoverRadius: 6,
        order: 4,
        spanGaps: true,
      });
    }
  }

  // Universo de puntos para callback de eje X
  const allPoints = seriesByField.flatMap(s => s.points).sort((a, b) => a.x - b.x);

  const cfg = {
    type: "scatter",
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      layout: { padding: { top: 36, right: 18, bottom: 4, left: 6 } },
      scales: {
        x: {
          type: "linear",
          grid: { color: "rgba(148,163,184,0.08)", drawTicks: false },
          ticks: {
            color: "#94a3b8", font: { size: 10 }, maxRotation: 0,
            callback(v) {
              const p = allPoints.find(pp => pp.x === v);
              if (p && p.mat) {
                const parts = p.mat.split("-");
                if (parts.length === 3) {
                  const m = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"][Number(parts[1])-1];
                  return `${m}-${parts[0].slice(-2)}`;
                }
              }
              return `${Math.round(v)}d`;
            },
          },
          border: { color: "rgba(148,163,184,0.2)" },
        },
        y: {
          grid: { color: "rgba(148,163,184,0.08)", drawTicks: false },
          ticks: {
            color: "#94a3b8", font: { size: 10 },
            callback: v => `${Number(v).toFixed(0)}%`,
          },
          border: { color: "rgba(148,163,184,0.2)" },
        },
      },
      onClick(_evt, els) {
        if (!els || !els.length || !_dlkCurveChart) return;
        const el = els[0];
        const ds = _dlkCurveChart.data.datasets[el.datasetIndex];
        const raw = ds && ds.data[el.index];
        if (!raw || !raw._p) return;
        const p = raw._p;
        _openDlkEditModal({
          ticker: p.ticker, tna: p.tna, price: p.price, spot, days: p.x, mat: p.mat,
        });
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "rgba(15,23,42,0.95)",
          borderColor: "rgba(148,163,184,0.25)",
          borderWidth: 1,
          padding: 8,
          titleColor: "#f8fafc",
          titleFont: { size: 11, weight: "600" },
          bodyColor: "#cbd5e1",
          bodyFont: { size: 10 },
          displayColors: false,
          callbacks: {
            title(ctx) {
              const raw = ctx[0].raw;
              if (raw && raw._p) {
                const tag = raw._p.override ? " (what-if)" : ` (${DLK_FIELD_DEFS[raw._p.field]?.label || ""})`;
                return `${raw._p.ticker}${tag}`;
              }
              if (raw && raw._fwd) return `Forward ${raw._fwd.from} → ${raw._fwd.to}`;
              return "";
            },
            label(ctx) {
              const raw = ctx.raw;
              if (raw && raw._p) {
                const lines = [
                  `Precio: ${fmtNumAr(raw._p.price, 2)}`,
                  `Tasa: ${raw._p.tna.toFixed(2)}%`,
                ];
                if (!raw._p.override) lines.push(`Vto: ${formatDateDisplay(raw._p.mat)} (${Math.round(raw._p.x)}d)`);
                if (raw._p.override) lines.push(`(click otra vez para editar)`);
                return lines;
              }
              if (raw && raw._fwd) {
                return [
                  `${raw._fwd.from} (${Math.round(raw._fwd.fromDays)}d) → ${raw._fwd.to} (${Math.round(raw._fwd.toDays)}d)`,
                  `Span: ${Math.round(raw._fwd.span)}d`,
                  `Forward TNA: ${raw._fwd.fwd.toFixed(2)}%`,
                ];
              }
              return "";
            },
          },
        },
      },
    },
    plugins: [_dlkLabelsPlugin],
  };

  if (_dlkCurveChart) {
    _dlkCurveChart.data = cfg.data;
    _dlkCurveChart.options = cfg.options;
    _dlkCurveChart.resize();
    _dlkCurveChart.update("none");
  } else {
    _dlkCurveChart = new Chart(canvas.getContext("2d"), cfg);
  }
}

// ===== Render: Curva sintetica ARS (tasa colocadora) =====
let _syntheticChart = null;
let _syntheticListenersReady = false;

function _initSyntheticControls() {
  if (_syntheticListenersReady) return;
  ["syntheticMode", "syntheticDiscountModel", "syntheticCurveModel"].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const saved = localStorage.getItem(id);
    if (saved) el.value = saved;
    el.addEventListener("change", () => {
      try { localStorage.setItem(id, el.value); } catch (_) {}
      renderFuturosDlk();
    });
  });
  const fwd = document.getElementById("syntheticShowForward");
  if (fwd) {
    fwd.checked = localStorage.getItem("syntheticShowForward") === "1";
    fwd.addEventListener("change", () => {
      try { localStorage.setItem("syntheticShowForward", fwd.checked ? "1" : "0"); } catch (_) {}
      renderFuturosDlk();
    });
  }
  _syntheticListenersReady = true;
}

// Modos sintetico: define que precios usar de bono y de futuro + sentido (signo).
function _syntheticModeSpec(mode) {
  switch (mode) {
    case "colocadora":
      return {
        label: "Colocadora",
        bondField: "ask",   // compro DLK al offer
        futField:  "bid",   // vendo futuro al bid
      };
    case "tomadora":
      return {
        label: "Tomadora",
        bondField: "bid",   // vendo DLK al bid
        futField:  "ask",   // compro futuro al offer
      };
    case "last_vs_last":
    default:
      return { label: "Last vs Last", bondField: "last", futField: "last" };
  }
}

function _futurePrice(f, field) {
  if (!f) return null;
  if (field === "bid")  return f.bid != null ? Number(f.bid) : null;
  if (field === "ask")  return f.ask != null ? Number(f.ask) : null;
  return f.last != null ? Number(f.last) : null;
}
function _bondPrice(q, field) {
  if (!q) return null;
  if (field === "bid")  return q.bid != null ? Number(q.bid) : null;
  if (field === "ask")  return q.ask != null ? Number(q.ask) : null;
  return q.last != null ? Number(q.last) : null;
}

// Sidebar: solo los futuros MAPEADOS a un bono DLK que tengan volumen.
// Muestra BID / LAST / OFFER originales + el valor del futuro al fixing por curva
// (linea destacada). El fixing es 3 dias habiles antes del vencimiento del BONO
// asociado (no del futuro).
function _renderSyntheticSidebar(futList, dlkBySymbol, curveAtFixingFn) {
  const sidebar = document.querySelector("#syntheticSidebar");
  if (!sidebar) return;
  if (!Array.isArray(futList) || !futList.length) {
    sidebar.innerHTML = `<div class="synth-sidebar-empty">Sin futuros disponibles</div>`;
    return;
  }
  const futureByName = {};
  for (const f of futList) if (f && f.symbol) futureByName[f.symbol] = f;
  // Para cada bono DLK que tenga futuro mapeado y volumen
  const cards = [];
  for (const ticker of DLK_ORDER) {
    const matIso = DLK_MATURITIES[ticker];
    const futSym = DLK_TO_FUTURE[ticker];
    if (!matIso || !futSym) continue;
    const f = futureByName[futSym];
    if (!f || !f.expiration) continue;
    const vol = f.trade_volume != null ? Number(f.trade_volume) : (f.volume != null ? Number(f.volume) : 0);
    if (vol <= 0) continue;
    const fixingIso = _prevBusinessDays(matIso, 3);
    const futAtFixing = curveAtFixingFn(fixingIso);
    const rows = [
      { lbl: "BID", cls: "bid",   v: f.bid != null ? Number(f.bid) : null },
      { lbl: "LST", cls: "last",  v: f.last != null ? Number(f.last) : null },
      { lbl: "OFR", cls: "offer", v: f.ask != null ? Number(f.ask) : null },
    ];
    const rowsHtml = rows.map(r => {
      const valTxt = (r.v == null || !isFinite(r.v) || r.v <= 0) ? "—" : fmtNumAr(r.v, 2);
      return `
        <div class="synth-fut-row ${r.cls}">
          <span class="synth-fut-row-label">${r.lbl}</span>
          <span class="synth-fut-row-orig">${valTxt}</span>
        </div>
      `;
    }).join("");
    const fixingTxt = fmtNumAr(futAtFixing, 2);
    cards.push(`
      <div class="synth-fut-card">
        <div class="synth-fut-head">
          <span class="synth-fut-ticker">${f.symbol}</span>
          <span class="synth-fut-vol">${fmtIntAr(vol)} cn</span>
        </div>
        <div class="synth-fut-bondtag">para <b>${ticker}</b> · fixing ${formatDateDisplay(fixingIso)}</div>
        ${rowsHtml}
        <div class="synth-fut-curve">
          <span class="synth-fut-curve-label">Curva al fixing</span>
          <span class="synth-fut-curve-value">${fixingTxt}</span>
        </div>
      </div>
    `);
  }
  if (!cards.length) {
    sidebar.innerHTML = `<div class="synth-sidebar-empty">Sin futuros mapeados con volumen</div>`;
    return;
  }
  sidebar.innerHTML = cards.join("");
}

function renderSyntheticArsCurve(dlkBySymbol, settleIso, spot) {
  const canvas = document.querySelector("#syntheticChart");
  const meta = document.querySelector("#syntheticMeta");
  if (!canvas || typeof Chart === "undefined") return;
  _initSyntheticControls();

  const modeName = document.getElementById("syntheticMode")?.value || "last_vs_last";
  const mode = _syntheticModeSpec(modeName);
  const discountModelName = document.getElementById("syntheticDiscountModel")?.value || "linear";
  const curveModelName = document.getElementById("syntheticCurveModel")?.value || "linear";

  // 1) Construir curva de futuros con el FIELD del modo (bid/last/ask) y fitear el modelo de descuento.
  const todayIso = _todayIso();
  const futList = futuresCache || [];
  const futureByName = {};
  const futurePoints = [];
  for (const f of futList) {
    if (!f || !f.symbol || !f.expiration) continue;
    futureByName[f.symbol] = f;
    const px = _futurePrice(f, mode.futField);
    const fdays = f.days_to_maturity != null ? Number(f.days_to_maturity) : _daysBetweenIso(todayIso, f.expiration);
    if (px == null || !isFinite(px) || px <= 0 || fdays <= 0 || spot == null) continue;
    const fwdTna = ((px / spot) - 1) * 365 / fdays * 100;
    if (!isFinite(fwdTna)) continue;
    futurePoints.push({ x: fdays, y: fwdTna });
  }
  futurePoints.sort((a, b) => a.x - b.x);
  let discountModel = null;
  if (futurePoints.length >= 2 && window.FuturesCurve?.fitModel) {
    const observed = futurePoints.map(p => ({ isIncludedInCurve: true, daysToMaturity: p.x, tnaPct: p.y }));
    discountModel = window.FuturesCurve.fitModel(observed, discountModelName);
  }

  // Helper: valor del futuro al fixing por curva = SPOT * (1 + curveTNA(daysToFixing) * daysToFixing / 365)
  function _curveAtFixing(fixingIso) {
    if (spot == null || !discountModel) return null;
    const dToFix = _daysBetweenIso(todayIso, fixingIso);
    if (dToFix <= 0) return null;
    const tnaPct = discountModel.predict(dToFix);
    if (tnaPct == null || !isFinite(tnaPct)) return null;
    return spot * (1 + (tnaPct / 100) * dToFix / 365);
  }

  // 1.5) Sidebar: solo futuros mapeados a bonos DLK que tengan volumen.
  _renderSyntheticSidebar(futList, dlkBySymbol, _curveAtFixing);

  // 2) Para cada bono DLK con futuro mapeado, calcular la sintetica.
  const synthPoints = [];
  for (const ticker of DLK_ORDER) {
    const matIso = DLK_MATURITIES[ticker];
    const futSym = DLK_TO_FUTURE[ticker];
    if (!matIso || !futSym) continue;
    const bondQ = dlkBySymbol[ticker];
    const futQ = futureByName[futSym];
    if (!bondQ || !futQ || !futQ.expiration) continue;
    const bondPxRaw = _bondPrice(bondQ, mode.bondField);
    const futPx = _futurePrice(futQ, mode.futField);
    if (bondPxRaw == null || futPx == null || bondPxRaw <= 0 || futPx <= 0) continue;
    // Bono cotiza por 100 VN => normalizar a "por USD"
    const bondPxPerUsd = bondPxRaw / 100;

    // Fixing del bono = 3 dias habiles antes del vencimiento del bono
    const fixingIso = _prevBusinessDays(matIso, 3);
    const daysSettleToFixing = _daysBetweenIso(settleIso, fixingIso);
    if (daysSettleToFixing <= 0) continue;

    // 3) Valor del futuro al fixing POR CURVA (no es discount del precio, es la curva).
    const futAtFixing = _curveAtFixing(fixingIso);
    if (futAtFixing == null) continue;

    // 4) TNA sintetica = ((futuro_al_fixing_por_curva / (bono/100)) - 1) * 365 / dias_settlement_a_fixing * 100
    const synthTna = ((futAtFixing / bondPxPerUsd) - 1) * 365 / daysSettleToFixing * 100;
    if (!isFinite(synthTna)) continue;

    synthPoints.push({
      x: daysSettleToFixing,
      y: synthTna,
      ticker, mat: matIso, fixingIso, futSym,
      bondPxRaw, bondPxPerUsd, futPx, futAtFixing,
      tna: synthTna, price: bondPxRaw,
    });
  }
  synthPoints.sort((a, b) => a.x - b.x);

  if (meta) {
    if (spot == null) meta.textContent = "Esperando SPOT…";
    else if (!synthPoints.length) meta.textContent = "Sin datos suficientes";
    else {
      meta.textContent = `${synthPoints.length} bonos · ${mode.label} · descuento: ${discountModelName} · curva: ${curveModelName} · ${currentMarketSettlement.toUpperCase()}`;
    }
  }

  // 5) Fit del modelo de la CURVA sintetica (independiente del descuento)
  let synthModel = null;
  if (synthPoints.length >= 2 && window.FuturesCurve?.fitModel) {
    const observed = synthPoints.map(p => ({ isIncludedInCurve: true, daysToMaturity: p.x, tnaPct: p.y }));
    synthModel = window.FuturesCurve.fitModel(observed, curveModelName);
  }

  const datasets = [];
  // Linea uniendo puntos
  datasets.push({
    type: "line",
    label: "Sintetica",
    data: synthPoints.map(p => ({ x: p.x, y: p.y, _p: p })),
    borderColor: "#a78bfa",
    backgroundColor: "rgba(167,139,250,0.06)",
    borderWidth: 2,
    pointRadius: 0,
    tension: 0.2,
    order: 2,
    spanGaps: true,
  });
  // Scatter con labels
  datasets.push({
    type: "scatter",
    label: "Sintetica puntos",
    data: synthPoints.map(p => ({ x: p.x, y: p.y, _p: p })),
    backgroundColor: "#a78bfa",
    borderColor: "#7c3aed",
    pointRadius: 5,
    pointHoverRadius: 7,
    order: 1,
    _labelPoints: true,
  });
  // Curva teorica
  if (synthModel && synthPoints.length >= 2) {
    const minX = synthPoints[0].x;
    const maxX = synthPoints[synthPoints.length - 1].x;
    const N = 60;
    const theo = [];
    for (let i = 0; i <= N; i++) {
      const x = minX + (maxX - minX) * (i / N);
      const y = synthModel.predict(x);
      if (y != null && isFinite(y)) theo.push({ x, y });
    }
    datasets.push({
      type: "line",
      label: "Sintetica teorica",
      data: theo,
      borderColor: "#a78bfa",
      borderDash: [4, 4],
      borderWidth: 1.2,
      pointRadius: 0,
      order: 3,
      spanGaps: true,
    });
  }
  // Forwards entre sinteticas consecutivas
  if (document.getElementById("syntheticShowForward")?.checked && synthPoints.length >= 2) {
    const fwdPoints = [];
    for (let i = 0; i < synthPoints.length - 1; i++) {
      const a = synthPoints[i], b = synthPoints[i + 1];
      const span = b.x - a.x;
      if (span <= 0 || a.bondPxRaw <= 0 || b.bondPxRaw <= 0) continue;
      const fwd = ((a.bondPxRaw / b.bondPxRaw) - 1) * 365 / span * 100;
      const midDays = (a.x + b.x) / 2;
      fwdPoints.push({
        x: midDays, y: fwd,
        _fwd: { from: a.ticker, to: b.ticker, fromDays: a.x, toDays: b.x, span, fwd },
      });
    }
    if (fwdPoints.length) {
      datasets.push({
        type: "line",
        label: "Forward sint.",
        data: fwdPoints,
        borderColor: "#fbbf24",
        backgroundColor: "rgba(251,191,36,0.08)",
        borderDash: [3, 3],
        borderWidth: 1.5,
        pointRadius: 4,
        pointBackgroundColor: "#fbbf24",
        pointHoverRadius: 6,
        order: 4,
        spanGaps: true,
      });
    }
  }

  const cfg = {
    type: "scatter",
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      layout: { padding: { top: 36, right: 18, bottom: 4, left: 6 } },
      scales: {
        x: {
          type: "linear",
          grid: { color: "rgba(148,163,184,0.08)", drawTicks: false },
          ticks: {
            color: "#94a3b8", font: { size: 10 }, maxRotation: 0,
            callback(v) {
              const p = synthPoints.find(pp => pp.x === v);
              if (p && p.fixingIso) {
                const parts = p.fixingIso.split("-");
                if (parts.length === 3) {
                  const m = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"][Number(parts[1])-1];
                  return `${m}-${parts[0].slice(-2)}`;
                }
              }
              return `${Math.round(v)}d`;
            },
          },
          border: { color: "rgba(148,163,184,0.2)" },
        },
        y: {
          grid: { color: "rgba(148,163,184,0.08)", drawTicks: false },
          ticks: {
            color: "#94a3b8", font: { size: 10 },
            callback: v => `${Number(v).toFixed(0)}%`,
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
              const raw = ctx[0].raw;
              if (raw && raw._p) return `${raw._p.ticker} sintética`;
              if (raw && raw._fwd) return `Forward ${raw._fwd.from} → ${raw._fwd.to}`;
              return "";
            },
            label(ctx) {
              const raw = ctx.raw;
              if (raw && raw._p) {
                return [
                  `Bono ${mode.bondField.toUpperCase()}: ${fmtNumAr(raw._p.bondPxRaw, 2)} (= ${fmtNumAr(raw._p.bondPxPerUsd, 2)} /USD)`,
                  `Futuro ${raw._p.futSym} ${mode.futField.toUpperCase()}: ${fmtNumAr(raw._p.futPx, 2)}`,
                  `Futuro al fixing por curva: ${fmtNumAr(raw._p.futAtFixing, 2)}`,
                  `Fixing: ${formatDateDisplay(raw._p.fixingIso)} (3 dh antes vto)`,
                  `TNA sintetica: ${raw._p.tna.toFixed(2)}%`,
                ];
              }
              if (raw && raw._fwd) {
                return [
                  `${raw._fwd.from} (${Math.round(raw._fwd.fromDays)}d) → ${raw._fwd.to} (${Math.round(raw._fwd.toDays)}d)`,
                  `Span: ${Math.round(raw._fwd.span)}d`,
                  `Forward TNA: ${raw._fwd.fwd.toFixed(2)}%`,
                ];
              }
              return "";
            },
          },
        },
      },
    },
    plugins: [_dlkLabelsPlugin],
  };

  if (_syntheticChart) {
    _syntheticChart.data = cfg.data;
    _syntheticChart.options = cfg.options;
    _syntheticChart.resize();
    _syntheticChart.update("none");
  } else {
    _syntheticChart = new Chart(canvas.getContext("2d"), cfg);
  }
}

// (Curva de TNAs movida a frontend/futures_curve.js — modulo encapsulado)

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
    renderBrechaCards();
  }
}

function _futAsOfDateValue() {
  const el = document.querySelector("#futAsOfDate");
  return el && el.value ? el.value : "";
}

async function pollFutures() {
  try {
    const asOf = _futAsOfDateValue();
    const url = asOf ? `/api/futures?as_of_date=${asOf}` : "/api/futures";
    const response = await fetch(url);
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

let spotLiveCache = null;
let spotA3500Cache = null;
let spotItemsCount = 0;
let spotRediscoverTried = false;
async function pollSpot() {
  try {
    const response = await fetch("/api/fx/spot");
    if (!response.ok) throw new Error("spot");
    const payload = await response.json();
    spotLiveCache = payload.spot_live || null;
    spotA3500Cache = payload.a3500 || null;
    spotItemsCount = (payload.items || []).length;
    if (spotItemsCount === 0 && !spotRediscoverTried) {
      spotRediscoverTried = true;
      fetch("/api/futures/rediscover", { method: "POST" }).catch(() => {});
    }
  } catch (_) {
    /* ignore */
  } finally {
    renderSpotBanner();
  }
}

function fmtSpotValue(v) {
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 2, maximumFractionDigits: 4,
  }).format(v);
}

function _spotSourceTag(src) {
  if (src === "LA") return " · LA";
  if (src === "IV") return " · IV (intraday)";
  if (src === "CL") return " · CL (cierre)";
  return "";
}

function renderSpotBanner() {
  // SPOT LIVE: pinta los dos contenedores duplicados (FX y Futuros)
  const liveTargets = [
    { v: "#spotLiveValue",   m: "#spotLiveMeta" },
    { v: "#spotLiveValueFx", m: "#spotLiveMetaFx" },
  ];
  for (const t of liveTargets) {
    const liveValue = document.querySelector(t.v);
    const liveMeta = document.querySelector(t.m);
    if (!liveValue || !liveMeta) continue;
    if (spotLiveCache && spotLiveCache.last != null) {
      liveValue.textContent = fmtSpotValue(spotLiveCache.last);
      const sym = spotLiveCache.symbol || "DLR/SPOT";
      const ts = spotLiveCache.updated_at ? formatTime(spotLiveCache.updated_at) : "";
      liveMeta.innerHTML = `<strong>${sym}</strong>${ts ? " · " + ts : ""}${_spotSourceTag(spotLiveCache.last_source)}`;
    } else {
      liveValue.textContent = "—";
      liveMeta.textContent = spotItemsCount === 0
        ? "No hay simbolo spot suscripto"
        : "Esperando ticks (mercado 10-15h)";
    }
  }
  // A3500
  const a3500Targets = [
    { v: "#spotA3500Value",   m: "#spotA3500Meta" },
    { v: "#spotA3500ValueFx", m: "#spotA3500MetaFx" },
  ];
  for (const t of a3500Targets) {
    const a3500Value = document.querySelector(t.v);
    const a3500Meta = document.querySelector(t.m);
    if (!a3500Value || !a3500Meta) continue;
    if (spotA3500Cache && spotA3500Cache.last != null) {
      a3500Value.textContent = fmtSpotValue(spotA3500Cache.last);
      const date = spotA3500Cache.value_date ? formatDateDisplay(spotA3500Cache.value_date) : "";
      a3500Meta.textContent = `Comunicacion A 3500${date ? " · " + date : ""}`;
    } else {
      a3500Value.textContent = "—";
      a3500Meta.textContent = "Esperando publicacion BCRA";
    }
  }
  renderBrechaCards();
  // Si la calculadora DLK esta abierta y la fecha es hoy, refrescamos su FX live
  if (currentBondModel === "dlk" && DLK_STATE && DLK_STATE.fxDate) {
    const today = _todayIso();
    if (DLK_STATE.fxDate >= today) updateDlkFx();
  }
}

// ===== Brecha (MEP/CCL vs SPOT) =====
const BRECHA_STATE = {
  types: new Set(JSON.parse(localStorage.getItem("brechaTypes") || '["spread","relativo"]')),
  sources: new Set(JSON.parse(localStorage.getItem("brechaSources") || '["mep","ccl"]')),
};
function _saveBrechaState() {
  localStorage.setItem("brechaTypes", JSON.stringify([...BRECHA_STATE.types]));
  localStorage.setItem("brechaSources", JSON.stringify([...BRECHA_STATE.sources]));
}

function _findRatio(label) {
  // label: "MEP" o "CCL" — match contra fxRatiosCache items (AL30/AL30D = MEP, AL30/AL30C = CCL)
  if (!Array.isArray(fxRatiosCache)) return null;
  for (const it of fxRatiosCache) {
    if (it && String(it.label || "").toUpperCase() === label) {
      return Number(it.ratio);
    }
  }
  return null;
}

function _ensureBrechaCardUI(card) {
  if (card.dataset.uiReady === "1") return;
  card.innerHTML = `
    <div class="brecha-header">
      <span class="brecha-title">Brecha vs SPOT</span>
      <div class="brecha-toggles">
        <div class="brecha-toggle-group" data-group="type">
          <button type="button" data-val="spread">Spread</button>
          <button type="button" data-val="relativo">Relativo</button>
        </div>
        <div class="brecha-toggle-group" data-group="source">
          <button type="button" data-val="mep">MEP</button>
          <button type="button" data-val="ccl">CCL</button>
        </div>
      </div>
    </div>
    <div class="brecha-rows"></div>
  `;
  // Listeners
  card.querySelectorAll("button[data-val]").forEach(btn => {
    btn.addEventListener("click", () => {
      const group = btn.parentElement.dataset.group;
      const val = btn.dataset.val;
      const set = group === "type" ? BRECHA_STATE.types : BRECHA_STATE.sources;
      if (set.has(val)) {
        // No permitir desactivar el ultimo de cada grupo
        if (set.size > 1) set.delete(val);
      } else {
        set.add(val);
      }
      _saveBrechaState();
      renderBrechaCards();
    });
  });
  card.dataset.uiReady = "1";
}

function renderBrechaCards() {
  const cards = document.querySelectorAll(".brecha-card");
  if (!cards.length) return;
  const spot = (spotLiveCache && spotLiveCache.last != null) ? Number(spotLiveCache.last) : null;
  const mep = _findRatio("MEP");
  const ccl = _findRatio("CCL");

  for (const card of cards) {
    _ensureBrechaCardUI(card);
    // Sync estado de botones
    card.querySelectorAll("button[data-val]").forEach(btn => {
      const group = btn.parentElement.dataset.group;
      const val = btn.dataset.val;
      const set = group === "type" ? BRECHA_STATE.types : BRECHA_STATE.sources;
      btn.classList.toggle("active", set.has(val));
    });
    const rowsEl = card.querySelector(".brecha-rows");
    if (!rowsEl) continue;

    if (spot == null) {
      rowsEl.innerHTML = `<div class="brecha-empty">Esperando SPOT…</div>`;
      continue;
    }
    if (mep == null && ccl == null) {
      rowsEl.innerHTML = `<div class="brecha-empty">Esperando ratios MEP/CCL…</div>`;
      continue;
    }

    const sources = [...BRECHA_STATE.sources];
    const types = [...BRECHA_STATE.types];
    const variants = [];
    for (const src of ["mep", "ccl"]) {
      if (!sources.includes(src)) continue;
      const ratio = src === "mep" ? mep : ccl;
      if (ratio == null) continue;
      for (const ty of ["spread", "relativo"]) {
        if (!types.includes(ty)) continue;
        if (ty === "spread") {
          const v = ratio - spot;
          variants.push({
            label: `Spread ${src.toUpperCase()}`,
            sub: `Ratio ${fmtNumAr(ratio, 2)} − SPOT`,
            value: fmtNumAr(v, 2),
            neg: v < 0,
          });
        } else {
          const v = ((ratio / spot) - 1) * 100;
          variants.push({
            label: `Relativo ${src.toUpperCase()}`,
            sub: `(Ratio / SPOT) − 1`,
            value: `${fmtNumAr(v, 2)}%`,
            neg: v < 0,
          });
        }
      }
    }

    if (!variants.length) {
      rowsEl.innerHTML = `<div class="brecha-empty">Activá al menos un Tipo y una Fuente</div>`;
      continue;
    }

    rowsEl.innerHTML = variants
      .map(r => `
        <div class="brecha-row">
          <span class="brecha-row-label">${r.label}<small>${r.sub}</small></span>
          <span class="brecha-row-value ${r.neg ? "neg" : ""}">${r.value}</span>
        </div>
      `).join("");
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
  // Sync precios live a _latestArsItems para que la tabla ARS refleje el
  // ultimo last/bid/offer entre polls del endpoint ARS. Las metricas
  // (TIR, Duration, etc.) se recalculan recien en el proximo poll.
  if (_latestArsItems && _latestArsItems.length) {
    const bySymbol = new Map();
    for (const q of latestQuotes) bySymbol.set(q.symbol, q);
    for (const it of _latestArsItems) {
      const q = bySymbol.get(it.ticker);
      if (q) {
        if (q.last != null) it.last = q.last;
        if (q.bid != null) it.bid = q.bid;
        if (q.ask != null) it.offer = q.ask;
        if (q.change != null) it.change_pct = q.change;
      }
    }
  }
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
  document.getElementById("adminView")?.classList.toggle("active", view === "admin");
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
    savedLecaps.innerHTML = '<tr><td colspan="6" class="empty-state">No se pudieron cargar las LECAPs guardadas</td></tr>';
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
  const isDlk = model === "dlk";
  // DLK reusa el template de Hard Dollar pero agrega FX bar + cashflow ARS
  const showHdTemplate = isHardDollar || isDlk;
  const isTamar = model === "tamar";
  const isDual = model === "dual";
  const isFixedRate = model === "pesos_fixed_rate";
  const fixedRateTemplate = document.querySelector("#fixedRateTemplate");
  currentBondModel = model;
  lecapTemplate.classList.toggle("d-none", !isLecap);
  hardDollarTemplate.classList.toggle("d-none", !showHdTemplate);
  if (tamarTemplate) tamarTemplate.classList.toggle("d-none", !isTamar);
  if (fixedRateTemplate) fixedRateTemplate.classList.toggle("d-none", !isFixedRate);
  lecapSubmenu.classList.toggle("d-none", !isLecap);
  dualSubmenu.classList.toggle("d-none", !isDual);
  calculatorPlaceholder.classList.toggle("d-none", isLecap || showHdTemplate || isTamar || isFixedRate);

  // Mostrar/ocultar extras DLK + ajustar titulo del cashflow
  const dlkBar = document.querySelector("#dlkFxBar");
  const dlkArs = document.querySelector("#dlkArsCashflowSection");
  const cashflowTitle = document.querySelector("#hdCashflowSectionTitle");
  if (dlkBar) dlkBar.classList.toggle("d-none", !isDlk);
  if (dlkArs) dlkArs.classList.toggle("d-none", !isDlk);
  if (cashflowTitle) cashflowTitle.textContent = isDlk ? "Cashflow nominal (USD)" : "Cashflow Bono HD";

  if (isLecap) {
    calculatorPlaceholder.textContent = "";
    fetchLecapTickers().catch(() => {});
    setLecapMode("search");
  } else if (showHdTemplate) {
    renderHardDollarCouponInputs();
    setHdMode(isDlk ? "new" : "search");
    if (isDlk) initDlkFxBar();
  } else if (isTamar) {
    if (tamarIssueDate) attachDdmmAutoformat(tamarIssueDate);
    if (tamarMaturityDate) attachDdmmAutoformat(tamarMaturityDate);
    if (tamarAsOfDate && !tamarAsOfDate.value) tamarAsOfDate.value = _todayIso();
    fetchTamarSavedList?.().catch(() => {});
  } else if (isFixedRate) {
    calculatorPlaceholder.textContent = "";
    initFrTemplate();
    setFrMode("search");
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
  const fmt3 = { minimumFractionDigits: 3, maximumFractionDigits: 3 };
  cashflowPreview.innerHTML = payload.cashflows.map((cashflow) => `
    <tr>
      <td>${cashflow.number}</td>
      <td>${formatDate(cashflow.payment_date)}</td>
      <td>${formatDate(cashflow.effective_payment_date)}</td>
      <td class="text-end">${formatNumber(cashflow.applicable_days)}</td>
      <td class="text-end">${formatNumber(cashflow.amortization_vn, fmt3)}</td>
      <td class="text-end">${formatNumber(cashflow.amortization_vr, fmt3)}</td>
      <td class="text-end">${formatPercent(cashflow.applicable_rate, 3)}</td>
      <td class="text-end">${formatNumber(cashflow.interest, fmt3)}</td>
      <td class="text-end">${formatNumber(cashflow.total, fmt3)}</td>
    </tr>
  `).join("");

  latestLecapCalculation = payload;
  saveLecap.disabled = false;
  setCalculatorStatus("ok", `${payload.ticker} calculada`);
}

function renderSavedLecaps(payload) {
  const items = payload.items || [];
  if (!items.length) {
    savedLecaps.innerHTML = '<tr><td colspan="6" class="empty-state">Todavia no hay LECAPs guardadas</td></tr>';
    return;
  }

  const fmt3 = { minimumFractionDigits: 3, maximumFractionDigits: 3 };
  const isAdmin = window.__currentUser?.role === "admin";
  window.__savedLecapsCache = items;
  savedLecaps.innerHTML = items.map((item, idx) => {
    const adminBtn = isAdmin
      ? `<button type="button" class="lc-delete-btn" data-lecap-delete="${item.id}" title="Eliminar">✕</button>`
      : "";
    return `
      <tr class="saved-row" data-lecap-row="${idx}">
        <td class="ticker">${adminBtn}${item.ticker}</td>
        <td>TEM</td>
        <td>${formatDate(item.issue_date)}</td>
        <td>${formatDate(item.maturity_date)}</td>
        <td class="text-end">${formatNumber(item.face_value, fmt3)}</td>
        <td class="text-end">${formatNumber(item.tem_emission_percent, fmt3)}% TEM</td>
      </tr>
    `;
  }).join("");
}

async function deleteLecap(itemId) {
  if (!itemId) return;
  if (!confirm("¿Eliminar esta LECAP guardada? No se puede deshacer.")) return;
  const r = await fetch(`/api/calculators/lecaps/saved/${itemId}`, {
    method: "DELETE",
    credentials: "same-origin",
  });
  if (!r.ok) {
    const detail = r.status === 403 ? "Solo admin puede eliminar" : "No se pudo eliminar";
    setCalculatorStatus("error", detail);
    return;
  }
  setCalculatorStatus("ok", "LECAP eliminada");
  await fetchSavedLecaps();
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
  if (hdStatusBottom) {
    hdStatusBottom.dataset.kind = kind;
    hdStatusBottom.textContent = text;
  }
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
  const couponType = hdCouponType.value;
  const isStepLike = couponType === "step_up" || couponType === "step_down";
  hdFixedCouponWrap.classList.toggle("d-none", isStepLike);
  hdStepUpSection.classList.toggle("d-none", !isStepLike);
  const isAmortizable = hdBondType.value === "amortizable";
  hdAmortizationSection.classList.toggle("d-none", !isAmortizable);

  // Actualizar titulo de la seccion segun el tipo
  const stepHeading = hdStepUpSection?.querySelector("h3");
  if (stepHeading) {
    stepHeading.textContent = couponType === "step_down"
      ? "Cupon step-down por año"
      : "Cupon step-up por año";
  }

  if (!isStepLike) {
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
  const couponType = hdCouponType.value;
  const isStepLike = couponType === "step_up" || couponType === "step_down";
  if (!isStepLike) {
    return parseFloat(hdFixedCoupon.value) || 0;
  }
  const input = hdStepUpRows.querySelector(`input[data-hd-step-year="${year}"]`);
  if (!input || input.value === "") return 0;
  return parseFloat(input.value) || 0;
}

// Snapshot de cupones originales (antes de aplicar diferimiento) para poder
// restaurar. Se setea cuando se generan/importan los cupones.
let hdCouponsOriginal = null;

// Limpia TODO el estado HD entre bonos para no contaminar valores residuales,
// amortizaciones, gracia, cashflow previo, etc.
function resetHdState() {
  hdCoupons = [];
  hdCouponsOriginal = null;
  hdAnnualAmortByYear = {};
  hdLastCalculation = null;
  hdGraceConfig = { mode: "none", first_period_index: null };
  if (hdGraceMode) hdGraceMode.value = "none";
  if (hdGraceStatus) hdGraceStatus.textContent = "-";
  if (hdDeferredStatus) hdDeferredStatus.textContent = "-";
  if (hdCashflowBody) hdCashflowBody.innerHTML = '<tr><td colspan="10" class="empty-state">Sin cashflow para mostrar</td></tr>';
  if (hdSaveCashflow) hdSaveCashflow.disabled = true;
  if (hdDownloadCashflow) hdDownloadCashflow.disabled = true;
  if (hdAmortPctPerPeriod) hdAmortPctPerPeriod.value = "";
}

// Inicio de pagos: ELIMINA los flujos previos al primer flujo que paga, asi el
// nuevo primer flujo acumula naturalmente desde la fecha de emision (el backend
// usa issue_date como period_start del primer cupon).
function snapshotHdCouponsOriginal() {
  hdCouponsOriginal = hdCoupons.map((c) => ({ ...c }));
}

function renderHdDeferredControls() {
  if (!hdDeferredSection) return;
  if (!hdCoupons.length) {
    hdDeferredSection.classList.add("d-none");
    return;
  }
  hdDeferredSection.classList.remove("d-none");
  if (hdDeferredPeriod) {
    const refList = hdCouponsOriginal && hdCouponsOriginal.length >= hdCoupons.length ? hdCouponsOriginal : hdCoupons;
    hdDeferredPeriod.innerHTML = refList.map((c, i) =>
      `<option value="${i}">Flujo ${i + 1} - ${formatDateDisplay(c.payment_date)}</option>`
    ).join("");
  }
}

// Las secciones <details> arrancan ocultas con d-none. Tras generar los
// cupones las marcamos visibles pero CERRADAS (open=false) para mantener
// el UI minimalista — el usuario las despliega solo si las necesita.
function ensureHdDetailsVisible() {
  for (const el of [hdDeferredSection, hdGraceSection]) {
    if (!el) continue;
    el.classList.remove("d-none");
    if (el.tagName === "DETAILS") el.open = false;
  }
}

function applyHdDeferredStart() {
  if (!hdCouponsOriginal || !hdCouponsOriginal.length) {
    setHdStatus("error", "Generar cupones primero");
    return;
  }
  const idx = parseInt(hdDeferredPeriod?.value, 10);
  if (!Number.isFinite(idx) || idx < 0 || idx >= hdCouponsOriginal.length) {
    setHdStatus("error", "Seleccionar un flujo valido");
    return;
  }
  // Eliminar los primeros idx flujos. El nuevo flujo 1 acumulara desde issue_date.
  hdCoupons = hdCouponsOriginal.slice(idx).map((c) => ({ ...c }));
  if (hdDeferredStatus) {
    if (idx === 0) {
      hdDeferredStatus.textContent = "Sin diferimiento";
    } else {
      hdDeferredStatus.textContent = `Eliminados ${idx} flujos previos. Nuevo flujo 1 acumula desde la emision.`;
    }
  }
  // Recalcular tasas para los flujos restantes
  hdCoupons = hdCoupons.map((c) => ({
    ...c,
    annual_rate_percent: c.payment_date ? getHdAnnualRateForYear(c.payment_date.slice(0, 4)) : 0,
    in_grace: false,
  }));
  recomputePeriodAmortizations();
  renderHdAnnualAmortRows();
  renderHdGraceControls();
  applyHdGracePeriod();
  renderHdCouponsTable();
}

function resetHdDeferredStart() {
  if (!hdCouponsOriginal || !hdCouponsOriginal.length) return;
  hdCoupons = hdCouponsOriginal.map((c) => ({ ...c, in_grace: false }));
  if (hdDeferredPeriod) hdDeferredPeriod.value = "0";
  if (hdDeferredStatus) hdDeferredStatus.textContent = "Restaurado a todos los flujos";
  hdCoupons = hdCoupons.map((c) => ({
    ...c,
    annual_rate_percent: c.payment_date ? getHdAnnualRateForYear(c.payment_date.slice(0, 4)) : 0,
  }));
  recomputePeriodAmortizations();
  renderHdAnnualAmortRows();
  renderHdGraceControls();
  applyHdGracePeriod();
  renderHdCouponsTable();
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
  resetHdState();
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
    snapshotHdCouponsOriginal();
    renderHdAnnualAmortRows();
    recomputePeriodAmortizations();
    renderHdDeferredControls();
    renderHdGraceControls();
    applyHdGracePeriod();
    ensureHdDetailsVisible();
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

// Cache de bonos guardados para evitar re-fetch en cada keystroke del filtro.
let _hdSavedCache = null;
async function fetchHdSavedList() {
  if (!hdSavedList) return;
  try {
    const response = await fetch("/api/calculators/bond-hd/saved");
    if (!response.ok) throw new Error("No se pudo leer la lista");
    const payload = await response.json();
    _hdSavedCache = payload.items || [];
    renderHdSavedList(_hdSavedCache);
  } catch (error) {
    hdSavedList.innerHTML = '<span class="empty-cell">No se pudo leer la lista de bonos guardados</span>';
    console.error("[Bono HD] lista guardados", error);
  }
}

// Detecta la "familia" de un ticker: AL30D -> AL30, GD35C -> GD35, etc.
function _hdFamilyOf(ticker) {
  const t = String(ticker || "").toUpperCase().trim();
  if (!t) return "";
  return t.replace(/[DCVNM]+$/, "") || t;
}

// Taxonomia jerarquica de clasificaciones de bonos guardados.
// Hojas (leaves) tienen "key" que matchea con el campo classification del payload.
const HD_CLASSIFICATION_TREE = [
  {
    title: "Bonos en pesos",
    children: [
      {
        title: "Bonceres y Leceres",
        children: [
          { key: "boncer", title: "Bonceres", desc: "CER vto >1 año" },
          { key: "lecer",  title: "Leceres",  desc: "CER vto ≤1 año" },
        ],
      },
      {
        title: "Duales",
        children: [
          { key: "dual_cer_tamar",  title: "Duales CER + TAMAR" },
          { key: "dual_fija_tamar", title: "Duales Fija + TAMAR" },
        ],
      },
      {
        title: "Tamares",
        children: [{ key: "tamar", title: "TAMAR" }],
      },
      {
        title: "Lecaps y Boncaps",
        children: [
          { key: "lecap",  title: "Lecaps",  desc: "Fija ≤1 año" },
          { key: "boncap", title: "Boncaps", desc: "Fija >1 año" },
        ],
      },
    ],
  },
  {
    title: "Dollar-Linked",
    children: [
      { key: "soberano_dlk", title: "Soberanos DLK", desc: ">1 año" },
      { key: "letra_dlk",    title: "Letras DLK",    desc: "≤1 año" },
      { key: "corpo_dlk",    title: "Corpo DLK" },
    ],
  },
  {
    title: "Hard Dollar",
    children: [
      { key: "soberano_hd", title: "Soberanos HD" },
      { key: "corpo_hd",    title: "Corpo HD" },
    ],
  },
];

// Lee la clasificacion guardada de un item. Tolerante a items legacy sin payload.
function _hdItemClassification(item) {
  return (item && item.payload && item.payload.classification) || null;
}

function _hdSavedItemHtml(item) {
  const cls = _hdItemClassification(item);
  const clsTag = cls ? `<small class="hd-saved-cls">[${cls}]</small>` : "";
  return `
    <div class="hd-saved-row">
      <button type="button" class="hd-saved-item" data-hd-saved-ticker="${item.ticker}">
        <strong>${item.ticker}</strong> ${clsTag}
        <small>${formatDateDisplay(item.issue_date)} → ${formatDateDisplay(item.maturity_date)} · ${item.bond_type} · ${item.frequency}</small>
      </button>
      <button type="button" class="btn btn-sm btn-outline-danger hd-saved-delete" data-hd-saved-delete="${item.ticker}" title="Eliminar">x</button>
    </div>
  `;
}

// Recorre el arbol y devuelve HTML jerarquico. byKey: { classification_key -> [items] }
function _renderClassificationNode(node, byKey, level, openLeaves) {
  // Hoja: tiene key
  if (node.key != null) {
    const list = byKey.get(node.key) || [];
    const count = list.length;
    if (!count) return ""; // hojas vacias no se muestran
    const sorted = list.slice().sort((a, b) => String(a.ticker).localeCompare(String(b.ticker)));
    const desc = node.desc ? ` <em>· ${node.desc}</em>` : "";
    const open = openLeaves.has(node.key);
    return `
      <details class="hd-saved-tree-node hd-saved-tree-leaf level-${level}" ${open ? "open" : ""}>
        <summary><strong>${node.title}</strong>${desc} <small>(${count})</small></summary>
        <div class="hd-saved-tree-body">
          ${sorted.map(_hdSavedItemHtml).join("")}
        </div>
      </details>
    `;
  }
  // Branch: tiene children
  const childrenHtml = (node.children || [])
    .map(c => _renderClassificationNode(c, byKey, level + 1, openLeaves))
    .filter(Boolean)
    .join("");
  if (!childrenHtml) return "";
  // Si la rama solo tiene 1 hijo y es hoja, devolver hoja directa (evita anidado redundante).
  // Eg: "Tamares" > "TAMAR" — mostrar solo "Tamares".
  return `
    <details class="hd-saved-tree-node hd-saved-tree-branch level-${level}" open>
      <summary><strong>${node.title}</strong></summary>
      <div class="hd-saved-tree-body">
        ${childrenHtml}
      </div>
    </details>
  `;
}

function renderHdSavedList(items) {
  if (!hdSavedList) return;
  if (!items.length) {
    hdSavedList.innerHTML = '<span class="empty-cell">Todavia no guardaste ningun Bono HD.</span>';
    return;
  }
  const filter = (hdSearchTicker?.value || "").trim().toUpperCase();

  // Match destacado arriba: tickers que empiezan con el filtro
  let highlightHtml = "";
  if (filter) {
    const matches = items.filter(it => String(it.ticker || "").toUpperCase().startsWith(filter));
    if (matches.length) {
      highlightHtml = `
        <div class="hd-saved-highlight">
          <div class="hd-saved-highlight-label">Coincidencia${matches.length > 1 ? "s" : ""} para "${filter}"</div>
          ${matches.map(_hdSavedItemHtml).join("")}
        </div>
      `;
    } else {
      highlightHtml = `<div class="hd-saved-empty">Sin coincidencias para "${filter}".</div>`;
    }
  }

  // Agrupar items por classification key
  const byKey = new Map();
  const unclassified = [];
  for (const it of items) {
    const k = _hdItemClassification(it);
    if (!k) {
      unclassified.push(it);
    } else {
      if (!byKey.has(k)) byKey.set(k, []);
      byKey.get(k).push(it);
    }
  }

  // Hojas que abrir si el filtro matchea con algun item
  const openLeaves = new Set();
  if (filter) {
    for (const [k, arr] of byKey.entries()) {
      if (arr.some(it => String(it.ticker || "").toUpperCase().startsWith(filter))) {
        openLeaves.add(k);
      }
    }
  }

  const treeHtml = HD_CLASSIFICATION_TREE
    .map(node => _renderClassificationNode(node, byKey, 0, openLeaves))
    .filter(Boolean)
    .join("");

  // Sin clasificar: catch-all al final
  let unclassifiedHtml = "";
  if (unclassified.length) {
    const sorted = unclassified.slice().sort((a, b) => String(a.ticker).localeCompare(String(b.ticker)));
    const open = filter && sorted.some(it => String(it.ticker || "").toUpperCase().startsWith(filter));
    unclassifiedHtml = `
      <details class="hd-saved-tree-node hd-saved-tree-leaf level-0 hd-saved-unclassified" ${open ? "open" : ""}>
        <summary><strong>Sin clasificar</strong> <small>(${sorted.length})</small></summary>
        <div class="hd-saved-tree-body">
          ${sorted.map(_hdSavedItemHtml).join("")}
        </div>
      </details>
    `;
  }

  hdSavedList.innerHTML = highlightHtml + treeHtml + unclassifiedHtml;
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
  // Clasificacion: la persistimos dentro del payload JSON para no migrar el
  // schema del backend. Si esta vacia se guarda como "unclassified".
  const classification = (document.getElementById("hdClassification")?.value || "").trim() || null;
  const payloadWithMeta = { ...hdLastCalculation, classification };
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
        payload: payloadWithMeta,
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
  resetHdState();

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
    snapshotHdCouponsOriginal();
    renderHdAnnualAmortRows();
    recomputePeriodAmortizations();
    renderHdDeferredControls();
    renderHdGraceControls();
    applyHdGracePeriod();
    ensureHdDetailsVisible();
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
    if (hdDownloadCashflow) hdDownloadCashflow.disabled = false;
    setHdStatus("ok", "Cashflow calculado");
  } catch (error) {
    setHdStatus("error", error.message || "Error al calcular");
  }
}

function downloadHdCashflowCsv() {
  if (!hdLastCalculation || !hdLastCalculation.cashflows || !hdLastCalculation.cashflows.length) {
    setHdStatus("error", "No hay cashflow calculado para descargar");
    return;
  }
  const headers = [
    "Numero", "Fecha teorica", "Fecha efectiva",
    "Periodo desde", "Periodo hasta", "Dias del periodo", "Year fraction",
    "Tasa anual %", "Tasa periodo %",
    "Amortizacion VN %", "VN residual %",
    "Amortizacion c/100", "Interes c/100", "Total c/100",
    "Amortizacion $", "Interes $", "Total $",
  ];
  const rows = hdLastCalculation.cashflows.map((c) => [
    c.number, c.payment_date, c.effective_payment_date,
    c.period_start, c.period_end, c.period_days, c.year_fraction,
    c.annual_rate_percent, c.period_rate_percent,
    c.amortization_vn_percent, c.residual_vn_percent,
    c.amortization_per_100, c.interest_per_100, c.total_per_100,
    c.amortization_amount, c.interest_amount, c.total_amount,
  ]);
  const formatCell = (v) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    // Si tiene coma o comillas o salto de linea, escapar
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const csv = [headers, ...rows].map((row) => row.map(formatCell).join(",")).join("\n");
  // BOM para que Excel detecte UTF-8 correctamente
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const ticker = hdTicker?.value?.trim() || "bono_hd";
  const today = new Date().toISOString().slice(0, 10);
  const a = document.createElement("a");
  a.href = url;
  a.download = `cashflow_${ticker}_${today}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  setHdStatus("ok", `CSV descargado: cashflow_${ticker}_${today}.csv`);
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
  // En modo DLK, ademas pintamos el cashflow ajustado por FX
  if (currentBondModel === "dlk") renderDlkArsCashflow();
}

// ============================ DLK calculator ============================
const DLK_STATE = {
  fxValue: null,
  fxSource: null,    // "DLR/SPOT (LA|IV|CL)" o "A3500 dd/mm/aaaa"
  fxDate: null,      // ISO YYYY-MM-DD seleccionada
  initialized: false,
};

function _todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function initDlkFxBar() {
  const dateInput = document.querySelector("#dlkValuationDate");
  if (!dateInput) return;
  if (!dateInput.value) dateInput.value = _todayIso();
  if (!DLK_STATE.initialized) {
    dateInput.addEventListener("change", () => updateDlkFx());
    DLK_STATE.initialized = true;
  }
  updateDlkFx();
}

async function updateDlkFx() {
  const dateInput = document.querySelector("#dlkValuationDate");
  const valueEl = document.querySelector("#dlkFxValue");
  const metaEl = document.querySelector("#dlkFxMeta");
  if (!dateInput || !valueEl || !metaEl) return;
  const selectedDate = dateInput.value || _todayIso();
  const today = _todayIso();
  DLK_STATE.fxDate = selectedDate;

  // Prioridad: A3500 publicado para esa fecha. Fallback (solo si fecha == hoy
  // y A3500 aun no publicado): DLR/SPOT live.
  valueEl.textContent = "…";
  metaEl.textContent = `Buscando A3500 publicado al ${formatDateDisplay(selectedDate)}…`;
  let a3500 = null;
  try {
    const from = new Date(selectedDate);
    from.setDate(from.getDate() - 10);
    const fromIso = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, "0")}-${String(from.getDate()).padStart(2, "0")}`;
    const url = `/api/bcra/series/usd_mayorista_a3500?desde=${fromIso}&hasta=${selectedDate}&limit=20`;
    const r = await fetch(url);
    if (r.ok) {
      const payload = await r.json();
      const points = payload?.points || payload?.data || [];
      // Buscamos el A3500 cuya fecha coincida exactamente con selectedDate
      // (solo cuenta como "publicado para ese dia" si la fecha matchea).
      for (const p of points) {
        const d = p.date || p.fecha || p.value_date;
        const v = p.value != null ? p.value : p.valor;
        if (d === selectedDate && v != null) {
          a3500 = Number(v);
          break;
        }
      }
      // Si no hay match exacto y la fecha es pasada, tomamos el ultimo
      // publicado <= selectedDate (los habiles previos cubren el feriado).
      if (a3500 == null && selectedDate < today) {
        let chosen = null;
        for (const p of points) {
          const d = p.date || p.fecha || p.value_date;
          const v = p.value != null ? p.value : p.valor;
          if (!d || v == null) continue;
          if (d <= selectedDate && (!chosen || d > chosen.d)) chosen = { d, v: Number(v) };
        }
        if (chosen) a3500 = chosen.v;
      }
    }
  } catch (err) {
    // Silencioso: si BCRA falla y la fecha es hoy, vamos al fallback SPOT.
  }

  if (a3500 != null) {
    DLK_STATE.fxValue = a3500;
    DLK_STATE.fxSource = `A3500 (BCRA · ${formatDateDisplay(selectedDate)})`;
    valueEl.textContent = fmtNumAr(a3500, 4);
    metaEl.innerHTML = `<b>${DLK_STATE.fxSource}</b>`;
  } else if (selectedDate === today) {
    // Fallback: SPOT live (durante la rueda, antes de que BCRA publique A3500)
    const spot = (spotLiveCache && spotLiveCache.last != null) ? Number(spotLiveCache.last) : null;
    const src = spotLiveCache?.last_source || "";
    if (spot != null) {
      DLK_STATE.fxValue = spot;
      DLK_STATE.fxSource = `DLR/SPOT${src ? " · " + src : ""}`;
      valueEl.textContent = fmtNumAr(spot, 2);
      metaEl.innerHTML = `<b>${DLK_STATE.fxSource}</b> · A3500 aun no publicado para hoy`;
    } else {
      DLK_STATE.fxValue = null;
      DLK_STATE.fxSource = null;
      valueEl.textContent = "—";
      metaEl.textContent = "Sin A3500 ni SPOT live disponibles";
    }
  } else {
    DLK_STATE.fxValue = null;
    DLK_STATE.fxSource = null;
    valueEl.textContent = "—";
    metaEl.textContent = `Sin A3500 publicado para esa fecha`;
  }

  if (currentBondModel === "dlk") renderDlkArsCashflow();
}

function renderDlkArsCashflow() {
  const body = document.querySelector("#dlkArsCashflowBody");
  if (!body) return;
  const cashflows = (hdLastCalculation && hdLastCalculation.cashflows) || [];
  if (!cashflows.length) {
    body.innerHTML = '<tr><td colspan="11" class="empty-state">Calcula el cashflow para ver los flujos ajustados</td></tr>';
    return;
  }
  const fx = DLK_STATE.fxValue;
  if (fx == null || !isFinite(fx) || fx <= 0) {
    body.innerHTML = '<tr><td colspan="11" class="empty-state">FX no disponible — sin A3500 publicado ni SPOT live</td></tr>';
    return;
  }
  // Filtrar solo flujos no cobrados (fecha de pago > fecha de valuacion)
  const refDate = DLK_STATE.fxDate || _todayIso();
  const unpaid = cashflows.filter((row) => {
    const payDate = row.effective_payment_date || row.payment_date;
    return payDate && payDate > refDate;
  });
  if (!unpaid.length) {
    body.innerHTML = '<tr><td colspan="11" class="empty-state">Todos los flujos ya estan cobrados a esta fecha</td></tr>';
    return;
  }
  // Para todos los flujos no cobrados aplicamos el mismo TC (el de la fecha
  // de valuacion). En la columna "Fecha" del Tipo de cambio mostramos refDate.
  body.innerHTML = unpaid.map((row) => {
    const amortNominalVn = Number(row.amortization_per_100) || 0;
    const interestNominalVn = Number(row.interest_per_100) || 0;
    const amortPct = Number(row.amortization_vn_percent) || 0;
    const residualPct = Number(row.residual_vn_percent) || 0;
    const annualPct = Number(row.annual_rate_percent) || 0;
    const periodPct = Number(row.period_rate_percent) || 0;
    const amortAdj = amortNominalVn * fx;
    const interestAdj = interestNominalVn * fx;
    const totalAdj = amortAdj + interestAdj;
    return `
      <tr>
        <td>${row.number}</td>
        <td>${formatDate(row.effective_payment_date || row.payment_date)}</td>
        <td class="text-end">${formatNumber(amortPct, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</td>
        <td class="text-end">${formatNumber(residualPct, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</td>
        <td>${formatDate(refDate)}</td>
        <td class="text-end">${formatNumber(fx, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
        <td class="text-end">${formatNumber(annualPct, { minimumFractionDigits: 4, maximumFractionDigits: 4 })}%</td>
        <td class="text-end">${formatNumber(periodPct, { minimumFractionDigits: 4, maximumFractionDigits: 4 })}%</td>
        <td class="text-end">${formatNumber(amortAdj, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td class="text-end">${formatNumber(interestAdj, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td class="text-end"><b>${formatNumber(totalAdj, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b></td>
      </tr>
    `;
  }).join("");
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

// Parsea numero permitiendo coma o punto como separador decimal.
function parseNumberArg(value) {
  if (value == null) return NaN;
  const s = String(value).trim().replace(",", ".");
  if (s === "") return NaN;
  return Number(s);
}

function resetLecapForm() {
  if (lecapTicker) lecapTicker.selectedIndex = 0;
  if (issueDate) issueDate.value = "";
  if (maturityDate) maturityDate.value = "";
  if (faceValue) faceValue.value = "100";
  if (temEmission) temEmission.value = "";
  if (cashflowPreview) cashflowPreview.innerHTML = '<tr><td colspan="9" class="empty-state">Completa los datos iniciales</td></tr>';
  latestLecapCalculation = null;
  if (saveLecap) saveLecap.disabled = true;
  setCalculatorStatus("draft", "Borrador");
}

function setLecapMode(mode) {
  const searchPanel = document.querySelector("#lcSearchPanel");
  const newPanel = document.querySelector("#lcNewPanel");
  const switcher = document.querySelector("#lcModeSwitch");
  if (!searchPanel || !newPanel) return;
  const isSearch = mode === "search";
  searchPanel.classList.toggle("d-none", !isSearch);
  newPanel.classList.toggle("d-none", isSearch);
  switcher?.querySelectorAll("[data-lc-mode]").forEach((button) => {
    const active = button.dataset.lcMode === mode;
    button.classList.toggle("active", active);
    button.classList.toggle("btn-dark", active);
    button.classList.toggle("btn-outline-dark", !active);
  });
  if (isSearch) {
    fetchSavedLecaps().catch(() => {});
  } else {
    // Cuando entras a "crear nuevo" se limpian los campos del calculo anterior
    resetLecapForm();
    // Refresca la lista de tickers (puede haber customs nuevos) y muestra el
    // input de "agregar ticker" si el usuario es admin
    fetchLecapTickers().catch(() => {});
    const addWrap = document.querySelector("#lecapAddTickerWrap");
    const isAdmin = window.__currentUser?.role === "admin";
    if (addWrap) addWrap.classList.toggle("d-none", !isAdmin);
  }
}

async function fetchLecapTickers() {
  if (!lecapTicker) return;
  try {
    const r = await fetch("/api/calculators/lecaps/tickers", { credentials: "same-origin" });
    if (!r.ok) return;
    const j = await r.json();
    const previous = lecapTicker.value;
    lecapTicker.innerHTML = (j.tickers || [])
      .map((t) => `<option value="${t}">${t}</option>`)
      .join("");
    if (previous && (j.tickers || []).includes(previous)) lecapTicker.value = previous;
  } catch (e) {
    console.error("[lecap] tickers fetch", e);
  }
}

async function addLecapTicker() {
  const inputEl = document.querySelector("#lecapNewTicker");
  if (!inputEl) return;
  const ticker = (inputEl.value || "").toUpperCase().trim();
  if (!ticker) return;
  try {
    const r = await fetch("/api/calculators/lecaps/tickers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ ticker }),
    });
    if (!r.ok) {
      const detail = r.status === 403 ? "Solo admin puede agregar" : "Ticker invalido";
      setCalculatorStatus("error", detail);
      return;
    }
    inputEl.value = "";
    await fetchLecapTickers();
    if (lecapTicker) lecapTicker.value = ticker;
    setCalculatorStatus("ok", `${ticker} agregado`);
  } catch (e) {
    console.error("[lecap] add ticker", e);
    setCalculatorStatus("error", "Error de red");
  }
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

  const faceValueNum = parseInt(faceValue.value, 10);
  const temNum = parseNumberArg(temEmission.value);
  if (!Number.isInteger(faceValueNum) || faceValueNum <= 0) {
    setCalculatorStatus("error", "VNO debe ser entero positivo");
    return;
  }
  if (!isFinite(temNum)) {
    setCalculatorStatus("error", "TEM invalida");
    return;
  }

  const response = await fetch("/api/calculators/lecaps", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ticker: lecapTicker.value,
      issue_date: issueIso,
      maturity_date: maturityIso,
      face_value: faceValueNum,
      tem_emission_percent: temNum,
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
    if (currentMarketCategory === "futuros_dlk") {
      pollFutures();
      pollSpot();
    }
    if (currentMarketCategory === "ars") {
      pollArsMarket();
    }
  });
});

// ============================================================
// ARS Market: combina LECAPs + Tasa Fija con metricas de tasa
// ============================================================
let _latestArsItems = [];
let _arsPollTimer = null;

async function pollArsMarket() {
  try {
    const r = await fetch("/api/market/ars?settlement=t1", { credentials: "same-origin" });
    if (!r.ok) return;
    const j = await r.json();
    _latestArsItems = j.items || [];
    if (currentMarketCategory === "ars") renderArsMarket();
  } catch (e) {
    console.error("[ars] fetch error", e);
  }
  // Re-poll cada 5s mientras estemos en la tab. La metricas se recalculan
  // server-side con el precio fresco, asi la curva se mueve.
  if (_arsPollTimer) clearTimeout(_arsPollTimer);
  if (currentMarketCategory === "ars") {
    _arsPollTimer = setTimeout(pollArsMarket, 5000);
  }
}

function renderArsMarket() {
  setMarketTableLayout("ars", `
    <tr>
      <th scope="col" colspan="9" class="ars-header-title">Tasa Fija</th>
    </tr>
    <tr>
      <th scope="col" class="text-end">Var %</th>
      <th scope="col">Nombre</th>
      <th scope="col" class="text-end">Precio</th>
      <th scope="col" class="text-end">TIR</th>
      <th scope="col" class="text-end">Duration</th>
      <th scope="col" class="text-end">MD</th>
      <th scope="col">Vencimiento</th>
      <th scope="col" class="text-end">TNA (365)</th>
      <th scope="col" class="text-end">TEM</th>
    </tr>
  `);
  const items = _latestArsItems || [];
  if (!items.length) {
    quotesBody.innerHTML = '<tr><td colspan="9" class="empty-state">Cargando bonos pesos...</td></tr>';
    instrumentCount.textContent = 0;
    return;
  }
  instrumentCount.textContent = items.length;
  const fmtPct = (v) => v == null ? "—" : (v * 100).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%";
  const fmtNum = (v, dec = 2) => v == null ? "—" : Number(v).toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
  const fmtDate = (iso) => {
    if (!iso) return "—";
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  };
  patchMarketBody(items, [
    {
      html: (it) => fmtNum(it.change_pct),
      className: (it) => "text-end " + (it.change_pct > 0 ? "positive" : it.change_pct < 0 ? "negative" : ""),
    },
    { html: (it) => it.ticker, className: "ticker ars-clickable-ticker" },
    { html: (it) => fmtNum(it.last), className: "text-end" },
    { html: (it) => fmtPct(it.tir), className: "text-end" },
    { html: (it) => fmtNum(it.duration, 2), className: "text-end" },
    { html: (it) => fmtNum(it.modified_duration, 2), className: "text-end" },
    { html: (it) => fmtDate(it.maturity_date) },
    { html: (it) => fmtPct(it.tna_365), className: "text-end" },
    { html: (it) => fmtPct(it.tem), className: "text-end" },
  ], (it) => it.ticker);
  // Marcar las filas con data-ars-row para click handler
  quotesBody.querySelectorAll("tr[data-key]").forEach((row) => {
    row.classList.add("ars-row-clickable");
    row.setAttribute("data-ars-ticker", row.getAttribute("data-key"));
  });
  // Solo re-renderear la curva cuando los datos relevantes cambian.
  // Evita parpadeos cuando WebSocket dispara renderQuotes con datos iguales.
  const hash = _arsItemsHash(items);
  if (hash !== _arsCurveLastHash) {
    _arsCurveLastHash = hash;
    renderArsCurve();
  }
}

// What-ifs: { ticker: { type: "price"|"tna", value, computed: {tir, tna_365, tem, duration, modified_duration, days_to_maturity, price} } }
const _arsWhatIfs = {};
// Hash de la ultima versionrenderizada en la curva, para evitar rebuilds
// en cada WebSocket tick cuando los datos no cambiaron.
let _arsCurveLastHash = "";

function _arsAttachListeners() {
  if (_arsAttachListeners._done) return;
  _arsAttachListeners._done = true;
  // Click en fila de tabla -> prompt what-if
  quotesBody?.addEventListener("click", (event) => {
    if (currentMarketCategory !== "ars") return;
    const row = event.target.closest("tr[data-ars-ticker]");
    if (!row) return;
    promptArsWhatIf(row.getAttribute("data-ars-ticker"));
  });
  // Toggles del chart
  ["arsCurveYAxis", "arsCurveXAxis", "arsCurveModel"].forEach((id) => {
    document.getElementById(id)?.addEventListener("change", renderArsCurve);
  });
  document.querySelectorAll("[data-ars-field]").forEach((el) => {
    el.addEventListener("change", renderArsCurve);
  });
  document.getElementById("arsCurveClearWhatIf")?.addEventListener("click", () => {
    Object.keys(_arsWhatIfs).forEach((k) => delete _arsWhatIfs[k]);
    renderArsCurve();
  });
}

async function promptArsWhatIf(ticker) {
  const existing = _arsWhatIfs[ticker];
  const baseInfo = (_latestArsItems || []).find((x) => x.ticker === ticker);
  const currentPrice = baseInfo?.last;
  const currentTna = baseInfo?.tna_365;
  const promptStr = [
    `What-if para ${ticker}`,
    currentPrice != null ? `Precio actual: ${currentPrice.toFixed(2)}` : "Sin precio actual",
    currentTna != null ? `TNA actual: ${(currentTna * 100).toFixed(2)}%` : "",
    "",
    "Ingresa precio (ej: 1450.5) o TNA% (ej: tna 35.5)",
    "Para borrar el what-if, ingresa 'x'",
  ].filter(Boolean).join("\n");
  const initial = existing
    ? (existing.type === "price" ? String(existing.value) : `tna ${existing.value}`)
    : "";
  const ans = window.prompt(promptStr, initial);
  if (ans == null) return;
  const trimmed = ans.trim().toLowerCase();
  if (!trimmed) return;
  if (trimmed === "x") {
    delete _arsWhatIfs[ticker];
    renderArsCurve();
    return;
  }
  let url = `/api/market/ars/whatif?ticker=${encodeURIComponent(ticker)}`;
  let stored;
  if (trimmed.startsWith("tna")) {
    const val = parseFloat(trimmed.replace("tna", "").replace(",", ".").trim());
    if (!isFinite(val)) { alert("TNA invalida"); return; }
    url += `&tna=${val}`;
    stored = { type: "tna", value: val };
  } else {
    const val = parseFloat(trimmed.replace(",", "."));
    if (!isFinite(val)) { alert("Precio invalido"); return; }
    url += `&price=${val}`;
    stored = { type: "price", value: val };
  }
  try {
    const r = await fetch(url, { credentials: "same-origin" });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      alert("Error: " + (d.detail || "no se pudo calcular"));
      return;
    }
    const j = await r.json();
    _arsWhatIfs[ticker] = { ...stored, computed: j };
    renderArsCurve();
  } catch (e) {
    console.error("[ars] whatif error", e);
    alert("Error de red");
  }
}

let _arsCurveChart = null;
const ARS_FIELD_DEFS = {
  bid:   { label: "Bid",   stroke: "#1f7a3e", fill: "rgba(31,122,62,0.10)" },
  last:  { label: "Last",  stroke: "#1f3d2e", fill: "rgba(31,61,46,0.10)" },
  offer: { label: "Offer", stroke: "#c9a961", fill: "rgba(201,169,97,0.15)" },
};

function renderArsCurve() {
  _arsAttachListeners();
  const canvas = document.getElementById("arsCurveCanvas");
  if (!canvas || typeof Chart === "undefined") return;
  const items = _latestArsItems || [];

  const yKey = document.getElementById("arsCurveYAxis")?.value || "tna_365";
  const xKey = document.getElementById("arsCurveXAxis")?.value || "days";
  const modelName = document.getElementById("arsCurveModel")?.value || "linear";
  const fields = Array.from(document.querySelectorAll("[data-ars-field]"))
    .filter((el) => el.checked)
    .map((el) => el.dataset.arsField);
  if (!fields.length) fields.push("last");

  // Helper para obtener (x, y) de un item dado un field
  const xy = (it, field) => {
    const m = field === "bid" ? it.metrics_bid : field === "offer" ? it.metrics_offer : it.metrics_last;
    if (!m) return null;
    const y = m[yKey];
    if (y == null) return null;
    let x;
    if (xKey === "days") x = it.days_to_maturity;
    else if (xKey === "duration") x = m.duration;
    else if (xKey === "md") x = m.modified_duration;
    if (x == null || !isFinite(x)) return null;
    return { x, y, ticker: it.ticker, mat: it.maturity_date };
  };

  const datasets = [];
  for (const field of fields) {
    const def = ARS_FIELD_DEFS[field] || ARS_FIELD_DEFS.last;
    const points = items.map((it) => xy(it, field)).filter(Boolean).sort((a, b) => a.x - b.x);
    if (!points.length) continue;
    // Linea conectora observada
    datasets.push({
      type: "line", label: `${def.label} obs`,
      data: points.map((p) => ({ x: p.x, y: p.y })),
      borderColor: def.stroke, backgroundColor: def.fill,
      borderWidth: 1.5, pointRadius: 0, tension: 0.2, order: 3, spanGaps: true,
    });
    // Scatter de los puntos con tooltip
    datasets.push({
      type: "scatter", label: `${def.label}`,
      data: points.map((p) => ({ x: p.x, y: p.y, _meta: p })),
      backgroundColor: def.stroke, borderColor: def.stroke,
      pointRadius: 5, pointHoverRadius: 7, order: 2,
    });
    // Modelo teorico (reusa FuturesCurve.fitModel)
    if (modelName !== "none" && points.length >= 2 && window.FuturesCurve?.fitModel) {
      try {
        const model = window.FuturesCurve.fitModel(points.map((p) => ({ x: p.x, y: p.y })), modelName);
        if (model && model.predict) {
          const minX = points[0].x, maxX = points[points.length - 1].x;
          const N = 80;
          const theoLine = [];
          for (let i = 0; i <= N; i++) {
            const x = minX + (maxX - minX) * (i / N);
            const y = model.predict(x);
            if (y != null && isFinite(y)) theoLine.push({ x, y });
          }
          datasets.push({
            type: "line", label: `${def.label} ${modelName}`,
            data: theoLine, borderColor: def.stroke, borderDash: [5, 4],
            borderWidth: 1, pointRadius: 0, order: 4, spanGaps: true,
          });
        }
      } catch (e) { console.warn("[ars] fitModel fallo", e); }
    }
  }

  // What-ifs: scatter destacado (todos los what-ifs en un solo dataset)
  const whatIfPoints = [];
  for (const t of Object.keys(_arsWhatIfs)) {
    const w = _arsWhatIfs[t]?.computed;
    if (!w) continue;
    let x;
    if (xKey === "days") x = w.days_to_maturity;
    else if (xKey === "duration") x = w.duration;
    else if (xKey === "md") x = w.modified_duration;
    const y = w[yKey];
    if (x == null || y == null || !isFinite(x) || !isFinite(y)) continue;
    whatIfPoints.push({ x, y, _meta: { ticker: t, mat: w.maturity_date, whatif: true, price: w.price } });
  }
  if (whatIfPoints.length) {
    datasets.push({
      type: "scatter", label: "What-ifs",
      data: whatIfPoints,
      backgroundColor: "#c0392b", borderColor: "#7d1f15",
      pointRadius: 7, pointHoverRadius: 9, pointStyle: "rectRot", order: 1,
    });
  }

  const yLabel = yKey === "tir" ? "TIR efectiva" : yKey === "tem" ? "TEM" : "TNA (365)";
  const xLabel = xKey === "days" ? "Dias al vto" : xKey === "duration" ? "Duration (anios)" : "Modified Duration (anios)";

  const cfg = {
    type: "scatter",
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "nearest", intersect: false },
      scales: {
        x: { type: "linear", title: { display: true, text: xLabel } },
        y: { title: { display: true, text: yLabel },
             ticks: { callback: (v) => (v * 100).toFixed(1) + "%" } },
      },
      plugins: {
        legend: { display: true, position: "top" },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const m = ctx.raw?._meta || {};
              const yV = (ctx.parsed.y * 100).toFixed(2) + "%";
              const xV = ctx.parsed.x.toFixed(0);
              const tag = m.whatif ? " [WHAT-IF]" : "";
              return `${m.ticker || ""}${tag}: ${yV} @ ${xV}`;
            },
          },
        },
      },
    },
  };
  // Animation off: chart.update("none") evita el flicker que se ve cuando
  // los datasets se reasignan (Chart.js por default anima cada update).
  if (_arsCurveChart) {
    _arsCurveChart.data = cfg.data;
    _arsCurveChart.options = cfg.options;
    _arsCurveChart.update("none");
  } else {
    cfg.options.animation = false;
    _arsCurveChart = new Chart(canvas.getContext("2d"), cfg);
  }
}

// Hash de los datos relevantes para curva: ticker + last + bid + offer + maturity.
// Si no cambia, no re-construir el chart (evita parpadeos en cada WS tick).
function _arsItemsHash(items) {
  return (items || [])
    .map((it) => `${it.ticker}|${it.last}|${it.bid}|${it.offer}|${it.maturity_date}|${it.tir}`)
    .join(";") + "|" + Object.keys(_arsWhatIfs).map((k) => `${k}:${_arsWhatIfs[k]?.value}`).join(",");
}

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
    // Re-render DLK para que TNA refleje T+0/T+1
    if (currentMarketCategory === "futuros_dlk") renderFuturosDlk();
  });
});

document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.view));
});

// Lee query params del rediseño v2 (?legacy_view=...&legacy_tab=...&legacy_calc=...)
// para que los redirects desde el nav nuevo abran la tab correcta.
(function _applyLegacyQueryParams() {
  try {
    const p = new URLSearchParams(window.location.search);
    const view = p.get("legacy_view");
    const tab = p.get("legacy_tab");
    const calc = p.get("legacy_calc");
    if (view) setView(view);
    if (tab && typeof setMarketCategory === "function") {
      try { setMarketCategory(tab); } catch (_) {}
    }
    if (calc && typeof setBondModel === "function") {
      try { setBondModel(calc); } catch (_) {}
    }
  } catch (_) {}
})();

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
document.querySelector("#lcModeSwitch")?.querySelectorAll("[data-lc-mode]").forEach((button) => {
  button.addEventListener("click", () => setLecapMode(button.dataset.lcMode));
});
savedLecaps?.addEventListener("click", (event) => {
  const delBtn = event.target.closest("[data-lecap-delete]");
  if (delBtn) {
    event.stopPropagation();
    deleteLecap(delBtn.dataset.lecapDelete).catch((err) => {
      console.error("[lecap] delete error", err);
      setCalculatorStatus("error", "Error al eliminar");
    });
    return;
  }
  const row = event.target.closest("[data-lecap-row]");
  if (row) toggleLecapDetailRow(row);
});

// Inserta/quita una fila debajo con el cashflow del item
function toggleLecapDetailRow(row) {
  const idx = +row.dataset.lecapRow;
  const next = row.nextElementSibling;
  if (next && next.classList.contains("saved-detail-row")) {
    next.remove();
    return;
  }
  const item = (window.__savedLecapsCache || [])[idx];
  if (!item) return;
  const cashflow = item.calculation?.cashflows?.[0];
  if (!cashflow) return;
  const fmt3 = { minimumFractionDigits: 3, maximumFractionDigits: 3 };
  const tr = document.createElement("tr");
  tr.className = "saved-detail-row";
  tr.innerHTML = `
    <td colspan="6" class="saved-detail-cell">
      <table class="table table-sm align-middle mb-0 saved-detail-inline">
        <thead><tr>
          <th>#</th><th>Fecha pago</th><th>Fecha efectiva</th>
          <th class="text-end">Dias</th><th class="text-end">Amort VN</th>
          <th class="text-end">Tasa</th><th class="text-end">Interes</th><th class="text-end">Total</th>
        </tr></thead>
        <tbody><tr>
          <td>${cashflow.number}</td>
          <td>${formatDate(cashflow.payment_date)}</td>
          <td>${formatDate(cashflow.effective_payment_date)}</td>
          <td class="text-end">${cashflow.applicable_days}</td>
          <td class="text-end">${formatNumber(cashflow.amortization_vn, fmt3)}</td>
          <td class="text-end">${formatPercent(cashflow.applicable_rate, 3)}</td>
          <td class="text-end">${formatNumber(cashflow.interest, fmt3)}</td>
          <td class="text-end">${formatNumber(cashflow.total, fmt3)}</td>
        </tr></tbody>
      </table>
    </td>
  `;
  row.after(tr);
}
document.querySelector("#lecapAddTickerBtn")?.addEventListener("click", () => addLecapTicker());
document.querySelector("#lecapNewTicker")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); addLecapTicker(); }
});
hdSearchSubmit?.addEventListener("click", () => {
  fetchHdSavedList().catch(() => setHdSaveStatus("error", "No se pudo buscar"));
});
hdSearchTicker?.addEventListener("input", () => {
  // Filtra desde cache local sin re-fetch
  if (_hdSavedCache) renderHdSavedList(_hdSavedCache);
  else fetchHdSavedList().catch(() => {});
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

// Inicio de pagos (diferimiento del primer pago, caso GD35)
hdDeferredApply?.addEventListener("click", applyHdDeferredStart);
hdDeferredReset?.addEventListener("click", resetHdDeferredStart);

// Descargar cashflow como CSV
hdDownloadCashflow?.addEventListener("click", downloadHdCashflowCsv);

// ====== Bono TAMAR: cargar valores TAMAR de referencia ======
function setTamarStatus(kind, text) {
  if (!tamarStatus) return;
  tamarStatus.dataset.kind = kind;
  tamarStatus.textContent = text;
}

function formatTamarValue(value) {
  if (value === null || value === undefined) return "s/d";
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(value) + " %";
}

async function fetchTamarReference() {
  const issueIso = parseDdmmYyyy(tamarIssueDate?.value || "");
  const maturityIso = parseDdmmYyyy(tamarMaturityDate?.value || "");
  if (!issueIso || !maturityIso) {
    setTamarStatus("error", "Cargar emision y vencimiento como DD/MM/AAAA");
    return;
  }
  setTamarStatus("draft", "Consultando BCRA...");
  try {
    const url = `/api/calculators/bond-tamar/tamar-reference?issue_date=${issueIso}&maturity_date=${maturityIso}`;
    const response = await fetch(url);
    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      throw new Error(typeof detail.detail === "string" ? detail.detail : "No se pudo consultar BCRA");
    }
    const payload = await response.json();
    const emi = payload.tamar_emission || {};
    const proj = payload.tamar_maturity_projection || {};

    if (tamarEmissionValue) tamarEmissionValue.value = formatTamarValue(emi.value);
    if (tamarEmissionRefDate) {
      tamarEmissionRefDate.value = emi.value_date
        ? `${formatDateDisplay(emi.value_date)} (target ${formatDateDisplay(emi.reference_date_target)})`
        : `Sin dato (target ${formatDateDisplay(emi.reference_date_target)})`;
    }
    if (tamarProjectionValue) tamarProjectionValue.value = formatTamarValue(proj.average);
    if (tamarProjectionCutoff) {
      tamarProjectionCutoff.value = `${formatDateDisplay(proj.publication_cutoff)} (hoy ${formatDateDisplay(proj.today)})`;
    }
    if (tamarProjectionSamples) {
      const samples = proj.samples || [];
      tamarProjectionSamples.innerHTML = samples.map((s, i) => `
        <label>
          <span>Muestra ${i + 1}</span>
          <input class="form-control form-control-sm" type="text" value="${formatDateDisplay(s.date)} - ${formatTamarValue(s.value)}" readonly>
        </label>
      `).join("");
    }
    tamarReferenceSection?.classList.remove("d-none");
    setTamarStatus("ok", "TAMAR de referencia cargado");
  } catch (error) {
    setTamarStatus("error", error.message || "Error al consultar BCRA");
    console.error("[Bono TAMAR]", error);
  }
}

tamarFetchReference?.addEventListener("click", () => {
  fetchTamarReference().catch((err) => console.error(err));
});

function formatTamarPercent(value, dec = 4) {
  if (value === null || value === undefined) return "s/d";
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  }).format(value) + " %";
}

function formatTamarMoney(value) {
  if (value === null || value === undefined) return "s/d";
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(value);
}

async function calculateTamar() {
  const issueIso = parseDdmmYyyy(tamarIssueDate?.value || "");
  const maturityIso = parseDdmmYyyy(tamarMaturityDate?.value || "");
  const faceValue = parseFloat(tamarFaceValue?.value || "100");
  const temExtra = parseFloat(tamarTemExtra?.value || "0") || 0;
  if (!issueIso || !maturityIso) {
    setTamarStatus("error", "Cargar emision y vencimiento como DD/MM/AAAA");
    return;
  }
  if (!Number.isFinite(faceValue) || faceValue <= 0) {
    setTamarStatus("error", "VNO invalido");
    return;
  }
  setTamarStatus("draft", "Calculando promedio TAMAR + TEM + VPV...");
  try {
    const params = new URLSearchParams({
      issue_date: issueIso,
      maturity_date: maturityIso,
      face_value: String(faceValue),
      tem_extra_percent: String(temExtra),
    });
    // as_of_date: si esta seteado, recalcula como si hoy fuera esa fecha
    // (para ver VPV historico o forward).
    const asOfIso = (tamarAsOfDate && tamarAsOfDate.value) ? tamarAsOfDate.value : null;
    if (asOfIso) params.set("as_of_date", asOfIso);
    const response = await fetch(`/api/calculators/bond-tamar/calculate?${params.toString()}`);
    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      throw new Error(typeof detail.detail === "string" ? detail.detail : "No se pudo calcular");
    }
    const payload = await response.json();

    // Cards de TAMAR de referencia (emision + proyeccion). Ahora son <span>
    const emi = payload.tamar_emission || {};
    const proj = payload.tamar_maturity_projection || {};
    if (tamarEmissionValue) tamarEmissionValue.textContent = formatTamarPercent(emi.value);
    if (tamarEmissionRefDate) {
      tamarEmissionRefDate.textContent = emi.value_date
        ? `Ref ${formatDateDisplay(emi.value_date)}`
        : "Sin dato";
    }
    if (tamarProjectionValue) tamarProjectionValue.textContent = formatTamarPercent(proj.average);
    if (tamarProjectionCutoff) {
      tamarProjectionCutoff.textContent = `Cutoff ${formatDateDisplay(proj.publication_cutoff)}`;
    }
    if (tamarProjectionSamples) {
      const samples = proj.samples || [];
      tamarProjectionSamples.innerHTML = samples.map((s, i) => `
        <label>
          <span>Muestra ${i + 1}</span>
          <input class="form-control form-control-sm" type="text" value="${formatDateDisplay(s.date)} - ${formatTamarPercent(s.value)}" readonly>
        </label>
      `).join("");
    }
    tamarReferenceSection?.classList.remove("d-none");

    // Cards principales del calculo (textContent porque ahora son <span>)
    if (tamarCalcAverage) tamarCalcAverage.textContent = formatTamarPercent(payload.tamar_average_percent);
    if (tamarCalcWithSpread) {
      const spread = (payload.tamar_for_tem_percent ?? 0) - (payload.tamar_average_percent ?? 0);
      tamarCalcWithSpread.textContent = Math.abs(spread) > 1e-6
        ? `+${formatTamarPercent(spread)} spread`
        : "TAMAR pura (sin spread)";
    }
    if (tamarCalcTem) tamarCalcTem.textContent = formatTamarPercent(payload.tamar_tem_percent);
    if (tamarCalcVpv) tamarCalcVpv.textContent = formatTamarMoney(payload.vpv);
    if (tamarCalcDays) tamarCalcDays.textContent = `${payload.vpv_days} dias 30/360 / ${payload.vpv_days_calendar} cal.`;

    // Auxiliares
    if (tamarCalcWindow) tamarCalcWindow.value = `${formatDateDisplay(payload.window_start)} -> ${formatDateDisplay(payload.window_end)}`;
    if (tamarCalcBreakdown) {
      const br = payload.tamar_average_breakdown || {};
      const carry = br.carry_forward_days || 0;
      const carryNote = carry > 0 ? ` + ${carry} carry-forward` : "";
      tamarCalcBreakdown.value = `${br.business_days_total} dias (${br.actual_days} reales${carryNote} / ${br.projected_days} proyectados @ ${formatTamarPercent(br.projected_value_used)})`;
    }
    const tamarDailyDetailBody = document.querySelector("#tamarDailyDetailBody");
    if (tamarDailyDetailBody) {
      const rows = payload.daily_detail || [];
      if (!rows.length) {
        tamarDailyDetailBody.innerHTML = '<tr><td colspan="5" class="empty-state">Sin detalle</td></tr>';
      } else {
        tamarDailyDetailBody.innerHTML = rows.map((r, i) => `
          <tr class="${r.source === 'projection' ? 'hd-grace-row' : ''}">
            <td>${i + 1}</td>
            <td>${formatDateDisplay(r.date)}</td>
            <td class="text-end">${new Intl.NumberFormat("es-AR", { minimumFractionDigits: 4, maximumFractionDigits: 4 }).format(r.value)}</td>
            <td>${r.source}</td>
            <td>${r.from_date && r.from_date !== r.date ? formatDateDisplay(r.from_date) : ""}</td>
          </tr>
        `).join("");
      }
    }

    // Cashflow table principal
    const tamarCashflowBody = document.querySelector("#tamarCashflowBody");
    if (tamarCashflowBody && Array.isArray(payload.cashflow)) {
      tamarCashflowBody.innerHTML = payload.cashflow.map((row) => {
        if (row.is_emission) {
          return `<tr class="tamar-emission-row">
            <td>—</td>
            <td>—</td>
            <td>${formatDateDisplay(row.payment_date_effective)}</td>
            <td class="text-end">—</td>
            <td class="text-end">—</td>
            <td class="text-end">100,00%</td>
            <td class="text-end">—</td>
            <td class="text-end">—</td>
            <td class="text-end">${formatTamarMoney(row.vpv_per_100)}</td>
          </tr>`;
        }
        const fmtPct = (v, d = 2) => v == null ? '-' : `${new Intl.NumberFormat("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d }).format(v)}%`;
        return `<tr>
          <td>${row.number}</td>
          <td>${formatDateDisplay(row.payment_date_theoretical)}</td>
          <td>${formatDateDisplay(row.payment_date_effective)}</td>
          <td class="text-end">${row.days != null ? row.days : '-'}</td>
          <td class="text-end">${fmtPct(row.amort_vn_percent)}</td>
          <td class="text-end">${fmtPct(row.residual_vn_percent)}</td>
          <td class="text-end">${fmtPct(row.tasa_aplicable_tem_percent, 4)}</td>
          <td class="text-end">${row.interes_aplicable_per_100 != null ? formatTamarMoney(row.interes_aplicable_per_100) : '-'}</td>
          <td class="text-end"><strong>${formatTamarMoney(row.vpv_per_100)}</strong></td>
        </tr>`;
      }).join("");
    }

    if (tamarFixedRateBanner && payload.fixed_rate_warning) {
      const w = payload.fixed_rate_warning;
      tamarFixedRateBanner.innerHTML = `<strong>Tasa fija desde ${formatDateDisplay(w.from_date)}:</strong> a partir de esa fecha (vto - 10 dias habiles) el VPV queda fijo y no varia con TAMAR proyectada.`;
      tamarFixedRateBanner.style.display = "block";
    }

    tamarCalcSection?.classList.remove("d-none");
    // Guardar payload completo en memoria para el "Confirmar y guardar"
    lastTamarPayload = payload;
    if (tamarSaveButton) tamarSaveButton.disabled = false;
    setTamarStatus("ok", "Calculo completado");
  } catch (error) {
    setTamarStatus("error", error.message || "Error al calcular");
    console.error("[Bono TAMAR calc]", error);
  }
}

tamarCalculate?.addEventListener("click", () => {
  calculateTamar().catch((err) => console.error(err));
});

// Recalcula automaticamente cuando cambia la fecha de valuacion.
// Solo dispara si ya hubo un calculo previo (para no fallar antes de tener
// emision/vencimiento cargados). Si el usuario abre por primera vez la
// calculadora, el VPV se calcula al apretar "Calcular VPV" como antes.
tamarAsOfDate?.addEventListener("change", () => {
  if (!tamarIssueDate?.value || !tamarMaturityDate?.value) return;
  setTamarStatus("draft", "Recalculando VPV a la fecha…");
  calculateTamar().catch((err) => {
    console.error(err);
    setTamarStatus("error", "Error al recalcular");
  });
});

// ====== Persistencia TAMAR ======
const tamarSaveButton = document.querySelector("#tamarSave");
const tamarSavedList = document.querySelector("#tamarSavedList");
const tamarSavedCount = document.querySelector("#tamarSavedCount");
let lastTamarPayload = null;

async function fetchTamarSavedList() {
  if (!tamarSavedList) return;
  try {
    const response = await fetch("/api/calculators/bond-tamar/saved");
    if (!response.ok) throw new Error("list");
    const payload = await response.json();
    const items = payload.items || [];
    if (tamarSavedCount) tamarSavedCount.textContent = items.length;
    if (!items.length) {
      tamarSavedList.innerHTML = '<span class="empty-cell">Sin TAMAR guardados todavia.</span>';
      return;
    }
    tamarSavedList.innerHTML = items.map((it) => `
      <div class="hd-saved-item" style="display:flex; justify-content:space-between; align-items:center; padding:0.5rem 0.75rem; border:1px solid var(--line); border-radius:0.5rem; margin-bottom:0.4rem;">
        <div>
          <strong>${it.ticker}</strong>
          <span class="hd-derived" style="margin-left:0.5rem;">${formatDateDisplay(it.issue_date)} → ${formatDateDisplay(it.maturity_date)}</span>
          <span class="hd-derived" style="margin-left:0.5rem;">VNO ${it.face_value}</span>
          ${it.tem_extra_percent ? `<span class="hd-derived" style="margin-left:0.5rem;">spread ${formatTamarPercent(it.tem_extra_percent)}</span>` : ""}
        </div>
        <div>
          <button type="button" class="btn btn-sm btn-outline-dark" data-tamar-load="${it.ticker}">Cargar</button>
          <button type="button" class="btn btn-sm btn-outline-danger" data-tamar-delete="${it.ticker}">Eliminar</button>
        </div>
      </div>
    `).join("");
  } catch (err) {
    console.error("[TAMAR list] error", err);
  }
}

function loadSavedTamarIntoForm(item) {
  if (!item) return;
  if (tamarTicker) tamarTicker.value = item.ticker;
  if (tamarIssueDate) tamarIssueDate.value = formatDateDisplay(item.issue_date);
  if (tamarMaturityDate) tamarMaturityDate.value = formatDateDisplay(item.maturity_date);
  if (tamarFaceValue) tamarFaceValue.value = String(item.face_value);
  if (tamarTemExtra) tamarTemExtra.value = String(item.tem_extra_percent || 0);
  setTamarStatus("ok", `Cargado ${item.ticker}. Click "Calcular VPV" para refrescar con la TAMAR de hoy.`);
}

async function loadTamarSaved(ticker) {
  if (!ticker) return;
  try {
    const response = await fetch(`/api/calculators/bond-tamar/saved/${encodeURIComponent(ticker)}`);
    if (!response.ok) throw new Error("not found");
    const payload = await response.json();
    loadSavedTamarIntoForm(payload.item);
  } catch (err) {
    setTamarStatus("error", "No se pudo cargar el TAMAR guardado");
    console.error(err);
  }
}

async function deleteTamarSaved(ticker) {
  if (!ticker) return;
  if (!window.confirm(`Eliminar TAMAR guardado: ${ticker}?`)) return;
  try {
    const response = await fetch(`/api/calculators/bond-tamar/saved/${encodeURIComponent(ticker)}`, { method: "DELETE" });
    if (!response.ok) throw new Error("delete");
    setTamarStatus("ok", `${ticker} eliminado`);
    fetchTamarSavedList().catch(() => {});
  } catch (err) {
    setTamarStatus("error", "No se pudo eliminar");
    console.error(err);
  }
}

async function saveTamar() {
  if (!lastTamarPayload) {
    setTamarStatus("error", "Calcular VPV primero antes de guardar");
    return;
  }
  const issueIso = parseDdmmYyyy(tamarIssueDate?.value || "");
  const maturityIso = parseDdmmYyyy(tamarMaturityDate?.value || "");
  const ticker = (tamarTicker?.value || "").trim();
  if (!ticker) {
    setTamarStatus("error", "Ticker es obligatorio para guardar");
    return;
  }
  if (!issueIso || !maturityIso) {
    setTamarStatus("error", "Cargar emision y vencimiento en DD/MM/AAAA");
    return;
  }
  setTamarStatus("draft", "Guardando...");
  try {
    const response = await fetch("/api/calculators/bond-tamar/saved", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ticker,
        issue_date: issueIso,
        maturity_date: maturityIso,
        face_value: parseFloat(tamarFaceValue?.value || "100"),
        tem_extra_percent: parseFloat(tamarTemExtra?.value || "0") || 0,
        payload: lastTamarPayload,
      }),
    });
    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      throw new Error(typeof detail.detail === "string" ? detail.detail : "No se pudo guardar");
    }
    setTamarStatus("ok", `${ticker} guardado`);
    fetchTamarSavedList().catch(() => {});
  } catch (err) {
    setTamarStatus("error", err.message || "Error al guardar");
  }
}

tamarSaveButton?.addEventListener("click", () => saveTamar().catch((e) => console.error(e)));
tamarSavedList?.addEventListener("click", (event) => {
  const loadTicker = event.target.closest("[data-tamar-load]")?.dataset?.tamarLoad;
  if (loadTicker) { loadTamarSaved(loadTicker); return; }
  const deleteTicker = event.target.closest("[data-tamar-delete]")?.dataset?.tamarDelete;
  if (deleteTicker) deleteTamarSaved(deleteTicker);
});

// ====== Modal de metricas por ticker (Mercado) ======
const bondMetricsModal = document.querySelector("#bondMetricsModal");
const bondMetricsTicker = document.querySelector("#bondMetricsTicker");
const bondMetricsPrice = document.querySelector("#bondMetricsPrice");
const bondMetricsTirInput = document.querySelector("#bondMetricsTirInput");
const bondMetricsSettlement = document.querySelector("#bondMetricsSettlement");
const bondMetricsAsOfDate = document.querySelector("#bondMetricsAsOfDate");
const bondMetricsRecalc = document.querySelector("#bondMetricsRecalc");
const bondMetricsStatus = document.querySelector("#bondMetricsStatus");
const bondMetricsPriceOut = document.querySelector("#bondMetricsPriceOut");
const bondMetricsTir = document.querySelector("#bondMetricsTir");
const bondMetricsTna = document.querySelector("#bondMetricsTna");
const bondMetricsTem = document.querySelector("#bondMetricsTem");
const bondMetricsDuration = document.querySelector("#bondMetricsDuration");
const bondMetricsMd = document.querySelector("#bondMetricsMd");
const bondMetricsConvexity = document.querySelector("#bondMetricsConvexity");
const bondMetricsNote = document.querySelector("#bondMetricsNote");

let currentMetricsTicker = null;

function setBmStatus(kind, text) {
  if (!bondMetricsStatus) return;
  bondMetricsStatus.dataset.kind = kind;
  bondMetricsStatus.textContent = text;
}

function clearBmOutputs() {
  for (const el of [bondMetricsPriceOut, bondMetricsTir, bondMetricsTna, bondMetricsTem,
                     bondMetricsDuration, bondMetricsMd, bondMetricsConvexity]) {
    if (el) el.value = "";
  }
}

function todayIsoLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function openBondMetricsModal(ticker, defaultPrice) {
  if (!bondMetricsModal) return;
  currentMetricsTicker = ticker;
  if (bondMetricsTicker) bondMetricsTicker.textContent = ticker;
  if (bondMetricsPrice) bondMetricsPrice.value = defaultPrice != null ? String(defaultPrice) : "";
  if (bondMetricsTirInput) bondMetricsTirInput.value = "";
  if (bondMetricsSettlement) bondMetricsSettlement.value = "1";
  if (bondMetricsAsOfDate) bondMetricsAsOfDate.value = todayIsoLocal();
  clearBmOutputs();
  if (bondMetricsNote) bondMetricsNote.textContent = "";
  setBmStatus("draft", "-");
  bondMetricsModal.style.display = "block";
  bondMetricsModal.setAttribute("aria-hidden", "false");
  // Si tenemos precio default, calcular automatico
  if (defaultPrice != null && Number.isFinite(Number(defaultPrice))) {
    fetchBondMetrics().catch((err) => console.error(err));
  } else {
    setBmStatus("draft", "Cargar precio o TIR");
  }
  // Foco en el primer input para arrancar a editar de una
  setTimeout(() => bondMetricsPrice?.focus(), 50);
}

function closeBondMetricsModal() {
  if (!bondMetricsModal) return;
  bondMetricsModal.style.display = "none";
  bondMetricsModal.setAttribute("aria-hidden", "true");
  currentMetricsTicker = null;
}

async function fetchBondMetrics() {
  if (!currentMetricsTicker) return;
  const priceVal = parseFloat(bondMetricsPrice?.value || "");
  const tirVal = parseFloat(bondMetricsTirInput?.value || "");
  const hasPrice = Number.isFinite(priceVal) && priceVal > 0;
  const hasTir = Number.isFinite(tirVal);
  if (!hasPrice && !hasTir) {
    setBmStatus("error", "Cargar precio o TIR");
    return;
  }
  setBmStatus("draft", "Calculando...");
  // Settlement: default 1 si esta vacio (no 0)
  let settlementVal = bondMetricsSettlement?.value;
  if (settlementVal === "" || settlementVal == null) settlementVal = "1";
  const settlementDays = parseInt(settlementVal, 10);
  const params = new URLSearchParams({
    settlement_days: String(Number.isFinite(settlementDays) && settlementDays >= 0 ? settlementDays : 1),
  });
  if (hasPrice) {
    params.set("price", String(priceVal));
  } else {
    params.set("tir_target_percent", String(tirVal));
  }
  if (bondMetricsAsOfDate?.value) params.set("as_of_date", bondMetricsAsOfDate.value);
  try {
    const url = `/api/bonds/${encodeURIComponent(currentMetricsTicker)}/metrics?${params.toString()}`;
    console.log("[bondMetrics] GET", url);
    const response = await fetch(url);
    if (!response.ok) {
      const errPayload = await response.json().catch(() => ({}));
      let msg = `Error ${response.status}`;
      if (typeof errPayload.detail === "string") {
        msg = errPayload.detail;
      } else if (Array.isArray(errPayload.detail) && errPayload.detail.length) {
        msg = errPayload.detail.map((d) => {
          const loc = Array.isArray(d.loc) ? d.loc.slice(-1).join(".") : "";
          return `${loc}: ${d.msg || d.type || "invalido"}`;
        }).join(" / ");
      }
      console.error("[bondMetrics] error", response.status, errPayload);
      throw new Error(msg);
    }
    const payload = await response.json();
    const fmt = (v, dec = 4) => v == null ? "-" : new Intl.NumberFormat("es-AR", {
      minimumFractionDigits: dec, maximumFractionDigits: dec,
    }).format(v);
    if (!payload.available) {
      setBmStatus("error", "No converge");
      const fx = payload.fx_conversion || {};
      let extra = "";
      if (fx.applied) extra = ` FX ${fx.fx_label} ${fmt(fx.fx_rate)}.`;
      else if (fx.note) extra = ` ${fx.note}`;
      bondMetricsNote.textContent = (payload.note || "No disponible") + extra;
      clearBmOutputs();
      return;
    }
    if (bondMetricsPriceOut) bondMetricsPriceOut.value = fmt(payload.computed_price_display, 4);
    if (bondMetricsTir) bondMetricsTir.value = fmt(payload.tir_annual_percent, 4) + " %";
    if (bondMetricsTna) bondMetricsTna.value = fmt(payload.tna_365_percent, 4) + " %";
    if (bondMetricsTem) bondMetricsTem.value = fmt(payload.tem_percent, 4) + " %";
    if (bondMetricsDuration) bondMetricsDuration.value = fmt(payload.duration_years, 4);
    if (bondMetricsMd) bondMetricsMd.value = fmt(payload.modified_duration, 4);
    if (bondMetricsConvexity) bondMetricsConvexity.value = fmt(payload.convexity, 4);
    // Si vino del modo TIR -> precio, completar el input de precio para verlo arriba
    if (payload.mode === "tir_to_price" && bondMetricsPrice && !bondMetricsPrice.value) {
      bondMetricsPrice.value = fmt(payload.computed_price_display, 4).replace(/\./g, "").replace(",", ".");
    }
    const fx = payload.fx_conversion || {};
    let parts = [];
    parts.push(`Liq: ${formatDateDisplay(payload.settlement_date)} (T+${payload.settlement_days})`);
    parts.push(`${payload.future_cashflow_count} flujos`);
    if (fx.applied) parts.push(`<strong>${fx.fx_label}</strong> ${fmt(fx.fx_rate)} (USD ${fmt(payload.computed_price_usd)})`);
    if (payload.saved_via && payload.saved_via !== "exact") parts.push(`<em>cashflow: ${payload.saved_via}</em>`);
    bondMetricsNote.innerHTML = parts.join(" &middot; ");
    setBmStatus("ok", payload.mode === "tir_to_price" ? "Precio calculado" : "TIR calculada");
  } catch (error) {
    setBmStatus("error", error.message || "Error");
    bondMetricsNote.textContent = "";
  }
}

bondMetricsRecalc?.addEventListener("click", () => fetchBondMetrics().catch((e) => console.error(e)));
// Enter en cualquier input dispara el calculo
for (const el of [bondMetricsPrice, bondMetricsTirInput, bondMetricsSettlement, bondMetricsAsOfDate]) {
  el?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      fetchBondMetrics().catch((e) => console.error(e));
    }
  });
}
// Si el usuario edita uno de los dos inputs principales, limpiar el otro asi
// queda explicito cual se va a usar
bondMetricsPrice?.addEventListener("input", () => {
  if (bondMetricsPrice.value && bondMetricsTirInput) bondMetricsTirInput.value = "";
});
bondMetricsTirInput?.addEventListener("input", () => {
  if (bondMetricsTirInput.value && bondMetricsPrice) bondMetricsPrice.value = "";
});

bondMetricsModal?.addEventListener("click", (event) => {
  if (event.target.matches("[data-modal-close]")) closeBondMetricsModal();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && bondMetricsModal?.style.display === "block") closeBondMetricsModal();
});

// Click en cualquier ticker de la tabla principal de Mercado abre el modal.
quotesBody?.addEventListener("click", (event) => {
  const td = event.target.closest("td.ticker");
  if (!td) return;
  const tr = td.closest("tr[data-key]");
  if (!tr) return;
  const ticker = tr.dataset.key;
  const quote = latestQuotes.find((q) => q.symbol === ticker);
  const defaultPrice = quote?.last ?? quote?.bid ?? null;
  openBondMetricsModal(ticker, defaultPrice);
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

// Selector de fecha "as of" para TNA de futuros: default hoy local
(function initFutAsOfDate() {
  const el = document.querySelector("#futAsOfDate");
  if (!el) return;
  if (!el.value) {
    const d = new Date();
    el.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  el.addEventListener("change", () => {
    pollFutures().catch(() => {});
  });
})();

// (Listeners de la curva ahora viven dentro de frontend/futures_curve.js)

// Pollers de FX, Futuros y Spot: independientes del WebSocket para no parpadear.
pollFxRatios();
pollFutures();
pollSpot();
window.setInterval(pollFxRatios, 3000);
window.setInterval(pollFutures, 5000);
window.setInterval(pollSpot, 2000);  // SPOT mas frecuente: dato critico

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

// ============================================================
// Calculadora Tasa Fija (ARS) - replica HD + toggle TEM
// ============================================================
let _frInitDone = false;
let _frCoupons = [];           // [{date_iso, annual_rate, amort_pct}, ...]
let _frLatestCalc = null;
let _frLatestPayload = null;   // request body que generó _frLatestCalc

const $$ = (sel) => document.querySelector(sel);

function initFrTemplate() {
  const issueEl = $$("#frIssueDate");
  const matEl = $$("#frMaturityDate");
  if (issueEl) attachDdmmAutoformat(issueEl);
  if (matEl) attachDdmmAutoformat(matEl);
  if (_frInitDone) {
    applyFrLecapMode();
    return;
  }
  _frInitDone = true;

  // Mode switch (search/new)
  $$("#frModeSwitch")?.querySelectorAll("[data-fr-mode]").forEach((b) => {
    b.addEventListener("click", () => setFrMode(b.dataset.frMode));
  });

  // Toggle Lecap-mode
  $$("#frLecapMode")?.addEventListener("change", applyFrLecapMode);

  // Agregar ticker custom (admin)
  $$("#frAddTickerBtn")?.addEventListener("click", () => addFrTicker());
  $$("#frNewTicker")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); addFrTicker(); }
  });

  // Modulos opcionales
  $$("#frImportDates")?.addEventListener("click", () => {
    importFrDates().catch((err) => {
      console.error("[fr] import dates", err);
      setCalculatorStatus("error", "Error importando fechas");
    });
  });
  $$("#frDeferredApply")?.addEventListener("click", applyFrDeferred);
  $$("#frDeferredReset")?.addEventListener("click", resetFrDeferred);
  $$("#frGraceMode")?.addEventListener("change", refreshFrGraceWraps);
  $$("#frGraceApply")?.addEventListener("click", () => applyFrGrace(false));

  const frPutDateEl = $$("#frPutDate");
  if (frPutDateEl) attachDdmmAutoformat(frPutDateEl);
  $$("#frPutApply")?.addEventListener("click", applyFrPut);
  $$("#frPutRemove")?.addEventListener("click", removeFrPut);

  // Generar fechas (HD-mode)
  $$("#frGenerateSchedule")?.addEventListener("click", () => {
    generateFrSchedule().catch((err) => {
      console.error("[fr] schedule", err);
      setCalculatorStatus("error", "Error al generar fechas");
    });
  });

  // Cupon anual % aplica a toda la tabla
  $$("#frCouponRate")?.addEventListener("input", () => {
    const rate = parseNumberArg($$("#frCouponRate").value);
    if (!isFinite(rate)) return;
    _frCoupons.forEach((c) => { c.annual_rate = rate; });
    renderFrCouponsTable();
  });

  // Form submit = calcular
  $$("#frHdForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    calculateFr().catch((err) => {
      console.error("[fr] calculate", err);
      setCalculatorStatus("error", "Error al calcular");
    });
  });

  // Save
  $$("#frSave")?.addEventListener("click", () => {
    saveFr().catch((err) => {
      console.error("[fr] save", err);
      setCalculatorStatus("error", "Error al guardar");
    });
  });

  // Saved list click delegation (toggle expand / delete)
  $$("#frSavedList")?.addEventListener("click", (event) => {
    const delBtn = event.target.closest("[data-fr-delete]");
    if (delBtn) {
      event.stopPropagation();
      deleteFr(delBtn.dataset.frDelete).catch((err) => {
        console.error("[fr] delete", err);
        setCalculatorStatus("error", "Error al eliminar");
      });
      return;
    }
    const row = event.target.closest("[data-fr-row]");
    if (row) toggleFrDetailRow(row);
  });

  applyFrLecapMode();
}

function applyFrLecapMode() {
  const isLecap = $$("#frLecapMode")?.checked || false;
  document.querySelectorAll("[data-fr-hd]").forEach((el) => el.classList.toggle("d-none", isLecap));
  document.querySelectorAll("[data-fr-tem]").forEach((el) => el.classList.toggle("d-none", !isLecap));
}

async function fetchFrTickers() {
  const sel = $$("#frTicker");
  if (!sel) return;
  try {
    const r = await fetch("/api/calculators/bond-fixed-rate/tickers", { credentials: "same-origin" });
    if (!r.ok) return;
    const j = await r.json();
    const previous = sel.value;
    sel.innerHTML = (j.tickers || [])
      .map((t) => `<option value="${t}">${t}</option>`)
      .join("");
    if (previous && (j.tickers || []).includes(previous)) sel.value = previous;
  } catch (e) {
    console.error("[fr] tickers fetch", e);
  }
}

async function addFrTicker() {
  const inputEl = $$("#frNewTicker");
  if (!inputEl) return;
  const ticker = (inputEl.value || "").toUpperCase().trim();
  if (!ticker) return;
  try {
    const r = await fetch("/api/calculators/bond-fixed-rate/tickers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ ticker }),
    });
    if (!r.ok) {
      const detail = r.status === 403 ? "Solo admin puede agregar" : "Ticker invalido";
      setCalculatorStatus("error", detail);
      return;
    }
    inputEl.value = "";
    await fetchFrTickers();
    if ($$("#frTicker")) $$("#frTicker").value = ticker;
    setCalculatorStatus("ok", `${ticker} agregado`);
  } catch (e) {
    console.error("[fr] add ticker", e);
    setCalculatorStatus("error", "Error de red");
  }
}

function setFrMode(mode) {
  const search = $$("#frSearchPanel");
  const create = $$("#frNewPanel");
  if (!search || !create) return;
  const isSearch = mode === "search";
  search.classList.toggle("d-none", !isSearch);
  create.classList.toggle("d-none", isSearch);
  $$("#frModeSwitch")?.querySelectorAll("[data-fr-mode]").forEach((b) => {
    const active = b.dataset.frMode === mode;
    b.classList.toggle("active", active);
    b.classList.toggle("btn-dark", active);
    b.classList.toggle("btn-outline-dark", !active);
  });
  if (isSearch) {
    fetchFrSavedList().catch(() => {});
  } else {
    resetFrForm();
    fetchFrTickers().catch(() => {});
    const addWrap = $$("#frAddTickerWrap");
    const isAdmin = window.__currentUser?.role === "admin";
    if (addWrap) addWrap.classList.toggle("d-none", !isAdmin);
  }
}

function resetFrForm() {
  $$("#frTicker").value = "";
  $$("#frIssueDate").value = "";
  $$("#frMaturityDate").value = "";
  $$("#frFaceValue").value = "100";
  $$("#frTemEmission").value = "";
  $$("#frCouponRate").value = "0";
  $$("#frLecapMode").checked = false;
  applyFrLecapMode();
  _frCoupons = [];
  _frCouponsOriginal = [];
  _frCouponsBeforePut = [];
  _frLatestCalc = null;
  _frLatestPayload = null;
  const putDateEl = $$("#frPutDate");
  if (putDateEl) putDateEl.value = "";
  const putStat = $$("#frPutStatus");
  if (putStat) putStat.textContent = "-";
  $$("#frSave").disabled = true;
  renderFrCouponsTable();
  $$("#frCashflowBody").innerHTML = '<tr><td colspan="9" class="empty-state">Completa los datos y calcula</td></tr>';
  $$("#frCashflowHead").innerHTML = "";
  setCalculatorStatus("draft", "Borrador");
}

async function generateFrSchedule() {
  const issueIso = parseDdmmYyyy($$("#frIssueDate").value);
  const matIso = parseDdmmYyyy($$("#frMaturityDate").value);
  const freq = $$("#frFrequency").value;
  if (!issueIso || !matIso) {
    setCalculatorStatus("error", "Fechas invalidas");
    return;
  }
  const r = await fetch("/api/calculators/bond-hd/schedule", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ issue_date: issueIso, maturity_date: matIso, frequency: freq }),
  });
  if (!r.ok) {
    setCalculatorStatus("error", "No se pudo generar fechas");
    return;
  }
  const j = await r.json();
  const bondType = $$("#frBondType").value;
  const couponRate = parseNumberArg($$("#frCouponRate").value) || 0;
  const dates = j.payment_dates || [];
  // Distribucion de amortizacion: amortizable -> uniforme; bullet/zero -> 100% al ultimo
  _frCoupons = dates.map((d, idx) => {
    let amort = 0;
    if (bondType === "amortizable") {
      amort = 100 / dates.length;
    } else if (idx === dates.length - 1) {
      amort = 100;
    }
    return {
      date_iso: d,
      annual_rate: bondType === "zero_coupon" ? 0 : couponRate,
      amort_pct: amort,
      in_grace: false,
    };
  });
  snapshotFrCouponsOriginal();
  renderFrCouponsTable();
  refreshFrAuxSelectors();
  setCalculatorStatus("ok", `${dates.length} cupones generados`);
}

function renderFrCouponsTable() {
  const body = $$("#frCouponsBody");
  if (!body) return;
  if (!_frCoupons.length) {
    body.innerHTML = '<tr><td colspan="4" class="empty-state">Generar fechas o calcular</td></tr>';
    return;
  }
  body.innerHTML = _frCoupons.map((c, idx) => `
    <tr>
      <td>${idx + 1}</td>
      <td><input class="fr-coupon-input" style="width:110px;text-align:center;" data-fr-coupon-date="${idx}" value="${formatDate(c.date_iso)}" placeholder="DD/MM/AAAA"></td>
      <td class="text-end"><input class="fr-coupon-input" data-fr-coupon-rate="${idx}" value="${c.annual_rate}"></td>
      <td class="text-end"><input class="fr-coupon-input" data-fr-coupon-amort="${idx}" value="${c.amort_pct}"></td>
    </tr>
  `).join("");
  body.querySelectorAll("[data-fr-coupon-date]").forEach((el) => {
    attachDdmmAutoformat(el);
    el.addEventListener("change", () => {
      const i = +el.dataset.frCouponDate;
      const iso = parseDdmmYyyy(el.value);
      if (iso) {
        _frCoupons[i].date_iso = iso;
        refreshFrAuxSelectors();
      } else {
        // Si la fecha es invalida, restauro el valor anterior
        el.value = formatDate(_frCoupons[i].date_iso);
        setCalculatorStatus("error", "Fecha invalida (DD/MM/AAAA)");
      }
    });
  });
  body.querySelectorAll("[data-fr-coupon-rate]").forEach((el) => {
    el.addEventListener("input", () => {
      const i = +el.dataset.frCouponRate;
      _frCoupons[i].annual_rate = parseNumberArg(el.value) || 0;
    });
  });
  body.querySelectorAll("[data-fr-coupon-amort]").forEach((el) => {
    el.addEventListener("input", () => {
      const i = +el.dataset.frCouponAmort;
      _frCoupons[i].amort_pct = parseNumberArg(el.value) || 0;
    });
  });
}

// Snapshot del listado original tras generar/importar fechas, para poder
// restaurar despues de aplicar deferred. Espejo del patron HD.
let _frCouponsOriginal = [];
// Snapshot tomado JUSTO antes de aplicar el put (preserva edits del usuario:
// rates manuales, gracia aplicada, deferred, etc.). Vacio = no hay put activo.
let _frCouponsBeforePut = [];

function snapshotFrCouponsOriginal() {
  _frCouponsOriginal = _frCoupons.map((c) => ({ ...c }));
  // Resetear estado de put: cupones nuevos -> el put previo ya no aplica
  _frCouponsBeforePut = [];
  const stat = $$("#frPutStatus");
  if (stat) stat.textContent = "-";
}

function applyFrPut() {
  if (!_frCoupons.length) {
    setCalculatorStatus("error", "Generar o importar cupones primero");
    return;
  }
  const putIso = parseDdmmYyyy($$("#frPutDate")?.value);
  if (!putIso) {
    setCalculatorStatus("error", "Fecha del put invalida (DD/MM/AAAA)");
    return;
  }
  // Valida rango: el put debe caer entre el primer cupon y el vencimiento
  const first = _frCoupons[0]?.date_iso;
  const last = _frCoupons[_frCoupons.length - 1]?.date_iso;
  if (putIso < first || putIso > last) {
    setCalculatorStatus("error", "El put debe estar entre el primer cupon y el vencimiento");
    return;
  }
  // Snapshot solo si no habia put activo (asi puedo cambiar fecha de put
  // multiples veces sin perder los edits originales)
  if (!_frCouponsBeforePut.length) {
    _frCouponsBeforePut = _frCoupons.map((c) => ({ ...c }));
  }
  // Tomar como base el snapshot pre-put y truncar
  const base = _frCouponsBeforePut.map((c) => ({ ...c }));
  // Cupones cuya fecha <= putIso: se mantienen
  let truncated = base.filter((c) => c.date_iso <= putIso);
  if (!truncated.length) {
    // El put cae antes del primer cupon: el unico flujo es el put mismo
    const fallbackRate = parseNumberArg($$("#frCouponRate")?.value) || (base[0]?.annual_rate || 0);
    truncated = [{ date_iso: putIso, annual_rate: fallbackRate, amort_pct: 100, in_grace: false }];
  } else {
    // Todos los cupones intermedios pierden su amort (el 100% va al put final)
    truncated.forEach((c) => { c.amort_pct = 0; });
    const lastIso = truncated[truncated.length - 1].date_iso;
    if (lastIso === putIso) {
      // El put coincide con un cupon existente: ese cupon se queda como ultimo
      // y se le pone 100% amort
      truncated[truncated.length - 1].amort_pct = 100;
    } else {
      // El put cae entre dos cupones: agregar nuevo cupon en putIso con misma
      // tasa que el anterior y 100% amort
      const prev = truncated[truncated.length - 1];
      truncated.push({
        date_iso: putIso,
        annual_rate: prev.annual_rate || 0,
        amort_pct: 100,
        in_grace: false,
      });
    }
  }
  _frCoupons = truncated;
  renderFrCouponsTable();
  refreshFrAuxSelectors();
  const stat = $$("#frPutStatus");
  if (stat) stat.textContent = `Put activo el ${formatDate(putIso)} (${truncated.length} flujos)`;
  setCalculatorStatus("ok", "Put aplicado");
}

function removeFrPut() {
  if (!_frCouponsBeforePut.length) {
    setCalculatorStatus("error", "No hay put activo");
    return;
  }
  _frCoupons = _frCouponsBeforePut.map((c) => ({ ...c }));
  _frCouponsBeforePut = [];
  renderFrCouponsTable();
  refreshFrAuxSelectors();
  const stat = $$("#frPutStatus");
  if (stat) stat.textContent = "Sin put";
  setCalculatorStatus("ok", "Put removido");
}

function refreshFrAuxSelectors() {
  // Selector deferred: usa el ORIGINAL como referencia (asi siempre podes
  // volver a flujos anteriores sin regenerar)
  const refList = (_frCouponsOriginal && _frCouponsOriginal.length >= _frCoupons.length)
    ? _frCouponsOriginal : _frCoupons;
  const optsDeferred = refList.map((c, i) =>
    `<option value="${i}">Flujo ${i + 1} - ${formatDate(c.date_iso)}</option>`
  ).join("");
  const dEl = $$("#frDeferredPeriod");
  if (dEl) dEl.innerHTML = optsDeferred;

  // Selectores grace: solo los cupones actuales
  const gPeriodEl = $$("#frGracePeriod");
  if (gPeriodEl) {
    gPeriodEl.innerHTML = _frCoupons.map((c, i) =>
      `<option value="${i}">Flujo ${i + 1} - ${formatDate(c.date_iso)}</option>`
    ).join("");
  }
  const gYearEl = $$("#frGraceYear");
  if (gYearEl) {
    const years = [...new Set(_frCoupons.map((c) => c.date_iso.split("-")[0]))].sort();
    const cur = gYearEl.value;
    gYearEl.innerHTML = years.map((y) =>
      `<option value="${y}" ${y === cur ? "selected" : ""}>${y}</option>`
    ).join("");
  }
  // Refrescar visibilidad de wraps segun mode
  refreshFrGraceWraps();
}

function refreshFrGraceWraps() {
  const mode = $$("#frGraceMode")?.value || "none";
  $$("#frGracePeriodWrap")?.classList.toggle("d-none", mode !== "period");
  $$("#frGraceYearWrap")?.classList.toggle("d-none", mode !== "year" && mode !== "year_month");
  $$("#frGraceMonthWrap")?.classList.toggle("d-none", mode !== "year_month");
}

async function importFrDates() {
  const fileEl = $$("#frDatesFile");
  const textEl = $$("#frDatesText");
  const file = fileEl?.files?.[0];
  const pastedText = (textEl?.value || "").trim();
  const setStatus = (state, msg) => {
    const el = $$("#frImportStatus");
    if (el) el.textContent = msg;
    setCalculatorStatus(state, msg);
  };
  if (!file && !pastedText) {
    setStatus("error", "Subir archivo o pegar texto con fechas");
    return;
  }

  let combinedText = pastedText;
  let fileForBackend = null;

  if (file) {
    if (isImageFile(file)) {
      try {
        setStatus("draft", "Cargando OCR...");
        const ocrText = await runOcrOnImage(file);
        if (!ocrText && !combinedText) {
          setStatus("error", "OCR no detecto texto en la imagen");
          return;
        }
        combinedText = combinedText ? `${combinedText}\n\n${ocrText}` : ocrText;
      } catch (error) {
        setStatus("error", error.message || "OCR fallo");
        console.error("[fr] OCR", error);
        return;
      }
    } else {
      fileForBackend = file;
    }
  }

  setStatus("draft", "Parseando fechas...");
  const formData = new FormData();
  if (fileForBackend) formData.append("file", fileForBackend);
  if (combinedText) formData.append("text", combinedText);
  // Para que el parser pueda expandir patrones tipo "10/07 y 09/01 de cada anio"
  const issueIso = parseDdmmYyyy($$("#frIssueDate")?.value);
  const maturityIso = parseDdmmYyyy($$("#frMaturityDate")?.value);
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
      setStatus("error", "No se detectaron fechas");
      return;
    }
    const couponRate = parseNumberArg($$("#frCouponRate")?.value) || 0;
    const bondType = $$("#frBondType")?.value || "bullet";
    _frCoupons = dates.map((d, idx) => ({
      date_iso: d,
      annual_rate: bondType === "zero_coupon" ? 0 : couponRate,
      amort_pct: bondType === "amortizable" ? 100 / dates.length : (idx === dates.length - 1 ? 100 : 0),
      in_grace: false,
    }));
    snapshotFrCouponsOriginal();
    renderFrCouponsTable();
    refreshFrAuxSelectors();
    setStatus("ok", `Importadas ${dates.length} fechas`);
  } catch (error) {
    setStatus("error", error.message || "Error al parsear fechas");
  }
}

function applyFrDeferred() {
  if (!_frCouponsOriginal.length) {
    setCalculatorStatus("error", "Generar o importar cupones primero");
    return;
  }
  const idx = parseInt($$("#frDeferredPeriod")?.value, 10);
  if (!Number.isFinite(idx) || idx < 0 || idx >= _frCouponsOriginal.length) {
    setCalculatorStatus("error", "Seleccionar un flujo valido");
    return;
  }
  _frCoupons = _frCouponsOriginal.slice(idx).map((c) => ({ ...c, in_grace: false }));
  const stat = $$("#frDeferredStatus");
  if (stat) {
    stat.textContent = idx === 0
      ? "Sin diferimiento"
      : `Eliminados ${idx} flujos previos. Nuevo flujo 1 acumula desde la emision.`;
  }
  renderFrCouponsTable();
  refreshFrAuxSelectors();
  // Re-aplicar gracia con la nueva lista (por si habia)
  applyFrGrace(true);
}

function resetFrDeferred() {
  if (!_frCouponsOriginal.length) return;
  _frCoupons = _frCouponsOriginal.map((c) => ({ ...c, in_grace: false }));
  const dEl = $$("#frDeferredPeriod");
  if (dEl) dEl.value = "0";
  const stat = $$("#frDeferredStatus");
  if (stat) stat.textContent = "Restaurado a todos los flujos";
  renderFrCouponsTable();
  refreshFrAuxSelectors();
}

function findFrFirstPaymentIndex() {
  const mode = $$("#frGraceMode")?.value || "none";
  if (mode === "none" || !_frCoupons.length) return 0;
  if (mode === "period") {
    const idx = parseInt($$("#frGracePeriod")?.value, 10);
    if (!Number.isFinite(idx)) return 0;
    return Math.max(0, Math.min(idx, _frCoupons.length - 1));
  }
  if (mode === "year") {
    const targetYear = String($$("#frGraceYear")?.value || "");
    if (!targetYear) return 0;
    const found = _frCoupons.findIndex((c) => c.date_iso && c.date_iso.slice(0, 4) >= targetYear);
    return found === -1 ? _frCoupons.length : found;
  }
  if (mode === "year_month") {
    const targetYear = String($$("#frGraceYear")?.value || "");
    const targetMonth = parseInt($$("#frGraceMonth")?.value, 10);
    if (!targetYear || !Number.isFinite(targetMonth)) return 0;
    const targetKey = `${targetYear}-${String(targetMonth).padStart(2, "0")}`;
    const found = _frCoupons.findIndex((c) => c.date_iso && c.date_iso.slice(0, 7) >= targetKey);
    return found === -1 ? _frCoupons.length : found;
  }
  return 0;
}

function applyFrGrace(silent = false) {
  if (!_frCoupons.length) return;
  const firstIdx = findFrFirstPaymentIndex();
  const fallbackRate = parseNumberArg($$("#frCouponRate")?.value) || 0;
  _frCoupons = _frCoupons.map((coupon, index) => {
    const inGrace = index < firstIdx;
    return {
      ...coupon,
      in_grace: inGrace,
      annual_rate: inGrace ? 0 : (coupon.annual_rate || fallbackRate),
    };
  });
  const stat = $$("#frGraceStatus");
  if (stat) {
    stat.textContent = firstIdx === 0
      ? "Sin gracia (paga desde flujo 1)"
      : `${firstIdx} flujos en gracia, primer pago en flujo ${firstIdx + 1}`;
  }
  renderFrCouponsTable();
  if (!silent) setCalculatorStatus("ok", "Gracia aplicada");
}

async function calculateFr() {
  console.log("[fr] calculateFr llamada");
  const issueIso = parseDdmmYyyy($$("#frIssueDate").value);
  const matIso = parseDdmmYyyy($$("#frMaturityDate").value);
  const faceValue = parseInt($$("#frFaceValue").value, 10);
  const lecapMode = $$("#frLecapMode").checked;
  console.log("[fr] inputs:", { issueIso, matIso, faceValue, lecapMode, cupones: _frCoupons.length });
  if (!issueIso || !matIso) {
    alert("Fechas invalidas. Cargar emision y vencimiento en formato DD/MM/AAAA.");
    setCalculatorStatus("error", "Fechas invalidas (DD/MM/AAAA)");
    return;
  }
  if (!Number.isInteger(faceValue) || faceValue <= 0) {
    alert("VNO invalido. Debe ser un entero positivo (ej. 100).");
    setCalculatorStatus("error", "VNO invalido");
    return;
  }
  const body = {
    issue_date: issueIso,
    maturity_date: matIso,
    face_value: faceValue,
    lecap_mode: lecapMode,
  };
  if (lecapMode) {
    const tem = parseNumberArg($$("#frTemEmission").value);
    if (!isFinite(tem)) {
      alert("TEM invalida. Cargar la TEM de emision (ej. 2,5).");
      setCalculatorStatus("error", "TEM invalida");
      return;
    }
    body.tem_emission_percent = tem;
  } else {
    if (!_frCoupons.length) {
      alert("Falta generar los cupones. Click en 'Generar fechas' primero, o usar 'Importar fechas' del modulo opcional.");
      setCalculatorStatus("error", "Genera fechas y carga cupones primero");
      return;
    }
    body.bond_type = $$("#frBondType").value;
    body.frequency = $$("#frFrequency").value;
    body.convention = $$("#frConvention").value;
    body.coupons = _frCoupons.map((c) => ({
      payment_date: c.date_iso,
      annual_rate_percent: c.annual_rate || 0,
      amortization_percent: c.amort_pct || 0,
    }));
  }
  console.log("[fr] body a enviar:", body);
  setCalculatorStatus("draft", "Calculando");
  let r;
  try {
    r = await fetch("/api/calculators/bond-fixed-rate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error("[fr] fetch fallo:", err);
    alert("Error de red al llamar al backend. Ver consola.");
    setCalculatorStatus("error", "Error de red");
    return;
  }
  console.log("[fr] respuesta status:", r.status);
  if (!r.ok) {
    let detail = "Revisar datos";
    try { detail = (await r.json()).detail || detail; } catch {}
    console.error("[fr] error backend:", detail);
    alert("Backend rechazo el calculo: " + JSON.stringify(detail));
    setCalculatorStatus("error", String(detail).slice(0, 80));
    return;
  }
  _frLatestCalc = await r.json();
  _frLatestPayload = body;
  console.log("[fr] respuesta OK, cashflows:", _frLatestCalc?.cashflows?.length);
  renderFrCashflow(_frLatestCalc);
  $$("#frSave").disabled = false;
  setCalculatorStatus("ok", "Calculo OK");
}

function renderFrCashflow(payload) {
  const head = $$("#frCashflowHead");
  const body = $$("#frCashflowBody");
  if (!head || !body) return;
  const fmt3 = { minimumFractionDigits: 3, maximumFractionDigits: 3 };
  if (payload.mode === "tem") {
    head.innerHTML = `<tr>
      <th>#</th><th>Fecha pago</th><th>Fecha efectiva</th>
      <th class="text-end">Dias 360</th>
      <th class="text-end">Amort VN</th><th class="text-end">Tasa TEM</th>
      <th class="text-end">Interes</th><th class="text-end">Total</th>
    </tr>`;
    body.innerHTML = (payload.cashflows || []).map((c) => `
      <tr>
        <td>${c.number}</td>
        <td>${formatDate(c.payment_date)}</td>
        <td>${formatDate(c.effective_payment_date)}</td>
        <td class="text-end">${c.applicable_days}</td>
        <td class="text-end">${formatNumber(c.amortization_vn, fmt3)}</td>
        <td class="text-end">${formatPercent(c.applicable_rate, 3)}</td>
        <td class="text-end">${formatNumber(c.interest, fmt3)}</td>
        <td class="text-end">${formatNumber(c.total, fmt3)}</td>
      </tr>
    `).join("");
  } else {
    head.innerHTML = `<tr>
      <th>#</th><th>Fecha teorica</th><th>Fecha efectiva</th>
      <th class="text-end">Dias periodo</th>
      <th class="text-end">Tasa anual</th><th class="text-end">VR%</th>
      <th class="text-end">Amort/100</th><th class="text-end">Interes/100</th><th class="text-end">Total/100</th>
    </tr>`;
    body.innerHTML = (payload.cashflows || []).map((c) => `
      <tr>
        <td>${c.number}</td>
        <td>${formatDate(c.payment_date)}</td>
        <td>${formatDate(c.effective_payment_date)}</td>
        <td class="text-end">${c.period_days}</td>
        <td class="text-end">${formatPercent((c.annual_rate_percent || 0) / 100, 3)}</td>
        <td class="text-end">${formatNumber(c.residual_vn_percent, fmt3)}</td>
        <td class="text-end">${formatNumber(c.amortization_per_100, fmt3)}</td>
        <td class="text-end">${formatNumber(c.interest_per_100, fmt3)}</td>
        <td class="text-end">${formatNumber(c.total_per_100, fmt3)}</td>
      </tr>
    `).join("");
  }
}

async function saveFr() {
  if (!_frLatestCalc || !_frLatestPayload) {
    setCalculatorStatus("error", "Calcula primero");
    return;
  }
  const ticker = ($$("#frTicker").value || "").toUpperCase().trim();
  if (!ticker) {
    setCalculatorStatus("error", "Ticker vacio");
    return;
  }
  const body = {
    ticker,
    issue_date: _frLatestPayload.issue_date,
    maturity_date: _frLatestPayload.maturity_date,
    face_value: _frLatestPayload.face_value,
    lecap_mode: _frLatestPayload.lecap_mode,
    tem_emission_percent: _frLatestPayload.tem_emission_percent,
    bond_type: _frLatestPayload.bond_type,
    frequency: _frLatestPayload.frequency,
    convention: _frLatestPayload.convention,
    payload: _frLatestCalc,
  };
  const r = await fetch("/api/calculators/bond-fixed-rate/saved", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    setCalculatorStatus("error", "No se pudo guardar");
    return;
  }
  setCalculatorStatus("ok", `${ticker} guardada`);
}

async function fetchFrSavedList() {
  const list = $$("#frSavedList");
  if (!list) return;
  try {
    const r = await fetch("/api/calculators/bond-fixed-rate/saved", { credentials: "same-origin" });
    if (!r.ok) throw new Error("fetch fallo");
    const j = await r.json();
    const items = j.items || [];
    if (!items.length) {
      list.innerHTML = '<tr><td colspan="6" class="empty-state">No hay bonos Tasa Fija guardados</td></tr>';
      return;
    }
    const isAdmin = window.__currentUser?.role === "admin";
    const fmt3 = { minimumFractionDigits: 3, maximumFractionDigits: 3 };
    window.__frSavedCache = items;
    list.innerHTML = items.map((it, idx) => {
      const adminBtn = isAdmin
        ? `<button type="button" class="lc-delete-btn" data-fr-delete="${it.ticker}" title="Eliminar">✕</button>`
        : "";
      const tasa = it.lecap_mode
        ? `${formatNumber(it.tem_emission_percent || 0, fmt3)}% TEM`
        : `${it.bond_type || "-"} · ${it.frequency || "-"}`;
      return `<tr class="saved-row" data-fr-row="${idx}">
        <td class="ticker">${adminBtn}${it.ticker}</td>
        <td>${it.lecap_mode ? "TEM" : "HD"}</td>
        <td>${formatDate(it.issue_date)}</td>
        <td>${formatDate(it.maturity_date)}</td>
        <td class="text-end">${it.face_value}</td>
        <td class="text-end">${tasa}</td>
      </tr>`;
    }).join("");
  } catch (e) {
    list.innerHTML = '<tr><td colspan="6" class="empty-state">Error al cargar lista</td></tr>';
  }
}

function toggleFrDetailRow(row) {
  const idx = +row.dataset.frRow;
  const next = row.nextElementSibling;
  if (next && next.classList.contains("saved-detail-row")) {
    next.remove();
    return;
  }
  const it = (window.__frSavedCache || [])[idx];
  if (!it) return;
  const calc = it.payload || {};
  const fmt3 = { minimumFractionDigits: 3, maximumFractionDigits: 3 };
  let html;
  if (calc.mode === "tem") {
    const c = calc.cashflows?.[0] || {};
    html = `
      <thead><tr>
        <th>#</th><th>Fecha pago</th><th>Fecha efectiva</th>
        <th class="text-end">Dias</th><th class="text-end">Amort VN</th>
        <th class="text-end">TEM</th><th class="text-end">Interes</th><th class="text-end">Total</th>
      </tr></thead>
      <tbody><tr>
        <td>${c.number}</td>
        <td>${formatDate(c.payment_date)}</td>
        <td>${formatDate(c.effective_payment_date)}</td>
        <td class="text-end">${c.applicable_days}</td>
        <td class="text-end">${formatNumber(c.amortization_vn, fmt3)}</td>
        <td class="text-end">${formatPercent(c.applicable_rate, 3)}</td>
        <td class="text-end">${formatNumber(c.interest, fmt3)}</td>
        <td class="text-end">${formatNumber(c.total, fmt3)}</td>
      </tr></tbody>`;
  } else {
    html = `
      <thead><tr>
        <th>#</th><th>Fecha teorica</th><th>Fecha efectiva</th>
        <th class="text-end">Dias</th><th class="text-end">Tasa anual</th>
        <th class="text-end">VR%</th><th class="text-end">Amort/100</th>
        <th class="text-end">Interes/100</th><th class="text-end">Total/100</th>
      </tr></thead>
      <tbody>${(calc.cashflows || []).map((c) => `
        <tr>
          <td>${c.number}</td>
          <td>${formatDate(c.payment_date)}</td>
          <td>${formatDate(c.effective_payment_date)}</td>
          <td class="text-end">${c.period_days}</td>
          <td class="text-end">${formatPercent((c.annual_rate_percent || 0) / 100, 3)}</td>
          <td class="text-end">${formatNumber(c.residual_vn_percent, fmt3)}</td>
          <td class="text-end">${formatNumber(c.amortization_per_100, fmt3)}</td>
          <td class="text-end">${formatNumber(c.interest_per_100, fmt3)}</td>
          <td class="text-end">${formatNumber(c.total_per_100, fmt3)}</td>
        </tr>`).join("")}</tbody>`;
  }
  const tr = document.createElement("tr");
  tr.className = "saved-detail-row";
  tr.innerHTML = `<td colspan="6" class="saved-detail-cell"><table class="table table-sm align-middle mb-0 saved-detail-inline">${html}</table></td>`;
  row.after(tr);
}

async function deleteFr(ticker) {
  if (!confirm(`¿Eliminar el bono ${ticker}? No se puede deshacer.`)) return;
  const r = await fetch(`/api/calculators/bond-fixed-rate/saved/${ticker}`, {
    method: "DELETE",
    credentials: "same-origin",
  });
  if (!r.ok) {
    const detail = r.status === 403 ? "Solo admin puede eliminar" : "No se pudo eliminar";
    setCalculatorStatus("error", detail);
    return;
  }
  setCalculatorStatus("ok", `${ticker} eliminado`);
  await fetchFrSavedList();
}
