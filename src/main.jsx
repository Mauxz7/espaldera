import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(<App />);

// Actualización automática: cuando se publica una versión nueva, el navegador instala el service worker
// nuevo y la página se recarga sola (de inmediato si acabas de abrirla o está en segundo plano).
if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
  const hadController = !!(navigator.serviceWorker && navigator.serviceWorker.controller);
  let pending = false;
  const reload = () => location.reload();
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController) return; // primera instalación: no hay nada que recargar
    if (document.hidden || performance.now() < 20000) reload();
    else { pending = true; window.dispatchEvent(new Event("espaldera-update")); }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && pending) reload();
    if (!document.hidden) navigator.serviceWorker.getRegistration().then((r) => r && r.update()).catch(() => {});
  });
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").then((reg) => {
      setInterval(() => reg.update().catch(() => {}), 30 * 60 * 1000);
    }).catch(() => {});
  });
}
