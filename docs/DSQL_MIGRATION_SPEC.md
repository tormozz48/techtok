# Aurora DSQL migration spec

**Status:** evaluated, not adopted. See DESIGN.md decision log **D89**.
**Date:** 2026-08-31. **Companion change:** D88 (GSI projection narrowing), which is the cheap fix and lands independently of anything here.

This document exists so the relational option is specced rather than re-argued. It is not a commitment to migrate.

---

## 1. Why this came up, and what it is *not* about

The trigger was a cost question. The cost answer turned out to be uninteresting, so the honest case for relational is a modelling case.

Measured AWS spend, August 2026 (`dev` + `production`, Cost Explorer):

| Service | Monthly |
|---|---|
| CloudWatch | $4.10 |
| **DynamoDB** | **$2.75** |
| Tax | $1.84 |
| S3 | $1.07 |
| Route 53 | $0.50 |
| Step Functions | $0.38 |
| SQS | $0.31 |
| Cost Explorer, API GW | $0.13 |
| **Total** | **$11.08** |

DynamoDB is the second-largest line, and **$2.65 of its $2.75 is writes** (3.48M write units, vs $0.08 for all reads and $0 for storage). That is write amplification against a fat, repeatedly-updated item — diagnosed and fixed in D88, which models $2.65 → ~$1.15 with no new services and no data migration.

**So: do not migrate to save money.** D88 already captures most of the available saving, and the entire DynamoDB line is ~25% of an $11 bill. A migration that saves $1–2/mo cannot justify its own risk.

The real case is that the application's access patterns have drifted relational, and the data model is now paying for it in app code. Section 3 lists the specific places.

---

## 2. Cost, for completeness

Aurora DSQL is the only managed relational option in eu-central-1 that does not cost more than the entire current AWS bill. The reason is architectural, not pricing-table trivia: RDS and Aurora Serverless v2 live in a VPC, which forces the transform Lambda into the VPC, and that Lambda calls OpenRouter over the internet (D32). There is no VPC endpoint for a non-AWS service, so a NAT Gateway becomes mandatory.

| Option (eu-central-1) | Database | NAT Gateway | Monthly |
|---|---|---|---|
| DynamoDB today | $2.75 | — | **$2.75** |
| DynamoDB post-D88 | ~$1.15 | — | **~$1.15** |
| RDS `db.t4g.micro` PostgreSQL, single-AZ | $13.87 + ~$2.60 storage | $37.96 | **~$55** |
| Aurora Serverless v2 PostgreSQL | $51.10 (0.5 ACU min × $0.14/ACU-hr) | $37.96 | **~$89** |
| **Aurora DSQL** | see below | **none needed** | **~$0** |

Rates verified against the AWS Price List API, not the marketing pages — Frankfurt is materially more expensive than us-east-1 for DSQL ($9.50/M DPU vs $8.00; $0.45/GB-month vs $0.33).

**DSQL estimate for this workload.** Billing is a single unit, the DPU, covering reads, writes and compute. The documented formulas:

```
WriteDPU = max(BytesWritten, 1024) × 0.00004883      (Σ max(row size, 128 B), incl. secondary indexes)
ReadDPU  = max(BytesRead,   2048) × 0.00000183105
ComputeDPU = compute-seconds
```

Applied to measured volume, against the normalized schema in §4:

- **Writes:** ~120k write transactions/month (3.48M DynamoDB write units, de-amplified through the ~10-updates-per-post pipeline against a 3.46 KB average item). At ~0.07 DPU per transaction — a ~1.2 KB normalized row plus the 1,024-byte write floor and the 2,048-byte read floor — that is **~8,400 DPU**.
- **Reads:** ~4.1 GB/month read (514k read units at 0.5 RRU per 4 KB eventually-consistent). Normalized rows are much narrower than today's fat items, so roughly half that: **~3,750 DPU**.
- **Total: ~13,000 DPU/month. Storage: ~92 MB.**

**The free tier is 100,000 DPU and 1 GB-month, so this workload bills $0.** At 10× current scale it is ~$0.29/mo. Storage stays inside the free GB until roughly 10× as well.

Two caveats before anyone quotes the $0: the free tier is per *management account* under AWS Organizations, so it is shared with anything else in the org, and a free tier is a pricing decision AWS can change. The defensible statement is that **DSQL's cost for this workload is negligible and is not the deciding factor** — in either direction.

---

## 3. What relational actually buys

Each of these is a place where the current code works around the data model. This is the substance of the proposal.

| Today | Cause | Relational |
|---|---|---|
| `topics[]` is filter metadata only; the feed indexes `primaryTopic` alone, with per-(topic, post) fan-out documented as "the known upgrade" (§6) | A GSI cannot index a list | `post_topics` join table; secondary topics become first-class in the feed query |
| `byTime` is a single-partition GSI on constant `"POST"`, self-described as "the first thing to change at real scale" | No table-wide ordering without a partition key | `ORDER BY published_at DESC` |
| `searchActivity` (C1) scans **at most 500 rows** client-side for a substring and always returns `nextCursor: null` — so history search is silently incomplete and unpaginated | No server-side text predicate | `WHERE user_id = $1 AND card_title ILIKE $2`, complete and paginated |
| Reading stats (C2, D62) are computed **in the mobile client** from history pages | No aggregation | `GROUP BY` |
| Read-markers resolved by `BatchGet` over candidate ids, then filtered in `buildFeed` | No join | `LEFT JOIN user_activity` / `NOT EXISTS` |
| Recency × source weight × affinity ranking is hand-rolled in `scoring.ts`, over a 60-candidate cap | No server-side ordering by computed expression | `ORDER BY` a scored expression, over the real corpus |
| Duplicate detection re-queries a 48-hour window per topic and compares titles in app code | No join | Indexed query, same shape but server-side |
| `i18n` as a nested map that makes every unrelated update cost 8 WRU (D88) | Denormalized by necessity | `post_translations`, one row per (post, language) |
| Repo tests mock the AWS SDK (`aws-sdk-client-mock`) and assert on command shapes | Cannot run DynamoDB locally | Real PostgreSQL 16 in a container, asserting on data |

The last row cuts both ways — see §7.

---

## 4. Target schema

PostgreSQL 16 dialect. Ten tables, well inside DSQL's 1,000-table and 10-schema limits.

```sql
CREATE TABLE sources (
  source_id      TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  rss_url        TEXT NOT NULL,
  site_url       TEXT NOT NULL,
  default_topic  TEXT NOT NULL,
  weight         DOUBLE PRECISION NOT NULL DEFAULT 1,
  enabled        BOOLEAN NOT NULL DEFAULT TRUE,
  compact_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  etag           TEXT, last_modified TEXT,
  last_fetch_at  TIMESTAMPTZ, last_status TEXT, fail_count INT NOT NULL DEFAULT 0,
  newest_seen_published_at TIMESTAMPTZ
);

CREATE TABLE posts (
  post_id        TEXT PRIMARY KEY,
  url TEXT NOT NULL, canonical_url TEXT NOT NULL,
  source_id      TEXT NOT NULL REFERENCES sources(source_id),
  orig_title TEXT NOT NULL, card_title TEXT NOT NULL,
  summary TEXT NOT NULL, why_it_matters TEXT, excerpt TEXT NOT NULL,
  image_url TEXT, mirrored_image_url TEXT,
  primary_topic  TEXT NOT NULL,
  lang TEXT, status TEXT NOT NULL, transform TEXT NOT NULL,
  published_at   TIMESTAMPTZ NOT NULL,
  ingested_at    TIMESTAMPTZ NOT NULL,
  expires_at     TIMESTAMPTZ NOT NULL,
  s3_raw_key TEXT,
  mirrored_figures JSONB,
  duplicate_of   TEXT, dup_count INT NOT NULL DEFAULT 0
);

CREATE TABLE post_topics (
  post_id TEXT NOT NULL, topic TEXT NOT NULL,
  PRIMARY KEY (post_id, topic)
);

CREATE TABLE post_translations (
  post_id TEXT NOT NULL, lang TEXT NOT NULL,
  card_title TEXT NOT NULL, summary TEXT NOT NULL, why_it_matters TEXT,
  translated_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (post_id, lang)
);

CREATE TABLE post_compact_langs (
  post_id TEXT NOT NULL, lang TEXT NOT NULL, generated_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (post_id, lang)
);

CREATE TABLE users (
  user_id TEXT PRIMARY KEY,
  email TEXT, name TEXT, language TEXT NOT NULL DEFAULT 'en',
  timezone TEXT NOT NULL DEFAULT 'UTC',
  created_at TIMESTAMPTZ NOT NULL, last_seen_at TIMESTAMPTZ NOT NULL,
  entitlement_plan TEXT NOT NULL DEFAULT 'free',
  entitlement_source TEXT, entitlement_expires_at TIMESTAMPTZ,
  entitlement_product_id TEXT, entitlement_purchase_token TEXT,
  entitlement_verified_at TIMESTAMPTZ,
  quota_day DATE, quota_card_reads INT NOT NULL DEFAULT 0, quota_reader_opens INT NOT NULL DEFAULT 0,
  fair_use_month TEXT, fair_use_extended_compacts INT NOT NULL DEFAULT 0
);

CREATE TABLE user_topics       (user_id TEXT NOT NULL, topic TEXT NOT NULL, PRIMARY KEY (user_id, topic));
CREATE TABLE user_muted_sources(user_id TEXT NOT NULL, source_id TEXT NOT NULL, PRIMARY KEY (user_id, source_id));
CREATE TABLE user_topic_reads  (user_id TEXT NOT NULL, topic TEXT NOT NULL, reads INT NOT NULL DEFAULT 0, PRIMARY KEY (user_id, topic));

CREATE TABLE user_activity (
  user_id TEXT NOT NULL, post_id TEXT NOT NULL,
  read_at TIMESTAMPTZ, bookmarked_at TIMESTAMPTZ,
  snapshot_card_title TEXT NOT NULL, snapshot_source_name TEXT NOT NULL, snapshot_url TEXT NOT NULL,
  PRIMARY KEY (user_id, post_id)
);
```

Indexes (all created with `CREATE INDEX ASYNC`, then awaited via `sys.wait_for_job`):

```sql
CREATE INDEX ASYNC posts_topic_time  ON posts (primary_topic, published_at DESC);
CREATE INDEX ASYNC posts_time        ON posts (published_at DESC);
CREATE INDEX ASYNC posts_source_time ON posts (source_id, published_at DESC);
CREATE INDEX ASYNC post_topics_topic ON post_topics (topic, post_id);
CREATE INDEX ASYNC activity_read     ON user_activity (user_id, read_at DESC);
CREATE INDEX ASYNC activity_bookmark ON user_activity (user_id, bookmarked_at DESC);
```

Notes on the mapping:

- **`ttl` → `expires_at` + a scheduled `DELETE`.** DSQL has no TTL. The existing EventBridge schedule can run the sweep, but it must chunk: **3,000 rows per transaction, maximum**, and `TRUNCATE` does not exist. This is new operational code that DynamoDB provided for free.
- **`i18n` map → `post_translations`.** This is the change that removes D88's remaining write amplification. A translation write touches a ~1.6 KB row instead of rewriting a 7.5 KB item.
- **`compactLangs[]` → `post_compact_langs`.** `appendCompactLang`'s conditional-write dance becomes `INSERT ... ON CONFLICT DO NOTHING`.
- **`mirroredFigures[]` stays JSONB.** It is never queried into, only read whole, so it needs no index — which matters, because DSQL **does not support GIN indexes on JSONB** (`Index support: No`).
- **`putIfNew`'s conditional put** → `INSERT ... ON CONFLICT (post_id) DO NOTHING RETURNING post_id`.
- **Atomic `ADD` counters** (quota, `dupCount`, `topicReads`) → `UPDATE ... SET n = n + 1`. Safe under optimistic concurrency because these rows are per-user, not shared — the deliberate design already established in D69.

---

## 5. Constraints that actually bite

Verified against AWS documentation, 2026-08-31. Aurora DSQL has moved fast — foreign keys landed 2026-08-26, JSONB 2026-06-08, sequences 2026-02-13 — so pre-2026 write-ups about it are unreliable.

**Blocking or near-blocking:**

1. **No local emulator, container image, or offline mode.** AWS's answer is the browser Playground or a real ephemeral cluster. This collides head-on with the repo's hard rule that *tests never call live AWS* and *CI must run with no AWS credentials*. See §7 — this is the single biggest cost of the migration and it is not a cost in dollars.
2. **No documented continuous PITR.** Backups are AWS Backup only, **full**, **whole-cluster**, and **restore always creates a new cluster**. DynamoDB's point-in-time recovery has no equivalent here. This is a real regression in recoverability.
3. **3,000 rows / 10 MiB / 5 minutes per transaction.** Fine for normal operation — ingest batches are capped at 1,000 candidates (D85) — but every backfill, TTL sweep, and bulk delete must be written as a chunked loop.

**Manageable, but requires code:**

4. **Optimistic concurrency, not locks.** Conflicts surface at commit as SQLSTATE `40001` (`OC000` data, `OC001` schema). Retry is mandatory application code. The official `@aws/aurora-dsql-node-postgres-connector` provides `AuroraDSQLPool.transaction()` with backoff and jitter built in — use it rather than hand-rolling. Note `SELECT FOR UPDATE` parses but **does not block**.
5. **60-minute hard connection cap, 100 new connections/second.** Module-scope `pg.Pool`, `max: 1–3`, recycled at ~55 minutes with jitter. **Do not add RDS Proxy or PgBouncer** — DSQL multiplexes in the service and AWS documents external poolers as redundant.
6. **IAM auth tokens** are SigV4-presigned and generated locally (no AWS call), default 15-minute expiry, and **cannot outlive the underlying IAM credentials** — under an assumed role with a 1-hour session, a token expires in ≤1 h regardless of the requested duration. The connector handles refresh.
7. **No `tsvector`/`tsquery` full-text search and no GIN.** For C1's history search this is fine — `ILIKE` over one user's rows is still strictly better than today's 500-row cap — but note DSQL **bills rows scanned, not returned**, so an unindexed scan is a real cost at scale. Expression indexes on extracted scalars are the only lever.
8. **No `SERIAL`/`BIGSERIAL`** (use `GENERATED ALWAYS AS IDENTITY`, `bigint` only, explicit `CACHE`), no triggers, no PL/pgSQL, no extensions, no temp tables, no materialized views, no `SAVEPOINT`, no `ALTER COLUMN TYPE`, no `SET NOT NULL`. Collation is `C` only; timezone UTC; isolation fixed at Repeatable Read.
9. **Drizzle works** (`drizzle({ client: new AuroraDSQLPool(...) })`) but **its built-in `migrate()` does not** — the tracking table uses `SERIAL`. AWS ships a sample custom migration runner with a UUID primary key.

---

## 6. Migration plan

Five phases, each independently revertible. Phases 1–3 do not touch production traffic.

1. **Cluster + schema.** DSQL cluster in eu-central-1 as an SST component; schema and async-index DDL as a versioned migration runner (not Drizzle's `migrate()`). Deliverable: an empty `dev` cluster the E2E role can reach.
2. **Repo layer behind the existing interfaces.** `PostsRepo`, `UsersRepo`, `UserActivityRepo` and `SourcesRepo` already isolate every DynamoDB call. Write SQL implementations satisfying the same interfaces. Nothing else in `core` or `functions` changes — this is the payoff of the existing repo boundary.
3. **Dual-write, DynamoDB authoritative.** Pipeline writes go to both; reads stay on DynamoDB. Backfill `production`'s 15,818 posts and 2,117 activity rows in ≤3,000-row chunks. Reconcile counts and spot-check rows.
4. **Read cutover behind a flag,** per stage, `dev` first. Compare feed output between backends for the same user before flipping `production`. Keep dual-write.
5. **Drop DynamoDB.** Remove the tables from `infra/storage.ts`, delete the dual-write path, and — only now — collapse the workarounds in §3 into real SQL. Doing that earlier would mean maintaining two feed algorithms.

**Rollback:** trivial through phase 4 (flip the flag back; DynamoDB is still authoritative and still being written). After phase 5 it is a restore-from-backup exercise, which is exactly where constraint #2 hurts. Do not start phase 5 until the backup story has been tested by actually performing a restore.

**Effort:** roughly 2–3 weeks of focused work, dominated by phase 2 and by the testing rework in §7 — not by the SQL.

---

## 7. Testing, which is the real cost

The repo's hard rule: *"Tests never call live AWS or Bedrock: `aws-sdk-client-mock` + recorded LLM golden fixtures. CI must run with no AWS credentials."* There is no DSQL equivalent of `aws-sdk-client-mock`, and no local DSQL.

Three options, none clean:

1. **PostgreSQL 16 in a container for unit/integration tests.** Highest fidelity for SQL semantics — pg16 is the actual engine — and a genuine improvement over asserting on mocked command shapes. But vanilla PostgreSQL happily accepts `SERIAL`, triggers, `TRUNCATE`, GIN indexes, temp tables and 100k-row transactions, and it never produces a `40001`. **Every DSQL divergence, and every OCC retry path, would go untested.** Also: CI would now need a service container, which today it does not.
2. **Mock at the `pg`/connector boundary.** Keeps CI credential-free and unchanged in shape, but tests zero SQL — strictly worse than today, where at least the DynamoDB command shapes are asserted.
3. **A real `dev` cluster, exercised only from `e2e.yml`.** This is precisely the shape of the existing D34 exception: OIDC-authenticated, schedule/dispatch-triggered, never PR-triggered. DSQL-specific behaviour — the 3,000-row cap, `OC000`/`OC001` retries, async DDL, IAM token expiry — can *only* be verified here.

**The realistic answer is 1 + 3:** containerized PostgreSQL for fast credential-free unit tests, plus DSQL-specific assertions in the credentialed E2E suite. That preserves the letter of the hard rule for PR-triggered jobs. It should be logged as an explicit amendment before any code lands, because it changes what "tested" means for the entire data layer.

---

## 8. Recommendation

**Do not migrate now.** Ship D88, which fixes the actual measured problem for the cost of one PR and no data migration. Then measure again.

The relational case is real but it is a *modelling* case, and every item in §3 is currently an annoyance rather than a blocker. Weighed against losing PITR, losing the local-test story, and 2–3 weeks of work on a project whose next milestone is a Play Store launch (phases 19–23), the trade is bad today.

**Revisit when any of these becomes true:**

- Secondary-topic feed queries are genuinely needed — that is the fan-out §6 already flags, and it is the single strongest relational argument.
- History/bookmark search outgrows the 500-row scan cap in a way users notice.
- Server-side aggregation is needed for reading stats, ranking experiments, or analytics that the mobile client should not be computing.
- DynamoDB cost climbs back above ~$5/mo after D88, indicating the model is fighting the store rather than the projections being wrong.
- Aurora DSQL ships a local emulator or documented PITR — either would remove one of the two blocking objections outright.

Until then this document is the answer to "should we use a relational database?", so the question does not need re-deriving.
