import json

import numpy as np
import pytest

from sakha_speech import audio
from sakha_speech.config import Voice
from sakha_speech.content import save_text
from sakha_speech.generate import generate
from sakha_speech.manifest import Manifest, audio_path
from sakha_speech.s3 import upload

quiet = dict(log=lambda *_: None)


@pytest.fixture
def texts(book):
    save_text(book.slug, "meaning", "en", {"1.1.1": "Dhrtarastra said: O Sanjaya, what did they do?", "1.1.2": None,
                                           "1.2.1": "Sanjaya said."})
    save_text(book.slug, "meaning", "hi", {"1.1.1": "धृतराष्ट्र ने कहा।"})


def test_generate_makes_one_mp3_per_verse_with_text(book, voices, texts):
    s = generate(book, voices, "en", "male", **quiet)
    assert (s.made, s.no_text, s.check) == (2, 1, 0)
    entry = Manifest(book.slug, "en", voices["en-fake-m"]).get("meaning", "1.1.1")
    assert entry["key"] == "bhagavad-gita/en/en-fake-m/1/1-meaning.mp3"
    path = audio_path(entry["key"])
    assert path.read_bytes()[:3] in (b"ID3", b"\xff\xfb", b"\xff\xf3", b"\xff\xf2")
    assert entry["durationMs"] > 1000


def test_a_second_run_makes_nothing_and_a_changed_text_only_that_verse(book, voices, texts):
    generate(book, voices, "en", "male", **quiet)
    assert generate(book, voices, "en", "male", **quiet).made == 0
    save_text(book.slug, "meaning", "en", {"1.1.1": "Changed.", "1.1.2": None, "1.2.1": "Sanjaya said."})
    assert generate(book, voices, "en", "male", **quiet).made == 1


def test_each_gender_gets_its_own_narrator_and_folder(book, voices, texts):
    generate(book, voices, "en", "female", **quiet)
    entry = Manifest(book.slug, "en", voices["en-fake-f"]).get("meaning", "1.1.1")
    assert "/en-fake-f/" in entry["key"]


def test_chapter_and_limit(book, voices, texts):
    assert generate(book, voices, "en", "male", chapter="2", **quiet).made == 1
    assert generate(book, voices, "en", "male", limit=0, **quiet).made == 0


def test_a_book_with_no_narrator_for_a_gender_says_so(book, voices, texts):
    from sakha_speech.config import ConfigError
    with pytest.raises(ConfigError, match="no male narrator for 'hi'"):
        generate(book, voices, "hi", "male", **quiet)


def test_a_voice_that_stays_silent_is_marked_check_and_held_back_from_upload(book, voices, texts):
    voices["en-fake-m"] = Voice("en-fake-m", "en", "male", "fake", "test", {"silent": True})
    s = generate(book, voices, "en", "male", **quiet)
    assert s.check == 2
    assert upload(book.slug, "en", voices["en-fake-m"], dry_run=True, **quiet) == 0


class FakeS3:
    def __init__(self):
        self.files, self.objects = [], {}

    def upload_file(self, path, bucket, key, ExtraArgs):
        assert ExtraArgs["ContentType"] == "audio/mpeg"
        self.files.append(key)

    def put_object(self, Bucket, Key, Body, ContentType):
        self.objects[Key] = json.loads(Body)


def test_upload_sends_each_file_once_and_writes_the_index(book, voices, texts):
    generate(book, voices, "en", "male", **quiet)
    s3 = FakeS3()
    assert upload(book.slug, "en", voices["en-fake-m"], s3_client=s3, **quiet) == 2
    assert s3.files[0] == "narration/bhagavad-gita/en/en-fake-m/1/1-meaning.mp3"
    index = s3.objects["narration/bhagavad-gita/en/en-fake-m/_index.json"]
    assert index["voice"]["gender"] == "male" and set(index["items"]["meaning"]) == {"1.1.1", "1.2.1"}
    assert upload(book.slug, "en", voices["en-fake-m"], s3_client=FakeS3(), **quiet) == 0


def test_join_trims_and_pauses():
    sr = 1000
    tone = np.r_[np.zeros(500), np.ones(100) * 0.5, np.zeros(500)].astype(np.float32)
    out = audio.join([(tone, 200), (tone, 0)], sr)
    # each piece trimmed to 100 samples plus 60 ms kept on either side, and one 200 ms pause
    assert out.size == 2 * (100 + 2 * 60) + 200
