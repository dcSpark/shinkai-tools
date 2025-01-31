import { shinkaiLlmPromptProcessor, elevenLabsTextToSpeech, pdfTextExtractor } from './shinkai-local-tools.ts';

type CONFIG = {
  promptStructure: string;
  voicePrompt?: string
};

type INPUTS = {
  pdfURL: string;
};

type OUTPUT = {
  summaryText: string;
  audioFilePath: string;
  audiotext: string;
};

export async function run(config: CONFIG, inputs: INPUTS): Promise<OUTPUT> {
  // Step 1: Extract and clean text from the PDF using pdfTextExtractor
  const extractedTextResult = await pdfTextExtractor({ url: inputs.pdfURL });
  const pdfText = extractedTextResult.text; // Assume it returns a string with the PDF text

  // Step 2: Summarize the text using ShinkaiLLPromptProcessor
  const summarizedTextResult = await shinkaiLlmPromptProcessor({
    format:'text',
    prompt: `Summarize a text following these guidelines and structure:
    <guidelines>
    ${config.promptStructure}
    </guidelines>
    This is the text to summarize, please don't hallucinate and make sure you follow the guidelines:
    <text>
    ${pdfText}
    </text>
    `,
  });
  const summarizedText = summarizedTextResult.message;
  let audiotext = summarizedText.replaceAll('*','').replaceAll('#',' ')
  if (config.voicePrompt && config.voicePrompt.length > 10) {
    audiotext = (await shinkaiLlmPromptProcessor({
      format: 'text',
      prompt: `Narrate a text using the following guidelines
      <guidelines>
      ${config.voicePrompt}
      </guidelines>
      The text to narrate is the following:
      <text>
      ${audiotext}
      </text>
      `
    })).message
    audiotext = audiotext.replaceAll('*','').replaceAll('#',' ')
  }
  // Step 3: Convert the summary text to speech using ElevenLabs Text to Speech
  const audioData = await elevenLabsTextToSpeech({
    text: audiotext
  });

  // Return the summary text and audio file path
  return {
    summaryText: summarizedText,
    audiotext,
    audioFilePath: audioData.audio_file,
  };
}