"""Uploads one narrator's finished book to S3, and an _index.json beside it for the backend to import.

  s3://<bucket>/<prefix>/<book>/<lang>/<voice>/<canto>/<chapter>/<verse>-<kind>.mp3
  s3://<bucket>/<prefix>/<book>/<lang>/<voice>/_index.json

Only files that changed since they were last uploaded go up. Verses marked `check` stay back until
they are approved or made again (`review`), unless --include-check."""

import json
from datetime import datetime, timezone

from .config import Voice, s3_settings
from .keys import set_prefix, sort_key
from .manifest import Manifest, audio_path


def client():
    import boto3
    return boto3.client("s3", region_name=s3_settings()["region"])


def upload(book: str, language: str, voice: Voice, include_check: bool = False, dry_run: bool = False,
           s3_client=None, log=print) -> int:
    settings = s3_settings()
    manifest = Manifest(book, language, voice)
    s3_client = s3_client or (None if dry_run else client())
    sent = held = 0
    for kind, entries in manifest.items.items():
        for vid in sorted(entries, key=sort_key):
            entry = entries[vid]
            if entry["status"] == "check" and not include_check:
                held += 1
                continue
            if entry["status"] not in ("ok", "approved", "check") or not entry.get("hash"):
                continue  # asked to be made again and not made yet
            if entry.get("uploadedHash") == entry["hash"]:
                continue
            key = f"{settings['prefix']}/{entry['key']}"
            if not dry_run:
                s3_client.upload_file(str(audio_path(entry["key"])), settings["bucket"], key,
                                      ExtraArgs={"ContentType": "audio/mpeg"})
                entry["uploadedHash"] = entry["hash"]
                manifest.save()
            sent += 1
            log(f"  {'would upload' if dry_run else 'uploaded'} {key}")

    index = {
        "book": book,
        "language": language,
        "voice": manifest.voice_info(),
        "updatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "items": {
            kind: {vid: {"key": f"{settings['prefix']}/{e['key']}", "durationMs": e["durationMs"], "hash": e["hash"]}
                   for vid, e in sorted(entries.items(), key=lambda kv: sort_key(kv[0]))
                   if e.get("uploadedHash") == e["hash"]}
            for kind, entries in manifest.items.items()
        },
    }
    index_key = f"{settings['prefix']}/{set_prefix(book, language, voice.id)}/_index.json"
    if not dry_run:
        s3_client.put_object(Bucket=settings["bucket"], Key=index_key, ContentType="application/json",
                             Body=json.dumps(index, ensure_ascii=False, indent=1).encode())
    log(f"{'would upload' if dry_run else 'uploaded'} {sent} files to s3://{settings['bucket']}, "
        f"{held} held back to check; index {index_key}")
    return sent
