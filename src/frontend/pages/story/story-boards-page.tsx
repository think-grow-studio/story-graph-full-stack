"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { useBootstrapQuery } from "@/frontend/api/auth/bootstrap.queries";
import {
  useBoardsQuery,
  useCreateBoardMutation,
} from "@/frontend/api/graph/graph.queries";
import { useStoryQuery } from "@/frontend/api/story/story.queries";

export function StoryBoardsPage({ storyId }: { storyId: string }) {
  const [boardName, setBoardName] = useState("");
  const bootstrap = useBootstrapQuery();
  const workspaceId = bootstrap.data?.workspace.id;
  const story = useStoryQuery(workspaceId, storyId);
  const boards = useBoardsQuery(workspaceId, storyId);
  const createBoard = useCreateBoardMutation(workspaceId, storyId);

  async function handleCreateBoard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = boardName.trim();
    if (!name) return;

    await createBoard.mutateAsync({ name, description: "" });
    setBoardName("");
  }

  if (bootstrap.isPending || story.isPending) {
    return <main className="p-8">Loading Story...</main>;
  }

  if (bootstrap.isError || story.isError) {
    return <main className="p-8">Unable to load Story.</main>;
  }

  return (
    <main className="mx-auto grid min-h-screen max-w-4xl gap-8 p-8">
      <header className="grid gap-2">
        <Link className="text-sm text-neutral-500" href="/dashboard">
          ← Stories
        </Link>
        <h1 className="text-3xl font-semibold">{story.data.name}</h1>
        {story.data.description ? (
          <p className="text-neutral-600">{story.data.description}</p>
        ) : null}
      </header>

      <section className="grid gap-4">
        <div>
          <h2 className="text-xl font-semibold">Boards</h2>
          <p className="text-sm text-neutral-500">
            Boards are views over the Story graph.
          </p>
        </div>

        <form className="flex gap-2" onSubmit={handleCreateBoard}>
          <label className="sr-only" htmlFor="board-name">
            Board name
          </label>
          <input
            className="min-w-0 flex-1 rounded-md border border-neutral-300 px-3 py-2"
            id="board-name"
            name="boardName"
            onChange={(event) => setBoardName(event.target.value)}
            placeholder="Board name"
            value={boardName}
          />
          <button
            className="rounded-md bg-neutral-900 px-4 py-2 font-medium text-white disabled:opacity-50"
            disabled={createBoard.isPending || !boardName.trim()}
            type="submit"
          >
            {createBoard.isPending ? "Creating..." : "Create Board"}
          </button>
        </form>

        {createBoard.isError ? (
          <p className="text-sm text-red-600">Unable to create Board.</p>
        ) : null}

        {boards.isPending ? <p>Loading Boards...</p> : null}
        {boards.isError ? <p>Unable to load Boards.</p> : null}
        {boards.data?.length === 0 ? <p>No Boards yet.</p> : null}
        {boards.data?.length ? (
          <ul className="grid gap-2">
            {boards.data.map((board) => (
              <li className="rounded-md border border-neutral-200 p-4" key={board.id}>
                <Link
                  className="font-semibold underline-offset-4 hover:underline"
                  href={`/stories/${storyId}/boards/${board.id}`}
                >
                  {board.name}
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </main>
  );
}
