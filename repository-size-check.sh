#!/bin/bash

echo "Checking repository size (tracked files only)..."

if ! git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
    echo "Error: Not a git repository."
    exit 1
fi

TOTAL_SIZE=$(git ls-files -z | xargs -0 wc -c | awk 'END{print $1}')
TOTAL_MB=$(echo "scale=2; $TOTAL_SIZE/1024/1024" | bc)

echo "Total tracked size: ${TOTAL_MB} MB"

echo ""
echo "Largest tracked files:"
if git rev-parse --verify HEAD > /dev/null 2>&1; then
  git ls-tree -r -t -l HEAD | sort -rn -k 4 | head -n 10 | awk '{printf "%.2f MB\t%s\n", $4/1024/1024, $5}'
else
  echo "No commit yet; skipping largest-file listing."
fi

echo ""
if (( $(echo "$TOTAL_MB >= 10.0" | bc -l) )); then
    echo "ERROR: Repository exceeds 10 MB limit!"
    exit 1
elif (( $(echo "$TOTAL_MB >= 8.0" | bc -l) )); then
    echo "WARNING: Repository is approaching 10 MB limit (${TOTAL_MB} MB)."
else
    echo "SUCCESS: Repository size is well under the limit."
fi
