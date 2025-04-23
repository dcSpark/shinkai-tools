import { LinearClient } from "npm:@linear/sdk";

type CONFIG = {
    LINEAR_API_KEY: string;
};

type INPUTS = {
    query?: string;
    teamId?: string;
    status?: string;
    assigneeId?: string;
    labels?: string[];
    priority?: number;
    estimate?: number;
    includeArchived?: boolean;
    limit?: number;
};

type OUTPUT = {
    issues: Array<{
        id: string;
        identifier: string;
        title: string;
        description?: string;
        priority?: number;
        status?: string;
        url: string;
        teamId?: string;
        assigneeId?: string;
        labels?: string[];
        estimate?: number;
    }>;
};

export async function run(config: CONFIG, inputs: INPUTS): Promise<OUTPUT> {
    const linearClient = new LinearClient({
        apiKey: config.LINEAR_API_KEY
    });

    // Build search query
    const searchQuery: any = {};

    if (inputs.query) {
        searchQuery.query = inputs.query;
    }

    if (inputs.teamId) {
        searchQuery.teamId = inputs.teamId;
    }

    if (inputs.status) {
        searchQuery.state = inputs.status;
    }

    if (inputs.assigneeId) {
        searchQuery.assigneeId = inputs.assigneeId;
    }

    if (inputs.labels && inputs.labels.length > 0) {
        searchQuery.labels = inputs.labels;
    }

    if (inputs.priority !== undefined) {
        searchQuery.priority = inputs.priority;
    }

    if (inputs.estimate !== undefined) {
        searchQuery.estimate = inputs.estimate;
    }

    if (inputs.includeArchived !== undefined) {
        searchQuery.includeArchived = inputs.includeArchived;
    }

    // Set default limit if not provided
    const limit = inputs.limit || 10;

    // Execute search
    const issues = await linearClient.issues({
        first: limit,
        ...searchQuery
    });

    // Format results
    const formattedIssues = issues.nodes.map(issue => ({
        id: issue.id,
        identifier: issue.identifier,
        title: issue.title,
        description: issue.description,
        priority: issue.priority,
        status: issue.state?.name,
        url: issue.url,
        teamId: issue.teamId,
        assigneeId: issue.assigneeId,
        labels: issue.labels?.nodes?.map(label => label.name) || [],
        estimate: issue.estimate
    }));

    return {
        issues: formattedIssues
    };
}


