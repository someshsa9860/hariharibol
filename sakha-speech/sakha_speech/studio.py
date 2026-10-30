"""The studio: `sakha-speech studio` opens a page on this computer to make narration without the terminal.

  1. choose a book and the languages          3. give each character that speaks in them a voice (and hear it)
  2. choose chapters                          4. start; watch it work, see the time left, stop it, carry on later

The page is `studio.html` (plain HTML and JavaScript, nothing loaded from the internet). This file is
the small web server behind it. It answers only to this computer; the job itself runs in a process of its own
(`jobs.py`), so closing the page or this server does not stop it. Files go to `narration/` and the choices of
voices to `characters/<book>.voices.json`.
"""

import json
import mimetypes
import re
import subprocess
import sys
import threading
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

from . import jobs
from .cast import NARRATOR, Character, default_voice, load_cast, load_choices, save_choices
from .config import Book, ConfigError, Voice, audio_dir, cast_dir, load_books, load_voices, work_dir
from .content import load_text
from .keys import DEFAULT_KIND, chapter_id, sort_key
from .plan import build_plan
from .sample import sample_dir
from .speed import Rates, rate_key

PAGE = Path(__file__).parent / "studio.html"
MAX_BODY = 1_000_000

LANGUAGE_NAMES = {
    "en": "English", "hi": "Hindi", "mr": "Marathi", "ta": "Tamil", "te": "Telugu", "kn": "Kannada", "ml": "Malayalam",
    "bn": "Bengali", "gu": "Gujarati", "pa": "Punjabi", "or": "Odia", "sa": "Sanskrit", "as": "Assamese", "ne": "Nepali",
}


class ApiError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status
        self.message = message


# ---- what the page asks for -----------------------------------------------------------------------------

def _config() -> tuple[dict[str, Voice], dict[str, Book]]:
    voices = load_voices()
    return voices, load_books(voices)


def _book(books: dict[str, Book], slug) -> Book:
    if slug not in books:
        raise ApiError(404, f"no book {slug!r} in books.yaml")
    return books[slug]


def _languages(voices: dict[str, Voice], wanted) -> list[str]:
    known = {v.language for v in voices.values()}
    languages = [str(x) for x in (wanted or [])]
    bad = [x for x in languages if x not in known]
    if bad or not languages:
        raise ApiError(400, f"choose at least one language with a voice ({', '.join(sorted(known))})"
                       if not bad else f"no voice speaks {', '.join(bad)}")
    return languages


def _demos(voice: Voice) -> dict:
    folder = sample_dir(voice.language, voice.id)
    info = jobs.read_json(folder / "info.json") or {}
    lines = [{"n": n, "line": line} for n, line in enumerate(info.get("lines") or [], 1) if (folder / f"{n}.mp3").exists()]
    return {"demos": lines, "demoOutdated": bool(lines) and info.get("fingerprint") not in (None, voice.fingerprint())}


def overview() -> dict:
    voices, books = _config()
    return {
        "books": [{"slug": b.slug, "kinds": list(b.kinds), "hasCast": (cast_dir() / f"{b.slug}.json").exists()}
                  for b in books.values()],
        "languages": [{"code": code, "name": LANGUAGE_NAMES.get(code, code)}
                      for code in sorted({v.language for v in voices.values()})],
        "voices": [{"id": v.id, "language": v.language, "gender": v.gender, "engine": v.engine, "licence": v.licence,
                    "name": v.id.rsplit("-", 1)[-1].title(), **_demos(v)} for v in voices.values()],
        "audioDir": str(audio_dir()),
        "job": jobs.snapshot(),
    }


def _verse_ids(book: Book, cast, voices: dict[str, Voice]) -> list[str]:
    ids = set(cast.verses)
    for language in {v.language for v in voices.values()}:
        ids |= set(load_text(book.slug, DEFAULT_KIND, language))
    return sorted(ids, key=sort_key)


def book_view(slug: str, languages: list[str]) -> dict:
    voices, books = _config()
    book = _book(books, slug)
    cast = load_cast(slug)
    choices = load_choices(slug)
    ids = _verse_ids(book, cast, voices)
    plan = build_plan(book, voices, languages)

    chapters: dict[str, dict] = {}
    people: dict[str, dict] = {}
    for vid in ids:
        cid, who = chapter_id(vid), cast.speaker(vid)
        chapter = chapters.setdefault(cid, {
            "id": cid, "name": cast.chapters.get(cid), "group": cid.split(".")[0] if "." in cid else None,
            "verses": 0, "characters": {}, "progress": {}})
        chapter["verses"] += 1
        chapter["characters"][who] = chapter["characters"].get(who, 0) + 1
        people.setdefault(who, 0)
        people[who] += 1
    for item in plan.items:
        row = chapters[item.chapter]["progress"].setdefault(item.language, {"wanted": 0, "done": 0})
        row["wanted"] += 1
        row["done"] += item.done

    characters = []
    for cid, count in people.items():
        c: Character = cast.character(cid)
        characters.append({
            "id": cid, "names": {"en": c.name("en"), **{lang: c.name(lang) for lang in languages}}, "gender": c.gender,
            "verses": count,
            "choices": {lang: (choices.get(lang) or {}).get(cid) for lang in languages},
            "defaults": {lang: default_voice(book, voices, lang, c.gender).id for lang in languages},
        })
    return {
        "slug": slug, "hasCast": bool(cast.verses), "kind": DEFAULT_KIND,
        "text": {lang: sum(1 for t in load_text(slug, DEFAULT_KIND, lang).values() if t) for lang in languages},
        "chapters": list(chapters.values()), "characters": characters,
    }


def plan_view(body: dict) -> dict:
    voices, books = _config()
    book = _book(books, body.get("book"))
    languages = _languages(voices, body.get("languages"))
    plan = build_plan(book, voices, languages, body.get("chapters") or None, DEFAULT_KIND, bool(body.get("force")))
    limit = int(body["limit"]) if str(body.get("limit") or "").isdigit() and int(body["limit"]) > 0 else None
    todo = plan.todo[:limit] if limit else plan.todo
    rates = Rates()
    per: dict[tuple[str, str], dict] = {}
    for item in plan.items:
        row = per.setdefault((item.language, item.character), {
            "language": item.language, "character": item.character, "voice": item.voice.id,
            "isDefault": item.default_voice, "wanted": 0, "done": 0})
        row["wanted"] += 1
        row["done"] += item.done
    engines = {rate_key(i.voice) for i in todo}
    return {
        "wanted": len(plan.items), "done": len(plan.items) - len(plan.todo), "todo": len(todo), "chars": sum(i.chars for i in todo),
        "etaSeconds": rates.estimate(todo), "etaMeasured": bool(engines) and all(rates.rate(k) for k in engines),
        "missing": plan.missing, "noText": plan.no_text, "perCharacter": list(per.values()),
    }


def set_voice(body: dict) -> dict:
    voices, books = _config()
    book = _book(books, body.get("book"))
    language, character, voice_id = body.get("language"), body.get("character"), body.get("voice") or None
    if language not in {v.language for v in voices.values()}:
        raise ApiError(400, f"no voice speaks {language!r}")
    if not character or not isinstance(character, str):
        raise ApiError(400, "which character?")
    if voice_id is not None and (voice_id not in voices or voices[voice_id].language != language):
        raise ApiError(400, f"{voice_id!r} is not a {language} voice")
    choices = load_choices(book.slug)
    by_character = choices.setdefault(language, {})
    if voice_id is None:
        by_character.pop(character, None)
    else:
        by_character[character] = voice_id
    save_choices(book.slug, choices)
    return {"choices": choices}


def start_job(body: dict) -> dict:
    voices, books = _config()
    kind = body.get("type") or "narration"
    try:
        if kind == "demo":
            ids = [v for v in body.get("voices") or [] if v in voices]
            if not ids:
                raise ApiError(400, "choose a voice")
            return {"job": jobs.start({"type": "demo", "voices": ids})}
        book = _book(books, body.get("book"))
        languages = _languages(voices, body.get("languages"))
        if kind == "fetch":
            return {"job": jobs.start({"type": "fetch", "book": book.slug, "languages": languages, "kind": DEFAULT_KIND})}
        if kind != "narration":
            raise ApiError(400, f"unknown job type {kind!r}")
        plan = build_plan(book, voices, languages, body.get("chapters") or None, DEFAULT_KIND, bool(body.get("force")))
        if plan.missing:
            raise ApiError(400, f"there is no {', '.join(plan.missing)} text on this computer yet: use Get the text first")
        if not plan.items:
            raise ApiError(400, "no verses in that selection have text")
        if not plan.todo:
            raise ApiError(400, f"nothing to make: all {len(plan.items)} verses are already done")
        limit = int(body["limit"]) if str(body.get("limit") or "").isdigit() and int(body["limit"]) > 0 else None
        return {"job": jobs.start({"type": "narration", "book": book.slug, "languages": languages, "kind": DEFAULT_KIND,
                                   "chapters": [str(c) for c in body.get("chapters") or []] or None, "limit": limit,
                                   "force": bool(body.get("force"))})}
    except jobs.JobBusy as e:
        raise ApiError(409, str(e)) from e


def open_folder(body: dict) -> dict:
    folder = {"audio": audio_dir(), "characters": cast_dir()}.get(body.get("what"))
    if folder is None:
        raise ApiError(400, "what to open?")
    folder.mkdir(parents=True, exist_ok=True)
    opener = ["open", str(folder)] if sys.platform == "darwin" else ["xdg-open", str(folder)]
    try:
        subprocess.Popen(opener, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except OSError:
        raise ApiError(500, f"could not open the folder; it is {folder}") from None
    return {"path": str(folder)}


POST_ROUTES = {
    "/api/plan": plan_view,
    "/api/voice": set_voice,
    "/api/job/start": start_job,
    "/api/job/stop": lambda body: {"job": jobs.stop(bool(body.get("force")))},
    "/api/open": open_folder,
}


# ---- the server ----------------------------------------------------------------------------------------

def _inside(root: Path, path: Path) -> bool:
    try:
        path.resolve().relative_to(root.resolve())
    except ValueError:
        return False
    return True


class Handler(BaseHTTPRequestHandler):
    server: "Studio"

    def log_message(self, *args):
        pass

    # Only this computer's own page may talk to the server: a web page elsewhere can make the browser send
    # requests to localhost, and could otherwise start jobs or change voices.
    def _hosts_ok(self) -> bool:
        return self.headers.get("Host") in self.server.hosts

    def _send(self, status: int, body: bytes, kind: str = "application/json", headers: dict | None = None):
        self.send_response(status)
        self.send_header("Content-Type", kind)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        for k, v in (headers or {}).items():
            self.send_header(k, v)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def _json(self, status: int, data):
        self._send(status, json.dumps(data, ensure_ascii=False).encode())

    def _file(self, path: Path):
        """An audio file, with Range so the player can skip around in it."""
        if not path.is_file():
            return self._json(404, {"error": "not found"})
        size = path.stat().st_size
        kind = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        start, end, status = 0, size - 1, 200
        header = self.headers.get("Range")
        if header:
            m = re.fullmatch(r"bytes=(\d*)-(\d*)", header.strip())
            if not m or not (m.group(1) or m.group(2)):
                return self._send(416, b"", kind, {"Content-Range": f"bytes */{size}"})
            if m.group(1):
                start = int(m.group(1))
                end = min(int(m.group(2)), size - 1) if m.group(2) else size - 1
            else:  # the last N bytes
                start = max(0, size - int(m.group(2)))
            if start >= size or start > end:
                return self._send(416, b"", kind, {"Content-Range": f"bytes */{size}"})
            status = 206
        with path.open("rb") as f:
            f.seek(start)
            body = f.read(end - start + 1)
        headers = {"Accept-Ranges": "bytes"}
        if status == 206:
            headers["Content-Range"] = f"bytes {start}-{end}/{size}"
        self._send(status, body, kind, headers)

    def do_GET(self):
        self._get()

    def do_HEAD(self):
        self._get()

    def _get(self):
        if not self._hosts_ok():
            return self._json(403, {"error": "this page answers only on this computer"})
        url = urlparse(self.path)
        path = unquote(url.path)
        try:
            if path == "/":
                return self._send(200, PAGE.read_bytes(), "text/html; charset=utf-8")
            if path == "/api/overview":
                return self._json(200, overview())
            if path == "/api/job":
                return self._json(200, {"job": jobs.snapshot()})
            if m := re.fullmatch(r"/api/book/([\w.-]+)", path):
                languages = [x for x in parse_qs(url.query).get("languages", [""])[0].split(",") if x]
                return self._json(200, book_view(m.group(1), _languages(_config()[0], languages)))
            if path.startswith("/audio/"):
                root = audio_dir()
                target = root / path[len("/audio/"):]
                return self._file(target) if _inside(root, target) else self._json(404, {"error": "not found"})
            if m := re.fullmatch(r"/demo/([\w-]+)/([\w.-]+)/(\d+)\.mp3", path):
                return self._file(sample_dir(m.group(1), m.group(2)) / f"{m.group(3)}.mp3")
        except ApiError as e:
            return self._json(e.status, {"error": e.message})
        except ConfigError as e:
            return self._json(500, {"error": str(e)})
        return self._json(404, {"error": "not found"})

    def do_POST(self):
        if not self._hosts_ok():
            return self._json(403, {"error": "this page answers only on this computer"})
        origin = self.headers.get("Origin")
        if origin and urlparse(origin).netloc not in self.server.hosts:
            return self._json(403, {"error": "request from another site"})
        if (self.headers.get("Content-Type") or "").split(";")[0].strip() != "application/json":
            return self._json(415, {"error": "send JSON"})
        route = POST_ROUTES.get(urlparse(self.path).path)
        if route is None:
            return self._json(404, {"error": "not found"})
        try:
            length = int(self.headers.get("Content-Length") or 0)
            if length > MAX_BODY:
                return self._json(413, {"error": "too large"})
            body = json.loads(self.rfile.read(length) or b"{}")
            if not isinstance(body, dict):
                raise ValueError
        except ValueError:
            return self._json(400, {"error": "bad JSON"})
        try:
            result = route(body)
        except ApiError as e:
            return self._json(e.status, {"error": e.message})
        except ConfigError as e:
            return self._json(500, {"error": str(e)})
        return self._json(200, result)


class Studio(ThreadingHTTPServer):
    daemon_threads = True

    def __init__(self, port: int):
        super().__init__(("127.0.0.1", port), Handler)
        real = self.server_address[1]
        self.hosts = {f"127.0.0.1:{real}", f"localhost:{real}"}

    @property
    def url(self) -> str:
        return f"http://localhost:{self.server_address[1]}"


def serve(port: int = 8766, open_browser: bool = True, log=print) -> None:
    try:
        server = Studio(port)
    except OSError:
        raise RuntimeError(f"port {port} is busy: the studio may already be open at http://localhost:{port}, "
                           f"or use --port") from None
    log(f"Sakha Speech studio: {server.url}   (Ctrl-C closes this window; a running job carries on)")
    log(f"audio goes to {audio_dir()}")
    if open_browser:
        threading.Timer(0.5, webbrowser.open, [server.url]).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        log("\nstudio closed")
    finally:
        server.server_close()
