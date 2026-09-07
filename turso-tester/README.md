# Turso 数据库连接测试工具

部署在 Vercel 上用于测试与 Turso 数据库连接状态的工具。

## 功能特点

- ✅ 自动测试数据库连接状态
- ❌ 连接失败时返回详细错误代码和错误信息
- 💡 提供针对性的故障排查建议
- ⏱️ 显示数据库查询响应延迟
- 📋 列出数据库中的现有表
- 🔍 检查环境变量配置状态

## 部署步骤

1. 将项目上传到 GitHub/GitLab
2. 在 Vercel 中导入该项目
3. 在 Vercel 项目设置中添加以下环境变量：
   - `TURSO_DATABASE_URL`: Turso 数据库地址 (格式: `libsql://your-db.turso.io`)
   - `TURSO_AUTH_TOKEN`: Turso 数据库认证令牌
4. 点击 Deploy 部署
5. 访问部署后的网站即可自动运行连接测试

## API 使用

直接访问 `/api/test-connection` 端点可以获取 JSON 格式的测试结果：

**成功响应示例:**
```json
{
  "success": true,
  "message": "✅ 成功连接到 Turso 数据库",
  "connectionInfo": {
    "databaseUrl": "libsql://your-db.turso.io",
    "hasAuthToken": true
  },
  "latency": "142ms",
  "databaseInfo": {
    "sqliteVersion": "3.45.0",
    "tables": ["users"]
  }
}
```

**失败响应示例:**
```json
{
  "success": false,
  "message": "❌ 连接失败: 身份验证失败",
  "errorCode": "AUTH_FAILED",
  "errorDetails": "Authentication failed",
  "troubleshooting": [
    "检查 TURSO_AUTH_TOKEN 是否正确",
    "令牌可能已过期，请重新生成"
  ]
}
```

## 支持的错误代码

| 错误代码 | 说明 |
|---------|------|
| `MISSING_DATABASE_URL` | TURSO_DATABASE_URL 环境变量未配置 |
| `MISSING_AUTH_TOKEN` | TURSO_AUTH_TOKEN 环境变量未配置 |
| `URL_INVALID` | 数据库URL格式无效 |
| `AUTH_FAILED` | 身份验证失败（令牌错误或过期） |
| `HTTP_ERROR` | HTTP请求错误（网络问题或数据库不存在） |
| `CONNECTION_CLOSED` | 连接被远程服务器关闭 |
| `TIMEOUT` | 连接超时 |
| `API_UNREACHABLE` | API端点无法访问 |
