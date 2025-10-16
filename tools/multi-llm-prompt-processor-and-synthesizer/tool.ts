import { shinkaiLlmPromptProcessor, wait15Seconds } from './shinkai-local-tools.ts';

type CONFIG = {
  // Note: LLM IDs must be as presented in Shinkai, coma-separated (e.g., 'shinkai_free_trial, gpt_5_mini, gemini_2_5_pro').
  default_prompt_processing_LLMs?: string;
  default_synthesizer_LLM?: string;
  processing_mode?: 'parallel' | 'sequential'; // in parallel node, only one local model should be used
  show_individual_answers?: boolean;
};

type INPUTS = {
  additional_instructions?: string;
  user_prompt: string;
  prompt_processing_LLMs?: string;
  synthesizer_LLM?: string;
};

type OUTPUT = {
  final_synthesized_answer: string;
  provenance: {
    synthesizer_llm: string;
    processing_llms: string[];
  };
  intermediary_individual_answers?: Record<string, string>;
  failed_calls?: Record<string, string>;
};

export async function run(config: CONFIG, inputs: INPUTS): Promise<OUTPUT> {

  const processing_llms_str = inputs.prompt_processing_LLMs || config.default_prompt_processing_LLMs || '';
  const processing_llms = processing_llms_str.split(',').map(s => s.trim()).filter(s => s.length > 0);
  const synthesizer_llm = inputs.synthesizer_LLM || config.default_synthesizer_LLM || '';
  
  if (!synthesizer_llm) {
    throw new Error('Synthesizer LLM must be specified via override or config default.');
  }

  const mode = config.processing_mode || 'parallel';
  const show_individual = config.show_individual_answers || false;

  const individual_responses: Record<string, string> = {};
  const failed_calls: Record<string, string> = {};

  if (processing_llms.length === 0) {
    // Fallback: Directly process with the synthesizer if no processing LLMs are defined.
    let synth_prompt = inputs.user_prompt;
    if (inputs.additional_instructions) {
      synth_prompt += `\n\nAdditional instructions: ${inputs.additional_instructions}`;
    }
    const synth_res = await shinkaiLlmPromptProcessor({
      format: 'text',
      prompt: synth_prompt,
      llm_provider: synthesizer_llm
    });
    return {
      final_synthesized_answer: synth_res.message,
      provenance: {
        synthesizer_llm: synthesizer_llm,
        processing_llms: []
      }
    };
  }
  
  if (mode === 'sequential') {
    for (const llm of processing_llms) {
      try {
        const res = await shinkaiLlmPromptProcessor({
          format: 'text',
          prompt: inputs.user_prompt,
          llm_provider: llm
        });
        individual_responses[llm] = res.message;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`LLM call for ${llm} failed: ${errorMessage}`);
        failed_calls[llm] = errorMessage;
      }
    }
  } else {
    // Parallel mode with staggered starts and robust error handling.
    const promises = [];
    for (let i = 0; i < processing_llms.length; i++) {
      const llm = processing_llms[i];
      const promise = shinkaiLlmPromptProcessor({
        format: 'text',
        prompt: inputs.user_prompt,
        llm_provider: llm
      });
      promises.push(promise);
      
      if (i < processing_llms.length - 1) {
        await wait15Seconds({});
      }
    }

    const results = await Promise.allSettled(promises);

    results.forEach((result, index) => {
      const llm = processing_llms[index];
      if (result.status === 'fulfilled') {
        individual_responses[llm] = result.value.message;
      } else {
        const errorMessage = result.reason instanceof Error ? result.reason.message : String(result.reason);
        console.error(`LLM call for ${llm} failed: ${errorMessage}`);
        failed_calls[llm] = errorMessage;
      }
    });
  }

  // If all calls failed, there's nothing to synthesize.
  if (Object.keys(individual_responses).length === 0) {
    throw new Error(`All processing LLM calls failed. Cannot generate a synthesized answer. Errors: ${JSON.stringify(failed_calls)}`);
  }

  // Build the synthesizer prompt.
  let synth_prompt = `You are an expert AI delivering the best outputs. Your task is to analyze the following responses from different LLMs to the user's query and combine them to deliver the best answer. Here is the user's query: "${inputs.user_prompt}"

Analyze each response carefully:
- Identify the best aspects (e.g., accuracy, depth, relevance) and worst aspects (e.g., inaccuracies, omissions, verbosity) of each.
- Retain all important details and key insights from the strongest parts.
- Adapt the synthesis to the query type: for factual queries, prioritize accuracy and evidence; for creative ones, blend ideas innovatively; for analytical, ensure logical coherence.
`;

  const failedLlmNames = Object.keys(failed_calls);
  if (failedLlmNames.length > 0) {
    synth_prompt += `\nIMPORTANT: The following models failed to provide a response and should be ignored: ${failedLlmNames.join(', ')}.\n`;
  }

  synth_prompt += "\nSuccessful Responses:\n";
  for (const [llm, resp] of Object.entries(individual_responses)) {
    synth_prompt += `\n--- Response from ${llm} ---\n${resp}\n`;
  }
  synth_prompt += `\n--- End of Responses ---\n\nSynthesize a final answer that combines the best elements from the successful responses into a cohesive, high-quality result.`;

  if (inputs.additional_instructions) {
    synth_prompt += `\n\nAdditional instructions: ${inputs.additional_instructions}`;
  }

  // Call the synthesizer LLM.
  const synth_res = await shinkaiLlmPromptProcessor({
    format: 'text',
    prompt: synth_prompt,
    llm_provider: synthesizer_llm
  });
  
  // Construct the final output object.
  const output: OUTPUT = {
    final_synthesized_answer: synth_res.message,
    provenance: {
      synthesizer_llm: synthesizer_llm,
      processing_llms: Object.keys(individual_responses)
    }
  };

  if (show_individual) {
    output.intermediary_individual_answers = individual_responses;
  }
  
  if (failedLlmNames.length > 0) {
    output.failed_calls = failed_calls;
  }
  
  return output;
}