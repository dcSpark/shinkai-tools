import axios from 'npm:axios@1.7.7';

type Configurations = Record<string, never>;

type Parameters = {
  sides?: number;
  sideNames?: string[];
};

type Result = {
  result: string;
  error?: string;
};

export type Run<C extends Record<string, any>, I extends Record<string, any>, R extends Record<string, any>> = (
  config: C,
  inputs: I
) => Promise<R>;

export const run: Run<Configurations, Parameters, Result> = async (
  _configurations: Configurations,
  params: Parameters
): Promise<Result> => {
  try {
    const sides = params.sides ?? 3;
    const sideNames = params.sideNames;

    if (sideNames && sideNames.length !== sides) {
      return {
        result: '',
        error: `Number of side names (${sideNames.length}) must match number of sides (${sides})`
      };
    }

    if (sides === 0) {
      return { result: 'The coin vanished into another dimension! 🌀' };
    }

    if (sides === 1) {
      return { result: '_' };
    }

    if (sides < 0) {
      return { result: '', error: 'Cannot flip a coin with negative sides!' };
    }

    const response = await axios.get('https://www.random.org/integers/', {
      params: {
        num: 1,
        min: 1,
        max: sides,
        col: 1,
        base: 10,
        format: 'plain',
        rnd: 'new'
      }
    });

    const result = parseInt(response.data);
    let output: string;

    if (sideNames) {
      output = sideNames[result - 1].toLowerCase();
    } else if (sides === 2) {
      output = result === 1 ? 'heads' : 'tails';
    } else if (sides === 3) {
      output = result === 1 ? '-' : result === 2 ? '0' : '+';
    } else {
      output = `side ${result}`;
    }

    return { result: output };
  } catch (error) {
    return {
      result: '',
      error: `Error flipping coin: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
};
