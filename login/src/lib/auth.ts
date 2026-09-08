
// src/lib/auth.ts

import { db } from './db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

interface AuthResponse {
  success: boolean;
  message: string;
  token?: string;
  user?: {
    id: number;
    email: string;
    //name?: string;
  };
}

interface DbUser {
  id: number;
  email: string;
  password_hash: string;
  //name?: string;
}

export async function registerUser(email: string, password: string): Promise<AuthResponse> {
//export async function registerUser(email: string, password: string, name: string): Promise<AuthResponse> {
  try {
    const existing = await db.execute({
      sql: 'SELECT * FROM users WHERE email = ?',
      args: [email],
    });

    if (existing.rows.length > 0) {
      return { success: false, message: 'User already exists' };
    }

    const password_hash = await bcrypt.hash(password, 10);

    await db.execute({
      sql: 'INSERT INTO users (email, password_hash) VALUES (?, ?)',
      //sql: 'INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)',
      args: [email, password_hash],
      //args: [email, password_hash, name],
    });

    return { success: true, message: 'Registration successful' };
  } catch (error) {
    console.error('Register error:', error);
    return { success: false, message: 'Internal server error-register' };
  }
}

export async function loginUser(email: string, password: string): Promise<AuthResponse> {
  try {
    // 1. 执行查询
    const result = await db.execute({
      sql: 'SELECT * FROM users WHERE email = ?',
      args: [email],
    });

    // 2. 【关键修复】先检查数组长度，再取第一个元素
    if (result.rows.length === 0) {
      return { success: false, message: 'Invalid credentials' };
    }

    // 3. 安全地获取第一个用户对象并转换类型
    // 此时 rows 肯定存在，我们将其断言为 DbUser
    const user = result.rows as unknown as DbUser;

    // 4. 验证密码
    // 注意：确保 user.password_hash 存在，防止数据库字段为空导致 bcrypt 报错
    if (!user.password_hash) {
       return { success: false, message: 'Invalid credentials' };
    }

    const isValid = await bcrypt.compare(password, user.password_hash);

    if (!isValid) {
      return { success: false, message: 'Invalid credentials' };
    }

    // 5. 生成 Token
    // 建议在生产环境中确保 JWT_SECRET 已设置，否则使用 fallback 会有安全风险
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.warn('JWT_SECRET is not set, using fallback. This is insecure for production.');
    }

    const token = jwt.sign(
      { id: user.id, email: user.email },
      secret || 'fallback_secret_do_not_use_in_prod',
      { expiresIn: '7d' }
    );

    return {
      success: true,
      message: 'Login successful',
      token: token,
      user: {
        id: user.id,
        email: user.email,
        //name: user.name,
      }
    };
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, message: 'Internal server error2' };
  }
}

export function verifyToken(token: string) {
  try {
    const secret = process.env.JWT_SECRET || 'fallback_secret_do_not_use_in_prod';
    const decoded = jwt.verify(token, secret);
    return { success: true, data: decoded };
  } catch (error) {
    return { success: false, message: 'Invalid token' };
  }
}

