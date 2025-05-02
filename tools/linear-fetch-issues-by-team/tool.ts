import { LinearClient, Issue } from "npm:@linear/sdk";

type CONFIG = {
  LINEAR_API_KEY: string;
};
type INPUTS = {
  teamId: string;
  assigneeId?: string;
  first?: number;
  after?: string; // Cursor for pagination
};
type OUTPUT = { 
  issues: Issue[];
  pageInfo: {
    hasNextPage: boolean;
    endCursor?: string;
  };
};

export async function run(config: CONFIG, inputs: INPUTS): Promise<OUTPUT> {
  const { teamId, assigneeId, first = 50, after } = inputs;
  const linearClient = new LinearClient({
    apiKey: config.LINEAR_API_KEY
  });
  const issuesConnection = await linearClient.issues({
    first,
    after, // Use the cursor directly
    filter: {
      team: { id: { eq: teamId } },
      completedAt: { null: true },
      canceledAt: { null: true },
      assignee: assigneeId ? { id: { eq: assigneeId } } : { null: true },
    },
  });

  // Return both the issues and pagination info
  return {
    issues: issuesConnection?.nodes ?? [],
    pageInfo: {
      hasNextPage: issuesConnection?.pageInfo?.hasNextPage ?? false,
      endCursor: issuesConnection?.pageInfo?.endCursor,
    }
  }
}