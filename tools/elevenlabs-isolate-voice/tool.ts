import { writeAll, readAll } from "https://deno.land/std/io/mod.ts";
import { getHomePath } from "../shinkai-local-support.ts";
import { youtubeDownloadMp3 } from "../shinkai-local-tools.ts";

type CONFIG = {
  ELEVENLABS_API_KEY: string;
};

type INPUTS = {
  audio_file?: string;
  youtube_url?: string;
  fileName?: string;
};

type OUTPUT = {
  audio_file: string;
  characters_used: number;
  characters_remaining: number;
};

async function getUsage(config: CONFIG): Promise<any> {
  const usageURL = "https://api.elevenlabs.io/v1/user/subscription";
  const usageResponse = await fetch(usageURL, {
    headers: {
      "xi-api-key": config.ELEVENLABS_API_KEY,
    },
  });
  if (!usageResponse.ok) {
    throw new Error(
      `Failed to fetch usage: ${usageResponse.status} ${usageResponse.statusText}`,
    );
  }
  return await usageResponse.json();
}

async function isolateVoiceFromYoutube(
  youtubeUrl: string,
  config: CONFIG,
): Promise<Uint8Array> {
  try {
    // Create a temporary file name with .mp3 suffix
    const originalAudioFile = await youtubeDownloadMp3({youtubeUrl, outputFileName: 'original_audio.mp3'});

    // Read the downloaded MP3 file into a Uint8Array
    const audioData = await Deno.readFile(originalAudioFile.audiofile);

    // Prepare the FormData for the ElevenLabs API call
    const formData = new FormData();
    const blob = new Blob([audioData], { type: "audio/mpeg" });
    formData.append("audio", blob, originalAudioFile.audiofile);

    // Call the ElevenLabs API for voice isolation
    const response = await fetch(
      "https://api.elevenlabs.io/v1/audio-isolation",
      {
        method: "POST",
        headers: {
          "Accept": "audio/mpeg",
          "xi-api-key": config.ELEVENLABS_API_KEY,
        },
        body: formData,
      },
    );

    if (!response.ok) {
      throw new Error(
        `ElevenLabs API error: ${response.status} ${response.statusText}`,
      );
    }

    // Convert the response into a Uint8Array and return it
    const arrayBuffer = await response.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  } catch (error: any) {
    console.error("Error processing audio:", error);
    throw error;
  }
}

export async function run(
  config: CONFIG,
  inputs: INPUTS,
): Promise<OUTPUT> {
  const homePath = await getHomePath();
  if (!config.ELEVENLABS_API_KEY) {
    throw new Error("ELEVENLABS_API_KEY is not set");
  }
  if (!inputs.audio_file && !inputs.youtube_url) {
    throw new Error("Either audio_file or youtube_url must be provided");
  }

  let audioData: Uint8Array;
  if (inputs.youtube_url) {
    audioData = await isolateVoiceFromYoutube(inputs.youtube_url, config);
  } else if (inputs.audio_file) {
    const file = await Deno.open(inputs.audio_file, { read: true });
    const fileData = await readAll(file);
    file.close();

    const formData = new FormData();
    const blob = new Blob([fileData], { type: "audio/mpeg" });
    formData.append("audio", blob, inputs.audio_file);

    const response = await fetch(
      "https://api.elevenlabs.io/v1/audio-isolation",
      {
        method: "POST",
        headers: {
          "Accept": "audio/mpeg",
          "xi-api-key": config.ELEVENLABS_API_KEY,
        },
        body: formData,
      },
    );

    if (!response.ok) {
      throw new Error(
        `ElevenLabs API error: ${response.status} ${response.statusText}`,
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    audioData = new Uint8Array(arrayBuffer);
  } else {
    throw new Error("No audio file or YouTube URL provided");
  }

  // Determine the output file name
  const fileName = `${homePath}/${inputs.fileName ?? crypto.randomUUID() + ".mp3"}`;
  const outputFile = await Deno.open(fileName, { write: true, create: true });
  await writeAll(outputFile, audioData);
  outputFile.close();

  // Get usage information from ElevenLabs API (if available)
  let usage: any;
  try {
    usage = await getUsage(config);
    return {
      audio_file: fileName,
      characters_used: usage.character_count,
      characters_remaining: usage.character_limit - usage.character_count,
    };
  } catch (error) {
    console.error("Error getting usage:", error);
    return {
      audio_file: fileName,
      characters_used: -1,
      characters_remaining: -1,
    };
  }
}
