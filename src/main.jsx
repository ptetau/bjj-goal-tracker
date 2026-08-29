import React from "react";
import { createRoot } from "react-dom/client";
import App from "./ui/App.jsx";
import "./ui/theme.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Offline shell — production only, so dev never fights a stale cache.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js"));
}
