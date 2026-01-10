import { shinkaiLlmPromptProcessor } from './shinkai-local-tools.ts';

type CONFIG = {};
type INPUTS = { query: string; numQueries?: number; learnings?: string[] };
type OUTPUT = { queries: { query: string; researchGoal: string }[] };

export async function run(_: CONFIG, inputs: INPUTS): Promise<OUTPUT> {
    const { query, numQueries = 3, learnings = [] } = inputs;
    let retries = 3;
    let queries: OUTPUT = { queries: [] };
    while (true) {
        try {
            const result = await generateSerpQueries({ query, numQueries, learnings });
            queries = tryToParse(result);
            break;
        } catch (e) {
            console.log(e);
            if (retries > 0) {
                console.log('[RETRYING] Error', e);
                retries -= 1;
            } else {
                throw new Error("Failed to generate valid json");
            }
        }
    }
    return queries;
}

function checkFormat(o: Record<string, unknown>) {
    if (typeof o !== 'object' || o === null) throw new Error("INVALID FORMAT 0x01");
    if (!o.queries) throw new Error("INVALID FORMAT 0x02");
    if (!Array.isArray(o.queries)) throw new Error("INVALID FORMAT 0x03");
    for (let i = 0; i < o.queries.length; i += 1) {
        if (!o.queries[i].query) throw new Error("INVALID FORMAT 0x04");
        if (typeof o.queries[i].query !== 'string') throw new Error("INVALID FORMAT 0x05");
        if (!o.queries[i].researchGoal) throw new Error("INVALID FORMAT 0x06");
        if (typeof o.queries[i].researchGoal !== 'string') throw new Error("INVALID FORMAT 0x07");
    }
}

function tryToParse(raw: string): OUTPUT {
    const parts = raw.split("\n");
    parts[0] = parts[0].replace(/^```json$/, '');
    parts[parts.length - 1] = parts[parts.length - 1].replace(/^```$/, '');
    try {
        const r = JSON.parse(parts.join(''));
        checkFormat(r);
        return r;
    } catch (_) {
        try {
            const m = raw.match(/```json\n([\S\s]+?)\n```/);
            if (!m || !m[1]) throw new Error("CANNOT PARSE");
            const j = JSON.parse(m[1]);
            checkFormat(j);
            return j;
        } catch (_) {
            throw new Error("CANNOT PARSE")
        }
    }
}

async function generateSerpQueries({
    query,
    numQueries = 3,
    learnings,
}: {
    query: string;
    numQueries?: number;
    learnings?: string[];
}): Promise<string> {
    let now = new Date().toISOString();
    const learningsPrompt = learnings
        ? `
<learnings> 
Here are some learnings from previous research, use them to generate more specific queries: 
${learnings.map(l => `*  ${l}`).join('\n')}
</learnings>
` : '';

    const prompt = `
<updated_system_prompt>
You are an expert researcher. Today is ${now}. Follow these instructions when responding:
  - You may be asked to research subjects that is after your knowledge cutoff, assume the user is right when presented with news.
  - The user is a highly experienced analyst, no need to simplify it, be as detailed as possible and make sure your response is correct.
  - Be highly organized.
  - Suggest solutions that I didn't think about.
  - Be proactive and anticipate my needs.
  - Treat me as an expert in all subject matter.
  - Mistakes erode my trust, so be accurate and thorough.
  - Provide detailed explanations, I'm comfortable with lots of detail.
  - Value good arguments over authorities, the source is irrelevant.
  - Consider new technologies and contrarian ideas, not just the conventional wisdom.
  - You may use high levels of speculation or prediction, just flag it for me.
</updated_system_prompt>

<rules>
* Given the prompt from the user, generate a list of SERP queries to research the topic. 
* Return a maximum of ${numQueries} queries, but feel free to return less if the original prompt is clear. 
* Make sure each query is unique and not similar to each other
* Follow the ouptut example for the output. It must be a valid JSON.
* "query" field: Generate a text query to be executed in a search engine.
* "researchGoal" field: First talk about the goal of the research that this query is meant to accomplish, then go deeper into how to advance the research once the results are found, mention additional research directions. Be as specific as possible, especially for additional research directions.
* Return type: { queries: { query: string, researchGoal: string }[] }
</rules>

${learningsPrompt}

<prompt>
${query}
</prompt>
  
<output>
\`\`\`json
{
  "queries": [{
    "query": "QUERY TO EXECUTE",
    "researchGoal": "GOAL EXPLAINATION" 
  }]
}
\`\`\`
</output>
  `;

    const response = await shinkaiLlmPromptProcessor({
        format: 'text',
        prompt,
    });

    return response.message.trim();
}