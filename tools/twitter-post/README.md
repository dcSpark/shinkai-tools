# X/Twitter Post

## Name & Description
A tool that posts tweets to Twitter/X using the Twitter API v2. It handles OAuth 2.0 authentication and provides a simple interface for posting tweets.

## Usage Example
```typescript
const run: Run<CONFIG, INPUTS, OUTPUT> = async (
  config: CONFIG,
  inputs: INPUTS,
): Promise<OUTPUT> => {
  // Tool execution
};
```

## Parameters/Inputs
The following parameter is required:
- `text` (string, required): The message to post as a tweet

## Config
This tool does not require any configuration options. The configuration object is empty.

## Output
The tool returns an object with the following field:
- `data` (string, required): The response data from the Twitter API after posting the tweet
