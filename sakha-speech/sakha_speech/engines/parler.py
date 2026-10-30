"""Indic Parler-TTS (ai4bharat/indic-parler-tts, Apache-2.0): the most natural open voices for Indian
languages, and Indian-accented English. About 0.9B parameters: fine on a GPU or an Apple Silicon Mac,
slow on a plain CPU.

The model is gated: accept its terms at https://huggingface.co/ai4bharat/indic-parler-tts and run
`hf auth login` once. The voice is set by a written description naming the speaker; a fixed seed
keeps the same voice from sentence to sentence."""

import numpy as np

from .base import Engine, EngineMissing


class ParlerEngine(Engine):
    name = "parler"
    max_chars = 200

    def __init__(self, model_id: str, device: str):
        try:
            import torch
            from parler_tts import ParlerTTSForConditionalGeneration
            from transformers import AutoTokenizer
        except ImportError as e:
            raise EngineMissing("Parler-TTS is not installed; run ./setup.sh") from e
        self.torch = torch
        self.device = device
        try:
            self.model = ParlerTTSForConditionalGeneration.from_pretrained(model_id).to(device).eval()
            self.tokenizer = AutoTokenizer.from_pretrained(model_id)
            self.description_tokenizer = AutoTokenizer.from_pretrained(self.model.config.text_encoder._name_or_path)
        except OSError as e:
            if "gated" in str(e).lower() or "401" in str(e) or "403" in str(e):
                raise EngineMissing(
                    f"{model_id} is gated: accept its terms on huggingface.co, then run `hf auth login`"
                ) from e
            raise
        self.sample_rate = int(self.model.config.sampling_rate)
        self._descriptions = {}

    def _description(self, text: str):
        if text not in self._descriptions:
            self._descriptions[text] = self.description_tokenizer(text, return_tensors="pt").to(self.device)
        return self._descriptions[text]

    def synth(self, text: str, voice, attempt: int = 0) -> np.ndarray:
        s = voice.settings
        description = self._description(" ".join(str(s["description"]).split()))
        prompt = self.tokenizer(text, return_tensors="pt").to(self.device)
        # Same seed, same voice. A retry moves to the next seed for a different take.
        self.torch.manual_seed(int(s.get("seed", 0)) + attempt)
        with self.torch.inference_mode():
            audio = self.model.generate(
                input_ids=description.input_ids,
                attention_mask=description.attention_mask,
                prompt_input_ids=prompt.input_ids,
                prompt_attention_mask=prompt.attention_mask,
            )
        # A very short piece ("हरि बोल!") can come back as one sample; squeeze() would make that 0-dimensional.
        # Kept 1-D, the silence check fails it and speak() retries it with another seed.
        return np.atleast_1d(audio.to(self.torch.float32).cpu().numpy().squeeze().astype(np.float32))
