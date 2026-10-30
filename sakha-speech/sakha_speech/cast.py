"""Who speaks each verse, and which voice each character speaks with.

  characters/<book>.json         the characters and, for every verse, whose words it is (hand-correctable)
  characters/<book>.voices.json  {language: {character: voice id}}, written by the studio

A book with no characters file has one character, the Narrator, who speaks every verse. A character that
has not been given a voice speaks with the book's narrator of the same gender (books.yaml), so a run
never stops for want of a choice. One character has one voice in a language, for the whole book.
"""

import json
from dataclasses import dataclass, field

from .config import Book, ConfigError, Voice, cast_dir

NARRATOR = "narrator"


@dataclass(frozen=True)
class Character:
    id: str
    names: dict
    gender: str = "male"

    def name(self, language: str = "en") -> str:
        return self.names.get(language) or self.names.get("en") or self.id.replace("-", " ").title()


@dataclass
class Cast:
    book: str
    characters: dict[str, Character] = field(default_factory=dict)
    verses: dict[str, str] = field(default_factory=dict)  # verse id -> character id
    chapters: dict[str, str] = field(default_factory=dict)  # chapter id -> name

    def speaker(self, verse_id: str) -> str:
        """The character whose words the verse is; the Narrator when nobody is recorded for it."""
        return self.verses.get(verse_id) or NARRATOR

    def character(self, character_id: str) -> Character:
        return self.characters.get(character_id) or Character(NARRATOR, {"en": "Narrator"})


def load_cast(slug: str) -> Cast:
    path = cast_dir() / f"{slug}.json"
    if not path.exists():
        return Cast(slug)
    data = json.loads(path.read_text(encoding="utf-8"))
    characters = {cid: Character(cid, c.get("names") or {}, c.get("gender") or "male")
                  for cid, c in (data.get("characters") or {}).items()}
    return Cast(slug, characters, data.get("verses") or {}, data.get("chapters") or {})


def _choices_path(slug: str):
    return cast_dir() / f"{slug}.voices.json"


def load_choices(slug: str) -> dict[str, dict[str, str]]:
    path = _choices_path(slug)
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}


def save_choices(slug: str, choices: dict[str, dict[str, str]]) -> None:
    path = _choices_path(slug)
    path.parent.mkdir(parents=True, exist_ok=True)
    ordered = {lang: dict(sorted(by_char.items())) for lang, by_char in sorted(choices.items())}
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(ordered, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    tmp.replace(path)


def default_voice(book: Book, voices: dict[str, Voice], language: str, gender: str) -> Voice:
    """The book's narrator of that gender, else of the other gender, else any voice of the language."""
    other = "female" if gender == "male" else "male"
    for g in (gender, other):
        vid = book.narrators.get(language, {}).get(g)
        if vid in voices:
            return voices[vid]
    mine = [v for v in voices.values() if v.language == language]
    for v in mine:
        if v.gender == gender:
            return v
    if mine:
        return mine[0]
    raise ConfigError(f"voices.yaml has no voice for '{language}'")


def resolve_voice(book: Book, voices: dict[str, Voice], cast: Cast, choices: dict, language: str,
                  character_id: str) -> tuple[Voice, bool]:
    """(the voice this character speaks with in this language, whether it is only the default)."""
    chosen = voices.get((choices.get(language) or {}).get(character_id))
    if chosen is not None and chosen.language == language:
        return chosen, False
    return default_voice(book, voices, language, cast.character(character_id).gender), True
