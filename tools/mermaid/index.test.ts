// tools/mermaid-generator/index.test.ts

import { expect } from '@jest/globals';
import { getToolTestClient } from '../../src/test/utils';
import * as path from 'path';

describe('Mermaid Diagram Tool', () => {
  // Adjust the folder name and file name if necessary to match
  // where you put the mermaid generator code.
  const toolPath = path.join(__dirname, 'tool.ts');
  const client = getToolTestClient();

  it('generates a mermaid diagram from a simple description', async () => {
    const testDescription = 'Create a flow that goes from A to B to C.';

    // Execute tool
    const response = await client.executeToolFromFile(toolPath, { description: testDescription }, {}, ['local:::__official_shinkai:::shinkai_llm_prompt_processor']);
    // Expect the result to contain our output fields
    expect(response).toHaveProperty('pngBase64');
    expect(response).toHaveProperty('finalMermaid');

    // Validate some minimal checks
    expect(typeof response.pngBase64).toBe('string');
    expect(response.pngBase64.length).toBeGreaterThan(0);

    // We can also do a minimal check of whether finalMermaid contains "graph" or something relevant
    expect(response.finalMermaid).toMatch(/graph/i);
  }, 20000);

  it('handles invalid descriptions gracefully (or tries multiple times)', async () => {
    // Potentially we might feed in something bizarre to see if it times out or returns an error
    // or a fallback. Adjust as needed.
    const invalidDescription = '!!!@#$%^&*';

    try {
      const response = await client.executeToolFromFile(toolPath, {
        description: invalidDescription
      }, {}, ['local:::__official_shinkai:::shinkai_llm_prompt_processor']);
      // We expect it might still succeed or might fail. Adjust as needed for your logic.
      expect(response).toHaveProperty('pngBase64');
      expect(response).toHaveProperty('finalMermaid');
    } catch (err: any) {
      // If your code throws an error after the maximum attempts, we check that logic here.
      expect(err.message).toMatch(/Failed to produce a valid Mermaid diagram/i);
    }
  }, 30000);
});
