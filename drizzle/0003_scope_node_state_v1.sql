CREATE TABLE "scope" (
	"id" text PRIMARY KEY NOT NULL,
	"story_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "scope_id_story_id_unique" UNIQUE("id","story_id")
);
--> statement-breakpoint
CREATE TABLE "node_state" (
	"scope_id" text NOT NULL,
	"node_id" text NOT NULL,
	"story_id" text NOT NULL,
	"name" text,
	"description" text,
	"properties" jsonb,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "node_state_pk" PRIMARY KEY("scope_id","node_id")
);
--> statement-breakpoint
ALTER TABLE "board" ADD COLUMN "scope_id" text;
--> statement-breakpoint
ALTER TABLE "scope" ADD CONSTRAINT "scope_story_id_story_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."story"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "node_state" ADD CONSTRAINT "node_state_scope_story_fk" FOREIGN KEY ("scope_id","story_id") REFERENCES "public"."scope"("id","story_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "node_state" ADD CONSTRAINT "node_state_node_story_fk" FOREIGN KEY ("node_id","story_id") REFERENCES "public"."graph_node"("id","story_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "board" ADD CONSTRAINT "board_scope_story_fk" FOREIGN KEY ("scope_id","story_id") REFERENCES "public"."scope"("id","story_id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "scope_story_id_idx" ON "scope" USING btree ("story_id");
--> statement-breakpoint
CREATE INDEX "node_state_story_id_idx" ON "node_state" USING btree ("story_id");
--> statement-breakpoint
CREATE INDEX "node_state_node_id_idx" ON "node_state" USING btree ("node_id");
--> statement-breakpoint
CREATE INDEX "board_scope_id_idx" ON "board" USING btree ("scope_id");
