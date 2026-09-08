import { describe, expect, it } from "vitest";

import type { GraphProperties } from "@/contracts/graph/graph.contract";
import {
  addObjectProperty,
  appendArrayItem,
  removeProperty,
  renameObjectProperty,
  setPropertyValue,
  validatePropertyTree,
} from "./property-model";

describe("structured property model", () => {
  it("adds, updates, and removes object properties immutably", () => {
    const original: GraphProperties = {
      job: "mage",
      place: { country: "A" },
    };

    const added = addObjectProperty(original, [], "income", "monthly 200");
    expect(added).toEqual({
      ok: true,
      properties: {
        job: "mage",
        place: { country: "A" },
        income: "monthly 200",
      },
    });
    expect(original).toEqual({ job: "mage", place: { country: "A" } });

    if (!added.ok) throw new Error("expected valid add");
    const nested = addObjectProperty(
      added.properties,
      ["place"],
      "city",
      "B",
    );
    expect(nested).toMatchObject({ ok: true });
    if (!nested.ok) throw new Error("expected valid nested add");

    const updated = setPropertyValue(
      nested.properties,
      ["place", "city"],
      "C",
    );
    expect(updated).toMatchObject({
      ok: true,
      properties: {
        job: "mage",
        place: { country: "A", city: "C" },
        income: "monthly 200",
      },
    });

    if (!updated.ok) throw new Error("expected valid update");
    const removed = removeProperty(updated.properties, ["job"]);
    expect(removed).toEqual({
      ok: true,
      properties: {
        place: { country: "A", city: "C" },
        income: "monthly 200",
      },
    });
  });

  it("renames keys while rejecting blank and duplicate names", () => {
    const original: GraphProperties = { job: "mage", role: "leader" };

    expect(renameObjectProperty(original, [], "job", "occupation")).toEqual({
      ok: true,
      properties: { occupation: "mage", role: "leader" },
    });
    expect(renameObjectProperty(original, [], "job", "   ")).toEqual({
      ok: false,
      message: "속성 이름을 입력하세요.",
    });
    expect(renameObjectProperty(original, [], "job", "role")).toEqual({
      ok: false,
      message: "같은 이름의 속성이 이미 있습니다.",
    });
    expect(addObjectProperty(original, [], "role", "other")).toEqual({
      ok: false,
      message: "같은 이름의 속성이 이미 있습니다.",
    });
  });

  it("supports nested arrays with explicit append and remove operations", () => {
    const original: GraphProperties = {
      aliases: ["red mage"],
      profile: { notes: [] },
    };

    const appended = appendArrayItem(original, ["aliases"], "north sage");
    expect(appended).toEqual({
      ok: true,
      properties: {
        aliases: ["red mage", "north sage"],
        profile: { notes: [] },
      },
    });
    if (!appended.ok) throw new Error("expected valid append");

    const nested = appendArrayItem(appended.properties, ["profile", "notes"], {
      title: "secret",
    });
    expect(nested).toMatchObject({
      ok: true,
      properties: {
        aliases: ["red mage", "north sage"],
        profile: { notes: [{ title: "secret" }] },
      },
    });
    if (!nested.ok) throw new Error("expected valid nested append");

    expect(removeProperty(nested.properties, ["aliases", 0])).toEqual({
      ok: true,
      properties: {
        aliases: ["north sage"],
        profile: { notes: [{ title: "secret" }] },
      },
    });
  });

  it("rejects trees that exceed the contract depth and entry limits", () => {
    const tooDeep: GraphProperties = {
      one: {
        two: {
          three: {
            four: {
              five: {
                six: {
                  seven: "too deep",
                },
              },
            },
          },
        },
      },
    };
    expect(validatePropertyTree(tooDeep)).toMatchObject({ ok: false });

    const tooMany = Object.fromEntries(
      Array.from({ length: 201 }, (_, index) => [`key-${index}`, "value"]),
    );
    expect(validatePropertyTree(tooMany)).toMatchObject({ ok: false });
  });
});
