import json

from sakha_speech.config import Voice
from sakha_speech.s3 import upload


class FakeS3:
    def __init__(self):
        self.files, self.objects = [], {}

    def upload_file(self, path, bucket, key, ExtraArgs):
        assert ExtraArgs["ContentType"] == "audio/mpeg"
        self.files.append(key)

    def put_object(self, Bucket, Key, Body, ContentType):
        self.objects[Key] = json.loads(Body)


quiet = dict(log=lambda *_: None)


def test_upload_sends_the_local_layout_under_the_prefix_and_writes_the_index(book, voices, cast_file, texts, make_all):
    make_all(["en"])
    s3 = FakeS3()
    assert upload(book.slug, "en", s3_client=s3, **quiet) == 3
    assert s3.files == ["narration/bhagavad-gita/en/1/1.mp3", "narration/bhagavad-gita/en/1/2.mp3",
                        "narration/bhagavad-gita/en/2/1.mp3"]
    index = s3.objects["narration/bhagavad-gita/en/_index.json"]
    assert index["voices"] == ["en-fake-f", "en-fake-m"]
    assert index["items"]["meaning"]["1.2.1"]["voice"] == "en-fake-f"
    assert index["items"]["meaning"]["1.1.2"]["character"] == "arjuna"
    assert upload(book.slug, "en", s3_client=FakeS3(), **quiet) == 0  # nothing changed, nothing sent again


def test_a_verse_marked_check_is_held_back_until_included(book, voices, cast_file, texts, make_all):
    voices["en-fake-m"] = Voice("en-fake-m", "en", "male", "fake", "test", {"silent": True})
    make_all(["en"])
    assert upload(book.slug, "en", dry_run=True, **quiet) == 1  # only Devi's, spoken by the other voice
    assert upload(book.slug, "en", dry_run=True, include_check=True, **quiet) == 3
