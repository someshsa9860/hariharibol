"""Where a verse's narration lives, locally and in S3. Mirrors the backend's utils/verse-audio.js:
the canto (if any), the chapter, then the verse; a compound verse (16-18) is filed under its first number."""

import re

_VERSE_ID = re.compile(r"^\d+(\.\d+){1,3}(-\d+)?$")


def verse_parts(verse_id: str) -> list[str]:
    """'1.2.47' -> ['2', '47'];  '2.1.3.12' -> ['1', '3', '12'];  '1.1.16-18' -> ['1', '16']."""
    if not _VERSE_ID.match(verse_id):
        raise ValueError(f"not a verse id: {verse_id!r}")
    parts = verse_id.split(".")[1:]
    parts[-1] = parts[-1].split("-")[0]
    return parts


def set_prefix(book: str, language: str, voice_id: str) -> str:
    """The folder that holds one narrator's whole book: <book>/<lang>/<voice>."""
    return f"{book}/{language}/{voice_id}"


def narration_key(book: str, language: str, voice_id: str, verse_id: str, kind: str) -> str:
    """<book>/<lang>/<voice>/<canto>/<chapter>/<verse>-<kind>.mp3, without the S3 prefix."""
    *folders, verse = verse_parts(verse_id)
    return "/".join([set_prefix(book, language, voice_id), *folders, f"{verse}-{kind}.mp3"])


def sort_key(verse_id: str) -> tuple:
    """Reading order: 1.2.10 after 1.2.9, 1.1.16-18 after 1.1.15."""
    return tuple(int(p.split("-")[0]) for p in verse_id.split("."))
