CREATE TABLE "board_tag" (
	"board_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "board_tag_pk" PRIMARY KEY("board_id","name")
);
--> statement-breakpoint
CREATE TABLE "board" (
	"id" text PRIMARY KEY NOT NULL,
	"story_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "graph_edge" (
	"id" text PRIMARY KEY NOT NULL,
	"board_id" text NOT NULL,
	"source_node_id" text NOT NULL,
	"target_node_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"icon_key" text,
	"properties" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"style" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"label_presentation" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "graph_edge_id_board_id_unique" UNIQUE("id","board_id")
);
--> statement-breakpoint
CREATE TABLE "graph_node" (
	"id" text PRIMARY KEY NOT NULL,
	"board_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"icon_key" text,
	"properties" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"x" double precision DEFAULT 0 NOT NULL,
	"y" double precision DEFAULT 0 NOT NULL,
	"width" double precision,
	"height" double precision,
	"z_index" integer DEFAULT 0 NOT NULL,
	"style" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "graph_node_id_board_id_unique" UNIQUE("id","board_id")
);
--> statement-breakpoint
ALTER TABLE "board_tag" ADD CONSTRAINT "board_tag_board_id_board_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."board"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board" ADD CONSTRAINT "board_story_id_story_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."story"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graph_edge" ADD CONSTRAINT "graph_edge_board_id_board_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."board"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graph_edge" ADD CONSTRAINT "graph_edge_source_board_fk" FOREIGN KEY ("source_node_id","board_id") REFERENCES "public"."graph_node"("id","board_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graph_edge" ADD CONSTRAINT "graph_edge_target_board_fk" FOREIGN KEY ("target_node_id","board_id") REFERENCES "public"."graph_node"("id","board_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graph_node" ADD CONSTRAINT "graph_node_board_id_board_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."board"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "board_tag_board_id_idx" ON "board_tag" USING btree ("board_id");--> statement-breakpoint
CREATE INDEX "board_story_id_idx" ON "board" USING btree ("story_id");--> statement-breakpoint
CREATE INDEX "graph_edge_board_id_idx" ON "graph_edge" USING btree ("board_id");--> statement-breakpoint
CREATE INDEX "graph_edge_source_node_id_idx" ON "graph_edge" USING btree ("source_node_id");--> statement-breakpoint
CREATE INDEX "graph_edge_target_node_id_idx" ON "graph_edge" USING btree ("target_node_id");--> statement-breakpoint
CREATE INDEX "graph_node_board_id_idx" ON "graph_node" USING btree ("board_id");