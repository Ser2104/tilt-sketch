#!/usr/bin/env bash
# Posts the bots' report: the job summary, one pinned "Playtest bots" issue kept up to date,
# and a comment (which notifies the owner) whenever there are high or critical findings.
set -u
dir=${OUT:-playtest-out}
[ -f "$dir/report.md" ] || { echo "No report was written." > "$dir/report.md"; echo '{"counts":{"critical":1,"high":0}}' > "$dir/summary.json"; }
cat "$dir/report.md" >> "$GITHUB_STEP_SUMMARY"
body="$(cat "$dir/report.md")

Screenshots and full data: $RUN_URL (artifact \`playtest-*\`). This issue is updated by the playtest bots every 6 hours."
gh label create playtest --color 5319E7 --description "Feedback from the playtest bots" 2>/dev/null || true
num=$(gh issue list --label playtest --state open --json number --jq '.[0].number' 2>/dev/null)
if [ -z "$num" ]; then
  gh issue create --title "🤖 Playtest bots: latest report" --label playtest --body "$body"
else
  gh issue edit "$num" --body "$body"
  serious=$(python -c "import json;c=json.load(open('$dir/summary.json'))['counts'];print(c.get('critical',0)+c.get('high',0))")
  if [ "$serious" != "0" ]; then
    python - "$dir/summary.json" > /tmp/comment.md <<'PY'
import json, sys
s = json.load(open(sys.argv[1]))
bad = [f for f in s["findings"] if f["severity"] in ("critical", "high")]
print(f"**{len(bad)} serious problem(s) found in this run:**\n")
for f in bad[:15]:
    print(f"- **{f['severity']}** · {f['area']}: {f['message']}")
PY
    echo "" >> /tmp/comment.md; echo "Run: $RUN_URL" >> /tmp/comment.md
    gh issue comment "$num" --body-file /tmp/comment.md
  fi
fi
