#!/usr/bin/env bash
#
# Point the project's apex domain (and www) at GitHub Pages. Companion to
# setupMail.sh: the same account-level hosted zone, deliberately outside the
# per-stage SST app in infra/ (see docs/DESIGN.md D39/D103).
#
# GitHub Pages on an apex domain needs A (and optionally AAAA) records to
# GitHub's anycast addresses -- Route 53 cannot ALIAS to an external host --
# plus a www CNAME to the user's github.io host so GitHub can redirect between
# the two. A and AAAA coexist with the SES MX record at the apex: different
# record types, no conflict. The custom domain itself is set in the repo's
# Settings > Pages (an Actions-based deploy ignores any CNAME file), and
# GitHub provisions the Let's Encrypt certificate after its DNS check passes,
# which is why the script refuses to run if a CAA record excludes letsencrypt.
#
# Idempotent: every record is an UPSERT. Re-run freely.
#
# Usage:
#   bash scripts/setupSiteDns.sh --domain techtokapp.eu --pages-host tormozz48.github.io

set -euo pipefail

DOMAIN=""
PAGES_HOST=""
GITHUB_PAGES_A=("185.199.108.153" "185.199.109.153" "185.199.110.153" "185.199.111.153")
GITHUB_PAGES_AAAA=("2606:50c0:8000::153" "2606:50c0:8001::153" "2606:50c0:8002::153" "2606:50c0:8003::153")

while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain) DOMAIN="$2"; shift 2 ;;
    --pages-host) PAGES_HOST="$2"; shift 2 ;;
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done

if [[ -z "$DOMAIN" || -z "$PAGES_HOST" ]]; then
  echo "Usage: $0 --domain <domain> --pages-host <user>.github.io" >&2
  exit 1
fi

for tool in aws jq; do
  command -v "$tool" >/dev/null || { echo "Required tool not found: $tool" >&2; exit 1; }
done

ZONE_ID="$(aws route53 list-hosted-zones \
  --query "HostedZones[?Name=='${DOMAIN}.'].Id | [0]" --output text | sed 's|/hostedzone/||')"
if [[ -z "$ZONE_ID" || "$ZONE_ID" == "None" ]]; then
  echo "No public Route 53 hosted zone found for ${DOMAIN}" >&2
  exit 1
fi

# A CAA record that does not permit letsencrypt.org would block GitHub's cert.
CAA="$(aws route53 list-resource-record-sets --hosted-zone-id "$ZONE_ID" \
  --query "ResourceRecordSets[?Name=='${DOMAIN}.' && Type=='CAA'].ResourceRecords[].Value" --output json)"
if [[ "$CAA" != "[]" ]] && ! grep -q 'letsencrypt.org' <<<"$CAA"; then
  echo "Apex CAA ${CAA} does not allow letsencrypt.org; GitHub Pages HTTPS would fail. Fix CAA first." >&2
  exit 1
fi

# Refuse to silently replace an apex A/AAAA that points somewhere else.
for type in A AAAA; do
  EXISTING="$(aws route53 list-resource-record-sets --hosted-zone-id "$ZONE_ID" \
    --query "ResourceRecordSets[?Name=='${DOMAIN}.' && Type=='${type}'].ResourceRecords[].Value" \
    --output json | jq -c 'sort')"
  if [[ "$type" == "A" ]]; then WANT="$(printf '%s\n' "${GITHUB_PAGES_A[@]}" | jq -R . | jq -sc 'sort')"; fi
  if [[ "$type" == "AAAA" ]]; then WANT="$(printf '%s\n' "${GITHUB_PAGES_AAAA[@]}" | jq -R . | jq -sc 'sort')"; fi
  if [[ "$EXISTING" != "[]" && "$EXISTING" != "$WANT" ]]; then
    echo "Apex ${type} already set to ${EXISTING}; refusing to overwrite. Remove it first." >&2
    exit 1
  fi
done

CHANGE_BATCH="$(jq -n \
  --arg domain "$DOMAIN" --arg pagesHost "$PAGES_HOST" \
  --argjson a "$(printf '%s\n' "${GITHUB_PAGES_A[@]}" | jq -R . | jq -s .)" \
  --argjson aaaa "$(printf '%s\n' "${GITHUB_PAGES_AAAA[@]}" | jq -R . | jq -s .)" \
  '{
    Comment: "techtok site: GitHub Pages apex + www",
    Changes: [
      {Action: "UPSERT", ResourceRecordSet: {Name: ($domain + "."), Type: "A", TTL: 300, ResourceRecords: ($a | map({Value: .}))}},
      {Action: "UPSERT", ResourceRecordSet: {Name: ($domain + "."), Type: "AAAA", TTL: 300, ResourceRecords: ($aaaa | map({Value: .}))}},
      {Action: "UPSERT", ResourceRecordSet: {Name: ("www." + $domain + "."), Type: "CNAME", TTL: 300, ResourceRecords: [{Value: $pagesHost}]}}
    ]
  }')"

aws route53 change-resource-record-sets --hosted-zone-id "$ZONE_ID" --change-batch "$CHANGE_BATCH" >/dev/null

cat <<EOF
Published for ${DOMAIN} (zone ${ZONE_ID}):
  A      ${GITHUB_PAGES_A[*]}
  AAAA   ${GITHUB_PAGES_AAAA[*]}
  CNAME  www.${DOMAIN} -> ${PAGES_HOST}

Next, in the GitHub repo: Settings > Pages > Custom domain = ${DOMAIN}, wait for
the DNS check, then tick "Enforce HTTPS" once the certificate is issued (up to
~1 h). Merge the astro.config.ts change (site/base) at the same time: the old
build's asset URLs live under /techtok/ and 404 at the domain root.
EOF
