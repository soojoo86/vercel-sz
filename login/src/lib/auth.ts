
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from './db';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

export interface User {
  id: number;
  email: string;
}

// 哈希密码
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

// 验证密码
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// 生成 JWT Token
export function generateToken(user: User): string {
  return jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
}

// 验证 JWT Token
export function verifyToken(token: string): User | null {
  try {
    return jwt.verify(token, JWT_SECRET) as User;
  } catch (error) {
    return null;
  }
}

// 注册用户
export async function registerUser(email: string, password: string): Promise<{ success: boolean; message: string; token?: string }> {
  try {
    // 检查用户是否已存在
    const existingUser = await db.execute({
      sql: 'SELECT id FROM users WHERE email = ?',
      args: [email],
    });

    if (existingUser.rows.length > 0) {
      return { success: false, message: 'Email already registered' };
    }

    // 哈希密码并插入新用户
    const passwordHash = await hashPassword(password);
    const result = await db.execute({
      sql: 'INSERT INTO users (email, password_hash) VALUES (?, ?)',
      args: [email, passwordHash],
    });

    const userId = result.lastInsertRowid;
    
    if (typeof userId !== 'number') {
        throw new Error("Failed to get user ID");
    }

    const token = generateToken({ id: userId, email });
    return { success: true, message: 'Registration successful', token };
  } catch (error) {
    console.error('Registration error:', error);
    return { success: false, message: 'Internal server error' };
  }
}

// 登录用户
export async function loginUser(email: string, password: string): Promise<{ success: boolean; message: string; token?: string }> {
  try {
    const result = await db.execute({
      sql: 'SELECT id, email, password_hash FROM users WHERE email = ?',
      args: [email],
    });

    if (result.rows.length === 0) {
      return { success: false, message: 'Invalid credentials' };
    }



// ✅ 正确：获取数组第一个元素
const user = result.rows;

// 增加空值检查，防止用户不存在时报错
if (!user) {
  return { success: false, message: 'Invalid credentials' };
}

const isValid = await verifyPassword(password, user.password_hash as string);





    if (!isValid) {
      return { success: false, message: 'Invalid credentials' };
    }

    const token = generateToken({ id: user.id as number, email: user.email as string });
    return { success: true, message: 'Login successful', token };
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, message: 'Internal server error' };
  }
}
