import json
import subprocess
import time

import pytest

from sakha_speech import Stopped, jobs
from sakha_speech.manifest import Manifest
from sakha_speech.speed import Rates

SLUG = "bhagavad-gita"
NEVER = lambda: False


def spec(**fields):
    return {"type": "narration", "book": SLUG, "languages": ["en"], **fields}


def run(**fields):
    progress = jobs.Progress(None)
    jobs.run_narration(spec(**fields), progress, NEVER, Rates(persist=False))
    return progress.data


# ---- the runner, in this process ------------------------------------------------------------------------

def test_a_run_makes_every_verse_and_a_second_run_makes_none(config_files, cast_file, texts):
    first = run(languages=["en", "hi"])
    assert (first["wanted"], first["already"], first["total"], first["made"], first["failed"]) == (5, 0, 5, 5, 0)
    assert first["audioSeconds"] > 0 and first["doneChars"] > 0
    assert {(c["language"], c["chapter"]): (c["wanted"], c["done"]) for c in first["chapters"]} == {
        ("en", "1"): (2, 2), ("en", "2"): (1, 1), ("hi", "1"): (2, 2)}
    second = run(languages=["en", "hi"])
    assert (second["already"], second["total"], second["made"]) == (5, 0, 0)


def test_the_files_land_in_book_language_chapter_verse(config_files, cast_file, texts, tmp_path):
    run(languages=["en", "hi"])
    made = sorted(str(p.relative_to(tmp_path / "narration")) for p in (tmp_path / "narration").rglob("*.mp3"))
    assert made == ["bhagavad-gita/en/1/1.mp3", "bhagavad-gita/en/1/2.mp3", "bhagavad-gita/en/2/1.mp3",
                    "bhagavad-gita/hi/1/1.mp3", "bhagavad-gita/hi/1/2.mp3"]


def test_limit_makes_only_the_first_few_and_force_makes_them_again(config_files, cast_file, texts):
    assert run(limit=2)["made"] == 2
    assert run()["made"] == 1  # the third verse
    assert run(force=True, limit=1)["made"] == 1


def test_chapters_narrow_the_run(config_files, cast_file, texts):
    data = run(chapters=["2"])
    assert (data["wanted"], data["made"]) == (1, 1)


def test_the_estimate_appears_as_soon_as_a_verse_has_been_timed(config_files, cast_file, texts):
    progress = jobs.Progress(None)
    seen = []
    original = progress.update
    progress.update = lambda **f: (seen.append(f.get("eta")), original(**f))[1]
    jobs.run_narration(spec(), progress, NEVER, Rates(persist=False))
    assert seen.count(None) >= 1 and any(e is not None and e > 0 for e in seen)


def test_nothing_to_narrate_is_an_error_that_says_why(config_files, cast_file, texts):
    with pytest.raises(RuntimeError, match="No ta text on this computer"):
        run(languages=["ta"])
    with pytest.raises(RuntimeError, match="no book 'nope'"):
        run(book="nope")


def test_a_stop_keeps_what_was_finished_and_leaves_no_half_made_file(config_files, cast_file, texts, tmp_path):
    progress = jobs.Progress(None)
    stop = lambda: bool(Manifest(SLUG, "en").items)  # asked to stop as soon as one verse is recorded
    with pytest.raises(Stopped):
        jobs.run_narration(spec(), progress, stop, Rates(persist=False))
    assert progress.data["made"] == 1
    assert sorted(Manifest(SLUG, "en").items["meaning"]) == ["1.1.1"]
    assert [p.name for p in (tmp_path / "narration").rglob("*") if p.is_file()] == ["1.mp3"]
    assert run()["already"] == 1  # and the next run carries on from there


def test_one_failed_verse_does_not_end_the_job_but_five_in_a_row_do(config_files, cast_file, texts, monkeypatch):
    real = jobs.make

    def flaky(item, manifest, stop=None):
        if item.verse_id == "1.1.1":
            raise ValueError("boom")
        return real(item, manifest, stop)
    monkeypatch.setattr(jobs, "make", flaky)
    data = run()
    assert (data["made"], data["failed"]) == (2, 1)

    monkeypatch.setattr(jobs, "make", lambda *a, **k: (_ for _ in ()).throw(ValueError("always")))
    monkeypatch.setattr(jobs, "MAX_FAILURES_IN_A_ROW", 2)
    with pytest.raises(RuntimeError, match="2 verses in a row failed"):
        run(force=True)


def test_the_demo_job_makes_the_demo_lines_for_each_voice(config_files, work):
    progress = jobs.Progress(None)
    jobs.run_demo({"type": "demo", "voices": ["en-fake-m", "hi-fake-f"], "lines": 2}, progress, NEVER, Rates(persist=False))
    assert progress.data["made"] == 4
    info = json.loads((work / "samples" / "hi" / "hi-fake-f" / "info.json").read_text(encoding="utf-8"))
    assert len(info["lines"]) == 2 and (work / "samples" / "hi" / "hi-fake-f" / "2.mp3").exists()


def test_human_times():
    assert [jobs.human(s) for s in (45, 720, 12000)] == ["45s", "12m", "3h 20m"]


def test_the_progress_line_says_where_the_run_is_and_what_is_spoken():
    line = jobs.progress_line({
        "state": "running", "total": 72, "eta": 2220,
        "chapters": [{"language": "hi", "chapter": "2", "name": "सांख्ययोग", "wanted": 72, "done": 53}],
        "current": {"verseId": "1.2.54", "characterName": "अर्जुन", "voice": "hi-parler-rohit"}})
    assert line == "running · hi chapter 2 सांख्ययोग · 53 of 72 verses · now 1.2.54 अर्जुन (hi-parler-rohit) · about 37m left"
    assert jobs.progress_line({"state": "done", "message": "Made 72 verses."}) == "job done: Made 72 verses."


def test_progress_prints_the_newest_jobs_log_and_stops_when_the_job_ends(work, capsys):
    folder = jobs.job_dir("20261030-191521")
    folder.mkdir(parents=True)
    (folder / "status.json").write_text(json.dumps({"id": "20261030-191521", "state": "done", "total": 2, "chapters": []}))
    (folder / "log.txt").write_text("19:15:30 [1/2] first verse\n19:16:10 [2/2] second verse\njob done\n", encoding="utf-8")
    jobs.follow(poll=0)
    out = capsys.readouterr().out
    assert "[2/2] second verse" in out and "job done" in out and "-- job done" in out


def test_progress_says_so_when_no_job_has_run(work, capsys):
    jobs.follow(poll=0)
    assert "No job has run yet" in capsys.readouterr().out


# ---- the job, in a process of its own -------------------------------------------------------------------

def finished(status_of=jobs.current):
    status = status_of()
    return status if status and status["state"] not in jobs.ACTIVE else None


def test_a_job_started_for_real_runs_to_the_end_by_itself(config_files, cast_file, texts, wait_for, tmp_path):
    job = jobs.start(spec(languages=["en", "hi"]))
    assert job["state"] in ("starting", "running")
    done = wait_for(finished)
    assert (done["state"], done["made"], done["failed"]) == ("done", 5, 0)
    assert (tmp_path / "narration" / SLUG / "hi" / "1" / "2.mp3").exists()
    assert "job done" in "\n".join(jobs.snapshot()["log"])
    again = jobs.start(spec(languages=["en", "hi"]))
    assert again["id"] != job["id"]
    assert wait_for(finished)["total"] == 0  # all of it was already there


def test_only_one_job_runs_at_a_time(config_files, cast_file, texts, wait_for):
    sleeper = subprocess.Popen(["sleep", "30"])
    try:
        def fake_spawn(folder):
            jobs._children[sleeper.pid] = sleeper
            (folder / "pid").write_text(str(sleeper.pid))
        jobs.start(spec(), spawn=fake_spawn)
        with pytest.raises(jobs.JobBusy):
            jobs.start(spec())
    finally:
        sleeper.kill()
        sleeper.wait()
        jobs._children.pop(sleeper.pid, None)


def test_a_job_whose_process_vanished_is_shown_as_interrupted_and_can_be_started_again(config_files, cast_file, texts, wait_for):
    folder = jobs.job_dir("20260101-000000")
    jobs.write_json(folder / "status.json", {"id": "20260101-000000", "type": "narration", "state": "running", "startedAt": 1})
    (folder / "pid").write_text("999999")  # no such process
    status = jobs.current()
    assert status["state"] == "interrupted" and "Start it again" in status["message"]
    assert jobs.read_json(folder / "status.json")["state"] == "interrupted"  # and it stays so
    jobs.start(spec())
    assert wait_for(finished)["state"] == "done"


def test_a_vanished_process_after_a_stop_was_asked_is_just_stopped(config_files):
    folder = jobs.job_dir("20260101-000000")
    jobs.write_json(folder / "status.json", {"id": "20260101-000000", "type": "narration", "state": "running", "startedAt": 1})
    (folder / "pid").write_text("999999")
    (folder / "stop").write_text("stop")
    assert jobs.current()["state"] == "stopped"


def test_a_polite_stop_ends_between_pieces_and_the_next_start_finishes_the_rest(config_files, cast_file, texts, wait_for, tmp_path):
    config_files(delay=0.6)
    jobs.start(spec())
    wait_for(lambda: (jobs.current() or {}).get("made", 0) >= 1)
    assert jobs.stop()["state"] == "stopping"
    stopped = wait_for(finished)
    made = stopped["made"]
    assert stopped["state"] == "stopped" and 1 <= made < 3
    assert not list((tmp_path / "narration").rglob("*.part*"))
    jobs.start(spec())
    rest = wait_for(finished)
    assert (rest["state"], rest["already"], rest["made"]) == ("done", made, 3 - made)


def test_stopping_now_kills_the_job_and_loses_only_the_verse_being_spoken(config_files, cast_file, texts, wait_for, tmp_path):
    config_files(delay=1.5)
    jobs.start(spec())
    wait_for(lambda: (jobs.current() or {}).get("current"))
    after = jobs.stop(force=True)
    assert after["state"] == "stopped"
    assert not list((tmp_path / "narration").rglob("*.part*"))
    recorded = Manifest(SLUG, "en").items.get("meaning", {})
    assert len(recorded) < 3 and all((tmp_path / "narration" / e["key"]).exists() for e in recorded.values())
    jobs.start(spec())
    done = wait_for(finished, timeout=90)
    assert done["state"] == "done" and done["already"] == len(recorded) and done["made"] == 3 - len(recorded)
