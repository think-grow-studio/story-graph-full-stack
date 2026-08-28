CREATE TABLE "graph_node" (
	"id" text PRIMARY KEY NOT NULL,
	"story_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"icon_key" text,
	"properties" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "graph_edge" (
	"id" text PRIMARY KEY NOT NULL,
	"story_id" text NOT NULL,
	"source_node_id" text NOT NULL,
	"target_node_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"icon_key" text,
	"properties" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "graph_node" ADD CONSTRAINT "graph_node_story_id_story_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."story"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graph_edge" ADD CONSTRAINT "graph_edge_story_id_story_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."story"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graph_edge" ADD CONSTRAINT "graph_edge_source_node_id_graph_node_id_fk" FOREIGN KEY ("source_node_id") REFERENCES "public"."graph_node"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graph_edge" ADD CONSTRAINT "graph_edge_target_node_id_graph_node_id_fk" FOREIGN KEY ("target_node_id") REFERENCES "public"."graph_node"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "graph_node_storyId_idx" ON "graph_node" USING btree ("story_id");--> statement-breakpoint
CREATE INDEX "graph_edge_storyId_idx" ON "graph_edge" USING btree ("story_id");--> statement-breakpoint
CREATE INDEX "graph_edge_sourceNodeId_idx" ON "graph_edge" USING btree ("source_node_id");--> statement-breakpoint
CREATE INDEX "graph_edge_targetNodeId_idx" ON "graph_edge" USING btree ("target_node_id");
