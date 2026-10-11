import { POLICY, check, buildChatRequest } from './core.mjs';

export async function requestJson(path, key, body, {
  fetchImpl = fetch, timeoutMs = 60000, maxBytes = POLICY.responseBytes,
} = {}) {
  check(['/audio/transcriptions', '/chat/completions'].includes(path), 'INVALID_API_PATH');
  check(typeof key === 'string' && key.trim().length > 0, 'MISSING_API_KEY');
  const multipart = body instanceof FormData;
  const headers = { Authorization: `Bearer ${key}`, Accept: 'application/json' };
  if (!multipart) headers['Content-Type'] = 'application/json';
  const signal = AbortSignal.timeout(timeoutMs);
  let reader;
  let abortListener;
  try {
    const response = await fetchImpl(`https://api.devupai.com/v1${path}`, {
      method: 'POST', headers, body: multipart ? body : JSON.stringify(body),
      redirect: 'error', signal,
    });
    const rawId = response.headers.get('x-request-id');
    const requestId = rawId && /^[a-zA-Z0-9_.:-]{1,128}$/.test(rawId) ? rawId : null;
    if (!response.ok) {
      void response.body?.cancel().catch(() => {});
      const error = new Error('API_HTTP_ERROR');
      error.status = response.status;
      error.requestId = requestId;
      throw error;
    }
    check(response.body, 'EMPTY_API_RESPONSE');
    reader = response.body.getReader();
    abortListener = () => { void reader.cancel().catch(() => {}); };
    signal.addEventListener('abort', abortListener, { once: true });
    const chunks = [];
    let bytes = 0;
    while (true) {
      signal.throwIfAborted();
      const part = await reader.read();
      signal.throwIfAborted();
      if (part.done) break;
      bytes += part.value.byteLength;
      check(bytes <= maxBytes, 'API_RESPONSE_TOO_LARGE');
      chunks.push(part.value);
    }
    const joined = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) { joined.set(chunk, offset); offset += chunk.byteLength; }
    let value;
    try { value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(joined)); }
    catch { throw new Error('INVALID_API_JSON'); }
    return { value, requestId };
  } catch (error) {
    if (signal.aborted) throw new Error('API_TIMEOUT');
    if (error.message.startsWith('API_') || error.message === 'INVALID_API_JSON') throw error;
    throw new Error('API_NETWORK_ERROR');
  } finally {
    if (abortListener) signal.removeEventListener('abort', abortListener);
    if (reader) {
      // Cancellation is best effort; do not wait on a stalled response during cleanup.
      void reader.cancel().catch(() => {});
      reader.releaseLock();
    }
  }
}

export async function transcribe(bytes, filename, mime, key, model, options = {}) {
  check(typeof model === 'string' && model.trim().length > 0, 'MISSING_AUDIO_MODEL');
  const form = new FormData();
  form.set('model', model);
  form.set('file', new Blob([bytes], { type: mime }), filename);
  return requestJson('/audio/transcriptions', key, form, {
    timeoutMs: 120000, ...options,
  });
}

export function extract(blocks, key, model, options = {}) {
  return requestJson('/chat/completions', key, buildChatRequest(blocks, model), options);
}
