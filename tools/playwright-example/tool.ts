import * as playwright from 'npm:playwright@1.48.2';
import chromePaths from 'npm:chrome-paths@1.0.1';
import process from 'node:process';

type Configurations = {
  chromePath?: string;
};
type Parameters = {
  url: string;
};
type Result = { title: string };
export type Run<C extends Record<string, any>, I extends Record<string, any>, R extends Record<string, any>> = (config: C, inputs: I) => Promise<R>;

export const run: Run<Configurations, Parameters, Result> = async (
  configurations,
  parameters,
): Promise<Result> => {
  const chromePath =
    configurations?.chromePath ||
    process.env.CHROME_PATH ||
    chromePaths.chrome ||
    chromePaths.chromium;

  console.log('executing chrome from', chromePath);
  const browser = await playwright['chromium'].launch({
    executablePath: chromePath,
  });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    console.log('navigating to', parameters.url);
    await page.goto(parameters.url);
    const title = await page.title();
    await page.close();
    await context.close();
    await browser.close();
    return { title };
  } catch (e) {
    console.log('error', e);
    await browser.close();
    throw e;
  }
};
