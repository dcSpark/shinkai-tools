import axios from 'npm:axios@1.7.7';
import { shinkaiLlmPromptProcessor } from './shinkai-local-tools.ts';
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";
import { deflate } from "https://deno.land/x/compress@v0.4.5/zlib/deflate.ts";
import { getHomePath } from './shinkai-local-support.ts';
/**
 * Configuration for the tool.
 */
type CONFIG = {
  /**
   * How many times to attempt LLM fixes if Kroki fails to parse the Mermaid diagram.
   */
  maxRetries?: number;
};

/**
 * Inputs for the tool: a single textual description from the user.
 */
type INPUTS = {
  description: string;
};

/**
 * Final output from the tool:
 * - The base64-encoded PNG
 * - The final (valid) Mermaid code that was successfully parsed.
 */
type OUTPUT = {
  filePath: string;
  finalMermaid: string;
};

/**
 * This function:
 * 1. Takes a textual description and asks an LLM to produce Mermaid code.
 * 2. Sends the Mermaid code to Kroki (https://kroki.io/) to validate and render a PNG.
 * 3. If Kroki fails to parse, it sends the error back to the LLM to refine the Mermaid code.
 * 4. Repeats up to `maxRetries` times. If still invalid, throws an error.
 */
export async function run(config: CONFIG, inputs: INPUTS): Promise<OUTPUT> {
  const { description } = inputs;
  const maxRetries = config.maxRetries ?? 5;

  /**
   * Attempt to render with Kroki. On success: return { ok: true, data: Buffer }.
   * On failure: return { ok: false, error: string }.
   */
  async function tryKrokiRender(mermaidCode: string) {
    console.log('Attempting to render with Kroki:', { mermaidCode });
    
    // Basic validation before sending to Kroki
    if (!mermaidCode.trim().startsWith('graph')) {
      console.log('Basic validation failed: Code does not start with "graph"');
      return { ok: false, error: 'Invalid Mermaid syntax: Must start with "graph"' };
    }

    try {
      // First deflate the diagram
      const encoder = new TextEncoder();
      const compressed = deflate(encoder.encode(mermaidCode.trim()), { level: 9 });
      // Then base64 encode it
      const encodedDiagram = encodeBase64(compressed).replace(/\+/g, '-').replace(/\//g, '_');
      console.log('Encoded diagram:', { encodedDiagram });
      
      console.log('Sending request to Kroki...');
      const resp = await axios.get(`https://kroki.io/mermaid/png/${encodedDiagram}`, {
        responseType: 'arraybuffer',
        timeout: 30000,
        headers: {
          'Accept': 'image/png',
        },
        validateStatus: (status) => status === 200,
      });
      
      console.log('Received successful response from Kroki');
      return { ok: true, data: new Uint8Array(resp.data) };
    } catch (err: any) {
      console.log('Error from Kroki:', {
        status: err.response?.status,
        headers: err.response?.headers,
        isAxiosError: err.isAxiosError,
        message: err.message,
        data: err.response?.data?.toString()
      });

      // Handle various error cases
      if (err.response) {
        const errorData = err.response.data;
        let errorMessage = '';
        
        try {
          // Try to parse error as JSON if it's not binary data
          if (err.response.headers['content-type']?.includes('application/json')) {
            const jsonError = JSON.parse(errorData.toString());
            errorMessage = jsonError.error || jsonError.message || String(errorData);
          } else {
            errorMessage = errorData.toString();
          }
        } catch (parseErr) {
          console.log('Error parsing error response:', parseErr);
          errorMessage = errorData.toString();
        }

        console.log('Formatted error message:', errorMessage);
        return {
          ok: false,
          error: `Kroki error (HTTP ${err.response.status}): ${errorMessage}`,
        };
      }

      // Network or other errors
      return { ok: false, error: `Request failed: ${err.message}` };
    }
  }

  /**
   * Validate Mermaid syntax before sending to Kroki
   */
  function validateMermaidSyntax(code: string): { isValid: boolean; error?: string } {
    console.log('Validating Mermaid syntax for:', { code });
    
    const trimmed = code.trim();
    
    // Basic syntax checks
    if (!trimmed.toLowerCase().startsWith('graph')) {
      console.log('Validation failed: Does not start with "graph"');
      return { isValid: false, error: 'Diagram must start with "graph"' };
    }

    const lines = trimmed.split('\n').map(line => line.trim()).filter(line => line);
    console.log('Processing lines:', { lines });
    
    const firstLine = lines[0];
    
    // Check graph direction
    if (!firstLine.toLowerCase().match(/^graph\s+(td|lr)$/)) {
      console.log('Validation failed: Invalid graph direction:', { firstLine });
      return { isValid: false, error: 'First line must be "graph TD" or "graph LR"' };
    }

    // Check for basic node definitions
    const nodeLines = lines.slice(1);
    for (const line of nodeLines) {
      console.log('Checking node line:', { line });
      // More lenient regex allowing (), {}, [], optional ;, and underscores in IDs
      if (!line.match(/^[A-Za-z0-9_]+(?:\[[^\]]+\]|\([^)]+\)|\{[^}]+\})?\s*(?:-->|---|==>)\s*[A-Za-z0-9_]+(?:\[[^\]]+\]|\([^)]+\)|\{[^}]+\})?\s*;?\s*$/)) {
        console.log('Validation failed: Invalid node definition or link syntax:', { line });
        return { isValid: false, error: `Invalid node definition or link syntax: ${line}` };
      }
    }

    console.log('Validation successful');
    return { isValid: true };
  }

  /**
   * LLM prompt to request a new or revised Mermaid code from the LLM.
   */
  async function requestMermaid(
    userDescription: string,
    priorError?: string,
    priorCode?: string
  ): Promise<string> {
    let prompt = '';
    if (!priorError) {
      // initial request
      prompt = `Create a valid Mermaid.js diagram based on this description: "${userDescription}"

Rules:
1. Start with either 'graph TD' (top-down) or 'graph LR' (left-right)
2. Use simple node names (A, B, C, etc.) with descriptive labels in brackets
3. Use standard arrows (-->)
4. Avoid special characters in labels
5. Return ONLY the Mermaid code, no explanations

Example of valid format:
graph TD
    A[Start] --> B[Process]
    B --> C[End]`;
    } else {
      // revise with specific guidance based on prior error
      prompt = `The following Mermaid code needs correction:
\`\`\`
${priorCode}
\`\`\`

Error received: ${priorError}

Please provide a corrected version following these rules:
1. Keep the diagram simple and minimal
2. Use only basic Mermaid syntax (graph TD/LR, basic nodes, arrows)
3. Ensure all nodes are properly defined before being referenced
4. Avoid special characters or complex styling
5. Return ONLY the corrected Mermaid code

Example of valid format:
graph TD
    A[Start] --> B[Process]
    B --> C[End]`;
    }
    const resp = await shinkaiLlmPromptProcessor({ format: 'text', prompt });
    
    // Clean up the response to extract just the Mermaid code
    let code = resp.message.trim();
    // Remove any markdown code block markers
    code = code.replace(/^```mermaid\n/m, '').replace(/^```\n/m, '').replace(/```$/m, '');
    return code.trim();
  }

  // Main logic:
  console.log('Starting Mermaid diagram generation for description:', { description });
  let currentMermaid = await requestMermaid(description, undefined, undefined);
  console.log('Initial Mermaid code generated:', { currentMermaid });
  let filePath = '';
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    console.log(`Attempt ${attempt + 1}/${maxRetries}`);
    
    // Validate syntax before sending to Kroki
    const validation = validateMermaidSyntax(currentMermaid);
    if (!validation.isValid) {
      console.log('Validation failed:', validation.error);
      // If invalid syntax, try to get a new diagram
      currentMermaid = await requestMermaid(
        description,
        `Invalid Mermaid syntax: ${validation.error}`,
        currentMermaid
      );
      console.log('Generated new Mermaid code after validation failure:', { currentMermaid });
      continue;
    }

    console.log('Validation passed, attempting to render');
    const renderResult = await tryKrokiRender(currentMermaid);
    if (renderResult.ok && renderResult.data) {
      console.log('Successfully rendered diagram');

      // Ensure data is not empty before writing to file
      if (renderResult.data.length > 0) {
        console.log(`Writing ${renderResult.data.length} bytes to file`);
        // Debug the data before writing
        console.log('Data type:', renderResult.data.constructor.name);
        console.log('First few bytes:', Array.from(renderResult.data.slice(0, 10)));
        try {
          filePath = await getHomePath() + '/mermaid.png';
          await Deno.writeFile(filePath, renderResult.data);
          
          // Verify the file was written correctly
          const fileInfo = await Deno.stat(filePath);
          console.log(`File written successfully. Size: ${fileInfo.size} bytes`);
          
          if (fileInfo.size === 0) {
            console.error('Warning: File was created but is empty');
          }
        } catch (err: any) {
          console.error('Error writing file:', err);
          throw new Error(`Failed to write PNG file: ${err.message}`);
        }
      } else {
        console.error('Error: Received 0 bytes data from Kroki');
        throw new Error('Received empty image data from Kroki');
      }

      return {
        filePath,
        finalMermaid: currentMermaid,
      };
    } else {
      console.log('Render failed:', renderResult.error);
      // Some error from Kroki. Let's refine
      const errorMessage = renderResult.error || 'Unknown error';
      currentMermaid = await requestMermaid(description, errorMessage, currentMermaid);
      console.log('Generated new Mermaid code after render failure:', { currentMermaid });
    }
  }

  console.log('Exhausted all attempts, throwing error');
  // If we've exhausted attempts, throw an error
  throw new Error(
    `Failed to produce a valid Mermaid diagram after ${maxRetries} attempts. Last code:\n${currentMermaid}`
  );
}
