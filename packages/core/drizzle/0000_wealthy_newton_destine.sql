CREATE TYPE "public"."entitlement_plan" AS ENUM('free', 'plus');--> statement-breakpoint
CREATE TYPE "public"."entitlement_source" AS ENUM('manual', 'play');--> statement-breakpoint
CREATE TYPE "public"."fetch_status" AS ENUM('ok', 'not-modified', 'error');--> statement-breakpoint
CREATE TYPE "public"."language" AS ENUM('en', 'ru', 'uk', 'pl');--> statement-breakpoint
CREATE TYPE "public"."post_status" AS ENUM('discovered', 'ready', 'failed');--> statement-breakpoint
CREATE TYPE "public"."topic" AS ENUM('ai', 'dev', 'gadgets', 'startups', 'security', 'science', 'space', 'bio');--> statement-breakpoint
CREATE TYPE "public"."transform_kind" AS ENUM('llm', 'excerpt');--> statement-breakpoint
CREATE TABLE "post_compacts" (
	"post_id" text NOT NULL,
	"lang" "language" NOT NULL,
	CONSTRAINT "post_compacts_post_id_lang_pk" PRIMARY KEY("post_id","lang")
);
--> statement-breakpoint
CREATE TABLE "post_figures" (
	"post_id" text NOT NULL,
	"position" integer NOT NULL,
	"url" text NOT NULL,
	"caption" text,
	CONSTRAINT "post_figures_post_id_position_pk" PRIMARY KEY("post_id","position")
);
--> statement-breakpoint
CREATE TABLE "post_snapshots" (
	"post_id" text PRIMARY KEY NOT NULL,
	"card_title" text NOT NULL,
	"source_name" text NOT NULL,
	"url" text NOT NULL,
	"primary_topic" "topic"
);
--> statement-breakpoint
CREATE TABLE "post_topics" (
	"post_id" text NOT NULL,
	"topic" "topic" NOT NULL,
	CONSTRAINT "post_topics_post_id_topic_pk" PRIMARY KEY("post_id","topic")
);
--> statement-breakpoint
CREATE TABLE "post_translations" (
	"post_id" text NOT NULL,
	"lang" "language" NOT NULL,
	"card_title" text NOT NULL,
	"summary" text NOT NULL,
	"why_it_matters" text,
	"translated_at" text NOT NULL,
	CONSTRAINT "post_translations_post_id_lang_pk" PRIMARY KEY("post_id","lang")
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"post_id" text PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"canonical_url" text NOT NULL,
	"source_id" text NOT NULL,
	"orig_title" text NOT NULL,
	"excerpt" text NOT NULL,
	"image_url" text,
	"mirrored_image_url" text,
	"primary_topic" "topic" NOT NULL,
	"status" "post_status" NOT NULL,
	"transform" "transform_kind" NOT NULL,
	"lang" text,
	"s3_raw_key" text,
	"duplicate_of" text,
	"published_at" text NOT NULL,
	"ingested_at" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"source_id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"rss_url" text NOT NULL,
	"site_url" text,
	"default_topic" "topic" NOT NULL,
	"weight" real NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"compact_enabled" boolean,
	"etag" text,
	"last_modified" text,
	"last_fetch_at" text,
	"last_status" "fetch_status",
	"newest_seen_published_at" text,
	"fail_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_bookmarks" (
	"user_id" text NOT NULL,
	"post_id" text NOT NULL,
	"bookmarked_at" text NOT NULL,
	CONSTRAINT "user_bookmarks_user_id_post_id_pk" PRIMARY KEY("user_id","post_id")
);
--> statement-breakpoint
CREATE TABLE "user_entitlements" (
	"user_id" text PRIMARY KEY NOT NULL,
	"plan" "entitlement_plan" NOT NULL,
	"source" "entitlement_source" NOT NULL,
	"expires_at" text,
	"product_id" text,
	"purchase_token" text,
	"verified_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_muted_sources" (
	"user_id" text NOT NULL,
	"source_id" text NOT NULL,
	CONSTRAINT "user_muted_sources_user_id_source_id_pk" PRIMARY KEY("user_id","source_id")
);
--> statement-breakpoint
CREATE TABLE "user_quotas" (
	"user_id" text NOT NULL,
	"day" text NOT NULL,
	"card_reads" integer DEFAULT 0 NOT NULL,
	"reader_opens" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "user_quotas_user_id_day_pk" PRIMARY KEY("user_id","day")
);
--> statement-breakpoint
CREATE TABLE "user_reads" (
	"user_id" text NOT NULL,
	"post_id" text NOT NULL,
	"read_at" text NOT NULL,
	CONSTRAINT "user_reads_user_id_post_id_pk" PRIMARY KEY("user_id","post_id")
);
--> statement-breakpoint
CREATE TABLE "user_topic_reads" (
	"user_id" text NOT NULL,
	"topic" "topic" NOT NULL,
	"read_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "user_topic_reads_user_id_topic_pk" PRIMARY KEY("user_id","topic")
);
--> statement-breakpoint
CREATE TABLE "user_topics" (
	"user_id" text NOT NULL,
	"topic" "topic" NOT NULL,
	CONSTRAINT "user_topics_user_id_topic_pk" PRIMARY KEY("user_id","topic")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"user_id" text PRIMARY KEY NOT NULL,
	"created_at" text NOT NULL,
	"last_seen_at" text NOT NULL,
	"language" "language",
	"timezone" text,
	"email" text,
	"name" text
);
--> statement-breakpoint
ALTER TABLE "post_compacts" ADD CONSTRAINT "post_compacts_post_id_posts_post_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("post_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_figures" ADD CONSTRAINT "post_figures_post_id_posts_post_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("post_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_topics" ADD CONSTRAINT "post_topics_post_id_posts_post_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("post_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_translations" ADD CONSTRAINT "post_translations_post_id_posts_post_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("post_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_source_id_sources_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("source_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_duplicate_of_posts_post_id_fk" FOREIGN KEY ("duplicate_of") REFERENCES "public"."posts"("post_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_bookmarks" ADD CONSTRAINT "user_bookmarks_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_bookmarks" ADD CONSTRAINT "user_bookmarks_post_id_post_snapshots_post_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."post_snapshots"("post_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_entitlements" ADD CONSTRAINT "user_entitlements_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_muted_sources" ADD CONSTRAINT "user_muted_sources_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_muted_sources" ADD CONSTRAINT "user_muted_sources_source_id_sources_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("source_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_quotas" ADD CONSTRAINT "user_quotas_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_reads" ADD CONSTRAINT "user_reads_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_reads" ADD CONSTRAINT "user_reads_post_id_post_snapshots_post_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."post_snapshots"("post_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_topic_reads" ADD CONSTRAINT "user_topic_reads_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_topics" ADD CONSTRAINT "user_topics_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "posts_feed_idx" ON "posts" USING btree ("primary_topic","published_at" DESC NULLS LAST,"post_id" DESC NULLS LAST) WHERE status = 'ready' and duplicate_of is null;--> statement-breakpoint
CREATE INDEX "posts_dup_idx" ON "posts" USING btree ("duplicate_of");--> statement-breakpoint
CREATE INDEX "posts_expiry_idx" ON "posts" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "posts_time_idx" ON "posts" USING btree ("published_at" DESC NULLS LAST,"post_id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "user_bookmarks_recent_idx" ON "user_bookmarks" USING btree ("user_id","bookmarked_at" DESC NULLS LAST,"post_id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "user_reads_recent_idx" ON "user_reads" USING btree ("user_id","read_at" DESC NULLS LAST,"post_id" DESC NULLS LAST);