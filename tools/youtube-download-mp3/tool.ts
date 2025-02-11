import { writeAll } from 'https://deno.land/std/io/mod.ts';
import { getHomePath } from './shinkai-local-support.ts';

type CONFIG = {
  apiKey: string;
};

type INPUTS = {
  youtubeUrl: string;
  fileName?: string;
};

type OUTPUT = {
  audiofile?: string;
  rapidDownloadUrl?: string;
  error?: string;
};

export async function run(config: CONFIG, inputs: INPUTS): Promise<OUTPUT> {
  const { youtubeUrl, fileName } = inputs;

  // Validate YouTube URL (must be in the form https://www.youtube.com/watch?v=XXXXXXXXXXX)
  const youtubeRegex = /^https:\/\/(www\.)?youtube\.com\/watch\?v=[\w-]{11}$/;
  if (!youtubeRegex.test(youtubeUrl)) {
    return { error: 'Invalid YouTube URL' };
  }

  // Build the API URL for RapidAPI
  const apiUrl = `https://youtube-to-mp315.p.rapidapi.com/download?url=${encodeURIComponent(youtubeUrl)}&format=mp3`;

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-rapidapi-host': 'youtube-to-mp315.p.rapidapi.com',
      'x-rapidapi-key': config.apiKey,
    },
    body: JSON.stringify({})
  });

  if (!response.ok) {
    return { error: 'Failed to download video' };
  }

  const data = await response.json();
  const rapidDownloadUrl = data.downloadUrl;

  // Wait 10 seconds before downloading the file
  await new Promise(resolve => setTimeout(resolve, 20_000));

  // Download the MP3 file from the rapidDownloadUrl
  let fileResponse = await fetch(rapidDownloadUrl);
  if (fileResponse.status === 404) {
    await new Promise(resolve => setTimeout(resolve, 15_000));
    fileResponse = await fetch(rapidDownloadUrl);
  }
  if (fileResponse.status === 404) {
    await new Promise(resolve => setTimeout(resolve, 15_000));
    fileResponse = await fetch(rapidDownloadUrl);
  }
  if (fileResponse.status === 404) {
    await new Promise(resolve => setTimeout(resolve, 15_000));
    fileResponse = await fetch(rapidDownloadUrl);
  }
  if (!fileResponse.ok) {
    console.error(await fileResponse.text())
    return { error: 'Failed to download the mp3 file from the provided download URL.', rapidDownloadUrl };
  }

  // Determine the output file name:
  // If a fileName is provided, use it. Otherwise, derive it from the download URL.
  let outputFileName: string = await getHomePath();
  if (fileName) {
    outputFileName += '/'+fileName;
    if (!outputFileName.endsWith('.mp3')) outputFileName += '.mp3'
  } else {
    outputFileName += '/audio.mp3';
  }

  // Save the file to disk in the current working directory
  // Convert the response into a Uint8Array and return it
  const arrayBuffer = await fileResponse.arrayBuffer();
  const fileData = new Uint8Array(arrayBuffer);
  const outputFile = await Deno.open(outputFileName, { write: true, create: true });
  await writeAll(outputFile, fileData);
  outputFile.close();

  return { audiofile: outputFileName, rapidDownloadUrl };
}
