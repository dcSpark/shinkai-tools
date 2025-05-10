import { YoutubeTranscript } from 'npm:youtube-transcript@1.2.1';
import { getHomePath } from './shinkai-local-support.ts';

interface TranscriptSegment {
  text: string;
  offset: number;
  duration: number;
}

interface CONFIG extends Record<string, unknown> {}
interface INPUTS {
  url: string;
  lang?: string;
}
interface OUTPUT {
  transcript: TranscriptSegment[];
}

export async function run(config: CONFIG, inputs: INPUTS): Promise<OUTPUT> {
  const { url, lang } = inputs;

  let videoUrl: URL;
  try {
    videoUrl = new URL(url);
  } catch (e) {
    throw new Error("Invalid URL provided.");
  }

  const language = lang || 'en';

  let transcriptData: unknown;
  try {
    transcriptData = await YoutubeTranscript.fetchTranscript(url, { lang: language });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Transcript extraction failed.";
    throw new Error(`Unable to fetch transcript: ${errorMessage}`);
  }

  if (!Array.isArray(transcriptData)) {
    throw new Error("Transcript data format is invalid.");
  }

  const transcript: TranscriptSegment[] = transcriptData.map((segment: unknown) => {
    if (
      typeof segment !== 'object' ||
      segment === null ||
      !('text' in segment) ||
      !('offset' in segment) ||
      !('duration' in segment) ||
      typeof segment.text !== 'string' ||
      typeof segment.offset !== 'number' ||
      typeof segment.duration !== 'number'
    ) {
      throw new Error("Transcript segment structure is invalid.");
    }
    return {
      text: segment.text,
      offset: segment.offset,
      duration: segment.duration,
    };
  });

  const videoId = videoUrl.searchParams.get('v') || "unknown";
  const timestamp = Date.now();
  const fileName = `transcript_${videoId}_${timestamp}.json`;

  const homePath = await getHomePath();
  const filePath = `${homePath}/${fileName}`;

  try {
    const dataToWrite = new TextEncoder().encode(JSON.stringify({ transcript }, null, 2));
    await Deno.writeFile(filePath, dataToWrite, { mode: 0o644 });
  } catch (fileError: unknown) {
    const errorMessage = fileError instanceof Error ? fileError.message : "Failed to write transcript to file";
    throw new Error(`Failed to write transcript to file: ${errorMessage}`);
  }

  return { transcript };
}