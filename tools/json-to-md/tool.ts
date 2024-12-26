import * as nunjucks from 'npm:nunjucks@3.2.4';

type Configurations = {
  only_system: boolean;
};
type Parameters = {
  message: string;
  template: string;
};
type Result = { message: string };
export type Run<C extends Record<string, any>, I extends Record<string, any>, R extends Record<string, any>> = (config: C, inputs: I) => Promise<R>;

export const run: Run<Configurations, Parameters, Result> = (
  _configurations,
  parameters,
): Promise<Result> => {
  try {
    // Parse the input JSON string
    const inputData = JSON.parse(parameters.message);

    // Check if a template is provided
    if (!parameters.template) {
      throw new Error(
        'A template parameter is required to map the JSON to Markdown.',
      );
    }

    const template = parameters.template;

    // Configure Nunjucks (you can set options as needed)
    nunjucks.configure({ autoescape: false });

    // Render the template with the input data
    const markdown = nunjucks.renderString(template, inputData);

    return Promise.resolve({ message: markdown });
  } catch (error) {
    console.error('Error processing input:', error);
    return Promise.reject(new Error('Invalid input JSON or template'));
  }
};
