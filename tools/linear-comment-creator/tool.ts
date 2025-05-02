import { LinearClient } from "npm:@linear/sdk";

type CONFIG = {
    LINEAR_API_KEY: string;
};

type INPUTS = {
    issueId: string;
    body: string;
    createAsUser?: string;
    displayIconUrl?: string;
};

type OUTPUT = {
    comment: {
        id: string;
        body: string;
        url: string;
    };
    issue: {
        id: string;
        identifier: string;
        title: string;
        url: string;
    };
    lastSyncId: number;
    success: boolean;
};

export async function run(config: CONFIG, inputs: INPUTS): Promise<OUTPUT> {
    // Initialize Linear client with API key
    const linearClient = new LinearClient({
        apiKey: config.LINEAR_API_KEY
    });

    // Create comment with provided inputs
    const commentPayload = await linearClient.createComment({
        issueId: inputs.issueId,
        body: inputs.body,
        createAsUser: inputs.createAsUser,
        displayIconUrl: inputs.displayIconUrl
    });

    // Get the created comment
    const comment = await commentPayload.comment;
    if (!comment) throw new Error("Failed to create comment");

    // Get the issue
    const issue = await comment.issue;
    if (!issue) throw new Error("Failed to get issue");

    // Return formatted response
    return {
        comment: {
            id: comment.id,
            body: comment.body,
            url: comment.url
        },
        issue: {
            id: issue.id,
            identifier: issue.identifier,
            title: issue.title,
            url: issue.url
        },
        lastSyncId: Date.now(),
        success: true
    };
}