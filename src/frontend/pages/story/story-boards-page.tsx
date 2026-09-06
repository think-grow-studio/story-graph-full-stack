"use client";

import axios from "axios";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";

import type { BoardResponse } from "@/contracts/graph/graph.contract";
import { useBootstrapQuery } from "@/frontend/api/auth/bootstrap.queries";
import {
  useBoardsQuery,
  useCreateBoardMutation,
  useUpdateBoardMutation,
} from "@/frontend/api/graph/graph.queries";
import { useStoryQuery } from "@/frontend/api/story/story.queries";
import { Button } from "@/frontend/shared/ui/button";
import { Dialog } from "@/frontend/shared/ui/dialog";
import { EmptyState } from "@/frontend/shared/ui/empty-state";
import { TextField } from "@/frontend/shared/ui/form-field";
import { StatusMessage } from "@/frontend/shared/ui/status-message";
import { AppShell } from "@/frontend/widgets/app-shell/app-shell";

import {
  BoardTagsValidationError,
  formatBoardTags,
  parseBoardTags,
} from "./board-tags";

export function StoryBoardsPage({ storyId }: { storyId: string }) {
  const router = useRouter();
  const [boardDialogOpen, setBoardDialogOpen] = useState(false);
  const [boardName, setBoardName] = useState("");
  const [boardTags, setBoardTags] = useState("");
  const [boardNameError, setBoardNameError] = useState<string | null>(null);
  const [boardTagsError, setBoardTagsError] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [editingBoard, setEditingBoard] = useState<BoardResponse | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editTags, setEditTags] = useState("");
  const [editNameError, setEditNameError] = useState<string | null>(null);
  const [editTagsError, setEditTagsError] = useState<string | null>(null);

  const bootstrap = useBootstrapQuery();
  const workspaceId = bootstrap.data?.workspace.id;
  const story = useStoryQuery(workspaceId, storyId);
  const boards = useBoardsQuery(workspaceId, storyId);
  const createBoard = useCreateBoardMutation(workspaceId, storyId);
  const updateBoard = useUpdateBoardMutation(workspaceId, storyId);

  const allTags = useMemo(
    () =>
      Array.from(new Set((boards.data ?? []).flatMap((board) => board.tags))).sort(
        (left, right) => left.localeCompare(right),
      ),
    [boards.data],
  );
  const activeTag = selectedTag && allTags.includes(selectedTag) ? selectedTag : null;
  const visibleBoards = useMemo(
    () =>
      activeTag
        ? (boards.data ?? []).filter((board) => board.tags.includes(activeTag))
        : (boards.data ?? []),
    [activeTag, boards.data],
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

  function openBoardDialog() {
    setBoardName("");
    setBoardTags("");
    setBoardNameError(null);
    setBoardTagsError(null);
    createBoard.reset();
    setBoardDialogOpen(true);
  }

  function openEditDialog(board: BoardResponse) {
    setEditingBoard(board);
    setEditName(board.name);
    setEditDescription(board.description);
    setEditTags(formatBoardTags(board.tags));
    setEditNameError(null);
    setEditTagsError(null);
    updateBoard.reset();
  }

  function parseTagsOrSetError(
    value: string,
    setError: (message: string | null) => void,
  ) {
    try {
      const tags = parseBoardTags(value);
      setError(null);
      return tags;
    } catch (error) {
      if (error instanceof BoardTagsValidationError) {
        setError(error.message);
        return null;
      }
      throw error;
    }
  }

  async function handleCreateBoard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = boardName.trim();
    if (!name) {
      setBoardNameError("보드 이름을 입력해 주세요.");
      return;
    }
    const tags = parseTagsOrSetError(boardTags, setBoardTagsError);
    if (!tags) return;

    setBoardNameError(null);
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

  async function handleUpdateBoard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingBoard) return;
    const name = editName.trim();
    if (!name) {
      setEditNameError("보드 이름을 입력해 주세요.");
      return;
    }
    const tags = parseTagsOrSetError(editTags, setEditTagsError);
    if (!tags) return;

    setEditNameError(null);
    try {
      await updateBoard.mutateAsync({
        boardId: editingBoard.id,
        name,
        description: editDescription,
        tags,
      });
      setEditingBoard(null);
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
              aria-pressed={activeTag === null}
              className="rounded-full border border-[var(--sg-line)] bg-[var(--sg-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--sg-muted)] aria-pressed:border-[var(--sg-brand)] aria-pressed:text-[var(--sg-brand-strong)]"
              onClick={() => setSelectedTag(null)}
              type="button"
            >
              전체 보기
            </button>
            {allTags.map((tag) => (
              <button
                aria-label={`#${tag}`}
                aria-pressed={activeTag === tag}
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
                  <article className="relative min-h-32 rounded-[var(--sg-radius-md)] border border-[var(--sg-line)] bg-[var(--sg-surface)] transition-[border-color,box-shadow] duration-150 hover:border-[color-mix(in_srgb,var(--sg-brand)_35%,var(--sg-line))] hover:shadow-[0_10px_28px_rgba(23,25,29,0.05)]">
                    <Link
                      aria-label={board.name}
                      className="group block min-h-32 p-5 pr-20"
                      href={`/stories/${storyId}/boards/${board.id}`}
                    >
                      <p className="text-xs font-semibold text-[var(--sg-muted)]">보드</p>
                      <h3 className="mt-2 text-lg font-bold tracking-[-0.02em] group-hover:text-[var(--sg-brand-strong)]">
                        {board.name}
                      </h3>
                      {board.description ? (
                        <p className="mt-2 line-clamp-2 text-sm text-[var(--sg-muted)]">
                          {board.description}
                        </p>
                      ) : null}
                      {board.tags.length ? (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {board.tags.map((tag) => (
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
                    <button
                      aria-label={`${board.name} 보드 편집`}
                      className="absolute right-4 top-4 rounded-[var(--sg-radius-sm)] border border-[var(--sg-line)] px-2.5 py-1.5 text-xs font-semibold text-[var(--sg-muted)] hover:border-[var(--sg-brand)] hover:text-[var(--sg-brand-strong)]"
                      onClick={() => openEditDialog(board)}
                      type="button"
                    >
                      편집
                    </button>
                  </article>
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

      <Dialog
        description="이름, 설명, 태그만 바뀝니다. 보드 안의 그래프는 그대로 유지됩니다."
        onClose={() => {
          if (!updateBoard.isPending) setEditingBoard(null);
        }}
        open={Boolean(editingBoard)}
        title="보드 편집"
      >
        <form className="grid gap-4" onSubmit={handleUpdateBoard}>
          <TextField
            autoFocus
            error={editNameError}
            label="보드 이름"
            onChange={(event) => {
              setEditName(event.target.value);
              if (event.target.value.trim()) setEditNameError(null);
            }}
            value={editName}
          />
          <TextField
            label="설명"
            onChange={(event) => setEditDescription(event.target.value)}
            value={editDescription}
          />
          <TextField
            error={editTagsError}
            helpText="쉼표로 구분하세요. 저장하면 태그 전체가 교체됩니다."
            label="태그"
            onChange={(event) => {
              setEditTags(event.target.value);
              setEditTagsError(null);
            }}
            value={editTags}
          />
          {updateBoard.isError ? (
            <StatusMessage tone="danger">보드를 수정하지 못했습니다. 다시 시도해 주세요.</StatusMessage>
          ) : null}
          <div className="flex justify-end gap-2 pt-1">
            <Button disabled={updateBoard.isPending} emphasis="ghost" intent="neutral" onClick={() => setEditingBoard(null)} type="button">
              취소
            </Button>
            <Button busy={updateBoard.isPending} type="submit">저장</Button>
          </div>
        </form>
      </Dialog>
    </AppShell>
  );
}
