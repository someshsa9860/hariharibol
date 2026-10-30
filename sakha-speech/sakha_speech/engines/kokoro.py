"""Kokoro-82M (hexgrad/Kokoro-82M, Apache-2.0): small, fast and natural; English, and Hindi through espeak-ng.

One model is loaded and shared by a pipeline per language letter (a, b, h, ...)."""

import numpy as np

from .base import Engine, EngineMissing

REPO = "hexgrad/Kokoro-82M"


class KokoroEngine(Engine):
    name = "kokoro"
    sample_rate = 24000
    max_chars = 300

    def __init__(self, device: str):
        try:
            from kokoro import KModel, KPipeline
        except ImportError as e:
            raise EngineMissing("Kokoro is not installed; run ./setup.sh") from e
        self._KPipeline = KPipeline
        self.device = device
        self.model = KModel(repo_id=REPO).to(device).eval()
        self.pipelines = {}

    def _pipeline(self, lang_code: str):
        if lang_code not in self.pipelines:
            self.pipelines[lang_code] = self._KPipeline(lang_code=lang_code, repo_id=REPO, model=self.model)
        return self.pipelines[lang_code]

    def synth(self, text: str, voice, attempt: int = 0) -> np.ndarray:
        s = voice.settings
        pipeline = self._pipeline(s.get("lang_code") or s["voice"][0])
        # Kokoro is deterministic, so a retry cannot ask for a different take; it is said the same way.
        chunks = [
            r.audio.detach().cpu().numpy()
            for r in pipeline(text, voice=s["voice"], speed=float(s.get("speed", 1.0)), split_pattern=None)
            if r.audio is not None
        ]
        if not chunks:
            return np.zeros(0, dtype=np.float32)
        return np.concatenate(chunks).astype(np.float32)
