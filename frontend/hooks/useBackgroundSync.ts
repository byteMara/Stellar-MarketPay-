/**
 * hooks/useBackgroundSync.ts  (Issue #292)
 *
 * Provides a `queueRequest` helper that:
 *  1. Tries the request immediately.
 *  2. If offline (or the request fails), posts the payload to the service
 *     worker which stores it in IndexedDB.
 *  3. Registers a Background Sync tag so the SW replays the queue once
 *     connectivity is restored.
 *
 * Also listens for the SW's SYNC_COMPLETE message and calls an optional
 * `onSyncComplete` callback so the UI can refresh stale data.
 */
import { useEffect, useCallback, useRef } from "react";

interface QueuedRequest {
  url: string;
  method?: string;
  body?: string;
  headers?: Record<string, string>;
}

interface UseBackgroundSyncOptions {
  /** Called when the service worker reports that queued requests were replayed. */
  onSyncComplete?: () => void;
}

export function useBackgroundSync(options: UseBackgroundSyncOptions = {}) {
  const { onSyncComplete } = options;
  const queuedRequests = useRef(new Map<string, Promise<Response | null>>());

  // Listen for SYNC_COMPLETE messages from the service worker
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "SYNC_COMPLETE") {
        queuedRequests.current.clear();
        onSyncComplete?.();
      } else if (event.data?.type === "SYNC_FAILURE") {
        queuedRequests.current.clear();
      }
    };

    navigator.serviceWorker.addEventListener("message", handleMessage);
    return () => {
      navigator.serviceWorker.removeEventListener("message", handleMessage);
    };
  }, [onSyncComplete]);

  /**
   * Attempt a fetch; if it fails (offline), enqueue it in the SW for later
   * replay via Background Sync.
   *
   * Returns the Response on success, or null if the request was queued.
   */
  const queueRequest = useCallback(
    async (request: QueuedRequest): Promise<Response | null> => {
      const normalized = {
        ...request,
        method: request.method ?? "POST",
        headers: request.headers ?? { "Content-Type": "application/json" },
      };
      const signature = JSON.stringify({
        ...normalized,
        headers: Object.fromEntries(
          Object.entries(normalized.headers).sort(([left], [right]) =>
            left.localeCompare(right)
          )
        ),
      });
      const existing = queuedRequests.current.get(signature);
      if (existing) return existing;

      const pending = (async () => {
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          await enqueueInServiceWorker(request);
          return null;
        }

        try {
          return await fetch(request.url, {
            method: normalized.method,
            headers: normalized.headers,
            body: request.body,
          });
        } catch {
          // Network failure — hand off to the service worker
          await enqueueInServiceWorker(request);
          return null;
        }
      })();

      queuedRequests.current.set(signature, pending);
      try {
        const response = await pending;
        if (response !== null) queuedRequests.current.delete(signature);
        return response;
      } catch (error) {
        queuedRequests.current.delete(signature);
        throw error;
      }
    },
    []
  );

  return { queueRequest };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function enqueueInServiceWorker(request: QueuedRequest): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }

  const registration = await navigator.serviceWorker.ready;

  // Tell the SW to persist the request in IndexedDB
  registration.active?.postMessage({
    type: "ENQUEUE_REQUEST",
    payload: request,
  });

  // Register a Background Sync tag (supported in Chrome/Edge; gracefully
  // ignored in browsers that don't support the API)
  if ("sync" in registration) {
    try {
      await (registration as ServiceWorkerRegistration & {
        sync: { register: (tag: string) => Promise<void> };
      }).sync.register("stellar-form-sync");
    } catch {
      // Background Sync not supported — the SW will replay on next load
    }
  }
}
