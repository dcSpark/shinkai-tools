type Config = {};

type Inputs = {
    number: number;
};

type Output = {
    result: number;
};

export async function run(config: Config, inputs: Inputs): Promise<Output> {
    const result = inputs.number + 1;
    return { result };
}
