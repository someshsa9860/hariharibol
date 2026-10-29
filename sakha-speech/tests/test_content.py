import json

from sakha_speech import content


class FakeResponse:
    def __init__(self, status, data=None):
        self.status_code, self._data, self.headers = status, data, {}

    def json(self):
        return {"success": True, "data": self._data}

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(self.status_code)


def verse(vid, en, hi=None):
    rows = [{"languageCode": "en", "type": "TRANSLATION", "meaning": en, "translator": {"slug": "prabhupada"}},
            {"languageCode": "mr", "type": "POETIC_EXPANSION", "meaning": "ovi", "translator": {"slug": "dnyaneshwar"}}]
    if hi:
        rows.append({"languageCode": "hi", "type": "TRANSLATION", "meaning": hi, "translator": {"slug": "prabhupada"}})
    return {"verseId": vid, "translations": rows}


class FakeSession:
    def __init__(self):
        self.calls = []
        self.verses = {"1.1.1": verse("1.1.1", "One.", "एक।"), "1.1.2": verse("1.1.2", "Two."), "1.2.1": verse("1.2.1", "Three.", "तीन।")}

    def get(self, url, timeout):
        self.calls.append(url)
        if url.endswith("/sitemap"):
            ids = list(self.verses) + ["2.1.1.1"]  # another book's verse is left out
            return FakeResponse(200, {"verses": [{"verseId": v} for v in ids]})
        vid = url.rsplit("/", 1)[-1]
        return FakeResponse(200, self.verses[vid]) if vid in self.verses else FakeResponse(404)


def test_fetch_from_the_api_keeps_both_languages_and_marks_missing_ones(book):
    session = FakeSession()
    content.fetch_api(book, ["en", "hi"], "meaning", content.Api("http://x", session, gap=0), log=lambda *_: None)
    assert content.load_text(book.slug, "meaning", "en") == {"1.1.1": "One.", "1.1.2": "Two.", "1.2.1": "Three."}
    assert content.load_text(book.slug, "meaning", "hi") == {"1.1.1": "एक।", "1.1.2": None, "1.2.1": "तीन।"}
    # One request per verse for both languages, plus the sitemap.
    assert len(session.calls) == 4


def test_a_second_fetch_asks_only_for_the_sitemap(book):
    session = FakeSession()
    api = content.Api("http://x", session, gap=0)
    content.fetch_api(book, ["en", "hi"], "meaning", api, log=lambda *_: None)
    session.calls.clear()
    content.fetch_api(book, ["en", "hi"], "meaning", api, log=lambda *_: None)
    assert session.calls == ["http://x/api/web/content/sitemap"]


def test_poetic_expansions_are_not_narrated():
    rows = verse("1.1.1", "One.")["translations"]
    assert content.pick_translation(rows, "mr", "meaning", None) is None


def test_a_saved_translation_file_is_read_like_the_backend_import():
    data = {"verses": [{"verseId": "1.2.47", "commentaries": [
        {"translatorSlug": "prabhupada", "language": "hi", "type": "purport", "text": "तात्पर्य"},
        {"translatorSlug": "prabhupada", "language": "hi", "type": "translation", "text": "अर्थ"}]}]}
    assert content.texts_from_s3_file(data, "hi", "meaning", None) == {"1.2.47": "अर्थ"}
    assert content.texts_from_s3_file(data, "hi", "purport", None) == {"1.2.47": "तात्पर्य"}


def test_a_json_file_is_merged_in(book, tmp_path):
    path = tmp_path / "t.json"
    path.write_text(json.dumps([{"verseId": "1.1.1", "text": "Hello."}]))
    content.fetch_file(book, "en", "meaning", path, log=lambda *_: None)
    assert content.load_text(book.slug, "meaning", "en") == {"1.1.1": "Hello."}
