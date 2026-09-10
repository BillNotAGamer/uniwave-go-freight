CREATE TYPE "public"."service_catalog_nature" AS ENUM('service', 'tool_supply', 'goods');--> statement-breakpoint
CREATE TABLE "service_catalog_items" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"nature" "service_catalog_nature" NOT NULL,
	"primary_unit" text,
	"vat_rate" numeric(6, 2),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) DEFAULT now() NOT NULL,
	"deleted_at" timestamp (3)
);
--> statement-breakpoint
CREATE TABLE "service_catalog_unit_conversions" (
	"id" text PRIMARY KEY NOT NULL,
	"service_catalog_item_id" text NOT NULL,
	"converted_unit" text NOT NULL,
	"conversion_factor" numeric(18, 6) NOT NULL,
	"operation" text NOT NULL,
	"source_description" text,
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) DEFAULT now() NOT NULL,
	"deleted_at" timestamp (3)
);
--> statement-breakpoint
ALTER TABLE "service_catalog_unit_conversions" ADD CONSTRAINT "service_catalog_unit_conversions_service_catalog_item_id_service_catalog_items_id_fk" FOREIGN KEY ("service_catalog_item_id") REFERENCES "public"."service_catalog_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "service_catalog_items_code_uidx" ON "service_catalog_items" USING btree ("code");--> statement-breakpoint
CREATE INDEX "service_catalog_items_name_idx" ON "service_catalog_items" USING btree ("name");--> statement-breakpoint
CREATE INDEX "service_catalog_unit_conversions_item_id_idx" ON "service_catalog_unit_conversions" USING btree ("service_catalog_item_id");