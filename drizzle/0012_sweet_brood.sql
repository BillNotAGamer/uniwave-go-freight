CREATE TYPE "public"."routing_location_applicability" AS ENUM('sea_pol', 'sea_pod', 'sea_final_destination', 'air_aol', 'air_aod', 'air_final_destination', 'domestic_origin', 'domestic_destination', 'custom_origin', 'custom_destination');--> statement-breakpoint
CREATE TYPE "public"."routing_location_type" AS ENUM('airport', 'seaport', 'inland', 'other');--> statement-breakpoint
CREATE TABLE "routing_location_applicabilities" (
	"id" text PRIMARY KEY NOT NULL,
	"location_id" text NOT NULL,
	"applicability" "routing_location_applicability" NOT NULL,
	"created_at" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "routing_locations" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"type" "routing_location_type" NOT NULL,
	"country_code" text,
	"subdivision" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) DEFAULT now() NOT NULL,
	"deleted_at" timestamp (3)
);
--> statement-breakpoint
ALTER TABLE "routing_location_applicabilities" ADD CONSTRAINT "routing_location_applicabilities_location_id_routing_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."routing_locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "routing_location_applicabilities_location_id_idx" ON "routing_location_applicabilities" USING btree ("location_id");--> statement-breakpoint
CREATE UNIQUE INDEX "routing_location_applicabilities_location_id_applicability_uidx" ON "routing_location_applicabilities" USING btree ("location_id","applicability");--> statement-breakpoint
CREATE UNIQUE INDEX "routing_locations_type_code_uidx" ON "routing_locations" USING btree ("type","code");--> statement-breakpoint
CREATE INDEX "routing_locations_code_idx" ON "routing_locations" USING btree ("code");--> statement-breakpoint
CREATE INDEX "routing_locations_name_idx" ON "routing_locations" USING btree ("name");