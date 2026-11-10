export interface SseEvent {
  type: string;
  data: unknown;
}

export interface SseConnection {
  status: number;
  contentType: string | null;
  /** Sự kiện kế tiếp (bỏ qua `ping`), `null` nếu hết `timeoutMs` hoặc stream đã đóng. */
  next(timeoutMs?: number): Promise<SseEvent | null>;
  /** Chờ server đóng stream; true nếu đóng trong `timeoutMs`. */
  closed(timeoutMs?: number): Promise<boolean>;
  close(): void;
}

/** Đọc một stream SSE thật bằng fetch (Node 24), đủ cho e2e: tách `event:` và `data:` của mỗi sự kiện. */
export async function openSse(url: string, token?: string): Promise<SseConnection> {
  const abort = new AbortController();
  const response = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    signal: abort.signal,
  });
  const queue: SseEvent[] = [];
  let ended = !response.ok || !response.body;
  let wake: (() => void) | undefined;

  if (!ended && response.body) {
    const reader = (response.body as ReadableStream<Uint8Array>).getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    void (async () => {
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let boundary = buffer.indexOf('\n\n');
          while (boundary !== -1) {
            const block = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary + 2);
            const type = /^event: (.*)$/m.exec(block)?.[1] ?? 'message';
            const data = /^data: (.*)$/m.exec(block)?.[1];
            if (data !== undefined && type !== 'ping') {
              queue.push({ type, data: JSON.parse(data) as unknown });
            }
            boundary = buffer.indexOf('\n\n');
          }
          wake?.();
        }
      } catch {
        // Bị abort khi test tự đóng.
      } finally {
        ended = true;
        wake?.();
      }
    })();
  }

  const waitFor = async (ready: () => boolean, timeoutMs: number): Promise<boolean> => {
    const deadline = Date.now() + timeoutMs;
    while (!ready()) {
      const left = deadline - Date.now();
      if (left <= 0) return false;
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, left);
        wake = () => {
          clearTimeout(timer);
          resolve();
        };
      });
    }
    return true;
  };

  return {
    status: response.status,
    contentType: response.headers.get('content-type'),
    async next(timeoutMs = 3000) {
      await waitFor(() => queue.length > 0 || ended, timeoutMs);
      return queue.shift() ?? null;
    },
    closed: (timeoutMs = 3000) => waitFor(() => ended, timeoutMs),
    close: () => abort.abort(),
  };
}
