ALTER TABLE "shipping_notes" ADD COLUMN "checked_at" timestamp (3);--> statement-breakpoint
ALTER TABLE "shipping_notes" ADD COLUMN "approved_at" timestamp (3);--> statement-breakpoint
ALTER TABLE "shipping_notes" ADD COLUMN "locked_by_id" text;--> statement-breakpoint
ALTER TABLE "shipping_notes" ADD COLUMN "lock_reason" text;--> statement-breakpoint
ALTER TABLE "shipping_notes" ADD COLUMN "cancelled_by_id" text;--> statement-breakpoint
ALTER TABLE "shipping_notes" ADD COLUMN "cancelled_at" timestamp (3);--> statement-breakpoint
ALTER TABLE "shipping_notes" ADD COLUMN "cancel_reason" text;--> statement-breakpoint
ALTER TABLE "shipping_notes" ADD CONSTRAINT "shipping_notes_locked_by_id_users_id_fk" FOREIGN KEY ("locked_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipping_notes" ADD CONSTRAINT "shipping_notes_cancelled_by_id_users_id_fk" FOREIGN KEY ("cancelled_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;