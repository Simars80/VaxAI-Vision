#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# setup-branch-protection.sh
# Run this once from a machine with `gh` CLI authenticated.
# Sets up branch protection on `main` so broken code never reaches production.
# ──────────────────────────────────────────────────────────────────────────────

set -euo pipefail

REPO="Simars80/VaxAI-Vision"
BRANCH="main"

echo "Setting up branch protection for $REPO/$BRANCH..."

# Use GitHub API directly for full control over rulesets
gh api \
  --method PUT \
  "repos/$REPO/branches/$BRANCH/protection" \
  --input - <<'EOF'
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["CI Gate"]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "required_approving_review_count": 0,
    "dismiss_stale_reviews": false
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
EOF

echo ""
echo "✅ Branch protection enabled on $BRANCH"
echo ""
echo "Rules now in effect:"
echo "  • PRs required to merge into main"
echo "  • CI Gate check must pass before merge"
echo "  • Force pushes blocked"
echo "  • Branch deletion blocked"
echo ""
echo "Note: 'enforce_admins' is false so you can still bypass in emergencies."
echo "To enforce for everyone, re-run with enforce_admins: true."
