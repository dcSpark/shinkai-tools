import { getDocument, GlobalWorkerOptions } from "npm:pdfjs-dist";
import { getHomePath } from './shinkai-local-support.ts';

/* Configure PDF.js worker source */
const workerPath = `${await getHomePath()}/pdf.worker.mjs`
GlobalWorkerOptions.workerSrc = workerPath;

/**
 * Ensures the local presence of the PDF.js worker file.
 * Downloads it if not present.
 */
export async function ensureLocalPdfWorker(
  localPath = workerPath,
  remoteUrl = "https://mozilla.github.io/pdf.js/build/pdf.worker.mjs",
): Promise<void> {
  try {
    // Check if the worker file already exists
    await Deno.stat(localPath);
  } catch (error) {
    // If the file does not exist, download it
    if (error instanceof Deno.errors.NotFound) {
      const response = await fetch(remoteUrl);
      if (!response.ok) {
        throw new Error(
          `Failed to fetch PDF worker from "${remoteUrl}". HTTP status: ${response.status}`,
        );
      }
      const workerScript = (await response.text()).replace(/5\.[0-9]+\.[0-9]+/g,'4.10.38');
      await Deno.writeTextFile(localPath, workerScript);
    } else {
      throw error;
    }
  }
}

type CONFIG = {};
type INPUTS = {
  url: string;
};
type OUTPUT = {
  text: string;
};

export async function run(config: CONFIG, inputs: INPUTS): Promise<OUTPUT> {
  const { url } = inputs;
  await ensureLocalPdfWorker();

  // Fetch the PDF as an ArrayBuffer
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch PDF from ${url}: ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  const fileName = `${await getHomePath()}/${Date.now()}.pdf`;
  await Deno.writeFile(fileName, new Uint8Array(arrayBuffer));

  // Load the PDF via PDF.js
  const loadingTask = getDocument(fileName);
  const pdf = await loadingTask.promise;

  let allText = "";

  // Loop through each page and extract text
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();

    // Convert text items into one readable string
    const pageText = textContent.items
      .map((item) => (item as any).str || "")
      .join(" ");

    allText += pageText + "\n";
  }

  // Clean the extracted text
  let cleanedText = allText;

  // Remove any bracketed content
  cleanedText = cleanedText.replace(/<[^>]*>/g, "");

  // Remove extra whitespace/newlines
  cleanedText = cleanedText
    .replace(/\r\n|\r|\n/g, " ") // unify newlines
    .replace(/\s\s+/g, " ")     // collapse multiple spaces
    .trim();

  return { text: cleanedText };
}