import { shinkaiTypescriptUnsafeProcessor } from "./shinkai-local-tools.ts";

const get_ts_code = () => {
  return `
import { Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod";
const randomTimer = (min: number = 0, max: number = 1500) => {
  const timeAmount = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise((resolve) => setTimeout(resolve, timeAmount));
};
export async function run(config: any, inputs: any) {
  console.log("🎮 Starting 2048 bot...");
  const stagehand = new Stagehand({
    env: "LOCAL",
    modelName: "gpt-4o",
    modelClientOptions: {
        apiKey: process.env.OPENAI_KEY,
    },
    verbose: 1,
    debugDom: true,
    domSettleTimeoutMs: 100,
    executablePath: process.env.CHROME_PATH,
  });
  try {
    console.log("🌟 Initializing Stagehand...");
    await stagehand.init();
    console.log("🌐 Navigating to 2048...");
    await stagehand.page.goto("https://micro2048.pages.dev/events");
    try {
      await stagehand.page.locator('#username').fill('walalo');
      await randomTimer(100);
      await stagehand.page.locator('#password').fill('c0rder00');
      await randomTimer(100);
      await stagehand.page.keyboard.press('Enter');
    } catch (error) {
      console.error("❌ Error logging in:", error);
    }
    console.log("🖱️ clicking on the first event...");
    await stagehand.page.act({
      action: "click the first event",
    });
    console.log("Clicking on New Game Button at the top right corner...");
    await stagehand.page.act({
      action: "click the new game button",
    });
    await randomTimer(1000);
    console.log("⌛ Waiting for game to initialize...");
    await stagehand.page.waitForSelector(".game-board", { timeout: 10000 });
    // Main game loop
    let moveKey = "ArrowDown";
    while (true) {
      console.log("🔄 Game loop iteration...");
      // Add a small delay for UI updates
      await randomTimer(100, 300);
      // Get current game state
      const gameState = await stagehand.page.extract({
        instruction: \`Extract the current game state:
          1. Score from the score counter
          2. All tile values in the 4x4 grid (empty spaces as 0)
          3. Highest tile value present\`,
        schema: z.object({
          score: z.number(),
          highestTile: z.number(),
          grid: z.array(z.array(z.number())),
        }),
      });
      const transposedGrid = gameState.grid[0].map((_, colIndex) =>
        gameState.grid.map((row) => row[colIndex]),
      );
      const grid = transposedGrid.map((row, rowIndex) => ({
        [\`row\${rowIndex + 1}\`]: row,
      }));
      console.log("Game State:", {
        score: gameState.score,
        highestTile: gameState.highestTile,
        grid: grid,
      });
      // Analyze board and decide next move
      const analysis = await stagehand.page.extract({
        instruction: \`Based on the current game state:
          - Score: \${gameState.score}
          - Highest tile: \${gameState.highestTile}
          - Grid: This is a 4x4 matrix ordered by row (top to bottom) and column (left to right). The rows are stacked vertically, and tiles can move vertically between rows or horizontally between columns:\n\${grid
            .map((row) => {
              const rowName = Object.keys(row)[0];
              return \`             \${rowName}: \${row[rowName].join(", ")}\`;
            })
            .join("\\n")}
          What is the best move (up/down/left/right)? Consider:
          1. Keeping high value tiles in corners (bottom left, bottom right, top left, top right)
          2. Maintaining a clear path to merge tiles
          3. Avoiding moves that could block merges
          4. Only adjacent tiles of the same value can merge
          5. Making a move will move all tiles in that direction until they hit a tile of a different value or the edge of the board
          6. Tiles cannot move past the edge of the board
          7. Each move must move at least one tile\`,
        schema: z.object({
          move: z.enum(["up", "down", "left", "right"]),
          confidence: z.number(),
          reasoning: z.string(),
        }),
      });
      console.log("Move Analysis:", analysis);
      let moveKey = {
        up: "ArrowUp",
        down: "ArrowDown",
        left: "ArrowLeft",
        right: "ArrowRight",
      }[analysis.move];
      let random = false;
      if (!moveKey) {
        moveKey = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"][Math.floor(Math.random() * 4)];
        random = true;
      }
      await stagehand.page.keyboard.press(moveKey);
      await randomTimer(100, 300);
      console.log("🎯 Executed move:", moveKey);
      console.log("🎯🎯 Random:", random);
    }
  } catch (error) {
    console.error("❌ Error in game loop:", error);
    const isGameOver = await stagehand.page.evaluate(() => {
      return document.querySelector(".game-over") !== null;
    });
    if (isGameOver) {
      console.log("🏁 Game Over!");
      return;
    }
    throw error; // Re-throw non-game-over errors
  }
}
`;
}

const get_ts_package = () => {
  return JSON.stringify({
    "name": "standalone",
    "version": "1.0.0",
    "main": "index.ts",
    "scripts": {},
    "author": "",
    "license": "ISC",
    "description": "",
    "dependencies": {
      "@browserbasehq/stagehand": "https://github.com/dcspark/stagehand",
      "sharp": "^0.33.5",
      "json-schema-to-zod": "^2.6.0",
      "zod": "^3.24.1"
    }
  }, null, 2);
}

export async function run(config: any, parameters: any) {
    return await shinkaiTypescriptUnsafeProcessor({
        code: get_ts_code(),
        package: get_ts_package(),
        parameters,
        config,
    });
}