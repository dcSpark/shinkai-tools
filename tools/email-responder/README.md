# Email Answerer

## Name & Description
A tool that generates responses to emails based on a given context and memory, and logs answered emails in a database.

## Usage Example
```typescript
const run: Run<Configurations, Parameters, Result> = async (
  configurations: Configurations,
  params: Parameters,
): Promise<Result> => {
  // Tool execution
};
```

## Parameters/Inputs
The following parameters are available (all optional):
- `from_date` (string, optional): The starting date for fetching emails in DD-Mon-YYYY format
- `to_date` (string, optional): The ending date for fetching emails in DD-Mon-YYYY format

## Config
The following configuration option is required:
- `response_context` (string, required): The context to guide the email responses

## Output
The tool returns an object with the following fields:
- `table_created` (boolean, required): Indicates if the email logging table was created
- `mail_ids` (array of strings, required): The list of generated unique mail IDs
- `skipped` (array of strings): List of email IDs that were skipped
- `login_status` (string): The status of the email login
