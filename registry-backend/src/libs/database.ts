import pg from 'pg';
import logger from './logger.js';
import type { User, Product, Order } from '../types/index.js';

class ShinkaiStoreDatabase {
  private static db: pg.Pool;

  constructor() {
    if (!ShinkaiStoreDatabase.db) {
      ShinkaiStoreDatabase.db = new pg.Pool({
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        port: Number(process.env.DB_PORT)
      });

      ShinkaiStoreDatabase.db.query(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT NULL,
          name TEXT NULL,
          phone TEXT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
          wallet JSONB NULL
        )
      `);
  
      ShinkaiStoreDatabase.db.query(`
        CREATE TABLE IF NOT EXISTS products (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          author TEXT NOT NULL,
          description TEXT NOT NULL,
          type TEXT NOT NULL,
          tool_language TEXT NOT NULL,
          version TEXT NOT NULL,
          router_key TEXT NOT NULL,
          hash TEXT NOT NULL,
          file TEXT NOT NULL,
          is_default BOOLEAN NOT NULL DEFAULT false,
          keywords TEXT[] NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
        )
      `);
  
      ShinkaiStoreDatabase.db.query(`
        CREATE TABLE IF NOT EXISTS orders (
          id TEXT PRIMARY KEY,
          user_id TEXT REFERENCES users(id),
          product_id TEXT REFERENCES products(id),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
        )
      `);
    }
  }

  // Users (Customers)
  public async createUser(user: User): Promise<Boolean> {  
    try {
      const userQuery = await ShinkaiStoreDatabase.db.query(`INSERT INTO users (id, email, name, phone, wallet) 
        VALUES ($1, $2, $3, $4, $5)`, [
        user.id,
        user.email,
        user.name,
        user.phone,
        JSON.stringify(user.wallet)
      ]);

      return (userQuery?.rowCount ?? 0) > 0;
    } catch (error) {
      logger.error(error, "Error creating user");
      return false;
    }
  }
  
  public async getUser(id: string): Promise<User> {
    const userQuery = await ShinkaiStoreDatabase.db.query('SELECT * FROM users WHERE id = $1', [id]);
    return userQuery.rows[0];
  }

  public async updateUser(user: User): Promise<User> {
    const query = 'UPDATE users SET email = $2, name = $3, phone = $4, wallet = $5 WHERE id = $1';
    const updateQuery = await ShinkaiStoreDatabase.db.query(query, [user.id, user.email, user.name, user.phone, JSON.stringify(user.wallet)]);
    return updateQuery.rows[0]
  }

  // Orders (Purchases)
  public async createOrder(order: Order) {
    return await ShinkaiStoreDatabase.db.query(`
      INSERT INTO orders (id, user_id, product_id) VALUES (${order.id}, ${order.user_id}, ${order.product_id})
    `);
  }

  public async getOrder(id: string) {
    const order = await ShinkaiStoreDatabase.db.query(`SELECT * FROM orders WHERE id = ${id}`);
    return order;
  }

  public async getOrdersByUser(userId: string) {
    const orders = await ShinkaiStoreDatabase.db.query(`SELECT * FROM orders WHERE user_id = ${userId}`);
    return orders;
  }

  public async getOrdersByProduct(productId: string) {
    const orders = await ShinkaiStoreDatabase.db.query(`SELECT * FROM orders WHERE product_id = ${productId}`);
    return orders;
  }

  // Products (Tools)
  public async getProducts(page: number = 1, limit: number = 10, search?: string) {
    const offset = (page - 1) * limit;
    let query = 'SELECT * FROM products';
    let countQuery = 'SELECT COUNT(*) FROM products';
    const queryParams = [];
    
    if (search) {
      const searchCondition = `
        WHERE name ILIKE $1 
        OR description ILIKE $1
        OR keywords ILIKE $1
      `;
      query += searchCondition;
      countQuery += searchCondition;
      queryParams.push(`%${search}%`);
    }

    query += ' LIMIT $' + (queryParams.length + 1) + ' OFFSET $' + (queryParams.length + 2);
    queryParams.push(limit, offset);

    const products = await ShinkaiStoreDatabase.db.query(query, queryParams);
    const totalCount = await ShinkaiStoreDatabase.db.query(countQuery, search ? [`%${search}%`] : []);

    return {
      products: products.rows,
      total: parseInt(totalCount.rows[0].count),
      page,
      limit,
      totalPages: Math.ceil(parseInt(totalCount.rows[0].count) / limit)
    };
  }

  public async createProduct(product: Product) {
    // Validate required parameters
    if (!product.id || !product.name) {
      throw new Error('Product id and name are required');
    }

    const query = `
      INSERT INTO products (
        id, name, author, description, type, tool_language, 
        version, router_key, hash, file, is_default, keywords
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
      )
    `;

    const values = [
      product.id,
      product.name,
      product.author,
      product.description, 
      product.type,
      product.tool_language,
      product.version,
      product.router_key,
      product.hash,
      product.file,
      product.is_default || false,
      product.keywords
    ];

    return await ShinkaiStoreDatabase.db.query(query, values);
  }
}

export default ShinkaiStoreDatabase;
