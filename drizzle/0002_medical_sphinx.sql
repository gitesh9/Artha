CREATE TABLE "group_entry" (
	"id" text PRIMARY KEY NOT NULL,
	"group_id" text NOT NULL,
	"created_by" text NOT NULL,
	"kind" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "group_invite" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"group_id" text NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "group_member" (
	"id" text PRIMARY KEY NOT NULL,
	"group_id" text NOT NULL,
	"user_id" text NOT NULL,
	"approved" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shared_group" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"currency" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "group_entry" ADD CONSTRAINT "group_entry_group_id_shared_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."shared_group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_entry" ADD CONSTRAINT "group_entry_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_invite" ADD CONSTRAINT "group_invite_group_id_shared_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."shared_group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_member" ADD CONSTRAINT "group_member_group_id_shared_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."shared_group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_member" ADD CONSTRAINT "group_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_group" ADD CONSTRAINT "shared_group_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "group_member_group_user_uq" ON "group_member" USING btree ("group_id","user_id");