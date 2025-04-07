# X/Twitter Get User Following

## Name & Description
A tool that fetches the list of users a Twitter/X user is following using the Twitter API. It retrieves detailed information about accounts that the specified user follows using the twttrapi-middleware package.

## Usage Example
Use X/Twitter Get User Following, with username: [USERNAME]

## Parameters/Inputs
The following parameter is required:
- `username` (string, required): The Twitter username of the user whose following list to fetch

## Config
The following configuration is required:
- `apiKey` (string, required): API key for authenticating with the Twitter API

## Output
The tool returns an object with the following fields:
- `data` (array): List of users the specified account is following, with details like id, username, and name
- `error` (string): Error message if an error occurs

## Version
1.0.0

## Keywords
twitter, following, api, users, X
