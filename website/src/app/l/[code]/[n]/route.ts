import { NextRequest, NextResponse } from 'next/server';
import { SERVER_API_BASE, SITE_URL } from '@/lib/config';

/**
 * A tracked link from a marketing email: /l/<delivery code>/<link position>. The API records the tap (and whether a
 * mail scanner made it) and says where to go: the target itself for a website link, and for a link into the app the
 * website's own page for it, which opens the app where it is installed (Universal / App Links). A code we never made
 * goes to the home page. The reader's own User-Agent is passed on so scanners can be told from people.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string; n: string }> }) {
  const { code, n } = await params;
  let url = SITE_URL;
  try {
    const res = await fetch(`${SERVER_API_BASE}/api/web/marketing/click/${encodeURIComponent(code)}/${encodeURIComponent(n)}`, {
      headers: { Accept: 'application/json', 'X-Platform': 'web', 'X-Client-User-Agent': request.headers.get('user-agent') ?? '' },
      cache: 'no-store',
    });
    if (res.ok) {
      const body = (await res.json()) as { data?: { url?: string } };
      if (body.data?.url && /^https?:\/\//i.test(body.data.url)) url = body.data.url;
    }
  } catch {
    // The API being down must not strand the reader: they still reach the website.
  }
  const response = NextResponse.redirect(url, 302);
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}
