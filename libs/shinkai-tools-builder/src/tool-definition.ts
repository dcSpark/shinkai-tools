import * as Ajv from 'ajv/dist/2019';

export interface ToolDefinition<
  TConfig extends Record<string, any>,
  TParameters extends Record<string, any>,
  TResult extends Record<string, any>,
> {
  id: string;
  name: string;
  description: string;
  author: string;
  keywords: string[];

  configurations: Ajv.JSONSchemaType<TConfig>;
  parameters: Ajv.JSONSchemaType<TParameters>;
  result: Ajv.JSONSchemaType<TResult>;
}
