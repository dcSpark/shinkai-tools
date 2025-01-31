import { v4 as uuid } from "npm:uuid";
import { writeAll } from "https://deno.land/std/io/write_all.ts";
import { getHomePath } from './shinkai-local-support.ts';

type CONFIG = {
  ELEVENLABS_API_KEY: string;
  voice?: 'Aria' | 'Roger' | 'Sarah' | 'Laura' | 'Charlie' | 'George' | 'Callum' | 'River' | 'Liam' | 'Charlotte' | 'Alice' | 'Matilda' | 'Will' | 'Jessica' | 'Eric' | 'Chris' | 'Brian' | 'Daniel' | 'Lily' | 'Bill';
};

type INPUTS = {
  text: string;
  fileName?: string;
};

type OUTPUT = {
  audio_file: string,
  characters_used: number,
  characters_remaining: number
};

const voiceDictionary = {
    Aria: '9BWtsMINqrJLrRacOk9x',
    Roger: 'CwhRBWXzGAHq8TQ4Fs17',
    Sarah: 'EXAVITQu4vr4xnSDxMaL',
    Laura: 'FGY2WhTYpPnrIDTdsKH5',
    Charlie: 'IKne3meq5aSn9XLyUdCD',
    George: 'JBFqnCBsd6RMkjVDRZzb',
    Callum: 'N2lVS1w4EtoT3dr4eOWO',
    River: 'SAz9YHcvj6GT2YYXdXww',
    Liam: 'TX3LPaxmHKxFdv7VOQHJ',
    Charlotte: 'XB0fDUnXU5powFXDhCwa',
    Alice: 'Xb7hH8MSUJpSbSDYk0k2',
    Matilda: 'XrExE9yKIg1WjnnlVkGX',
    Will: 'bIHbv24MWmeRgasZH58o',
    Jessica: 'cgSgspJ2msm6clMCkdW9',
    Eric: 'cjVigY5qzO86Huf0OWal',
    Chris: 'iP95p4xoKVk53GoZ742B',
    Brian: 'nPczCjzI2devNBz1zQrb',
    Daniel: 'onwK4e9ZLuTAKqWW03F9',
    Lily: 'pFZP5JQG7iQjIQuC4Bku',
    Bill: 'pqHfZKP75CvOlQylNhV4'
}

export async function run(config: CONFIG, inputs: INPUTS): Promise<OUTPUT> {
  const homePath = await getHomePath();
  const voice = voiceDictionary[config.voice ?? 'Aria'];
  if (!voice) {
    throw new Error(`Invalid voice: ${config.voice}. Valid voices are: ${Object.keys(voiceDictionary).join(', ')}`);
  }
  if (inputs.fileName && !inputs.fileName.endsWith('.mp3')) {
    throw new Error(`Invalid file name: ${inputs.fileName}. File name must end with '.mp3'`);
  }
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': `${config.ELEVENLABS_API_KEY}`
    },
    body: JSON.stringify({ text: inputs.text })
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch audio: ${response.status} ${response.statusText}`);
  }
  console.log(`${response.status} ${response.statusText}`);

  const fileName = `${homePath}/${inputs.fileName ?? uuid()+'.mp3'}`
  const file = await Deno.open(fileName, { write: true, create: true });
  await writeAll(file, new Uint8Array(await response.arrayBuffer()));
  file.close();
  const usageURL = 'https://api.elevenlabs.io/v1/user/subscription'
  const usageResponse = await fetch(usageURL, {
    headers: {
      'xi-api-key': `${config.ELEVENLABS_API_KEY}`
    }
  });
  if (!usageResponse.ok) {
    throw new Error(`Failed to fetch usage: ${usageResponse.status} ${usageResponse.statusText}`);
  }
  const usage = await usageResponse.json();
  return {
    audio_file: fileName,
    characters_used: usage.character_count,
    characters_remaining: usage.character_limit - usage.character_count
  };
}
