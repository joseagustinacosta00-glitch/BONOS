const symbolSelect = document.querySelector("#tvSymbolSelect");
const symbolInput = document.querySelector("#tvSymbolInput");
const loadButton = document.querySelector("#tvLoadButton");
const chartContainerId = "tradingviewChart";

let activeSymbol = symbolSelect.value;

symbolSelect.addEventListener("change", () => {
  activeSymbol = symbolSelect.value;
  symbolInput.value = "";
  renderTradingView(activeSymbol);
});

loadButton.addEventListener("click", () => {
  const customSymbol = symbolInput.value.trim().toUpperCase();
  activeSymbol = customSymbol || symbolSelect.value;
  renderTradingView(activeSymbol);
});

symbolInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    loadButton.click();
  }
});

function renderTradingView(symbol) {
  const container = document.querySelector(`#${chartContainerId}`);
  container.innerHTML = "";
  if (!window.TradingView) {
    container.textContent = "No se pudo cargar TradingView.";
    return;
  }
  new window.TradingView.widget({
    autosize: true,
    symbol,
    interval: "D",
    timezone: "America/Argentina/Buenos_Aires",
    theme: "dark",
    style: "1",
    locale: "es",
    toolbar_bg: "#0c121c",
    enable_publishing: false,
    allow_symbol_change: true,
    container_id: chartContainerId,
    hide_side_toolbar: false,
    withdateranges: true,
    studies: ["Volume@tv-basicstudies"],
  });
}

renderTradingView(activeSymbol);
