# Airtable OAuth Connector

## Name & Description
This is a developer tool that allows you to connect to Airtable via OAuth and perform actions using the Airtable API.

**IMPORTANT**
You must provide a `client_id` and `client_secret` to use this tool.
These can bes found in the Airtable Developer Settings.
You should also set the required `scopes` for the OAuth connection.

## Usage Example
* url: https://api.github.com/user
* method: GET

## Parameters/Inputs
The following parameter is required:
- `url` (string, required): The URL of the Github API endpoint to call.
- `method` (string, required): The HTTP method to use for the request.
- `body` (string, optional): The body of the request.
- `query_params` (string, optional): The query parameters to include in the request.
- `headers` (string, optional): The headers to include in the request.

## Config
This tool does not require any configuration options. The configuration object is empty.

## Output
The tool returns an object with the following field:
- `status` (number, required): The status code of the response.
- `statusText` (string, required): The status text of the response.
- `data` (object, required): The data of the response.
