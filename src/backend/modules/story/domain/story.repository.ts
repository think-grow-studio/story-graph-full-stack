import type { Story } from "./story";

export interface StoryRepository {
  create(story: Story): Promise<Story>;
  findById(id: string): Promise<Story | null>;
  listByWorkspace(workspaceId: string): Promise<Story[]>;
  update(input: {
    id: string;
    name?: string;
    description?: string;
  }): Promise<Story | null>;
  delete(id: string): Promise<boolean>;
}
