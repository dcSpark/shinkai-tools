import type { Context } from 'hono';
import type { Product } from '../types/shinkai_db.js';
import Privy from '../libs/privy.js';
import Database from '../libs/database.js';
class Store {
    private privy: Privy;
    private db: Database;

    constructor() {
        this.privy = new Privy();
        this.db = new Database();
    }

    public async listProducts(c: Context) {
        const auth = c.req.header('Authorization')?.startsWith('Bearer ') 
          ? c.req.header('Authorization')?.replace('Bearer ', '')
          : c.req.header('Authorization');
  
        if (!auth || !(await this.privy.verifyAuthToken(auth))) {
          return c.text('Unauthorized', { status: 401 });
        }

        const page = Number(c.req.query('page')) || 1;
        const limit = Number(c.req.query('limit')) || 10;
        const search = c.req.query('search');

        const products = await this.db.getProducts(page, limit, search);
        
        return c.json(products, { status: 200 });
    }

    public async createProduct(c: Context) {
        const auth = c.req.header('Authorization')?.startsWith('Bearer ') 
          ? c.req.header('Authorization')?.replace('Bearer ', '')
          : c.req.header('Authorization');

        if (!auth || !(await this.privy.verifyAuthToken(auth))) {
            return c.text('Unauthorized', { status: 401 });
        }

        const product: Product = await c.req.json();
        const insertedProduct = await this.db.createProduct(product);

        if (insertedProduct.rowCount && insertedProduct.rowCount > 0) {
            return c.json(product, { status: 200 });
        } else {
            return c.text('Failed to create product', { status: 500 });
        }
    }
}

export default Store;
