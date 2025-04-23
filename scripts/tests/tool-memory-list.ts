import {
  assertEquals,
  assert,
} from "https://deno.land/std@0.220.1/assert/mod.ts";

const X_SHINKAI_TOOL_ID = `example-${Math.random()
  .toString(36)
  .substring(2, 15)}`;
const X_SHINKAI_APP_ID = `run-${Math.random().toString(36).substring(2, 15)}`;

const base_url = Deno.env.get("SHINKAI_NODE_ADDR") ?? "http://localhost:9950";
const token = Deno.env.get("BEARER_TOKEN") ?? "debug";
const llm_provider = Deno.env.get("INITIAL_AGENT_NAMES")
  ? (Deno.env.get("INITIAL_AGENT_NAMES") ?? "").split(",")[0]
  : "llama3_1_8b";

const TOOL_TESTS = !!Deno.env.get("TOOL_TESTS");

const code = Deno.readTextFileSync(
  import.meta.dirname + "/../../tools/memory-list/tool.ts"
);
const metadata = JSON.parse(
  Deno.readTextFileSync(
    import.meta.dirname + "/../../tools/memory-list/metadata.json"
  )
);
if (!code || !metadata) {
  throw new Error("Cannot find tool code or metadata");
}

type CONFIG = {
  database_name?: string;
};
type INPUTS = {
  action: string; // 'insert' | 'update' | 'retrieve' | 'retrieve_all' | 'delete'
  data?: string;
  memory_id?: number;
};
type OUTPUT = {
  memory?: string;
  all_memories?: { id: number; memory: string }[];
  id?: number;
};

async function runCommandTest(
  parameters: INPUTS,
  config?: CONFIG
): Promise<OUTPUT> {
  const response = await fetch(base_url + "/v2/code_execution", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token,
      "x-shinkai-tool-id": X_SHINKAI_TOOL_ID,
      "x-shinkai-app-id": X_SHINKAI_APP_ID,
      "x-shinkai-llm-provider": llm_provider,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      code,
      tool_type: "denodynamic",
      llm_provider,
      tools: metadata.tools || [],
      parameters,
      extra_config: config,
    }),
  });

  const data = await response.json();
  return data as OUTPUT;
}

Deno.test({
  name: "Memory List test",
  ignore: !TOOL_TESTS,
  fn: async (t) => {
    // Test 1: Insert a memory
    let memoryId: number | undefined;
    await t.step('Insert a memory', async () => {
      const result = await runCommandTest({
        action: "insert",
        data: "First memory",
      });
      assert(result.id !== undefined, "Memory ID should be returned");
      assert(result.memory === "First memory", "Memory should be set to 'First memory'");

      // Store the ID for later tests
      memoryId = result.id;
    });

    // Test 2: Retrieve the memory by ID
    await t.step('Retrieve memory by ID', async () => {
      const retrieveResult = await runCommandTest({
        action: "retrieve",
        memory_id: memoryId,
      });
      assertEquals(retrieveResult.memory, "First memory", "Memory should be 'First memory'");
      assertEquals(retrieveResult.id, memoryId, "Memory ID should match");
    });

    // Test 3: Update the memory
    await t.step('Update memory', async () => {
      const updateResult = await runCommandTest({
        action: "update",
        data: "Updated memory",
        memory_id: memoryId,
      });
      assertEquals(updateResult.memory, "Updated memory", "Memory should be updated");
      assertEquals(updateResult.id, memoryId, "Memory ID should match");
    });

    // Test 4: Verify the update
    await t.step('Verify update', async () => {
      const verifyResult = await runCommandTest({
        action: "retrieve",
        memory_id: memoryId,
      });
      assertEquals(verifyResult.memory, "Updated memory", "Memory should be 'Updated memory'");
    });

    // Test 5: Insert another memory
    let secondResult: OUTPUT | undefined;
    await t.step('Insert another memory', async () => {
      secondResult = await runCommandTest({
        action: "insert",
        data: "Second memory",
      });
      assert(secondResult.id !== undefined, "Second memory ID should be returned");
      assert(secondResult.id !== memoryId, "Second memory should have a different ID");
    });

    // Test 6: Retrieve all memories
    await t.step('Retrieve all memories', async () => {
      const allMemoriesResult = await runCommandTest({
        action: "retrieve_all",
      });
      assert(allMemoriesResult.all_memories !== undefined, "all_memories should be defined");
      assert(allMemoriesResult.all_memories!.length >= 2, "Should have at least two memories");

      // Check if both memories are in the results
      const firstMemory = allMemoriesResult.all_memories!.find(m => m.id === memoryId);
      const secondMemory = allMemoriesResult.all_memories!.find(m => m.id === secondResult!.id);

      assert(firstMemory !== undefined, "First memory should be in results");
      assert(secondMemory !== undefined, "Second memory should be in results");

      assertEquals(firstMemory!.memory, "Updated memory", "First memory should be 'Updated memory'");
      assertEquals(secondMemory!.memory, "Second memory", "Second memory should be 'Second memory'");
    });

    // Test 7: Delete the first memory
    await t.step('Delete first memory', async () => {
      const deleteResult = await runCommandTest({
        action: "delete",
        memory_id: memoryId,
      });
      assertEquals(deleteResult.id, memoryId, "Deleted memory ID should match");
      assertEquals(deleteResult.memory, "", "Deleted memory should be empty");
    });

    // Test 8: Verify the first memory is deleted
    await t.step('Verify deletion', async () => {
      const verifyDeleteResult = await runCommandTest({
        action: "retrieve",
        memory_id: memoryId,
      });
      assertEquals(verifyDeleteResult.memory, "", "Deleted memory should be empty");
    });

    // Test 9: Verify the second memory still exists
    await t.step('Verify second memory still exists', async () => {
      const verifySecondResult = await runCommandTest({
        action: "retrieve",
        memory_id: secondResult!.id,
      });
      assertEquals(verifySecondResult.memory, "Second memory", "Second memory should still exist");
    });

    // Test 10: Retrieve all memories after deletion
    await t.step('Retrieve all memories after deletion', async () => {
      const allMemoriesAfterDelete = await runCommandTest({
        action: "retrieve_all",
      });
      assert(allMemoriesAfterDelete.all_memories !== undefined, "all_memories should be defined");

      // Check if first memory is not in results and second memory is
      const firstMemoryAfterDelete = allMemoriesAfterDelete.all_memories!.find(m => m.id === memoryId);
      const secondMemoryAfterDelete = allMemoriesAfterDelete.all_memories!.find(m => m.id === secondResult!.id);

      assert(firstMemoryAfterDelete === undefined, "First memory should not be in results");
      assert(secondMemoryAfterDelete !== undefined, "Second memory should be in results");

      assertEquals(secondMemoryAfterDelete!.memory, "Second memory", "Second memory should be 'Second memory'");
    });
  },
});

// Add a new test for database name configuration
Deno.test({
  name: "Memory List test with custom database name",
  ignore: !TOOL_TESTS,
  fn: async (t) => {
    const customDbName = `test-db-${Math.random()
      .toString(36)
      .substring(2, 15)}`;

    // Test 1: Insert a memory in custom database
    let customDbMemoryId: number | undefined;
    await t.step('Insert memory in custom database', async () => {
      const result = await runCommandTest(
        {
          action: "insert",
          data: "Custom DB Memory",
        },
        { database_name: customDbName }
      );
      assert(result.id !== undefined, "Memory ID should be returned");
      assert(result.memory === "Custom DB Memory", "Memory should be set to 'Custom DB Memory'");

      // Store the ID for later tests
      customDbMemoryId = result.id;
    });

    // Test 2: Retrieve the memory from custom database
    await t.step('Retrieve memory from custom database', async () => {
      const retrieveResult = await runCommandTest(
        {
          action: "retrieve",
          memory_id: customDbMemoryId,
        },
        { database_name: customDbName }
      );
      assertEquals(retrieveResult.memory, "Custom DB Memory", "Memory should be 'Custom DB Memory'");
      assertEquals(retrieveResult.id, customDbMemoryId, "Memory ID should match");
    });

    // Test 3: Verify the memory is not in default database
    await t.step('Verify memory is not in default database', async () => {
      const defaultDbResult = await runCommandTest({
        action: "retrieve",
        memory_id: customDbMemoryId,
      });
      assertEquals(defaultDbResult.memory, "", "Memory should be empty in default database");
    });

    // Test 4: Retrieve all memories from custom database
    await t.step('Retrieve all memories from custom database', async () => {
      const allMemoriesResult = await runCommandTest(
        {
          action: "retrieve_all",
        },
        { database_name: customDbName }
      );
      assert(allMemoriesResult.all_memories !== undefined, "all_memories should be defined");
      assert(allMemoriesResult.all_memories!.length >= 1, "Should have at least one memory");

      // Check if the memory is in the results
      const customDbMemory = allMemoriesResult.all_memories!.find(m => m.id === customDbMemoryId);

      assert(customDbMemory !== undefined, "Custom DB memory should be in results");
      assertEquals(customDbMemory!.memory, "Custom DB Memory", "Custom DB memory should be 'Custom DB Memory'");
    });

    // Test 5: Delete the memory from custom database
    await t.step('Delete memory from custom database', async () => {
      const deleteResult = await runCommandTest(
        {
          action: "delete",
          memory_id: customDbMemoryId,
        },
        { database_name: customDbName }
      );
      assertEquals(deleteResult.id, customDbMemoryId, "Deleted memory ID should match");
      assertEquals(deleteResult.memory, "", "Deleted memory should be empty");
    });

    // Test 6: Verify the memory is deleted from custom database
    await t.step('Verify deletion from custom database', async () => {
      const verifyDeleteResult = await runCommandTest(
        {
          action: "retrieve",
          memory_id: customDbMemoryId,
        },
        { database_name: customDbName }
      );
      assertEquals(verifyDeleteResult.memory, "", "Deleted memory should be empty");
    });
  },
});
