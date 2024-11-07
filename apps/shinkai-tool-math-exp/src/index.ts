import { Parser } from 'npm:expr-eval@2.0.2';

type Configurations = {};
type Parameters = {
  expression: string;
};
type Result = { result: string };

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

export const definition: ToolDefinition<typeof run> = {
  id: 'shinkai-tool-math-exp',
  name: 'Shinkai: Math Expression Evaluator',
  description:
    'Parses and evaluates mathematical expressions. It’s a safer and more math-oriented alternative to using JavaScript’s eval function for mathematical expressions.',
  author: 'Shinkai',
  keywords: ['math', 'expr-eval', 'shinkai'],
  configurations: {
    type: 'object',
    properties: {},
    required: [],
  },
  parameters: {
    type: 'object',
    properties: {
      expression: { type: 'string' },
    },
    required: ['expression'],
  },
  result: {
    type: 'object',
    properties: {
      result: { type: 'string' },
    },
    required: ['result'],
  },
};
