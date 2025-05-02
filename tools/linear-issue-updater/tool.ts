import { LinearClient } from "npm:@linear/sdk";

type CONFIG = {
    LINEAR_API_KEY: string;
};

type INPUTS = {
    id: string;
    title?: string;
    description?: string;
    assigneeId?: string;
    priority?: number;
    status?: string;
};

type OUTPUT = {
    _issue: {
        id: string;
        identifier: string;
        assigneeId: string;
        title: string;
        description?: string;
        priority?: number;
        status?: string;
        url: string;
    },
    lastSyncId: number;
    success: boolean;
};

export async function run(config: CONFIG, inputs: INPUTS): Promise<OUTPUT> {
    // Initialize Linear client with API key
    const linearClient = new LinearClient({
        apiKey: config.LINEAR_API_KEY
    });

    // Get the issue first
    const issue = await linearClient.issue(inputs.id);
    if (!issue) throw new Error(`Issue ${inputs.id} not found`);

    // Update issue with provided inputs
    const updatePayload = await issue.update({
        title: inputs.title,
        assigneeId: inputs.assigneeId,
        description: inputs.description,
        priority: inputs.priority,
        stateId: inputs.status
    });

    // Get the updated issue
    const updatedIssue = await updatePayload.issue;
    if (!updatedIssue) throw new Error("Failed to update issue");

    // Return formatted response
    return {
        _issue: {
            id: updatedIssue.id,
            identifier: updatedIssue.identifier,
            title: updatedIssue.title,
            assigneeId: updatedIssue.assigneeId || "",
            description: updatedIssue.description,
            priority: updatedIssue.priority,
            status: (await updatedIssue.state)?.name,
            url: updatedIssue.url
        },
        lastSyncId: Date.now(),
        success: true
    };
}