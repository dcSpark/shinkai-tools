import { Parser } from 'npm:expr-eval@2.0.2';

type Configurations = {};
type Parameters = {
  expression: string;
};
type Result = { result: string };
export type Run<C extends Record<string, any>, I extends Record<string, any>, R extends Record<string, any>> = (config: C, inputs: I) => Promise<R>;

export const run: Run<Configurations, Parameters, Result> = (
  _configurations,
  params,
): Promise<Result> => {
  try {
    const parser = new Parser();
    const expr = parser.parse(params.expression);
    const result = expr.evaluate();
    return Promise.resolve({ ...result });
  } catch (error: unknown) {
    console.error('Error evaluating expression:', error);

    let errorMessage =
      'An unknown error occurred while evaluating the expression';

    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    }

    throw new Error(`Failed to evaluate expression: ${errorMessage}`);
  }
};
