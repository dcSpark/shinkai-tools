import { BaseTool } from "@shinkai_protocol/shinkai-tools-builder";

type Config = never;
type Params = {
    message: string;
}
type Result = string;

export class Tool extends BaseTool<Config, Params, Result> {
    async run(params: {
        message: string
    }): Promise<string> {
        console.log('run echo from js', 4);
        return Promise.resolve(`echoing: ${params.message}`);
    }
}
