# Download Pages

## Name & Description
A tool that downloads a URL and converts its HTML content to Markdown. This tool uses Puppeteer for web scraping and TurndownService for content conversion.

## Usage Example
```typescript
const run: Run<Configurations, Parameters, Result> = async (
  configurations: Configurations,
  parameters: Parameters,
): Promise<Result> => {
  // Tool execution
};
```

## Parameters/Inputs
The following parameter is required:
- `url` (string, required): A URL of a web page to download

## Config
The following configuration option is available:
- `chromePath` (string, optional): The path to the Chrome executable. If not provided, the tool will attempt to find Chrome automatically using environment variables or default installation paths.

## Output
The tool returns an object with the following field:
- `markdown` (string, required): The Markdown content converted from the downloaded web page
