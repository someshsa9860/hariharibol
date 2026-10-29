"""sakha-speech <command>. Run `sakha-speech <command> -h` for a command's options."""

import argparse
import sys
from pathlib import Path

from . import config
from .config import ConfigError


def _langs(value: str | None, book) -> list[str]:
    return [v.strip() for v in value.split(",")] if value else book.languages()


def _genders(value: str | None) -> list[str]:
    genders = [v.strip() for v in value.split(",")] if value else list(config.GENDERS)
    for g in genders:
        if g not in config.GENDERS:
            raise ConfigError(f"--gender must be male, female or both (male,female), not {g!r}")
    return genders


def _book(books, slug):
    if slug not in books:
        raise ConfigError(f"no book {slug!r} in books.yaml (there is {', '.join(books) or 'none'})")
    return books[slug]


def cmd_voices(args, voices, books):
    for v in voices.values():
        if args.lang and v.language != args.lang:
            continue
        narrates = [f"{b.slug}" for b in books.values() if b.narrators.get(v.language, {}).get(v.gender) == v.id]
        print(f"{v.id:22} {v.language:3} {v.gender:7} {v.engine:7} {v.licence:12} {'narrates ' + ', '.join(narrates) if narrates else ''}")


def cmd_fetch(args, voices, books):
    from . import content
    book = _book(books, args.book)
    languages = _langs(args.lang, book)
    kinds = [args.kind] if args.kind else list(book.kinds)
    for kind in kinds:
        if args.source == "api":
            content.fetch_api(book, languages, kind, content.Api(config.api_base()), refresh=args.refresh)
        elif args.source == "s3":
            from .s3 import client
            content.fetch_s3(book, languages, kind, client(), config.s3_settings()["bucket"])
        else:
            if len(languages) != 1:
                raise ConfigError("--source FILE needs exactly one --lang")
            content.fetch_file(book, languages[0], kind, Path(args.source))
        for lang in languages:
            texts = content.load_text(book.slug, kind, lang)
            have = sum(1 for t in texts.values() if t)
            print(f"{book.slug} {kind} {lang}: {have} of {len(texts)} verses have text  ({content.text_path(book.slug, kind, lang)})")


def cmd_sample(args, voices, books):
    from .sample import make_samples
    chosen = [v for v in voices.values() if v.language == args.lang and (not args.voice or v.id in args.voice.split(","))]
    if args.gender:
        chosen = [v for v in chosen if v.gender in _genders(args.gender)]
    if not chosen:
        raise ConfigError(f"no voices for '{args.lang}' in voices.yaml")
    print(f"voice test, {args.lang}: {', '.join(v.id for v in chosen)}")
    make_samples(args.lang, chosen, books)


def cmd_generate(args, voices, books):
    from .generate import generate
    book = _book(books, args.book)
    kinds = [args.kind] if args.kind else list(book.kinds)
    for lang in _langs(args.lang, book):
        for gender in _genders(args.gender):
            for kind in kinds:
                generate(book, voices, lang, gender, kind, chapter=args.chapter, limit=args.limit, force=args.force)


def cmd_review(args, voices, books):
    from .review import serve
    serve(books, voices, port=args.port)


def cmd_upload(args, voices, books):
    from .s3 import upload
    book = _book(books, args.book)
    for lang in _langs(args.lang, book):
        for gender in _genders(args.gender):
            voice = voices[book.narrator(lang, gender)]
            print(f"{book.slug} {lang} {gender} ({voice.id})")
            upload(book.slug, lang, voice, include_check=args.include_check, dry_run=args.dry_run)


def cmd_status(args, voices, books):
    from .content import load_text
    from .manifest import Manifest
    for book in ([_book(books, args.book)] if args.book else books.values()):
        for lang, by_gender in book.narrators.items():
            for gender, vid in by_gender.items():
                manifest = Manifest(book.slug, lang, voices[vid])
                for kind in book.kinds:
                    texts = load_text(book.slug, kind, lang)
                    entries = manifest.items.get(kind, {})
                    count = lambda *s: sum(1 for e in entries.values() if e["status"] in s)
                    uploaded = sum(1 for e in entries.values() if e.get("hash") and e.get("uploadedHash") == e["hash"])
                    print(f"{book.slug} {kind} {lang} {gender:6} {vid:20} text {sum(1 for t in texts.values() if t):4}  "
                          f"made {count('ok', 'approved', 'check'):4}  check {count('check'):3}  "
                          f"redo {count('redo'):3}  uploaded {uploaded:4}")


def parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="sakha-speech", description="Makes HariHariBol's narration audio and uploads it to S3.")
    sub = p.add_subparsers(dest="command", required=True)

    s = sub.add_parser("voices", help="list the voices and which books they narrate")
    s.add_argument("--lang")
    s.set_defaults(run=cmd_voices)

    s = sub.add_parser("fetch", help="fetch the text to narrate and keep it on disk")
    s.add_argument("--book", required=True)
    s.add_argument("--lang", help="comma separated; default every language the book has narrators for")
    s.add_argument("--kind", help="meaning or purport; default the book's kinds")
    s.add_argument("--source", default="api", help="api (default), s3, or a JSON file path")
    s.add_argument("--refresh", action="store_true", help="ask the API again for verses already fetched")
    s.set_defaults(run=cmd_fetch)

    s = sub.add_parser("sample", help="voice test: the same lines in every voice of a language")
    s.add_argument("--lang", required=True)
    s.add_argument("--voice", help="comma separated voice ids; default every voice of the language")
    s.add_argument("--gender")
    s.set_defaults(run=cmd_sample)

    s = sub.add_parser("generate", help="make a book's narration with its narrators")
    s.add_argument("--book", required=True)
    s.add_argument("--lang", help="comma separated; default every language the book has narrators for")
    s.add_argument("--gender", help="male, female or male,female (default both)")
    s.add_argument("--kind")
    s.add_argument("--chapter", help="2 for the Gita's chapter 2, 1.3 for canto 1 chapter 3")
    s.add_argument("--limit", type=int, help="make at most this many verses (per language and gender)")
    s.add_argument("--force", action="store_true", help="make again even what is already made")
    s.set_defaults(run=cmd_generate)

    s = sub.add_parser("review", help="local page to listen, keep, or make again")
    s.add_argument("--port", type=int, default=8765)
    s.set_defaults(run=cmd_review)

    s = sub.add_parser("upload", help="upload what is made to S3")
    s.add_argument("--book", required=True)
    s.add_argument("--lang")
    s.add_argument("--gender")
    s.add_argument("--include-check", action="store_true", help="also upload verses marked check")
    s.add_argument("--dry-run", action="store_true", help="say what would be uploaded, upload nothing")
    s.set_defaults(run=cmd_upload)

    s = sub.add_parser("status", help="what is fetched, made, to check and uploaded")
    s.add_argument("--book")
    s.set_defaults(run=cmd_status)
    return p


def main(argv=None):
    config.load_env()
    args = parser().parse_args(argv)
    try:
        voices = config.load_voices()
        books = config.load_books(voices)
        args.run(args, voices, books)
    except (ConfigError, RuntimeError) as e:
        print(f"sakha-speech: {e}", file=sys.stderr)
        sys.exit(1)
    except KeyboardInterrupt:
        print("\nstopped; run the same command again to carry on", file=sys.stderr)
        sys.exit(130)
