import { run } from './tool.ts';

// Test the DuckDuckGo search tool
async function testDuckDuckGoSearch() {
  try {
    // Test configuration and parameters
    const config = {
      chromePath: undefined // Let it use default paths
    };
    const params = {
      message: "what is the best movie of all time"
    };

    console.log("Starting DuckDuckGo search test...");
    console.log("Search query:", params.message);

    // Run the search
    const result = await run(config, params);

    // Log results
    console.log("\nSearch completed!");
    console.log("Used Puppeteer fallback:", result.puppeteer);
    console.log("\nResults:");
    const searchResults = JSON.parse(result.message);
    searchResults.forEach((item: any, index: number) => {
      console.log(`\nResult ${index + 1}:`);
      console.log(`**Title**: ${item.title}`);
      console.log(`**Description**: ${item.description}`);
      console.log(`**URL**: ${item.url}`);
    });

  } catch (error) {
    console.error("Test failed:", error);
  }
}

// Run the test
testDuckDuckGoSearch();
