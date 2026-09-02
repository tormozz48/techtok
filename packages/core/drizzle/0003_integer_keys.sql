DROP TABLE IF EXISTS "user_bookmarks" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "user_reads" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "user_entitlements" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "user_quotas" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "user_topic_reads" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "user_muted_sources" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "user_topics" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "users" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "post_figures" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "post_compacts" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "post_topics" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "post_translations" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "posts" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "source_states" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "sources" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "topics" CASCADE;--> statement-breakpoint
DROP TYPE IF EXISTS "public"."topic" CASCADE;--> statement-breakpoint
DROP TYPE IF EXISTS "public"."language" CASCADE;--> statement-breakpoint
DROP TYPE IF EXISTS "public"."transform_kind" CASCADE;--> statement-breakpoint
DROP TYPE IF EXISTS "public"."post_status" CASCADE;--> statement-breakpoint
DROP TYPE IF EXISTS "public"."fetch_status" CASCADE;--> statement-breakpoint
DROP TYPE IF EXISTS "public"."entitlement_plan" CASCADE;--> statement-breakpoint
DROP TYPE IF EXISTS "public"."entitlement_source" CASCADE;--> statement-breakpoint
CREATE TYPE "public"."entitlement_plan" AS ENUM('free', 'plus');--> statement-breakpoint
CREATE TYPE "public"."entitlement_source" AS ENUM('manual', 'play');--> statement-breakpoint
CREATE TYPE "public"."fetch_status" AS ENUM('ok', 'not-modified', 'error');--> statement-breakpoint
CREATE TYPE "public"."language" AS ENUM('en', 'ru', 'uk', 'pl');--> statement-breakpoint
CREATE TYPE "public"."post_status" AS ENUM('discovered', 'ready', 'failed');--> statement-breakpoint
CREATE TYPE "public"."transform_kind" AS ENUM('llm', 'excerpt');--> statement-breakpoint
CREATE TABLE "post_compacts" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "post_compacts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"post_id" integer NOT NULL,
	"lang" "language" NOT NULL,
	CONSTRAINT "post_compacts_post_lang_key" UNIQUE("post_id","lang")
);
--> statement-breakpoint
CREATE TABLE "post_figures" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "post_figures_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"post_id" integer NOT NULL,
	"position" integer NOT NULL,
	"url" text NOT NULL,
	"caption" text,
	CONSTRAINT "post_figures_post_position_key" UNIQUE("post_id","position")
);
--> statement-breakpoint
CREATE TABLE "post_topics" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "post_topics_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"post_id" integer NOT NULL,
	"topic_id" integer NOT NULL,
	CONSTRAINT "post_topics_post_topic_key" UNIQUE("post_id","topic_id")
);
--> statement-breakpoint
CREATE TABLE "post_translations" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "post_translations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"post_id" integer NOT NULL,
	"lang" "language" NOT NULL,
	"card_title" text NOT NULL,
	"summary" text NOT NULL,
	"why_it_matters" text,
	"translated_at" text NOT NULL,
	CONSTRAINT "post_translations_post_lang_key" UNIQUE("post_id","lang")
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "posts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"url" text NOT NULL,
	"canonical_url" text NOT NULL,
	"source_id" integer NOT NULL,
	"orig_title" text NOT NULL,
	"excerpt" text NOT NULL,
	"image_url" text,
	"mirrored_image_url" text,
	"primary_topic_id" integer NOT NULL,
	"status" "post_status" NOT NULL,
	"transform" "transform_kind" NOT NULL,
	"lang" text,
	"s3_raw_key" text,
	"duplicate_of_post_id" integer,
	"published_at" text NOT NULL,
	"ingested_at" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "posts_canonical_url_unique" UNIQUE("canonical_url")
);
--> statement-breakpoint
CREATE TABLE "source_states" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "source_states_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"source_id" integer NOT NULL,
	"etag" text,
	"last_modified" text,
	"last_fetch_at" text,
	"last_status" "fetch_status",
	"newest_seen_published_at" text,
	"fail_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "source_states_source_id_unique" UNIQUE("source_id")
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sources_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"rss_url" text NOT NULL,
	"site_url" text,
	"default_topic_id" integer NOT NULL,
	"weight" real NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"compact_enabled" boolean,
	CONSTRAINT "sources_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "topics" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "topics_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"slug" text NOT NULL,
	CONSTRAINT "topics_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "user_bookmarks" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_bookmarks_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"post_id" integer NOT NULL,
	"bookmarked_at" text NOT NULL,
	"card_title" text NOT NULL,
	"source_name" text NOT NULL,
	"url" text NOT NULL,
	"primary_topic_id" integer,
	CONSTRAINT "user_bookmarks_user_post_key" UNIQUE("user_id","post_id")
);
--> statement-breakpoint
CREATE TABLE "user_entitlements" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_entitlements_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"plan" "entitlement_plan" NOT NULL,
	"source" "entitlement_source" NOT NULL,
	"expires_at" text,
	"product_id" text,
	"purchase_token" text,
	"verified_at" text NOT NULL,
	CONSTRAINT "user_entitlements_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "user_muted_sources" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_muted_sources_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"source_slug" text NOT NULL,
	CONSTRAINT "user_muted_sources_user_slug_key" UNIQUE("user_id","source_slug")
);
--> statement-breakpoint
CREATE TABLE "user_quotas" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_quotas_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"day" text NOT NULL,
	"card_reads" integer DEFAULT 0 NOT NULL,
	"reader_opens" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "user_quotas_user_day_key" UNIQUE("user_id","day")
);
--> statement-breakpoint
CREATE TABLE "user_reads" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_reads_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"post_id" integer NOT NULL,
	"read_at" text NOT NULL,
	"card_title" text NOT NULL,
	"source_name" text NOT NULL,
	"url" text NOT NULL,
	"primary_topic_id" integer,
	CONSTRAINT "user_reads_user_post_key" UNIQUE("user_id","post_id")
);
--> statement-breakpoint
CREATE TABLE "user_topic_reads" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_topic_reads_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"topic_id" integer NOT NULL,
	"read_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "user_topic_reads_user_topic_key" UNIQUE("user_id","topic_id")
);
--> statement-breakpoint
CREATE TABLE "user_topics" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_topics_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"topic_id" integer NOT NULL,
	CONSTRAINT "user_topics_user_topic_key" UNIQUE("user_id","topic_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"external_id" text NOT NULL,
	"created_at" text NOT NULL,
	"last_seen_at" text NOT NULL,
	"language" "language",
	"timezone" text,
	"email" text,
	"name" text,
	CONSTRAINT "users_external_id_unique" UNIQUE("external_id")
);
--> statement-breakpoint
ALTER TABLE "post_compacts" ADD CONSTRAINT "post_compacts_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "post_figures" ADD CONSTRAINT "post_figures_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "post_topics" ADD CONSTRAINT "post_topics_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "post_topics" ADD CONSTRAINT "post_topics_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "post_translations" ADD CONSTRAINT "post_translations_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_primary_topic_id_topics_id_fk" FOREIGN KEY ("primary_topic_id") REFERENCES "public"."topics"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_duplicate_of_post_id_posts_id_fk" FOREIGN KEY ("duplicate_of_post_id") REFERENCES "public"."posts"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "source_states" ADD CONSTRAINT "source_states_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "sources" ADD CONSTRAINT "sources_default_topic_id_topics_id_fk" FOREIGN KEY ("default_topic_id") REFERENCES "public"."topics"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "user_bookmarks" ADD CONSTRAINT "user_bookmarks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "user_bookmarks" ADD CONSTRAINT "user_bookmarks_primary_topic_id_topics_id_fk" FOREIGN KEY ("primary_topic_id") REFERENCES "public"."topics"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "user_entitlements" ADD CONSTRAINT "user_entitlements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "user_muted_sources" ADD CONSTRAINT "user_muted_sources_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "user_quotas" ADD CONSTRAINT "user_quotas_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "user_reads" ADD CONSTRAINT "user_reads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "user_reads" ADD CONSTRAINT "user_reads_primary_topic_id_topics_id_fk" FOREIGN KEY ("primary_topic_id") REFERENCES "public"."topics"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "user_topic_reads" ADD CONSTRAINT "user_topic_reads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "user_topic_reads" ADD CONSTRAINT "user_topic_reads_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "user_topics" ADD CONSTRAINT "user_topics_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "user_topics" ADD CONSTRAINT "user_topics_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "post_topics_topic_idx" ON "post_topics" USING btree ("topic_id");--> statement-breakpoint
CREATE INDEX "posts_source_idx" ON "posts" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "posts_primary_topic_idx" ON "posts" USING btree ("primary_topic_id");--> statement-breakpoint
CREATE INDEX "posts_feed_idx" ON "posts" USING btree ("primary_topic_id","published_at" DESC NULLS LAST,"id" DESC NULLS LAST) WHERE status = 'ready' and duplicate_of_post_id is null;--> statement-breakpoint
CREATE INDEX "posts_dup_idx" ON "posts" USING btree ("duplicate_of_post_id");--> statement-breakpoint
CREATE INDEX "posts_expiry_idx" ON "posts" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "posts_time_idx" ON "posts" USING btree ("published_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "sources_default_topic_idx" ON "sources" USING btree ("default_topic_id");--> statement-breakpoint
CREATE INDEX "user_bookmarks_recent_idx" ON "user_bookmarks" USING btree ("user_id","bookmarked_at" DESC NULLS LAST,"post_id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "user_bookmarks_primary_topic_idx" ON "user_bookmarks" USING btree ("primary_topic_id");--> statement-breakpoint
CREATE INDEX "user_reads_recent_idx" ON "user_reads" USING btree ("user_id","read_at" DESC NULLS LAST,"post_id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "user_reads_primary_topic_idx" ON "user_reads" USING btree ("primary_topic_id");--> statement-breakpoint
CREATE INDEX "user_topic_reads_topic_idx" ON "user_topic_reads" USING btree ("topic_id");--> statement-breakpoint
CREATE INDEX "user_topics_topic_idx" ON "user_topics" USING btree ("topic_id");--> statement-breakpoint
INSERT INTO "topics" ("slug") VALUES ('ai'), ('dev'), ('gadgets'), ('startups'), ('security'), ('science'), ('space'), ('bio');
