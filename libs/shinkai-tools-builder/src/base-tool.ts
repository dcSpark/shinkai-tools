import { ToolDefinition } from './tool-definition';

export interface RunResult<T> {
  data: T;
}

export interface ITool<
  TConfig extends Record<string, any>,
  TParameters extends Record<string, any>,
  TResult extends Record<string, any>,
> {
  definition: ToolDefinition<TConfig, TParameters, TResult>;
  config: TConfig;
  getDefinition(): ToolDefinition<TConfig, TParameters, TResult>;
  run(params: TParameters): Promise<RunResult<TResult>>;
  setConfig(config: TConfig): TConfig;
  getConfig(): TConfig;
}

export abstract class BaseTool<
  TConfig extends Record<string, any>,
  TParameters extends Record<string, any>,
  TResult extends Record<string, any>,
> implements ITool<TConfig, TParameters, TResult>
{
  abstract readonly definition: ToolDefinition<TConfig, TParameters, TResult>;

  config: TConfig;

  constructor(config: TConfig) {
    this.config = config;
  }

  abstract run(params: TParameters): Promise<RunResult<TResult>>;

  getDefinition(): ToolDefinition<TConfig, TParameters, TResult> {
    return this.definition;
  }

  setConfig(value: TConfig): TConfig {
    this.config = value;
    return this.config;
  }
  getConfig(): TConfig {
    return this.config;
  }
}
