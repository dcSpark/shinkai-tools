import {
    emailFetcher,
    sendEmail,
    shinkaiLlmPromptProcessor,
    shinkaiSqliteQueryExecutor,
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
    mail_ids: (string | number)[];
    skipped: string[];
    login_status: string;
};

// Helper function to escape user input
function escapeSqlString(str: string): string {
    return `'${str.replace(/'/g, "''").replace('--', '').replace(';', '')}'`; // Replaces single quotes with two single quotes
}

export async function run(config: CONFIG, inputs: INPUTS): Promise<OUTPUT> {
    const dbName = 'default';
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

    await shinkaiSqliteQueryExecutor({ query: createTableQuery, database_name: dbName });
    // Ensure the connection is closed or cleaned up if necessary
    // Verify table creation was successful
    const tableCheck = await shinkaiSqliteQueryExecutor({
        query: `SELECT name FROM sqlite_master WHERE type='table' AND name=?;`,
        database_name: dbName,
        query_params: [tableName]
    });
    const tableCreated = tableCheck?.result?.length > 0;
    let { emails, login_status } = await emailFetcher({ from_date: inputs.from_date, to_date: inputs.to_date });

    const answeredEmailsQuery = await shinkaiSqliteQueryExecutor({
        query: `SELECT * FROM ${tableName}`,
        database_name: dbName
    });
    if (!answeredEmailsQuery?.result) {
        throw new Error('Failed to query answered emails');
    }
    const answeredEmails: ANSWERED_EMAIL_REGISTER[] = answeredEmailsQuery.result ?? [];
    const mailIds: string[] = [];
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
            
            const insertEmail = insertMailIdQuery(
                escapeSqlString(emailUniqueId),
                escapeSqlString(email.subject),
                escapeSqlString(email.sender),
                escapeSqlString(response.message),
                new Date(email.date)
            );
            await shinkaiSqliteQueryExecutor({ query: insertEmail, database_name: dbName })
            const mailId = emailUniqueId;
            mailIds.push(mailId);
        }
    } catch (error) {
        console.error(`Failed to process emails: ${error}`);
        throw error; // Rethrow the error after rollback
    }
    return {
        table_created: tableCreated,
        mail_ids: mailIds,
        login_status,
        skipped,
    };
}
