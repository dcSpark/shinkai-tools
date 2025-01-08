type Config = Record<string | number | symbol, never>;
type Input = { text: string };
type Output = { echoed: string };

export function run(_config: Config, inputs: Input): Output {
  return { echoed: inputs.text };
}
