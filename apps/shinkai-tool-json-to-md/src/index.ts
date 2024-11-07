import * as nunjucks from 'npm:nunjucks@3.2.4';

type Configurations = {
  only_system: boolean;
};
type Parameters = {
  message: string;
  template: string;
};
type Result = { message: string };

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

export const definition: ToolDefinition<typeof run> = {
  id: 'shinkai-tool-json-to-md',
  name: 'Shinkai: json-to-md',
  description:
    'Converts JSON to Markdown using a Nunjucks (Jinja2-like) template',
  author: 'Shinkai',
  keywords: ['json-to-md', 'shinkai', 'nunjucks', 'jinja2', 'templating'],
  configurations: {
    type: 'object',
    properties: {
      only_system: { type: 'boolean' },
    },
    required: ['only_system'],
  },
  parameters: {
    type: 'object',
    properties: {
      message: { type: 'string' },
      template: { type: 'string' },
    },
    required: ['message', 'template'],
  },
  result: {
    type: 'object',
    properties: {
      message: { type: 'string' },
    },
    required: ['message'],
  },
};
