from typing import Any, Optional, List, Dict
import imaplib
import email
from datetime import datetime

class CONFIG:
    imap_server: str
    username: str
    password: str
    port: int = 143  # Default port for IMAPS
    ssl: bool = True  # New flag to specify SSL usage

class INPUTS:
    from_date: Optional[str]
    to_date: Optional[str]

class OUTPUT:
    emails: List[Dict[str, Any]]
    login_status: str

class Email:
    subject: str
    date: datetime
    sender: str
    text: str

async def run(config: CONFIG, inputs: INPUTS) -> OUTPUT:
    output = OUTPUT()
    output.login_status = "N/A"
    output.emails = []
    try:
        # Use SSL if the ssl flag is set to True
        if config.ssl:
            imap = imaplib.IMAP4_SSL(config.imap_server, config.port)
        else:
            imap = imaplib.IMAP4(config.imap_server, config.port)  # Use config port
    except Exception as ee:
        output.login_status = 'IMAP4 INIT FAILED - ' + str(ee)
        return output

    try:
        login_status, login_response = imap.login(config.username, config.password)
        if login_status == "OK":
            print("Login successful")
        else:
            raise Exception("Login failed")

        imap.select("INBOX")

        # Construct the search criteria
        search_criteria = 'ALL'
        if inputs.from_date and inputs.to_date:
            search_criteria = f'SINCE "{inputs.from_date}" BEFORE "{inputs.to_date}"'
        elif inputs.from_date:
            search_criteria = f'SINCE "{inputs.from_date}"'
        elif inputs.to_date:
            search_criteria = f'BEFORE "{inputs.to_date}"'

        _, data = imap.search(None, search_criteria)
        mail_ids = data[0].split()

        for mail_id in mail_ids:
            _, data = imap.fetch(mail_id, '(RFC822)')
            raw_email = data[0][1]
            email_message = email.message_from_bytes(raw_email)

            email_obj = Email()
            email_obj.subject = email_message.get('Subject', '')
            email_obj.sender = email_message.get('From', '')
            try:
                email_obj.date = datetime.strptime(email_message['Date'], '%a, %d %b %Y %H:%M:%S %z')  # Example format, adjust as needed
            except ValueError:
                email_obj.date = None  # Handle parsing error

            email_obj.text = ""
            if email_message.is_multipart():
                for part in email_message.walk():
                    content_type = part.get_content_type()
                    content_disposition = str(part.get("Content-Disposition"))
                    try:
                        body = part.get_payload(decode=True).decode()
                        if content_type == "text/plain" and "attachment" not in content_disposition:
                            email_obj.text += body
                    except Exception as e:
                        print(f"Error decoding email part: {e}")
            else:
                try:
                    email_obj.text = email_message.get_payload(decode=True).decode()
                except Exception as e:
                    print(f"Error decoding email payload: {e}")

            output.emails.append(email_obj.__dict__)  # Append as dictionary to match OUTPUT type

        imap.close()
        imap.logout()

    except Exception as e:
        output.login_status = str(e)
        print(f"An error occurred: {e}")

    return output