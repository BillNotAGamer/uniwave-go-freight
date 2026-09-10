ALTER TYPE "public"."shipping_mode" ADD VALUE 'custom';--> statement-breakpoint
ALTER TABLE "shipping_notes" ADD COLUMN "custom_mode_name" text;--> statement-breakpoint
ALTER TABLE "shipping_notes" ADD COLUMN "custom_origin" text;--> statement-breakpoint
ALTER TABLE "shipping_notes" ADD COLUMN "custom_destination" text;