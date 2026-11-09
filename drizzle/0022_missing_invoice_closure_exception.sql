CREATE TYPE "public"."missing_invoice_exception_status" AS ENUM('pending', 'approved', 'rejected', 'revoked', 'invalidated');--> statement-breakpoint
CREATE TABLE "shipping_note_missing_invoice_exceptions" (
	"id" text PRIMARY KEY NOT NULL,
	"shipping_note_id" text NOT NULL,
	"buying_charge_id" text NOT NULL,
	"status" "missing_invoice_exception_status" DEFAULT 'pending' NOT NULL,
	"requested_by_id" text NOT NULL,
	"requested_at" timestamp (3) NOT NULL,
	"request_reason" text NOT NULL,
	"invoice_status_snapshot" "input_vat_invoice_status" NOT NULL,
	"input_vat_deductible_snapshot" boolean NOT NULL,
	"requested_financial_revision" text NOT NULL,
	"decision_by_id" text,
	"decided_at" timestamp (3),
	"decision_reason" text,
	"self_approved" boolean DEFAULT false NOT NULL,
	"invalidated_by_id" text,
	"invalidated_at" timestamp (3),
	"invalidation_reason" text,
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "missing_invoice_exceptions_request_evidence_check" CHECK ("shipping_note_missing_invoice_exceptions"."invoice_status_snapshot" = 'missing' and "shipping_note_missing_invoice_exceptions"."input_vat_deductible_snapshot" = false and length(trim("shipping_note_missing_invoice_exceptions"."request_reason")) > 0 and length("shipping_note_missing_invoice_exceptions"."requested_financial_revision") = 64),
	CONSTRAINT "missing_invoice_exceptions_lifecycle_check" CHECK (("shipping_note_missing_invoice_exceptions"."status" = 'pending' and "shipping_note_missing_invoice_exceptions"."decision_by_id" is null and "shipping_note_missing_invoice_exceptions"."decided_at" is null and "shipping_note_missing_invoice_exceptions"."decision_reason" is null and "shipping_note_missing_invoice_exceptions"."self_approved" = false and "shipping_note_missing_invoice_exceptions"."invalidated_by_id" is null and "shipping_note_missing_invoice_exceptions"."invalidated_at" is null and "shipping_note_missing_invoice_exceptions"."invalidation_reason" is null) or ("shipping_note_missing_invoice_exceptions"."status" = 'approved' and "shipping_note_missing_invoice_exceptions"."decision_by_id" is not null and "shipping_note_missing_invoice_exceptions"."decided_at" is not null and length(trim("shipping_note_missing_invoice_exceptions"."decision_reason")) > 0 and "shipping_note_missing_invoice_exceptions"."self_approved" = ("shipping_note_missing_invoice_exceptions"."requested_by_id" = "shipping_note_missing_invoice_exceptions"."decision_by_id") and "shipping_note_missing_invoice_exceptions"."invalidated_by_id" is null and "shipping_note_missing_invoice_exceptions"."invalidated_at" is null and "shipping_note_missing_invoice_exceptions"."invalidation_reason" is null) or ("shipping_note_missing_invoice_exceptions"."status" = 'rejected' and "shipping_note_missing_invoice_exceptions"."decision_by_id" is not null and "shipping_note_missing_invoice_exceptions"."decided_at" is not null and length(trim("shipping_note_missing_invoice_exceptions"."decision_reason")) > 0 and "shipping_note_missing_invoice_exceptions"."self_approved" = false and "shipping_note_missing_invoice_exceptions"."invalidated_by_id" is null and "shipping_note_missing_invoice_exceptions"."invalidated_at" is null and "shipping_note_missing_invoice_exceptions"."invalidation_reason" is null) or ("shipping_note_missing_invoice_exceptions"."status" in ('revoked', 'invalidated') and "shipping_note_missing_invoice_exceptions"."invalidated_by_id" is not null and "shipping_note_missing_invoice_exceptions"."invalidated_at" is not null and length(trim("shipping_note_missing_invoice_exceptions"."invalidation_reason")) > 0))
);
--> statement-breakpoint
ALTER TABLE "shipping_note_missing_invoice_exceptions" ADD CONSTRAINT "shipping_note_missing_invoice_exceptions_shipping_note_id_shipping_notes_id_fk" FOREIGN KEY ("shipping_note_id") REFERENCES "public"."shipping_notes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipping_note_missing_invoice_exceptions" ADD CONSTRAINT "shipping_note_missing_invoice_exceptions_buying_charge_id_shipping_note_charges_id_fk" FOREIGN KEY ("buying_charge_id") REFERENCES "public"."shipping_note_charges"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipping_note_missing_invoice_exceptions" ADD CONSTRAINT "shipping_note_missing_invoice_exceptions_requested_by_id_users_id_fk" FOREIGN KEY ("requested_by_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipping_note_missing_invoice_exceptions" ADD CONSTRAINT "shipping_note_missing_invoice_exceptions_decision_by_id_users_id_fk" FOREIGN KEY ("decision_by_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipping_note_missing_invoice_exceptions" ADD CONSTRAINT "shipping_note_missing_invoice_exceptions_invalidated_by_id_users_id_fk" FOREIGN KEY ("invalidated_by_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "missing_invoice_exceptions_note_idx" ON "shipping_note_missing_invoice_exceptions" USING btree ("shipping_note_id");--> statement-breakpoint
CREATE INDEX "missing_invoice_exceptions_charge_idx" ON "shipping_note_missing_invoice_exceptions" USING btree ("buying_charge_id");--> statement-breakpoint
CREATE INDEX "missing_invoice_exceptions_status_idx" ON "shipping_note_missing_invoice_exceptions" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "missing_invoice_exceptions_active_charge_uidx" ON "shipping_note_missing_invoice_exceptions" USING btree ("buying_charge_id") WHERE "shipping_note_missing_invoice_exceptions"."status" in ('pending', 'approved');