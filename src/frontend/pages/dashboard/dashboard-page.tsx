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
import { Button } from "@/frontend/shared/ui/button";
import { Dialog } from "@/frontend/shared/ui/dialog";
import { EmptyState } from "@/frontend/shared/ui/empty-state";
import { TextAreaField, TextField } from "@/frontend/shared/ui/form-field";
import { StatusMessage } from "@/frontend/shared/ui/status-message";
import { AppShell } from "@/frontend/widgets/app-shell/app-shell";

export function DashboardPage() {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [storyName, setStoryName] = useState("");
  const [description, setDescription] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
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

  function openCreateDialog() {
    setStoryName("");
    setDescription("");
    setNameError(null);
    createStory.reset();
    setCreateOpen(true);
  }

  async function handleCreateStory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = storyName.trim();
    if (!name) {
      setNameError("이야기 이름을 입력해 주세요.");
      return;
    }

    setNameError(null);
    try {
      const created = await createStory.mutateAsync({
        name,
        description: description.trim(),
      });
      setCreateOpen(false);
      router.push(`/stories/${created.id}`);
    } catch {
      // Mutation state owns the user-visible failure message.
    }
  }

  if (bootstrap.isPending) {
    return (
      <main className="grid min-h-screen place-items-center bg-[var(--sg-canvas)] p-8">
        <p className="text-sm text-[var(--sg-muted)]">작업 공간을 불러오고 있습니다.</p>
      </main>
    );
  }

  if (bootstrap.isError) {
    if (axios.isAxiosError(bootstrap.error) && bootstrap.error.response?.status === 401) {
      return (
        <main className="grid min-h-screen place-items-center bg-[var(--sg-canvas)] p-8">
          <p className="text-sm text-[var(--sg-muted)]">로그인 화면으로 이동하고 있습니다.</p>
        </main>
      );
    }

    return (
      <main className="grid min-h-screen place-items-center bg-[var(--sg-canvas)] p-8">
        <div className="grid max-w-sm gap-4">
          <StatusMessage tone="danger">
            작업 공간을 불러오지 못했습니다. 다시 시도해 주세요.
          </StatusMessage>
          <Button emphasis="outline" intent="neutral" onClick={() => void bootstrap.refetch()}>
            다시 시도
          </Button>
        </div>
      </main>
    );
  }

  return (
    <AppShell
      action={<Button onClick={openCreateDialog}>새 이야기</Button>}
      actor={bootstrap.data.actor}
      description="인물과 사건이 연결될 세계를 만들거나, 작업하던 이야기를 이어가세요."
      title="내 이야기"
    >
      {stories.isPending ? (
        <div aria-busy="true" className="grid gap-3" role="status">
          <div className="h-24 animate-pulse rounded-[var(--sg-radius-md)] border border-[var(--sg-line)] bg-[var(--sg-surface)]" />
          <span className="sr-only">이야기를 불러오고 있습니다.</span>
        </div>
      ) : null}

      {stories.isError ? (
        <div className="grid max-w-lg gap-4">
          <StatusMessage tone="danger">
            이야기를 불러오지 못했습니다. 다시 시도해 주세요.
          </StatusMessage>
          <Button
            className="w-fit"
            emphasis="outline"
            intent="neutral"
            onClick={() => void stories.refetch()}
          >
            다시 시도
          </Button>
        </div>
      ) : null}

      {stories.data?.length === 0 ? (
        <EmptyState
          action={<Button onClick={openCreateDialog}>첫 이야기 시작하기</Button>}
          description="인물, 장소, 사건과 관계를 담을 첫 이야기 공간을 만들어 보세요."
          title="아직 이야기가 없습니다"
          visual={
            <div className="relative h-12 w-20">
              <span className="absolute left-1 top-5 size-3 rounded-full bg-[var(--sg-brand)]" />
              <span className="absolute right-1 top-1 size-3 rounded-full border-2 border-[var(--sg-brand)] bg-white" />
              <span className="absolute bottom-0 right-5 size-3 rounded-full border-2 border-[var(--sg-brand)] bg-white" />
              <span className="absolute left-3 top-6 h-px w-14 -rotate-[20deg] bg-[var(--sg-brand)]" />
            </div>
          }
        />
      ) : null}

      {stories.data?.length ? (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {stories.data.map((story) => (
            <li key={story.id}>
              <Link
                aria-label={story.name}
                className="group block min-h-40 rounded-[var(--sg-radius-md)] border border-[var(--sg-line)] bg-[var(--sg-surface)] p-5 transition-[border-color,box-shadow] duration-150 hover:border-[color-mix(in_srgb,var(--sg-brand)_35%,var(--sg-line))] hover:shadow-[0_10px_28px_rgba(23,25,29,0.05)]"
                href={`/stories/${story.id}`}
              >
                <p className="text-xs font-semibold text-[var(--sg-muted)]">이야기</p>
                <h2 className="mt-2 text-lg font-bold tracking-[-0.02em] group-hover:text-[var(--sg-brand-strong)]">
                  {story.name}
                </h2>
                {story.description ? (
                  <p className="mt-3 line-clamp-3 text-sm leading-6 text-[var(--sg-muted)]">
                    {story.description}
                  </p>
                ) : (
                  <p className="mt-3 text-sm text-[var(--sg-muted)]">설명 없이 시작한 이야기</p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      <Dialog
        description="이름은 필수이고 설명은 나중에 채워도 됩니다."
        onClose={() => {
          if (!createStory.isPending) setCreateOpen(false);
        }}
        open={createOpen}
        title="새 이야기"
      >
        <form className="grid gap-4" onSubmit={handleCreateStory}>
          <TextField
            autoFocus
            error={nameError}
            label="이야기 이름"
            onChange={(event) => {
              setStoryName(event.target.value);
              if (event.target.value.trim()) setNameError(null);
            }}
            placeholder="예: 왕관 없는 도시"
            value={storyName}
          />
          <TextAreaField
            label="설명"
            onChange={(event) => setDescription(event.target.value)}
            placeholder="이 이야기의 핵심 배경이나 방향을 간단히 적어보세요."
            value={description}
          />
          {createStory.isError ? (
            <StatusMessage tone="danger">
              이야기를 만들지 못했습니다. 다시 시도해 주세요.
            </StatusMessage>
          ) : null}
          <div className="flex justify-end gap-2 pt-1">
            <Button
              disabled={createStory.isPending}
              emphasis="ghost"
              intent="neutral"
              onClick={() => setCreateOpen(false)}
              type="button"
            >
              취소
            </Button>
            <Button busy={createStory.isPending} type="submit">
              이야기 만들기
            </Button>
          </div>
        </form>
      </Dialog>
    </AppShell>
  );
}
