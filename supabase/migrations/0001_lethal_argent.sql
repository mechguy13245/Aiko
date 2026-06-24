CREATE TABLE "profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"class_range" text NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
