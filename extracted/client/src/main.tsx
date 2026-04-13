import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { useAuth } from "./lib/auth";

// FIX #2: Restore JWT from sessionStorage on app init (survives page refresh)
useAuth.getState().initFromSession();

if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    if (event.reason?.message?.includes('401')) return;
    console.error('[Unhandled Promise]', event.reason);
  });
}

// Register Service Worker for PWA
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(() => {})
      .catch(() => {});
  });
}

createRoot(document.getElementById("root")!).render(<App />);
