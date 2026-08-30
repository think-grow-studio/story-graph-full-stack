"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";

import { useBootstrapQuery } from "@/frontend/api/auth/bootstrap.queries";
import {
  useBoardsQuery,
  useCreateBoardMutation,
  useCreateScopeMutation,
  useScopesQuery,
} from "@/frontend/api/graph/graph.queries";
import { useStoryQuery } from "@/frontend/api/story/story.queries";

export function StoryBoardsPage({ storyId }: { storyId: string }) {
  const [scopeName, setScopeName] = useState("");
  const [boardName, setBoardName] = useState("");
  const [selectedScopeId, setSelectedScopeId] = useState("");
  const bootstrap = useBootstrapQuery();
  const workspaceId = bootstrap.data?.workspace.id;
  const story = useStoryQuery(workspaceId, storyId);
  const scopes = useScopesQuery(workspaceId, storyId);
  const boards = useBoardsQuery(workspaceId, storyId);
  const createScope = useCreateScopeMutation(workspaceId, storyId);
  const createBoard = useCreateBoardMutation(workspaceId, storyId);
  const scopeById = useMemo(
    () => new Map((scopes.data ?? []).map((scope) => [scope.id, scope])),
    [scopes.data],
  );

  async function handleCreateScope(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = scopeName.trim();
    if (!name) return;

    await createScope.mutateAsync({ name, description: "" });
    setScopeName("");
  }

  async function handleCreateBoard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = boardName.trim();
    if (!name) return;

    await createBoard.mutateAsync({
      name,
      description: "",
      scopeId: selectedScopeId || null,
    });
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
          <h2 className="text-xl font-semibold">Scopes</h2>
          <p className="text-sm text-neutral-500">
            Scopes hold contextual Node state for chapters, scenes, or timelines.
          </p>
        </div>

        <form className="flex gap-2" onSubmit={handleCreateScope}>
          <label className="sr-only" htmlFor="scope-name">
            Scope name
          </label>
          <input
            className="min-w-0 flex-1 rounded-md border border-neutral-300 px-3 py-2"
            id="scope-name"
            name="scopeName"
            onChange={(event) => setScopeName(event.target.value)}
            placeholder="Scope name"
            value={scopeName}
          />
          <button
            className="rounded-md bg-neutral-900 px-4 py-2 font-medium text-white disabled:opacity-50"
            disabled={createScope.isPending || !scopeName.trim()}
            type="submit"
          >
            {createScope.isPending ? "Creating..." : "Create Scope"}
          </button>
        </form>

        {createScope.isError ? (
          <p className="text-sm text-red-600">Unable to create Scope.</p>
        ) : null}
        {scopes.isPending ? <p>Loading Scopes...</p> : null}
        {scopes.isError ? <p>Unable to load Scopes.</p> : null}
        {scopes.data?.length === 0 ? <p>No Scopes yet.</p> : null}
        {scopes.data?.length ? (
          <ul className="grid gap-2 sm:grid-cols-2">
            {scopes.data.map((scope) => (
              <li className="rounded-md border border-neutral-200 p-4" key={scope.id}>
                <strong>{scope.name}</strong>
                {scope.description ? (
                  <p className="mt-1 text-sm text-neutral-500">{scope.description}</p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="grid gap-4">
        <div>
          <h2 className="text-xl font-semibold">Boards</h2>
          <p className="text-sm text-neutral-500">
            Boards are views over the Story graph. A Board can optionally use one Scope.
          </p>
        </div>

        <form className="grid gap-2 sm:grid-cols-[1fr_180px_auto]" onSubmit={handleCreateBoard}>
          <label className="sr-only" htmlFor="board-name">
            Board name
          </label>
          <input
            className="min-w-0 rounded-md border border-neutral-300 px-3 py-2"
            id="board-name"
            name="boardName"
            onChange={(event) => setBoardName(event.target.value)}
            placeholder="Board name"
            value={boardName}
          />
          <label className="sr-only" htmlFor="board-scope">
            Board scope
          </label>
          <select
            className="rounded-md border border-neutral-300 px-3 py-2"
            id="board-scope"
            name="boardScope"
            onChange={(event) => setSelectedScopeId(event.target.value)}
            value={selectedScopeId}
          >
            <option value="">No Scope</option>
            {(scopes.data ?? []).map((scope) => (
              <option key={scope.id} value={scope.id}>
                {scope.name}
              </option>
            ))}
          </select>
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
            {boards.data.map((board) => {
              const scope = board.scopeId ? scopeById.get(board.scopeId) : null;
              return (
                <li className="rounded-md border border-neutral-200 p-4" key={board.id}>
                  <Link
                    className="font-semibold underline-offset-4 hover:underline"
                    href={`/stories/${storyId}/boards/${board.id}`}
                  >
                    {board.name}
                  </Link>
                  <p className="mt-1 text-sm text-neutral-500">
                    {scope ? `Scope: ${scope.name}` : "No Scope"}
                  </p>
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>
    </main>
  );
}
