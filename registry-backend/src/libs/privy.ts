import { PrivyClient } from '@privy-io/server-auth';
import logger from './logger.js';
import type { PrivyUser } from '../types/index.js';

class Privy {
    private privy: PrivyClient;

    constructor() {
        this.privy = new PrivyClient(
            process.env.PRIVY_APP_ID!, // app id
            process.env.PRIVY_APP_SECRET! // app secret
        );
    }

    public async verifyAuthToken(token: string): Promise<Boolean> {
        try {
            await this.privy.verifyAuthToken(token);
            return true;
        } catch (e: any) {
            logger.error(e, "Error verifying auth token");
            return false;
        }
    }

    public async getUser(token: string): Promise<PrivyUser> {
        try {
            return await this.privy.getUser({ idToken: token });
        } catch (e: any) {
            logger.error(e, "Error getting user.");
            throw e;
        }
    }

    public async setCustomMetadata(userId: string, data: any): Promise<PrivyUser | null> {
        try {
            return await this.privy.setCustomMetadata(userId, data);
        } catch (e: any) {
            logger.error(e, "Error setting custom metadata.");
            throw e;
        }
    }
}

export default Privy;
