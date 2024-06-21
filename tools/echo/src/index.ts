import { BaseTool } from "@shinkai_protocol/tool";

type Config = never;
type Params = {
    message: string;
}
type Result = string;

export class Tool extends BaseTool<Config, Params, Result> {
    async run(params: {
        message: string
    }): Promise<string> {
        return Promise.resolve(`echoing: ${params.message}`);
    }
}
