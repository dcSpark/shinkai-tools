
import type { Context } from 'hono';
import type { PrivyUser } from '../types/index.js';
import Privy from '../libs/privy.js';
import Database from '../libs/database.js';
import logger from '../libs/logger.js';

enum Texts {
    Unauthorized = 'You do not have permission to access this resource.',
    InternalServerError = 'Internal server error.',
}

class Users {
    private privy: Privy;
    private db: Database;

    constructor() {
        this.privy = new Privy();
        this.db = new Database();
    }

    public async getMe(c: Context): Promise<any> {
        const auth = c.req.header('Authorization');
        if (!auth || !(await this.privy.verifyAuthToken(auth))) {
            return c.json({ message: Texts.Unauthorized }, { status: 401 });
        }

        try {
            const user: PrivyUser = await this.privy.getUser(auth);
            return c.json(user, { status: 200 });
        } catch (e: any) {
            return c.json({
                message: Texts.InternalServerError,
                error: process.env.NODE_ENV === 'development' ? e.message : ''
            }, { status: 500 });
        }
    }

    public async updateUser(c: Context) {
        const auth = c.req.header('Authorization');
        const data = await c.req.json();
        if (!auth || !(await this.privy.verifyAuthToken(auth))) {
            return c.json({ message: Texts.Unauthorized }, { status: 401 });
        }

        try {
            const user = await this.privy.getUser(auth);
            const metadata = await this.privy.setCustomMetadata(user.id, data.customMetadata);
            const dbUser = await this.db.getUser(user.id);
            
            const privyUser = {
                id: user.id,
                email: user.email?.address || '',
                name: user.customMetadata?.name || '',
                phone: user.phone?.number || '',
                wallet: user.wallet || '',
            };

            if (!dbUser) await this.db.createUser(privyUser);
            else await this.db.updateUser(privyUser);

            return c.json(metadata, { status: 200 });
        } catch (e: any) {
            logger.error(e, "Error");
            return c.json({
                message: Texts.InternalServerError,
                error: process.env.NODE_ENV === 'development' ? e.message : ''
            }, { status: 500 });
        } 
    }

}

export default Users;