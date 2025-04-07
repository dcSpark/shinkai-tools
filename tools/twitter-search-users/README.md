# X/Twitter Search Users

## Name & Description
A tool that searches for Twitter/X users based on a query string. It uses the Twitter API to find users matching the search term using the twttrapi-middleware package.

## Usage Example
Use X/Twitter Search Users, with query: "tech"

## Parameters/Inputs
The following parameter is required:
- `query` (string, required): The search query to find Twitter users

## Config
The following configuration is required:
- `apiKey` (string, required): API key for accessing the Twitter API

## Output
The tool returns an object with the following fields:
- `data` (array): List of users matching the search query, with user details including id, name, and username
- `error` (string): Error message if an error occurs

## Version
1.0.0

## Keywords
twitter, user search, api, users, X
