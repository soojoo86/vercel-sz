// console.log("AUTH_SECRET:", process.env.AUTH_SECRET);

import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { getDb } from './db';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email('邮箱格式不正确'),
  password: z.string().min(6, '密码至少6位'),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET,
  providers: [
    Credentials({
      credentials: {
        email: { label: '邮箱', type: 'email' },
        password: { label: '密码', type: 'password' },
      },
      async authorize(credentials) {
        const validated = loginSchema.safeParse(credentials);
        if (!validated.success) {
          return null;
        }

        const { email, password } = validated.data;
        const db = getDb();

        try {
          const result = await db.execute({
            sql: 'SELECT id, email, name, password_hash FROM users WHERE email = ?',
            args: [email],
          });

          const user = result.rows[0];
          if (!user) {
            return null;
          }

          const passwordMatch = await bcrypt.compare(
            password,
            user.password_hash as string
          );

          if (!passwordMatch) {
            return null;
          }

          return {
            id: user.id as string,
            email: user.email as string,
            name: user.name as string | null,
          };
        } catch (error) {
          console.error('认证错误:', error);
          return null;
        }
      },
    }),
  ],
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
      }
      return session;
    },
  },
});

