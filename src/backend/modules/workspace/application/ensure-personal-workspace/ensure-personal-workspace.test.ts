import { describe, expect, it } from "vitest";

import type {
  WorkspaceAccessService,
  WorkspaceSummary,
} from "../../domain/workspace-access.service";
import {
  ensurePersonalWorkspace,
  personalWorkspaceSlug,
  type WorkspaceProvisioner,
} from "./ensure-personal-workspace";

describe("personalWorkspaceSlug", () => {
  it("produces a deterministic safe slug from a user id", () => {
    expect(personalWorkspaceSlug("User_ABC:123")).toBe("personal-user-abc-123");
    expect(personalWorkspaceSlug("User_ABC:123")).toBe("personal-user-abc-123");
  });
});

describe("ensurePersonalWorkspace", () => {
  it("returns an existing personal workspace without provisioning", async () => {
    const existing = { id: "org-1", name: "Existing", slug: "personal-user-1" };
    const access: WorkspaceAccessService = {
      async findPersonalWorkspace() {
        return existing;
      },
      async requireCapability() {},
    };
    let provisionCalls = 0;
    const provisioner: WorkspaceProvisioner = {
      async createPersonalWorkspace() {
        provisionCalls += 1;
        return existing;
      },
    };

    await expect(
      ensurePersonalWorkspace({ userId: "user-1", userName: "Ada" }, { access, provisioner }),
    ).resolves.toEqual(existing);
    expect(provisionCalls).toBe(0);
  });

  it("provisions a missing workspace with deterministic identity", async () => {
    const access: WorkspaceAccessService = {
      async findPersonalWorkspace() {
        return null;
      },
      async requireCapability() {},
    };
    const created: WorkspaceSummary = {
      id: "org-2",
      name: "Ada's Workspace",
      slug: "personal-user-2",
    };
    let received: Parameters<WorkspaceProvisioner["createPersonalWorkspace"]>[0] | undefined;
    const provisioner: WorkspaceProvisioner = {
      async createPersonalWorkspace(input) {
        received = input;
        return created;
      },
    };

    await expect(
      ensurePersonalWorkspace({ userId: "User_2", userName: "Ada" }, { access, provisioner }),
    ).resolves.toEqual(created);
    expect(received).toEqual({
      userId: "User_2",
      name: "Ada's Workspace",
      slug: "personal-user-2",
    });
  });

  it("recovers by re-reading when concurrent provisioning loses", async () => {
    const recovered = { id: "org-3", name: "Personal Workspace", slug: "personal-user-3" };
    let reads = 0;
    const access: WorkspaceAccessService = {
      async findPersonalWorkspace() {
        reads += 1;
        return reads === 1 ? null : recovered;
      },
      async requireCapability() {},
    };
    const provisioner: WorkspaceProvisioner = {
      async createPersonalWorkspace() {
        throw new Error("duplicate slug");
      },
    };

    await expect(
      ensurePersonalWorkspace({ userId: "user-3", userName: "" }, { access, provisioner }),
    ).resolves.toEqual(recovered);
  });
});
