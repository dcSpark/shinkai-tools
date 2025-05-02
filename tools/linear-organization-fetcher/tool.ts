import { LinearClient } from "npm:@linear/sdk";

type CONFIG = {
    LINEAR_API_KEY: string;
};

type INPUTS = {};

type OUTPUT = {
    organization: {
        id: string;
        name: string;
        urlKey: string;
        teams: Array<{
            id: string;
            name: string;
            key: string;
        }>;
        users: Array<{
            id: string;
            name: string;
            email: string;
            admin: boolean;
            active: boolean;
        }>;
    };
    issueLabels: {
        id: string
        name: string
        color: string
    }[];
    lastSyncId: number;
    success: boolean;
};

export async function run(config: CONFIG, inputs: INPUTS): Promise<OUTPUT> {
    const linearClient = new LinearClient({
        apiKey: config.LINEAR_API_KEY
    });

    const organization = await linearClient.organization;
    const issueLabels = (await linearClient.issueLabels())
      .nodes.map(iL=>({
        id: iL.id,
        color: iL.color,
        name: iL.name,
      }))
    const [teams, users] = await Promise.all([
        organization.teams(),
        organization.users()
    ]);
  
    return {
        organization: {
            id: organization.id,
            name: organization.name,
            urlKey: organization.urlKey,
            teams: teams.nodes.map(team => ({
                id: team.id,
                name: team.name,
                key: team.key
            })),
            users: users.nodes.map(user => ({
                id: user.id,
                name: user.name,
                email: user.email,
                admin: user.admin,
                active: user.active
            }))
        },
        issueLabels,
        lastSyncId: Date.now(),
        success: true
    };
}
