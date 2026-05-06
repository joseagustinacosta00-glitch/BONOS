(function () {
  "use strict";

  console.log("[login] v=hd79 loaded");

  const form = document.getElementById("loginForm");
  const userInput = document.getElementById("loginUsername");
  const passInput = document.getElementById("loginPassword");
  const submitBtn = document.getElementById("loginSubmit");
  const errorEl  = document.getElementById("loginError");

  if (!form || !userInput || !passInput || !submitBtn || !errorEl) {
    console.error("[login] missing required elements");
    return;
  }

  // Foco automático en usuario al cargar
  userInput.focus();

  function showError(message) {
    errorEl.textContent = message;
    errorEl.classList.add("is-visible");
  }

  function clearError() {
    errorEl.textContent = "";
    errorEl.classList.remove("is-visible");
  }

  // Limpiar error al tipear
  [userInput, passInput].forEach((el) => {
    el.addEventListener("input", clearError);
  });

  function getNextUrl() {
    const params = new URLSearchParams(window.location.search);
    const next = params.get("next");
    // Solo permitimos paths internos
    if (next && next.startsWith("/") && !next.startsWith("//")) {
      return next;
    }
    return "/";
  }

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    clearError();

    const username = userInput.value.trim();
    const password = passInput.value;

    if (!username || !password) {
      showError("Ingresá usuario y clave.");
      return;
    }

    submitBtn.disabled = true;
    const originalLabel = submitBtn.textContent;
    submitBtn.textContent = "Ingresando…";

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        credentials: "same-origin",
      });

      if (res.ok) {
        window.location.replace(getNextUrl());
        return;
      }

      // Error: intentar leer JSON con detail
      let detail = "Credenciales inválidas.";
      try {
        const data = await res.json();
        if (data && data.detail) detail = data.detail;
      } catch (_) {
        // sin body parseable
      }

      showError(detail);
    } catch (err) {
      console.error("[login] network error", err);
      showError("Error de conexión. Probá de nuevo.");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalLabel;
    }
  });
})();
