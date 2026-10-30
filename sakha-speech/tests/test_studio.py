import http.client
import json
import threading

import pytest

from sakha_speech import jobs, studio


@pytest.fixture
def server(config_files, cast_file, texts):
    srv = studio.Studio(0)
    thread = threading.Thread(target=srv.serve_forever, daemon=True)
    thread.start()
    yield srv
    srv.shutdown()
    srv.server_close()


def call(server, method, path, body=None, headers=None, raw=None):
    conn = http.client.HTTPConnection("127.0.0.1", server.server_address[1], timeout=10)
    sent = {"Content-Type": "application/json", **(headers or {})} if method == "POST" else dict(headers or {})
    data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
    conn.request(method, path, body=data, headers=sent)
    resp = conn.getresponse()
    payload = resp.read()
    conn.close()
    return resp.status, dict(resp.getheaders()), payload


def get_json(server, path):
    status, _, payload = call(server, "GET", path)
    return status, json.loads(payload)


def post(server, path, body=None, **kw):
    status, _, payload = call(server, "POST", path, body if body is not None else {}, **kw)
    return status, json.loads(payload)


# ---- who may ask ----------------------------------------------------------------------------------------

def test_the_page_is_served(server):
    status, headers, payload = call(server, "GET", "/")
    assert status == 200 and headers["Content-Type"].startswith("text/html") and b"Sakha Speech studio" in payload


def test_a_request_for_another_host_name_is_refused(server):
    assert call(server, "GET", "/api/overview", headers={"Host": "evil.example"})[0] == 403
    assert call(server, "POST", "/api/job/stop", {}, headers={"Host": "evil.example"})[0] == 403


def test_a_post_from_another_site_or_not_json_is_refused(server):
    assert post(server, "/api/voice", {}, headers={"Origin": "http://evil.example"})[0] == 403
    assert call(server, "POST", "/api/job/stop", raw=b"{}", headers={"Content-Type": "text/plain"})[0] == 415
    assert call(server, "POST", "/api/job/stop", raw=b"{nope")[0] == 400
    assert call(server, "POST", "/api/job/stop", raw=b"[]")[0] == 400
    too_big = {"Content-Length": str(studio.MAX_BODY + 1)}  # refused on the header, before any of the body is read
    assert call(server, "POST", "/api/job/stop", raw=b"x", headers=too_big)[0] == 413
    assert call(server, "POST", "/api/nothing", raw=b"{}")[0] == 404


def test_the_pages_own_origin_is_accepted(server):
    origin = f"http://localhost:{server.server_address[1]}"
    assert post(server, "/api/job/stop", {}, headers={"Origin": origin, "Host": f"localhost:{server.server_address[1]}"})[0] == 200


# ---- what the page reads --------------------------------------------------------------------------------

def test_overview_lists_books_languages_and_voices(server, tmp_path):
    status, data = get_json(server, "/api/overview")
    assert status == 200
    assert data["books"] == [{"slug": "bhagavad-gita", "kinds": ["meaning"], "hasCast": True}]
    assert [l["code"] for l in data["languages"]] == ["en", "hi"]
    assert {v["id"] for v in data["voices"]} == {"en-fake-m", "en-fake-f", "en-fake-m2", "hi-fake-m", "hi-fake-f"}
    assert data["audioDir"] == str(tmp_path / "narration") and data["job"] is None


def test_the_book_view_lists_chapters_with_their_characters_and_progress(server, make_all):
    make_all(["en"])
    status, data = get_json(server, "/api/book/bhagavad-gita?languages=en,hi")
    assert status == 200
    chapters = {c["id"]: c for c in data["chapters"]}
    assert chapters["1"]["name"] == "Arjuna's despair" and chapters["1"]["verses"] == 3
    assert chapters["1"]["characters"] == {"krishna": 1, "arjuna": 1, "narrator": 1}
    assert chapters["1"]["progress"] == {"en": {"wanted": 2, "done": 2}, "hi": {"wanted": 2, "done": 0}}
    assert chapters["2"]["progress"] == {"en": {"wanted": 1, "done": 1}}
    people = {c["id"]: c for c in data["characters"]}
    assert people["devi"]["defaults"] == {"en": "en-fake-f", "hi": "hi-fake-f"}
    assert people["krishna"]["names"]["hi"] == "कृष्ण" and people["krishna"]["choices"] == {"en": None, "hi": None}
    assert data["text"] == {"en": 3, "hi": 2}


def test_an_unknown_book_or_language_is_a_clean_error(server):
    assert get_json(server, "/api/book/nope?languages=en")[0] == 404
    assert get_json(server, "/api/book/bhagavad-gita?languages=xx")[0] == 400
    assert get_json(server, "/api/book/bhagavad-gita")[0] == 400


# ---- plan, voices, jobs ---------------------------------------------------------------------------------

def test_the_plan_counts_what_is_made_and_what_is_left(server, make_all):
    status, plan = post(server, "/api/plan", {"book": "bhagavad-gita", "languages": ["en", "hi"]})
    assert (plan["wanted"], plan["done"], plan["todo"]) == (5, 0, 5) and plan["etaSeconds"] is None
    assert {(p["language"], p["character"]): p["voice"] for p in plan["perCharacter"]}[("hi", "arjuna")] == "hi-fake-m"
    make_all(["en"])
    plan = post(server, "/api/plan", {"book": "bhagavad-gita", "languages": ["en", "hi"]})[1]
    assert (plan["done"], plan["todo"]) == (3, 2)
    assert post(server, "/api/plan", {"book": "bhagavad-gita", "languages": ["en"], "force": True})[1]["todo"] == 3
    assert post(server, "/api/plan", {"book": "bhagavad-gita", "languages": ["hi"], "limit": 1})[1]["todo"] == 1


def test_choosing_a_voice_is_saved_and_changes_only_that_characters_verses(server, make_all, tmp_path):
    make_all(["en"])
    status, data = post(server, "/api/voice", {"book": "bhagavad-gita", "language": "en", "character": "krishna", "voice": "en-fake-m2"})
    assert status == 200 and data["choices"] == {"en": {"krishna": "en-fake-m2"}}
    assert json.loads((tmp_path / "characters" / "bhagavad-gita.voices.json").read_text()) == data["choices"]
    plan = post(server, "/api/plan", {"book": "bhagavad-gita", "languages": ["en"]})[1]
    assert (plan["done"], plan["todo"]) == (2, 1)
    assert post(server, "/api/voice", {"book": "bhagavad-gita", "language": "en", "character": "krishna", "voice": None})[1]["choices"] == {"en": {}}
    assert post(server, "/api/plan", {"book": "bhagavad-gita", "languages": ["en"]})[1]["todo"] == 0


def test_a_voice_of_another_language_or_an_unknown_one_is_refused(server):
    base = {"book": "bhagavad-gita", "language": "en", "character": "krishna"}
    assert post(server, "/api/voice", {**base, "voice": "hi-fake-m"})[0] == 400
    assert post(server, "/api/voice", {**base, "voice": "nobody"})[0] == 400
    assert post(server, "/api/voice", {**base, "language": "xx", "voice": "en-fake-m"})[0] == 400
    assert post(server, "/api/voice", {"book": "bhagavad-gita", "language": "en", "voice": "en-fake-m"})[0] == 400


def test_starting_a_job_checks_the_selection_first(server, make_all, wait_for):
    start = {"type": "narration", "book": "bhagavad-gita"}
    assert post(server, "/api/job/start", {**start, "languages": []})[0] == 400
    status, data = post(server, "/api/job/start", {**start, "languages": ["en"], "chapters": ["9"]})
    assert status == 400 and "no verses" in data["error"]
    status, data = post(server, "/api/job/start", {**start, "languages": ["ta"]})
    assert status == 400 and "no voice speaks ta" in data["error"]
    make_all(["en"])
    status, data = post(server, "/api/job/start", {**start, "languages": ["en"]})
    assert status == 400 and "already done" in data["error"]
    status, data = post(server, "/api/job/start", {**start, "languages": ["hi"]})
    assert status == 200 and data["job"]["state"] in ("starting", "running", "done")
    assert post(server, "/api/job/start", {**start, "languages": ["en"], "force": True})[0] in (200, 409)
    wait_for(lambda: (get_json(server, "/api/job")[1]["job"] or {}).get("state") not in jobs.ACTIVE)


def test_a_second_job_while_one_runs_is_a_conflict(server, config_files, wait_for):
    config_files(delay=1.0)
    start = {"type": "narration", "book": "bhagavad-gita", "languages": ["en"]}
    assert post(server, "/api/job/start", start)[0] == 200
    assert post(server, "/api/job/start", start)[0] == 409
    assert post(server, "/api/job/stop", {"force": True})[1]["job"]["state"] == "stopped"


def test_a_demo_job_needs_a_voice_and_then_the_demo_is_served(server, wait_for):
    assert post(server, "/api/job/start", {"type": "demo", "voices": []})[0] == 400
    assert post(server, "/api/job/start", {"type": "demo", "voices": ["en-fake-m"]})[0] == 200
    wait_for(lambda: (get_json(server, "/api/job")[1]["job"] or {}).get("state") == "done")
    voice = next(v for v in get_json(server, "/api/overview")[1]["voices"] if v["id"] == "en-fake-m")
    assert voice["demos"] and voice["demoOutdated"] is False
    status, headers, payload = call(server, "GET", f"/demo/en/en-fake-m/{voice['demos'][0]['n']}.mp3")
    assert status == 200 and headers["Content-Type"] == "audio/mpeg" and len(payload) > 1000


# ---- audio files ----------------------------------------------------------------------------------------

def test_audio_is_served_with_ranges_so_the_player_can_skip(server, make_all):
    make_all(["en"])
    path = "/audio/bhagavad-gita/en/1/1.mp3"
    status, headers, whole = call(server, "GET", path)
    size = len(whole)
    assert status == 200 and headers["Accept-Ranges"] == "bytes" and size > 1000
    status, headers, part = call(server, "GET", path, headers={"Range": "bytes=0-9"})
    assert (status, part, headers["Content-Range"]) == (206, whole[:10], f"bytes 0-9/{size}")
    status, headers, part = call(server, "GET", path, headers={"Range": "bytes=-5"})
    assert (status, part) == (206, whole[-5:])
    status, _, part = call(server, "GET", path, headers={"Range": f"bytes={size - 3}-"})
    assert (status, part) == (206, whole[-3:])
    assert call(server, "GET", path, headers={"Range": f"bytes={size + 10}-"})[0] == 416
    assert call(server, "GET", path, headers={"Range": "bytes=abc"})[0] == 416
    assert call(server, "GET", "/audio/bhagavad-gita/en/9/9.mp3")[0] == 404


def test_audio_cannot_reach_outside_its_folder(server, make_all, tmp_path):
    (tmp_path / "secret.txt").write_text("secret")
    assert call(server, "GET", "/audio/..%2fsecret.txt")[0] == 404
    assert call(server, "GET", "/audio/%2e%2e/secret.txt")[0] == 404
    assert call(server, "GET", "/audio/../secret.txt")[0] == 404
