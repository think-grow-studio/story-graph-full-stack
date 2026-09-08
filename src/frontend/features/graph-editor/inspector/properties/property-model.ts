import {
  graphPropertiesSchema,
  type GraphProperties,
  type GraphPropertyValue,
} from "@/contracts/graph/graph.contract";

export type PropertyPath = ReadonlyArray<string | number>;

export type PropertyEditResult =
  | { ok: true; properties: GraphProperties }
  | { ok: false; message: string };

export type PropertyValidationResult =
  | { ok: true }
  | { ok: false; message: string };

const PATH_ERROR = "속성 경로를 찾을 수 없습니다.";

export function validatePropertyTree(
  properties: GraphProperties,
): PropertyValidationResult {
  const result = graphPropertiesSchema.safeParse(properties);
  if (result.success) return { ok: true };

  const issue = result.error.issues[0];
  if (!issue) return { ok: false, message: "속성 구조를 확인하세요." };

  if (issue.message.includes("nested at most 6 levels")) {
    return { ok: false, message: "속성은 최대 6단계까지 중첩할 수 있습니다." };
  }
  if (issue.message.includes("at most 200 entries")) {
    return { ok: false, message: "속성은 최대 200개까지 추가할 수 있습니다." };
  }
  if (issue.code === "too_big") {
    return { ok: false, message: "속성 이름 또는 값이 너무 깁니다." };
  }

  return { ok: false, message: "속성 구조가 허용 범위를 벗어났습니다." };
}

export function addObjectProperty(
  properties: GraphProperties,
  objectPath: PropertyPath,
  key: string,
  value: GraphPropertyValue = "",
): PropertyEditResult {
  const normalizedKey = key.trim();
  if (!normalizedKey) {
    return { ok: false, message: "속성 이름을 입력하세요." };
  }

  const target = getValueAtPath(properties, objectPath);
  if (!isPropertyObject(target)) {
    return { ok: false, message: PATH_ERROR };
  }
  if (Object.prototype.hasOwnProperty.call(target, normalizedKey)) {
    return { ok: false, message: "같은 이름의 속성이 이미 있습니다." };
  }

  return updateAndValidate(properties, objectPath, (current) => {
    if (!isPropertyObject(current)) return current;
    return { ...current, [normalizedKey]: value };
  });
}

export function renameObjectProperty(
  properties: GraphProperties,
  objectPath: PropertyPath,
  currentKey: string,
  nextKey: string,
): PropertyEditResult {
  const normalizedKey = nextKey.trim();
  if (!normalizedKey) {
    return { ok: false, message: "속성 이름을 입력하세요." };
  }

  const target = getValueAtPath(properties, objectPath);
  if (
    !isPropertyObject(target) ||
    !Object.prototype.hasOwnProperty.call(target, currentKey)
  ) {
    return { ok: false, message: PATH_ERROR };
  }
  if (
    normalizedKey !== currentKey &&
    Object.prototype.hasOwnProperty.call(target, normalizedKey)
  ) {
    return { ok: false, message: "같은 이름의 속성이 이미 있습니다." };
  }
  if (normalizedKey === currentKey) {
    return { ok: true, properties };
  }

  return updateAndValidate(properties, objectPath, (current) => {
    if (!isPropertyObject(current)) return current;
    return Object.fromEntries(
      Object.entries(current).map(([key, value]) =>
        key === currentKey ? [normalizedKey, value] : [key, value],
      ),
    );
  });
}

export function setPropertyValue(
  properties: GraphProperties,
  path: PropertyPath,
  value: GraphPropertyValue,
): PropertyEditResult {
  if (path.length === 0 || getValueAtPath(properties, path) === undefined) {
    return { ok: false, message: PATH_ERROR };
  }
  return updateAndValidate(properties, path, () => value);
}

export function appendArrayItem(
  properties: GraphProperties,
  path: PropertyPath,
  value: GraphPropertyValue = "",
): PropertyEditResult {
  const target = getValueAtPath(properties, path);
  if (!Array.isArray(target)) {
    return { ok: false, message: PATH_ERROR };
  }
  return updateAndValidate(properties, path, (current) =>
    Array.isArray(current) ? [...current, value] : current,
  );
}

export function removeProperty(
  properties: GraphProperties,
  path: PropertyPath,
): PropertyEditResult {
  if (path.length === 0) return { ok: false, message: PATH_ERROR };

  const parentPath = path.slice(0, -1);
  const key = path[path.length - 1];
  const parent = getValueAtPath(properties, parentPath);

  if (Array.isArray(parent) && typeof key === "number") {
    if (key < 0 || key >= parent.length) {
      return { ok: false, message: PATH_ERROR };
    }
    return updateAndValidate(properties, parentPath, (current) => {
      if (!Array.isArray(current)) return current;
      return current.filter((_, index) => index !== key);
    });
  }

  if (
    isPropertyObject(parent) &&
    typeof key === "string" &&
    Object.prototype.hasOwnProperty.call(parent, key)
  ) {
    return updateAndValidate(properties, parentPath, (current) => {
      if (!isPropertyObject(current)) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  return { ok: false, message: PATH_ERROR };
}

function updateAndValidate(
  properties: GraphProperties,
  path: PropertyPath,
  updater: (value: GraphPropertyValue | GraphProperties) =>
    | GraphPropertyValue
    | GraphProperties,
): PropertyEditResult {
  const next = updateValueAtPath(properties, path, updater) as GraphProperties;
  const validation = validatePropertyTree(next);
  if (!validation.ok) return validation;
  return { ok: true, properties: next };
}

function getValueAtPath(
  properties: GraphProperties,
  path: PropertyPath,
): GraphPropertyValue | GraphProperties | undefined {
  let current: GraphPropertyValue | GraphProperties = properties;

  for (const segment of path) {
    if (Array.isArray(current) && typeof segment === "number") {
      current = current[segment];
      if (current === undefined) return undefined;
      continue;
    }
    if (isPropertyObject(current) && typeof segment === "string") {
      current = current[segment];
      if (current === undefined) return undefined;
      continue;
    }
    return undefined;
  }

  return current;
}

function updateValueAtPath(
  current: GraphPropertyValue | GraphProperties,
  path: PropertyPath,
  updater: (value: GraphPropertyValue | GraphProperties) =>
    | GraphPropertyValue
    | GraphProperties,
): GraphPropertyValue | GraphProperties {
  if (path.length === 0) return updater(current);

  const [segment, ...rest] = path;
  if (Array.isArray(current) && typeof segment === "number") {
    return current.map((value, index) =>
      index === segment ? updateValueAtPath(value, rest, updater) : value,
    );
  }
  if (isPropertyObject(current) && typeof segment === "string") {
    return {
      ...current,
      [segment]: updateValueAtPath(current[segment], rest, updater),
    };
  }

  return current;
}

function isPropertyObject(
  value: GraphPropertyValue | GraphProperties | undefined,
): value is Record<string, GraphPropertyValue> {
  return value !== undefined && !Array.isArray(value) && typeof value === "object";
}
