#!/bin/bash
# Codex compatibility installer (secondary path).
# Usage: ./scripts/install-codex.sh [target-directory]

set -euo pipefail

TARGET_DIR="${1:-.}"
SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

mkdir -p "$TARGET_DIR/.agents/skills" "$TARGET_DIR/.codex/agents"
cp -R "$SCRIPT_DIR/plugin/skills/." "$TARGET_DIR/.agents/skills/"
cp -R "$SCRIPT_DIR/plugin/codex/agents/." "$TARGET_DIR/.codex/agents/"

echo "Installed skills to $TARGET_DIR/.agents/skills"
echo "Installed Codex agents to $TARGET_DIR/.codex/agents"
echo "This is the Codex compatibility path. The primary onboarding flow is the Claude plugin."
echo "Rerun this script after updating plugin/skills or plugin/codex/agents."
