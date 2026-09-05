"use client";

import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";

import { useBootstrapQuery } from "@/frontend/api/auth/bootstrap.queries";
import { createBoard as createBoardRequest } from "@/frontend/api/graph/graph.api";
import { useBoardsQuery } from "@/frontend/api/graph/graph.queries";
import { useStoryQuery } from "@/frontend/api/story/story.queries";
import { Button } from "@/frontend/shared/ui/button";
import { Dialog } from "@/frontend/shared/ui/dialog";
import { EmptyState } from "@/frontend/shared/ui/empty-state";
import { TextField } from "@/frontend/shared/ui/form-field";
import { StatusMessage } from "@/frontend/shared/ui/status-message";
import { AppShell } from "@/frontend/widgets/app-shell/app-shell";

function parseBoardTags(value: string) {
  return value
    .split(",")
    .map((tag) => tag.trim().replace(/^#+/, "").trim())
    .filter(Boolean);
}

export function StoryBoardsPage({ storyId }: { storyId: string }) {
  const router = useRouter();
  const [boardDialogOpen, setBoardDialogOpen] = useState(false);
  const [boardName, setBoardName] = useState("");
  const [boardTags, setBoardTags] = useState("");
  const [boardNameError, setBoardNameError] = useState<string | null>(null);
  const [boardTagsError, setBoardTagsError] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const bootstrap = useBootstrapQuery();
  const workspaceId = bootstrap.data?.workspace.id;
  const story = useStoryQuery(workspaceId, storyId);
  const boards = useBoardsQuery(workspaceId, storyId);
  const createBoard = useMutation({
    mutationFn: (input: { name: string; description: string; tags: string[] }) => {
      if (!workspaceId) throw new Error("Workspace is not ready");
      return createBoardRequest({ storyId, workspaceId, ...input });
    },
  });

  const allTags = useMemo(
    () =>
      Array.from(new Set((boards.data ?? []).flatMap((board) => board.tags ?? []))).sort(
        (left, right) => left.localeCompare(right),
      ),
    [boards.data],
  );
  const visibleBoards = useMemo(
    () =>
      selectedTag
        ? (boards.data ?? []).filter((board) => (board.tags ?? []).includes(selectedTag))
        : (boards.data ?? []),
    [boards.data, selectedTag],
  );

  useEffect(() => {
    if (
      bootstrap.error &&
      axios.isAxiosError(bootstrap.error) &&
      bootstrap.error.response?.status === 401
    ) {
      router.replace("/login");
    }
  }, [bootstrap.error, router]);

  useEffect(() => {
    if (selectedTag && !allTags.includes(selectedTag)) setSelectedTag(null);
  }, [allTags, selectedTag]);

  function openBoardDialog() {
    setBoardName("");
    setBoardTags("");
    setBoardNameError(null);
    setBoardTagsError(null);
    createBoard.reset();
    setBoardDialogOpen(true);
  }

  async function handleCreateBoard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = boardName.trim();
    if (!name) {
      setBoardNameError("보드 이름을 입력해 주세요.");
      return;
    }

    const tags = parseBoardTags(boardTags);
    if (new Set(tags).size !== tags.length) {
      setBoardTagsError("같은 태그를 두 번 붙일 수 없습니다.");
      return;
    }
    if (tags.some((tag) => tag.length > 50)) {
      setBoardTagsError("태그는 50자 이하로 입력해 주세요.");
      return;
    }

    setBoardNameError(null);
    setBoardTagsError(null);
    try {
      const created = await createBoard.mutateAsync({
        name,
        description: "",
        tags,
      });
      setBoardDialogOpen(false);
      router.push(`/stories/${storyId}/boards/${created.id}`);
    } catch {
      // Mutation state renders the recovery message.
    }
  }

  if (bootstrap.isPending || story.isPending) {
    return (
      <main className="grid min-h-screen place-items-center bg-[var(--sg-canvas)] p-8">
        <p className="text-sm text-[var(--sg-muted)]">이야기를 불러오고 있습니다.</p>
      </main>
    );
  }

  if (bootstrap.isError || story.isError) {
    if (
      bootstrap.isError &&
      axios.isAxiosError(bootstrap.error) &&
      bootstrap.error.response?.status === 401
    ) {
      return (
        <main className="grid min-h-screen place-items-center bg-[var(--sg-canvas)] p-8">
          <p className="text-sm text-[var(--sg-muted)]">로그인 화면으로 이동하고 있습니다.</p>
        </main>
      );
    }
    return (
      <main className="grid min-h-screen place-items-center bg-[var(--sg-canvas)] p-8">
        <StatusMessage tone="danger">이야기를 불러오지 못했습니다.</StatusMessage>
      </main>
    );
  }

  return (
    <AppShell
      action={<Button onClick={openBoardDialog}>새 보드</Button>}
      actor={bootstrap.data.actor}
      description={story.data.description || "이 이야기의 보드를 열고 세계관을 연결하세요."}
      title={story.data.name}
    >
      <div className="mb-6">
        <Link
          className="text-sm font-semibold text-[var(--sg-muted)] underline decoration-[var(--sg-line)] underline-offset-4 hover:text-[var(--sg-ink)]"
          href="/dashboard"
        >
          ← 내 이야기
        </Link>
      </div>

      <section aria-labelledby="boards-heading" className="grid gap-5">
        <div>
          <h2 className="text-xl font-bold tracking-[-0.02em]" id="boards-heading">
            보드
          </h2>
          <p className="mt-1 text-sm leading-6 text-[var(--sg-muted)]">
            각 보드는 서로 독립적인 그래프입니다. 태그로 필요한 보드만 묶어 보세요.
          </p>
        </div>

        {allTags.length ? (
          <div className="flex flex-wrap gap-2" aria-label="보드 태그 필터">
            <button
              aria-pressed={selectedTag === null}
              className="rounded-full border border-[var(--sg-line)] bg-[var(--sg-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--sg-muted)] aria-pressed:border-[var(--sg-brand)] aria-pressed:text-[var(--sg-brand-strong)]"
              onClick={() => setSelectedTag(null)}
              type="button"
            >
              전체 보기
            </button>
            {allTags.map((tag) => (
              <button
                aria-label={`#${tag}`}
                aria-pressed={selectedTag === tag}
                className="rounded-full border border-[var(--sg-line)] bg-[var(--sg-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--sg-muted)] aria-pressed:border-[var(--sg-brand)] aria-pressed:text-[var(--sg-brand-strong)]"
                key={tag}
                onClick={() => setSelectedTag(tag)}
                type="button"
              >
                {tag}
              </button>
            ))}
          </div>
        ) : null}

        {boards.isPending ? (
          <div aria-busy="true" className="h-28 animate-pulse rounded-[var(--sg-radius-md)] border border-[var(--sg-line)] bg-[var(--sg-surface)]" />
        ) : null}

        {boards.isError ? (
          <div className="grid max-w-lg gap-4">
            <StatusMessage tone="danger">보드를 불러오지 못했습니다. 다시 시도해 주세요.</StatusMessage>
            <Button className="w-fit" emphasis="outline" intent="neutral" onClick={() => void boards.refetch()}>
              다시 시도
            </Button>
          </div>
        ) : null}

        {boards.data?.length === 0 ? (
          <EmptyState
            action={<Button onClick={openBoardDialog}>첫 보드 시작하기</Button>}
            description="보드는 인물과 사건을 배치하고 관계를 연결하는 독립적인 작업 화면입니다."
            title="아직 보드가 없습니다"
          />
        ) : null}

        {boards.data?.length ? (
          visibleBoards.length ? (
            <ul className="grid gap-3 md:grid-cols-2">
              {visibleBoards.map((board) => (
                <li key={board.id}>
                  <Link
                    aria-label={board.name}
                    className="group block min-h-32 rounded-[var(--sg-radius-md)] border border-[var(--sg-line)] bg-[var(--sg-surface)] p-5 transition-[border-color,box-shadow] duration-150 hover:border-[color-mix(in_srgb,var(--sg-brand)_35%,var(--sg-line))] hover:shadow-[0_10px_28px_rgba(23,25,29,0.05)]"
                    href={`/stories/${storyId}/boards/${board.id}`}
                  >
                    <p className="text-xs font-semibold text-[var(--sg-muted)]">보드</p>
                    <h3 className="mt-2 text-lg font-bold tracking-[-0.02em] group-hover:text-[var(--sg-brand-strong)]">
                      {board.name}
                    </h3>
                    {(board.tags ?? []).length ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {(board.tags ?? []).map((tag) => (
                          <span
                            className="rounded-full bg-[var(--sg-canvas)] px-2.5 py-1 text-xs font-medium text-[var(--sg-muted)]"
                            key={tag}
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-[var(--sg-muted)]">태그 없음</p>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-[var(--sg-radius-md)] border border-dashed border-[var(--sg-line)] p-5 text-sm text-[var(--sg-muted)]">
              선택한 태그가 붙은 보드가 없습니다.
            </p>
          )
        ) : null}
      </section>

      <Dialog
        description="보드는 서로 독립적으로 저장됩니다. 태그는 나중에 보드를 쉽게 찾는 데 사용합니다."
        onClose={() => {
          if (!createBoard.isPending) setBoardDialogOpen(false);
        }}
        open={boardDialogOpen}
        title="새 보드"
      >
        <form className="grid gap-4" onSubmit={handleCreateBoard}>
          <TextField
            autoFocus
            error={boardNameError}
            label="보드 이름"
            onChange={(event) => {
              setBoardName(event.target.value);
              if (event.target.value.trim()) setBoardNameError(null);
            }}
            placeholder="예: 인물 관계도"
            value={boardName}
          />
          <TextField
            error={boardTagsError}
            helpText="쉼표로 구분하세요. 예: 인물, 1부"
            label="태그"
            onChange={(event) => {
              setBoardTags(event.target.value);
              setBoardTagsError(null);
            }}
            placeholder="예: 인물, 전체"
            value={boardTags}
          />
          {createBoard.isError ? (
            <StatusMessage tone="danger">보드를 만들지 못했습니다. 다시 시도해 주세요.</StatusMessage>
          ) : null}
          <div className="flex justify-end gap-2 pt-1">
            <Button disabled={createBoard.isPending} emphasis="ghost" intent="neutral" onClick={() => setBoardDialogOpen(false)} type="button">
              취소
            </Button>
            <Button busy={createBoard.isPending} type="submit">보드 만들기</Button>
          </div>
        </form>
      </Dialog>
    </AppShell>
  );
}
