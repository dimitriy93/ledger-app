"use client";

import { useEffect } from "react";

/**
 * Registers the service worker in production builds only, so the offline
 * shell works on GitHub Pages without interfering with dev reloads.
 */
export default function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
    const swUrl = `${basePath}/sw.js`;
    navigator.serviceWorker.register(swUrl).catch(() => {
      // Offline support is best-effort; ignore registration failures.
    });
  }, []);

  return null;
}
