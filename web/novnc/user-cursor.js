(() => {
  const endpoint = "http://127.0.0.1:6081/user-cursor";
  const sendIntervalMs = 50;

  let attachedCanvas = null;
  let pendingState = null;
  let sendTimer = null;

  function clamp(value) {
    return Math.max(0, Math.min(1, value));
  }

  function queueState(event, inside) {
    const canvas = attachedCanvas;
    if (!canvas) return;
    const bounds = canvas.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return;

    pendingState = {
      x: clamp((event.clientX - bounds.left) / bounds.width),
      y: clamp((event.clientY - bounds.top) / bounds.height),
      inside,
      buttons: Number(event.buttons) || 0,
      pointerType: event.pointerType || "mouse",
      canvasWidth: Math.round(bounds.width),
      canvasHeight: Math.round(bounds.height),
      clientTs: Date.now(),
    };

    if (sendTimer !== null) return;
    sendTimer = window.setTimeout(flushState, sendIntervalMs);
  }

  async function flushState() {
    sendTimer = null;
    const state = pendingState;
    pendingState = null;
    if (!state) return;

    try {
      await fetch(endpoint, {
        method: "POST",
        mode: "cors",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state),
      });
    } catch (_) {
      // The viewer and VNC controls remain usable if telemetry is unavailable.
    }
  }

  function attachToCanvas() {
    const canvas = document.querySelector("#noVNC_canvas");
    if (!canvas || canvas === attachedCanvas) return;

    attachedCanvas = canvas;
    document.documentElement.dataset.samewindowUserCursor = "attached";
    canvas.addEventListener("pointermove", (event) => queueState(event, true), {
      passive: true,
    });
    canvas.addEventListener("pointerdown", (event) => queueState(event, true), {
      passive: true,
    });
    canvas.addEventListener("pointerup", (event) => queueState(event, true), {
      passive: true,
    });
    canvas.addEventListener("pointerenter", (event) => queueState(event, true), {
      passive: true,
    });
    canvas.addEventListener("pointerleave", (event) => queueState(event, false), {
      passive: true,
    });
  }

  window.addEventListener("load", attachToCanvas);
  window.setInterval(attachToCanvas, 750);
  attachToCanvas();
})();
