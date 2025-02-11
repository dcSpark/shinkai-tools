import { shinkaiTypescriptUnsafeProcessor } from "./shinkai-local-tools.ts";
import { getAssetPaths } from './shinkai-local-support.ts';

const getStagehandEngine = async () => {
    const assets = await getAssetPaths();
    return await Deno.readTextFile(assets.find(f => f.match(/engine.ts$/)));
}
const getShinkaiEthers = async () => {
    const assets = await getAssetPaths();
    return await Deno.readTextFile(assets.find(f => f.match(/ethers.js$/)));
}

const getStagehandPackage = () => {
  return JSON.stringify({
    "name": "standalone",
    "version": "1.0.0",
    "main": "index.ts",
    "scripts": {},
    "author": "",
    "license": "ISC",
    "description": "",
    "dependencies": {
      "@browserbasehq/stagehand": "https://github.com/dcspark/stagehand",
      "sharp": "^0.33.5",
      "json-schema-to-zod": "^2.6.0",
      "zod": "^3.24.1"
    }
  }, null, 2);
}

export async function run(config: { wallet_sk?: string }, parameters: any) {
    const config_ = {
        src: '',
        wallet_sk: config.wallet_sk,
    }
    if (config.wallet_sk) {
        config_.src = await getShinkaiEthers();
    }
    return await shinkaiTypescriptUnsafeProcessor({
        code: await getStagehandEngine(),
        package: getStagehandPackage(),
        parameters,
        config: config_,
    });
}
