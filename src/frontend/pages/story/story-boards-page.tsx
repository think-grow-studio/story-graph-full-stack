"use client";

import axios from "axios";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";

import { useBootstrapQuery } from "@/frontend/api/auth/bootstrap.queries";
import {
  useBoardsQuery,
  useCreateBoardMutation,
  useCreateScopeMutation,
  useScopesQuery,
} from "@/frontend/api/graph/graph.queries";
import { useStoryQuery } from "@/frontend/api/story/story.queries";
import { Button } from "@/frontend/shared/ui/button";
import { Dialog } from "@/frontend/shared/ui/dialog";
import { EmptyState } from "@/frontend/shared/ui/empty-state";
import { SelectField, TextField } from "@/frontend/shared/ui/form-field";
import { StatusMessage } from "@/frontend/shared/ui/status-message";
import { AppShell } from "@/frontend/widgets/app-shell/app-shell";

export function StoryBoardsPage({ storyId }: { storyId: string }) {
  const router = useRouter();
  const [boardDialogOpen, setBoardDialogOpen] = useState(false);
  const [contextDialogOpen, setContextDialogOpen] = useState(false);
  const [scopeName, setScopeName] = useState("");
  const [boardName, setBoardName] = useState("");
  const [selectedScopeId, setSelectedScopeId] = useState("");
  const [boardNameError, setBoardNameError] = useState<string | null>(null);
  const [scopeNameError, setScopeNameError] = useState<string | null>(null);
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
    setSelectedScopeId("");
    setBoardNameError(null);
    createBoard.reset();
    setBoardDialogOpen(true);
  }

  function openContextDialog() {
    setScopeName("");
    setScopeNameError(null);
    createScope.reset();
    setContextDialogOpen(true);
  }

  async function handleCreateScope(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = scopeName.trim();
    if (!name) {
      setScopeNameError("컨텍스트 이름을 입력해 주세요.");
      return;
    }

    setScopeNameError(null);
    try {
      await createScope.mutateAsync({ name, description: "" });
      setContextDialogOpen(false);
    } catch {
      // Mutation state renders the recovery message.
    }
  }

  async function handleCreateBoard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = boardName.trim();
    if (!name) {
      setBoardNameError("보드 이름을 입력해 주세요.");
      return;
    }

    setBoardNameError(null);
    try {
      const created = await createBoard.mutateAsync({
        name,
        description: "",
        scopeId: selectedScopeId || null,
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
            노드와 관계를 배치하며 실제로 작업하는 이야기 화면입니다.
          </p>
        </div>

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
            description="보드는 인물과 사건을 배치하고 관계를 연결하는 작업 화면입니다."
            title="아직 보드가 없습니다"
          />
        ) : null}

        {boards.data?.length ? (
          <ul className="grid gap-3 md:grid-cols-2">
            {boards.data.map((board) => {
              const scope = board.scopeId ? scopeById.get(board.scopeId) : null;
              return (
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
                    <p className="mt-3 text-sm text-[var(--sg-muted)]">
                      {scope ? `컨텍스트: ${scope.name}` : "기본 이야기 상태"}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>

      <section className="mt-10 border-t border-[var(--sg-line)] pt-7" aria-labelledby="contexts-heading">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-2xl">
            <h2 className="text-base font-bold" id="contexts-heading">컨텍스트</h2>
            <p className="mt-1 text-sm leading-6 text-[var(--sg-muted)]">
              같은 인물과 관계를 장이나 시점에 따라 다르게 보이게 할 때 사용합니다.
            </p>
            {scopes.data?.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {scopes.data.map((scope) => (
                  <span className="rounded-full border border-[var(--sg-line)] bg-[var(--sg-surface)] px-3 py-1 text-xs font-medium text-[var(--sg-muted)]" key={scope.id}>
                    {scope.name}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
          <Button emphasis="outline" intent="neutral" onClick={openContextDialog}>
            컨텍스트 관리
          </Button>
        </div>
      </section>

      <Dialog
        description="컨텍스트를 선택하지 않으면 이야기의 기본 상태를 사용하는 보드가 만들어집니다."
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
          <SelectField
            helpText="장, 시점, 타임라인처럼 다른 상태가 필요할 때만 선택하세요."
            label="컨텍스트"
            onChange={(event) => setSelectedScopeId(event.target.value)}
            value={selectedScopeId}
          >
            <option value="">선택 안 함</option>
            {(scopes.data ?? []).map((scope) => (
              <option key={scope.id} value={scope.id}>
                {scope.name}
              </option>
            ))}
          </SelectField>
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
        description="컨텍스트는 장, 시점, 타임라인처럼 같은 요소의 상태가 달라질 때 사용합니다."
        onClose={() => {
          if (!createScope.isPending) setContextDialogOpen(false);
        }}
        open={contextDialogOpen}
        title="컨텍스트 관리"
      >
        <form className="grid gap-4" onSubmit={handleCreateScope}>
          <TextField
            autoFocus
            error={scopeNameError}
            label="컨텍스트 이름"
            onChange={(event) => {
              setScopeName(event.target.value);
              if (event.target.value.trim()) setScopeNameError(null);
            }}
            placeholder="예: Chapter 10"
            value={scopeName}
          />
          {createScope.isError ? (
            <StatusMessage tone="danger">컨텍스트를 만들지 못했습니다. 다시 시도해 주세요.</StatusMessage>
          ) : null}
          <div className="flex justify-end gap-2 pt-1">
            <Button disabled={createScope.isPending} emphasis="ghost" intent="neutral" onClick={() => setContextDialogOpen(false)} type="button">
              취소
            </Button>
            <Button busy={createScope.isPending} type="submit">컨텍스트 만들기</Button>
          </div>
        </form>
      </Dialog>
    </AppShell>
  );
}
