"""A stand-in engine for the tests: a soft tone as long as the text would take to say. No models."""

import numpy as np

from .base import Engine


class FakeEngine(Engine):
    name = "fake"
    sample_rate = 24000
    max_chars = 120

    def synth(self, text: str, voice, attempt: int = 0) -> np.ndarray:
        if voice.settings.get("silent"):
            return np.zeros(self.sample_rate, dtype=np.float32)
        seconds = max(0.3, len(text) * 0.06)
        t = np.arange(int(seconds * self.sample_rate)) / self.sample_rate
        return (0.3 * np.sin(2 * np.pi * (180 + 20 * attempt) * t)).astype(np.float32)
