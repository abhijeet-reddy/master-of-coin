#!/usr/bin/env bash
#
# One-command "preview PR #NN on the beta slot" helper (app-repo side).
#
# Triggers the beta-image workflow for a given branch (or PR number), waits for
# it to publish the `:beta` image, and prints the redeploy reminder. The actual
# container recreate happens on the home server (deploy repo's beta stack) and
# is intentionally NOT done here — this script only owns the app-repo half
# (build + push the beta image). It never touches production tags or the prod
# deploy webhook.
#
# Usage:
#   ./scripts/deploy-beta.sh <branch>
#   ./scripts/deploy-beta.sh 73          # a PR number — resolves to its branch
#
# Requires: gh (authenticated).

set -euo pipefail

command -v gh >/dev/null 2>&1 || { echo "Missing dependency: gh" >&2; exit 1; }

REF="${1:-}"
if [ -z "$REF" ]; then
  echo "Usage: $0 <branch|pr-number>" >&2
  exit 1
fi

# If REF is all digits, treat it as a PR number and resolve to its head branch.
if [[ "$REF" =~ ^[0-9]+$ ]]; then
  echo "Resolving PR #${REF} to its branch..."
  BRANCH=$(gh pr view "$REF" --json headRefName --jq '.headRefName')
  echo "PR #${REF} → ${BRANCH}"
else
  BRANCH="$REF"
fi

echo "Triggering beta-image build for branch '${BRANCH}'..."
gh workflow run beta-image.yml -f branch="${BRANCH}"

echo "Waiting a moment for the run to register..."
sleep 6

# Grab the most recent beta-image run id and watch it.
RUN_ID=$(gh run list --workflow=beta-image.yml --limit 1 --json databaseId --jq '.[0].databaseId')
echo "Watching run ${RUN_ID}..."
gh run watch "${RUN_ID}" --exit-status

echo ""
echo "✅ Beta image published: ghcr.io/<owner>/master-of-coin:beta (branch ${BRANCH})"
echo ""
echo "Next step (home server): recreate the beta stack so it pulls the new :beta image, e.g.:"
echo "    docker compose -p moc-beta pull && docker compose -p moc-beta up -d"
echo "(or redeploy the moc-beta stack in Portainer). The beta stack uses its own"
echo "throwaway seeded database — never production data."
