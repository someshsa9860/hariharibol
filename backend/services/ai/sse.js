// Reads a Server-Sent Events body (what both Gemini and OpenAI stream) into
// `{ event, data }` objects. Handles events split across network chunks, CRLF,
// multi-line `data:` fields and comment lines.

export async function* parseSse(body) {
  const decoder = new TextDecoder();
  let buffer = '';

  // `body` is a web ReadableStream (fetch) or any async iterable of Uint8Array.
  const chunks = body[Symbol.asyncIterator] ? body : readerToIterable(body);

  for await (const chunk of chunks) {
    buffer += typeof chunk === 'string' ? chunk : decoder.decode(chunk, { stream: true });
    buffer = buffer.replace(/\r\n/g, '\n');

    let boundary;
    while ((boundary = buffer.indexOf('\n\n')) !== -1) {
      const raw = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const event = toEvent(raw);
      if (event) yield event;
    }
  }

  // A final event the server did not terminate with a blank line.
  buffer += decoder.decode();
  const last = toEvent(buffer.replace(/\r\n/g, '\n'));
  if (last) yield last;
}

function toEvent(raw) {
  let event = 'message';
  const data = [];
  for (const line of raw.split('\n')) {
    if (!line || line.startsWith(':')) continue;
    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    const value = colon === -1 ? '' : line.slice(colon + 1).replace(/^ /, '');
    if (field === 'event') event = value;
    else if (field === 'data') data.push(value);
  }
  return data.length ? { event, data: data.join('\n') } : null;
}

async function* readerToIterable(stream) {
  const reader = stream.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return;
      yield value;
    }
  } finally {
    reader.releaseLock?.();
  }
}
