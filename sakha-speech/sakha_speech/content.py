"""Fetches the text to narrate and keeps it on disk, so it is fetched once.

work/text/<book>/<kind>/<lang>.json holds {verseId: text}; a verse with nothing in that language is kept
as null, so it is not asked for again (`fetch --refresh` asks again).

Three sources:
  api   the public website API (no login): the sitemap for the book's verse ids, then each verse
  s3    the files the backend's translation runs saved: <s3Text>/<lang>/ch-<n>.json
  file  a JSON file of {verseId: text} or [{verseId, text}], for anything else
"""

import json
import re
import time
from pathlib import Path

import requests

from .config import Book, work_dir
from .keys import sort_key

# The API allows 180 reads a minute from one address; 2 a second stays well under it.
REQUEST_GAP = 0.5
SAVE_EVERY = 25

# Which field of a translation row each kind reads, and which commentary type in an S3 file.
_API_FIELD = {"meaning": "meaning", "purport": "purport"}
_S3_TYPE = {"meaning": "translation", "purport": "purport"}


def text_path(book: str, kind: str, language: str) -> Path:
    return work_dir() / "text" / book / kind / f"{language}.json"


def load_text(book: str, kind: str, language: str) -> dict[str, str | None]:
    path = text_path(book, kind, language)
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def save_text(book: str, kind: str, language: str, texts: dict[str, str | None]) -> Path:
    path = text_path(book, kind, language)
    path.parent.mkdir(parents=True, exist_ok=True)
    ordered = {vid: texts[vid] for vid in sorted(texts, key=sort_key)}
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(ordered, ensure_ascii=False, indent=1), encoding="utf-8")
    tmp.replace(path)
    return path


def pick_translation(rows: list[dict], language: str, kind: str, translator: str | None) -> str | None:
    """The text for one language from a verse's translation rows (the API's `translations`)."""
    mine = [r for r in rows if r.get("languageCode") == language and r.get("type") == "TRANSLATION"]
    if translator:
        mine = [r for r in mine if (r.get("translator") or {}).get("slug") == translator]
    for row in mine:
        text = (row.get(_API_FIELD[kind]) or "").strip()
        if text:
            return text
    return None


class Api:
    """The website API, paced and retried. `session` is swappable for tests."""

    def __init__(self, base: str, session=None, gap: float = REQUEST_GAP):
        self.base = base.rstrip("/")
        self.session = session or requests.Session()
        self.gap = gap
        self._last = 0.0

    def get(self, path: str):
        for attempt in range(6):
            wait = self._last + self.gap - time.monotonic()
            if wait > 0:
                time.sleep(wait)
            self._last = time.monotonic()
            try:
                res = self.session.get(f"{self.base}{path}", timeout=30)
            except requests.RequestException:
                time.sleep(2 ** attempt)
                continue
            if res.status_code == 404:
                return None
            if res.status_code == 429 or res.status_code >= 500:
                time.sleep(float(res.headers.get("Retry-After") or 2 ** attempt * 5))
                continue
            res.raise_for_status()
            return res.json().get("data")
        raise RuntimeError(f"{path}: the API kept failing, try again later")

    def verse_ids(self, book_number: int) -> list[str]:
        data = self.get("/api/web/content/sitemap") or {}
        prefix = f"{book_number}."
        ids = [v["verseId"] for v in data.get("verses", []) if v.get("verseId", "").startswith(prefix)]
        return sorted(ids, key=sort_key)

    def verse(self, verse_id: str) -> dict | None:
        return self.get(f"/api/web/content/verses/{verse_id}")


def fetch_api(book: Book, languages: list[str], kind: str, api: Api, refresh: bool = False, log=print) -> dict:
    """Fills the cache for every language at once (one request carries all of a verse's translations)."""
    texts = {lang: ({} if refresh else load_text(book.slug, kind, lang)) for lang in languages}
    ids = api.verse_ids(book.book_number)
    if not ids:
        raise RuntimeError(f"the API lists no verses for book {book.book_number} ({book.slug}); is it published?")
    todo = [vid for vid in ids if any(vid not in texts[lang] for lang in languages)]
    log(f"{book.slug}: {len(ids)} verses, {len(todo)} to fetch")
    for n, vid in enumerate(todo, 1):
        verse = api.verse(vid) or {}
        for lang in languages:
            texts[lang][vid] = pick_translation(verse.get("translations") or [], lang, kind, book.translator)
        if n % SAVE_EVERY == 0 or n == len(todo):
            for lang in languages:
                save_text(book.slug, kind, lang, texts[lang])
            log(f"  {n}/{len(todo)}")
    for lang in languages:
        save_text(book.slug, kind, lang, texts[lang])
    return texts


def texts_from_s3_file(data: dict, language: str, kind: str, translator: str | None) -> dict[str, str]:
    """{verseId: text} from one saved translation file ({verses: [{verseId, commentaries: [...]}]})."""
    out = {}
    for entry in data.get("verses") or []:
        vid = entry.get("verseId")
        for c in entry.get("commentaries") or []:
            if c.get("language") != language or c.get("type") != _S3_TYPE[kind]:
                continue
            if translator and c.get("translatorSlug") != translator:
                continue
            text = (c.get("text") or "").strip()
            if vid and text:
                out[vid] = text
                break
    return out


def fetch_s3(book: Book, languages: list[str], kind: str, s3_client, bucket: str, log=print) -> dict:
    if not book.s3_text:
        raise RuntimeError(f"books.yaml: {book.slug} has no s3Text, so it cannot be read from S3")
    result = {}
    for lang in languages:
        prefix = f"{book.s3_text.strip('/')}/{lang}/"
        keys = []
        for page in s3_client.get_paginator("list_objects_v2").paginate(Bucket=bucket, Prefix=prefix):
            keys += [o["Key"] for o in page.get("Contents", []) if re.search(r"/ch-\d+\.json$", o["Key"])]
        texts = load_text(book.slug, kind, lang)
        for key in keys:
            body = s3_client.get_object(Bucket=bucket, Key=key)["Body"].read()
            texts.update(texts_from_s3_file(json.loads(body), lang, kind, book.translator))
        save_text(book.slug, kind, lang, texts)
        log(f"{book.slug} {lang}: {len(keys)} files, {sum(1 for t in texts.values() if t)} verses with text")
        result[lang] = texts
    return result


def fetch_file(book: Book, language: str, kind: str, path: Path, log=print) -> dict:
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    if isinstance(data, list):
        data = {row["verseId"]: row.get("text") for row in data}
    texts = load_text(book.slug, kind, language)
    texts.update({str(k): (v or None) for k, v in data.items()})
    save_text(book.slug, kind, language, texts)
    log(f"{book.slug} {language}: {len(data)} verses from {path}")
    return texts
