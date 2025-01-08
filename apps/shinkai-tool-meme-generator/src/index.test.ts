import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.219.0/assert/mod.ts";
import { run } from "./index.ts";

Deno.test("generates meme from question-answer joke", async () => {
  const result = await run(
    {},
    { joke: "Why did the chicken cross the road? To get to the other side!" }
  );

  assertEquals(typeof result.memeUrl, "string");
  assertStringIncludes(result.memeUrl, "https://i.imgflip.com/");
});

Deno.test("generates meme from single-line joke", async () => {
  const result = await run(
    {},
    { joke: "I used to be addicted to soap, but I am clean now." }
  );

  assertEquals(typeof result.memeUrl, "string");
  assertStringIncludes(result.memeUrl, "https://i.imgflip.com/");
});

Deno.test("generates meme from multi-line joke", async () => {
  const result = await run(
    {},
    { joke: "Me: eating cereal with milk\nAlso me: eating cereal with orange juice" }
  );

  assertEquals(typeof result.memeUrl, "string");
  assertStringIncludes(result.memeUrl, "https://i.imgflip.com/");
});
