import { ORIGIN, API, PublicError } from './oauth.mjs';

export function subscriptionFetch(store, selectedModel, fetcher = fetch) {
  return async (input, init) => {
    try {
      const request = new Request(input, init);
      const url = new URL(request.url);
      if (url.origin !== ORIGIN || url.username || url.password || url.search || url.hash || url.pathname !== '/app/v1/chat/completions' || request.method !== 'POST') throw new PublicError();
      const reader = request.body?.getReader();
      if (!reader) throw new PublicError();
      const parts = [];
      let size = 0;
      try {
        for (;;) {
          const {done, value} = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > 8 * 1024 * 1024) throw new PublicError();
          parts.push(Buffer.from(value));
        }
      } finally { await reader.cancel().catch(() => {}); }
      const text = Buffer.concat(parts).toString('utf8');
      const body = JSON.parse(text);
      if (body.model !== selectedModel || !Array.isArray(body.messages) || !body.messages.length) throw new PublicError();
      // Keep the SDK's reusable configuration free of access and refresh tokens.
      const response = await fetcher(`${API}/chat/completions`, {
        method: 'POST', redirect: 'error',
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(600_000)]),
        headers: {'Content-Type': 'application/json', Accept: body.stream ? 'text/event-stream' : 'application/json', Authorization: `Bearer ${await store.accessToken()}`},
        body: text,
      });
      const type = response.headers.get('content-type') || '';
      if (!response.ok || !(body.stream ? type.includes('text/event-stream') : type.includes('application/json'))) {
        await response.body?.cancel();
        return new Response(JSON.stringify({error: {message: 'Cenmax AI request failed. Check the connection and account allowance.', type: 'cenmax_error'}}), {
          status: [400,401,403,413,429].includes(response.status) ? response.status : 502,
          headers: {'Content-Type': 'application/json'},
        });
      }
      let received = 0;
      const bounded = response.body?.pipeThrough(new TransformStream({transform(chunk, controller) {
        received += chunk.byteLength;
        if (received > 32 * 1024 * 1024) throw new PublicError('Cenmax AI response exceeded the supported size.');
        controller.enqueue(chunk);
      }}));
      return new Response(bounded, {status: 200, headers: {'Content-Type': type, 'Cache-Control': 'no-store'}});
    } catch {
      throw new PublicError('Cenmax AI request failed. Check the connection and account allowance.');
    }
  };
}
