type Configurations = {
  apiKey: string;
};
type Parameters = {
  query: string;
};

type Result = {
  response: string;
};

interface PerplexityResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}
export type Run<C extends Record<string, any>, I extends Record<string, any>, R extends Record<string, any>> = (config: C, inputs: I) => Promise<R>;

export const run: Run<Configurations, Parameters, Result> = async (
  configurations,
  parameters,
): Promise<Result> => {
  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${configurations.apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.1-sonar-small-128k-online',
      messages: [
        { role: 'system', content: 'Be precise and concise.' },
        { role: 'user', content: parameters.query },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch data from Perplexity API, status: ${response.status}`,
    );
  }

  const data = (await response.json()) as PerplexityResponse;
  const responseContent =
    data.choices[0]?.message?.content || 'No information available';

  return { response: responseContent };
};
