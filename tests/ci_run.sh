#!/usr/bin/env bash
# Runs one browser test and, if it fails, surfaces its last lines as a GitHub annotation.
out=$(mktemp)
python "$1" 2>&1 | tee "$out"
st=${PIPESTATUS[0]}
if [ "$st" -ne 0 ]; then echo "::error title=$1 failed::$(grep -v '^ ' "$out" | tail -8 | tr '\n' ' ' | cut -c1-900)"; fi
exit "$st"
