import { googleSearch, downloadPages, shinkaiLlmPromptProcessor, markdownExporter } from './shinkai-local-tools.ts';
import { getHomePath } from './shinkai-local-support.ts';

// --- TYPE DEFINITIONS ---
type CONFIG = {};
type INPUTS = {
  tokenName: string;
  tokenTicker: string;
};
type OUTPUT = {
  reportPath: string;
  reportContent: string;
};
type SectionInfo = {
  description: string;
  keywords: string[];
};

// --- CONSTANTS AND HELPERS ---
const RESEARCH_PLAN: Record<string, SectionInfo> = {
  projectInfo: {
    description: "Gather basic information about the project, its purpose, and official resources.",
    keywords: ["project", "about", "overview", "website", "official"],
  },
  technicalFundamentals: {
    description: "Analyze the token's technical aspects, blockchain, and architecture.",
    keywords: ["technical", "whitepaper", "github", "contract", "blockchain", "docs"],
  },
  marketStatus: {
    description: "Evaluate current market performance, price, and trading volume.",
    keywords: ["price", "market cap", "volume", "chart", "tradingview", "geckoterminal"],
  },
  listings: {
    description: "Find where the token is traded and on which exchanges it is listed.",
    keywords: ["exchange", "listing", "market", "where to buy"],
  },
  news: {
    description: "Gather recent news, updates, and announcements about the token.",
    keywords: ["news", "announcement", "medium", "twitter"],
  },
  community: {
    description: "Analyze the project's community size, engagement, and official channels.",
    keywords: ["community", "discord", "telegram", "reddit", "twitter"],
  },
  predictions: {
    description: "Collect price predictions, forecasts, and market analysis.",
    keywords: ["prediction", "forecast", "analysis", "future", "price"],
  },
  teamInfo: {
    description: "Research the team, founders, and developers behind the project.",
    keywords: ["team", "founders", "linkedin", "developers", "leadership"],
  },
  relatedCoins: {
    description: "Identify tokens in the same category, competitors, and similar projects.",
    keywords: ["similar tokens", "competitors", "related coins", "ecosystem"],
  },
  socialSentiment: {
    description: "Gauge social media sentiment and community opinions.",
    keywords: ["sentiment", "community opinion", "social", "twitter", "reddit"],
  },
};

function sanitizeFilename(str: string): string {
  return str.replace(/[^a-zA-Z0-9-_\.]/g, "_").slice(0, 60);
}

// --- MAIN EXECUTION FUNCTION ---
export async function run(config: CONFIG, inputs: INPUTS): Promise<OUTPUT> {
  const { tokenName, tokenTicker } = inputs;
  
  // =================================================================
  // PHASE 1: PARALLEL DATA GATHERING
  // =================================================================
  console.log(`[1/3] Starting parallel data gathering for ${tokenName}...`);

  const searchTasks = Object.entries(RESEARCH_PLAN).flatMap(([section, info]) =>
    info.keywords.map(keyword => ({
      section,
      query: `${tokenName} ${tokenTicker} ${keyword}`,
    }))
  );

  const searchPromises = searchTasks.map(task => googleSearch({ query: task.query }));
  const searchPromiseResults = await Promise.allSettled(searchPromises);

  const uniqueUrlTasks = new Map<string, { section: string; title: string; url: string }>();
  searchPromiseResults.forEach((result, index) => {
    if (result.status === 'fulfilled' && result.value.results) {
      const { section } = searchTasks[index];
      for (const res of (result.value.results as any[]).slice(0, 2)) {
        if (res.url && typeof res.url === 'string' && res.url.startsWith('http') && !uniqueUrlTasks.has(res.url)) {
          uniqueUrlTasks.set(res.url, {
            section,
            title: res.title || res.url,
            url: res.url,
          });
        }
      }
    }
  });

  const pageFetchPromises = Array.from(uniqueUrlTasks.values()).map(async (task) => {
    const md = await downloadPages({ url: task.url });
    return {
      ...task,
      markdown: `### [${task.title}](${task.url})\n\n${md.markdown}\n`,
    };
  });
  const pageFetchResults = await Promise.allSettled(pageFetchPromises);

  const sectionRawContent: Record<string, string[]> = {};
  for (const section of Object.keys(RESEARCH_PLAN)) {
    sectionRawContent[section] = [];
  }
  pageFetchResults.forEach(result => {
    if (result.status === 'fulfilled') {
      const { section, markdown } = result.value;
      if (sectionRawContent[section]) {
        sectionRawContent[section].push(markdown);
      }
    }
  });

  // =================================================================
  // PHASE 2: STAGGERED PARALLEL LLM PROCESSING
  // =================================================================
  console.log(`[2/3] Summarizing sections with LLM (staggered parallel start to respect rate limits)...`);

  const llmTasks = Object.entries(RESEARCH_PLAN).map(([section, info]) => {
    const rawContent = sectionRawContent[section].join('\n---\n');
    const initialSectionMarkdown = `## ${section}\n\n**Description:** ${info.description}\n\n`;
    
    let promptContent;
    if (!rawContent || rawContent.trim() === '') {
      promptContent = `${initialSectionMarkdown}_No web content could be automatically gathered for this section._\n`;
    } else {
      promptContent = `${initialSectionMarkdown}${rawContent}`;
    }

    const prompt = `You are an expert crypto research analyst.
Given the following markdown documents, section titles, and web links for the cryptocurrency ${tokenName} (${tokenTicker}), produce a comprehensive, well-organized, and de-duplicated markdown summary for the section: "${section}".
Keep all relevant information, all meaningful sub-headings, and all web links.
Preserve the markdown format, including links and titles. Do not omit important technical or market details.
Your response should be ONLY the final, cleaned markdown for this single section.

--- BEGIN INPUT ---

${promptContent}

--- END INPUT ---
`;
    return { section, prompt, fallbackContent: promptContent };
  });

  const llmPromises = [];
  for (let i = 0; i < llmTasks.length; i++) {
    const task = llmTasks[i];
    console.log(`   -> Dispatching LLM task for section: ${task.section}`);
    
    // Start the LLM promise but do not await it. Add it to our array.
    const promise = shinkaiLlmPromptProcessor({ format: "text", prompt: task.prompt });
    llmPromises.push(promise);
    
    // If it's not the last task, wait 1.5 seconds before starting the *next* one.
    // The previous task continues to run in the background.
    if (i < llmTasks.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  }

  console.log(`   ... All LLM tasks dispatched. Now awaiting all to complete.`);
  const llmPromiseResults = await Promise.allSettled(llmPromises);
  
  const finalSectionContent: Record<string, string> = {};
  llmPromiseResults.forEach((result, index) => {
    const task = llmTasks[index];
    if (result.status === 'fulfilled') {
      finalSectionContent[task.section] = (result.value as any).message.trim();
    } else {
      console.warn(`LLM processing failed for section "${task.section}". Using raw content as fallback.`);
      finalSectionContent[task.section] = task.fallbackContent;
    }
  });

  // =================================================================
  // PHASE 3: REPORT ASSEMBLY
  // =================================================================
  console.log(`[3/3] Assembling the final report...`);

  let finalReport = `# Deep Research Report: ${tokenName} (${tokenTicker})\n\n`;
  finalReport += `*Report Generated: ${new Date().toISOString()}*\n\n`;
  finalReport += `## Table of Contents\n`;
  for (const section of Object.keys(RESEARCH_PLAN)) {
    const anchor = section.toLowerCase().replace(/[^a-zA-Z0-9-_\.]/g, "").replace(/\s+/g, '-');
    finalReport += `- [${section}](#${anchor})\n`;
  }
  finalReport += "\n---\n";

  for (const section of Object.keys(RESEARCH_PLAN)) {
    finalReport += `\n${finalSectionContent[section] || `## ${section}\n\n_Content processing failed for this section._`}\n\n---\n`;
  }

  const mdExportRes = await markdownExporter({ text_content: finalReport });
  let reportPath: string;
  if (typeof mdExportRes.md_filepath === "string") {
      reportPath = mdExportRes.md_filepath;
  } else {
      const home = await getHomePath();
      const outDir = `${home}/${sanitizeFilename(tokenTicker)}_${sanitizeFilename(tokenName)}`;
      try { await Deno.mkdir(outDir, { recursive: true }); } catch (_) {}
      reportPath = `${outDir}/final_report.md`;
      await Deno.writeFile(reportPath, new TextEncoder().encode(finalReport));
  }
  
  console.log(`Report successfully generated at: ${reportPath}`);

  return {
    reportPath,
    reportContent: finalReport,
  };
}