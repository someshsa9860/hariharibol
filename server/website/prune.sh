#!/usr/bin/env bash
# Convenience wrapper — runs the shared prune from the website folder.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "${SCRIPT_DIR}/../prune.sh"
