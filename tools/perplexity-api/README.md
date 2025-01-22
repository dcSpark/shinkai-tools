# Perplexity API

## Name & Description
A tool that searches the web using Perplexity API (limited). It uses the llama-3.1-sonar-small-128k-online model to process search queries and return results.

## Usage Example
Use Perplexity API Search, with query: [YOUR_SEARCH_QUERY], and apiKey: [YOUR_PERPLEXITY_API_KEY]

## Parameters/Inputs
The following parameter is required:
- `query` (string, required): The search query to send to Perplexity API

## Config
The following configuration option is required:
- `apiKey` (string, required): API key for accessing the Perplexity API (e.g., `[YOUR_PERPLEXITY_API_KEY]`)

## Output
The tool returns an object with the following field:
- `response` (string, required): The search results and analysis from Perplexity API
