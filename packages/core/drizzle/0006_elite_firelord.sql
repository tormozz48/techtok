CREATE TABLE "testers" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "testers_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"email" text NOT NULL,
	"created_at" text NOT NULL,
	"play_added_at" text,
	CONSTRAINT "testers_email_unique" UNIQUE("email")
);
