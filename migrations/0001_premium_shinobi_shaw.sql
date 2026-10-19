CREATE TABLE "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"sender_id" integer NOT NULL,
	"sender_type" text NOT NULL,
	"message" text NOT NULL,
	"message_type" text DEFAULT 'text' NOT NULL,
	"metadata" json DEFAULT '{}'::json,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "restaurant_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "location_name" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "location" json DEFAULT '{}'::json;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivery_location_name" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "metadata" json DEFAULT '{}'::json;--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "is_archived" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "latitude" double precision;--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "longitude" double precision;--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "accepts_cash" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "accepts_gcash" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "bank_name" text;--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "account_number" text;--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "account_name" text;--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "gcash_number" text;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
