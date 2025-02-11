import { YoutubeTranscript } from 'npm:youtube-transcript';
import { getHomePath } from './shinkai-local-support.ts'
import { shinkaiLlmPromptProcessor, elevenLabsTextToSpeech } from './shinkai-local-tools.ts';

type CONFIG = {};
type INPUTS = {
  youtubeUrlOrId: string;
};
type OUTPUT = {
    audiotext: string,
    audioFilePath: string,
};

export async function run(config: CONFIG, inputs: INPUTS): Promise<OUTPUT> {
  const { youtubeUrlOrId } = inputs;
  if (!youtubeUrlOrId) throw new Error("Missing input.youtubeUrlOrId")
  // Step 1: Fetch the transcript from YouTube
  const transcript: {text: string, duration: number, offset: number}[] = await YoutubeTranscript.fetchTranscript(youtubeUrlOrId);
  /*
  [...
  {
    text: "better the performance the easier it is",
    duration: 4.08,
    offset: 223.92,
    lang: "en"
  },
  {
    text: "for me to watch yeah if I catch myself",
    duration: 4.36,
    offset: 225.2,
    lang: "en"
  },
  ...]
  */
  const total_duration = transcript[transcript.length - 1].offset + transcript[transcript.length - 1].duration;
  console.log(`Total duration: ${total_duration}`);
  // Step 2: Flatten the transcript into a string
  const flatten_transcript = transcript.map(segment => segment.text).join(' ');

  // Step 3: Get the prompt structure and voice prompt from files
  const homePath = await getHomePath();
  const promptStructureFilePath = `${homePath}/podcast.analysis.md`;
  const voicePromptFilePath = `${homePath}/podcast.story.md`;

  const promptStructure = await Deno.readTextFile(promptStructureFilePath);
  const voicePrompt = await Deno.readTextFile(voicePromptFilePath);

  // Step 4: Create a transcript summary with the llm-processor
  const summarizePrompt = `
    Summarize a text following these guidelines and structure:
        <guidelines>
        ${promptStructure}
        </guidelines>
        This is the text to summarize, please don't hallucinate and make sure you follow the guidelines:
        <text>
        ${flatten_transcript}
        </text>
  `;

  const { message: transcriptSummary } = await shinkaiLlmPromptProcessor({
    prompt: summarizePrompt,
    format: 'text',
  });

  // Step 5: Generate the podcast by using the llm-processor
  const narratePrompt = `
      Narrate a text using the following guidelines
        <guidelines>
        # [IMPORTANT] Your main objective in terms of length is to keep the podcast lenght in about 5 minutes and shorter than the original text.
        ${voicePrompt}
        </guidelines>
        The text to narrate is the following:
        <text>
        ${transcriptSummary}
        </text>
    `;

  const { message: podcast } = await shinkaiLlmPromptProcessor({
    prompt: narratePrompt,
    format: 'markdown',
  });
  
  const audioData = await elevenLabsTextToSpeech({
    text: podcast
  });

  return {
    audiotext: podcast,
    audioFilePath: audioData.audio_file,
  };
}