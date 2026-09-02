ALTER TABLE "post_snapshots" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "post_snapshots" CASCADE;--> statement-breakpoint
ALTER TABLE "user_bookmarks" ADD COLUMN "card_title" text NOT NULL;--> statement-breakpoint
ALTER TABLE "user_bookmarks" ADD COLUMN "source_name" text NOT NULL;--> statement-breakpoint
ALTER TABLE "user_bookmarks" ADD COLUMN "url" text NOT NULL;--> statement-breakpoint
ALTER TABLE "user_bookmarks" ADD COLUMN "primary_topic" "topic";--> statement-breakpoint
ALTER TABLE "user_reads" ADD COLUMN "card_title" text NOT NULL;--> statement-breakpoint
ALTER TABLE "user_reads" ADD COLUMN "source_name" text NOT NULL;--> statement-breakpoint
ALTER TABLE "user_reads" ADD COLUMN "url" text NOT NULL;--> statement-breakpoint
ALTER TABLE "user_reads" ADD COLUMN "primary_topic" "topic";
