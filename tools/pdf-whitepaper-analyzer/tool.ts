import {
  shinkaiLlmPromptProcessor,
  smartSearchEngine,
} from "./shinkai-local-tools.ts";
import * as pdfjsLib from "npm:pdfjs-dist";
import { getAssetPaths } from "./shinkai-local-support.ts";

type CONFIG = { analysisGuide: string };
type INPUTS = { pdfUrl: string };
type OUTPUT = { projectAndAuthors: string; analysis: string; reviews: string };

export async function run(config: CONFIG, inputs: INPUTS): Promise<OUTPUT> {
  const { pdfUrl } = inputs;

  console.log(`pdf url ${pdfUrl}`);

  // Fetch the PDF file from the URL
  const response = await fetch(pdfUrl);
  if (!response.ok) {
    throw new Error(`Failed to download PDF from ${pdfUrl}`);
  }
  const pdfData = await response.arrayBuffer();

  // Convert PDF data to text
  const pdfText = await extractTextFromPdf(pdfData);

  console.log(`pdf text ${pdfText.slice(0, 30)}`);

  let analysisGuide = config.analysisGuide;

  if (!analysisGuide) {
    const assets = await getAssetPaths();
    const analysisGuideFilePath = assets.find((f) =>
      f.match(/analysis-guide.txt$/)
    );
    analysisGuide = await Deno.readTextFile(analysisGuideFilePath);
  }

  console.log(`analysis guide ${analysisGuide}`);

  // Analyze the text using the LLM
  const projectAndAuthorsResult = await shinkaiLlmPromptProcessor({
    format: "text",
    prompt: `
        Get the project name, company and authors of the following whitepaper. Be very brief
  
        <whitepaper-content>
        Whitepaper content: ${pdfText}
        </whitepaper-content>`,
  });

  console.log(`project and authors ${projectAndAuthorsResult.message}`);

  // Analyze the text using the LLM
  const analysisResult = await shinkaiLlmPromptProcessor({
    format: "text",
    prompt: `
        Analyze the whitepaper content according to the following rules:

        <analysis-guide>
        ${analysisGuide}
        </analysis-guide>
        
        <whitepaper-content>
        Whitepaper content: ${pdfText}
        </whitepaper-content>`,
  });

  console.log(`analysis result ${analysisResult.message}`);

  // Search for reviews using Smart Search Engine
  const reviewsResult = await smartSearchEngine({
    question: `Reviews for ${projectAndAuthorsResult.message}`,
  });

  console.log(`reviews result ${reviewsResult}`);

  return {
    projectAndAuthors: projectAndAuthorsResult.message,
    analysis: analysisResult.message,
    reviews: reviewsResult.response,
  };
}

async function extractTextFromPdf(pdfData: ArrayBuffer): Promise<string> {
  const loadingTask = pdfjsLib.getDocument({ data: pdfData });
  const pdfDocument = await loadingTask.promise;
  let fullText = "";

  for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber++) {
    const page = await pdfDocument.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item) => item.str).join(" ");
    fullText += pageText + "\n";
  }

  return fullText;
}
