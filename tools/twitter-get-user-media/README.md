# X/Twitter Get User Media

## Name & Description
A tool that fetches media content (images, videos, gifs) posted by a specific Twitter/X user using the Twitter API. It retrieves media files from the user's timeline using the twttrapi-middleware package.

## Usage Example
Use X/Twitter Get User Media, with username: [USERNAME]

## Parameters/Inputs
The following parameter is required:
- `username` (string, required): The Twitter username of the user whose media content to fetch

## Config
The following configuration is required:
- `apiKey` (string, required): API key for accessing the Twitter API

## Output
The tool returns an object with the following fields:
- `data` (array): List of media objects from the user's timeline, containing URLs and metadata
- `error` (string): Error message if an error occurs

## Version
1.0.0

## Keywords
twitter, media, fetch, images, X
