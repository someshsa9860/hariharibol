/** Opens the phone's share sheet, or copies the link where there is none. Returns what happened, for the toast. */
export async function share(data: { title: string; text?: string; url: string }): Promise<'shared' | 'copied' | 'failed'> {
  try {
    if (navigator.share) {
      await navigator.share(data);
      return 'shared';
    }
    await navigator.clipboard.writeText(data.url);
    return 'copied';
  } catch (error) {
    // Closing the share sheet is not an error.
    if (error instanceof DOMException && error.name === 'AbortError') return 'shared';
    return 'failed';
  }
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
