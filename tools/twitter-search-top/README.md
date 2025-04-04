# X/Twitter Search Top

## Name & Description
A tool that searches for top (popular) tweets on Twitter/X matching a specific query string. It uses the Twitter API to retrieve the most relevant and popular tweets using the twttrapi-middleware package.

## Usage Example
Use X/Twitter Search Top, with query: "artificial intelligence"

## Parameters/Inputs
The following parameter is required:
- `query` (string, required): The search query for fetching tweets

## Config
The following configuration is required:
- `apiKey` (string, required): API key for accessing the Twitter API

## Output
The tool returns an object with the following fields:
- `data` (array): List of top tweets matching the search query, including text content, user information, and creation timestamps
- `error` (string): Error message if an error occurs

## Version
1.0.0

## Keywords
twitter, search, tweets, top, X
