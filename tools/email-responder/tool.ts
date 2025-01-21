import {
    emailFetcher,
    sendEmail,
    shinkaiLlmPromptProcessor,
    shinkaiSqliteQueryExecutor,
    memoryManagement,
} from './shinkai-local-tools.ts';

type EMAIL = {
    date: string;
    sender: string;
    subject: string;
    text: string;
}

type ANSWERED_EMAIL_REGISTER = {
    email_unique_id: string;
    subject: string;
    email: string;
    response: string;
    received_date: string;
    response_date: string;
}

type ANSWERED_EMAIL_RESULT = Pick<ANSWERED_EMAIL_REGISTER, 'email_unique_id' | 'subject' | 'email' | 'received_date'>

async function generateEmailUniqueId(email: EMAIL): Promise<string> {
    const encoder = new TextEncoder();
    if (!email.subject && !email.sender && !email.date) {
        throw new Error('Email is empty subject, sender, and date, cannot generate unique id');
    }
    const data = encoder.encode((email.subject ?? '') + (email.sender ?? '') + (email.date ?? ''));
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

type CONFIG = {
  response_context: string;
};

type INPUTS = {
  from_date?: string;
  to_date?: string;
};

type OUTPUT = {
    table_created: boolean;
    answered_emails: ANSWERED_EMAIL_RESULT[];
    skipped: string[];
    login_status: string;
};

// Helper function to escape user input
function escapeSqlString(str: string): string {
    return `'${str.replace(/'/g, "''").replace('--', '').replace(';', '')}'`; // Replaces single quotes with two single quotes
}

// Validate inputs
function validateInputs(inputs: INPUTS): void {
    if (!inputs.from_date && !inputs.to_date) return
    // Check if dates are on the DD-Mon-YYYY format
    const dateRegex = /^[0-3]{1}[0-9]{1}-(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-\d{4}$/;
    if (inputs.from_date) {
        if (!dateRegex.test(inputs.from_date)) {
            throw new Error('from_date : Invalid from_date format. It must be on the DD-Mon-YYYY format');
        }
    }
    if (inputs.to_date) {
        if (!dateRegex.test(inputs.to_date)) {
            throw new Error('to_date : Invalid to_date format. It must be on the DD-Mon-YYYY format');
        }
    }
    return
}

function getTodayInDDMonYYYY(): string {
    const date = new Date();
    const day = date.getDate().toString().padStart(2, '0');
    const month = date.toLocaleString('en-US', { month: 'short' });
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
}

export async function run(config: CONFIG, inputs: INPUTS): Promise<OUTPUT> {
    if (inputs.from_date || inputs.to_date) {
        validateInputs(inputs)
    }
    const tableName = 'answered_emails';

    const createTableQuery = `
        CREATE TABLE IF NOT EXISTS ${tableName} (
            email_unique_id TEXT UNIQUE PRIMARY KEY,
            subject TEXT NOT NULL,
            email TEXT NOT NULL,
            response TEXT NOT NULL,
            received_date DATETIME NOT NULL,
            response_date DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `;

    await shinkaiSqliteQueryExecutor({ query: createTableQuery });
    // Ensure the connection is closed or cleaned up if necessary
    // Verify table creation was successful
    const tableCheck = await shinkaiSqliteQueryExecutor({
        query: `SELECT name FROM sqlite_master WHERE type='table' AND name=?;`,
        params: [tableName]
    });
    const tableCreated = (tableCheck?.result?.length ?? 0) > 0;
    let { emails, login_status } = await emailFetcher({
        from_date: inputs.from_date || getTodayInDDMonYYYY(),
        to_date: inputs.to_date || '01-Jan-2099',
    });

    const answeredEmailsQuery = await shinkaiSqliteQueryExecutor({
        query: `SELECT * FROM ${tableName}`,
    });
    if (!answeredEmailsQuery?.result) {
        throw new Error('Failed to query answered emails');
    }
    const answeredEmails: ANSWERED_EMAIL_REGISTER[] = (answeredEmailsQuery.result as ANSWERED_EMAIL_REGISTER[]) ?? [];
    const answeredEmailsResult: ANSWERED_EMAIL_RESULT[] = answeredEmails.map((email) => ({
        email_unique_id: email.email_unique_id,
        subject: email.subject,
        email: email.email,
        received_date: email.received_date,
    }));
    const minDate = inputs.from_date ? new Date(inputs.from_date) : new Date('1970-01-01T00:00:00.000Z');
    emails = emails
        .filter((e: EMAIL) => (e.date && e.sender && e.subject))
        .filter((e: EMAIL) => e.date > ((minDate && minDate.toISOString()) || '1970-01-01T00:00:00.000Z'))
    
    const insertMailIdQuery = (
        emailUniqueId: string,
        subject: string,
        email: string,
        response: string,
        received_date: Date,
    ) => `
        INSERT INTO ${tableName} (email_unique_id, subject, email, response, received_date) 
        VALUES (${emailUniqueId}, ${subject}, ${email}, ${response}, ${Math.floor(received_date.getTime() / 1000)});
    `;

    const skipped: string[] = [];
    try {
        for (const email of emails as EMAIL[]) {
            const emailUniqueId = await generateEmailUniqueId(email);
            const { specificMemory } = await memoryManagement({ key: email.sender, data: '#' })
            const answeredEmail = answeredEmails.find(answeredEmail => answeredEmail.email_unique_id === emailUniqueId);
            if (answeredEmail) {
                skipped.push(answeredEmail.email_unique_id)
                console.log(`🐸 Skipping email with subject ${answeredEmail.subject}`)
                continue;
            }

            let response;
            try {
                response = await shinkaiLlmPromptProcessor({
                    format: 'text',
                    prompt: `You are a helpful email answering system.
                    Please respond to a following email but only in the manner of the following context:
                    <context>
                      ${config.response_context}
                      # memories of past conversations with this email sender:
                      <memories>
                      ${specificMemory || 'No memories found'}
                      </memories>
                    </context>
                    This is the email you need to respond to:
                    <email>
                      <email.subject>${email.subject}</email.subject>
                      <email.sender>${email.sender}</email.sender>
                      <email.date>${email.date}</email.date>
                      <email.text>${email.text}</email.text>
                    </email>

                    You'll be generating only the response to the email, no other text or markdown like html its neccesary.
                    `,
                });
            } catch (error) {
                console.error(`Failed to process email: ${error}`);
                continue; // Skip this email if processing fails
            }
                
            await sendEmail({
                recipient_email: email.sender,
                subject: 'RE:' + email.subject,
                body: response.message
            });
            const _insertMemory = await memoryManagement({ key: email.sender, data: `
                <received_email>
                  <email.subject>${email.subject}</email.subject>
                  <email.sender>${email.sender}</email.sender>
                  <email.date>${email.date}</email.date>
                  <email.text>${email.text}</email.text>
                </received_email>
                <answered_email>
                  <response>${response.message}</response>
                </answered_email>
                ` 
            })
            const insertEmail = insertMailIdQuery(
                escapeSqlString(emailUniqueId),
                escapeSqlString(email.subject),
                escapeSqlString(email.sender),
                escapeSqlString(response.message),
                new Date(email.date)
            );
            await shinkaiSqliteQueryExecutor({ query: insertEmail })
            const mailId = emailUniqueId;
            answeredEmailsResult.push({
                email_unique_id: mailId,
                subject: email.subject,
                email: email.sender,
                received_date: email.date,
            });
        }
    } catch (error) {
        console.error(`Failed to process emails: ${error}`);
        throw error; // Rethrow the error after rollback
    }
    return {
        table_created: tableCreated,
        answered_emails: answeredEmailsResult,
        login_status,
        skipped,
    };
}
