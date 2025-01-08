declare module 'npm:openai@4.71.0' {
  interface ChatCompletionUserMessageParam {
    role: 'user';
    content: string;
  }

  class OpenAIClient {
    constructor(config: { baseURL: string; apiKey: string });
    chat: {
      completions: {
        create(params: {
          model: string;
          messages: ChatCompletionUserMessageParam[];
          stream: boolean;
        }): Promise<{
          choices: Array<{
            message?: {
              content: string;
            };
          }>;
        }>;
      };
    };
  }

  const OpenAI: {
    new(config: { baseURL: string; apiKey: string }): OpenAIClient;
  };
  export { ChatCompletionUserMessageParam };
  export default OpenAI;
}

declare module 'npm:playwright@1.48.2' {
  export interface Browser {
    newContext(): Promise<BrowserContext>;
    close(): Promise<void>;
  }

  export interface BrowserContext {
    newPage(): Promise<Page>;
    close(): Promise<void>;
  }

  export interface Page {
    setContent(html: string): Promise<void>;
    waitForSelector(selector: string): Promise<void>;
    waitForTimeout(ms: number): Promise<void>;
    $(selector: string): Promise<ElementHandle | null>;
    on(event: string, callback: (msg: { type(): string; text(): string }) => void): void;
    close(): Promise<void>;
  }

  export interface ElementHandle {
    screenshot(options: { type: string; encoding: string }): Promise<string>;
  }

  export const chromium: {
    launch(options: { executablePath: string }): Promise<Browser>;
  };
}

declare module 'npm:chrome-paths@1.0.1' {
  interface ChromePaths {
    chrome?: string;
    chromium?: string;
  }
  const paths: ChromePaths;
  export default paths;
}
