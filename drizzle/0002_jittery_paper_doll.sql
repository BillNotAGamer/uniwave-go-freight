CREATE TYPE "public"."tax_treatment" AS ENUM('taxable', 'zero_rated', 'non_taxable');--> statement-breakpoint
ALTER TABLE "shipping_note_charges" ADD COLUMN "tax_rule_id" text;--> statement-breakpoint
ALTER TABLE "shipping_note_charges" ADD COLUMN "tax_rule_code_snapshot" text;--> statement-breakpoint
ALTER TABLE "shipping_note_charges" ADD COLUMN "tax_rule_name_snapshot" text;--> statement-breakpoint
ALTER TABLE "shipping_note_charges" ADD COLUMN "tax_treatment_snapshot" "tax_treatment";--> statement-breakpoint
ALTER TABLE "tax_rules" ADD COLUMN "code" text NOT NULL;--> statement-breakpoint
ALTER TABLE "tax_rules" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "tax_rules" ADD COLUMN "tax_treatment" "tax_treatment" NOT NULL;--> statement-breakpoint
ALTER TABLE "shipping_note_charges" ADD CONSTRAINT "shipping_note_charges_tax_rule_id_tax_rules_id_fk" FOREIGN KEY ("tax_rule_id") REFERENCES "public"."tax_rules"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "shipping_note_charges_tax_rule_id_idx" ON "shipping_note_charges" USING btree ("tax_rule_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tax_rules_code_uidx" ON "tax_rules" USING btree ("code");