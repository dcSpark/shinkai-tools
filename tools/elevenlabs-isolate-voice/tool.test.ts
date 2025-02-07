import { run } from './tool.ts';
const ELEVENLABS_API_KEY = 'sk_live_11labs_api_key';

const config = {
  ELEVENLABS_API_KEY: ELEVENLABS_API_KEY
}

const inputs = {
  youtube_url: 'https://www.youtube.com/watch?v=ChQDGRH7OSY'
}

const result = await run(config, inputs);
console.log(result);