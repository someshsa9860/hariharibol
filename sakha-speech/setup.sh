#!/usr/bin/env bash
# One-time setup on a Mac (Apple Silicon or Intel) or Linux.
#   ./setup.sh            everything, speech models included
#   ./setup.sh --no-engines   only what the tests need (no torch)
# Safe to run again.
set -euo pipefail
cd "$(dirname "$0")"

ENGINES=1
[[ "${1:-}" == "--no-engines" ]] && ENGINES=0

say() { printf '\n==> %s\n' "$1"; }

# ffmpeg turns the audio into evenly loud MP3s.
if ! command -v ffmpeg >/dev/null 2>&1; then
  if command -v brew >/dev/null 2>&1; then
    say "Installing ffmpeg with Homebrew"
    brew install ffmpeg
  elif command -v apt-get >/dev/null 2>&1; then
    say "Installing ffmpeg with apt"
    sudo apt-get update && sudo apt-get install -y ffmpeg
  else
    echo "Please install ffmpeg (https://ffmpeg.org) and run this again." >&2
    exit 1
  fi
fi

# uv makes the Python environment and downloads Python 3.11 itself, so the Mac's own Python does not matter.
if ! command -v uv >/dev/null 2>&1; then
  say "Installing uv"
  curl -LsSf https://astral.sh/uv/install.sh | sh
  export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"
fi

say "Making the Python 3.11 environment in .venv"
uv venv --python 3.11 .venv
if [[ $ENGINES == 1 ]]; then
  uv pip install --python .venv -e ".[engines,dev]"
else
  uv pip install --python .venv -e ".[dev]"
fi

[[ -f .env ]] || { cp .env.example .env; say "Made .env from .env.example: put the AWS keys in it before uploading"; }

say "Done"
cat <<'TXT'
Next:
  source .venv/bin/activate
  hf auth login                         # once; first accept the terms at
                                        # https://huggingface.co/ai4bharat/indic-parler-tts
  sakha-speech voices
  sakha-speech sample --lang en         # the voice test, then open work/samples/index.html
  sakha-speech sample --lang hi
TXT
