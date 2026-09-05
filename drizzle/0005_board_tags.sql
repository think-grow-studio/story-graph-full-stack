CREATE TABLE "board_tag" (
  "board_id" text NOT NULL,
  "name" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "board_tag_pk" PRIMARY KEY("board_id","name")
);
--> statement-breakpoint
ALTER TABLE "board_tag" ADD CONSTRAINT "board_tag_board_id_board_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."board"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "board_tag_board_id_idx" ON "board_tag" USING btree ("board_id");
