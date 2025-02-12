import {
    googleSearch,
    duckduckgoSearch,
    shinkaiLlmPromptProcessor,
    shinkaiLlmMapReduceProcessor,
    downloadPages,
    shinkaiSqliteQueryExecutor,
  } from './shinkai-local-tools.ts';
  import { getAssetPaths } from './shinkai-local-support.ts';
  
  // Enable to cut the download pages size into 20000 characters
  const DEBUG_SHORT_SEARCH = true;
  
  type CONFIG = {
    searchEngineApiKey?: string;
    searchEngine?: SearchEngine;
    maxSources?: number;
    depth?: number;
  }
  type INPUTS = {
    question: string;
    feedback?: string;
  };
  type OUTPUT = {
    response: string;
    sources: SmartSearchSourcePage[];
    statements: SmartSearchStatement[];
    questions?: string;
    nextTopics?: string;
  }
  type PREFFERED_SOURCES = 'WIKIPEDIA' | 'WEB_SEARCH';
  
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
  
  // Add new types
  type SessionState = 'new' | 'feedback' | `stage-${number}` | 'finished';
  
  interface Session {
    id: number;
    question: string;
    state: SessionState;
    depth: number;
  }
  
  // Add feedback prompt generator
  const feedbackQuestionsGenerator = async (question: string): Promise<string> => {
    const assets = await getAssetPaths();
    const feedbackQuestionsGeneratorPath = assets.find(asset => asset.endsWith('feedback_questions_generator.txt'));
    if (!feedbackQuestionsGeneratorPath) {
      throw new Error('Feedback questions generator asset not found');
    }
    return Deno
      .readTextFileSync(feedbackQuestionsGeneratorPath)
      .replace('###REPLACE-E###', question);
  }
  
  // First, let's create the DatabaseService class at the top of the file, after the imports
  
  class DatabaseService {
    async createTables(): Promise<boolean> {
      const createTablesQuery1 = `
        CREATE TABLE IF NOT EXISTS smart_search_sessions (
            session_uuid TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
            question TEXT NOT NULL,
            state TEXT NOT NULL,
            depth TEXT DEFAULT '2',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
      `;
  
      const createTablesQuery2 = `
        CREATE TABLE IF NOT EXISTS smart_search_feedback (
            feedback_uuid TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
            session_uuid TEXT NOT NULL,
            question TEXT NOT NULL,
            answer TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(session_uuid) REFERENCES smart_search_sessions(session_uuid)
        );
      `;
  
      const createTablesQuery3 = `
        CREATE TABLE IF NOT EXISTS smart_search_results (
            result_uuid TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
            session_uuid TEXT NOT NULL,
            stage TEXT NOT NULL,
            search_query TEXT NOT NULL,
            response TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(session_uuid) REFERENCES smart_search_sessions(session_uuid)
        );
      `;
  
      await shinkaiSqliteQueryExecutor({ query: createTablesQuery1 });
      await shinkaiSqliteQueryExecutor({ query: createTablesQuery2 });
      await shinkaiSqliteQueryExecutor({ query: createTablesQuery3 });
      return true;
    }
  
    async readActiveSession(question: string) {
      const query = `
        SELECT * FROM smart_search_sessions 
        WHERE question = ? 
          AND state != 'finished'
        ORDER BY created_at DESC 
        LIMIT 1
      `;
      return await shinkaiSqliteQueryExecutor({
        query,
        params: [question]
      });
    }
  
    async writeNewSession(question: string, depth: string) {
      const query = `
        INSERT INTO smart_search_sessions (question, state, depth) 
        VALUES (?, 'feedback', ?)
      `;
      return await shinkaiSqliteQueryExecutor({
        query,
        params: [question, depth]
      });
    }
  
    async writeFeedback(sessionUuid: string, question: string, feedback: string) {
      const query = `
        INSERT INTO smart_search_feedback (session_uuid, question, answer)
        VALUES (?, ?, ?)
      `;
      return await shinkaiSqliteQueryExecutor({
        query,
        params: [sessionUuid, question, feedback]
      });
    }
  
    async updateSessionState(sessionUuid: string, newState: string) {
      const query = `
        UPDATE smart_search_sessions SET state = ? WHERE session_uuid = ?
      `;
      return await shinkaiSqliteQueryExecutor({
        query,
        params: [newState, sessionUuid]
      });
    }
  
    async readSessionFeedback(sessionUuid: string) {
      const query = `
        SELECT question, answer 
        FROM smart_search_feedback 
        WHERE session_uuid = ?
      `;
      return await shinkaiSqliteQueryExecutor({
        query,
        params: [sessionUuid]
      });
    }
  
    async writeSearchResults(sessionUuid: string, stage: number, searchQuery: string, response: string) {
      const query = `
        INSERT INTO smart_search_results (session_uuid, stage, search_query, response)
        VALUES (?, ?, ?, ?)
      `;
      return await shinkaiSqliteQueryExecutor({
        query,
        params: [sessionUuid, stage, searchQuery, response]
      });
    }
  
    async readAllSessionResults(sessionUuid: string): Promise<{ result: { response: string }[] }> {
      const query = `
        SELECT response FROM smart_search_results 
        WHERE session_uuid = ? 
        ORDER BY stage ASC
      `;
      return await shinkaiSqliteQueryExecutor({
        query,
        params: [sessionUuid]
      });
    }
  }
  
  class Logger {
    static log(title: string, content?: string | object) {
      console.log('-------------------');
      console.log(`[${getTimestamp()}] ${title}`);
      if (content) {
        if (typeof content === 'object') {
          console.log(JSON.stringify(content, null, 2));
        } else {
          console.log(content);
        }
      }
      console.log('-------------------');
    }
  }
  
  class SmartSearchService {
    private config: CONFIG;
  
    constructor(config: CONFIG) {
      this.config = config;
    }
  
    async search(question: string): Promise<OUTPUT> {
      try {
        // Step 1: Generate optimized search query
        const searchQuery = await this.conversionToSearchQuery(question);
  
        // Step 2: Perform search with optimized query
        const sources = await this.getSources(searchQuery);
        const smartSearchSources = await this.downloadSources(sources);
  
        // Step 3: Extract statements from sources
        const statements = await this.extractStatements(question, smartSearchSources);
  
        // Clean markdown from sources for lighter input
        smartSearchSources.forEach(source => delete source.markdown);
  
        // Step 4: Generate answer
        const response = await this.generateAnswer({
          originalQuestion: question,
          statements,
          sources: smartSearchSources,
        });
  
        return {
          statements,
          sources: smartSearchSources,
          response: response.message,
        };
      } catch (error) {
        throw new Error(this.ProcessQuestionError('question processing in answer generation', new Error(String(error))));
      }
    }
  
    private async conversionToSearchQuery(question: string): Promise<SearchQueryConversion> {
      const prompt = await this.searchEngineQueryGenerator(question);
      const optimizedQueryResult = await shinkaiLlmPromptProcessor({ format: 'text', prompt });
      try {
        return JSON.parse(optimizedQueryResult.message.trim()) as SearchQueryConversion;
      } catch (error) {
        console.error(error);
        if (typeof error === 'object') {
          console.log(JSON.stringify(error, null, 2));
        }
        throw new Error(this.ProcessQuestionError('question processing in optimizequery', new Error(String(error))));
      }
    }
  
    private async getSources(searchQuery: SearchQueryConversion): Promise<SmartSearchSource[]> {
      const sources: SmartSearchSource[] = [];
      for (const preferred_source of searchQuery.preferred_sources) {
        switch (preferred_source) {
          case 'WIKIPEDIA': {
            const searchEngineQuery = searchQuery.search_query + ' site:wikipedia.org';
            const searchEngine = this.config.searchEngine || 'GOOGLE';
            const sourcesSearchResults = await this.extractSourcesFromSearchEngine(searchEngineQuery, searchEngine);
            sources.push(...sourcesSearchResults);
            break;
          }
          case 'WEB_SEARCH': {
            const searchEngineQuery = searchQuery.search_query.trim();
            const searchEngine = this.config.searchEngine || 'GOOGLE';
            const sourcesSearchResults = await this.extractSourcesFromSearchEngine(searchEngineQuery, searchEngine);
            sources.push(...sourcesSearchResults);
            break;
          }
          default:
            throw new Error('Invalid source');
        }
      }
      return sources;
    }
  
    private async extractSourcesFromSearchEngine(
      searchQuery: string,
      engine: SearchEngine,
    ): Promise<SearchResult[]> {
      switch (engine) {
        case 'GOOGLE': {
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
          throw new Error('Invalid or unsupported search engine');
      }
    }
  
    private async downloadSources(sources: SmartSearchSource[]): Promise<SmartSearchSourcePage[]> {
      const smartSearchSources: SmartSearchSourcePage[] = [];
      let id = 1;
      while (smartSearchSources.length < Number(this.config.maxSources ?? 3)) {
        const source = sources.shift();
        if (!source) break;
        if (typeof source === 'string') throw new Error('Invalid source');
  
        console.log('+++++++++');
        console.log(`${id} Downloading source ${source.url}`);
        console.log('+++++++++');
  
        try {
          const searchResult = await downloadPages({ url: source.url });
          if (DEBUG_SHORT_SEARCH) {
            const totalLength = searchResult.markdown.length;
            const chunkSize = Math.floor(20000 / 3);
            const middleStart = Math.floor(totalLength / 2) - Math.floor(chunkSize / 2);
            const endStart = totalLength - chunkSize;
  
            searchResult.markdown =
              searchResult.markdown.slice(0, chunkSize) + '...' +
              searchResult.markdown.slice(middleStart, middleStart + chunkSize) + '...' +
              searchResult.markdown.slice(endStart);
          }
          smartSearchSources.push({
            id: id,
            url: source.url,
            title: source.title,
            markdown: searchResult.markdown ?? '',
          });
        } catch (error) {
          console.error('Failed to process source', source.url, error);
        }
        id++;
        await this.randomTimeout();
      }
      return smartSearchSources;
    }
  
    private async extractStatements(question: string, sources: SmartSearchSourcePage[]): Promise<SmartSearchStatement[]> {
      const statements: SmartSearchStatement[] = [];
      for (const smartSearchSource of sources) {
        const source = smartSearchSource.markdown;
        const sourceData = {
          title: smartSearchSource.title,
          url: smartSearchSource.url,
          id: smartSearchSource.id,
        };
        const statementString = await shinkaiLlmMapReduceProcessor({
          prompt: await this.statementExtract(question, sourceData),
          data: source as string
        });
        const cleanStatementString = this.tryToExtractJSON(statementString.response);
        try {
          const statement = JSON.parse(cleanStatementString) as SmartSearchStatement;
          statements.push(statement);
        } catch (error) {
          console.error('Failed to process statement', smartSearchSource.url, error);
          console.error(cleanStatementString);
        }
      }
      return statements;
    }
  
    private async generateAnswer(context: SmartSearchGenerationContext): Promise<{ message: string }> {
      const answerPrompt = await this.answerGenerator(context);
      return shinkaiLlmPromptProcessor({ format: 'text', prompt: answerPrompt });
    }
  
    private async answerGenerator(context: SmartSearchGenerationContext): Promise<string> {
      const assets = await getAssetPaths();
      const answerGeneratorPath = assets.find(asset => asset.endsWith('answer_generator.txt'));
      if (!answerGeneratorPath) {
        throw new Error('Answer generator asset not found');
      }
      return Deno
        .readTextFileSync(answerGeneratorPath)
        .replace('###REPLACE-A###', JSON.stringify(context));
    }
  
    private async searchEngineQueryGenerator(query: string): Promise<string> {
      const assets = await getAssetPaths();
      const searchEngineQueryGeneratorPath = assets.find(asset => asset.endsWith('search_engine_query_generator.txt'));
      if (!searchEngineQueryGeneratorPath) {
        throw new Error('Search engine query generator asset not found');
      }
      return Deno
        .readTextFileSync(searchEngineQueryGeneratorPath)
        .replace('###REPLACE-B###', query);
  
    }
  
    private async statementExtract(originalQuestion: string, source: SmartSearchSourcePage): Promise<string> {
      const assets = await getAssetPaths();
      const statementExtractorPath = assets.find(asset => asset.endsWith('statement_extractor.txt'));
      if (!statementExtractorPath) {
        throw new Error('Statement extractor asset not found');
      }
      return Deno
        .readTextFileSync(statementExtractorPath)
        .replace('###REPLACE-C###', originalQuestion)
        .replace('###REPLACE-D###', JSON.stringify(source));
    }
  
    private async randomTimeout() {
      const random = (1000 + Math.random() * 2000) | 0;
      console.log(`Waiting for ${random}ms`)
      return new Promise(resolve => setTimeout(resolve, random));
    }
  
    private tryToExtractJSON(text: string): string {
      const regex = /```(?:json)?\n([\s\S]+?)\n```/;
      const match = text.match(regex);
      if (match) return match[1];
      else return text;
    }
  
    private ProcessQuestionError(step: string, error: Error): string {
      return `Failed to process question at ${step}: ${error.message}`;
    }
  }
  
  // Modify the run function to use the DatabaseService
  export async function run(
    config: CONFIG,
    inputs: INPUTS
  ): Promise<OUTPUT> {
    const { question } = inputs;
    const db = new DatabaseService();
  
    Logger.log('Starting new run', {
      question,
      config
    });
  
    await db.createTables();
  
    Logger.log('Checking for existing session');
    const sessionResult = await db.readActiveSession(question);
    Logger.log(`Found ${sessionResult.rowCount} active sessions`);
  
    let session: Session;
  
    if (sessionResult.rowCount === 0) {
      if (!question) {
        throw new Error('Question is required in inputs');
      }
      Logger.log('Creating new session');
      const depth = config.depth ? String(config.depth) : "2";
      await db.writeNewSession(question, depth);
      const sessionResult = await db.readActiveSession(question);
      session = sessionResult.result[0];
      Logger.log(`Created session UUID: ${session.session_uuid}`);
  
      Logger.log('Generating feedback questions');
      const feedbackPrompt = await feedbackQuestionsGenerator(question);
      const feedbackResponse = await shinkaiLlmPromptProcessor({
        format: 'text',
        prompt: feedbackPrompt
      });
      Logger.log(`Generated feedback questions: ${feedbackResponse.message}`);
  
      return {
        response: "To better assist you, please answer these questions:",
        sources: [],
        statements: [],
        questions: feedbackResponse.message,
      };
    }
  
    session = sessionResult.result[0];
  
    if (session.state === 'feedback') {
      Logger.log('Processing feedback');
      if (!inputs.feedback) {
        throw new Error('Feedback is required in inputs');
      }
      Logger.log(`Feedback received: ${inputs.feedback}`);
      await db.writeFeedback(session.session_uuid, question, inputs.feedback!);
      await db.updateSessionState(session.session_uuid, 'stage-1');
      session.state = 'stage-1';
      Logger.log('Updated session state to stage-1');
    }
  
    if (session.state.startsWith('stage-')) {
      const currentStage = parseInt(session.state.split('-')[1]);
      Logger.log(`Processing stage ${currentStage}`);
  
      Logger.log('Gathering context from feedback');
      const contextResult = await db.readSessionFeedback(session.session_uuid);
      Logger.log(`Found ${contextResult.result.length} feedback entries`);
  
      Logger.log('Gathering previous search results');
      const previousResults = await db.readAllSessionResults(session.session_uuid);
      const previousSearchContext = previousResults.result
        .map((r: { response: string }) => r.response)
        .join('\n\n') || '';
      Logger.log(`Found ${previousResults.result.length} previous search results`);
  
      Logger.log('Enhancing search query');
      const enhancedQuestion = await shinkaiLlmPromptProcessor({
        format: 'text',
        prompt: `Combine this question: "${session.question}" with the following context:
                  ${JSON.stringify(contextResult.result)}
                  
                  ${previousSearchContext ? `Consider these previous search results:` : ''}
                  ${previousSearchContext}
                  
                  Create a detailed search query that incorporates all this information and explores new aspects 
                  not covered in previous results.`
      });
      Logger.log(`Enhanced query: ${enhancedQuestion.message}`);
  
      Logger.log('Performing smart search');
      const smartSearchService = new SmartSearchService(config);
      const searchResult = await smartSearchService.search(enhancedQuestion.message);
      Logger.log(`Found ${searchResult.sources.length} sources`);
  
      await db.writeSearchResults(session.session_uuid, currentStage, enhancedQuestion.message, searchResult.response);
  
      if (currentStage < session.depth) {
        Logger.log('Moving to next stage');
        await db.updateSessionState(session.session_uuid, `stage-${currentStage + 1}`);
  
        Logger.log('Analyzing for additional topics');
        const topicsPrompt = `Based on these search results, what additional topics should we explore to enhance our understanding? Format response as JSON array of topics.
                  ${searchResult.response}`;
  
        const topicsResponse = await shinkaiLlmPromptProcessor({
          format: 'text',
          prompt: topicsPrompt
        });
        Logger.log(`Generated topics: ${topicsResponse.message}`);
  
        return {
          ...searchResult,
          nextTopics: topicsResponse.message
        };
      } else {
        Logger.log('Finalizing session');
        await db.updateSessionState(session.session_uuid, 'finished');
  
        Logger.log('Combining all results');
        const allResults = await db.readAllSessionResults(session.session_uuid);
  
        const finalResponse = await shinkaiLlmPromptProcessor({
          format: 'text',
          prompt: `Synthesize these search results into a comprehensive answer:
                      ${allResults.result.map((r: { response: string }) => r.response).join('\n\n')}`
        });
        Logger.log(`Generated final response`);
  
        return {
          response: finalResponse.message,
          sources: searchResult.sources,
          statements: searchResult.statements
        };
      }
    }
  
    Logger.log(`Error: Invalid session state ${session.state}`);
    throw new Error(`Invalid session state: ${session.state}`);
  }
  
  // Add this helper function at the top level
  function getTimestamp(): string {
    return new Date().toISOString();
  }