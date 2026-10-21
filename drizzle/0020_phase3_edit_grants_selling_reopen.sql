CREATE TYPE "public"."shipping_note_edit_grant_status" AS ENUM('active', 'revoked');--> statement-breakpoint
CREATE TABLE "shipping_note_edit_grants" (
	"id" text PRIMARY KEY NOT NULL,
	"shipping_note_id" text NOT NULL,
	"recipient_user_id" text NOT NULL,
	"granted_by_id" text NOT NULL,
	"status" "shipping_note_edit_grant_status" DEFAULT 'active' NOT NULL,
	"reason" text,
	"granted_at" timestamp (3) DEFAULT now() NOT NULL,
	"revoked_at" timestamp (3),
	"revoked_by_id" text,
	"revoke_reason" text,
	CONSTRAINT "shipping_note_edit_grants_revocation_state_check" CHECK (("shipping_note_edit_grants"."status" = 'active' and "shipping_note_edit_grants"."revoked_at" is null and "shipping_note_edit_grants"."revoked_by_id" is null) or ("shipping_note_edit_grants"."status" = 'revoked' and "shipping_note_edit_grants"."revoked_at" is not null and "shipping_note_edit_grants"."revoked_by_id" is not null))
);
--> statement-breakpoint
ALTER TABLE "shipping_notes" ADD COLUMN "selling_rate_reopened_by_id" text;--> statement-breakpoint
ALTER TABLE "shipping_notes" ADD COLUMN "selling_rate_reopened_at" timestamp (3);--> statement-breakpoint
ALTER TABLE "shipping_notes" ADD COLUMN "selling_rate_reopen_reason" text;--> statement-breakpoint
ALTER TABLE "shipping_note_edit_grants" ADD CONSTRAINT "shipping_note_edit_grants_shipping_note_id_shipping_notes_id_fk" FOREIGN KEY ("shipping_note_id") REFERENCES "public"."shipping_notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipping_note_edit_grants" ADD CONSTRAINT "shipping_note_edit_grants_recipient_user_id_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipping_note_edit_grants" ADD CONSTRAINT "shipping_note_edit_grants_granted_by_id_users_id_fk" FOREIGN KEY ("granted_by_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipping_note_edit_grants" ADD CONSTRAINT "shipping_note_edit_grants_revoked_by_id_users_id_fk" FOREIGN KEY ("revoked_by_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "shipping_note_edit_grants_note_idx" ON "shipping_note_edit_grants" USING btree ("shipping_note_id");--> statement-breakpoint
CREATE INDEX "shipping_note_edit_grants_recipient_idx" ON "shipping_note_edit_grants" USING btree ("recipient_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "shipping_note_edit_grants_active_note_recipient_uidx" ON "shipping_note_edit_grants" USING btree ("shipping_note_id","recipient_user_id") WHERE "shipping_note_edit_grants"."status" = 'active';--> statement-breakpoint
ALTER TABLE "shipping_notes" ADD CONSTRAINT "shipping_notes_selling_rate_reopened_by_id_users_id_fk" FOREIGN KEY ("selling_rate_reopened_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
