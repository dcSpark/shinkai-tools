import {
  googleSearch,
  duckduckgoSearch,
  shinkaiLlmPromptProcessor,
  shinkaiLlmMapReduceProcessor,
  downloadPages,
} from './shinkai-local-tools.ts';

type CONFIG = {
  searchEngineApiKey?: string;
  searchEngine?: SearchEngine;
  maxSources?: number;
}
type INPUTS = {
  question: string;
};
type OUTPUT =  {
  response: string;
  sources: SmartSearchSourcePage[];
  statements: SmartSearchStatement[];
}
type PREFFERED_SOURCES = 'WIKIPEDIA'|'WEB_SEARCH';

type SearchQueryConversion = {
  "origin_question": string;
  "preferred_sources": PREFFERED_SOURCES[];
  "search_query": string
}

type SearchResult = {
  title: string;
  description: string;
  url: string;
}

type SmartSearchSource = SearchResult | string;
export type SearchEngine = 'DUCKDUCKGO' | 'GOOGLE' | 'BRAVE';

export interface SmartSearchSourcePage {
  id: number;
  url: string;
  markdown?: string;
  title: string;
}

export interface SmartSearchStatement {
  sourceId: number;
  sourceTitle: string;
  extractedFacts: {
    statement: string;
    relevance: 'DIRECT_ANSWER' | 'HIGHLY_RELEVANT' | 'SOMEWHAT_RELEVANT' | 'TANGENTIAL' | 'NOT_RELEVANT';
  }[];
}
export interface SmartSearchGenerationContext {
  originalQuestion: string;
  statements: SmartSearchStatement[];
  sources: SmartSearchSourcePage[];
}

const answerGenerator = (context: SmartSearchGenerationContext): string => `
# Smart Search Answer Generation Instructions
You are a sophisticated scientific communication assistant specialized in transforming extracted research statements into comprehensive, accessible, and precisely cited explanations.Your primary objective is to synthesize complex information from multiple sources into a clear, authoritative answer that maintains absolute fidelity to the source material. Think of yourself as an academic translator - your role is to take fragmented scientific statements and weave them into a coherent narrative that is both intellectually rigorous and engaging, ensuring that every substantive claim is meticulously attributed to its original source. Approach each question as an opportunity to provide a deep, nuanced understanding that goes beyond surface-level explanation, while maintaining strict scholarly integrity.
## Input JSON Interfaces and Definitions

\`\`\`typescript
// Source Page Interface
export interface SmartSearchSourcePage {
  id: number;           // Unique identifier for the source
  url: string;          // Full URL of the source
  markdown: string;     // Full text content of the source page
  title: string;        // Title of the source page
}

// Statement Interface with Detailed Relevance Levels
export interface SmartSearchStatement {
  sourceId: number;     // ID of the source this statement comes from
  sourceTitle: string;  // Title of the source
  extractedFacts: {
    statement: string;  // Exact verbatim text from the source
    relevance: 'DIRECT_ANSWER' 
             | 'HIGHLY_RELEVANT' 
             | 'SOMEWHAT_RELEVANT' 
             | 'TANGENTIAL' 
             | 'NOT_RELEVANT';  // Relevance classification
  }[];
}

// Complete Input JSON Structure
interface AnswerGenerationContext {
  originalQuestion: string;
  statements: SmartSearchStatement[];
  sources: SmartSearchSourcePage[];
}
\`\`\`

## Relevance Level Interpretation
- \`DIRECT_ANSWER\`: Prioritize these statements first
- \`HIGHLY_RELEVANT\`: Strong secondary focus
- \`SOMEWHAT_RELEVANT\`: Use for additional context
- \`TANGENTIAL\`: Optional supplementary information
- \`NOT_RELEVANT\`: Ignore completely

## Answer Generation Guidelines

### Content Construction Rules:
1. Use ONLY information from the provided statements
2. Prioritize statements with 'DIRECT_ANSWER' and 'HIGHLY_RELEVANT' relevance
3. Create a comprehensive, informative answer
4. Maintain scientific accuracy and depth

### Citation Methodology:
- Place citations IMMEDIATELY after relevant statements
- Use SQUARE BRACKETS with NUMERIC source IDs
- Format: \`Statement of fact.[1][2]\`
- Cite EVERY substantive statement
- Match citations exactly to source IDs

### Structural Requirements:
1. Detailed Main Answer
   - Comprehensive explanation
   - Technical depth
   - Precise scientific language
   - Full source citations

2. Follow-Up Questions Section
   - Generate 3-4 thought-provoking questions
   - Encourage deeper exploration
   - Based on answer content
   - Formatted as a bulleted list

3. Sources Section
   - List all cited sources
   - Include source titles and URLs
   - Order based on first citation appearance

## Output Example Structure:
\`\`\`
[Comprehensive, cited answer with source IDs in brackets]

Follow-up Questions:
- Question about deeper aspect of the topic
- Question exploring related concepts
- Question encouraging further research

Sources:
[1] Source Title (URL)
[2] Another Source Title (URL)
...
\`\`\`

## Critical Constraints:
- NEVER introduce information not in the statements
- Preserve exact factual content
- Ensure grammatical and logical coherence
- Provide a complete, informative answer
- Maintain academic rigor

## Processing Instructions:
- Analyze statements systematically
- Synthesize information coherently
- Break down complex concepts
- Provide scientific context
- Explain underlying mechanisms


This is the input context:
${JSON.stringify(context)}

`;

const searchEngineQueryGenerator = (query: string) => {
  return `
# Search Query and Source Selection Prompt

You are an expert at transforming natural language questions into precise search queries and selecting the most appropriate information source.

## Source Selection Guidelines:
- WEB_SEARCH: General web search for current events, recent developments, practical information
- WIKIPEDIA: Best for general knowledge, scientific explanations, historical information

## Output Requirements:
- Provide a JSON response with three key fields
- Do NOT use code block backticks
- Ensure "preferred_sources" is an array
- Make search query concise and targeted

## Examples:

### Example 1
- User Query: "Who was Marie Curie?"
- Output:
{
"origin_question": "Who was Marie Curie?",
"preferred_sources": ["WIKIPEDIA"],
"search_query": "Marie Curie biography scientific achievements"
}

### Example 2
- User Query: "Best restaurants in New York City"
- Output:
{
"origin_question": "Best restaurants in New York City",
"preferred_sources": ["WEB_SEARCH"],
"search_query": "top rated restaurants NYC 2024 dining"
}

### Example 3
- User Query: "How do solar panels work?"
- Output:
{
"origin_question": "How do solar panels work?",
"preferred_sources": ["WIKIPEDIA", "WEB_SEARCH"],
"search_query": "solar panel photovoltaic technology mechanism"
}

## Instructions:
- Carefully analyze the user's query
- Select the MOST APPROPRIATE source(s)
- Create a targeted search query
- Return ONLY the JSON without additional text
- Regarding things like new technologies like blockchain or artifical intelligence or recent scientific discoveries you should always use WEB_SEARCH
- Regarding things like historical events or consolidated scientific knowledge you should always use WIKIPEDIA

User Query: ${query}
`

}

const statementExtract = (originalQuestion: string, source: SmartSearchSourcePage): string => `
You're an expert at extracting facts from a source page. It has been commended to you to extract facts from the source page that are helpful to answer the original question.
Original Question: ${originalQuestion}
You will be given a source with the following fields:
- id: number - Unique identifier for the source
- url: string - URL of the source page
- title: string - Title of the source page
- markdown: string - Full text content of the source page

${JSON.stringify(source)}

# Fact Extraction Instructions

You will be given the contents of the provided source page. Your job is to extract the facts that are helpful to answer the original question.
Please format the facts that will be extracted in an array of objects with the following JSON structure.
## Output JSON Structure
\`\`\`json
{
  "sourceId": "number - ID of the source",
  "sourceTitle": "string - Title of the source",
  "extractedFacts": [
    {
      "statement": "string - Verbatim text from the source",
      "relevance": "string - One of ['DIRECT_ANSWER', 'HIGHLY_RELEVANT', 'SOMEWHAT_RELEVANT', 'TANGENTIAL', 'NOT_RELEVANT']"
    }
  ]
}
\`\`\`

## Relevance Classification Guide:
- \`DIRECT_ANSWER\`: 
  - Completely and precisely addresses the original question
  - Contains the core information needed to fully respond
  - Minimal to no additional context required

- \`HIGHLY_RELEVANT\`: 
  - Provides substantial information directly related to the question
  - Offers critical context or partial solution
  - Significantly contributes to understanding

- \`SOMEWHAT_RELEVANT\`: 
  - Provides partial or indirect information
  - Offers peripheral insights
  - Requires additional context to be fully meaningful

- \`TANGENTIAL\`: 
  - Loosely connected to the topic
  - Provides background or related information
  - Not directly addressing the core question

- \`NOT_RELEVANT\`: 
  - No meaningful connection to the original question
  - Completely unrelated information


## Extraction Guidelines:
1. Read the entire source document carefully
2. Extract EXACT quotes that:
  - Are actually helpful answering the provided question
  - Are stated verbatim from the source or are rephrased in such a way that doesn't distort the meaning in the original source
  - Represent complete thoughts or meaningful segments
3. Classify each extracted fact with its relevance level
4. Preserve original context and nuance

## Critical Rules:
- try NOT to paraphrase or modify the original text. If you can't find a direct quote or you think the found quote is too long, you can paraphrase it.
- Avoid any text in the "statement" field that is not helpful answering the provided question like javascript, URLs, HTML, and other non-textual content
- Extract statements as they appear in the source and ONLY if they are helpful answering the provided question
- Include full sentences or meaningful text segments
- Preserve original formatting and punctuation
- Sort extracted facts by relevance (DIRECT_ANSWER first)
- Output JSON without \`\`\`json\`\`\` tags, or without any escape characters or any text that is not JSON or my system will crash.

## Processing Instructions:
- Analyze the entire document systematically
- Be comprehensive in fact extraction
- Err on the side of inclusion when in doubt
- Focus on factual, informative statements
`
const debug = []
const randomTimeout = () => {
  const random = (1000 + Math.random() * 2000)|0;
  console.log(`Waiting for ${random}ms`)
  return new Promise(resolve => setTimeout(resolve, random));
}

function tryToExtractJSON(text: string): string {
  const regex = /```(?:json)?\n([\s\S]+?)\n```/;
  const match = text.match(regex);
  if (match) return match[1];
  else return text;
}

const ProcessQuestionError = (step: string, error: Error): string =>
  `Failed to process question at ${step}: ${error.message}`;

async function conversionToSearchQuery(question: string): Promise<SearchQueryConversion> {
  const prompt = searchEngineQueryGenerator(question);
  const optimizedQueryResult = await shinkaiLlmPromptProcessor({ format: 'text' , prompt });
  try {
    const result = JSON.parse(optimizedQueryResult.message.trim()) as SearchQueryConversion;
    return result;
  } catch (error) {
    console.error(error)
    if (typeof error === 'object') {
      console.log(JSON.stringify(error, null, 2))
    }
    throw new Error(ProcessQuestionError('question processing in optimizequery', new Error(String(error))));
  }
}


async function extractSourcesFromSearchEngine(
  searchQuery: string,
  engine: SearchEngine,
  apiKey?: string,
): Promise<SearchResult[]> {
  switch (engine) {
		case 'GOOGLE' : {
			const results = await googleSearch({ query: searchQuery });
			return results.results;
		}
    case 'DUCKDUCKGO': {
      const results = await duckduckgoSearch({ message: searchQuery });
      if (results.message) return JSON.parse(results.message);
      return [];
    }
    case 'BRAVE': 
      throw new Error('Brave is not supported yet');
    default:
      throw new Error('Invalid or unsupperted search engine');
  }
}

export async function run(
  config: CONFIG,
  inputs: INPUTS
): Promise<OUTPUT> {
  const { question } = inputs;
  if (!question) {
    throw new Error('Question is required in inputs');
  }

  try {
    // Step 1: Generate optimized search query
    const searchQuery = await conversionToSearchQuery(question);
    // Step 2: Perform search with optimized query
    const sources: SmartSearchSource[] = []
    for (const preferred_source of searchQuery.preferred_sources) {
      switch (preferred_source) {
        case 'WIKIPEDIA':{
          const searchEngineQuery = searchQuery.search_query+' site:wikipedia.org';
          const searchEngine = config.searchEngine || 'GOOGLE';
          const sourcesSearchResults: SearchResult[] = await extractSourcesFromSearchEngine(searchEngineQuery, searchEngine, config.searchEngineApiKey);
          try {
            sources.push(...(sourcesSearchResults as SearchResult[]));
          } catch (error) {
            console.error('Failed to process search results', error);
            throw new Error('Failed to process search results');
          }
          break;
        }
        case 'WEB_SEARCH': {
          const searchEngineQuery = searchQuery.search_query.trim();
          const searchEngine = config.searchEngine || 'GOOGLE';
          const sourcesSearchResults: SearchResult[] = await extractSourcesFromSearchEngine(searchEngineQuery, searchEngine, config.searchEngineApiKey);
          sources.push(...(sourcesSearchResults as SearchResult[]));
          break;
        }
        default:
          throw new Error('Invalid source');
      }
    }
    const smartSearchSouces: SmartSearchSourcePage[] = []
    let id = 1;
    while (smartSearchSouces.length < Number(config.maxSources ?? 3)) {
      const source = sources.shift();
      if (!source) break;
      if (typeof source === 'string') throw new Error('Invalid source');
      console.log('+++++++++');
      console.log(`${id} Downloading source ${source.url}`)
      console.log('+++++++++');
      try {
        const searchResult = await downloadPages({ url: source.url });
        smartSearchSouces.push({
          id: id, url: source.url, title: source.title,
          markdown: searchResult.markdown ?? '',
        });
      } catch (error) {
        console.error('Failed to process source', source.url, error);
      }
      id++;
      await randomTimeout();
    }
    console.log('Finished downloading sources');
    const statements: SmartSearchStatement[] = []
    // Step 3: Extract statements from sources
    for (const smartSearchSource of smartSearchSouces) {
      // TODO use map reduce to extract statements
      const source = smartSearchSource.markdown;
      const sourceData = {
        title: smartSearchSource.title,
        url: smartSearchSource.url,
        id: smartSearchSource.id,
      }
      const statementString = await shinkaiLlmMapReduceProcessor({ prompt: statementExtract(question, sourceData), data: source as string });
      const cleanStatementString = tryToExtractJSON(statementString.response)
      try { 
        const statement = JSON.parse(cleanStatementString) as SmartSearchStatement;
        statements.push(statement);
      } catch (error) {
        console.error('Failed to process statement', smartSearchSource.url, error);
        console.error(cleanStatementString)
      }
    }
    // clean markdown from sources for lighter input
    smartSearchSouces.forEach(source => delete source.markdown);
    const generationContext: SmartSearchGenerationContext = {
      originalQuestion: question,
      statements,
      sources: smartSearchSouces,
    }
    // Step 4: Generate answer
    const answerPrompt = answerGenerator(generationContext);
		const response = await shinkaiLlmPromptProcessor({ format: 'text', prompt: answerPrompt });
    return {
      statements,
      sources: smartSearchSouces,
      response: response.message,
    };
  } catch (error) {
    throw new Error(ProcessQuestionError('question processing in answer generation', new Error(String(error))));
  }
}
