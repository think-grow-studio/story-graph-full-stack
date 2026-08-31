CREATE TABLE "edge_state" (
	"scope_id" text NOT NULL,
	"edge_id" text NOT NULL,
	"story_id" text NOT NULL,
	"name" text,
	"description" text,
	"properties" jsonb,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "edge_state_pk" PRIMARY KEY("scope_id","edge_id")
);
--> statement-breakpoint
ALTER TABLE "edge_state" ADD CONSTRAINT "edge_state_scope_story_fk" FOREIGN KEY ("scope_id","story_id") REFERENCES "public"."scope"("id","story_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "edge_state" ADD CONSTRAINT "edge_state_edge_story_fk" FOREIGN KEY ("edge_id","story_id") REFERENCES "public"."graph_edge"("id","story_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "edge_state_story_id_idx" ON "edge_state" USING btree ("story_id");
--> statement-breakpoint
CREATE INDEX "edge_state_edge_id_idx" ON "edge_state" USING btree ("edge_id");
