import json

from sakha_speech.config import Voice
from sakha_speech.speed import Rates, rate_key
from sakha_speech.jobs import Piece

en = Voice("en-x", "en", "male", "parler", "")
hi = Voice("hi-x", "hi", "male", "parler", "")


def test_nothing_known_means_no_estimate():
    assert Rates().estimate([Piece(en, 100)]) is None


def test_the_estimate_is_characters_times_the_rate_seen_so_far():
    rates = Rates(persist=False)
    rates.observe(en, 200, 100)  # half a second a character
    assert rates.rate(rate_key(en)) == 0.5
    assert rates.estimate([Piece(en, 100), Piece(en, 20)]) == 60


def test_each_language_has_its_own_rate():
    rates = Rates(persist=False)
    rates.observe(en, 100, 50)
    rates.observe(hi, 100, 150)
    assert rates.estimate([Piece(hi, 10)]) == 15
    assert rates.estimate([Piece(en, 10), Piece(hi, 10)]) == 20


def test_a_language_never_timed_borrows_the_average_of_the_others_in_the_same_job():
    rates = Rates(persist=False)
    rates.observe(en, 100, 50)
    assert rates.estimate([Piece(hi, 10)]) is None  # alone, nothing to go on
    assert rates.estimate([Piece(en, 10), Piece(hi, 10)]) == 10  # 5 s for English, Hindi at English's 0.5 s a character


def test_what_a_job_learns_is_kept_for_the_next_one(work):
    Rates().observe(en, 100, 25)
    assert json.loads((work / "speed.json").read_text())["en:parler"] == [100, 25]
    assert Rates().rate("en:parler") == 0.25


def test_the_voice_test_gives_a_first_figure_before_any_job(work):
    folder = work / "samples" / "hi" / "hi-x"
    folder.mkdir(parents=True)
    (folder / "info.json").write_text(json.dumps({"engine": "parler", "lines": ["a" * 40, "b" * 60], "computeSeconds": 200}))
    assert Rates().rate("hi:parler") == 2.0


def test_the_session_figure_beats_history():
    rates = Rates({"en:parler": [100, 1000]}, persist=False)
    assert rates.rate("en:parler") == 10
    rates.observe(en, 100, 100)
    assert rates.rate("en:parler") == 1  # this job's own speed, not the old average
