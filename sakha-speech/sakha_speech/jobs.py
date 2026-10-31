"""Jobs: a narration run, a voice demo run or a text fetch, in a process of its own.

The studio (or `sakha-speech generate`) writes work/jobs/<id>/spec.json and starts
`python -m sakha_speech job run <spec>` detached from itself, so a job goes on when the browser tab, the
terminal or the studio is closed. The worker writes work/jobs/<id>/status.json after every verse and
anything it prints goes to log.txt. One job runs at a time (one GPU).

Stopping is polite by default: a `stop` file appears in the job's folder and the worker ends between two
pieces of speech, with everything finished kept. A second stop kills it; that is safe too, because a verse is
recorded only after its MP3 is complete. Start the same job again and the verses already made are skipped.
"""

import json
import os
import shutil
import signal
import subprocess
import sys
import time
import traceback
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path

from . import Stopped
from .config import ROOT, Voice, api_base, load_books, load_voices, work_dir
from .engines import engine_for
from .engines.base import EngineMissing
from .audio import FfmpegMissing
from .generate import make
from .keys import DEFAULT_KIND
from .manifest import Manifest
from .plan import build_plan
from .speed import Rates

ACTIVE = ("starting", "running", "stopping")
MAX_FAILURES_IN_A_ROW = 5
RECENT = 8


class JobBusy(RuntimeError):
    """Another job is running."""


# ---- files ----------------------------------------------------------------------------------------------

def jobs_dir() -> Path:
    return work_dir() / "jobs"


def job_dir(job_id: str) -> Path:
    return jobs_dir() / job_id


def read_json(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def write_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    tmp.replace(path)


def tail(path: Path, lines: int) -> list[str]:
    try:
        return path.read_text(encoding="utf-8", errors="replace").splitlines()[-lines:]
    except OSError:
        return []


class Progress:
    """The worker's status.json. With no folder it only prints, for a run in the foreground."""

    def __init__(self, folder: Path | None, spec: dict | None = None):
        self.folder = folder
        self.data = (read_json(folder / "status.json") if folder else None) or {}
        if spec:
            self.data.setdefault("id", spec.get("id"))
            self.data.setdefault("type", spec.get("type"))

    def update(self, **fields) -> None:
        self.data.update(fields)
        self.data["updatedAt"] = time.time()
        if self.folder:
            write_json(self.folder / "status.json", self.data)

    def log(self, message: str) -> None:
        print(f"{time.strftime('%H:%M:%S')} {message}", flush=True)


class StopFlag:
    """True once a person has asked the job to stop: a `stop` file in its folder, or SIGTERM / Ctrl-C."""

    def __init__(self, folder: Path | None):
        self.folder = folder
        self.signalled = False

    def __call__(self) -> bool:
        return self.signalled or bool(self.folder and (self.folder / "stop").exists())

    def on_signal(self, *_):
        self.signalled = True


@contextmanager
def keep_awake():
    """Stops the Mac sleeping while the job runs (the display may still sleep)."""
    proc = None
    if sys.platform == "darwin" and shutil.which("caffeinate"):
        proc = subprocess.Popen(["caffeinate", "-i", "-w", str(os.getpid())])
    try:
        yield
    finally:
        if proc:
            proc.terminate()


# ---- the worker -----------------------------------------------------------------------------------------

@dataclass
class Piece:
    """Enough of a plan item for Rates: whose voice and how many characters."""
    voice: Voice
    chars: int


def human(seconds: float) -> str:
    """3h 20m, 12m, 45s."""
    seconds = int(round(seconds))
    hours, rest = divmod(seconds, 3600)
    minutes = rest // 60
    if hours:
        return f"{hours}h {minutes:02d}m"
    return f"{minutes}m" if minutes else f"{rest}s"


def _need(spec: dict, key: str):
    if not spec.get(key):
        raise RuntimeError(f"the job has no {key}")
    return spec[key]


def run_narration(spec: dict, progress: Progress, stop, rates: Rates | None = None) -> None:
    voices = load_voices()
    books = load_books(voices)
    slug = _need(spec, "book")
    if slug not in books:
        raise RuntimeError(f"no book {slug!r} in books.yaml")
    book = books[slug]
    kind = spec.get("kind") or DEFAULT_KIND
    plan = build_plan(book, voices, _need(spec, "languages"), spec.get("chapters") or None, kind, bool(spec.get("force")))
    warnings = [f"No {lang} text on this computer for {slug}: skipped (use Get the text while online)." for lang in plan.missing]
    for w in warnings:
        progress.log(w)
    if not plan.items:
        raise RuntimeError(warnings[0] if warnings else "nothing in that selection has text to narrate")

    todo = plan.todo[: spec["limit"]] if spec.get("limit") else plan.todo
    already = len(plan.items) - len(plan.todo)
    rows: dict[tuple[str, str], dict] = {}
    for item in plan.items:
        row = rows.setdefault((item.language, item.chapter), {
            "language": item.language, "chapter": item.chapter, "name": plan.cast.chapters.get(item.chapter),
            "wanted": 0, "done": 0})
        row["wanted"] += 1
        row["done"] += item.done
    manifests = {lang: Manifest(slug, lang) for lang in {i.language for i in plan.items}}
    rates = rates or Rates()
    recent: list[dict] = []
    tally = {"made": 0, "check": 0, "failed": 0, "doneChars": 0, "audioSeconds": 0.0, "computeSeconds": 0.0}
    total_chars = sum(i.chars for i in todo)

    def publish(position: int, current: dict | None):
        eta = rates.estimate(todo[position:])
        progress.update(
            current=current, recent=recent[-RECENT:], chapters=list(rows.values()), eta=eta,
            finishAt=time.time() + eta if eta is not None else None, **tally)

    progress.update(
        state="running", phase="loading", book=slug, languages=spec["languages"], kind=kind,
        wanted=len(plan.items), already=already, total=len(todo), totalChars=total_chars,
        warnings=warnings, message="Loading the voices. The first time this takes a minute or two.", error=None,
        chapters=list(rows.values()), current=None, recent=[], **tally)
    progress.log(f"{slug}: {len(plan.items)} verses wanted, {already} already made, {len(todo)} to make")

    for voice in {i.voice.id: i.voice for i in todo}.values():
        engine_for(voice)  # a missing package or an unaccepted licence shows now, not after an hour
    progress.update(phase="making", message=None)

    in_a_row = 0
    for position, item in enumerate(todo):
        if stop():
            raise Stopped()
        name = plan.cast.character(item.character).name(item.language)
        publish(position, {
            "language": item.language, "verseId": item.verse_id, "chapter": item.chapter, "character": item.character,
            "characterName": name, "voice": item.voice.id, "chars": item.chars, "startedAt": time.time()})
        try:
            made = make(item, manifests[item.language], stop)
        except Stopped:
            raise
        except (EngineMissing, FfmpegMissing):
            raise
        except Exception as e:  # one bad verse does not end the job; five in a row means something is wrong
            tally["failed"] += 1
            in_a_row += 1
            progress.log(f"{item.language} {item.verse_id} FAILED: {e}")
            traceback.print_exc()
            if in_a_row >= MAX_FAILURES_IN_A_ROW:
                raise RuntimeError(f"{MAX_FAILURES_IN_A_ROW} verses in a row failed, last: {e}") from e
            publish(position + 1, None)
            continue
        in_a_row = 0
        rates.observe(item.voice, item.chars, made.compute_seconds)
        rows[(item.language, item.chapter)]["done"] += 1
        tally["made"] += 1
        tally["check"] += bool(made.problems)
        tally["doneChars"] += item.chars
        tally["audioSeconds"] += made.duration_ms / 1000
        tally["computeSeconds"] += made.compute_seconds
        recent.append({
            "language": item.language, "verseId": item.verse_id, "character": item.character, "characterName": name,
            "voice": item.voice.id, "key": item.key, "durationMs": made.duration_ms,
            "seconds": round(made.compute_seconds, 1), "status": "check" if made.problems else "ok"})
        flag = "  CHECK " + "; ".join(made.problems) if made.problems else ""
        left = rates.estimate(todo[position + 1:])
        progress.log(f"[{position + 1}/{len(todo)}] {item.language} {item.verse_id} {name} ({item.voice.id}): "
                     f"{made.duration_ms / 1000:.1f}s of audio in {made.compute_seconds:.0f}s"
                     f"{'; about ' + human(left) + ' left' if left else ''}{flag}")
        publish(position + 1, None)
    progress.update(current=None, message=f"Made {tally['made']} verses; {already} were already made.")


def run_demo(spec: dict, progress: Progress, stop, rates: Rates | None = None) -> None:
    from .sample import make_sample, sample_lines, write_index
    voices = load_voices()
    chosen = [voices[v] for v in _need(spec, "voices") if v in voices]
    if not chosen:
        raise RuntimeError("none of those voices is in voices.yaml")
    per_voice = {v.id: sample_lines(v.language, {}, extra_verses=0)[: spec.get("lines") or 3] for v in chosen}
    if not all(per_voice.values()):
        raise RuntimeError("samples.yaml has no lines for a language of those voices")
    rates = rates or Rates()
    lines_total = sum(len(lines) for lines in per_voice.values())
    done = 0
    progress.update(state="running", phase="loading", total=lines_total, made=0, check=0, failed=0, voices=[v.id for v in chosen],
                    message="Loading the voices. The first time this takes a minute or two.", error=None, current=None)
    for voice in chosen:
        engine_for(voice)
    progress.update(phase="making", message=None)
    remaining = [Piece(v, len(line)) for v in chosen for line in per_voice[v.id]]
    for voice in chosen:
        if stop():
            raise Stopped()
        progress.update(current={"voice": voice.id, "language": voice.language, "startedAt": time.time()})

        def step(n, chars, seconds, voice=voice):
            nonlocal done
            done += 1
            rates.observe(voice, chars, seconds)
            del remaining[0]
            eta = rates.estimate(remaining)
            progress.update(made=done, eta=eta, finishAt=time.time() + eta if eta is not None else None)

        make_sample(voice.language, voice, per_voice[voice.id], stop=stop, step=step)
        progress.log(f"demo made for {voice.id}")
    write_index()
    progress.update(current=None, message=f"Made the demo for {len(chosen)} voices.")


def run_fetch(spec: dict, progress: Progress, stop, rates=None) -> None:
    from . import content
    voices = load_voices()
    book = load_books(voices)[_need(spec, "book")]
    languages = _need(spec, "languages")
    kind = spec.get("kind") or DEFAULT_KIND
    progress.update(state="running", phase="making", book=book.slug, languages=languages, total=0, made=0, check=0,
                    failed=0, current=None, error=None,
                    message="Asking the website for the verses. This is the only step that needs the internet.")

    def step(n, total):
        progress.update(total=total, made=n)

    content.fetch_api(book, languages, kind, content.Api(api_base()), log=progress.log, stop=stop, step=step)
    progress.update(message="Got the text. It is saved on this computer, so narrating works offline.")


RUNNERS = {"narration": run_narration, "demo": run_demo, "fetch": run_fetch}


def run_job(spec_path: str | Path) -> int:
    """The worker process. Returns 0 unless the job failed."""
    spec = read_json(Path(spec_path))
    folder = job_dir(spec["id"])
    progress = Progress(folder, spec)
    stop = StopFlag(folder)
    for sig in (signal.SIGTERM, signal.SIGINT):
        signal.signal(sig, stop.on_signal)
    progress.update(pid=os.getpid(), state="running", startedAt=progress.data.get("startedAt") or time.time())
    state, error = "done", None
    with keep_awake():
        try:
            RUNNERS[spec["type"]](spec, progress, stop)
        except Stopped:
            state = "stopped"
        except EngineMissing as e:
            state, error = "failed", f"{e} Run ./setup.sh, then start again."
        except Exception as e:
            traceback.print_exc()
            state, error = "failed", str(e) or e.__class__.__name__
    progress.update(state=state, error=error, phase=None, current=None, finishedAt=time.time(), eta=None, finishAt=None)
    progress.log(f"job {state}" + (f": {error}" if error else ""))
    return 1 if state == "failed" else 0


def run_in_foreground(spec: dict) -> int:
    """`sakha-speech generate`: the same run, printed to the terminal and not written to a job folder."""
    if (status := current()) and status["state"] in ACTIVE:
        raise JobBusy("a job is already running (open the studio to see it)")
    progress = Progress(None, spec)
    try:
        RUNNERS[spec["type"]](spec, progress, StopFlag(None))
    except Stopped:
        pass
    return 0


# ---- the studio's side ---------------------------------------------------------------------------------

_children: dict[int, subprocess.Popen] = {}


def _pid(folder: Path) -> int | None:
    try:
        return int((folder / "pid").read_text())
    except (OSError, ValueError):
        return None


def _worker_alive(folder: Path, status: dict) -> bool:
    pid = _pid(folder)
    if pid is None:  # just started and not yet written down, or never started
        return time.time() - float(status.get("startedAt") or 0) < 15
    child = _children.get(pid)
    if child is not None:
        if child.poll() is not None:
            _children.pop(pid, None)
            return False
        return True
    try:
        out = subprocess.run(["ps", "-p", str(pid), "-o", "stat=,command="], capture_output=True, text=True,
                             timeout=5).stdout.strip()
    except (OSError, subprocess.SubprocessError):
        return False
    return bool(out) and not out.startswith("Z") and "sakha_speech" in out  # not a stranger who got the same pid


def _spawn(folder: Path) -> int:
    log = open(folder / "log.txt", "ab")
    child = subprocess.Popen(
        [sys.executable, "-m", "sakha_speech", "job", "run", str(folder / "spec.json")],
        stdin=subprocess.DEVNULL, stdout=log, stderr=subprocess.STDOUT, cwd=ROOT, start_new_session=True)
    log.close()
    _children[child.pid] = child
    (folder / "pid").write_text(str(child.pid))
    return child.pid


def _latest() -> Path | None:
    if not jobs_dir().exists():
        return None
    folders = sorted(p for p in jobs_dir().iterdir() if (p / "status.json").exists())
    return folders[-1] if folders else None


def current() -> dict | None:
    """The newest job's status. A job that says it is running but whose process is gone is marked so."""
    folder = _latest()
    status = read_json(folder / "status.json") if folder else None
    if status and status.get("state") in ACTIVE and not _worker_alive(folder, status):
        asked = (folder / "stop").exists()
        status = {**status, "state": "stopped" if asked else "interrupted", "finishedAt": time.time(), "current": None,
                  "eta": None, "finishAt": None,
                  "message": None if asked else "The job ended without finishing (the Mac slept, restarted or the "
                                                "process was killed). Start it again: what was made is kept."}
        write_json(folder / "status.json", status)
    return status


def snapshot(log_lines: int = 30) -> dict | None:
    """What the studio shows: the status, with `stopping` if a stop was asked, and the end of the log."""
    status = current()
    if not status:
        return None
    folder = job_dir(status["id"])
    if status["state"] == "running" and (folder / "stop").exists():
        status = {**status, "state": "stopping"}
    return {**status, "log": tail(folder / "log.txt", log_lines)}


def start(spec: dict, spawn=None) -> dict:
    status = current()
    if status and status["state"] in ACTIVE:
        raise JobBusy("a job is already running; stop it or wait for it to finish")
    job_id = time.strftime("%Y%m%d-%H%M%S")
    while job_dir(job_id).exists():
        job_id += "x"
    folder = job_dir(job_id)
    folder.mkdir(parents=True)
    spec = {**spec, "id": job_id}
    write_json(folder / "spec.json", spec)
    write_json(folder / "status.json", {
        "id": job_id, "type": spec["type"], "state": "starting", "startedAt": time.time(), "book": spec.get("book"),
        "languages": spec.get("languages"), "message": "Starting…"})
    (spawn or _spawn)(folder)
    return snapshot()


def stop(force: bool = False) -> dict | None:
    """Asks the running job to stop at the next piece of speech; with force, ends it now."""
    status = current()
    if not status or status["state"] not in ACTIVE:
        return snapshot()
    folder = job_dir(status["id"])
    (folder / "stop").write_text("stop")
    pid = _pid(folder)
    if force and pid and _worker_alive(folder, status):
        try:
            os.kill(pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        child = _children.get(pid)
        for _ in range(50):
            if child is not None:
                if child.poll() is not None:
                    break
            elif not _worker_alive(folder, status):
                break
            time.sleep(0.1)
    return snapshot()


def progress_line(status: dict) -> str:
    """One terminal line: the state, the chapter in hand, how far it has got, the verse being spoken and the time left."""
    state = status.get("state") or "?"
    if state not in ACTIVE:
        note = status.get("error") or status.get("message")
        return f"job {state}" + (f": {note}" if note else "")
    parts = []
    chapters = status.get("chapters") or []
    open_chapters = [c for c in chapters if c.get("done", 0) < c.get("wanted", 0)]
    if open_chapters:
        c = open_chapters[0]
        parts.append(f"{c.get('language', '')} chapter {c.get('chapter', '')} {c.get('name') or ''}".rstrip())
    if status.get("total"):
        parts.append(f"{sum(c.get('done', 0) for c in chapters)} of {status['total']} verses")
    current = status.get("current")
    if current:
        who = current.get("characterName") or current.get("character") or ""
        parts.append(f"now {current.get('verseId', '')} {who} ({current.get('voice', '')})")
    if status.get("eta"):
        parts.append(f"about {human(status['eta'])} left")
    if not parts and status.get("message"):
        parts.append(status["message"])
    return " · ".join([state, *parts])


def follow(poll: float = 1.0, tail_lines: int = 10) -> None:
    """`sakha-speech progress`: the newest job's last log lines, then its position and each new log line until it ends.
    Ctrl-C only stops watching; the job goes on in its own process."""
    status = current()
    if not status:
        print("No job has run yet. Start one in the studio or with `sakha-speech generate`.")
        return
    log = job_dir(status["id"]) / "log.txt"
    data = log.read_bytes() if log.exists() else b""
    offset = data.rfind(b"\n") + 1
    for line in data[:offset].decode("utf-8", "replace").splitlines()[-tail_lines:]:
        print(line)
    last = None
    ended = False
    try:
        while True:
            status = current() or status
            line = progress_line(status)
            if line != last:
                print(f"-- {line}", flush=True)
                last = line
            if log.exists():
                with log.open("rb") as f:
                    f.seek(offset)
                    chunk = f.read()
                end = chunk.rfind(b"\n") + 1
                if end:
                    print(chunk[:end].decode("utf-8", "replace"), end="", flush=True)
                    offset += end
            if ended:
                return
            # The worker writes its last log line just after its status, so read the log once more before stopping.
            ended = status["state"] not in ACTIVE
            time.sleep(poll)
    except KeyboardInterrupt:
        print("\nstopped watching; the job goes on in its own process", file=sys.stderr)
