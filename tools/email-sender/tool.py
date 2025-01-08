from typing import Any, Optional, List, Dict
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
import logging

# Configure logging
logging.basicConfig(level=logging.ERROR, format='%(asctime)s - %(levelname)s - %(message)s')

class CONFIG:
    smtp_server: str
    port: int = 465  # Default port for SMTP
    sender_email: str
    sender_password: str
    ssl: bool = False  # New flag to specify SSL usage for SMTP

class INPUTS:
    recipient_email: str
    subject: str
    body: str

class OUTPUT:
    status: str
    message: str


async def run(config: CONFIG, inputs: INPUTS) -> OUTPUT:
    output = OUTPUT()
    output.status = "failed"
    output.message = ""

    msg = MIMEMultipart()
    msg['From'] = config.sender_email
    msg['To'] = inputs.recipient_email
    msg['Subject'] = inputs.subject
    msg['Date'] = datetime.now().strftime('%a, %d %b %Y %H:%M:%S %z')

    msg.attach(MIMEText(inputs.body, 'plain'))

    try:
        # Use SSL if the ssl flag is set to True
        if config.ssl:
            with smtplib.SMTP_SSL(config.smtp_server, config.port) as server:
                server.login(config.sender_email, config.sender_password)
                server.send_message(msg)
        else:
            with smtplib.SMTP(config.smtp_server, config.port) as server:
                try:
                    server.starttls()  # Upgrade to a secure connection
                except Exception as e:
                    logging.error(f"Failed to upgrade to a secure connection: {e}")
                # Attempt to login and send the message regardless of starttls success
                server.login(config.sender_email, config.sender_password)
                server.send_message(msg)

        output.status = "success"
        output.message = "Email sent successfully"
    except Exception as e:
        output.message = f"An error occurred: {e}"

    return output