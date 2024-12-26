export type Run<C extends Record<string, any>, I extends Record<string, any>, R extends Record<string, any>> = (config: C, inputs: I) => Promise<R>;

export const run: Run<{}, { message: string }, { message: string }> = (
  _configurations,
  parameters,
): Promise<{ message: string }> => {
  console.log('run echo from js');
  return Promise.resolve({
    message: `echoing: ${parameters.message}`,
  });
};
