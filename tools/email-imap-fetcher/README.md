# Email IMAP Fetcher

A tool that connects to an IMAP email server and fetches emails from the inbox, extracting key information like subject, sender, date, and content.

## Configuration

The tool requires the following configuration parameters:
```json
{
"imap_server": "imap.example.com",
"username": "your.email@example.com",
"password": "your_password",
"port": 143 // Optional, defaults to 993 for IMAP (NOT SSL)
}
```


| Parameter | Required | Description |
|-----------|----------|-------------|
| imap_server | Yes | The IMAP server address (e.g., imap.gmail.com) |
| username | Yes | Your email account username |
| password | Yes | Your email account password |
| port | No | IMAP server port (defaults to 993 for IMAPS) |

## Output

The tool returns an object with the following structure:

```json
{
"emails": [
{
    "subject": "Email subject",
    "date": "2024-03-20T10:30:00Z",
    "sender": "sender@example.com",
    "text": "Email content..."
}
],
    "login_status": "success or error message"
}
```

| Field | Type | Description |
|-------|------|-------------|
| emails | array | List of email objects containing subject, date, sender, and text content |
| login_status | string | Indicates if the login was successful or contains error message |

## Process Pipeline

1. **Connection Setup**
   - Establishes connection to the IMAP server using the provided server address and port
   - Attempts to create an IMAP4 connection

2. **Authentication**
   - Logs in using the provided username and password
   - Verifies login status

3. **Email Retrieval**
   - Selects the "INBOX" folder
   - Searches for all emails
   - Iterates through each email ID

4. **Email Processing**
   - Fetches raw email data using RFC822 format
   - Parses email headers (subject, date, sender)
   - Extracts email content
   - Handles both multipart and single-part email formats
   - Decodes email content appropriately

5. **Output Formation**
   - Converts email objects to dictionary format
   - Compiles results into the expected output structure
   - Includes login status and any error messages

## Error Handling

The tool includes error handling for:
- IMAP connection failures
- Authentication errors
- Email parsing issues
- Content decoding problems

All errors are captured and returned in the `login_status` field of the output.

## Notes

- The tool currently only fetches emails from the INBOX folder
- Email dates are parsed assuming a standard format; some non-standard date formats may not parse correctly
- Binary attachments are skipped during content extraction