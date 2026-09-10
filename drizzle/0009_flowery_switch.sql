CREATE TABLE "shipping_note_customs_declarations" (
	"id" text PRIMARY KEY NOT NULL,
	"shipping_note_id" text NOT NULL,
	"declaration_no" text NOT NULL,
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) DEFAULT now() NOT NULL,
	"deleted_at" timestamp (3)
);
--> statement-breakpoint
ALTER TABLE "shipping_note_charges" ADD COLUMN "service_catalog_item_id" text;--> statement-breakpoint
ALTER TABLE "shipping_note_charges" ADD COLUMN "catalog_code_snapshot" text;--> statement-breakpoint
ALTER TABLE "shipping_note_charges" ADD COLUMN "catalog_name_snapshot" text;--> statement-breakpoint
ALTER TABLE "shipping_note_charges" ADD COLUMN "catalog_unit_snapshot" text;--> statement-breakpoint
ALTER TABLE "shipping_note_charges" ADD COLUMN "catalog_vat_rate_snapshot" numeric(6, 2);--> statement-breakpoint
ALTER TABLE "shipping_note_charges" ADD COLUMN "vat_override_rate" numeric(6, 2);--> statement-breakpoint
ALTER TABLE "shipping_note_customs_declarations" ADD CONSTRAINT "shipping_note_customs_declarations_shipping_note_id_shipping_notes_id_fk" FOREIGN KEY ("shipping_note_id") REFERENCES "public"."shipping_notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "shipping_note_customs_declarations_shipping_note_id_idx" ON "shipping_note_customs_declarations" USING btree ("shipping_note_id");--> statement-breakpoint
CREATE UNIQUE INDEX "shipping_note_customs_declarations_active_note_number_uidx" ON "shipping_note_customs_declarations" USING btree ("shipping_note_id","declaration_no") WHERE "shipping_note_customs_declarations"."deleted_at" is null;--> statement-breakpoint
ALTER TABLE "shipping_note_charges" ADD CONSTRAINT "shipping_note_charges_service_catalog_item_id_service_catalog_items_id_fk" FOREIGN KEY ("service_catalog_item_id") REFERENCES "public"."service_catalog_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "shipping_note_charges_service_catalog_item_id_idx" ON "shipping_note_charges" USING btree ("service_catalog_item_id");--> statement-breakpoint
ALTER TABLE "shipping_note_charges" ADD CONSTRAINT "shipping_note_charges_vat_override_rate_check" CHECK ("shipping_note_charges"."vat_override_rate" is null or "shipping_note_charges"."vat_override_rate" in (0, 5, 8, 10));