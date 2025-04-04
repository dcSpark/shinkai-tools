# X/Twitter Get User Replies

## Name & Description
A tool that fetches reply tweets made by a specific Twitter/X user using the Twitter API. It retrieves tweets that are responses to other tweets using the twttrapi-middleware package.

## Usage Example
Use X/Twitter Get User Replies, with username: [USERNAME]

## Parameters/Inputs
The following parameter is required:
- `username` (string, required): The Twitter username to fetch replies for

## Config
The following configuration is required:
- `apiKey` (string, required): API key for accessing the Twitter API

## Output
The tool returns an object with the following fields:
- `data` (array): List of reply tweets from the user, including tweet ID and text content
- `error` (string): Error message if an error occurs

## Version
1.0.0

## Keywords
twitter, api, replies, conversation, X
