ALTER TABLE "shipping_notes" ADD COLUMN "shipper_partner_id" text;--> statement-breakpoint
ALTER TABLE "shipping_notes" ADD COLUMN "consignee_partner_id" text;--> statement-breakpoint
ALTER TABLE "shipping_notes" ADD COLUMN "customer_partner_id" text;--> statement-breakpoint
ALTER TABLE "shipping_notes" ADD COLUMN "agent_partner_id" text;--> statement-breakpoint
ALTER TABLE "shipping_notes" ADD COLUMN "domestic_origin" text;--> statement-breakpoint
ALTER TABLE "shipping_notes" ADD COLUMN "domestic_destination" text;--> statement-breakpoint
ALTER TABLE "shipping_notes" ADD COLUMN "port_of_loading" text;--> statement-breakpoint
ALTER TABLE "shipping_notes" ADD COLUMN "port_of_discharge" text;--> statement-breakpoint
ALTER TABLE "shipping_notes" ADD COLUMN "mawb_no" text;--> statement-breakpoint
ALTER TABLE "shipping_notes" ADD COLUMN "hawb_no" text;--> statement-breakpoint
ALTER TABLE "shipping_notes" ADD COLUMN "mbl_no" text;--> statement-breakpoint
ALTER TABLE "shipping_notes" ADD COLUMN "hbl_no" text;--> statement-breakpoint
ALTER TABLE "shipping_notes" ADD COLUMN "flight_no" text;--> statement-breakpoint
ALTER TABLE "shipping_notes" ADD COLUMN "vessel_name" text;--> statement-breakpoint
ALTER TABLE "shipping_notes" ADD COLUMN "voyage_no" text;--> statement-breakpoint
ALTER TABLE "shipping_notes" ADD CONSTRAINT "shipping_notes_shipper_partner_id_business_partners_id_fk" FOREIGN KEY ("shipper_partner_id") REFERENCES "public"."business_partners"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipping_notes" ADD CONSTRAINT "shipping_notes_consignee_partner_id_business_partners_id_fk" FOREIGN KEY ("consignee_partner_id") REFERENCES "public"."business_partners"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipping_notes" ADD CONSTRAINT "shipping_notes_customer_partner_id_business_partners_id_fk" FOREIGN KEY ("customer_partner_id") REFERENCES "public"."business_partners"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipping_notes" ADD CONSTRAINT "shipping_notes_agent_partner_id_business_partners_id_fk" FOREIGN KEY ("agent_partner_id") REFERENCES "public"."business_partners"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "shipping_notes_shipper_partner_id_idx" ON "shipping_notes" USING btree ("shipper_partner_id");--> statement-breakpoint
CREATE INDEX "shipping_notes_consignee_partner_id_idx" ON "shipping_notes" USING btree ("consignee_partner_id");--> statement-breakpoint
CREATE INDEX "shipping_notes_customer_partner_id_idx" ON "shipping_notes" USING btree ("customer_partner_id");--> statement-breakpoint
CREATE INDEX "shipping_notes_agent_partner_id_idx" ON "shipping_notes" USING btree ("agent_partner_id");