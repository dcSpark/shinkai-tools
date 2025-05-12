import FirecrawlApp, { SearchResponse } from 'npm:@mendable/firecrawl-js';
import { serpQueryGenerator, serpResultAnalyzer } from './shinkai-local-tools.ts';
import pLimit from 'npm:p-limit';
import { compact } from 'npm:lodash-es';

const ConcurrencyLimit = 5;

type CONFIG = {};
type INPUTS = { query: string; breadth: number; depth: number; learnings?: string[]; visitedUrls?: string[]; }
type OUTPUT = { learnings: string[]; visitedUrls: string[]; }

const reportProgress = (log) => {
  console.log("Progres:", log)
}

 type ResearchProgress = {
  currentDepth: number;
  totalDepth: number;
  currentBreadth: number;
  totalBreadth: number;
  currentQuery?: string;
  totalQueries: number;
  completedQueries: number;
};


export async function run(config: CONFIG, inputs: INPUTS): Promise<OUTPUT> {
    const { query, breadth, depth, learnings = [], visitedUrls = [] } = inputs;
    const progress: ResearchProgress = {
      currentDepth: 0,
      totalDepth: 0,
      currentBreadth: 0,
      totalBreadth: 0,
      totalQueries: 0,
      completedQueries: 0,
    };
    let serpQueries = await serpQueryGenerator({ query, learnings, numQueries: breadth });
    const firecrawl = new FirecrawlApp({
      apiKey: config.FIRECRAWL_KEY,
      apiUrl: "https://api.firecrawl.dev",
    });

    const deepresearch_step = (new_inputs) => run(config, new_inputs);

    const limit = pLimit(ConcurrencyLimit);
    const results = await Promise.all(
        (serpQueries.queries || []).map(serpQuery => limit(async () => {
        try {
          const result = await firecrawl.search(serpQuery.query, {
            timeout: 15000,
            limit: 5,
            scrapeOptions: { formats: ['markdown'] },
          });

          // Collect URLs from this search
          const newUrls = compact(result.data.map(item => item.url));
          const newBreadth = Math.ceil(breadth / 2);
          const newDepth = depth - 1;

          const newLearnings = await serpResultAnalyzer({
            query: serpQuery.query,
            search_results: result.data.map(m => m.markdown),
            numFollowUpQuestions: newBreadth,
          });
          const allLearnings = [...learnings, ...(newLearnings.learnings || [])];
          const allUrls = [...visitedUrls, ...(newUrls || [])];

          if (newDepth > 0) {
            console.log(`Researching deeper, breadth: ${newBreadth}, depth: ${newDepth}`);

            reportProgress({
              currentDepth: newDepth,
              currentBreadth: newBreadth,
              completedQueries: progress.completedQueries + 1,
              currentQuery: serpQuery.query,
            });

            const nextQuery = `
            Previous research goal: ${serpQuery.researchGoal}
            Follow-up research directions: ${newLearnings.followUpQuestions.map(q => `\n${q}`).join('')}
          `.trim();

            return deepresearch_step({
              query: nextQuery,
              breadth: newBreadth,
              depth: newDepth,
              learnings: allLearnings,
              visitedUrls: allUrls,
            });
          } else {
            reportProgress({
              currentDepth: 0,
              completedQueries: progress.completedQueries + 1,
              currentQuery: serpQuery.query,
            });
            return {
              learnings: allLearnings,
              visitedUrls: allUrls,
            };
          }
        } catch (e: any) {
          if (e.message && e.message.includes('Timeout')) {
            console.log(`Timeout error running query: ${serpQuery.query}: `, e); 
          } else {
            console.log(`Error running query: ${serpQuery.query}: `, e);
          }
          return {
            learnings: [],
            visitedUrls: [],
          };
        }
      })
      ),
    );

    return {
        learnings: [...new Set(results.flatMap(r => r.learnings))],
        visitedUrls: [...new Set(results.flatMap(r => r.visitedUrls))],
    };
}

