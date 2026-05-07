(function () {
  "use strict";

  console.log("[nav] v=hd81 loaded");

  // Map de subsecciones por menú principal
  const SUBSECTIONS = {
    mercado: {
      crumb: "Mercado",
      items: [
        { label: "General", route: "/mercado/general" },
        { label: "FX", route: "/mercado/fx" },
        { label: "Futuros y DLK", route: "/mercado/futuros-dlk" },
        { label: "Hard-Dollar", route: "/mercado/hard-dollar" },
        { label: "Tasa Fija", route: "/mercado/tasa-fija" },
        { label: "CER", route: "/mercado/cer" },
        { label: "TAMAR", route: "/mercado/tamar" },
        { label: "Duales", route: "/mercado/duales" },
      ],
    },
    tasas: {
      crumb: "Tasas",
      items: [
        { label: "Curva", route: "/tasas/curva" },
        { label: "Cauciones", route: "/tasas/cauciones" },
        { label: "BADLAR", route: "/tasas/badlar" },
      ],
    },
    bcra: {
      crumb: "Datos BCRA",
      items: [
        { label: "Reservas", route: "/bcra/reservas" },
        { label: "Base monetaria", route: "/bcra/base-monetaria" },
        { label: "Comunicados", route: "/bcra/comunicados" },
      ],
    },
  };

  function detectActiveMenu() {
    const path = window.location.pathname;
    if (path.startsWith("/mercado")) return "mercado";
    if (path.startsWith("/tasas")) return "tasas";
    if (path.startsWith("/bcra")) return "bcra";
    if (path.startsWith("/calc")) return "calc";
    if (path.startsWith("/historicos")) return "hist";
    if (path.startsWith("/ia")) return "ia";
    return null;
  }

  function init() {
    const navMain = document.getElementById("mtNavMain");
    const navSub  = document.getElementById("mtNavSub");
    if (!navMain) return;

    // Marcar menú principal activo
    const active = detectActiveMenu();
    if (active) {
      const activeEl = navMain.querySelector(`[data-menu="${active}"], [data-route^="/${active}"]`);
      if (activeEl) activeEl.classList.add("active");
    }

    // Marcar subitem activo en dropdowns
    document.querySelectorAll(".mt-nav-dd-item").forEach((el) => {
      const route = el.getAttribute("data-route");
      if (route && window.location.pathname.startsWith(route)) {
        el.classList.add("active");
      }
      el.addEventListener("click", () => {
        if (route) window.location.href = route;
      });
    });

    // Click en items simples
    document.querySelectorAll(".mt-nav-item--simple").forEach((el) => {
      el.addEventListener("click", () => {
        const route = el.getAttribute("data-route");
        if (route) window.location.href = route;
      });
    });

    // Renderizar subnav según la sección activa
    if (navSub && active && SUBSECTIONS[active]) {
      renderSubnav(navSub, SUBSECTIONS[active]);
    } else if (navSub) {
      navSub.classList.add("is-empty");
    }

    // Cargar usuario actual
    fetch("/api/auth/me", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const el = document.getElementById("mtNavUser");
        const u = data && data.user;
        if (el && u && u.username) el.textContent = u.username;
      })
      .catch(() => {});

    // Quick buttons → modales
    document.querySelectorAll(".mt-nav-quick-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const kind = btn.getAttribute("data-quick");
        openQuickModal(kind);
      });
    });

    // Cerrar modal
    const overlay = document.getElementById("mtModalOverlay");
    const closeBtn = document.getElementById("mtModalClose");
    if (overlay && closeBtn) {
      closeBtn.addEventListener("click", closeModal);
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) closeModal();
      });
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeModal();
      });
    }
  }

  function renderSubnav(container, config) {
    const path = window.location.pathname;
    const crumb = container.querySelector(".mt-nav-sub-crumb");
    if (crumb) crumb.textContent = config.crumb;

    // Limpiar items previos (mantener crumb)
    container.querySelectorAll(".mt-nav-sub-item").forEach((el) => el.remove());

    config.items.forEach((it) => {
      const a = document.createElement("a");
      a.className = "mt-nav-sub-item";
      a.textContent = it.label;
      a.setAttribute("data-route", it.route);
      if (path.startsWith(it.route)) a.classList.add("active");
      a.addEventListener("click", () => { window.location.href = it.route; });
      container.appendChild(a);
    });
  }

  // ---------- MODALES GLOBALES ----------

  function openModal(title, bodyHtml) {
    const overlay = document.getElementById("mtModalOverlay");
    const tEl = document.getElementById("mtModalTitle");
    const bEl = document.getElementById("mtModalBody");
    if (!overlay || !tEl || !bEl) return;
    tEl.textContent = title;
    bEl.innerHTML = bodyHtml;
    overlay.hidden = false;
  }

  function closeModal() {
    const overlay = document.getElementById("mtModalOverlay");
    if (overlay) overlay.hidden = true;
  }

  function openQuickModal(kind) {
    if (kind === "t01") {
      openModal("T+0 / T+1 — Calculadora rápida", `
        <label>Monto (USD)</label>
        <input type="number" id="qtAmount" placeholder="100.000" />

        <label>Tipo de cambio T+0</label>
        <input type="number" id="qtRate0" placeholder="1230.30" step="0.01" />

        <label>Tipo de cambio T+1</label>
        <input type="number" id="qtRate1" placeholder="1231.90" step="0.01" />

        <div class="mt-modal-result">
          <p>Equivalente en ARS — T+0<span class="value" id="qtOut0">—</span></p>
        </div>
        <div class="mt-modal-result" style="margin-top: 10px;">
          <p>Equivalente en ARS — T+1<span class="value" id="qtOut1">—</span></p>
        </div>
        <div class="mt-modal-result" style="margin-top: 10px;">
          <p>Diferencia T+1 vs T+0<span class="value" id="qtOutDiff">—</span></p>
        </div>
      `);
      // Calcular en vivo
      const calc = () => {
        const amt = parseFloat(document.getElementById("qtAmount").value) || 0;
        const r0  = parseFloat(document.getElementById("qtRate0").value) || 0;
        const r1  = parseFloat(document.getElementById("qtRate1").value) || 0;
        const fmt = (n) => n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        document.getElementById("qtOut0").textContent = "$ " + fmt(amt * r0);
        document.getElementById("qtOut1").textContent = "$ " + fmt(amt * r1);
        document.getElementById("qtOutDiff").textContent = "$ " + fmt(amt * (r1 - r0));
      };
      ["qtAmount", "qtRate0", "qtRate1"].forEach((id) => {
        document.getElementById(id).addEventListener("input", calc);
      });
      return;
    }

    if (kind === "charts") {
      openModal("Gráficos rápidos", `
        <p style="font-family: Georgia, serif; font-style: italic; color: #6B6452; font-size: 13px; line-height: 1.6;">
          Acceso directo a gráficos de cualquier instrumento del mercado.
        </p>
        <label style="margin-top: 16px;">Buscar instrumento</label>
        <input type="text" id="qcSearch" placeholder="Ej: GD30, MEP, AL30..." />
        <div class="mt-modal-result">
          <p>Sugerencias aparecen acá según lo que tipees.</p>
        </div>
      `);
      return;
    }

    if (kind === "tradingview") {
      openModal("TradingView", `
        <p style="font-family: Georgia, serif; font-style: italic; color: #6B6452; font-size: 13px; line-height: 1.6;">
          Abrir gráfico de TradingView en una nueva pestaña.
        </p>
        <label style="margin-top: 16px;">Símbolo</label>
        <input type="text" id="qtvSymbol" placeholder="Ej: BCBA:GGAL" />
        <button class="mt-nav-quick-btn" id="qtvOpen" style="margin-top: 10px; color: var(--mt-green); border-color: var(--mt-green);">
          Abrir
        </button>
      `);
      const openBtn = document.getElementById("qtvOpen");
      if (openBtn) {
        openBtn.addEventListener("click", () => {
          const sym = document.getElementById("qtvSymbol").value.trim();
          if (sym) window.open(`https://www.tradingview.com/chart/?symbol=${encodeURIComponent(sym)}`, "_blank");
        });
      }
      return;
    }
  }

  // Exponer para que otros módulos abran modales si quisieran
  window.MTNav = { openModal, closeModal };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
