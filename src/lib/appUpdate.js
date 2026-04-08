import { registerSW } from "virtual:pwa-register";

let updateServiceWorker = null;

export function initializeAppUpdate() {
  updateServiceWorker = registerSW({ immediate: true });
}

export async function refreshAppToLatest() {
  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set("refresh", String(Date.now()));

  if (!updateServiceWorker) {
    window.location.assign(nextUrl.toString());
    return;
  }

  try {
    await updateServiceWorker(true);
  } catch (error) {
    console.warn("Failed to activate service worker update, falling back to reload.", error);
  }

  window.location.assign(nextUrl.toString());
}
