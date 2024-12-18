type CONFIG = {};
type INPUTS = {};
type OUTPUT = {};

export async function run(config: CONFIG, inputs: INPUTS): Promise<OUTPUT> {
    const data = "Hello world from repository.";
    
    return { response: data };
}