ALTER TABLE "sources" ADD COLUMN "plus_only" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
UPDATE "sources" SET "plus_only" = true WHERE "slug" IN ('hn', 'arstechnica', 'arxiv-ai', 'huggingface-blog');