import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';

export interface User {
  id: string;
  email?: string;
  ip_address: string;
  created_at: string;
  updated_at: string;
  is_premium: boolean;
  premium_expires_at?: string;
  stripe_customer_id?: string;
  total_queries: number;
  queries_today: number;
  last_query_date: string;
}

export interface Usage {
  id: string;
  user_id: string;
  query_text: string;
  response_text: string;
  provider: 'openai' | 'anthropic' | 'local';
  cost: number;
  tokens_used: number;
  created_at: string;
  ip_address: string;
  success: boolean;
  error_message?: string;
}

export interface Payment {
  id: string;
  user_id: string;
  stripe_payment_id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  queries_purchased: number;
  created_at: string;
}

export class Database {
  private static db: sqlite3.Database;
  private static initialized = false;

  static async initialize(): Promise<void> {
    if (this.initialized) return;

    const dbPath = process.env.DB_PATH || path.join(__dirname, '../../data/database.sqlite');
    
    // Ensure data directory exists
    await fs.mkdir(path.dirname(dbPath), { recursive: true });

    this.db = new sqlite3.Database(dbPath);
    
    // Enable foreign keys
    await this.run('PRAGMA foreign_keys = ON');
    
    // Run migrations
    await this.createTables();
    
    this.initialized = true;
  }

  private static async createTables(): Promise<void> {
    // Users table
    await this.run(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE,
        ip_address TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_premium BOOLEAN DEFAULT FALSE,
        premium_expires_at DATETIME,
        stripe_customer_id TEXT,
        total_queries INTEGER DEFAULT 0,
        queries_today INTEGER DEFAULT 0,
        last_query_date DATE DEFAULT CURRENT_DATE
      )
    `);

    // Usage tracking table
    await this.run(`
      CREATE TABLE IF NOT EXISTS usage (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        query_text TEXT NOT NULL,
        response_text TEXT NOT NULL,
        provider TEXT NOT NULL CHECK (provider IN ('openai', 'anthropic', 'local')),
        cost REAL DEFAULT 0,
        tokens_used INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        ip_address TEXT NOT NULL,
        success BOOLEAN DEFAULT TRUE,
        error_message TEXT,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      )
    `);

    // Payments table
    await this.run(`
      CREATE TABLE IF NOT EXISTS payments (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        stripe_payment_id TEXT UNIQUE NOT NULL,
        amount REAL NOT NULL,
        currency TEXT DEFAULT 'usd',
        status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
        queries_purchased INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      )
    `);

    // Create indexes for performance
    await this.run('CREATE INDEX IF NOT EXISTS idx_users_ip ON users (ip_address)');
    await this.run('CREATE INDEX IF NOT EXISTS idx_users_email ON users (email)');
    await this.run('CREATE INDEX IF NOT EXISTS idx_usage_user_id ON usage (user_id)');
    await this.run('CREATE INDEX IF NOT EXISTS idx_usage_created_at ON usage (created_at)');
    await this.run('CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments (user_id)');
  }

  // Helper methods
  private static run(sql: string, params: any[] = []): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  private static get<T>(sql: string, params: any[] = []): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row as T | undefined);
      });
    });
  }

  private static all<T>(sql: string, params: any[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows as T[]);
      });
    });
  }

  // User management
  static async createUser(data: Partial<User>): Promise<User> {
    const id = data.id || uuidv4();
    const now = new Date().toISOString();
    
    await this.run(`
      INSERT INTO users (id, email, ip_address, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `, [id, data.email || null, data.ip_address, now, now]);

    return this.getUserById(id) as Promise<User>;
  }

  static async getUserById(id: string): Promise<User | undefined> {
    return this.get<User>('SELECT * FROM users WHERE id = ?', [id]);
  }

  static async getUserByIP(ip: string): Promise<User | undefined> {
    return this.get<User>('SELECT * FROM users WHERE ip_address = ?', [ip]);
  }

  static async getUserByEmail(email: string): Promise<User | undefined> {
    return this.get<User>('SELECT * FROM users WHERE email = ?', [email]);
  }

  static async updateUser(id: string, data: Partial<User>): Promise<void> {
    const fields = Object.keys(data).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(data), new Date().toISOString(), id];
    
    await this.run(`
      UPDATE users SET ${fields}, updated_at = ? WHERE id = ?
    `, values);
  }

  static async incrementUserQueries(userId: string): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    
    await this.run(`
      UPDATE users 
      SET 
        total_queries = total_queries + 1,
        queries_today = CASE 
          WHEN last_query_date = ? THEN queries_today + 1 
          ELSE 1 
        END,
        last_query_date = ?
      WHERE id = ?
    `, [today, today, userId]);
  }

  // Usage tracking
  static async createUsage(data: Partial<Usage>): Promise<void> {
    const id = uuidv4();
    
    await this.run(`
      INSERT INTO usage (
        id, user_id, query_text, response_text, provider,
        cost, tokens_used, ip_address, success, error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, data.user_id, data.query_text, data.response_text,
      data.provider, data.cost || 0, data.tokens_used || 0,
      data.ip_address, data.success !== false, data.error_message || null
    ]);
  }

  static async getUserUsage(userId: string, limit = 50): Promise<Usage[]> {
    return this.all<Usage>(`
      SELECT * FROM usage 
      WHERE user_id = ? 
      ORDER BY created_at DESC 
      LIMIT ?
    `, [userId, limit]);
  }

  static async getUsageStats(): Promise<any> {
    const totalQueries = await this.get<{count: number}>('SELECT COUNT(*) as count FROM usage');
    const todayQueries = await this.get<{count: number}>(`
      SELECT COUNT(*) as count FROM usage 
      WHERE DATE(created_at) = DATE('now')
    `);
    const totalCost = await this.get<{total: number}>('SELECT SUM(cost) as total FROM usage');
    const successRate = await this.get<{rate: number}>(`
      SELECT 
        CAST(SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) AS REAL) / COUNT(*) * 100 as rate
      FROM usage
    `);

    return {
      totalQueries: totalQueries?.count || 0,
      todayQueries: todayQueries?.count || 0,
      totalCost: totalCost?.total || 0,
      successRate: successRate?.rate || 0
    };
  }

  // Payment management
  static async createPayment(data: Partial<Payment>): Promise<void> {
    const id = uuidv4();
    
    await this.run(`
      INSERT INTO payments (
        id, user_id, stripe_payment_id, amount, currency,
        status, queries_purchased
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      id, data.user_id, data.stripe_payment_id, data.amount,
      data.currency || 'usd', data.status || 'pending', data.queries_purchased
    ]);
  }

  static async updatePaymentStatus(stripePaymentId: string, status: string): Promise<void> {
    await this.run(`
      UPDATE payments SET status = ? WHERE stripe_payment_id = ?
    `, [status, stripePaymentId]);
  }

  static async getPaymentByStripeId(stripePaymentId: string): Promise<Payment | undefined> {
    return this.get<Payment>(`
      SELECT * FROM payments WHERE stripe_payment_id = ?
    `, [stripePaymentId]);
  }

  // Cleanup old data
  static async cleanupOldData(): Promise<void> {
    // Delete usage records older than 90 days
    await this.run(`
      DELETE FROM usage 
      WHERE created_at < datetime('now', '-90 days')
    `);

    // Delete expired premium users with no recent activity
    await this.run(`
      UPDATE users 
      SET is_premium = FALSE 
      WHERE is_premium = TRUE 
        AND premium_expires_at < datetime('now')
    `);
  }
}