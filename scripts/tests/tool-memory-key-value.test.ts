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
  import.meta.dirname + "/../../tools/memory-key-value/tool.ts"
);
const metadata = JSON.parse(
  Deno.readTextFileSync(
    import.meta.dirname + "/../../tools/memory-key-value/metadata.json"
  )
);
if (!code || !metadata) {
  throw new Error("Cannot find tool code or metadata");
}

type CONFIG = {
  database_name?: string;
};
type INPUTS = {
  action: "upsert" | "retrieve";
  data?: string;
  memory_key?: string;
};
type OUTPUT = {
  memory?: string;
  all_memories?: { key: string; memory: string }[];
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
  name: "Memory test",
  ignore: !TOOL_TESTS,
  fn: async (t) => {
    // Test 1: Insert "HELLO" into "WORLD"
    await t.step('Insert "HELLO" into "WORLD"', async () => {
      const result = await runCommandTest({
        action: "upsert",
        data: "HELLO",
        memory_key: "WORLD",
      });
      assertEquals(result.memory, "HELLO", "Memory should be set to HELLO");
    });

    // Test 2: Retrieve "WORLD" (should be "HELLO")
    await t.step('Retrieve "WORLD"', async () => {
      const result = await runCommandTest({
        action: "retrieve",
        memory_key: "WORLD",
      });
      assertEquals(result.memory, "HELLO", "Memory should be HELLO");
    });

    // Test 3: Insert "HOLA" into "MUNDO"
    await t.step('Insert "HOLA" into "MUNDO"', async () => {
      const result = await runCommandTest({
        action: "upsert",
        data: "HOLA",
        memory_key: "MUNDO",
      });
      assertEquals(result.memory, "HOLA", "Memory should be set to HOLA");
    });

    // Test 4: Retrieve "MUNDO" (should be "HOLA")
    await t.step('Retrieve "MUNDO"', async () => {
      const result = await runCommandTest({
        action: "retrieve",
        memory_key: "MUNDO",
      });
      assertEquals(result.memory, "HOLA", "Memory should be HOLA");
    });

    // Test 5: Clear "MUNDO" (by setting it to empty string)
    await t.step('Clear "MUNDO"', async () => {
      const result = await runCommandTest({
        action: "upsert",
        data: "",
        memory_key: "MUNDO",
      });
      assertEquals(result.memory, "", "Memory should be empty");
    });

    // Test 6: Retrieve "MUNDO" (should be empty)
    await t.step('Retrieve "MUNDO" after clearing', async () => {
      const result = await runCommandTest({
        action: "retrieve",
        memory_key: "MUNDO",
      });
      assertEquals(result.memory, "", "Memory should be empty");
    });

    // Test 7: Retrieve "WORLD" (should still be "HELLO")
    await t.step('Retrieve "WORLD" again', async () => {
      const result = await runCommandTest({
        action: "retrieve",
        memory_key: "WORLD",
      });
      assertEquals(result.memory, "HELLO", "Memory should still be HELLO");
    });

    // Test 8: Retrieve all memories
    await t.step("Retrieve all memories", async () => {
      const result = await runCommandTest({
        action: "retrieve",
      });
      assert(
        result.all_memories !== undefined,
        "all_memories should be defined"
      );
      assert(
        result.all_memories!.length >= 1,
        "Should have at least one memory"
      );

      // Check if WORLD and MUNDO are in the results
      const worldMemory = result.all_memories!.find((m) => m.key === "world");
      const mundoMemory = result.all_memories!.find((m) => m.key === "mundo");

      assert(worldMemory !== undefined, "WORLD memory should be in results");
      assert(mundoMemory !== undefined, "MUNDO memory should be in results");

      assertEquals(
        worldMemory!.memory,
        "HELLO",
        "WORLD memory should be HELLO"
      );
      assertEquals(mundoMemory!.memory, "", "MUNDO memory should be empty");
    });
  },
});

// Add a new test for database name configuration
Deno.test({
  name: "Memory test with custom database name",
  ignore: !TOOL_TESTS,
  fn: async (t) => {
    const customDbName = `test-db-${Math.random()
      .toString(36)
      .substring(2, 15)}`;

    // Test 1: Insert "CUSTOM" into "TEST" using custom database
    await t.step(
      'Insert "CUSTOM" into "TEST" with custom database',
      async () => {
        const result = await runCommandTest(
          {
            action: "upsert",
            data: "CUSTOM",
            memory_key: "TEST",
          },
          { database_name: customDbName }
        );
        assertEquals(result.memory, "CUSTOM", "Memory should be set to CUSTOM");
      }
    );

    // Test 2: Retrieve "TEST" from custom database (should be "CUSTOM")
    await t.step('Retrieve "TEST" from custom database', async () => {
      const result = await runCommandTest(
        {
          action: "retrieve",
          memory_key: "TEST",
        },
        { database_name: customDbName }
      );
      assertEquals(result.memory, "CUSTOM", "Memory should be CUSTOM");
    });

    // Test 3: Verify "TEST" is not in default database
    await t.step('Verify "TEST" is not in default database', async () => {
      const result = await runCommandTest({
        action: "retrieve",
        memory_key: "TEST",
      });
      assertEquals(
        result.memory,
        "",
        "Memory should be empty in default database"
      );
    });

    // Test 4: Verify "WORLD" is still in default database
    await t.step('Verify "WORLD" is still in default database', async () => {
      const result = await runCommandTest({
        action: "retrieve",
        memory_key: "WORLD",
      });
      assertEquals(
        result.memory,
        "HELLO",
        "Memory should still be HELLO in default database"
      );
    });

    // Test 5: Retrieve all memories from custom database
    await t.step("Retrieve all memories from custom database", async () => {
      const result = await runCommandTest(
        {
          action: "retrieve",
        },
        { database_name: customDbName }
      );

      assert(
        result.all_memories !== undefined,
        "all_memories should be defined"
      );
      assert(
        result.all_memories!.length >= 1,
        "Should have at least one memory"
      );

      // Check if TEST is in the results
      const testMemory = result.all_memories!.find((m) => m.key === "test");

      assert(testMemory !== undefined, "TEST memory should be in results");
      assertEquals(
        testMemory!.memory,
        "CUSTOM",
        "TEST memory should be CUSTOM"
      );
    });
  },
});
