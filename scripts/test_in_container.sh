#!/usr/bin/env bash
# Copies the repo (mounted read-only at /src) to a scratch dir, installs the
# pinned Playwright, and runs the host test suite.
set -euo pipefail
mkdir -p /work
cd /src
tar --exclude=./node_modules --exclude=./build --exclude=./dist --exclude=./.git -cf - . | tar -xf - -C /work
cd /work
npm ci --silent --no-audit --no-fund
REQUIRE_E2E=1 bash tests/run_tests.sh
