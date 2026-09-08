
import { createClient, type LibsqlError } from '@libsql/client';
import * as fs from 'fs';
import * as path from 'path';

// ✅ 确保这个接口定义完整，不能漏掉
export interface ConnectionTestResult {
  success: boolean;
  message: string;
  errorCode?: string;
  errorDetails?: string;
  troubleshooting?: string[];
  connectionInfo?: {
    databaseUrl: string;
    hasAuthToken: boolean;
  };
  latency?: string;
  databaseInfo?: {
    sqliteVersion?: string;
    tables?: string[];
    clientVersion?: string;
    nodeVersion?: string;
  };
}

function getClientVersion(): string {
  try {
    const pkgPath = path.join(process.cwd(), 'node_modules', '@libsql', 'client', 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    return pkg.version || 'unknown';
  } catch (e) {
    try {
      const rootPkgPath = path.join(process.cwd(), 'package.json');
      const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf8'));
      return rootPkg.dependencies?.['@libsql/client'] || rootPkg.devDependencies?.['@libsql/client'] || 'unknown';
    } catch (e2) {
      return 'unknown';
    }
  }
}

// ✅ 修复点：Promise 必须带上泛型参数 Promise
export async function testTursoConnection() {
  const databaseUrl = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  const clientVersion = getClientVersion();
  const nodeVersion = process.version;

  if (!databaseUrl) {
    return {
      success: false,
      message: '❌ TURSO_DATABASE_URL 环境变量未配置',
      errorCode: 'MISSING_DATABASE_URL',
      errorDetails: '未找到 TURSO_DATABASE_URL 环境变量',
      troubleshooting: [
        '在 Vercel 项目设置中添加 TURSO_DATABASE_URL 环境变量',
        '格式应为 libsql://your-database-name.turso.io'
      ],
      connectionInfo: {
        databaseUrl: '未配置',
        hasAuthToken: !!authToken
      },
      databaseInfo: {
        clientVersion: clientVersion,
        nodeVersion: nodeVersion
      }
    };
  }

  if (!authToken) {
    return {
      success: false,
      message: '❌ TURSO_AUTH_TOKEN 环境变量未配置',
      errorCode: 'MISSING_AUTH_TOKEN',
      errorDetails: '未找到 TURSO_AUTH_TOKEN 环境变量',
      troubleshooting: [
        '在 Turso Dashboard 生成数据库令牌',
        '在 Vercel 添加 TURSO_AUTH_TOKEN 环境变量'
      ],
      connectionInfo: {
        databaseUrl: databaseUrl,
        hasAuthToken: false
      },
      databaseInfo: {
        clientVersion: clientVersion,
        nodeVersion: nodeVersion
      }
    };
  }

  if (!databaseUrl.startsWith('libsql://') && !databaseUrl.startsWith('https://') && !databaseUrl.startsWith('file:')) {
    return {
      success: false,
      message: '❌ 数据库URL格式无效',
      errorCode: 'URL_INVALID',
      errorDetails: `当前URL: ${databaseUrl}，必须以 libsql://、https:// 或 file: 开头`,
      troubleshooting: [
        '检查 TURSO_DATABASE_URL 协议前缀',
        '从 Turso Dashboard 复制完整连接地址'
      ],
      connectionInfo: {
        databaseUrl: databaseUrl,
        hasAuthToken: true
      },
      databaseInfo: {
        clientVersion: clientVersion,
        nodeVersion: nodeVersion
      }
    };
  }

  const startTime = Date.now();
  let client;

  try {
    client = createClient({
      url: databaseUrl,
      authToken: authToken,
    });

    const result = await client.execute(`SELECT sqlite_version() as version, datetime('now') as now`);
    const latency = Date.now() - startTime;

    const tablesResult = await client.execute(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`);
    const tables = tablesResult.rows.map(row => (row as any).name as string);

    return {
      success: true,
      message: '✅ 成功连接到 Turso 数据库',
      connectionInfo: {
        databaseUrl: databaseUrl,
        hasAuthToken: true
      },
      latency: `${latency}ms`,
      databaseInfo: {
        sqliteVersion: (result.rows as any[])?.version as string || 'unknown',
        tables: tables.length > 0 ? tables : ['数据库中暂无表'],
        clientVersion: clientVersion,
        nodeVersion: nodeVersion
      }
    };

  } catch (error) {
    const libsqlError = error as LibsqlError;
    const latency = Date.now() - startTime;

    let errorMessage = '未知连接错误';
    let troubleshooting: string[] = [];

    if (libsqlError.message?.includes('migration jobs') || (libsqlError.code === 'UNKNOWN' && latency < 2000)) {
      errorMessage = '迁移作业检查失败（版本兼容性问题）';
      troubleshooting = [
        `当前 @libsql/client 版本: ${clientVersion}，请升级到最新版`,
        '运行: npm install @libsql/client@latest',
        '重新生成全权限 Auth Token'
      ];
    } else {
      switch (libsqlError.code) {
        case 'URL_INVALID':
          errorMessage = '数据库URL格式无效';
          troubleshooting = ['检查URL是否以 libsql:// 开头'];
          break;
        case 'AUTH_FAILED':
          errorMessage = '身份验证失败';
          troubleshooting = ['检查 TURSO_AUTH_TOKEN 是否正确', '令牌可能已过期'];
          break;
        default:
          errorMessage = libsqlError.message || '连接失败';
          troubleshooting = ['检查环境变量配置', '查看函数日志获取详细信息'];
      }
    }

    return {
      success: false,
      message: `❌ 连接失败: ${errorMessage}`,
      errorCode: libsqlError.code || 'UNKNOWN_ERROR',
      errorDetails: libsqlError.message,
      troubleshooting: troubleshooting,
      connectionInfo: {
        databaseUrl: databaseUrl,
        hasAuthToken: true
      },
      latency: `${latency}ms`,
      databaseInfo: {
        clientVersion: clientVersion,
        nodeVersion: nodeVersion
      }
    };
  } finally {
    if (client) {
      try {
        await client.close();
      } catch (e) {}
    }
  }
}

