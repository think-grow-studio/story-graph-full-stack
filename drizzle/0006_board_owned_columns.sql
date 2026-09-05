ALTER TABLE "graph_node" ADD COLUMN "board_id" text;
--> statement-breakpoint
ALTER TABLE "graph_node" ADD COLUMN "x" double precision DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "graph_node" ADD COLUMN "y" double precision DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "graph_node" ADD COLUMN "width" double precision;
--> statement-breakpoint
ALTER TABLE "graph_node" ADD COLUMN "height" double precision;
--> statement-breakpoint
ALTER TABLE "graph_node" ADD COLUMN "z_index" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "graph_node" ADD COLUMN "style" jsonb DEFAULT '{}'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "graph_edge" ADD COLUMN "board_id" text;
--> statement-breakpoint
ALTER TABLE "graph_edge" ADD COLUMN "style" jsonb DEFAULT '{}'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "graph_edge" ADD COLUMN "label_presentation" jsonb DEFAULT '{}'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "graph_node" ADD CONSTRAINT "graph_node_board_id_board_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."board"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "graph_edge" ADD CONSTRAINT "graph_edge_board_id_board_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."board"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "graph_node" ADD CONSTRAINT "graph_node_id_board_id_unique" UNIQUE("id","board_id");
--> statement-breakpoint
ALTER TABLE "graph_edge" ADD CONSTRAINT "graph_edge_id_board_id_unique" UNIQUE("id","board_id");
--> statement-breakpoint
ALTER TABLE "graph_edge" ADD CONSTRAINT "graph_edge_source_board_fk" FOREIGN KEY ("source_node_id","board_id") REFERENCES "public"."graph_node"("id","board_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "graph_edge" ADD CONSTRAINT "graph_edge_target_board_fk" FOREIGN KEY ("target_node_id","board_id") REFERENCES "public"."graph_node"("id","board_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "graph_node_board_id_idx" ON "graph_node" USING btree ("board_id");
--> statement-breakpoint
CREATE INDEX "graph_edge_board_id_idx" ON "graph_edge" USING btree ("board_id");
