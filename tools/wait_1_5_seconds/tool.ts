type CONFIG = {};
type INPUTS = {};
type OUTPUT = { result: string };

export async function run(config: CONFIG, inputs: INPUTS): Promise<OUTPUT> {
    await new Promise(resolve => setTimeout(resolve, 1500));
    return { result: "OK" };
}