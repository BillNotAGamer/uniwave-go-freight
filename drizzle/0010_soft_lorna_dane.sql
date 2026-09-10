CREATE TYPE "public"."shipping_note_document_storage_provider" AS ENUM('r2', 'google_drive');--> statement-breakpoint
CREATE TYPE "public"."shipping_note_document_type" AS ENUM('pre_alert_hbl', 'pre_alert_mbl', 'contract', 'invoice');--> statement-breakpoint
CREATE TABLE "shipping_note_documents" (
	"id" text PRIMARY KEY NOT NULL,
	"shipping_note_id" text NOT NULL,
	"document_type" "shipping_note_document_type" NOT NULL,
	"original_file_name" text NOT NULL,
	"storage_provider" "shipping_note_document_storage_provider" NOT NULL,
	"storage_key" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"uploaded_by_id" text NOT NULL,
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) DEFAULT now() NOT NULL,
	"deleted_at" timestamp (3),
	CONSTRAINT "shipping_note_documents_size_bytes_check" CHECK ("shipping_note_documents"."size_bytes" >= 0)
);
--> statement-breakpoint
ALTER TABLE "shipping_note_documents" ADD CONSTRAINT "shipping_note_documents_shipping_note_id_shipping_notes_id_fk" FOREIGN KEY ("shipping_note_id") REFERENCES "public"."shipping_notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipping_note_documents" ADD CONSTRAINT "shipping_note_documents_uploaded_by_id_users_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "shipping_note_documents_shipping_note_id_idx" ON "shipping_note_documents" USING btree ("shipping_note_id");--> statement-breakpoint
CREATE INDEX "shipping_note_documents_document_type_idx" ON "shipping_note_documents" USING btree ("document_type");--> statement-breakpoint
CREATE UNIQUE INDEX "shipping_note_documents_active_provider_key_uidx" ON "shipping_note_documents" USING btree ("storage_provider","storage_key") WHERE "shipping_note_documents"."deleted_at" is null;