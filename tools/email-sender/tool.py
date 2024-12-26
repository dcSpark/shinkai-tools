from typing import Any, Optional, List, Dict
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
class CONFIG:
    smtp_server: str
    port: int = 465  # Default port for SMTP
    sender_email: str
    sender_password: str

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
        with smtplib.SMTP(config.smtp_server, config.port) as server:
            server.login(config.sender_email, config.sender_password)
            server.send_message(msg)
            output.status = "success"
            output.message = "Email sent successfully"
    except Exception as e:
        output.message = f"An error occurred: {e}"

    return output