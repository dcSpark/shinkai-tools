import process from 'node:process';
import axios from 'npm:axios@1.7.7';

type Configurations = {
  apiKey: string;
};
type Parameters = {
  city: string;
};
type Result = {
  weather: string;
};

export const run: Run<Configurations, Parameters, Result> = async (
  configurations,
  parameters,
): Promise<Result> => {
  try {
    await process.nextTick(() => {});
    const response = await axios.get(
      `http://api.openweathermap.org/data/2.5/weather?q=${parameters.city}&appid=${configurations.apiKey}`,
    );
    return { weather: JSON.stringify(response.data) };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(
        `Failed to fetch weather data, status: ${error.response?.status}`,
      );
    }
    throw error;
  }
};

export const definition: ToolDefinition<typeof run> = {
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
