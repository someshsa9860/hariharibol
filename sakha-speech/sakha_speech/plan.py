"""What a job would do: every verse wanted, in which voice, and whether it is already made.

This is the one place that decides "already done": a verse is done when the manifest holds its hash (spoken
text + the voice of its character + pipeline version) and the file is on disk. Change a character's voice
and only that character's verses stop being done."""

from dataclasses import dataclass, field

from .cast import Cast, load_cast, load_choices, resolve_voice
from .config import Book, Voice, load_lexicon
from .content import load_text
from .keys import DEFAULT_KIND, chapter_id, narration_key, sort_key
from .manifest import Manifest, fingerprint
from .text import normalise


@dataclass
class Item:
    language: str
    verse_id: str
    chapter: str
    character: str
    voice: Voice
    default_voice: bool  # the character has not been given this voice, it is the book's narrator
    kind: str
    spoken: str
    hash: str
    key: str
    chars: int
    done: bool
    status: str | None = None  # the manifest's: ok, check, approved, redo


@dataclass
class Plan:
    book: Book
    cast: Cast
    items: list[Item] = field(default_factory=list)
    no_text: dict[str, int] = field(default_factory=dict)  # language -> verses in range with no text
    missing: list[str] = field(default_factory=list)  # languages whose text was never fetched

    @property
    def todo(self) -> list[Item]:
        return [i for i in self.items if not i.done]


def build_plan(book: Book, voices: dict[str, Voice], languages: list[str], chapters: list[str] | None = None,
               kind: str = DEFAULT_KIND, force: bool = False) -> Plan:
    cast = load_cast(book.slug)
    choices = load_choices(book.slug)
    wanted = set(chapters) if chapters else None
    plan = Plan(book, cast)
    for language in languages:
        texts = load_text(book.slug, kind, language)
        if not any(texts.values()):
            plan.missing.append(language)
            continue
        lexicon = load_lexicon(language)
        manifest = Manifest(book.slug, language)
        plan.no_text[language] = 0
        for vid in sorted(texts, key=sort_key):
            chapter = chapter_id(vid)
            if wanted is not None and chapter not in wanted:
                continue
            if not texts[vid]:
                plan.no_text[language] += 1
                continue
            character = cast.speaker(vid)
            voice, is_default = resolve_voice(book, voices, cast, choices, language, character)
            spoken = normalise(texts[vid], language, lexicon)
            hash_ = fingerprint(spoken, voice)
            entry = manifest.get(kind, vid) or {}
            plan.items.append(Item(
                language, vid, chapter, character, voice, is_default, kind, spoken, hash_,
                narration_key(book.slug, language, vid, kind), len(spoken),
                done=not force and manifest.is_current(kind, vid, hash_), status=entry.get("status"),
            ))
    return plan
