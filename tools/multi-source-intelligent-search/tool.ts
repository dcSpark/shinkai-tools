import {
  shinkaiLlmPromptProcessor,
  webSearch,
  wait15Seconds,
  youtubeSearch,
  arxivSearch,
  annaSArchiveEbookSearchWebScrappingBased as annaSearch,
  pubmedSearch,
  googleNewsSearch
} from './shinkai-local-tools.ts';

type Source = {
  title: string;
  url: string;
  description: string;
  source: string;
  type: string;
};

type CONFIG = {
  llm?: string;
  alwaysIncludeYoutube?: boolean;
  debug?: boolean;
};

type INPUTS = {
  prompt: string;
  queriesPerTool?: number;
  resultsPerQuery?: number;
  topPerQuery?: number;
  finalTop?: number;
};

type OUTPUT = {
  final_best_sources: Source[];
  errors: string[];
  debug_info?: {
    queries: Record<string, {query: string; optionalParams: Record<string, any>}[]>;
    raw_results: Record<string, any[]>;
    selected_results: Record<string, any[]>;
  };
};

interface ToolSuggestion {
  tool: string;
  queries: string[];
  type: string;
  optionalParams?: Record<string, any>;
}

interface RawToolResult {
  toolName: string;
  type: string;
  results: any[];
}

interface PreSelectedResult {
  tool: string;
  type: string;
  results: any[];
}

interface SearchTask {
  tool: string;
  query: string;
  type: string;
  optionalParams: Record<string, any>;
  resultsPerQuery: number;
}

interface SearchExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
  tool: string;
}

interface SelectExecutionResult {
  success: boolean;
  selected?: any[];
  error?: string;
  tool: string;
}

function cleanJSONString(input: string): string {
  let s = input.trim();
  // Remove code fences if present
  if (s.startsWith('```')) {
    s = s.replace(/^```[a-zA-Z]*\n?/, '').replace(/```$/, '').trim();
  }
  // Try to find the first { and last } to isolate JSON object
  const firstBrace = s.indexOf('{');
  const lastBrace = s.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    s = s.slice(firstBrace, lastBrace + 1);
  }
  return s;
}

function validateAndNormalizeToolPayload(parsed: any, userPrompt: string, queriesPerTool: number): ToolSuggestion[] | null {
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.tools)) return null;

  const allowedTools = new Set([
    'webSearch',
    'youtubeSearch',
    'arxivSearch',
    'annaSArchiveEbookSearchWebScrappingBased',
    'pubmedSearch',
    'googleNewsSearch'
  ]);

  const tools: ToolSuggestion[] = [];
  for (const t of parsed.tools) {
    if (!t || typeof t !== 'object') continue;
    const name = t.tool;
    if (!allowedTools.has(name)) continue;
    const queries = Array.isArray(t.queries) && t.queries.length > 0 ? t.queries.slice(0, queriesPerTool) : [userPrompt];
    const type = typeof t.type === 'string' && t.type.trim().length > 0 ? t.type : 'general';
    const optionalParams = t.optionalParams && typeof t.optionalParams === 'object' ? t.optionalParams : {};
    tools.push({
      tool: name,
      queries,
      type,
      optionalParams
    });
  }

  if (tools.length === 0) return null;
  return tools;
}

async function getToolSuggestions(llmProvider: string | undefined, userPrompt: string, queriesPerTool: number): Promise<ToolSuggestion[]> {
  const numQueriesStr = Math.min(queriesPerTool, 3).toString(); // Cap at 3 for prompt
  const baseSystemPrompt = `You are an expert in information retrieval and source evaluation. Analyze the query "${userPrompt}" to determine its domain and intent (e.g., seeking facts/data, opinions/discussions, tutorials, news). 

Step 1: Identify the core topic and suitable source variety (e.g., primary data, expert analyses, user perspectives, videos). Balance credibility, relevance, recency, and diversity based on intent – authoritative sources aren't always best; for example, blogs or forums can provide valuable insights for opinions, while data queries benefit from a mix of primary and synthesizing content.

Step 2: Always include 'webSearch' first, adapting with ${numQueriesStr} diverse, complementary queries (e.g., one broad, one specific angle; ensure they target different aspects for broader coverage).

Step 3: Select 1-3 additional tools from: youtubeSearch (for videos, suggest educational or explanatory content), arxivSearch (for preprints, academic papers), annaSArchiveEbookSearchWebScrappingBased (for books, ebooks, optional category like 'book_nonfiction' and file_type like 'pdf' or 'epub'), pubmedSearch (for medical topics, refine keywords), googleNewsSearch (for current events, optional gl/hl for location/language).

Step 4: For each tool, provide ${numQueriesStr} fine-tuned, diverse queries optimized for the domain and intent (complementary to cover angles). Include "optionalParams" only when asked or highly relevant (e.g., for arxivSearch: {categories: ["cs.LG"], date_from: "2020-01-01"}; for youtubeSearch: {gl: "us", hl: "en"}; omit if not needed). Assign a flexible 'type' describing the source focus.

Example for "global warming data": webSearch with queries ["global warming data overview", "global warming statistics datasets"], type "data sources and analyses"; arxivSearch with queries ["global warming data studies", "climate change empirical data"], optionalParams {date_from: "2020-01-01"}, type "academic preprints".

Example for "AI ethics": webSearch with queries ["AI ethics principles", "AI ethics real-world cases"], type "diverse views on AI ethics"; arxivSearch with queries ["AI ethics frameworks", "AI bias ethical issues"], optionalParams {categories: ["cs.CY"], date_from: "2020-01-01"}, type "academic preprints".

Output ONLY valid JSON: { "tools": [ { "tool": "toolName", "queries": ["query1", "query2"], "type": "flexible description", "optionalParams": {} }, ... ] }`;

  const maxRetries = 2; // max additional retries (total attempts = 1 + 2)
  let lastError = '';
  let lastRaw = '';

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const retryHeader = attempt === 0 ? '' : `
IMPORTANT: Previous attempt failed because: ${lastError || 'Unknown error'}.
Please correct the issues and respond with STRICTLY VALID JSON only. 
- Do NOT include any extra text or code fences.
- Ensure the root object has a "tools" array.
- Tool names must be one of: ["webSearch","youtubeSearch","arxivSearch","annaSArchiveEbookSearchWebScrappingBased","pubmedSearch","googleNewsSearch"].
- Always include 'webSearch' as the first tool with ${numQueriesStr} diverse queries.
- Provide up to ${numQueriesStr} queries per tool.
- Include optionalParams ONLY when relevant.
${lastRaw ? `Reference of your last output (truncated): ${lastRaw.slice(0, 1000)}` : ''}`;

    const systemPrompt = attempt === 0 ? baseSystemPrompt : `${baseSystemPrompt}\n${retryHeader}`;

    try {
      const llmRes = await shinkaiLlmPromptProcessor({
        format: 'text',
        prompt: systemPrompt,
        llm_provider: llmProvider
      });
      const jsonStrRaw = llmRes.message?.trim() ?? '';
      lastRaw = jsonStrRaw;

      const jsonStr = cleanJSONString(jsonStrRaw);
      let parsed: any;
      try {
        parsed = JSON.parse(jsonStr);
      } catch (parseErr) {
        lastError = `Invalid JSON format: ${(parseErr as Error).message}`;
        continue;
      }

      const validated = validateAndNormalizeToolPayload(parsed, userPrompt, queriesPerTool);
      if (!validated) {
        lastError = `Parsed JSON missing or invalid "tools" array or contains unsupported tools.`;
        continue;
      }

      return validated;
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      continue;
    }
  }

  // Fallback: only webSearch
  return [
    { tool: 'webSearch', queries: [userPrompt], type: 'general web', optionalParams: {} }
  ];
}

function normalizeForFallback(rawToolResults: RawToolResult[], topPerQuery: number): Source[] {
  const allSources: Source[] = [];
  for (const toolRes of rawToolResults) {
    let normalized: Source[] = [];
    switch (toolRes.toolName) {
      case 'webSearch':
        normalized = toolRes.results.slice(0, topPerQuery).map((r: any) => ({
          title: r.title || '',
          url: r.link || r.url || '',
          description: r.snippet || r.description || '',
          source: 'webSearch',
          type: toolRes.type
        }));
        break;
      case 'youtubeSearch':
        normalized = toolRes.results.slice(0, topPerQuery).map((r: any) => ({
          title: r.title || '',
          url: r.link || (r.videoId ? `https://www.youtube.com/watch?v=${r.videoId}` : ''),
          description: r.description_snippet || r.description || '',
          source: 'youtubeSearch',
          type: toolRes.type
        })).filter((s: Source) => s.url);
        break;
      case 'arxivSearch':
        normalized = toolRes.results.slice(0, topPerQuery).map((r: any) => {
          const arxivId = r.id || r.entry_id;
          return {
            title: r.title || '',
            url: r.pdf_url || (arxivId ? `https://arxiv.org/abs/${arxivId}` : ''),
            description: r.abstract || '',
            source: 'arxivSearch',
            type: toolRes.type
          };
        }).filter((s: Source) => s.url);
        break;
      case 'annaSearch':
      case 'annaSArchiveEbookSearchWebScrappingBased':
        if (toolRes.results.length === 0) break;
        normalized = toolRes.results.slice(0, topPerQuery).map((r: any) => ({
          title: r.title || '',
          url: r.annas_archive_url || r.url || '',
          description: `Author: ${r.author || 'Unknown'}, Year: ${r.year || 'Unknown'}, MD5: ${r.md5 || ''}`,
          source: 'annaSArchive',
          type: toolRes.type
        })).filter((s: Source) => s.url);
        break;
      case 'pubmedSearch':
        const pubRes = toolRes.results[0] || {};
        normalized = [{
          title: `PubMed Results for "${pubRes.query || ''}"`,
          url: `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(pubRes.query || '')}`,
          description: `Total results: ${pubRes.total_results || 0}. ${pubRes.message || ''}`,
          source: 'pubmedSearch',
          type: toolRes.type
        }];
        break;
      case 'googleNewsSearch':
        normalized = toolRes.results.slice(0, topPerQuery).map((r: any) => ({
          title: r.title || '',
          url: r.link || '',
          description: r.snippet || r.description || '',
          source: 'googleNewsSearch',
          type: toolRes.type
        })).filter((s: Source) => s.url);
        break;
    }
    allSources.push(...normalized);
  }
  return allSources.slice(0, 10);
}

function flattenAndNormalize(preSelected: PreSelectedResult[], finalTop: number): Source[] {
  const allSources: Source[] = [];
  for (const p of preSelected) {
    const rawToolRes: RawToolResult = {
      toolName: p.tool,
      type: p.type,
      results: p.results
    };
    const normalized = normalizeForFallback([rawToolRes], 100); // Large number to take all pre-sliced results
    allSources.push(...normalized);
  }
  return allSources.slice(0, finalTop);
}

export async function run(config: CONFIG, inputs: INPUTS): Promise<OUTPUT> {
  const { prompt } = inputs;
  if (!prompt || typeof prompt !== 'string') {
    throw new Error('Invalid or missing prompt');
  }

  const queriesPerTool = Math.max(1, inputs.queriesPerTool || 2);
  const resultsPerQuery = Math.max(1, inputs.resultsPerQuery || 10);
  const topPerQuery = Math.max(1, inputs.topPerQuery || 4);
  const finalTop = Math.max(1, inputs.finalTop || 8);
  const alwaysYoutube = config.alwaysIncludeYoutube || false;
  const debug = config.debug || false;

  let suggestions = await getToolSuggestions(config.llm, prompt, queriesPerTool);

  // Ensure at least webSearch
  const hasWeb = suggestions.some(s => s.tool === 'webSearch');
  if (!hasWeb) {
    suggestions.unshift({ tool: 'webSearch', queries: [prompt], type: 'general web', optionalParams: {} });
  }

  // Always include YouTube if configured
  if (alwaysYoutube) {
    const hasYoutube = suggestions.some(s => s.tool === 'youtubeSearch');
    if (!hasYoutube) {
      const ytQueries = [prompt, `${prompt} explained`].slice(0, queriesPerTool);
      suggestions.push({ tool: 'youtubeSearch', queries: ytQueries, type: 'videos', optionalParams: { gl: 'us', hl: 'en' } });
    }
  }

  // Collect queries per tool for debug, with optionalParams
  const queriesMap = new Map<string, {query: string; optionalParams: Record<string, any>}[]>();
  for (const sug of suggestions) {
    const toolQueries: {query: string; optionalParams: Record<string, any>}[] = [];
    for (const q of sug.queries) {
      toolQueries.push({
        query: q,
        optionalParams: sug.optionalParams || {}
      });
    }
    queriesMap.set(sug.tool, toolQueries);
  }

  const toolToType = new Map<string, string>();
  for (const sug of suggestions) {
    toolToType.set(sug.tool, sug.type);
  }

  const searchTasks: SearchTask[] = [];
  for (const sug of suggestions) {
    for (const q of sug.queries) {
      searchTasks.push({
        tool: sug.tool,
        query: q,
        type: sug.type,
        optionalParams: sug.optionalParams || {},
        resultsPerQuery
      });
    }
  }

  // Staggered parallel searches
  const searchPromises = searchTasks.map(async (task, i) => {
    // Stagger start by i * 1.5s
    for (let j = 0; j < i; j++) {
      await wait15Seconds({});
    }

    let finalExtracted: any[] = [];
    let toolError = '';
    const toolName = task.tool;
    const resultsToTake = task.resultsPerQuery;

    try {
      // Initial call with full params
      let res: any;
      switch (toolName) {
        case 'webSearch':
          res = await webSearch({ query: task.query, ...task.optionalParams });
          break;
        case 'youtubeSearch':
          res = await youtubeSearch({ search_query: task.query, max_results: resultsToTake, ...task.optionalParams });
          break;
        case 'arxivSearch':
          res = await arxivSearch({ query: task.query, max_results: resultsToTake, ...task.optionalParams });
          break;
        case 'annaSArchiveEbookSearchWebScrappingBased':
          res = await annaSearch({ search_query: task.query, num_results: resultsToTake, ...task.optionalParams });
          break;
        case 'pubmedSearch':
          res = await pubmedSearch({ query: task.query, max_results: Math.min(resultsToTake, 15), ...task.optionalParams });
          break;
        case 'googleNewsSearch':
          res = await googleNewsSearch({ query: task.query, num_results: resultsToTake, ...task.optionalParams });
          break;
        default:
          throw new Error(`Unknown tool: ${toolName}`);
      }

      // Extract initial results
      let extracted: any[] = [];
      switch (toolName) {
        case 'webSearch':
        case 'youtubeSearch':
        case 'googleNewsSearch':
          extracted = (res.results || []).slice(0, resultsToTake);
          break;
        case 'arxivSearch':
          extracted = (res.papers || []).slice(0, resultsToTake);
          break;
        case 'annaSArchiveEbookSearchWebScrappingBased':
          extracted = (res.error && res.error !== '' ? [] : (res.results || [])).slice(0, resultsToTake);
          break;
        case 'pubmedSearch':
          extracted = [res];
          break;
      }

      if (extracted.length === 0) {
        // Retry with plain params (query + max_results only, no other optionals)
        let retryRes: any;
        switch (toolName) {
          case 'webSearch':
            retryRes = await webSearch({ query: task.query });
            break;
          case 'youtubeSearch':
            retryRes = await youtubeSearch({ search_query: task.query, max_results: resultsToTake });
            break;
          case 'arxivSearch':
            retryRes = await arxivSearch({ query: task.query, max_results: resultsToTake });
            break;
          case 'annaSArchiveEbookSearchWebScrappingBased':
            retryRes = await annaSearch({ search_query: task.query, num_results: resultsToTake });
            break;
          case 'pubmedSearch':
            retryRes = await pubmedSearch({ query: task.query, max_results: Math.min(resultsToTake, 15) });
            break;
          case 'googleNewsSearch':
            retryRes = await googleNewsSearch({ query: task.query, num_results: resultsToTake });
            break;
        }

        // Re-extract from retry
        switch (toolName) {
          case 'webSearch':
          case 'youtubeSearch':
          case 'googleNewsSearch':
            finalExtracted = (retryRes.results || []).slice(0, resultsToTake);
            break;
          case 'arxivSearch':
            finalExtracted = (retryRes.papers || []).slice(0, resultsToTake);
            break;
          case 'annaSArchiveEbookSearchWebScrappingBased':
            finalExtracted = (retryRes.error && retryRes.error !== '' ? [] : (retryRes.results || [])).slice(0, resultsToTake);
            break;
          case 'pubmedSearch':
            finalExtracted = [retryRes];
            break;
        }

        if (finalExtracted.length === 0) {
          toolError = '0 results even after retry';
        }
      } else {
        finalExtracted = extracted;
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      toolError = errorMsg;
    }

    if (toolError) {
      return { success: false, error: toolError, tool: toolName };
    }

    return { success: true, data: { results: finalExtracted }, tool: toolName }; // Wrap as if res with results for consistency
  });

  const searchExecResults: SearchExecutionResult[] = await Promise.all(searchPromises);

  // Group results by tool
  const toolAllResults = new Map<string, any[]>();
  const errors: string[] = [];

  for (const exec of searchExecResults) {
    if (!exec.success) {
      errors.push(`Search for ${exec.tool} failed: ${exec.error}`);
      continue;
    }

    const res = exec.data;
    let extracted: any[] = (res.results || []).slice(0, resultsPerQuery); // Since we wrapped, use results

    if (extracted.length > 0) {
      let allForTool = toolAllResults.get(exec.tool) || [];
      allForTool.push(...extracted);
      toolAllResults.set(exec.tool, allForTool);
    } else {
      errors.push(`Search for ${exec.tool} (retry attempted) gave 0 results`);
    }
  }

  // Raw results for debug
  let raw_results: Record<string, any[]> = {};
  if (debug) {
    raw_results = Object.fromEntries(toolAllResults.entries());
  }

  // Per-tool LLM selections, staggered
  const toolsWithResults = Array.from(toolAllResults.keys()).filter(tool => toolAllResults.get(tool)!.length > 0);
  const selectPromises = toolsWithResults.map(async (toolName, i) => {
    // Stagger start by i * 1.5s
    for (let j = 0; j < i; j++) {
      await wait15Seconds({});
    }

    const allRes = toolAllResults.get(toolName)!;
    const type = toolToType.get(toolName)!;
    const selectPrompt = `For the user query "${prompt}", using ${toolName} tool of type "${type}", evaluate the following ${allRes.length} results (indexed from 0).

Select the top ${topPerQuery} most relevant ones by their indices (0-based, sorted ascending).

Output ONLY valid JSON: { "indices": [0, 1] } // example, up to ${topPerQuery} indices

Data: ${JSON.stringify(allRes)}`;

    try {
      const llmRes = await shinkaiLlmPromptProcessor({
        format: 'text',
        prompt: selectPrompt,
        llm_provider: config.llm
      });
      const jsonStr = cleanJSONString(llmRes.message.trim());
      const parsed = JSON.parse(jsonStr);
      let indices: number[] = parsed.indices || [];
      if (Array.isArray(indices)) {
        const selected = indices
          .filter((idx: number) => idx >= 0 && idx < allRes.length)
          .slice(0, topPerQuery)
          .map((idx: number) => allRes[idx]);
        return { success: true, selected, tool: toolName };
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      return { success: false, error: errorMsg, tool: toolName };
    }

    // If no valid indices, fallback below
    return { success: false, error: 'Invalid selection', tool: toolName };
  });

  const selectExecResults: SelectExecutionResult[] = await Promise.all(selectPromises);

  const preSelected: PreSelectedResult[] = [];
  const selectedMap = new Map<string, any[]>();
  for (const sel of selectExecResults) {
    const toolName = sel.tool;
    const type = toolToType.get(toolName)!;
    const allRes = toolAllResults.get(toolName)!;
    let toolResults: any[];

    if (sel.success && sel.selected && sel.selected.length > 0) {
      toolResults = sel.selected;
    } else {
      errors.push(`Selection for ${toolName} failed: ${sel.error || 'Unknown error'}`);
      toolResults = allRes.slice(0, topPerQuery);
    }

    if (toolResults.length > 0) {
      preSelected.push({
        tool: toolName,
        type,
        results: toolResults
      });
      selectedMap.set(toolName, toolResults);
    }
  }

  // Selected results for debug
  let selected_results: Record<string, any[]> = {};
  if (debug) {
    selected_results = Object.fromEntries(selectedMap.entries());
  }

  let final_best_sources: Source[] = [];

  if (preSelected.length > 0) {
    const combinedPreJson = JSON.stringify({
      userPrompt: prompt,
      preSelected
    });

    const evalPrompt = `Evaluate the pre-selected search results for the topic "${prompt}". 
Review all from different tools/queries, considering relevance, credibility, recency, and diversity. 
Select the top ${finalTop} best sources overall. 
For each, provide title, url, description (summarize if needed), source (tool name), type. 
Output ONLY valid JSON: { "final_best_sources": [ { "title": "string", "url": "string", "description": "string", "source": "string", "type": "string" }, ... ] } 
Data: ${combinedPreJson}`;

    try {
      const llmRes = await shinkaiLlmPromptProcessor({
        format: 'text',
        prompt: evalPrompt,
        llm_provider: config.llm
      });
      const jsonStr = cleanJSONString(llmRes.message.trim());
      const parsed = JSON.parse(jsonStr);
      if (parsed.final_best_sources && Array.isArray(parsed.final_best_sources)) {
        final_best_sources = parsed.final_best_sources
          .map((s: any) => ({
            title: s.title || '',
            url: s.url || '',
            description: s.description || '',
            source: s.source || '',
            type: s.type || ''
          }))
          .filter((s: Source) => s.url && s.title)
          .slice(0, finalTop);
      }
    } catch (e) {
      // Fallback: flatten and normalize preSelected
      final_best_sources = flattenAndNormalize(preSelected, finalTop);
    }
  }

  const output: OUTPUT = { final_best_sources, errors };
  if (debug) {
    output.debug_info = {
      queries: Object.fromEntries(queriesMap.entries()),
      raw_results,
      selected_results
    };
  }

  return output;
}