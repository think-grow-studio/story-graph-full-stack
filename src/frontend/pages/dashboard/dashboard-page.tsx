"use client";

import axios from "axios";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { useBootstrapQuery } from "@/frontend/api/auth/bootstrap.queries";
import {
  useCreateStoryMutation,
  useStoriesQuery,
} from "@/frontend/api/story/story.queries";

export function DashboardPage() {
  const router = useRouter();
  const [storyName, setStoryName] = useState("");
  const bootstrap = useBootstrapQuery();
  const workspace = bootstrap.data?.workspace;
  const stories = useStoriesQuery(workspace?.id);
  const createStory = useCreateStoryMutation(workspace?.id);

  useEffect(() => {
    if (
      bootstrap.error &&
      axios.isAxiosError(bootstrap.error) &&
      bootstrap.error.response?.status === 401
    ) {
      router.replace("/login");
    }
  }, [bootstrap.error, router]);

  async function handleCreateStory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = storyName.trim();
    if (!name) return;

    await createStory.mutateAsync({ name, description: "" });
    setStoryName("");
  }

  if (bootstrap.isPending) {
    return <main className="p-8">Loading workspace...</main>;
  }

  if (bootstrap.isError) {
    if (axios.isAxiosError(bootstrap.error) && bootstrap.error.response?.status === 401) {
      return <main className="p-8">Redirecting to login...</main>;
    }
    return <main className="p-8">Unable to load your workspace.</main>;
  }

  return (
    <main className="mx-auto grid min-h-screen max-w-4xl gap-8 p-8">
      <header>
        <p className="text-sm text-neutral-500">Story Graph</p>
        <h1 className="text-3xl font-semibold">{workspace!.name}</h1>
      </header>

      <section className="grid gap-4">
        <div>
          <h2 className="text-xl font-semibold">Stories</h2>
          <p className="text-sm text-neutral-500">Create a story world to start organizing its graph.</p>
        </div>

        <form className="flex gap-2" onSubmit={handleCreateStory}>
          <label className="sr-only" htmlFor="story-name">
            Story name
          </label>
          <input
            className="min-w-0 flex-1 rounded-md border border-neutral-300 px-3 py-2"
            id="story-name"
            name="storyName"
            onChange={(event) => setStoryName(event.target.value)}
            placeholder="Story name"
            value={storyName}
          />
          <button
            className="rounded-md bg-neutral-900 px-4 py-2 font-medium text-white disabled:opacity-50"
            disabled={createStory.isPending || !storyName.trim()}
            type="submit"
          >
            {createStory.isPending ? "Creating..." : "Create Story"}
          </button>
        </form>

        {createStory.isError ? (
          <p className="text-sm text-red-600">Unable to create Story.</p>
        ) : null}

        {stories.isPending ? <p>Loading Stories...</p> : null}
        {stories.isError ? <p>Unable to load Stories.</p> : null}
        {stories.data?.length === 0 ? <p>No Stories yet.</p> : null}
        {stories.data?.length ? (
          <ul className="grid gap-2">
            {stories.data.map((story) => (
              <li className="rounded-md border border-neutral-200 p-4" key={story.id}>
                <Link
                  className="font-semibold underline-offset-4 hover:underline"
                  href={`/stories/${story.id}`}
                >
                  {story.name}
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </main>
  );
}
