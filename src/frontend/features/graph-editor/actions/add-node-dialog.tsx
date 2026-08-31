"use client";

import { useEffect, useState, type FormEvent } from "react";

import { Button } from "@/frontend/shared/ui/button";
import { Dialog } from "@/frontend/shared/ui/dialog";
import { SelectField, TextField } from "@/frontend/shared/ui/form-field";

export function AddNodeDialog({
  open,
  existingNodes,
  onCreate,
  onPlace,
  onClose,
  busy,
}: {
  open: boolean;
  existingNodes: Array<{ id: string; name: string }>;
  onCreate: (name: string) => void;
  onPlace: (nodeId: string) => void;
  onClose: () => void;
  busy: boolean;
}) {
  const [name, setName] = useState("");
  const [existingNodeId, setExistingNodeId] = useState("");

  useEffect(() => {
    if (!open) {
      setName("");
      setExistingNodeId("");
    }
  }, [open]);

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    onCreate(trimmed);
  }

  return (
    <Dialog
      description="새 노드를 만들거나, 이 이야기의 기존 노드를 현재 보드에 배치하세요."
      onClose={onClose}
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
            onClick={onClose}
          >
            취소
          </Button>
          <Button busy={busy} disabled={!name.trim()} type="submit">
            새 노드 만들기
          </Button>
        </div>
      </form>

      <div className="border-t border-[var(--sg-line)] pt-5">
        <div className="grid gap-3">
          <div>
            <p className="text-sm font-semibold">기존 노드 추가</p>
            <p className="mt-1 text-xs leading-5 text-[var(--sg-muted)]">
              다른 보드에서 이미 만든 노드를 같은 정체성으로 가져옵니다.
            </p>
          </div>
          <SelectField
            disabled={busy || existingNodes.length === 0}
            label="기존 노드"
            onChange={(event) => setExistingNodeId(event.target.value)}
            value={existingNodeId}
          >
            <option value="">
              {existingNodes.length ? "노드를 선택하세요" : "추가할 기존 노드가 없습니다"}
            </option>
            {existingNodes.map((node) => (
              <option key={node.id} value={node.id}>
                {node.name}
              </option>
            ))}
          </SelectField>
          <div className="flex justify-end">
            <Button
              disabled={busy || !existingNodeId}
              emphasis="outline"
              onClick={() => {
                if (existingNodeId) onPlace(existingNodeId);
              }}
            >
              보드에 추가
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
