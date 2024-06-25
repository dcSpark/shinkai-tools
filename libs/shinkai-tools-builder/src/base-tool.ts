export interface ITool<TConfig, TParams, TResult> {
    config: TConfig;
    run(params: TParams): Promise<TResult>;
    setConfig(config: TConfig): TConfig;
    getConfig(): TConfig;
}

export abstract class BaseTool<TConfig, TParams, TResult> implements ITool<TConfig, TParams, TResult> {
    config: TConfig;

    constructor(config: TConfig) {
        this.config = config;
    }

    abstract run(params: TParams): Promise<TResult>;
    
    setConfig(value: TConfig): TConfig {
        this.config = value;
        return this.config;
    }
    getConfig(): TConfig {
        return this.config;
    }
}
