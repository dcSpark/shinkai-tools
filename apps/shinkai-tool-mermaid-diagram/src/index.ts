import { ToolDefinition } from '@shinkai_protocol/shinkai-tools-runner';
import OpenAI from 'npm:openai@4.71.0';
import { chromium } from 'npm:playwright@1.48.2';
import chromePaths from 'npm:chrome-paths@1.0.1';

interface Configurations {
  openaiApiKey: string;
  openaiBaseUrl?: string;
  model?: string;
}

interface Parameters {
  description: string;
}

interface Result {
  mermaidCode: string;
  pngBase64: string;
}

const defaultModel = 'gpt-4';

async function generateMermaidDiagram(description: string, openai: InstanceType<typeof OpenAI>): Promise<string> {
  const response = await openai.chat.completions.create({
    model: defaultModel,
    messages: [
      {
        role: 'user',
        content: `Generate a mermaid diagram based on this description: ${description}. 
        Only output the mermaid code without any additional text or markdown formatting.
        Make sure to use proper mermaid syntax and include the graph type directive (e.g., graph TD, sequenceDiagram, etc.).`,
      },
    ],
    stream: false,
  });

  return response.choices[0]?.message?.content || '';
}

async function validateAndFixMermaidDiagram(
  mermaidCode: string,
  description: string,
  openai: InstanceType<typeof OpenAI>,
  browser: any,
): Promise<{ isValid: boolean; fixedCode?: string; error?: string }> {
  const page = await browser.newPage();
  let error: string | undefined;

  try {
    await page.setContent(`
      <html>
        <body>
          <div class="mermaid">
            ${mermaidCode}
          </div>
          <script type="module">
            import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';
            mermaid.initialize({ startOnLoad: true });
          </script>
        </body>
      </html>
    `);

    // Wait for potential error messages
    let validationError: string | undefined;
    page.on('console', (msg: { type(): string; text(): string }) => {
      if (msg.type() === 'error') {
        validationError = msg.text();
      }
    });

    await page.waitForTimeout(2000); // Give time for mermaid to process

    if (validationError) {
      // If there's an error, try to fix it using OpenAI
      const response = await openai.chat.completions.create({
        model: defaultModel,
        messages: [
          {
            role: 'user',
            content: `The following mermaid diagram code has an error: "${validationError}"\n\nOriginal code:\n${mermaidCode}\n\nPlease fix the code based on the error message and the original description: "${description}". Only output the fixed mermaid code without any additional text.`,
          },
        ],
        stream: false,
      });

      const fixedCode = response.choices[0]?.message?.content || '';
      return { isValid: false, fixedCode, error: validationError };
    }

    return { isValid: true };
  } catch (e) {
    error = e instanceof Error ? e.message : 'Unknown error occurred';
    return { isValid: false, error };
  } finally {
    await page.close();
  }
}

async function convertToBase64PNG(mermaidCode: string, browser: any): Promise<string> {
  const page = await browser.newPage();

  try {
    await page.setContent(`
      <html>
        <body>
          <div class="mermaid">
            ${mermaidCode}
          </div>
          <script type="module">
            import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';
            mermaid.initialize({ startOnLoad: true });
          </script>
        </body>
      </html>
    `);

    await page.waitForSelector('.mermaid svg');
    const element = await page.$('.mermaid');
    if (!element) {
      throw new Error('Could not find mermaid diagram element');
    }

    const screenshot = await element.screenshot({ type: 'png', encoding: 'base64' });
    return screenshot;
  } finally {
    await page.close();
  }
}

export const run = async (
  configurations: Configurations,
  parameters: Parameters,
): Promise<Result> => {
  const openai = new OpenAI({
    apiKey: configurations.openaiApiKey,
    baseURL: configurations.openaiBaseUrl || undefined,
  });

  const browser = await chromium.launch({
    executablePath: chromePaths.chrome || chromePaths.chromium || undefined,
  });

  try {
    let mermaidCode = await generateMermaidDiagram(parameters.description, openai);
    let validationResult = await validateAndFixMermaidDiagram(
      mermaidCode,
      parameters.description,
      openai,
      browser,
    );

    // If validation failed and we have a fixed version, use that
    if (!validationResult.isValid && validationResult.fixedCode) {
      mermaidCode = validationResult.fixedCode;
      // Validate the fixed code
      validationResult = await validateAndFixMermaidDiagram(
        mermaidCode,
        parameters.description,
        openai,
        browser,
      );
    }

    if (!validationResult.isValid) {
      throw new Error(
        `Failed to generate valid mermaid diagram: ${validationResult.error || 'Unknown error'}`,
      );
    }

    const pngBase64 = await convertToBase64PNG(mermaidCode, browser);

    return {
      mermaidCode,
      pngBase64,
    };
  } finally {
    await browser.close();
  }
};

export const definition: ToolDefinition<typeof run> = {
  id: 'shinkai-tool-mermaid-diagram',
  name: 'Shinkai: Mermaid Diagram Generator',
  description: 'Generates a mermaid diagram from a natural language description and converts it to PNG',
  author: 'Shinkai',
  keywords: ['mermaid', 'diagram', 'visualization', 'png'],
  configurations: {
    type: 'object',
    required: ['openaiApiKey'],
    properties: {
      openaiApiKey: {
        type: 'string',
        description: 'OpenAI API key',
      },
      openaiBaseUrl: {
        type: 'string',
        description: 'Optional custom OpenAI API base URL',
      },
      model: {
        type: 'string',
        description: 'Optional OpenAI model to use (defaults to gpt-4)',
      },
    },
  },
  parameters: {
    type: 'object',
    required: ['description'],
    properties: {
      description: {
        type: 'string',
        description: 'Natural language description of the diagram to generate',
      },
    },
  },
  result: {
    type: 'object',
    required: ['mermaidCode', 'pngBase64'],
    properties: {
      mermaidCode: {
        type: 'string',
        description: 'The generated mermaid diagram code',
      },
      pngBase64: {
        type: 'string',
        description: 'Base64-encoded PNG image of the rendered diagram',
      },
    },
  },
};
