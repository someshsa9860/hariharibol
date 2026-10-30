"""One engine per kind of model. An engine is loaded once and speaks for every voice that uses it."""

from ..config import Voice
from .base import Engine, pick_device

_loaded: dict[str, Engine] = {}


def engine_for(voice: Voice) -> Engine:
    key = f"{voice.engine}:{voice.settings.get('model', '')}"
    if key not in _loaded:
        if voice.engine == "kokoro":
            from .kokoro import KokoroEngine
            _loaded[key] = KokoroEngine(pick_device())
        elif voice.engine == "parler":
            from .parler import ParlerEngine
            _loaded[key] = ParlerEngine(voice.settings.get("model") or "ai4bharat/indic-parler-tts", pick_device())
        elif voice.engine == "fake":
            from .fake import FakeEngine
            _loaded[key] = FakeEngine()
        else:
            raise ValueError(f"unknown engine {voice.engine!r}")
    return _loaded[key]


__all__ = ["Engine", "engine_for", "pick_device"]
