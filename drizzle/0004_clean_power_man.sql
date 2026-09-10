CREATE TYPE "public"."drive_upload_status" AS ENUM('not_uploaded', 'uploading', 'uploaded', 'upload_failed');--> statement-breakpoint
ALTER TABLE "shipping_note_exports" ADD COLUMN "drive_upload_status" "drive_upload_status" DEFAULT 'not_uploaded' NOT NULL;--> statement-breakpoint
ALTER TABLE "shipping_note_exports" ADD COLUMN "drive_uploaded_at" timestamp (3);--> statement-breakpoint
ALTER TABLE "shipping_note_exports" ADD COLUMN "drive_folder_id" text;--> statement-breakpoint
ALTER TABLE "shipping_note_exports" ADD COLUMN "drive_error_message" text;--> statement-breakpoint
ALTER TABLE "shipping_note_exports" ADD COLUMN "artifact_storage_key" text;--> statement-breakpoint
ALTER TABLE "shipping_note_exports" ADD COLUMN "artifact_size_bytes" integer;--> statement-breakpoint
ALTER TABLE "shipping_note_exports" ADD COLUMN "artifact_mime_type" text;--> statement-breakpoint
CREATE UNIQUE INDEX "shipping_note_exports_artifact_storage_key_uidx" ON "shipping_note_exports" USING btree ("artifact_storage_key");