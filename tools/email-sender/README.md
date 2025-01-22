# Send Email

## Name & Description
A tool that sends emails using SMTP protocol with support for plain text messages. Uses SSL/TLS connection by default and handles various email-related operations including authentication and error handling.

## Usage Example
```python
async def run(config: CONFIG, inputs: INPUTS) -> OUTPUT:
    # Tool execution
    pass
```

## Parameters/Inputs
The following parameters are required:
- `recipient_email` (string, required): The email address of the recipient
- `subject` (string, required): The subject line of the email
- `body` (string, required): The main content of the email (plain text)

## Config
The following configuration options are available:
- `smtp_server` (string, required): The SMTP server address (e.g., `[YOUR_SMTP_SERVER]`)
- `port` (integer, optional): SMTP server port (defaults to 465 for SSL)
- `sender_email` (string, required): Email address used to send the email (e.g., `[YOUR_EMAIL]`)
- `sender_password` (string, required): Password for the sender's email account (e.g., `[YOUR_PASSWORD]`)
- `ssl` (boolean, optional): Whether to use SSL for the SMTP connection (defaults to true)

## Output
The tool returns an object with the following fields:
- `status` (string, required): The status of the email sending operation ('success' or 'failed')
- `message` (string, required): A message indicating the result of the operation (success confirmation or error details)
