ALTER TABLE "shipping_notes" ADD COLUMN "container_type" text;--> statement-breakpoint
ALTER TABLE "shipping_notes" ADD COLUMN "cbm" numeric(18, 3);--> statement-breakpoint
ALTER TABLE "shipping_notes" ADD COLUMN "revenue_ton" numeric(18, 3);