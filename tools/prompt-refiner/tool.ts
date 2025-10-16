import { shinkaiLlmPromptProcessor } from './shinkai-local-tools.ts';

type CONFIG = {
  llm?: string;
  showCategory?: boolean;
};

type INPUTS = {
  prompt: string;
};

type OUTPUT = {
  enhancedPrompt: string;
  category?: string;
};

const categories: Record<string, string> = {
  coding: "For coding tasks, ensure the refined prompt specifies the programming language if mentioned, desired output format (e.g., code snippets, full scripts), includes step-by-step reasoning, error handling, edge cases, and testing instructions while preserving all user-specified requirements.",
  code_review: "For code reviews, instruct the LLM to systematically check for bugs, security issues, performance optimizations, adherence to best practices, readability, and provide balanced, constructive feedback with specific line references if applicable.",
  creative_writing: "For creative writing, enhance focus on originality, engaging narrative flow, vivid sensory details, character development, plot structure, and emotional depth without altering the user's creative vision or specified elements.",
  technical_writing: "For technical writing, emphasize clarity, precision, logical organization (e.g., sections, bullet points), accurate terminology, step-by-step explanations, and adaptation to the target audience while keeping all technical details intact.",
  life_advice: "For life advice, promote empathetic tone, practical and actionable steps, consideration of multiple perspectives, ethical considerations, and long-term implications, ensuring the advice aligns exactly with the user's described situation.",
  tool_use: "For tool use or API integration, detail the tool's expected inputs/outputs, step-by-step usage instructions, error handling for the tool, integration with other systems if specified, and example calls, without assuming unmentioned tools.",
  data_analysis: "For data analysis, outline data sources and formats, analytical methods (e.g., statistical tests, visualizations), step-by-step process, interpretation of results, and validation steps, preserving any specific data or hypotheses provided.",
  translation: "For translation, ensure fidelity to the original meaning, preservation of cultural nuances, idiomatic fluency in the target language, context-specific terminology, and handling of ambiguities exactly as in the source.",
  summarization: "For summarization, capture all key points objectively, specify desired length or focus areas, maintain neutrality, highlight implications or connections, and avoid omitting any critical details from the original content.",
  question_answering: "For question answering, provide comprehensive coverage of all query aspects, structured responses (e.g., bullet points for sub-questions), cite sources if relevant, address potential follow-ups, and stick precisely to the question's scope.",
  general: "For general tasks, structure the prompt for better clarity and effectiveness by adding organization (e.g., steps, examples if implied), without introducing new ideas, altering tone, or losing any specifics from the original.",
  image_generation: "For image generation, refine the prompt to include a clear subject, specific artistic style (e.g., photorealistic, cartoon, watercolor), composition details (e.g., close-up, wide-angle), lighting conditions (e.g., golden hour, studio light), color palette, and desired mood, while meticulously preserving the user's original concept and subjects.",
  brainstorming: "For brainstorming, structure the prompt to define the core problem or goal, specify any constraints or criteria, request a certain quantity or diversity of ideas, and suggest a format for the output (e.g., list, table with pros/cons), ensuring the creative space is clearly bounded by the user's request.",
  role_playing: "For role-playing, clearly define the persona or character for the LLM, including their background, personality, and tone. Specify the scenario, the user's role, and any rules of engagement or objectives for the interaction, ensuring a consistent and immersive experience based on the user's premise.",
  professional_communication: "For professional communication like emails or memos, specify the goal, target audience, desired tone (e.g., formal, persuasive), key information points to include, and a clear call to action, while structuring the request to produce a well-organized and effective message.",
  research: "For research tasks, emphasize sourcing from reliable and diverse references, critical analysis, proper citation, synthesis of information, and objective presentation of findings, while adhering strictly to the user's specified topic and scope.",
  text_editing: "For editing tasks, focus on improving grammar, style, coherence, conciseness, and flow while preserving the original meaning, tone, and all key content elements specified by the user."
  
};

const validCategories = Object.keys(categories);

export async function run(config: CONFIG, inputs: INPUTS): Promise<OUTPUT> {
  const llmProvider = config.llm || undefined;
  const baseProcessorInput = { llm_provider: llmProvider, format: 'text' as const };

  // Step 1: Classify the prompt with retries
  const categoryList = validCategories.join(', ');
  let classificationPrompt = `Classify the following user prompt into one of these categories if it closely matches: ${categoryList}. If it doesn't fit any specifically, classify as 'general'. Respond with only the exact category name (lowercase).

User prompt: ${inputs.prompt}`;

  let category = 'general';
  let maxRetries = 2;
  let attempt = 0;

  while (attempt <= maxRetries) {
    const classificationInput = {
      ...baseProcessorInput,
      prompt: classificationPrompt
    };
    const classificationResult = await shinkaiLlmPromptProcessor(classificationInput);
    const candidateCategory = classificationResult.message.trim().toLowerCase();

    if (validCategories.includes(candidateCategory)) {
      category = candidateCategory;
      break;
    }

    if (attempt < maxRetries) {
      const invalidResponse = classificationResult.message.trim();
      classificationPrompt = `Your previous classification was invalid: "${invalidResponse}". Valid categories are only: ${categoryList}. Please classify the following user prompt into exactly one of these (lowercase, no extra text). If no close match, use 'general'. Respond with ONLY the exact category name.

User prompt: ${inputs.prompt}`;
      attempt++;
    } else {
      // After max retries, default to general
      category = 'general';
    }
    attempt++;
  }

  // Step 2: Get additional instructions
  const selectedInstructions = categories[category] || categories['general'];
  const additionalInstructions = selectedInstructions === categories['general'] ? '' : `\nSpecific instructions for this task type: ${selectedInstructions}`;

  // Step 3: Refine the prompt
  const baseRefineInstructions = `Refine the following user prompt to make it more effective for an AI LLM. Ensure it is clear, detailed, and well-structured. Preserve ALL original details, tone, level of specificity, inputs, intentions, and requirements exactly. Do not add, remove, or alter any information—only enhance clarity and flow.${additionalInstructions}`;

  const refinePrompt = `${baseRefineInstructions}

Original user prompt: ${inputs.prompt}

Output only the refined prompt, without any additional text or explanations.`;

  const refineInput = {
    ...baseProcessorInput,
    prompt: refinePrompt
  };
  const refinedResult = await shinkaiLlmPromptProcessor(refineInput);

  // Step 4: Build output
  const output: OUTPUT = {
    enhancedPrompt: refinedResult.message.trim()
  };

  if (config.showCategory === true) {
    output.category = category;
  }

  return output;
}