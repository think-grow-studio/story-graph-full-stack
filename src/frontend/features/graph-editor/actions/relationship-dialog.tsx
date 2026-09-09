"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/frontend/shared/ui/button";
import { Dialog } from "@/frontend/shared/ui/dialog";
import { TextField } from "@/frontend/shared/ui/form-field";

export type RelationshipDraftResult = {
  sourceNodeId: string;
  targetNodeId: string;
  name: string;
  direction: "DIRECTED" | "UNDIRECTED";
};

export function RelationshipDialog({
  open,
  sourceNodeId,
  targetNodeId,
  sourceLabel,
  targetLabel,
  onCreate,
  onClose,
  busy,
}: {
  open: boolean;
  sourceNodeId: string;
  targetNodeId: string;
  sourceLabel: string;
  targetLabel: string;
  onCreate: (result: RelationshipDraftResult) => void;
  onClose: () => void;
  busy: boolean;
}) {
  const [name, setName] = useState("");
  const [direction, setDirection] =
    useState<RelationshipDraftResult["direction"]>("DIRECTED");
  const [reversed, setReversed] = useState(false);

  const currentSourceNodeId = reversed ? targetNodeId : sourceNodeId;
  const currentTargetNodeId = reversed ? sourceNodeId : targetNodeId;
  const currentSourceLabel = reversed ? targetLabel : sourceLabel;
  const currentTargetLabel = reversed ? sourceLabel : targetLabel;
  const separator = direction === "DIRECTED" ? "→" : "—";

  function resetDraft() {
    setName("");
    setDirection("DIRECTED");
    setReversed(false);
  }

  function close() {
    resetDraft();
    onClose();
  }

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    onCreate({
      sourceNodeId: currentSourceNodeId,
      targetNodeId: currentTargetNodeId,
      name: trimmed,
      direction,
    });
    resetDraft();
  }

  return (
    <Dialog
      description="두 노드의 관계 이름과 방향을 정하세요. 취소하면 관계는 생성되지 않습니다."
      onClose={close}
      open={open}
      title="관계 만들기"
    >
      <div className="grid gap-3">
        <div className="rounded-[var(--sg-radius-sm)] bg-[var(--sg-canvas)] px-3 py-2 text-center text-sm font-semibold text-[var(--sg-ink)]">
          {currentSourceLabel} {separator} {currentTargetLabel}
        </div>
        <div className="flex flex-wrap gap-2" aria-label="관계 방향">
          <Button
            aria-pressed={direction === "DIRECTED"}
            disabled={busy}
            emphasis={direction === "DIRECTED" ? "solid" : "outline"}
            onClick={() => setDirection("DIRECTED")}
            type="button"
          >
            방향 있음
          </Button>
          <Button
            aria-pressed={direction === "UNDIRECTED"}
            disabled={busy}
            emphasis={direction === "UNDIRECTED" ? "solid" : "outline"}
            onClick={() => setDirection("UNDIRECTED")}
            type="button"
          >
            방향 없음
          </Button>
          <Button
            disabled={busy}
            emphasis="ghost"
            intent="neutral"
            onClick={() => setReversed((value) => !value)}
            type="button"
          >
            방향 바꾸기
          </Button>
        </div>
      </div>
      <form className="grid gap-4" noValidate onSubmit={handleCreate}>
        <TextField
          autoFocus
          disabled={busy}
          label="관계 이름"
          onChange={(event) => setName(event.target.value)}
          placeholder="예: 친구, 보호한다, 소속된다"
          value={name}
        />
        <div className="flex justify-end gap-2">
          <Button
            disabled={busy}
            emphasis="ghost"
            intent="neutral"
            onClick={close}
          >
            취소
          </Button>
          <Button busy={busy} disabled={!name.trim()} type="submit">
            관계 만들기
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
