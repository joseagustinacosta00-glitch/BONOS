(function () {
  "use strict";

  const form = document.getElementById("loginForm");
  const userEl = document.getElementById("loginUsername");
  const passEl = document.getElementById("loginPassword");
  const submitBtn = document.getElementById("loginSubmit");
  const errorEl = document.getElementById("loginError");

  function getNextDest() {
    const params = new URLSearchParams(window.location.search);
    const next = params.get("next");
    if (!next || !next.startsWith("/") || next.startsWith("//")) return "/";
    return next;
  }

  function setError(msg) {
    errorEl.textContent = msg || "";
  }

  async function submitLogin(e) {
    e.preventDefault();
    setError("");
    const username = (userEl.value || "").trim();
    const password = passEl.value || "";
    if (!username || !password) {
      setError("Completá usuario y contraseña");
      return;
    }
    submitBtn.disabled = true;
    submitBtn.textContent = "Ingresando…";
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        credentials: "same-origin",
      });
      if (!r.ok) {
        let detail = "Usuario o contraseña inválidos";
        try {
          const j = await r.json();
          if (j && typeof j.detail === "string") detail = j.detail;
        } catch (_) {}
        setError(detail);
        passEl.value = "";
        passEl.focus();
        return;
      }
      // Login OK: redirigimos al destino
      window.location.href = getNextDest();
    } catch (err) {
      setError("Error de red. Reintentá.");
      console.error(err);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Ingresar";
    }
  }

  form.addEventListener("submit", submitLogin);
})();
