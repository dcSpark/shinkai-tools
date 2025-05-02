import { LinearClient } from "npm:@linear/sdk";

export type CONFIG = {
  LINEAR_API_KEY: string;
};

export type INPUTS = {
  teamId?: string; // Optional team ID to filter workflow states
};

export type OUTPUT = {
  workflowStates: {
    id: string;
    name: string;
    type: string;
    team?: {
      id: string;
      name: string;
    };
  }[];
  lastSyncId: number;
  success: boolean;
};

export async function run(config: CONFIG, inputs: INPUTS): Promise<OUTPUT> {
  // Validate required config
  if (!config.LINEAR_API_KEY) {
    throw new Error("Missing LINEAR_API_KEY in config");
  }

  // Initialize Linear client with API key
  const linearClient = new LinearClient({
    apiKey: config.LINEAR_API_KEY,
  });

  try {
    // Define the GraphQL query to fetch workflow states with optional filtering by team ID
    const query = inputs.teamId 
      ? `
      query {
        workflowStates(filter: { team: { id: { eq: "${inputs.teamId}" } } }) {
          nodes {
            id
            name
            type
            team {
              id
              name
            }
          }
        }
      }
      `
      : `
      query {
        workflowStates {
          nodes {
            id
            name
            type
            team {
              id
              name
            }
          }
        }
      }
      `;

    // Execute the raw GraphQL query
    const response = await linearClient.client.rawRequest(query);

    if (response.errors) {
      console.error("GraphQL Errors:", response.errors);
      return {
        workflowStates: [],
        lastSyncId: Date.now(),
        success: false,
      };
    }

    // Format the output
    const formattedWorkflowStates = (response.data as any).workflowStates.nodes.map((state: any) => ({
      id: state.id,
      name: state.name,
      type: state.type,
      team: state.team ? { id: state.team.id, name: state.team.name } : undefined,
    }));

    return {
      workflowStates: formattedWorkflowStates,
      lastSyncId: Date.now(),
      success: true,
    };
  } catch (error) {
    console.error("Error fetching workflow states:", error);
    return {
      workflowStates: [],
      lastSyncId: Date.now(),
      success: false,
    };
  }
}