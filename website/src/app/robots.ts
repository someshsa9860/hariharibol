import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/config';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/me', '/search', '/sakha', '/l/', '/unsubscribe/'] }],
    // generateSitemaps() in sitemap.ts serves /sitemap/0.xml, /sitemap/1.xml …; the first file lists the pages.
    sitemap: `${SITE_URL}/sitemap/0.xml`,
  };
}
