#!/usr/bin/env bash
#
# Provision the SES inbound -> S3 -> Lambda -> Gmail forwarding pipeline for the
# project's custom domain, plus the DNS records that make the domain deliverable.
#
# These are account-level resources shared by every stage (one domain, one mail
# pipeline), so they deliberately live outside the per-stage SST app in
# infra/ -- an `sst remove` on a stage must never take the project's mailbox
# with it. See docs/DESIGN.md for the decision record.
#
# The script is idempotent: re-running it reconciles existing resources rather
# than failing. The MX record is published LAST, only once the domain identity
# is verified and the receipt rule set is active, because SES drops -- and never
# replays -- anything that arrives before both are true. If verification is still
# pending at the end, the script exits 2 without publishing MX; re-run it later.
#
# It does NOT create the SMTP IAM user or its access key; that credential is
# minted once in the console by the maintainer (see README).
#
# Usage:
#   bash scripts/setupMail.sh --domain techtokapp.eu --forward-to you@gmail.com [--yes]

set -euo pipefail

REGION="eu-central-1"
DOMAIN=""
FORWARD_TO=""
RECIPIENTS="privacy,support,noreply"
ASSUME_YES="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain) DOMAIN="$2"; shift 2 ;;
    --forward-to) FORWARD_TO="$2"; shift 2 ;;
    --recipients) RECIPIENTS="$2"; shift 2 ;;
    --region) REGION="$2"; shift 2 ;;
    --yes) ASSUME_YES="true"; shift ;;
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done

if [[ -z "$DOMAIN" || -z "$FORWARD_TO" ]]; then
  echo "Usage: $0 --domain <domain> --forward-to <address> [--recipients a,b] [--yes]" >&2
  exit 1
fi

# --- Preflight: fail before any AWS mutation -----------------------------------

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
for f in "${SCRIPT_DIR}/mail/forwarder.mjs" "${SCRIPT_DIR}/mail/rewrite.mjs"; do
  [[ -f "$f" ]] || { echo "Missing Lambda source: $f" >&2; exit 1; }
done
for tool in aws jq zip; do
  command -v "$tool" >/dev/null || { echo "Required tool not found: $tool" >&2; exit 1; }
done

ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
BUCKET="techtok-mail-inbound-${ACCOUNT_ID}"
OBJECT_PREFIX="inbound/"
FUNCTION_NAME="techtok-mail-forwarder"
ROLE_NAME="techtok-mail-forwarder-role"
RULE_SET_NAME="techtok-inbound"
RULE_NAME="forward-to-gmail"
FALLBACK_FROM="postmaster@${DOMAIN}"
MX_VALUE="10 inbound-smtp.${REGION}.amazonaws.com"
SPF_VALUE='"v=spf1 include:amazonses.com ~all"'
DMARC_VALUE='"v=DMARC1; p=none"'
RECEIPT_RULE_ARN="arn:aws:ses:${REGION}:${ACCOUNT_ID}:receipt-rule-set/${RULE_SET_NAME}:receipt-rule/${RULE_NAME}"

ZONE_ID="$(aws route53 list-hosted-zones \
  --query "HostedZones[?Name=='${DOMAIN}.'].Id | [0]" --output text | sed 's|/hostedzone/||')"

if [[ -z "$ZONE_ID" || "$ZONE_ID" == "None" ]]; then
  echo "No public Route 53 hosted zone found for ${DOMAIN}" >&2
  exit 1
fi

# Refuse to silently replace someone else's MX. Ours-or-empty is the only safe state.
EXISTING_MX="$(aws route53 list-resource-record-sets --hosted-zone-id "$ZONE_ID" \
  --query "ResourceRecordSets[?Name=='${DOMAIN}.' && Type=='MX'].ResourceRecords[].Value" \
  --output json | jq -c 'sort')"
if [[ "$EXISTING_MX" != "[]" && "$EXISTING_MX" != "[\"${MX_VALUE}\"]" ]]; then
  echo "Apex MX already set to ${EXISTING_MX}; refusing to overwrite. Remove it first." >&2
  exit 1
fi

cat <<EOF
Account         ${ACCOUNT_ID}
Region          ${REGION}
Domain          ${DOMAIN}  (hosted zone ${ZONE_ID})
Recipients      ${RECIPIENTS} (@${DOMAIN})
Forward to      ${FORWARD_TO}
S3 bucket       ${BUCKET}
Lambda          ${FUNCTION_NAME}
Receipt ruleset ${RULE_SET_NAME}

This publishes SPF/DKIM/DMARC for ${DOMAIN} now, and MX (routing all mail for
the domain to SES) at the very end, once the pipeline is live.
EOF

if [[ "$ASSUME_YES" != "true" ]]; then
  read -r -p "Proceed? [y/N] " reply
  [[ "$reply" == "y" || "$reply" == "Y" ]] || { echo "Aborted."; exit 1; }
fi

step() { printf '\n==> %s\n' "$1"; }

# Rollback artifact and diff baseline for the apex-TXT merge below.
SNAPSHOT="${HOME}/zone-before-${DOMAIN}.json"
aws route53 list-resource-record-sets --hosted-zone-id "$ZONE_ID" --output json > "$SNAPSHOT"
echo "Zone snapshot written to ${SNAPSHOT}"

# --- 1. SES identities and Easy DKIM -----------------------------------------

step "SES domain identity + Easy DKIM"
if ! aws sesv2 get-email-identity --region "$REGION" --email-identity "$DOMAIN" >/dev/null 2>&1; then
  aws sesv2 create-email-identity --region "$REGION" --email-identity "$DOMAIN" \
    --dkim-signing-attributes NextSigningKeyLength=RSA_2048_BIT >/dev/null
fi

# The forward-to address must itself be a verified identity while the account is
# still in the SES sandbox, or the forwarding send is rejected.
if ! aws sesv2 get-email-identity --region "$REGION" --email-identity "$FORWARD_TO" >/dev/null 2>&1; then
  aws sesv2 create-email-identity --region "$REGION" --email-identity "$FORWARD_TO" >/dev/null
  echo "Verification mail sent to ${FORWARD_TO} -- confirm it before testing."
fi

DKIM_TOKENS_JSON="$(aws sesv2 get-email-identity --region "$REGION" --email-identity "$DOMAIN" \
  --query 'DkimAttributes.Tokens' --output json)"

# --- 2. DNS records, minus MX --------------------------------------------------

step "Route 53 records (SPF, DMARC, DKIM) -- MX deferred to the end"

# The apex TXT record set is shared with domain-ownership proofs (Google Search
# Console verification, needed for the OAuth consent screen). Route 53 returns
# TXT values already wrapped in their literal quotes, so they are carried through
# verbatim via jq -- never re-escaped -- and only the SPF string is replaced.
APEX_TXT_BEFORE="$(aws route53 list-resource-record-sets --hosted-zone-id "$ZONE_ID" \
  --query "ResourceRecordSets[?Name=='${DOMAIN}.' && Type=='TXT'].ResourceRecords[].Value" \
  --output json)"
APEX_TXT_RECORDS="$(jq -c --arg spf "$SPF_VALUE" \
  '[ $spf ] + [ .[] | select(test("v=spf1") | not) ] | map({Value: .})' <<<"$APEX_TXT_BEFORE")"
NON_SPF_BEFORE="$(jq '[ .[] | select(test("v=spf1") | not) ] | length' <<<"$APEX_TXT_BEFORE")"

CHANGE_BATCH="$(jq -n \
  --arg domain "$DOMAIN" \
  --arg dmarc "$DMARC_VALUE" \
  --argjson apexTxt "$APEX_TXT_RECORDS" \
  --argjson dkim "$DKIM_TOKENS_JSON" \
  '{
    Comment: "techtok mail: SPF, DMARC, DKIM",
    Changes: (
      [
        {Action: "UPSERT", ResourceRecordSet: {Name: ($domain + "."), Type: "TXT", TTL: 300, ResourceRecords: $apexTxt}},
        {Action: "UPSERT", ResourceRecordSet: {Name: ("_dmarc." + $domain + "."), Type: "TXT", TTL: 300, ResourceRecords: [{Value: $dmarc}]}}
      ]
      + [ $dkim[] | {Action: "UPSERT", ResourceRecordSet: {Name: (. + "._domainkey." + $domain + "."), Type: "CNAME", TTL: 300, ResourceRecords: [{Value: (. + ".dkim.amazonses.com")}]}} ]
    )
  }')"

aws route53 change-resource-record-sets --hosted-zone-id "$ZONE_ID" --change-batch "$CHANGE_BATCH" >/dev/null

NON_SPF_AFTER="$(aws route53 list-resource-record-sets --hosted-zone-id "$ZONE_ID" \
  --query "ResourceRecordSets[?Name=='${DOMAIN}.' && Type=='TXT'].ResourceRecords[].Value" \
  --output json | jq '[ .[] | select(test("v=spf1") | not) ] | length')"
if [[ "$NON_SPF_BEFORE" != "$NON_SPF_AFTER" ]]; then
  echo "Apex TXT merge lost values (${NON_SPF_BEFORE} -> ${NON_SPF_AFTER}); restore from ${SNAPSHOT}" >&2
  exit 1
fi
echo "Apex TXT: SPF set, ${NON_SPF_AFTER} pre-existing value(s) preserved"

# --- 3. S3 bucket for raw inbound MIME ---------------------------------------

step "S3 bucket ${BUCKET}"
if HEAD_OUT="$(aws s3api head-bucket --bucket "$BUCKET" 2>&1)"; then
  echo "Bucket exists"
elif grep -q '(404)' <<<"$HEAD_OUT"; then
  aws s3api create-bucket --bucket "$BUCKET" --region "$REGION" \
    --create-bucket-configuration "LocationConstraint=${REGION}" >/dev/null
else
  # 403 means the name is taken by another account; creating would fail mid-run.
  echo "head-bucket failed for ${BUCKET}: ${HEAD_OUT}" >&2
  exit 1
fi

aws s3api put-public-access-block --bucket "$BUCKET" \
  --public-access-block-configuration \
  "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

aws s3api put-bucket-lifecycle-configuration --bucket "$BUCKET" \
  --lifecycle-configuration "{\"Rules\":[{\"ID\":\"expire-inbound\",\"Status\":\"Enabled\",\"Filter\":{\"Prefix\":\"${OBJECT_PREFIX}\"},\"Expiration\":{\"Days\":30}}]}"

# Must exist before the receipt rule: CreateReceiptRule validates write access.
aws s3api put-bucket-policy --bucket "$BUCKET" --policy "$(jq -n \
  --arg bucket "$BUCKET" --arg prefix "$OBJECT_PREFIX" --arg account "$ACCOUNT_ID" --arg region "$REGION" \
  '{
    Version: "2012-10-17",
    Statement: [{
      Sid: "AllowSESPuts",
      Effect: "Allow",
      Principal: {Service: "ses.amazonaws.com"},
      Action: "s3:PutObject",
      Resource: ("arn:aws:s3:::" + $bucket + "/" + $prefix + "*"),
      Condition: {
        StringEquals: {"aws:SourceAccount": $account},
        StringLike: {"aws:SourceArn": ("arn:aws:ses:" + $region + ":" + $account + ":receipt-rule-set/*")}
      }
    }]
  }')"

# --- 4. Lambda execution role and function -----------------------------------

step "Lambda execution role ${ROLE_NAME}"
if ! aws iam get-role --role-name "$ROLE_NAME" >/dev/null 2>&1; then
  aws iam create-role --role-name "$ROLE_NAME" \
    --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}' >/dev/null
  aws iam wait role-exists --role-name "$ROLE_NAME"
fi

aws iam attach-role-policy --role-name "$ROLE_NAME" \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

aws iam put-role-policy --role-name "$ROLE_NAME" --policy-name "forward-inbound-mail" \
  --policy-document "$(jq -n --arg bucket "$BUCKET" --arg prefix "$OBJECT_PREFIX" --arg domain "$DOMAIN" \
  '{
    Version: "2012-10-17",
    Statement: [
      {Effect: "Allow", Action: "s3:GetObject", Resource: ("arn:aws:s3:::" + $bucket + "/" + $prefix + "*")},
      {Effect: "Allow", Action: ["ses:SendRawEmail"], Resource: "*",
       Condition: {StringLike: {"ses:FromAddress": ("*@" + $domain)}}}
    ]
  }')"

step "Lambda function ${FUNCTION_NAME}"
BUILD_DIR="$(mktemp -d)"
trap 'rm -rf "$BUILD_DIR"' EXIT
cp "${SCRIPT_DIR}/mail/forwarder.mjs" "${SCRIPT_DIR}/mail/rewrite.mjs" "$BUILD_DIR/"
(cd "$BUILD_DIR" && zip -q -r function.zip forwarder.mjs rewrite.mjs)

ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${ROLE_NAME}"
ENV_VARS="Variables={MAIL_BUCKET=${BUCKET},MAIL_OBJECT_PREFIX=${OBJECT_PREFIX},MAIL_FORWARD_TO=${FORWARD_TO},MAIL_DOMAIN=${DOMAIN},MAIL_FALLBACK_FROM=${FALLBACK_FROM}}"

if aws lambda get-function --region "$REGION" --function-name "$FUNCTION_NAME" >/dev/null 2>&1; then
  aws lambda update-function-code --region "$REGION" --function-name "$FUNCTION_NAME" \
    --zip-file "fileb://${BUILD_DIR}/function.zip" >/dev/null
  aws lambda wait function-updated --region "$REGION" --function-name "$FUNCTION_NAME"
  aws lambda update-function-configuration --region "$REGION" --function-name "$FUNCTION_NAME" \
    --environment "$ENV_VARS" --timeout 30 --memory-size 256 >/dev/null
else
  # A freshly created role is not assumable by Lambda for a few seconds; retry
  # only that specific error so a first run is reliable.
  for attempt in $(seq 1 12); do
    if CREATE_OUT="$(aws lambda create-function --region "$REGION" --function-name "$FUNCTION_NAME" \
      --runtime nodejs22.x --handler forwarder.handler --role "$ROLE_ARN" \
      --zip-file "fileb://${BUILD_DIR}/function.zip" \
      --environment "$ENV_VARS" --timeout 30 --memory-size 256 \
      --tags "app=techtok-mail,stage=shared" 2>&1)"; then
      break
    fi
    if grep -q 'cannot be assumed by Lambda' <<<"$CREATE_OUT" && [[ "$attempt" -lt 12 ]]; then
      echo "Role not yet assumable (attempt ${attempt}); retrying in 5s"
      sleep 5
      continue
    fi
    echo "$CREATE_OUT" >&2
    exit 1
  done
fi
aws lambda wait function-updated --region "$REGION" --function-name "$FUNCTION_NAME"

aws lambda remove-permission --region "$REGION" --function-name "$FUNCTION_NAME" \
  --statement-id AllowSESInvoke >/dev/null 2>&1 || true
aws lambda add-permission --region "$REGION" --function-name "$FUNCTION_NAME" \
  --statement-id AllowSESInvoke --action lambda:InvokeFunction \
  --principal ses.amazonaws.com --source-account "$ACCOUNT_ID" \
  --source-arn "$RECEIPT_RULE_ARN" >/dev/null

# --- 5. SES receipt rule set --------------------------------------------------

step "SES receipt rule set ${RULE_SET_NAME}"
if ! aws ses describe-receipt-rule-set --region "$REGION" --rule-set-name "$RULE_SET_NAME" >/dev/null 2>&1; then
  aws ses create-receipt-rule-set --region "$REGION" --rule-set-name "$RULE_SET_NAME"
fi

LAMBDA_ARN="arn:aws:lambda:${REGION}:${ACCOUNT_ID}:function:${FUNCTION_NAME}"
RULE_JSON="$(jq -n \
  --arg name "$RULE_NAME" --arg recipients "$RECIPIENTS" --arg domain "$DOMAIN" \
  --arg bucket "$BUCKET" --arg prefix "$OBJECT_PREFIX" --arg lambda "$LAMBDA_ARN" \
  '{
    Name: $name,
    Enabled: true,
    TlsPolicy: "Optional",
    ScanEnabled: true,
    Recipients: ($recipients | split(",") | map(. + "@" + $domain)),
    Actions: [
      {S3Action: {BucketName: $bucket, ObjectKeyPrefix: $prefix}},
      {LambdaAction: {FunctionArn: $lambda, InvocationType: "Event"}}
    ]
  }')"

if aws ses describe-receipt-rule --region "$REGION" --rule-set-name "$RULE_SET_NAME" \
  --rule-name "$RULE_NAME" >/dev/null 2>&1; then
  aws ses update-receipt-rule --region "$REGION" --rule-set-name "$RULE_SET_NAME" --rule "$RULE_JSON"
else
  aws ses create-receipt-rule --region "$REGION" --rule-set-name "$RULE_SET_NAME" --rule "$RULE_JSON"
fi

# Activation is a per-region singleton; say what it displaces so it is auditable.
PREVIOUS_ACTIVE="$(aws ses describe-active-receipt-rule-set --region "$REGION" \
  --query 'Metadata.Name' --output text 2>/dev/null || echo "None")"
if [[ "$PREVIOUS_ACTIVE" != "$RULE_SET_NAME" ]]; then
  echo "Activating ${RULE_SET_NAME} (previously active: ${PREVIOUS_ACTIVE})"
  aws ses set-active-receipt-rule-set --region "$REGION" --rule-set-name "$RULE_SET_NAME"
fi

# --- 6. Wait for identity verification, then publish MX -----------------------

step "Waiting for ${DOMAIN} identity verification (DKIM CNAMEs)"
VERIFIED="false"
for attempt in $(seq 1 40); do
  IDENTITY="$(aws sesv2 get-email-identity --region "$REGION" --email-identity "$DOMAIN" \
    --query '{dkim: DkimAttributes.Status, sending: VerifiedForSendingStatus}' --output json)"
  if [[ "$(jq -r '.dkim' <<<"$IDENTITY")" == "SUCCESS" && "$(jq -r '.sending' <<<"$IDENTITY")" == "true" ]]; then
    VERIFIED="true"
    break
  fi
  printf '  attempt %2d/40: %s\n' "$attempt" "$(jq -c . <<<"$IDENTITY")"
  sleep 15
done

if [[ "$VERIFIED" != "true" ]]; then
  cat <<EOF >&2

Identity ${DOMAIN} is still pending after 10 minutes. MX was NOT published, so
no mail is being routed yet. Everything else is in place. Re-run this exact
command later; it will skip straight to the MX step once SES reports SUCCESS.
EOF
  exit 2
fi

step "Publishing MX -> SES (go-live)"
aws route53 change-resource-record-sets --hosted-zone-id "$ZONE_ID" --change-batch "$(jq -n \
  --arg domain "$DOMAIN" --arg mx "$MX_VALUE" \
  '{Comment: "techtok mail: MX", Changes: [{Action: "UPSERT", ResourceRecordSet: {Name: ($domain + "."), Type: "MX", TTL: 300, ResourceRecords: [{Value: $mx}]}}]}')" >/dev/null

# --- Summary ------------------------------------------------------------------

PRODUCTION_ACCESS="$(aws sesv2 get-account --region "$REGION" \
  --query 'ProductionAccessEnabled' --output text)"

cat <<EOF

Done. Mail for ${DOMAIN} now routes to SES.

  Inbound addresses       $(sed "s/,/@${DOMAIN}, /g" <<<"$RECIPIENTS")@${DOMAIN}
  Forwarding to           ${FORWARD_TO}
  SES production access   ${PRODUCTION_ACCESS}  (False = sandbox: 200 sends/day, verified recipients only)
  Zone snapshot           ${SNAPSHOT}

Remaining manual steps (console, maintainer-only):
  1. Confirm the SES verification mail sent to ${FORWARD_TO}, if you have not yet.
  2. Send a test message to privacy@${DOMAIN} from an external mailbox and check
     it lands in ${FORWARD_TO} with From rewritten and Reply-To preserved.
  3. If production access is False, request it:
     SES > Account dashboard > Request production access.
  4. Mint SMTP credentials for Gmail "Send mail as":
     SES > SMTP settings > Create SMTP credentials.
     Host email-smtp.${REGION}.amazonaws.com, port 587 (STARTTLS).
EOF
