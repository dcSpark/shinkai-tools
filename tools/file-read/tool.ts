type CONFIG = {};
type INPUTS = { path: string };
type OUTPUT = { content: string };

export async function run(config: CONFIG, inputs: INPUTS): Promise<OUTPUT> {
    const { path } = inputs;
    const content = await Deno.readTextFile(path);
    return { content };
}