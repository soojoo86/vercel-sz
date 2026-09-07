
// src/lib/auth.ts

import { db } from './db'; // 确保路径正确
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// 定义用户类型
interface DbUser {
  id: number;
  email: string;
  password_hash: string;
  name?: string;
}

// 1. 导出 registerUser 函数
export async function registerUser(email: string, password: string, name: string) {
  try {
    // 检查用户是否已存在
    const existingUser = await db.execute({
      sql: 'SELECT * FROM users WHERE email = ?',
      args: [email],
    });

    if (existingUser.rows.length > 0) {
      return { success: false, message: 'User already exists' };
    }

    // 哈希密码
    const password_hash = await bcrypt.hash(password, 10);

    // 插入新用户
    await db.execute({
      sql: 'INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)',
      args: [email, password_hash, name],
    });

    return { success: true, message: 'User registered successfully' };
  } catch (error) {
    console.error('Registration error:', error);
    return { success: false, message: 'Internal server error' };
  }
}

// 2. 导出 loginUser 函数 (之前修复过的)
export async function loginUser(email: string, password: string) {
  try {
    const result = await db.execute({
      sql: 'SELECT * FROM users WHERE email = ?',
      args: [email],
    });

    const user = result.rows as DbUser | undefined;

    if (!user) {
      return { success: false, message: 'Invalid credentials' };
    }

    const isValid = await bcrypt.compare(password, user.password_hash);

    if (!isValid) {
      return { success: false, message: 'Invalid credentials' };
    }

    // 生成 Token
    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '7d' }
    );

    return {
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    };
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, message: 'Internal server error' };
  }
}

// 3. 导出 verifyToken 函数
export function verifyToken(token: string) {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    return { success: true, data: decoded };
  } catch (error) {
    return { success: false, message: 'Invalid or expired token' };
  }
}

