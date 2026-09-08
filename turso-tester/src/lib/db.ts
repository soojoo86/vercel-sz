import { createClient, type LibsqlError } from '@libsql/client';

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
  };
}

export async function testTursoConnection(): Promise<ConnectionTestResult> {
  const databaseUrl = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  // 第一步：检查环境变量是否存在
  if (!databaseUrl) {
    return {
      success: false,
      message: '❌ TURSO_DATABASE_URL 环境变量未配置',
      errorCode: 'MISSING_DATABASE_URL',
      errorDetails: '未找到 TURSO_DATABASE_URL 环境变量，无法建立数据库连接',
      troubleshooting: [
        '在 Vercel 项目设置中添加 TURSO_DATABASE_URL 环境变量',
        '格式应为 libsql://your-database-name.turso.io',
        '确保环境变量在 Production/Preview 环境中都已启用'
      ],
      connectionInfo: {
        databaseUrl: '未配置',
        hasAuthToken: !!authToken
      }
    };
  }

  if (!authToken) {
    return {
      success: false,
      message: '❌ TURSO_AUTH_TOKEN 环境变量未配置',
      errorCode: 'MISSING_AUTH_TOKEN',
      errorDetails: '未找到 TURSO_AUTH_TOKEN 环境变量，无法通过身份验证',
      troubleshooting: [
        '在 Turso Dashboard 中生成数据库令牌',
        '在 Vercel 项目设置中添加 TURSO_AUTH_TOKEN 环境变量',
        '运行命令生成令牌: turso db tokens create your-db-name'
      ],
      connectionInfo: {
        databaseUrl: databaseUrl,
        hasAuthToken: false
      }
    };
  }

  // 第二步：验证URL格式
  if (!databaseUrl.startsWith('libsql://') && !databaseUrl.startsWith('https://') && !databaseUrl.startsWith('file:')) {
    return {
      success: false,
      message: '❌ 数据库URL格式无效',
      errorCode: 'URL_INVALID',
      errorDetails: `当前URL: ${databaseUrl}，必须以 libsql://、https:// 或 file: 开头`,
      troubleshooting: [
        '检查 TURSO_DATABASE_URL 是否包含正确的协议前缀',
        '从 Turso Dashboard 复制完整的数据库连接地址',
        '确保URL前后没有多余的空格或引号'
      ],
      connectionInfo: {
        databaseUrl: databaseUrl,
        hasAuthToken: true
      }
    };
  }

  // 第三步：尝试连接数据库
  const startTime = Date.now();
  let client;

  try {
    client = createClient({
      url: databaseUrl,
      authToken: authToken,
    });

    // 执行简单查询测试连接
    const result = await client.execute(`SELECT sqlite_version() as version, datetime('now') as now`);
    
    const latency = Date.now() - startTime;

    // 获取数据库中的表列表
    const tablesResult = await client.execute(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`);
    const tables = tablesResult.rows.map(row => row.name as string);

    return {
      success: true,
      message: '✅ 成功连接到 Turso 数据库',
      connectionInfo: {
        databaseUrl: databaseUrl,
        hasAuthToken: true
      },
      latency: `${latency}ms`,
      databaseInfo: {
        sqliteVersion: result.rows?.[0]?.version as string,
        tables: tables.length > 0 ? tables : ['数据库中暂无表']
      }
    };

  } catch (error) {
    const libsqlError = error as LibsqlError;
    const latency = Date.now() - startTime;
    
    let errorMessage = '未知连接错误';
    let troubleshooting: string[] = [];

    switch (libsqlError.code) {
      case 'URL_INVALID':
        errorMessage = '数据库URL格式无效';
        troubleshooting = [
          '检查URL是否以 libsql:// 开头',
          '确保URL没有拼写错误或多余字符',
          '从 Turso Dashboard 重新复制数据库地址'
        ];
        break;
      case 'AUTH_FAILED':
        errorMessage = '身份验证失败';
        troubleshooting = [
          '检查 TURSO_AUTH_TOKEN 是否正确',
          '令牌可能已过期，请重新生成',
          '确保令牌对该数据库具有访问权限',
          '运行: turso db tokens create --expiration none your-db-name 生成永久令牌'
        ];
        break;
      case 'HTTP_ERROR':
        errorMessage = 'HTTP请求错误，可能是网络问题或数据库不存在';
        troubleshooting = [
          '确认数据库名称在 Turso 中存在',
          '检查数据库是否已被删除',
          '确认 Vercel 服务器可以访问公网',
          '尝试在本地使用相同环境变量测试连接'
        ];
        break;
      case 'CONNECTION_CLOSED':
        errorMessage = '连接被远程服务器关闭';
        troubleshooting = [
          '检查数据库实例是否正常运行',
          'Turso 免费版实例在无活动时会休眠，请稍后重试',
          '确认IP没有被防火墙拦截'
        ];
        break;
      case 'TIMEOUT':
        errorMessage = '连接超时';
        troubleshooting = [
          '检查网络连接是否正常',
          '数据库服务器可能繁忙，请稍后重试',
          '确认 Turso 服务状态: https://status.turso.io'
        ];
        break;
      default:
        errorMessage = libsqlError.message || '连接失败';
        troubleshooting = [
          '检查环境变量配置是否正确',
          '确认数据库令牌有效',
          '查看 Vercel 函数日志获取详细错误堆栈'
        ];
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
      latency: `${latency}ms`
    };
  } finally {
    // 关闭连接
    if (client) {
      try {
        await client.close();
      } catch (e) {
        // 忽略关闭错误
      }
    }
  }
}
