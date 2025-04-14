
import chromePaths from 'npm:chrome-paths@1.0.1';
import TurndownService from 'npm:turndown@7.2.0';
import { addExtra } from 'npm:puppeteer-extra@3.3.6';
import rebrowserPuppeteer from 'npm:rebrowser-puppeteer@23.10.1';
import StealthPlugin from 'npm:puppeteer-extra-plugin-stealth@2.11.2';

import { getHomePath } from './shinkai-local-support.ts';

type Configurations = {
  chromePath?: string;
};

type Parameters = {
  url: string;
  incognito?: boolean;
};

type Result = { markdown: string };

export type Run<C extends Record<string, any>, I extends Record<string, any>, R extends Record<string, any>> = (config: C, inputs: I) => Promise<R>;

const puppeteer = addExtra(rebrowserPuppeteer as any);
const pluginStealth = StealthPlugin();
pluginStealth.enabledEvasions.delete('chrome.loadTimes');
pluginStealth.enabledEvasions.delete('chrome.runtime');
puppeteer.use(pluginStealth);

export const run: Run<Configurations, Parameters, Result> = async (
  configurations: Configurations,
  parameters: Parameters,
): Promise<Result> => {
  const chromePath =
    configurations?.chromePath ||
    Deno.env.get('CHROME_PATH') ||
    chromePaths.chrome ||
    chromePaths.chromium;
  if (!chromePath) {
    throw new Error('Chrome path not found');
  }
  console.log({ chromePath })
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    args: ['--disable-blink-features=AutomationControlled'],
  });

  const page = await browser.newPage();
  
  console.log("Navigating to website...");
  await page.goto(parameters.url);
  
  console.log('Waiting for the page to load...');
  await page.waitForNetworkIdle();
  
  console.log('Extracting HTML content...');
  const html = await page.content();

  console.log('Closing browser...');
  await browser.close();

  console.log('Saving HTML to file...');
  const safeFileName = parameters.url.replace(/\./g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
  const safeDate = new Date().toISOString().replace(/[:.]/g, '-');
  Deno.writeTextFileSync(await getHomePath() + `/raw.${safeFileName}.${safeDate}.html`, html);

  console.log('Converting HTML to Markdown...');
  const turndownService = new TurndownService();
  const markdown = turndownService
    .remove(['script', 'style', 'title'])
    .turndown(html);
  return Promise.resolve({ markdown });
};
