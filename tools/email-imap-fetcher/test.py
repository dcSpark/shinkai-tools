import asyncio
from tool import run, CONFIG, INPUTS
# Assuming the classes and functions are imported from your module
# from your_module import CONFIG, INPUTS, run

async def test_imap_connection():
    # Create a CONFIG instance with fake credentials
    config = CONFIG()
    config.imap_server = "server.fakemail.com"  # Replace with a valid IMAP server for testing
    config.username = "shinkai.dev@fakemail.com"  # Fake username
    config.password = "fakepassword"  # Fake password
    config.port = 993  # Common port for IMAPS
    config.ssl = True  # Use SSL

    # Create an INPUTS instance
    inputs = INPUTS()
    inputs.from_date = None  # Optional: set to a date string if needed
    inputs.to_date = None  # Optional: set to a date string if needed

    # Run the function and capture the output
    output = await run(config, inputs)
    print("Hello World")
    # Print the output
    print("Login Status:", output.login_status)
    print("Emails Retrieved:", len(output.emails))
    for email in output.emails:
        print(email['subject'] + " " + email['sender'] + " " + str(email['date']))

# Run the test
if __name__ == "__main__":
    asyncio.run(test_imap_connection())
