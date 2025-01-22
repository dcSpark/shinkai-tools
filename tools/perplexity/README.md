# Perplexity

## Name & Description
A tool that searches the internet using Perplexity. It automates browser interaction with perplexity.ai to perform searches and retrieve results.

## Usage Example
```typescript
const run: Run<Configurations, Parameters, Result> = async (
  configurations: Configurations,
  params: Parameters,
): Promise<Result> => {
  // Tool execution
};
```

## Parameters/Inputs
The following parameter is required:
- `query` (string, required): The search query to send to Perplexity

## Config
The following configuration option is available:
- `chromePath` (string, optional): Optional path to Chrome executable for browser automation. If not provided, the tool will attempt to find Chrome automatically using environment variables or default installation paths.

## Output
The tool returns an object with the following field:
- `response` (string, required): The search results and analysis from Perplexity, formatted as markdown with preserved links
