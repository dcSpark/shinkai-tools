import { assertEquals } from "https://deno.land/std@0.220.1/assert/assert_equals.ts";

const code = Deno.readTextFileSync(
  import.meta.dirname + "/../../tools/download-page/tool.ts"
);
const metadata = JSON.parse(
  Deno.readTextFileSync(
    import.meta.dirname + "/../../tools/download-page/metadata.json"
  )
);
const TOOL_TESTS = !!Deno.env.get("TOOL_TESTS");

type INPUTS = {
  url: string;
};

const X_SHINKAI_TOOL_ID = `example-${Math.random()
  .toString(36)
  .substring(2, 15)}`;

const X_SHINKAI_APP_ID = `run-${Math.random().toString(36).substring(2, 15)}`;

const base_url = Deno.env.get("SHINKAI_NODE_ADDR") ?? "http://localhost:9950";
const token = Deno.env.get("BEARER_TOKEN") ?? "debug";
const llm_provider = Deno.env.get("INITIAL_AGENT_NAMES")
  ? (Deno.env.get("INITIAL_AGENT_NAMES") ?? "").split(",")[0]
  : "llama3_1_8b";
async function runCommandTest(parameters: INPUTS) {
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
    }),
  });

  const data = await response.json();
  return data;
}

Deno.test({
  name: "Memory test",
  ignore: !TOOL_TESTS,
  fn: async () => {

    const parametersA: INPUTS = {
      url: "https://shinkai.com",
    };
    const dataA = await runCommandTest(parametersA);
    assertEquals(
      dataA.markdown.match(/open.source/gi).length > 0,
      true,
      "Page should mention open source"
    );
  },
});
