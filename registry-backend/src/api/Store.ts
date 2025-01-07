import type { Context } from 'hono';
import Privy from '../libs/privy.js';

class Store {
    private privy: Privy;

    constructor() {
        this.privy = new Privy();
    }

    public async getStore(c: Context) {
        const auth = c.req.header('Authorization');
  
        if (!auth || !(await this.privy.verifyAuthToken(auth))) {
          return c.text('Unauthorized', { status: 401 });
        }
        
        return c.text('Store', { status: 200 });
    }
}

export default Store;