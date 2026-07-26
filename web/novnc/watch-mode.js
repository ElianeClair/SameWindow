(() => {
  const endpoint = "http://127.0.0.1:6081/browser/watch";
  const button = document.querySelector("#watch-toggle");
  const label = document.querySelector("#watch-label");
  if (!button || !label) return;

  let enabled = false;
  let busy = true;

  function render(state, text = "Browse together") {
    button.dataset.state = state;
    button.disabled = state === "busy";
    button.setAttribute("aria-pressed", enabled ? "true" : "false");
    label.textContent = text;
  }

  async function request(method = "GET", payload = null) {
    const response = await fetch(endpoint, {
      method,
      mode: "cors",
      cache: "no-store",
      headers: payload ? { "Content-Type": "application/json" } : undefined,
      body: payload ? JSON.stringify(payload) : undefined,
    });
    if (!response.ok) throw new Error(`watch request failed: ${response.status}`);
    return response.json();
  }

  async function refresh() {
    try {
      const result = await request();
      enabled = result?.watch?.enabled === true;
      render(enabled ? "on" : "off");
    } catch (_) {
      render("error", "Offline");
    } finally {
      busy = false;
    }
  }

  button.addEventListener("click", async () => {
    if (busy) return;
    busy = true;
    render("busy");
    try {
      const result = await request("POST", { enabled: !enabled });
      enabled = result?.watch?.enabled === true;
      render(enabled ? "on" : "off");
    } catch (_) {
      render("error", "Offline");
    } finally {
      busy = false;
    }
  });

  refresh();
  window.setInterval(refresh, 5000);
})();
