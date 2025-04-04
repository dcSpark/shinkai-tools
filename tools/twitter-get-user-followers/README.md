# X/Twitter Get User Followers

## Name & Description
A tool that fetches the list of users who follow a specific Twitter/X user using the Twitter API. It retrieves detailed information about followers of the specified user using the twttrapi-middleware package.

## Usage Example
Use X/Twitter Get User Followers, with username: [USERNAME]

## Parameters/Inputs
The following parameter is required:
- `username` (string, required): The Twitter username of the user whose followers to fetch

## Config
The following configuration is required:
- `apiKey` (string, required): API key for authenticating with the Twitter API

## Output
The tool returns an object with the following fields:
- `data` (array): List of users who follow the specified account, with details like id, username, and name
- `error` (string): Error message if an error occurs

## Version
1.0.0

## Keywords
twitter, followers, api, users, X
