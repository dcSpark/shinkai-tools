type Configurations = {};
type Parameters = {
  message: string;
};
type Result = { message: string };
export type Run<C extends Record<string, any>, I extends Record<string, any>, R extends Record<string, any>> = (config: C, inputs: I) => Promise<R>;

export const run: Run<Configurations, Parameters, Result> = (
  _configurations: Configurations,
  _params: Parameters,
): Promise<Result> => {
  const message = `hello world foobar`;
  console.log(message);
  return Promise.resolve({ message });
};
