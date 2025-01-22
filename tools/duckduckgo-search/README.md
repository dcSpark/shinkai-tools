# DuckDuckGo Search

## Name & Description
A tool that searches the DuckDuckGo search engine and returns formatted results. The tool first attempts to use DuckDuckGo's API, and if that fails, it falls back to using Puppeteer for web scraping.

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
- `message` (string, required): The search query to send to DuckDuckGo

## Config
The following configuration option is available:
- `chromePath` (string, optional): The path to the Chrome executable. If not provided, the tool will use the CHROME_PATH environment variable or the default paths for Chrome and Chromium.

## Output
The tool returns an object with the following fields:
- `message` (string, required): The search results from DuckDuckGo in JSON format, containing title, description, and URL for each result. Example format:
  ```json
  [{
    "title": "IMDb Top 250 Movies",
    "description": "Find out which movies are rated as the best of all time...",
    "url": "https://www.imdb.com/chart/top/"
  }]
  ```
- `puppeteer` (boolean, required): Indicates whether the search was performed using Puppeteer (true) or the API (false)
