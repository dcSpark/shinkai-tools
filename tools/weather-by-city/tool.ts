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
export type Run<C extends Record<string, any>, I extends Record<string, any>, R extends Record<string, any>> = (config: C, inputs: I) => Promise<R>;

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
