"use client";

import { useState } from "react";

import type {
  GraphProperties,
  GraphPropertyValue,
} from "@/contracts/graph/graph.contract";
import {
  addObjectProperty,
  appendArrayItem,
  removeProperty,
  renameObjectProperty,
  setPropertyValue,
  validatePropertyTree,
  type PropertyEditResult,
  type PropertyPath,
} from "./property-model";

type PropertyValueType = "string" | "object" | "array";

export function PropertyEditor({
  value,
  onChange,
  disabled = false,
}: {
  value: GraphProperties;
  onChange: (value: GraphProperties) => void;
  disabled?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const treeValidation = validatePropertyTree(value);
  const validationMessage = error ?? (treeValidation.ok ? null : treeValidation.message);

  function commit(result: PropertyEditResult) {
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setError(null);
    onChange(result.properties);
  }

  return (
    <section aria-label="속성" className="grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">속성</p>
          <p className="mt-0.5 text-xs leading-5 text-[var(--sg-muted)]">
            필요한 정보만 이름과 값으로 추가하세요. 객체와 목록도 중첩할 수 있습니다.
          </p>
        </div>
      </div>

      <ObjectEditor
        disabled={disabled}
        onCommit={commit}
        path={[]}
        root={value}
        value={value}
      />

      {validationMessage ? (
        <p className="text-sm text-[var(--sg-danger)]" role="alert">
          {validationMessage}
        </p>
      ) : null}
    </section>
  );
}

function ObjectEditor({
  root,
  value,
  path,
  onCommit,
  disabled,
}: {
  root: GraphProperties;
  value: Record<string, GraphPropertyValue>;
  path: PropertyPath;
  onCommit: (result: PropertyEditResult) => void;
  disabled: boolean;
}) {
  const [newKey, setNewKey] = useState("");
  const contextName = path.length > 0 ? String(path[path.length - 1]) : null;

  function addProperty() {
    const result = addObjectProperty(root, path, newKey, "");
    onCommit(result);
    if (result.ok) setNewKey("");
  }

  return (
    <div
      className={
        path.length > 0
          ? "grid gap-2 border-l border-[var(--sg-line)] pl-3"
          : "grid gap-2"
      }
    >
      {Object.entries(value).map(([key, childValue]) => (
        <ObjectPropertyRow
          disabled={disabled}
          key={key}
          name={key}
          objectPath={path}
          onCommit={onCommit}
          path={[...path, key]}
          root={root}
          value={childValue}
        />
      ))}

      <form
        className="flex flex-wrap items-end gap-2 rounded-[var(--sg-radius-sm)] bg-[var(--sg-canvas)] p-2"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          addProperty();
        }}
      >
        <label className="min-w-0 flex-1 text-xs font-medium text-[var(--sg-muted)]">
          {contextName ? `${contextName} 새 속성` : "새 속성"}
          <input
            aria-label={
              contextName ? `${contextName} 새 속성 키` : "새 속성 키"
            }
            className="mt-1 w-full rounded-md border border-[var(--sg-line)] bg-[var(--sg-surface)] px-2.5 py-2 text-sm text-[var(--sg-ink)] outline-none focus:border-[var(--sg-brand)] disabled:cursor-not-allowed disabled:bg-[var(--sg-canvas)]"
            disabled={disabled}
            maxLength={100}
            onChange={(event) => setNewKey(event.target.value)}
            placeholder="예: 직업"
            value={newKey}
          />
        </label>
        <button
          className="cursor-pointer rounded-md border border-[var(--sg-line)] bg-[var(--sg-surface)] px-3 py-2 text-sm font-medium transition-[background-color,border-color] hover:border-[var(--sg-brand)] hover:bg-[var(--sg-surface)] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={disabled}
          type="submit"
        >
          {contextName ? `${contextName}에 속성 추가` : "속성 추가"}
        </button>
      </form>
    </div>
  );
}

function ObjectPropertyRow({
  root,
  value,
  path,
  objectPath,
  name,
  onCommit,
  disabled,
}: {
  root: GraphProperties;
  value: GraphPropertyValue;
  path: PropertyPath;
  objectPath: PropertyPath;
  name: string;
  onCommit: (result: PropertyEditResult) => void;
  disabled: boolean;
}) {
  const [keyDraft, setKeyDraft] = useState(name);

  function commitKey() {
    onCommit(renameObjectProperty(root, objectPath, name, keyDraft));
  }

  return (
    <div className="rounded-[var(--sg-radius-sm)] border border-[var(--sg-line)] bg-[var(--sg-surface)] p-2.5">
      <div className="grid grid-cols-[minmax(0,1fr)_7rem_auto] items-end gap-2">
        <label className="text-xs font-medium text-[var(--sg-muted)]">
          키
          <input
            aria-label={`${name} 속성 키`}
            className="mt-1 w-full rounded-md border border-[var(--sg-line)] px-2 py-1.5 text-sm outline-none focus:border-[var(--sg-brand)] disabled:cursor-not-allowed disabled:bg-[var(--sg-canvas)]"
            disabled={disabled}
            maxLength={100}
            onBlur={commitKey}
            onChange={(event) => setKeyDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                commitKey();
              }
            }}
            value={keyDraft}
          />
        </label>

        <label className="text-xs font-medium text-[var(--sg-muted)]">
          유형
          <select
            aria-label={`${name} 유형`}
            className="mt-1 w-full cursor-pointer rounded-md border border-[var(--sg-line)] bg-[var(--sg-surface)] px-2 py-1.5 text-sm disabled:cursor-not-allowed disabled:bg-[var(--sg-canvas)]"
            disabled={disabled}
            onChange={(event) =>
              onCommit(
                setPropertyValue(
                  root,
                  path,
                  emptyValueForType(event.target.value as PropertyValueType),
                ),
              )
            }
            value={valueType(value)}
          >
            <option value="string">문자열</option>
            <option value="object">객체</option>
            <option value="array">목록</option>
          </select>
        </label>

        <button
          aria-label={`${name} 삭제`}
          className="cursor-pointer rounded-md border border-[var(--sg-line)] px-2.5 py-1.5 text-sm text-[var(--sg-danger)] transition-colors hover:bg-[var(--sg-danger-soft)] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={disabled}
          onClick={() => onCommit(removeProperty(root, path))}
          type="button"
        >
          삭제
        </button>
      </div>

      <div className="mt-2">
        <ValueEditor
          disabled={disabled}
          label={name}
          onCommit={onCommit}
          path={path}
          root={root}
          value={value}
        />
      </div>
    </div>
  );
}

function ValueEditor({
  root,
  value,
  path,
  label,
  onCommit,
  disabled,
}: {
  root: GraphProperties;
  value: GraphPropertyValue;
  path: PropertyPath;
  label: string;
  onCommit: (result: PropertyEditResult) => void;
  disabled: boolean;
}) {
  if (typeof value === "string") {
    return (
      <input
        aria-label={`${label} 값`}
        className="w-full rounded-md border border-[var(--sg-line)] px-2.5 py-2 text-sm outline-none focus:border-[var(--sg-brand)] disabled:cursor-not-allowed disabled:bg-[var(--sg-canvas)]"
        disabled={disabled}
        maxLength={10_000}
        onChange={(event) =>
          onCommit(setPropertyValue(root, path, event.target.value))
        }
        value={value}
      />
    );
  }

  if (Array.isArray(value)) {
    return (
      <div className="grid gap-2">
        {value.map((item, index) => {
          const itemLabel = `${label} ${index + 1}`;
          const itemPath = [...path, index];
          return (
            <div
              className="rounded-md bg-[var(--sg-canvas)] p-2"
              key={`${path.join(".")}-${index}`}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <label className="text-xs font-medium text-[var(--sg-muted)]">
                  유형
                  <select
                    aria-label={`${itemLabel} 유형`}
                    className="ml-2 cursor-pointer rounded-md border border-[var(--sg-line)] bg-[var(--sg-surface)] px-2 py-1 text-xs disabled:cursor-not-allowed disabled:bg-[var(--sg-canvas)]"
                    disabled={disabled}
                    onChange={(event) =>
                      onCommit(
                        setPropertyValue(
                          root,
                          itemPath,
                          emptyValueForType(
                            event.target.value as PropertyValueType,
                          ),
                        ),
                      )
                    }
                    value={valueType(item)}
                  >
                    <option value="string">문자열</option>
                    <option value="object">객체</option>
                    <option value="array">목록</option>
                  </select>
                </label>
                <button
                  aria-label={`${itemLabel} 삭제`}
                  className="cursor-pointer text-xs text-[var(--sg-danger)] hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={disabled}
                  onClick={() => onCommit(removeProperty(root, itemPath))}
                  type="button"
                >
                  삭제
                </button>
              </div>
              <ValueEditor
                disabled={disabled}
                label={itemLabel}
                onCommit={onCommit}
                path={itemPath}
                root={root}
                value={item}
              />
            </div>
          );
        })}
        <button
          className="justify-self-start cursor-pointer rounded-md border border-dashed border-[var(--sg-line)] px-3 py-1.5 text-sm transition-colors hover:bg-[var(--sg-canvas)] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={disabled}
          onClick={() => onCommit(appendArrayItem(root, path, ""))}
          type="button"
        >
          {label} 값 추가
        </button>
      </div>
    );
  }

  return (
    <ObjectEditor
      disabled={disabled}
      onCommit={onCommit}
      path={path}
      root={root}
      value={value}
    />
  );
}

function valueType(value: GraphPropertyValue): PropertyValueType {
  if (typeof value === "string") return "string";
  return Array.isArray(value) ? "array" : "object";
}

function emptyValueForType(type: PropertyValueType): GraphPropertyValue {
  if (type === "object") return {};
  if (type === "array") return [];
  return "";
}
