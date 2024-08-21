import {
  BaseTool,
  RunResult,
  ToolDefinition,
} from '@shinkai_protocol/shinkai-tools-builder';
import axios from 'axios';

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
    try {
      await process.nextTick(() => { });
      const response = await axios.get(
        `http://api.openweathermap.org/data/2.5/weather?q=${params.city}&appid=${this.config.apiKey}`
      );
      return { data: { weather: JSON.stringify(response.data) } };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Failed to fetch weather data, status: ${error.response?.status}`);
      }
      throw error;
    }
  }
}
