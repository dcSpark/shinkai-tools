import * as playwright from 'npm:playwright@1.48.2';
import chromePaths from 'npm:chrome-paths@1.0.1';

import { Buffer } from 'node:buffer';
import path from 'node:path';

type Configurations = {
  chromePath?: string;
};
type Parameters = {
  inputValue: string;
  assetSymbol: string;
};
type Result = {
  amountProcessed: string;
};

export type Run<C extends Record<string, any>, I extends Record<string, any>, R extends Record<string, any>> = (config: C, inputs: I) => Promise<R>;

export const run: Run<Configurations, Parameters, Result> = async (
  configurations,
  parameters,
): Promise<Result> => {
  const chromePath =
    configurations?.chromePath ||
    Deno.env.get('CHROME_PATH') ||
    chromePaths.chrome ||
    chromePaths.chromium;
  const browser = await playwright['chromium'].launch({
    executablePath: chromePath,
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }, // Set viewport size
  });

  const page = await context.newPage();
  // await page.goto(params.url);
  await page.goto(
    'https://staging.aave.com/?marketName=proto_arbitrum_sepolia_v3',
  );

  console.log('Viem script loaded');

  await page.evaluate((scriptContent) => {
    const script = document.createElement('script');
    script.textContent = scriptContent;
    document.head.appendChild(script);
    console.log('Viem script injected');
  }, Buffer.from(viemScriptContent, 'base64').toString('utf-8'));

  // Click the "Opt-out" button
  // Wait for the "Opt-out" button to appear and click it
  await page.waitForSelector('#rcc-decline-button > p');
  await page.click('#rcc-decline-button > p');

  // Click the wallet button
  await page.waitForSelector('#wallet-button');
  await page.click('#wallet-button');

  // Click the "Browser wallet" button
  const browserWalletButton = page.locator(
    'body > div:nth-child(20) > div[class*="MuiPaper-root MuiPaper-elevation MuiPaper-rounded MuiPaper-elevation1"] > div[class*="MuiBox-root"] > button:nth-child(2)',
  );

  await browserWalletButton.waitFor({ state: 'visible' });
  console.log('Browser wallet button is visible');
  await browserWalletButton.click();

  const assetSymbolUpper = parameters.assetSymbol.toUpperCase();

  // Find the div with data-cy="dashboardSupplyListItem_ETH" and click the first button inside the 5th internal div
  const assetSupplyListItem = page.locator(
    `div[data-cy="dashboardSupplyListItem_${assetSymbolUpper}"]`,
  );
  const buttonInFifthDiv = assetSupplyListItem
    .locator('div:nth-child(5) button')
    .first();
  await buttonInFifthDiv.waitFor({ state: 'visible' });
  await buttonInFifthDiv.click();
  console.log(
    `First button inside the 5th internal div for ${assetSymbolUpper} clicked`,
  );

  // Input a value of 0.1 into the specified input field
  const inputField = page.locator(
    'div.MuiModal-root div.MuiPaper-root div.MuiBox-root div.MuiBox-root div.MuiBox-root div.MuiInputBase-root input',
  );
  await inputField.waitFor({ state: 'visible' });
  await inputField.fill(parameters.inputValue);
  console.log('Input field filled with value 0.1');

  // Click the button with data-cy="actionButton"
  const actionButton = page.locator('button[data-cy="actionButton"]');
  await actionButton.waitFor({ state: 'visible' });
  await actionButton.click();
  console.log('Action button clicked');

  // Wait for the specified selector with a more flexible approach
  await page.waitForSelector(
    'body > div.MuiModal-root > div.MuiPaper-root.MuiPaper-elevation.MuiPaper-rounded.MuiPaper-elevation1 > div.MuiBox-root > h2',
  );

  // Take a screenshot and save it to ./tmp/
  const screenshotPath = path.join(__dirname, 'tmp', 'screenshot.png');
  await page.screenshot({ path: screenshotPath });

  await browser.close();
  return {
    amountProcessed: parameters.inputValue,
  };
};

// attach-viem-script-content