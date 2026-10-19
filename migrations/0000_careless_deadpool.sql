CREATE TABLE "customers" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"default_address" text,
	"saved_addresses" json DEFAULT '[]'::json,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "menu_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"restaurant_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price" double precision NOT NULL,
	"discounted_price" double precision,
	"image_url" text,
	"categories" text[],
	"is_available" boolean DEFAULT true,
	"dietary_info" json DEFAULT '{}'::json,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"restaurant_id" integer NOT NULL,
	"rider_id" integer,
	"items" json DEFAULT '[]'::json NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"total_amount" double precision NOT NULL,
	"delivery_fee" double precision DEFAULT 0,
	"payment_method" text NOT NULL,
	"payment_status" text DEFAULT 'pending',
	"payment_reference" text,
	"delivery_address" text NOT NULL,
	"special_instructions" text,
	"estimated_delivery_time" timestamp,
	"actual_delivery_time" timestamp,
	"order_type" text DEFAULT 'food',
	"is_pabili" boolean DEFAULT false,
	"pabili_details" json DEFAULT '{}'::json,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "restaurants" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"address" text NOT NULL,
	"phone" text NOT NULL,
	"email" text NOT NULL,
	"logo_url" text,
	"banner_url" text,
	"is_active" boolean DEFAULT true,
	"is_approved" boolean DEFAULT false,
	"categories" text[],
	"opening_time" text,
	"closing_time" text,
	"delivery_fee" double precision DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "riders" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"license_number" text NOT NULL,
	"vehicle_type" text NOT NULL,
	"vehicle_plate_number" text,
	"status" text DEFAULT 'offline',
	"current_location" json DEFAULT '{}'::json,
	"is_verified" boolean DEFAULT false,
	"queue_position" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"value" text,
	"description" text,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"full_name" text,
	"role" text NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"last_login" timestamp,
	"otp_enabled" boolean DEFAULT false,
	"otp_secret" text,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
