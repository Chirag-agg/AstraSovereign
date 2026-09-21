"use client";

import { useEffect } from "react";

/**
 * In Chromium (Chrome/Edge), when a page enters Back-Forward Cache (bfcache),
 * the browser terminates active WebSockets with a console error:
 *   "WebSocket connection to 'ws://localhost:3000/_next/hmr...' failed: Page entered Back-Forward Cache."
 *
 * This development-only handler:
 * 1. Gracefully closes active HMR WebSockets on `pagehide` before bfcache freezes the page,
 *    preventing Chromium from aborting them and generating console errors.
 * 2. Registers a lightweight `unload` handler in development so browsers cleanly teardown
 *    and don't retain stale HMR module state when navigating.
 */
export function DevHmrBfcacheHandler() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;

    const hmrSockets = new Set<WebSocket>();
    const NativeWebSocket = window.WebSocket;

    if (NativeWebSocket) {
      const PatchedWebSocket = function (
        this: WebSocket,
        url: string | URL,
        protocols?: string | string[]
      ) {
        const ws = new NativeWebSocket(url, protocols);
        const urlStr = String(url);
        if (urlStr.includes("/_next/hmr") || urlStr.includes("/hmr")) {
          hmrSockets.add(ws);
          ws.addEventListener("close", () => hmrSockets.delete(ws));
        }
        return ws;
      };

      PatchedWebSocket.prototype = NativeWebSocket.prototype;
      PatchedWebSocket.CONNECTING = NativeWebSocket.CONNECTING;
      PatchedWebSocket.OPEN = NativeWebSocket.OPEN;
      PatchedWebSocket.CLOSING = NativeWebSocket.CLOSING;
      PatchedWebSocket.CLOSED = NativeWebSocket.CLOSED;

      window.WebSocket = PatchedWebSocket as unknown as typeof WebSocket;
    }

    const handlePageHide = () => {
      hmrSockets.forEach((ws) => {
        try {
          if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
            ws.close(1000, "pagehide");
          }
        } catch {
          // ignore
        }
      });
      hmrSockets.clear();
    };

    const handleUnload = () => {
      // Prevents Chromium from storing stale dev state in bfcache
    };

    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("unload", handleUnload);

    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("unload", handleUnload);
    };
  }, []);

  return null;
}

export default DevHmrBfcacheHandler;
