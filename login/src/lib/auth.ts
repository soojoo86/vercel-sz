
import { pool } from './db';
import { compare } from 'bcryptjs';

// 定义用户接口
interface DbUser {
  id: number;
  email: string;
  password_hash: string;
  name: string;
}

export async function loginUser(email: string, password: string) {
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

    // 【关键】获取数组第一个元素并断言类型
    const user = result.rows as DbUser | undefined;

    // 【关键】检查用户是否存在
    if (!user) {
      return { success: false, message: 'Invalid credentials' };
    }

    // 【关键】现在可以安全访问 password_hash
    const isValid = await compare(password, user.password_hash);

    if (!isValid) {
      return { success: false, message: 'Invalid credentials' };
    }

    return {
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    };

  } catch (error) {
    console.error('Login error:', error);
    return { success: false, message: 'Internal server error' };
  }
}

