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
          name TEXT,
          description TEXT,
          price INTEGER,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
        )
      `);
  
      ShinkaiStoreDatabase.db.query(`
        CREATE TABLE IF NOT EXISTS orders (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          product_id TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
        )
      `);
    }
  }

  // Users (Customers)
  public async createUser(user: User) {
    const query = `
      INSERT INTO users (id, email, name, phone, wallet) 
      VALUES ($1, $2, $3, $4, $5)
    `;
    
    return await ShinkaiStoreDatabase.db.query(query, [
      user.id,
      user.email,
      user.name,
      user.phone,
      JSON.stringify(user.wallet)
    ]);
  }
  
  public async getUser(id: string) {
    const user = await ShinkaiStoreDatabase.db.query('SELECT * FROM users WHERE id = $1', [id]);
    return user;
  }

  public async updateUser(user: User) {
    const query = `
      UPDATE users SET email = $2, name = $3, phone = $4, wallet = $5 WHERE id = $1
    `;
    return await ShinkaiStoreDatabase.db.query(query, [user.id, user.email, user.name, user.phone, JSON.stringify(user.wallet)]);
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
  public async createProduct(product: Product) {
    return await ShinkaiStoreDatabase.db.query(`
      INSERT INTO products (id, name, description, price) VALUES (${product.id}, ${product.name}, ${product.description}, ${product.price})
    `);
  }

  public async getProduct(id: string) {
    const product = await ShinkaiStoreDatabase.db.query(`SELECT * FROM products WHERE id = ${id}`);
    return product;
  }

  public async getProducts(page: number = 1, limit: number = 10) {
    const products = await ShinkaiStoreDatabase.db.query(`SELECT * FROM products LIMIT ${limit} OFFSET ${page}`);
    return products;
  }
}

export default ShinkaiStoreDatabase;
