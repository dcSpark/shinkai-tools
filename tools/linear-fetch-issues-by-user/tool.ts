import { LinearClient } from "npm:@linear/sdk";

type CONFIG = {
    LINEAR_API_KEY: string;
};

type INPUTS = {
    userId?: string;
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
        stateName: string;
        url: string;
    }>;
    lastSyncId: number;
    success: boolean;
};

export async function run(config: CONFIG, inputs: INPUTS): Promise<OUTPUT> {
    // Initialize Linear client with API key
    const linearClient = new LinearClient({
        apiKey: config.LINEAR_API_KEY
    });

    try {
        // Get the user or viewer
        const user = inputs.userId && typeof inputs.userId === 'string' ?
            await linearClient.user(inputs.userId) :
            await linearClient.viewer;

        // Get assigned issues
        const result = await user.assignedIssues({
            first: inputs.limit || 50,
            includeArchived: inputs.includeArchived
        });

        if (!result?.nodes) {
            return {
                issues: [],
                lastSyncId: Date.now(),
                success: true
            };
        }

        // Format the issues
        const formattedIssues = await Promise.all(
            result.nodes.map(async (issue) => {
                const state = await issue.state;
                return {
                    id: issue.id,
                    identifier: issue.identifier,
                    title: issue.title,
                    description: issue.description,
                    priority: issue.priority,
                    stateName: state?.name || 'Unknown',
                    url: issue.url
                };
            })
        );

        return {
            issues: formattedIssues,
            lastSyncId: Date.now(),
            success: true
        };
    } catch (error) {
        console.error(`Error in getUserIssues: ${error}`);
        throw error;
    }
}