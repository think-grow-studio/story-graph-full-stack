CREATE TABLE "board" (
	"id" text PRIMARY KEY NOT NULL,
	"story_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "board_id_story_id_unique" UNIQUE("id","story_id")
);
--> statement-breakpoint
CREATE TABLE "board_edge" (
	"board_id" text NOT NULL,
	"edge_id" text NOT NULL,
	"story_id" text NOT NULL,
	"style" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"label_presentation" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "board_edge_pk" PRIMARY KEY("board_id","edge_id")
);
--> statement-breakpoint
CREATE TABLE "board_node" (
	"board_id" text NOT NULL,
	"node_id" text NOT NULL,
	"story_id" text NOT NULL,
	"x" double precision NOT NULL,
	"y" double precision NOT NULL,
	"width" double precision,
	"height" double precision,
	"z_index" integer DEFAULT 0 NOT NULL,
	"style" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "board_node_pk" PRIMARY KEY("board_id","node_id")
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
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "graph_edge_id_story_id_unique" UNIQUE("id","story_id")
);
--> statement-breakpoint
CREATE TABLE "graph_node" (
	"id" text PRIMARY KEY NOT NULL,
	"story_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"icon_key" text,
	"properties" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "graph_node_id_story_id_unique" UNIQUE("id","story_id")
);
--> statement-breakpoint
ALTER TABLE "board" ADD CONSTRAINT "board_story_id_story_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."story"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_edge" ADD CONSTRAINT "board_edge_board_story_fk" FOREIGN KEY ("board_id","story_id") REFERENCES "public"."board"("id","story_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_edge" ADD CONSTRAINT "board_edge_edge_story_fk" FOREIGN KEY ("edge_id","story_id") REFERENCES "public"."graph_edge"("id","story_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_node" ADD CONSTRAINT "board_node_board_story_fk" FOREIGN KEY ("board_id","story_id") REFERENCES "public"."board"("id","story_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_node" ADD CONSTRAINT "board_node_node_story_fk" FOREIGN KEY ("node_id","story_id") REFERENCES "public"."graph_node"("id","story_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graph_edge" ADD CONSTRAINT "graph_edge_story_id_story_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."story"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graph_edge" ADD CONSTRAINT "graph_edge_source_story_fk" FOREIGN KEY ("source_node_id","story_id") REFERENCES "public"."graph_node"("id","story_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graph_edge" ADD CONSTRAINT "graph_edge_target_story_fk" FOREIGN KEY ("target_node_id","story_id") REFERENCES "public"."graph_node"("id","story_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graph_node" ADD CONSTRAINT "graph_node_story_id_story_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."story"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "board_story_id_idx" ON "board" USING btree ("story_id");--> statement-breakpoint
CREATE INDEX "board_edge_story_id_idx" ON "board_edge" USING btree ("story_id");--> statement-breakpoint
CREATE INDEX "board_edge_edge_id_idx" ON "board_edge" USING btree ("edge_id");--> statement-breakpoint
CREATE INDEX "board_node_story_id_idx" ON "board_node" USING btree ("story_id");--> statement-breakpoint
CREATE INDEX "board_node_node_id_idx" ON "board_node" USING btree ("node_id");--> statement-breakpoint
CREATE INDEX "graph_edge_story_id_idx" ON "graph_edge" USING btree ("story_id");--> statement-breakpoint
CREATE INDEX "graph_edge_source_node_id_idx" ON "graph_edge" USING btree ("source_node_id");--> statement-breakpoint
CREATE INDEX "graph_edge_target_node_id_idx" ON "graph_edge" USING btree ("target_node_id");--> statement-breakpoint
CREATE INDEX "graph_node_story_id_idx" ON "graph_node" USING btree ("story_id");