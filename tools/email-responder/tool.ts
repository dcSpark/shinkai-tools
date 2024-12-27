import { emailImapFetcher, emailSender, shinkaiSqliteQueryExecutor, shinkaiLlmPromptProcessor } from './shinkai-local-tools.ts';

type CONFIG = {
    smtp_server: string;
    smtp_port: number;
    smtp_sender_email: string;
    smtp_sender_password: string;
    imap_server: string;
    imap_port: number;
    imap_username: string;
    imap_password: string;
    response_context: string;
};

type INPUTS = {};

type OUTPUT = {
    table_created: boolean;
    mail_ids: string[];
};

export async function run(config: CONFIG, _inputs: INPUTS): Promise<OUTPUT> {
    const dbName = 'default';
    const tableName = 'answered_emails';

    const createTableQuery = `
        CREATE TABLE IF NOT EXISTS ${tableName} (
            id SERIAL PRIMARY KEY,
            subject TEXT NOT NULL,
            email TEXT NOT NULL,
            response TEXT NOT NULL,
            received_date DATETIME NOT NULL,
            response_date DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `;

    await shinkaiSqliteQueryExecutor({ query: createTableQuery, database_name: dbName },{});

    const { emails } = await emailImapFetcher({},{
        imap_server: config.imap_server,
        username: config.imap_username,
        password: config.imap_password,
        port: config.imap_port
    },1,{});
    const answeredEmailsQuery = await shinkaiSqliteQueryExecutor({
        query: `SELECT * FROM ${tableName}`,
        database_name: dbName
    },{});
    const answeredEmails = answeredEmailsQuery?.result ?? [];
    const mailIds = [];
    for (const email of emails) {
      if (email.subject && answeredEmails.find((answeredEmail: any) => answeredEmail.subject === email.subject)) {
        continue;
      }
      const { message: response } = await shinkaiLlmPromptProcessor({
        format: 'text',
        prompt: `Please respond to the following email:
        <email>
          ${email}
        </email>
        Given the following context:
        <context>
          ${config.response_context}
        </context>`,
      });
      await emailSender({
        recipient_email: email.from,
        subject: 'Re: ' + email.subject,
        body: response
      },{
        smtp_server: config.smtp_server,
        port: config.smtp_port,
        sender_email: config.smtp_sender_email,
        sender_password: config.smtp_sender_password
      });
      const insertMailIdQuery = `
        INSERT INTO ${tableName} (subject, email, response, received_date, response_date) 
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(subject) DO NOTHING;
      `;
      const inserEmail = await shinkaiSqliteQueryExecutor({
        query: insertMailIdQuery,
        database_name: dbName,
        query_params: [email.subject, email.from, response, email.date, new Date().toISOString()]
      },{});
      const mailId = inserEmail?.result?.id ?? [];
      mailIds.push(mailId);
    }
    return {
        table_created: true,
        mail_ids: mailIds,
    };
}

// TODO : Import email tools to shinkai node
// TODO : Solve issue with sql query executor
// TODO : Be sure to leave the debugger running
// TODO : Add a way to check if the email has been answered with the received date
// TODO : Test the tool with a real email account
// TODO : Implement as a CRON job