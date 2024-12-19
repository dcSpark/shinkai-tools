# Email Sender

A tool that sends emails using SMTP protocol with support for plain text messages.

## Configuration

The tool requires the following configuration parameters:

```json
{
    "smtp_server": "smtp.example.com",
    "port": 465,  // Optional, defaults to 465 for SMTP SSL
    "sender_email": "your.email@example.com",
    "sender_password": "your_password"
}
```

| Parameter | Required | Description |
|-----------|----------|-------------|
| smtp_server | Yes | The SMTP server address (e.g., smtp.gmail.com) |
| port | No | SMTP server port (defaults to 465 for SSL) |
| sender_email | Yes | Email address used to send the email |
| sender_password | Yes | Password for the sender's email account |

## Input Parameters

The tool accepts the following input parameters:

```json
{
    "recipient_email": "recipient@example.com",
    "subject": "Email Subject",
    "body": "Email content goes here"
}
```

| Parameter | Required | Description |
|-----------|----------|-------------|
| recipient_email | Yes | The email address of the recipient |
| subject | Yes | The subject line of the email |
| body | Yes | The main content of the email (plain text) |

## Output

The tool returns an object with the following structure:

```json
{
    "status": "success" | "failed",
    "message": "Operation result message"
}
```

| Field | Type | Description |
|-------|------|-------------|
| status | string | Either "success" or "failed" |
| message | string | Success confirmation or error details |

## Process Pipeline

1. **Message Preparation**
   - Creates a MIME multipart message
   - Sets From, To, and Subject headers
   - Attaches the body as plain text

2. **SMTP Connection**
   - Establishes connection to the SMTP server
   - Uses the configured port (defaults to 465)

3. **Authentication**
   - Logs in using the sender's email and password

4. **Email Sending**
   - Sends the prepared message
   - Closes the SMTP connection

5. **Result Processing**
   - Returns success status and message if email is sent
   - Returns failure status and error details if any step fails

## Error Handling

The tool includes error handling for:
- SMTP connection failures
- Authentication errors
- Message sending failures
- Invalid email format issues

All errors are captured and returned in the output's message field.

## Notes

- Currently supports plain text emails only
- Uses SSL/TLS connection by default (port 465)
- Does not support attachments in the current version
- Requires proper SMTP server configuration and credentials
