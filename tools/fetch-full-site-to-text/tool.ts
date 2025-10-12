import { fetchSite } from "npm:sitefetch";
import { join, basename } from "jsr:@std/path";
import { getHomePath } from "./shinkai-local-support.ts";

/*
Step-by-step plan:
1) Keep the tool minimal to fetch the entire site: only url, output file name, concurrency, limit.
2) Add an input flag `showFileContent` (default false) to optionally include the full generated content in the output.
3) Build default options with concurrency defaulting to 10; omit match and contentSelector completely.
4) Use sitefetch to get pages, serialize into a text blob with clear delimiters.
5) Write the text to the user's home directory using Deno.writeFile.
6) Return filePath, pagesCount, bytesWritten, and include fileContent only if requested.
*/

type CONFIG = {
  /* Reserved for future configuration */
};

type INPUTS = {
  url: string;
  outputFileName?: string;
  concurrency?: number;
  limit?: number;
  showFileContent?: boolean; // default false
};

type OUTPUT = {
  filePath: string;
  pagesCount: number;
  bytesWritten: number;
  fileContent?: string;
};

type Page = {
  title: string;
  url: string;
  content: string;
};

export async function run(config: CONFIG, inputs: INPUTS): Promise<OUTPUT> {
  if (!inputs || !inputs.url) {
    throw new Error("Missing required input: url");
  }

  const homePath = await getHomePath();
  const fileName = basename(inputs.outputFileName || "site.txt");
  const outputPath = join(homePath, fileName);

  const options: {
    concurrency?: number;
    limit?: number;
  } = {};

  options.concurrency = inputs.concurrency ?? 10;
  if (typeof inputs.limit === "number") {
    options.limit = inputs.limit;
  }

  const result: Map<string, Page> = await fetchSite(inputs.url, options as any);

  const lines: string[] = [];
  lines.push(`Source URL: ${inputs.url}`);
  lines.push(`Fetched At: ${new Date().toISOString()}`);
  lines.push(`Total Pages: ${result.size}`);
  lines.push("");

  for (const page of result.values()) {
    lines.push("===== PAGE START =====");
    lines.push(`Title: ${page.title}`);
    lines.push(`URL: ${page.url}`);
    lines.push("");
    lines.push(page.content?.trim() ?? "");
    lines.push("===== PAGE END =====");
    lines.push("");
  }

  const text = lines.join("\n");
  const data = new TextEncoder().encode(text);
  await Deno.writeFile(outputPath, data);

  const output: OUTPUT = {
    filePath: outputPath,
    pagesCount: result.size,
    bytesWritten: data.byteLength,
  };

  if (inputs.showFileContent === true) {
    output.fileContent = text;
  }

  return output;
}