// Reads a Server-Sent Events response body and calls `onEvent` for each event as it arrives.
export async function readEvents(response: Response, onEvent: (event: string, data: unknown) => void): Promise<void> {
  if (!response.body) throw new Error('No stream');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const dispatch = (block: string) => {
    let event = 'message';
    const data: string[] = [];
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) data.push(line.slice(5).trimStart());
    }
    if (!data.length) return; // a comment line (: ping)
    try {
      onEvent(event, JSON.parse(data.join('\n')));
    } catch {
      // A half-written event is ignored; the next one carries on.
    }
  };

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let split: number;
    while ((split = buffer.indexOf('\n\n')) >= 0) {
      dispatch(buffer.slice(0, split));
      buffer = buffer.slice(split + 2);
    }
  }
  if (buffer.trim()) dispatch(buffer);
}
