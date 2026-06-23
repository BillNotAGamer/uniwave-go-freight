CREATE TYPE "public"."charge_section" AS ENUM('selling', 'buying');--> statement-breakpoint
CREATE TYPE "public"."currency_code" AS ENUM('VND', 'USD');--> statement-breakpoint
CREATE TYPE "public"."export_status" AS ENUM('pending', 'generated', 'uploaded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."export_type" AS ENUM('excel', 'pdf');--> statement-breakpoint
CREATE TYPE "public"."shipping_mode" AS ENUM('domestic_truck', 'sea_export', 'sea_import', 'air_export', 'air_import');--> statement-breakpoint
CREATE TYPE "public"."shipping_note_status" AS ENUM('draft', 'submitted', 'accounting_reviewing', 'checked', 'approved', 'exported', 'locked', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('sale', 'accountant', 'admin');--> statement-breakpoint
CREATE TYPE "public"."volume_unit" AS ENUM('kgs', 'cbm', 'cont_20', 'cont_40', 'rt');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_user_id" text,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"reason" text,
	"created_at" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shipping_note_charges" (
	"id" text PRIMARY KEY NOT NULL,
	"shipping_note_id" text NOT NULL,
	"section" charge_section NOT NULL,
	"charge_name" text NOT NULL,
	"description" text,
	"quantity" numeric(18, 3) NOT NULL,
	"unit" text,
	"unit_price" numeric(18, 4) NOT NULL,
	"currency" "currency_code" DEFAULT 'VND' NOT NULL,
	"exchange_rate" numeric(18, 6) DEFAULT '1' NOT NULL,
	"amount_original" numeric(20, 4) NOT NULL,
	"amount_vnd" numeric(20, 2) NOT NULL,
	"vat_percent" numeric(6, 2) DEFAULT '0' NOT NULL,
	"vat_amount" numeric(20, 2) DEFAULT '0' NOT NULL,
	"vendor_or_agent_text" text,
	"is_override" boolean DEFAULT false NOT NULL,
	"override_reason" text,
	"created_by_id" text,
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) DEFAULT now() NOT NULL,
	"deleted_at" timestamp (3)
);
--> statement-breakpoint
CREATE TABLE "shipping_note_exports" (
	"id" text PRIMARY KEY NOT NULL,
	"shipping_note_id" text NOT NULL,
	"export_type" "export_type" NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"status" "export_status" DEFAULT 'pending' NOT NULL,
	"drive_file_id" text,
	"drive_url" text,
	"file_name" text,
	"checksum" text,
	"error_message" text,
	"generated_by_id" text,
	"generated_at" timestamp (3),
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shipping_notes" (
	"id" text PRIMARY KEY NOT NULL,
	"jobsheet_no" text NOT NULL,
	"mawb_hawb_no" text,
	"shipping_mode" "shipping_mode" DEFAULT 'domestic_truck' NOT NULL,
	"shipper_text" text,
	"consignee_text" text,
	"customer_text" text,
	"agent_text" text,
	"aol" text,
	"aod" text,
	"final_destination" text,
	"etd" timestamp (3),
	"eta" timestamp (3),
	"volume_value" numeric(18, 3),
	"volume_unit" "volume_unit",
	"exchange_rate" numeric(18, 6) DEFAULT '1' NOT NULL,
	"status" "shipping_note_status" DEFAULT 'draft' NOT NULL,
	"created_by_id" text,
	"submitted_at" timestamp (3),
	"checked_by_id" text,
	"approved_by_id" text,
	"locked_at" timestamp (3),
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) DEFAULT now() NOT NULL,
	"deleted_at" timestamp (3),
	CONSTRAINT "shipping_notes_jobsheet_no_unique" UNIQUE("jobsheet_no")
);
--> statement-breakpoint
CREATE TABLE "tax_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"shipping_mode" "shipping_mode" NOT NULL,
	"charge_section" charge_section NOT NULL,
	"charge_name_pattern" text NOT NULL,
	"vat_percent" numeric(6, 2) DEFAULT '0' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"effective_from" timestamp (3),
	"effective_to" timestamp (3),
	"created_by_id" text,
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"role" "user_role" DEFAULT 'sale' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) DEFAULT now() NOT NULL,
	"deleted_at" timestamp (3),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipping_note_charges" ADD CONSTRAINT "shipping_note_charges_shipping_note_id_shipping_notes_id_fk" FOREIGN KEY ("shipping_note_id") REFERENCES "public"."shipping_notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipping_note_charges" ADD CONSTRAINT "shipping_note_charges_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipping_note_exports" ADD CONSTRAINT "shipping_note_exports_shipping_note_id_shipping_notes_id_fk" FOREIGN KEY ("shipping_note_id") REFERENCES "public"."shipping_notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipping_note_exports" ADD CONSTRAINT "shipping_note_exports_generated_by_id_users_id_fk" FOREIGN KEY ("generated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipping_notes" ADD CONSTRAINT "shipping_notes_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipping_notes" ADD CONSTRAINT "shipping_notes_checked_by_id_users_id_fk" FOREIGN KEY ("checked_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipping_notes" ADD CONSTRAINT "shipping_notes_approved_by_id_users_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_rules" ADD CONSTRAINT "tax_rules_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_entity_lookup_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "shipping_note_charges_shipping_note_id_idx" ON "shipping_note_charges" USING btree ("shipping_note_id");--> statement-breakpoint
CREATE INDEX "shipping_note_exports_shipping_note_id_idx" ON "shipping_note_exports" USING btree ("shipping_note_id");--> statement-breakpoint
CREATE INDEX "shipping_notes_status_idx" ON "shipping_notes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "shipping_notes_created_by_id_idx" ON "shipping_notes" USING btree ("created_by_id");--> statement-breakpoint
CREATE INDEX "tax_rules_lookup_idx" ON "tax_rules" USING btree ("shipping_mode","charge_section","is_active");