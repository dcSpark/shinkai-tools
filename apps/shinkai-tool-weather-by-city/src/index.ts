import {
  BaseTool,
  RunResult,
  ToolDefinition,
} from '@shinkai_protocol/shinkai-tools-builder';

type Config = {
  apiKey: string;
};
type Params = {
  city: string;
};
type Result = {
  weather: string;
};
export class Tool extends BaseTool<Config, Params, Result> {
  definition: ToolDefinition<Config, Params, Result> = {
    id: 'shinkai-tool-weather-by-city',
    name: 'Shinkai: Weather By City',
    description: 'Get weather information for a city name',
    configurations: {
      type: 'object',
      properties: {
        apiKey: { type: 'string' },
      },
      required: ['apiKey'],
    },
    parameters: {
      type: 'object',
      properties: {
        city: { type: 'string' },
      },
      required: ['city'],
    },
    result: {
      type: 'object',
      properties: {
        weather: { type: 'string' },
      },
      required: ['weather'],
    },
    author: '',
    keywords: [],
  };

  async run(params: Params): Promise<RunResult<Result>> {
    // response type is still an small subset of fetch Response type
    const response = await fetch(
      `http://api.openweathermap.org/data/2.5/weather?q=${params.city}&appid=${this.config.apiKey}`,
      {},
    );
    if (!response.ok) {
      throw new Error(`Failed to fetch weather data, status: ${response.status}`);
    }
    const data = await response.json();
    return { data: { weather: `${JSON.stringify(data)}` } };
  }
}
