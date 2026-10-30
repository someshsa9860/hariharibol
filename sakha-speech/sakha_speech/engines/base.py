"""What every engine does: say one short piece of text in one voice, as float samples."""

import os

import numpy as np

# Read by torch when it loads, so it has to be set before the first `import torch`. Lets the few operations
# the Apple GPU lacks run on the CPU instead of failing.
os.environ.setdefault("PYTORCH_ENABLE_MPS_FALLBACK", "1")


class EngineMissing(RuntimeError):
    """The engine's Python packages are not installed (./setup.sh installs them)."""


class Engine:
    name = "base"
    sample_rate = 24000
    # The longest piece of text the model says well in one go.
    max_chars = 220

    def synth(self, text: str, voice, attempt: int = 0) -> np.ndarray:
        """Mono float32 samples in [-1, 1] at self.sample_rate. `attempt` > 0 asks for a different take."""
        raise NotImplementedError


def pick_device() -> str:
    """SAKHA_DEVICE if set, else an NVIDIA GPU, else the Apple GPU, else the CPU."""
    wanted = (os.environ.get("SAKHA_DEVICE") or "").strip()
    if wanted:
        return wanted
    try:
        import torch
    except ImportError:
        return "cpu"
    if torch.cuda.is_available():
        return "cuda"
    if getattr(torch.backends, "mps", None) and torch.backends.mps.is_available():
        return "mps"
    return "cpu"
