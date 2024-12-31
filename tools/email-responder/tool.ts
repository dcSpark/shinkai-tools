import { emailFetcher, sendEmail, shinkaiLlmPromptProcessor, shinkaiSqliteQueryExecutor } from './shinkai-local-tools.ts';

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
};

type OUTPUT = {
    table_created: boolean;
    mail_ids: (string | number)[];
    login_status: string;
};

export async function run(config: CONFIG, _inputs: INPUTS): Promise<OUTPUT> {
    const dbName = 'default';
    const tableName = 'answered_emails';

    const createTableQuery = `
        -- DROP TABLE IF EXISTS ${tableName};
        CREATE TABLE IF NOT EXISTS ${tableName} (
            email_unique_id TEXT PRIMARY KEY,
            subject TEXT NOT NULL,
            email TEXT NOT NULL,
            response TEXT NOT NULL,
            received_date DATETIME NOT NULL,
            response_date DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `;

    await shinkaiSqliteQueryExecutor({ query: createTableQuery, database_name: dbName });

    let { emails, login_status } = await emailFetcher({});

    const answeredEmailsQuery = await shinkaiSqliteQueryExecutor({
        query: `SELECT * FROM ${tableName}`,
        database_name: dbName
    });
    
    const answeredEmails: ANSWERED_EMAIL_REGISTER[] = answeredEmailsQuery?.result ?? [];
    const mailIds: (string | number)[] = [];
    const minDate = _inputs.from_date ? new Date(_inputs.from_date) : new Date('1970-01-01T00:00:00.000Z');
    emails = emails
        .filter((e: EMAIL) => (e.date && e.sender && e.subject))
        .filter((e: EMAIL) => e.date > ((minDate && minDate.toISOString()) || '1970-01-01T00:00:00.000Z'))
    for (const email of emails as EMAIL[]) {
        const emailUniqueId = await generateEmailUniqueId(email);
        if (answeredEmails.find(answeredEmail => answeredEmail.email_unique_id === emailUniqueId)) {
            continue;
        }
        const { message: response } = await shinkaiLlmPromptProcessor({
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
            `,
        });
        
        await sendEmail({
            recipient_email: email.sender,
            subject: 'Re: ' + email.subject,
            body: response
        });

        const insertMailIdQuery = `
            INSERT INTO ${tableName} (email_unique_id, subject, email, response, received_date, response_date) 
            VALUES (?, ?, ?, ?, ?, ?)
            -- ON CONFLICT(email_unique_id) DO NOTHING;
        `;
        
        const insertEmail = await shinkaiSqliteQueryExecutor({
            query: insertMailIdQuery,
            database_name: dbName,
            query_params: [emailUniqueId, email.subject, email.sender, response, email.date, new Date().toISOString()]
        });
        console.log(insertEmail);
        const mailId = emailUniqueId;
        mailIds.push(mailId);
    }
    
    return {
        table_created: true,
        mail_ids: mailIds,
        login_status,
    };
}