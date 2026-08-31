"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/frontend/shared/ui/button";
import { Dialog } from "@/frontend/shared/ui/dialog";
import { TextField } from "@/frontend/shared/ui/form-field";

export function RelationshipDialog({
  open,
  sourceLabel,
  targetLabel,
  onCreate,
  onClose,
  busy,
}: {
  open: boolean;
  sourceLabel: string;
  targetLabel: string;
  onCreate: (name: string) => void;
  onClose: () => void;
  busy: boolean;
}) {
  const [name, setName] = useState("");

  function resetDraft() {
    setName("");
  }

  function close() {
    resetDraft();
    onClose();
  }

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    onCreate(trimmed);
    resetDraft();
  }

  return (
    <Dialog
      description="두 노드를 어떤 관계로 연결할지 이름을 정하세요. 취소하면 관계는 생성되지 않습니다."
      onClose={close}
      open={open}
      title="관계 만들기"
    >
      <div className="rounded-[var(--sg-radius-sm)] bg-[var(--sg-canvas)] px-3 py-2 text-sm font-medium text-[var(--sg-muted)]">
        {sourceLabel} → {targetLabel}
      </div>
      <form className="grid gap-4" onSubmit={handleCreate}>
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
