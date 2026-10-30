"""Where a verse's narration lives, on disk and in S3. The same path in both: the local folder `narration/`
is what goes under `s3://<bucket>/narration/`. It follows the backend's utils/verse-audio.js: the canto (if
any), the chapter, then the verse; a compound verse (16-18) is filed under its first number."""

import re

_VERSE_ID = re.compile(r"^\d+(\.\d+){1,3}(-\d+)?$")

# The verse's own meaning is <verse>.mp3; anything else made for it (a purport) is <verse>-<kind>.mp3.
DEFAULT_KIND = "meaning"


def verse_parts(verse_id: str) -> list[str]:
    """'1.2.47' -> ['2', '47'];  '2.1.3.12' -> ['1', '3', '12'];  '1.1.16-18' -> ['1', '16']."""
    if not _VERSE_ID.match(verse_id):
        raise ValueError(f"not a verse id: {verse_id!r}")
    parts = verse_id.split(".")[1:]
    parts[-1] = parts[-1].split("-")[0]
    return parts


def chapter_id(verse_id: str) -> str:
    """'1.2.47' -> '2' (the Gita's chapter 2);  '2.1.3.12' -> '1.3' (canto 1, chapter 3)."""
    return ".".join(verse_parts(verse_id)[:-1])


def book_prefix(book: str, language: str) -> str:
    """The folder that holds one language of one book: <book>/<lang>."""
    return f"{book}/{language}"


def narration_key(book: str, language: str, verse_id: str, kind: str = DEFAULT_KIND) -> str:
    """<book>/<lang>/<canto>/<chapter>/<verse>.mp3, without the S3 prefix. No voice in the path: one chapter
    has several voices, one for each character, and the manifest records which spoke which verse."""
    *folders, verse = verse_parts(verse_id)
    name = verse if kind == DEFAULT_KIND else f"{verse}-{kind}"
    return "/".join([book_prefix(book, language), *folders, f"{name}.mp3"])


def sort_key(verse_id: str) -> tuple:
    """Reading order: 1.2.10 after 1.2.9, 1.1.16-18 after 1.1.15."""
    return tuple(int(p.split("-")[0]) for p in verse_id.split("."))
