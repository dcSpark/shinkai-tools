# Email Fetcher

## Name & Description
A tool that fetches emails from an IMAP server and returns their subject, date, sender, and text content.

## Usage Example
Use Email Fetcher, with imap_server: [YOUR_IMAP_SERVER], username: [YOUR_EMAIL], password: [YOUR_PASSWORD], from_date: [START_DATE], and to_date: [END_DATE]

## Parameters/Inputs
The following parameters are available (all optional):
- `from_date` (string, optional): The start date for the email search
- `to_date` (string, optional): The end date for the email search

Note: Dates should be in the format DD-Mon-YYYY (e.g., 10-Jan-2025)

## Config
The following configuration options are available:
- `imap_server` (string, required): The IMAP server address (e.g., [YOUR_IMAP_SERVER])
- `username` (string, required): The username/email for the IMAP account (e.g., [YOUR_EMAIL])
- `password` (string, required): The password for the IMAP account (e.g., [YOUR_PASSWORD])
- `port` (integer, optional): The port number for the IMAP server (defaults to 993 for IMAPS)
- `ssl` (boolean, optional): Whether to use SSL for the IMAP connection (defaults to true)

## Output
The tool returns an object with the following fields:
- `emails` (array, required): A list of email objects, each containing:
  - `subject` (string): The subject of the email
  - `date` (string): The date and time the email was sent
  - `sender` (string): The sender of the email
  - `text` (string): The text content of the email
- `login_status` (string, required): Indicates if login was successful or not
