
type CONFIG = {};
type INPUTS = { path: string, content: string };
type OUTPUT = { message: string };

export async function run(config: CONFIG, inputs: INPUTS): Promise<OUTPUT> {
    try {
        await Deno.writeTextFile(inputs.path, inputs.content);
        return {
            message: "File written"
        };               
    } catch (error) {
        return {
            message: "Failed to write file " + error.message,
        };               
    }
}