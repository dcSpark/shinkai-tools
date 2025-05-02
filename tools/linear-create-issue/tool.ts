import { LinearClient } from "npm:@linear/sdk";

type CONFIG = {
    LINEAR_API_KEY: string;
};

type INPUTS = {
    title: string;
    teamId: string;
    description?: string;
    priority?: number;
    status?: string;
};

type OUTPUT = {
    _issue: {
        id: string;
    },
    lastSyncId: number;
    success: boolean;
};

export async function run(config: CONFIG, inputs: INPUTS): Promise<OUTPUT> {
    // Initialize Linear client with API key
    const linearClient = new LinearClient({
        apiKey: config.LINEAR_API_KEY
    });

    // Create issue with provided inputs
    const issuePayload = await linearClient.createIssue({
        title: inputs.title,
        teamId: inputs.teamId,
        description: inputs.description,
        priority: inputs.priority,
        stateId: inputs.status
    });

    // Return formatted response
    return issuePayload as unknown as OUTPUT;
}
