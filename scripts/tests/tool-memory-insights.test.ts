import { assertEquals } from "https://deno.land/std@0.220.1/assert/mod.ts";

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
  import.meta.dirname + "/../../tools/memory-insights/tool.ts"
);
const metadata = JSON.parse(
  Deno.readTextFileSync(
    import.meta.dirname + "/../../tools/memory-insights/metadata.json"
  )
);
if (!code || !metadata) {
  throw new Error("Cannot find tool code or metadata");
}

type CONFIG = {
  database_name?: string;
  general_prompt?: string;
  specific_prompt?: string;
};
type INPUTS = {
  data?: string;
  memory_key?: string;
};
type OUTPUT = {
  general_memory: string;
  specific_memory: string;
};

async function runCommandTest(parameters: INPUTS): Promise<OUTPUT> {
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
  return data as OUTPUT;
}

Deno.test({
  name: "Memory test",
  ignore: !TOOL_TESTS,
  fn: async (t) => {
    await t.step('Store "Chile" in general memory', async () => {
      const parametersA: INPUTS = {
        data: "Chile,[a] officially the Republic of Chile,[b] is a country in western South America. It is the southernmost country in the world and the closest to Antarctica, stretching along a narrow strip of land between the Andes Mountains and the Pacific Ocean. Chile had a population of 17.5 million as of the latest census in 2017 and has a territorial area of 756,102 square kilometers (291,933 sq mi),[10][3] sharing borders with Peru to the north, Bolivia to the northeast, Argentina to the east, and the Drake Passage to the south. The country also controls several Pacific islands, including Juan Fernández, Isla Salas y Gómez, Desventuradas, and Easter Island, and claims about 1,250,000 square kilometers (480,000 sq mi) of Antarctica as the Chilean Antarctic Territory.[nb 2] The capital and largest city of Chile is Santiago, and the national language is Spanish.",
      };
      const dataA = await runCommandTest(parametersA);
      const match = dataA.general_memory.match(/Chile/i);
      assertEquals(
        match && match.length > 0,
        true,
        "Output: " + JSON.stringify(dataA)
      );
    });

    await t.step('Store "Argentina" in general memory', async () => {
      const parametersB: INPUTS = {
        data: "Argentina,[C] officially the Argentine Republic,[A][D] is a country in the southern half of South America. Argentina covers an area of 2,780,400 km2 (1,073,500 sq mi),[B] making it the second-largest country in South America after Brazil, the fourth-largest country in the Americas, and the eighth-largest country in the world. It shares the bulk of the Southern Cone with Chile to the west, and is also bordered by Bolivia and Paraguay to the north, Brazil to the northeast, Uruguay and the South Atlantic Ocean to the east, and the Drake Passage to the south. Argentina is a federal state subdivided into twenty-three provinces, and one autonomous city, which is the federal capital and largest city of the nation, Buenos Aires. The provinces and the capital have their own constitutions, but exist under a federal system. Argentina claims sovereignty over the Falkland Islands, South Georgia and the South Sandwich Islands, the Southern Patagonian Ice Field, and a part of Antarctica.",
      };

      const dataB = await runCommandTest(parametersB);
      // console.log('================================\nExpected: Chile & Argentina\n', dataB.generalMemory);
      const match1 = dataB.general_memory.match(/Chile/i);
      assertEquals(
        match1 && match1.length > 0,
        true,
        "Output: " + JSON.stringify(dataB)
      );
      const match2 = dataB.general_memory.match(/Argentina/i);
      assertEquals(
        match2 && match2.length > 0,
        true,
        "Output: " + JSON.stringify(dataB)
      );
    });

    await t.step('Store "Spain" in specific memory', async () => {
      const parametersC: INPUTS = {
        data: "Spain,[f] officially the Kingdom of Spain,[a][g] is a country in Southwestern Europe with territories in North Africa.[12][h] Featuring the southernmost point of continental Europe, it is the largest country in Southern Europe and the fourth-most populous European Union member state. Spanning across the majority of the Iberian Peninsula, its territory also includes the Canary Islands, in the Eastern Atlantic Ocean, the Balearic Islands, in the Western Mediterranean Sea, and the autonomous cities of Ceuta and Melilla, in Africa. Peninsular Spain is bordered to the north by France, Andorra, and the Bay of Biscay; to the east and south by the Mediterranean Sea and Gibraltar; and to the west by Portugal and the Atlantic Ocean. Spain's capital and largest city is Madrid, and other major urban areas include Barcelona, Valencia, Seville, Zaragoza, Málaga, Murcia and Palma de Mallorca.",
        memory_key: "spain",
      };

      const dataC = await runCommandTest(parametersC);
      // console.log('================================\nExpected: Spain\n', dataC.specific_memory);
      const match1 = dataC.specific_memory.match(/Spain/i);
      assertEquals(
        match1 && match1.length > 0,
        true,
        "Output: " + JSON.stringify(dataC)
      );
      const match2 = dataC.specific_memory.match(/Chile/i);
      assertEquals(
        !match2 || match2.length === 0,
        true,
        "Output: " + JSON.stringify(dataC)
      );
      const match3 = dataC.specific_memory.match(/Argentina/i);
      assertEquals(
        !match3 || match3.length === 0,
        true,
        "Output: " + JSON.stringify(dataC)
      );
    });

    await t.step('Store "France" in another specific memory', async () => {
      const parametersD: INPUTS = {
        data: "France,[X] officially the French Republic,[XI] is a country located primarily in Western Europe. Its overseas regions and territories include French Guiana in South America, Saint Pierre and Miquelon in the North Atlantic, the French West Indies, and many islands in Oceania and the Indian Ocean, giving it one of the largest discontiguous exclusive economic zones in the world. Metropolitan France shares borders with Belgium and Luxembourg to the north, Germany to the northeast, Switzerland to the east, Italy and Monaco to the southeast, Andorra and Spain to the south, and a maritime border with the United Kingdom to the northwest. Its metropolitan area extends from the Rhine to the Atlantic Ocean and from the Mediterranean Sea to the English Channel and the North Sea. Its eighteen integral regions—five of which are overseas—span a combined area of 643,801 km2 (248,573 sq mi) and have a total population of nearly 68.4 million as of January 2024. France is a semi-presidential republic with its capital in Paris, the country's largest city and main cultural and economic centre.", // key: 'key'
        memory_key: "france",
      };
      const dataD = await runCommandTest(parametersD);
      // console.log('================================\nExpected: France\n', dataD.specific_memory);
      const match1 = dataD.specific_memory.match(/France/i);
      assertEquals(
        match1 && match1.length > 0,
        true,
        "Output: " + JSON.stringify(dataD)
      );
      const match2 = dataD.specific_memory.match(/Chile/i);
      assertEquals(
        !match2 || match2.length === 0,
        true,
        "Output: " + JSON.stringify(dataD)
      );
      const match3 = dataD.specific_memory.match(/Argentina/i);
      assertEquals(
        !match3 || match3.length === 0,
        true,
        "Output: " + JSON.stringify(dataD)
      );
    });

    await t.step("Retrive general memory", async () => {
      const parametersE: INPUTS = {};
      const dataE = await runCommandTest(parametersE);
      // console.log('================================\nExpected: Chile & Argentina\n', dataE.generalMemory);
      const match1 = dataE.general_memory.match(/Chile/i);
      assertEquals(
        match1 && match1.length > 0,
        true,
        "Output: " + JSON.stringify(dataE)
      );
      const match2 = dataE.general_memory.match(/Argentina/i);
      assertEquals(
        match2 && match2.length > 0,
        true,
        "Output: " + JSON.stringify(dataE)
      );
      const match3 = dataE.general_memory.match(/Spain/i);
      assertEquals(
        !match3 || match3.length === 0,
        true,
        "Output: " + JSON.stringify(dataE)
      );
    });

    await t.step("Retrive specific memory", async () => {
      const parametersF: INPUTS = {
        memory_key: "spain",
      };
      const dataF = await runCommandTest(parametersF);
      // console.log('================================\nExpected: Spain\n', dataF.specific_memory);
      const match1 = dataF.specific_memory.match(/Spain/i);
      assertEquals(
        match1 && match1.length > 0,
        true,
        "Output: " + JSON.stringify(dataF)
      );
    });

    await t.step("Retrive specific memory", async () => {
      const parametersG: INPUTS = {
        memory_key: "england",
      };
      const dataG = await runCommandTest(parametersG);
      // console.log('================================\nExpected: None\n', dataG.specificMemory);
      assertEquals(
        dataG.specific_memory === "" || dataG.specific_memory === null,
        true,
        "Output: " + JSON.stringify(dataG)
      );
    });

    await t.step("Clear general memory", async () => {
      const parametersH: INPUTS = {
        data: "Forget everything and clear all memories.",
      };
      const dataH = await runCommandTest(parametersH);
      // console.log('================================\nExpected: Chile\n', dataA.generalMemory);
      assertEquals(
        dataH.general_memory.match(/Chile/i) === null &&
          dataH.general_memory.match(/Argentina/i) === null &&
          dataH.general_memory.match(/Spain/i) === null &&
          dataH.general_memory.match(/France/i) === null,
        true,
        "Output: " + JSON.stringify(dataH)
      );
    });

    await t.step("Update specific memory", async () => {
      const parametersI: INPUTS = {
        data: 'Replace every instance of the word "France" with "Chile", and "French" with "Chilean", and any similar compound words as French Guiana to Chilean Guiana.',
        memory_key: "france",
      };
      const dataI = await runCommandTest(parametersI);
      // console.log('================================\nExpected: Chile\n', dataA.generalMemory);
      assertEquals(
        dataI.specific_memory.match(/France/i) === null &&
          dataI.specific_memory.match(/French/i) === null &&
          dataI.specific_memory.match(/Chile/i) !== null &&
          dataI.specific_memory.match(/Chilean/i) !== null,
        true,
        "Output: " + JSON.stringify(dataI)
      );
    });
  },
});
