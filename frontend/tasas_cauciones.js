(function () {
  "use strict";
  console.log("[cauciones] v=hd82 loaded");

  const fmtAR = (n, dec = 2) => Number(n).toLocaleString("es-AR", {
    minimumFractionDigits: dec, maximumFractionDigits: dec,
  });
  const fmtTime = (d) => d.toLocaleTimeString("es-AR", { hour12: false });
  const fmtDate = (d) => {
    const days = ["DOM","LUN","MAR","MIÉ","JUE","VIE","SÁB"];
    const months = ["ENE","FEB","MAR","ABR","MAY","JUN","JUL","AGO","SEP","OCT","NOV","DIC"];
    return `${days[d.getDay()]} · ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  };
  function formatIsoTime(iso) {
    if (!iso) return "—";
    try { return new Date(iso).toLocaleTimeString("es-AR", { hour12: false }); }
    catch { return iso; }
  }

  function tickClock() {
    const now = new Date();
    const dEl = document.getElementById("cauDate");
    const cEl = document.getElementById("cauClock");
    if (dEl) dEl.textContent = fmtDate(now);
    if (cEl) cEl.textContent = fmtTime(now);
  }
  setInterval(tickClock, 1000);
  tickClock();

  // Plazos "destacados" para la grilla resumen
  const SUMMARY_TERMS = [1, 7, 14, 30];

  function termLabel(days) {
    if (days == null) return "—";
    if (days === 1) return "1 día";
    return `${days} días`;
  }

  function renderShort(item) {
    const r = document.getElementById("cauShortRate");
    const m = document.getElementById("cauShortMeta");
    if (!r || !m) return;
    if (!item || item.last == null) {
      r.textContent = "—";
      m.textContent = "Sin tasa";
      return;
    }
    r.textContent = `${fmtAR(item.last, 2)}%`;
    m.textContent = `${termLabel(item.term_days)} · ${formatIsoTime(item.updated_at)}`;
  }

  function renderSummary(items) {
    const grid = document.getElementById("cauSummaryGrid");
    if (!grid) return;
    if (!items.length) { grid.innerHTML = '<span class="fx-muted-italic-sm">Sin datos</span>'; return; }
    const byTerm = new Map();
    for (const it of items) byTerm.set(Number(it.term_days), it);
    const cells = SUMMARY_TERMS.map(days => {
      const it = byTerm.get(days);
      const rate = it && it.last != null ? `${fmtAR(it.last, 2)}%` : "—";
      return `
        <div class="cau-summary-cell">
          <span class="cau-summary-cell-term">${termLabel(days)}</span>
          <span class="cau-summary-cell-rate">${rate}</span>
        </div>
      `;
    }).join("");
    grid.innerHTML = cells;
  }

  function renderTable(items) {
    const body = document.getElementById("cauTableBody");
    if (!body) return;
    if (!items.length) {
      body.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--mt-muted);font-style:italic;padding:14px;">Sin cotizaciones de cauciones</td></tr>';
      return;
    }
    body.innerHTML = items.map(it => {
      const last = it.last != null ? `${fmtAR(it.last, 2)}%` : "—";
      const bid  = it.bid  != null ? `${fmtAR(it.bid, 2)}%`  : "—";
      const ask  = it.ask  != null ? `${fmtAR(it.ask, 2)}%`  : "—";
      const ts   = formatIsoTime(it.updated_at);
      return `
        <tr>
          <td class="first">${termLabel(it.term_days)}</td>
          <td>${bid}</td>
          <td>${last}</td>
          <td>${ask}</td>
          <td class="last">${ts}</td>
        </tr>
      `;
    }).join("");
  }

  async function fetchCauciones() {
    try {
      const r = await fetch("/api/market/cauciones", { credentials: "same-origin" });
      if (!r.ok) throw new Error("http " + r.status);
      const j = await r.json();
      const items = (j.items || []).slice().sort((a, b) =>
        Number(a.term_days || 999) - Number(b.term_days || 999)
      );
      const shortest = items[0] || null;

      renderShort(shortest);
      renderSummary(items);
      renderTable(items);

      const cnt = document.getElementById("cauTermsCount");
      if (cnt) cnt.textContent = items.length;
      const upd = document.getElementById("cauUpdatedAt");
      if (upd) upd.textContent = j.updated_at ? formatIsoTime(j.updated_at) : "—";
      const meta = document.getElementById("cauTableMeta");
      if (meta) meta.textContent = `Fuente: ${j.source || "—"} · ${items.length} plazos`;
    } catch (err) {
      console.error("[cauciones] fetch error", err);
    }
  }

  fetchCauciones();
  setInterval(fetchCauciones, 5000);
})();
