import { StoryBoardsPage } from "@/frontend/pages/story/story-boards-page";

export default async function StoryRoute({
  params,
}: {
  params: Promise<{ storyId: string }>;
}) {
  const { storyId } = await params;
  return <StoryBoardsPage storyId={storyId} />;
}
