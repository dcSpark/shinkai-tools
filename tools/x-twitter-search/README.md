# X/Twitter Search

## Name & Description
A tool that fetches data from X/Twitter API to perform various search and retrieval operations. It supports multiple search types and user data retrieval through RapidAPI's Twitter API.

## Usage Example
Use X/Twitter Search, with command: search-top, searchQuery: [YOUR_SEARCH_QUERY], and apiKey: [YOUR_RAPIDAPI_KEY]

Or for user posts:
Use X/Twitter Search, with command: get-user-posts, username: [TWITTER_USERNAME], and apiKey: [YOUR_RAPIDAPI_KEY]

Or for specific tweets:
Use X/Twitter Search, with command: get-post-by-id, tweetId: [TWEET_ID], and apiKey: [YOUR_RAPIDAPI_KEY]

## Parameters/Inputs
The following parameters are available:
- `command` (string, required): The operation to execute. Must be one of:
  - 'search-top': Search for top tweets
  - 'search-suggestions': Get search suggestions
  - 'search-latest': Search for latest tweets
  - 'get-user-posts': Get posts from a specific user
  - 'get-post-by-id': Get a specific tweet by ID
- `searchQuery` (string, optional): The search query for fetching tweets (required for search commands)
- `username` (string, optional): The username for retrieving user posts (required for get-user-posts)
- `tweetId` (string, optional): The ID of the tweet to retrieve (required for get-post-by-id)

## Config
The following configuration option is required:
- `apiKey` (string, required): Your API Key from RapidAPI's Twitter API service. Get your key at [RapidAPI Twitter API](https://rapidapi.com/twttrapi-twttrapi-default/api/twttrapi)

## Output
The tool returns an object with the following field:
- `data` (object, required): The data returned from the Twitter API, structure varies based on the command used
