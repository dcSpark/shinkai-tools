import { shinkaiLlmPromptProcessor } from './shinkai-local-tools.ts';

type CONFIG = {};
type INPUTS = { path: string, prompt: string };
type OUTPUT = { new_file_content: string, message: string };

export async function run(config: CONFIG, inputs: INPUTS): Promise<OUTPUT> {
    const file_content = await Deno.readTextFile(inputs.path);
    const prompt = `
<${inputs.path}>
${file_content}
</${inputs.path}>

<rules>
 * Only respond with the new file content, from the start of the file to the end.
 * Do not include any other text or comments.
 * Apply the following instructions in the tag to "${inputs.path}"
</rules>

<instructions>
    ${inputs.prompt}
 </instructions>
`;
    const update = await shinkaiLlmPromptProcessor({ prompt });
    await Deno.writeTextFile(inputs.path, update.message);

    return { 
        new_file_content: update.message, 
        message: "File updated"
    };               
}