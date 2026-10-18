import { act, render, renderHook, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { useBackgroundSync } from "@/hooks/useBackgroundSync";
import OfflineBanner from "@/components/OfflineBanner";

type ServiceWorkerMessageListener = (event: MessageEvent) => void;
type QueuedEntry = {
  id: number;
  url: string;
  method?: string;
  body?: string;
  headers?: Record<string, string>;
  timestamp?: number;
};
type WorkerEvent = {
  data?: unknown;
  tag?: string;
  waitUntil: (promise: Promise<void>) => void;
};

const messageListeners = new Set<ServiceWorkerMessageListener>();
const postMessage = jest.fn();
const registerSync = jest.fn().mockResolvedValue(undefined);
const fetchMock = jest.fn();
const serviceWorker = {
  ready: Promise.resolve({
    active: { postMessage },
    sync: { register: registerSync },
  }),
  addEventListener: jest.fn(
    (_type: string, listener: ServiceWorkerMessageListener) => {
      messageListeners.add(listener);
    }
  ),
  removeEventListener: jest.fn(
    (_type: string, listener: ServiceWorkerMessageListener) => {
      messageListeners.delete(listener);
    }
  ),
};

function setOnline(online: boolean) {
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value: online,
  });
}

function emitServiceWorkerMessage(data: unknown) {
  const event = { data } as MessageEvent;
  messageListeners.forEach((listener) => listener(event));
}

function loadServiceWorker(initialEntries: QueuedEntry[] = []) {
  let entries = [...initialEntries];
  let nextId = entries.reduce((maximum, entry) => Math.max(maximum, entry.id), 0) + 1;
  const listeners = new Map<string, (event: WorkerEvent) => void>();
  const client = { postMessage: jest.fn() };
  const database = {
    transaction: jest.fn(() => {
      const transactionListeners = new Map<string, (() => void)[]>();
      const complete = () =>
        queueMicrotask(() =>
          transactionListeners.get("complete")?.forEach((listener) => listener())
        );
      const store = {
        getAll: () => {
          const request: {
            result?: QueuedEntry[];
            onsuccess?: (event: { target: typeof request }) => void;
          } = {};
          queueMicrotask(() => {
            request.result = [...entries];
            request.onsuccess?.({ target: request });
            complete();
          });
          return request;
        },
        add: (entry: Omit<QueuedEntry, "id">) => {
          entries.push({ ...entry, id: nextId++ });
          complete();
        },
        delete: (id: number) => {
          entries = entries.filter((entry) => entry.id !== id);
          complete();
        },
      };
      return {
        error: null,
        addEventListener: (type: string, listener: () => void) => {
          const registered = transactionListeners.get(type) ?? [];
          registered.push(listener);
          transactionListeners.set(type, registered);
        },
        objectStore: () => store,
      };
    }),
    close: jest.fn(),
  };
  const indexedDB = {
    open: jest.fn(() => {
      const request: {
        result?: typeof database;
        onsuccess?: (event: { target: typeof request }) => void;
        onupgradeneeded?: (event: { target: { result: typeof database } }) => void;
      } = {};
      queueMicrotask(() => {
        request.result = database;
        request.onsuccess?.({ target: request });
      });
      return request;
    }),
  };
  const worker = {
    __WB_MANIFEST: [],
    addEventListener: (type: string, listener: (event: WorkerEvent) => void) => {
      listeners.set(type, listener);
    },
    clients: { matchAll: jest.fn().mockResolvedValue([client]) },
    skipWaiting: jest.fn(),
  };
  const source = readFileSync(join(process.cwd(), "public", "sw.src.js"), "utf8");
  new Function("self", "caches", "fetch", "indexedDB", "queueMicrotask", source)(
    worker,
    {},
    fetchMock,
    indexedDB,
    queueMicrotask
  );

  return {
    entries: () => entries,
    client,
    sendMessage: async (data: unknown) => {
      let completion: Promise<void> | undefined;
      listeners.get("message")?.({
        data,
        waitUntil: (promise: Promise<void>) => {
          completion = promise;
        },
      });
      await completion;
    },
    sync: async () => {
      let completion: Promise<void> | undefined;
      listeners.get("sync")?.({
        tag: "stellar-form-sync",
        waitUntil: (promise: Promise<void>) => {
          completion = promise;
        },
      });
      await completion;
    },
  };
}

describe("useBackgroundSync", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    messageListeners.clear();
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: serviceWorker,
    });
    setOnline(true);
    global.fetch = fetchMock;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("queues a request without fetching while offline and registers background sync", async () => {
    setOnline(false);
    const request = {
      url: "/api/jobs",
      method: "POST",
      body: JSON.stringify({ title: "Offline job" }),
    };
    const { result } = renderHook(() => useBackgroundSync());

    await act(async () => {
      await expect(result.current.queueRequest(request)).resolves.toBeNull();
    });

    expect(global.fetch).not.toHaveBeenCalled();
    expect(postMessage).toHaveBeenCalledWith({
      type: "ENQUEUE_REQUEST",
      payload: request,
    });
    expect(registerSync).toHaveBeenCalledWith("stellar-form-sync");
  });

  it("deduplicates repeated submissions until the service worker reports sync completion", async () => {
    setOnline(false);
    const request = { url: "/api/jobs", body: '{"title":"same"}' };
    const { result } = renderHook(() => useBackgroundSync());

    await act(async () => {
      await result.current.queueRequest(request);
      await result.current.queueRequest(request);
    });
    expect(postMessage).toHaveBeenCalledTimes(1);

    act(() => emitServiceWorkerMessage({ type: "SYNC_COMPLETE" }));

    await act(async () => {
      await result.current.queueRequest(request);
    });
    expect(postMessage).toHaveBeenCalledTimes(2);
  });

  it("reports replay completion and invokes the optional callback", async () => {
    const onSyncComplete = jest.fn();
    renderHook(() => useBackgroundSync({ onSyncComplete }));

    act(() => emitServiceWorkerMessage({ type: "SYNC_COMPLETE" }));

    expect(onSyncComplete).toHaveBeenCalledTimes(1);
  });

  it("stores only one copy of a repeated queued request", async () => {
    const worker = loadServiceWorker();
    const request = {
      type: "ENQUEUE_REQUEST",
      payload: { url: "/api/jobs", body: '{"title":"same"}' },
    };

    await worker.sendMessage(request);
    await worker.sendMessage(request);

    expect(worker.entries()).toHaveLength(1);
  });

  it("replays queued requests when the background sync event fires", async () => {
    const entry = {
      id: 1,
      url: "/api/jobs",
      method: "POST",
      body: '{"title":"queued"}',
    };
    const worker = loadServiceWorker([entry]);
    fetchMock.mockResolvedValue({ ok: true, status: 201 });

    await worker.sync();

    expect(fetchMock).toHaveBeenCalledWith(entry.url, {
      method: entry.method,
      headers: { "Content-Type": "application/json" },
      body: entry.body,
    });
    expect(worker.entries()).toHaveLength(0);
    expect(worker.client.postMessage).toHaveBeenCalledWith({
      type: "SYNC_COMPLETE",
    });
  });

  it("shows a visible error when a replayed request fails with a client error", async () => {
    setOnline(true);
    render(<OfflineBanner />);

    const worker = loadServiceWorker([
      { id: 1, url: "/api/jobs", method: "POST", body: "{}" },
    ]);
    worker.client.postMessage.mockImplementation(emitServiceWorkerMessage);
    fetchMock.mockResolvedValue({ ok: false, status: 422 });

    await act(async () => {
      await worker.sync();
    });

    expect(worker.entries()).toHaveLength(0);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "An offline change could not be synced (HTTP 422)"
    );
    expect(worker.client.postMessage).toHaveBeenCalledWith({
      type: "SYNC_FAILURE",
      url: "/api/jobs",
      status: 422,
    });
  });
});
