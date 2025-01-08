import asyncio
from tool import CONFIG, INPUTS, run  # Adjust the import based on your module structure

async def test_email_sender():
    # Create a CONFIG instance with fake credentials
    config = CONFIG()
    config.smtp_server = "smtp.fakeemail.com"  # Replace with a valid SMTP server for testing
    config.port = 465  # Common port for SMTP with STARTTLS
    config.sender_email = "shinkai.dev@fakeemail.com"  # Fake sender email
    config.sender_password = "fakepassword" # Fake password
    config.ssl = True  # Set to True if you want to test SSL

    # Create an INPUTS instance
    inputs = INPUTS()
    inputs.recipient_email = "eduardo@fakeemail.com"  # Fake recipient email
    inputs.subject = "Test Email"
    inputs.body = "This is a test email sent using fake credentials."

    # Run the function and capture the output
    output = await run(config, inputs)

    # Print the output
    print("Email Sending Status:", output.status)
    print("Message:", output.message)

# Run the test
if __name__ == "__main__":
    asyncio.run(test_email_sender())
