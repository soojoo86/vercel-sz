
import { pool } from './db'; // 假设你的数据库连接
import { compare } from 'bcryptjs'; // 假设使用 bcryptjs

export async function loginUser(email: string, password: string) {
  try {
    // 执行查询
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

    // 获取第一个用户对象
    const user = result.rows;

    // 如果没找到用户，直接返回失败
    if (!user) {
      return { success: false, message: 'Invalid credentials' };
    }

    // 验证密码
    // 注意：确保数据库中的 password_hash 字段存在
    const isValid = await compare(password, user.password_hash);

    if (!isValid) {
      return { success: false, message: 'Invalid credentials' };
    }

    // 登录成功，返回用户信息（不包含密码哈希）
    return {
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        // ...其他需要返回的字段
      }
    };

  } catch (error) {
    console.error('Login error:', error);
    return { success: false, message: 'Internal server error' };
  }
}

