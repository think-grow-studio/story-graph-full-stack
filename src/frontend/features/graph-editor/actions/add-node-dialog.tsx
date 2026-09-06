"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/frontend/shared/ui/button";
import { Dialog } from "@/frontend/shared/ui/dialog";
import { TextField } from "@/frontend/shared/ui/form-field";

export function AddNodeDialog({
  open,
  onCreate,
  onClose,
  busy,
}: {
  open: boolean;
  onCreate: (name: string) => void;
  onClose: () => void;
  busy: boolean;
  /** @deprecated Transitional compatibility only; ignored by the creation-only dialog. */
  existingNodes?: Array<{ id: string; name: string }>;
  /** @deprecated Transitional compatibility only; ignored by the creation-only dialog. */
  onPlace?: (nodeId: string) => void;
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
      description="새 노드를 만들어 현재 보드에 추가하세요."
      onClose={close}
      open={open}
      title="노드 추가"
    >
      <form className="grid gap-4" onSubmit={handleCreate}>
        <TextField
          autoFocus
          disabled={busy}
          label="노드 이름"
          onChange={(event) => setName(event.target.value)}
          placeholder="예: 주인공, 왕국, 사건"
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
            새 노드 만들기
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
