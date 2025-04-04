# X/Twitter Search Latest

## Name & Description
A tool that searches for the most recent tweets on Twitter/X matching a specific query string. It uses the Twitter API to retrieve the latest tweets in chronological order using the twttrapi-middleware package.

## Usage Example
Use X/Twitter Search Latest, with query: "breaking news"

## Parameters/Inputs
The following parameter is required:
- `query` (string, required): The search query for fetching tweets

## Config
The following configuration is required:
- `apiKey` (string, required): API key for accessing the Twitter API

## Output
The tool returns an object with the following fields:
- `data` (array): List of most recent tweets matching the search query, including text content, user information, and creation timestamps
- `error` (string): Error message if an error occurs

## Version
1.0.0

## Keywords
twitter, search, tweets, latest, X
