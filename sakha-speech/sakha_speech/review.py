"""A local page for listening to what was made: `sakha-speech review`, then open http://localhost:8765.

Verses marked `check` are listed first (all of them with "show all"). Keep marks one approved, so it is
uploaded; Make again forgets it and moves it to the next seeds, so the next `generate` makes a new take."""

import html
import json
import mimetypes
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

from .config import Book, Voice, audio_dir, load_lexicon, work_dir
from .content import load_text
from .keys import sort_key
from .manifest import Manifest, audio_path
from .text import normalise


def _sets(books: dict[str, Book]):
    """(book, language) for everything that has been made."""
    for book in books.values():
        for path in sorted((work_dir() / "manifest" / book.slug).glob("*.json")):
            yield book, path.stem


def _page(books, show_all: bool) -> str:
    out = ["<!doctype html><meta charset=utf-8><title>Sakha Speech review</title>",
           "<style>body{font:15px system-ui;max-width:960px;margin:24px auto;padding:0 16px}"
           ".v{border-top:1px solid #ccc;padding:10px 0}.c{color:#b45309}.m{color:#666;font-size:13px}"
           "audio{width:100%}button{margin-right:8px}</style>",
           f"<h1>Review</h1><p><a href='/?all={0 if show_all else 1}'>{'only to check' if show_all else 'show all'}</a></p>"]
    for book, language in _sets(books):
        manifest = Manifest(book.slug, language)
        for kind, entries in manifest.items.items():
            texts = load_text(book.slug, kind, language)
            lexicon = load_lexicon(language)
            rows = [(vid, e) for vid, e in sorted(entries.items(), key=lambda kv: sort_key(kv[0]))
                    if show_all or e["status"] == "check"]
            if not rows:
                continue
            out.append(f"<h2>{book.slug} · {language} · {kind} ({len(rows)})</h2>")
            for vid, e in rows:
                ref = json.dumps({"book": book.slug, "language": language, "kind": kind, "verseId": vid})
                spoken = normalise(texts.get(vid) or "", language, lexicon)
                out.append(
                    f"<div class=v><b>{vid}</b> {html.escape(str(e.get('character') or ''))} · {html.escape(str(e.get('voice') or ''))} <span class={'c' if e['status'] == 'check' else 'm'}>{e['status']}</span>"
                    f"{' · ' + html.escape(e['problem']) if e.get('problem') else ''}"
                    f"<p>{html.escape(spoken)}</p><audio controls preload=none src='/audio/{html.escape(e['key'])}'></audio>"
                    f"<p><button onclick='act(\"approve\",{html.escape(ref)},this)'>Keep</button>"
                    f"<button onclick='act(\"redo\",{html.escape(ref)},this)'>Make again</button></p></div>")
    out.append("<script>async function act(a,r,b){const res=await fetch('/api/'+a,{method:'POST',body:JSON.stringify(r)});"
               "b.parentElement.innerHTML=res.ok?(a=='approve'?'kept':'will be made again on the next generate'):'failed'}</script>")
    return "\n".join(out)


def serve(books: dict[str, Book], port: int = 8765, log=print):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass

        def _send(self, status, body: bytes, kind="text/html; charset=utf-8"):
            self.send_response(status)
            self.send_header("Content-Type", kind)
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):
            url = urlparse(self.path)
            if url.path.startswith("/audio/"):
                path = (audio_dir() / url.path[len("/audio/"):]).resolve()
                if not path.is_relative_to(audio_dir().resolve()) or not path.exists():
                    return self._send(404, b"not found", "text/plain")
                return self._send(200, path.read_bytes(), mimetypes.guess_type(path.name)[0] or "audio/mpeg")
            show_all = parse_qs(url.query).get("all", ["0"])[0] == "1"
            return self._send(200, _page(books, show_all).encode())

        def do_POST(self):
            action = urlparse(self.path).path.rsplit("/", 1)[-1]
            ref = json.loads(self.rfile.read(int(self.headers.get("Content-Length") or 0)) or b"{}")
            if action not in ("approve", "redo") or ref.get("book") not in books:
                return self._send(400, b"bad request", "text/plain")
            manifest = Manifest(ref["book"], ref["language"])
            entry = manifest.get(ref["kind"], ref["verseId"])
            if entry is None:
                return self._send(404, b"not found", "text/plain")
            if action == "approve":
                entry["status"] = "approved"
            else:
                audio_path(entry["key"]).unlink(missing_ok=True)
                entry.update(hash=None, status="redo", take=int(entry.get("take", 0)) + 1)
            manifest.save()
            return self._send(200, b"{}", "application/json")

    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    log(f"review page: http://localhost:{port}  (Ctrl-C to stop)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
