#!/usr/bin/env bash
# Puts the Omnilingual recogniser (Hindi, Marathi, Sanskrit in Devanagari) inside
# the Android DEBUG build, so a test phone has it without the in-app download.
#
#   tool/fetch_auto_chant_model.sh
#
# It lands in android/app/src/debug/assets/auto_chant/, which is git-ignored and
# only part of debug builds — profile and release builds do not carry it, and a
# fresh clone without it builds and runs as before. The app copies it out of the
# APK into its own storage the first time auto-count needs it
# (MantraAccurateModel.adoptBundled).
#
# Sizes and SHA-256 come from lib/core/constants/auto_chant_config.dart, the same
# numbers the in-app download is held to; a file that does not match is deleted.
# AUTO_CHANT_MODEL_SOURCE replaces the folder it is fetched from (default: the
# public Hugging Face copy).
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG="$APP_DIR/lib/core/constants/auto_chant_config.dart"
DEST="$APP_DIR/android/app/src/debug/assets/auto_chant"
SOURCE="${AUTO_CHANT_MODEL_SOURCE:-https://huggingface.co/csukuangfj/sherpa-onnx-omnilingual-asr-1600-languages-300M-ctc-int8-2025-11-12/resolve/main}"

# One quoted value from the Dart config, by constant name.
setting() { sed -n "s/.*static const [A-Za-z]* $1 = '\\([^']*\\)'.*/\\1/p" "$CONFIG"; }

mkdir -p "$DEST"

fetch() {
  local name="$1" sha="$2"
  if [[ -f "$DEST/$name" ]] && [[ "$(shasum -a 256 "$DEST/$name" | cut -d' ' -f1)" == "$sha" ]]; then
    echo "$name: already here and intact"
    return
  fi
  echo "$name: downloading"
  curl -fL --retry 3 -C - -o "$DEST/$name" "$SOURCE/$name"
  if [[ "$(shasum -a 256 "$DEST/$name" | cut -d' ' -f1)" != "$sha" ]]; then
    rm -f "$DEST/$name"
    echo "$name: checksum does not match auto_chant_config.dart, removed" >&2
    exit 1
  fi
  echo "$name: ok"
}

fetch "$(setting accurateTokensFile)" "$(setting accurateTokensSha256)"
fetch "$(setting accurateModelFile)" "$(setting accurateModelSha256)"
echo "Done. Debug builds now carry the recogniser."
