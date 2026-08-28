import { GraphEditorPage } from "@/frontend/pages/graph-editor/graph-editor-page";

export default async function BoardEditorRoute({
  params,
}: {
  params: Promise<{ storyId: string; boardId: string }>;
}) {
  const { storyId, boardId } = await params;
  return <GraphEditorPage storyId={storyId} boardId={boardId} />;
}
