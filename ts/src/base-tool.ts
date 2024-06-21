export interface ITool<TConfig, TParams, TResult> {
    config: TConfig;
    run(params: TParams): Promise<TResult>;
}

export abstract class BaseTool<TConfig, TParams, TResult> implements ITool<TConfig, TParams, TResult> {
    config: TConfig;

    constructor(config: TConfig) {
        this.config = config;
    }
    abstract run(params: TParams): Promise<TResult>;
}
