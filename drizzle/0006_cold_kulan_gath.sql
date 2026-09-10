CREATE TABLE "business_partners" (
	"id" text PRIMARY KEY NOT NULL,
	"vendor_code" text,
	"company_name" text NOT NULL,
	"address" text,
	"tax_id" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) DEFAULT now() NOT NULL,
	"deleted_at" timestamp (3)
);
--> statement-breakpoint
CREATE TABLE "partner_categories" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "partner_category_members" (
	"id" text PRIMARY KEY NOT NULL,
	"partner_id" text NOT NULL,
	"category_id" text NOT NULL,
	"created_at" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "partner_contacts" (
	"id" text PRIMARY KEY NOT NULL,
	"partner_id" text NOT NULL,
	"pic_name" text,
	"email" text,
	"phone" text,
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) DEFAULT now() NOT NULL,
	"deleted_at" timestamp (3)
);
--> statement-breakpoint
ALTER TABLE "partner_category_members" ADD CONSTRAINT "partner_category_members_partner_id_business_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."business_partners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_category_members" ADD CONSTRAINT "partner_category_members_category_id_partner_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."partner_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_contacts" ADD CONSTRAINT "partner_contacts_partner_id_business_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."business_partners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "business_partners_company_name_idx" ON "business_partners" USING btree ("company_name");--> statement-breakpoint
CREATE INDEX "business_partners_vendor_code_idx" ON "business_partners" USING btree ("vendor_code");--> statement-breakpoint
CREATE INDEX "business_partners_tax_id_idx" ON "business_partners" USING btree ("tax_id");--> statement-breakpoint
CREATE UNIQUE INDEX "partner_categories_code_uidx" ON "partner_categories" USING btree ("code");--> statement-breakpoint
CREATE INDEX "partner_category_members_partner_id_idx" ON "partner_category_members" USING btree ("partner_id");--> statement-breakpoint
CREATE INDEX "partner_category_members_category_id_idx" ON "partner_category_members" USING btree ("category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "partner_category_members_partner_id_category_id_uidx" ON "partner_category_members" USING btree ("partner_id","category_id");--> statement-breakpoint
CREATE INDEX "partner_contacts_partner_id_idx" ON "partner_contacts" USING btree ("partner_id");