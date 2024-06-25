import { BaseTool } from "@shinkai_protocol/shinkai-tools-builder";

type Config = {
    apiKey: string;
};

type Params = {
    city: string;
};

type Result = string;

export class Tool extends BaseTool<Config, Params, Result> {
    async run(params: Params): Promise<string> {
        // response type is still an small subset of fetch Response type
        const response = await fetch(`http://api.openweathermap.org/data/2.5/weather?q=${params.city}&appid=${this.config.apiKey}`, {});
        const data = await response.body;
        return `${JSON.stringify(data)}`;
    }
}
