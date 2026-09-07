
import { db } from './db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// 1. 定义统一的返回类型接口，解决 TypeScript 联合类型推断问题
interface AuthResponse {
  success: boolean;
  message: string;
  token?: string; // token 是可选的，只在登录成功时存在
  user?: {
    id: number;
    email: string;
    name?: string;
  };
}

// 2. 导出 registerUser 函数
export async function registerUser(email: string, password: string, name: string): Promise<AuthResponse> {
  try {
    // 检查用户是否已存在
    const existing = await db.execute({
      sql: 'SELECT * FROM users WHERE email = ?',
      args: [email],
    });

    if (existing.rows.length > 0) {
      return { success: false, message: 'User already exists' };
    }

    // 哈希密码
    const password_hash = await bcrypt.hash(password, 10);

    // 插入用户
    await db.execute({
      sql: 'INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)',
      args: [email, password_hash, name],
    });

    return { success: true, message: 'Registration successful' };
  } catch (error) {
    console.error('Register error:', error);
    return { success: false, message: 'Internal server error' };
  }
}

// 3. 导出 loginUser 函数
export async function loginUser(email: string, password: string): Promise<AuthResponse> {
  try {
    const result = await db.execute({
      sql: 'SELECT * FROM users WHERE email = ?',
      args: [email],
    });

    const user = result.rows as { id: number; email: string; password_hash: string; name?: string } | undefined;

    if (!user) {
      return { success: false, message: 'Invalid credentials' };
    }

    const isValid = await bcrypt.compare(password, user.password_hash);

    if (!isValid) {
      return { success: false, message: 'Invalid credentials' };
    }

    // 生成 JWT Token
    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '7d' }
    );

    // 【关键】成功时明确返回 token
    return {
      success: true,
      message: 'Login successful',
      token: token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      }
    };
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, message: 'Internal server error' };
  }
}

// 4. 导出 verifyToken 函数 (供 middleware 或 /me 接口使用)
export function verifyToken(token: string) {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    return { success: true, data: decoded };
  } catch (error) {
    return { success: false, message: 'Invalid token' };
  }
}

