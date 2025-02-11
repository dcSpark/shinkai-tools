import { downloadPages } from './shinkai-local-tools.ts';
import { shinkaiLlmPromptProcessor } from './shinkai-local-tools.ts';
import { shinkaiSqliteQueryExecutor } from './shinkai-local-tools.ts';

type CONFIG = {};
type INPUTS = { action: 'learn' | 'ask' | 'respond', url?: string, userResponse?: string, questionId?: number };
type OUTPUT = { message: string };

export async function run(_config: CONFIG, inputs: INPUTS): Promise<OUTPUT> {
    // Create the questions table if it doesn't exist
    await shinkaiSqliteQueryExecutor({
        query: `CREATE TABLE IF NOT EXISTS Questions (
            ID INTEGER PRIMARY KEY AUTOINCREMENT,
            Question TEXT NOT NULL,
            Answer TEXT NOT NULL,
            CorrectCount INTEGER DEFAULT 0,
            IncorrectCount INTEGER DEFAULT 0
        );`
    });

    if (inputs.action === 'learn' && inputs.url) {
        const { url } = inputs;
        const downloadResult = await downloadPages({ url });
        const markdownContent = downloadResult.markdown; // Assuming this is the returned markdown content

        // Generate questions and answers from markdown content
        const llmResponse = await shinkaiLlmPromptProcessor({
            prompt: `Generate questions and answers from the following content:\n\n${markdownContent}\n\nFormat your output as a JSON array of objects with "question" and "answer" keys without any formatting.`,
            format: 'json'
        });
        
        let i = 0;
        for (const pair of JSON.parse(llmResponse.message)) {
            const question = pair.question.trim();
            const answer = pair.answer.trim();
            console.log(i, question, answer);
            i = i + 1;
            if (question.length > 0 && answer.length > 0) {
                await shinkaiSqliteQueryExecutor({
                    query: `INSERT INTO Questions (Question, Answer) VALUES (?, ?)`,
                    params: [pair.question.trim(), pair.answer.trim()]
                });
                await shinkaiSqliteQueryExecutor({
                    query: `DELETE FROM Questions WHERE Question = '';`
                });
            }
        }
        
        return { message: "Learning completed and questions stored." };
        
    } else if (inputs.action === 'ask') {
        const result = await shinkaiSqliteQueryExecutor({
            query: `SELECT * FROM Questions ORDER BY CorrectCount ASC LIMIT 10`
        });
        const questions = result.result;
        if (questions.length === 0) {
            return { message: "No questions available." };
        }
        const randomQuestion = questions[Math.floor(Math.random() * questions.length)];
        return { message: `Question #${randomQuestion.ID}: ${randomQuestion.Question}?` };
        
    } else if (inputs.action === 'respond' && inputs.userResponse && inputs.questionId) {
        const questionId = Number(inputs.questionId);
        const result = await shinkaiSqliteQueryExecutor({
            query: `SELECT * FROM Questions WHERE ID = ${questionId}`,
            params: []
        });

        const question = result.result[0];
        
        if (!question) {
            return { message: "Question not found." };
        }
      
        const llmResponse = await shinkaiLlmPromptProcessor({
            prompt: `Check if the response ${inputs.userResponse} is an adecuate response to the question ${question.Answer}. Return CORRECT if it's correct, or INCORRECT if it's incorrect inside a JSON object with key result without any formatting, just RAW JSON.`,
            format: 'json'
        });
        
        console.log(inputs.questionId, question, llmResponse);
        
        const llmAnswer = JSON.parse(llmResponse.message);
        
        if (llmAnswer.result === "CORRECT") {
            await shinkaiSqliteQueryExecutor({
                query: `UPDATE Questions SET CorrectCount = CorrectCount + 1 WHERE ID = ${questionId}`,
                params: []
            });
            return { message: "CORRECT" };
        } else {
            await shinkaiSqliteQueryExecutor({
                query: `UPDATE Questions SET IncorrectCount = IncorrectCount + 1 WHERE ID = ${questionId}`,
                params: []
            });
            return { message: "INCORRECT" };
        }
    }

    return { message: "Invalid action." };
}
