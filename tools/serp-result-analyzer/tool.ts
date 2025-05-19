import { shinkaiLlmPromptProcessor } from './shinkai-local-tools.ts';

const compact = <T>(arr: T[]): T[] => arr.filter(x => x);

const trimPrompt = (prompt: string, maxLength: number): string => {
    if (prompt.length > maxLength) {
        return prompt.substring(0, maxLength) + '...';
    }
    return prompt;
};

async function processSerpResult(
    query: string,
    search_results: string[],
    numLearnings: number,
    numFollowUpQuestions: number,
): Promise<string> {
    const contents = compact(search_results).map(content =>
        trimPrompt(content, 25_000),
    );
    console.log(`Ran ${query}, found ${contents.length} contents`);
    const now = new Date().toISOString();
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
* Given the following contents from a SERP search for the query tag, generate a list of learnings and follow-up questions.  
* Format your response as valid JSON, as the output tag.
* Return a maximum of ${numLearnings} learnings, but feel free to return less if the contents are clear. 
* Return a maximum of ${numFollowUpQuestions} follow-up questions, but feel free to return less if the contents are clear.
* Make sure each learning is unique and not similar to each other. 
* The learnings should be concise and to the point, as detailed and information dense as possible. 
* Make sure to include any entities like people, places, companies, products, things, etc in the learnings, as well as any exact metrics, numbers, or dates. The learnings will be used to research the topic further.
* Return type: { learnings: string[], followUpQuestions: [] }
</rules>

<query>
${query}
</query>

<content>
${contents}
<content>

<output>
\`\`\`json
{
  "learnings": [ "LEARNINGS1", "LEARNINNGS2"],
  "followUpQuestions": [ "FOLLOW_UP_QUESTIONS1", "FOLLOW_UP_QUESTIONS2" ]
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

type Learning = {
    learnings: string[];
    followUpQuestions: string[];
};



function checkFormat(o: Record<string, unknown>) {
    if (typeof o !== 'object' || o === null) throw new Error("INVALID FORMAT 0x01");
    if (!o.learnings) throw new Error("INVALID FORMAT 0x02");
    if (!o.followUpQuestions) throw new Error("INVALID FORMAT 0x03");
    if (!Array.isArray(o.learnings)) throw new Error("INVALID FORMAT 0x04");
    if (!Array.isArray(o.followUpQuestions)) throw new Error("INVALID FORMAT 0x05");
    for (let i = 0; i < o.learnings.length; i += 1) {
        if (!o.learnings[i]) throw new Error("INVALID FORMAT 0x06");
    }
    for (let i = 0; i < o.followUpQuestions.length; i += 1) {
        if (!o.followUpQuestions[i]) throw new Error("INVALID FORMAT 0x07");
    }
}

function tryToParse(raw: string): Learning {
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

type CONFIG = {};
type INPUTS = { query: string; search_results: string[]; numLearnings?: number; numFollowUpQuestions?: number };
type OUTPUT = Learning;

export async function run(_: CONFIG, inputs: INPUTS): Promise<OUTPUT> {
    let retries = 3;
    let learnings: Learning = { learnings: [], followUpQuestions: [] };
    while (true) {
        try {
            const result = await processSerpResult(
                inputs.query,
                inputs.search_results,
                inputs.numLearnings || 3,
                inputs.numFollowUpQuestions || 3,
            );
            learnings = tryToParse(result);
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
    return learnings;
}