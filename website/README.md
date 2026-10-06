# HariHariBol website

This is a plain static landing page for HariHariBol. It has no build step,
framework, or server-side dependency.

## Run locally

From this directory, use any static file server:

```bash
python3 -m http.server 8080
```

Then open <http://localhost:8080>.

## Deploy

Upload the contents of this directory to any static host such as GitHub Pages,
Netlify, Vercel, or an S3 bucket. The only entry point is `index.html`.
