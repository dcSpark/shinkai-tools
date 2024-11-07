import * as Ajv from 'npm:ajv/dist/2019';

declare global {
  export type BaseConfigurations = {} | Record<string, any>;
  export type BaseParameters = {} | Record<string, any>;
  export type BaseResult = {} | Record<string, any>;

  export type Run<
    TConfigurations extends BaseConfigurations,
    TParameters extends BaseParameters,
    TResult extends BaseResult,
  > = (
    configurations: TConfigurations,
    parameters: TParameters,
  ) => Promise<TResult>;

  export interface ToolDefinition<TRun extends Run<any, any, any>> {
    id: string;
    name: string;
    description: string;
    author: string;
    keywords: string[];

    configurations: Ajv.JSONSchemaType<Parameters<TRun>[0]>;
    parameters: Ajv.JSONSchemaType<Parameters<TRun>[1]>;
    result: Ajv.JSONSchemaType<Awaited<ReturnType<TRun>>>;

    embedding_metadata?: {
      model_name: string;
      embeddings: number[];
    };
  }
}
