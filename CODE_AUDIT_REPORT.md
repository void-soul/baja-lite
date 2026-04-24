# Baja-Lite SQL.ts 代码审计报告

## 审计日期
2024年

## 审计范围
`baja-lite/src/sql.ts` - 核心 SQL 抽象层代码

---

## 🔴 严重问题 (Critical)

### 1. **SQL 注入风险 - PostgreSQL 参数替换**
**位置**: `PostgresqlConnection.execute()` 及其他方法  
**代码**:
```typescript
const { rowCount } = await this[_daoConnection].query({
    text: sql.replace(/\?/g, () => `$${index++}`),
    values: params
});
```

**问题**: 
- 使用简单的字符串替换 `/\?/g` 可能会错误替换 SQL 字符串字面量中的 `?`
- 例如: `SELECT * FROM users WHERE comment = 'What?'` 会被错误替换

**建议**:
```typescript
// 使用更安全的参数解析
function replacePlaceholders(sql: string): string {
    let index = 1;
    let inString = false;
    let result = '';
    
    for (let i = 0; i < sql.length; i++) {
        const char = sql[i];
        if (char === "'" && sql[i-1] !== '\\') {
            inString = !inString;
        }
        if (char === '?' && !inString) {
            result += `$${index++}`;
        } else {
            result += char;
        }
    }
    return result;
}
```

---

### 2. **事务状态不一致风险**
**位置**: `Mysql.transaction()`, `Postgresql.transaction()`  
**代码**:
```typescript
} catch (error) {
    await conn![_daoConnection].rollback();  // ❌ 无条件 rollback
    reject(error);
} finally {
    try {
        if (needCommit) {
            conn![_inTransaction] = false;
        }
        if (newConn) {
            conn![_daoConnection].release();
        }
    } catch (error) {
        // 吞掉错误
    }
}
```

**问题**:
1. **嵌套事务 rollback 错误**: catch 块中无条件执行 `rollback()`，但在嵌套事务场景下（`needCommit=false`），会错误地回滚外层事务
2. finally 中的 catch 吞掉了所有错误，可能隐藏连接释放失败的问题

**场景示例**:
```typescript
// 外层事务
await service.transaction({
    fn: async (conn) => {
        await service.insert({ data: user1, conn });
        
        // 内层事务（传递同一个连接）
        await service.transaction({
            conn,  // needCommit=false
            fn: async (conn2) => {
                throw new Error('内层失败');
            }
        });
        // ❌ 内层会执行 rollback，导致外层事务被意外回滚
    }
});
```

**修复方案**:
```typescript
} catch (error) {
    if (needCommit) {  // ✅ 只在需要时 rollback
        (globalThis[_LoggerService]! as LoggerService).debug?.('rollback begin!');
        await conn![_daoConnection].rollback();
        (globalThis[_LoggerService]! as LoggerService).debug?.('rollback end!');
    }
    (globalThis[_LoggerService]! as LoggerService).error(error);
    reject(error);
} finally {
    try {
        if (needCommit) {
            conn![_inTransaction] = false;
        }
        if (newConn) {
            conn![_daoConnection].release();
        }
    } catch (error) {
        // 记录日志但不影响业务逻辑
        (globalThis[_LoggerService]! as LoggerService).warn?.('Failed to release connection', error);
    }
}
```

**状态**: ✅ 已修复

---

### 3. **连接泄漏风险 - keepAlive**
**位置**: `Mysql.keepAlive()`  
**代码**:
```typescript
async keepAlive() {
    let connection: Connection | null = null;
    try {
        connection = await this.createConnection(SyncMode.Async);
        const data = await connection?.query(SyncMode.Async, 'SELECT 1 FROM DUAL');
    } catch (error) {
        (globalThis[_LoggerService]! as LoggerService).error('keepAlive error', error);
    } finally {
        if (connection) {
            await connection.release(SyncMode.Async);
        }
        setTimeout(() => this.keepAlive(), globalThis[_MysqlKeepAliveTime] ?? 30000);
    }
}
```

**问题**:
1. 如果 `createConnection` 失败但返回了部分连接对象，可能导致连接泄漏
2. `setTimeout` 递归调用可能导致内存泄漏（如果数据库关闭但应用继续运行）
3. 没有停止 keepAlive 的机制

**建议**:
```typescript
private keepAliveTimer?: NodeJS.Timeout;
private isClosing = false;

async keepAlive() {
    if (this.isClosing) return;
    
    let connection: Connection | null = null;
    try {
        connection = await this.createConnection(SyncMode.Async);
        if (connection) {
            await connection.query(SyncMode.Async, 'SELECT 1 FROM DUAL');
        }
    } catch (error) {
        (globalThis[_LoggerService]! as LoggerService).error('keepAlive error', error);
    } finally {
        if (connection) {
            try {
                await connection.release(SyncMode.Async);
            } catch (releaseError) {
                (globalThis[_LoggerService]! as LoggerService).error('Failed to release keepAlive connection', releaseError);
            }
        }
        if (!this.isClosing) {
            this.keepAliveTimer = setTimeout(() => this.keepAlive(), globalThis[_MysqlKeepAliveTime] ?? 30000);
        }
    }
}

close(sync: SyncMode.Async): Promise<void> {
    this.isClosing = true;
    if (this.keepAliveTimer) {
        clearTimeout(this.keepAliveTimer);
    }
    return this[_daoDB]?.end();
}
```
**状态**: ✅ 已修复
---

## 🟡 高风险问题 (High)

### 4. **未处理的 Promise 拒绝**
**位置**: `MysqlConnection.pluck()`, `get()`, `raw()`, `query()`  
**代码**:
```typescript
return new Promise<T | null>(async (resolve, reject) => {
    try {
        const [result] = await this[_daoConnection].query(sql, params);
        if (result && result[0]) {
            const r = Object.values(result[0])[0];
            if (r === null) resolve(r);
            else resolve(r as T);
        }
        resolve(null);  // 这里永远不会执行
    } catch (error) {
        reject(error);
    }
});
```

**问题**: 
- 在 `if` 块中 resolve 后，外层的 `resolve(null)` 永远不会执行
- 逻辑不清晰，应该使用 `else`

**建议**:
```typescript
return new Promise<T | null>(async (resolve, reject) => {
    try {
        const [result] = await this[_daoConnection].query(sql, params);
        if (result && result[0]) {
            const r = Object.values(result[0])[0];
            resolve(r === null ? null : r as T);
        } else {
            resolve(null);
        }
    } catch (error) {
        reject(error);
    }
});
```

---

### 5. **PostgreSQL execute 返回值错误**
**位置**: `PostgresqlConnection.execute()`  
**代码**:
```typescript
const { rowCount } = await this[_daoConnection].query({
    text: sql.replace(/\?/g, () => `$${index++}`),
    values: params
});
const result = rowCount as any;
resolve({ affectedRows: result.affectedRows, insertId: result.insertId });
```

**问题**:
- `rowCount` 是一个数字，不是对象
- `result.affectedRows` 和 `result.insertId` 会是 undefined
- 应该直接使用 `rowCount`

**建议**:
```typescript
const { rowCount } = await this[_daoConnection].query({
    text: sql.replace(/\?/g, () => `$${index++}`),
    values: params
});
resolve({ 
    affectedRows: rowCount || 0, 
    insertId: 0n  // PostgreSQL 不返回 insertId，需要使用 RETURNING 子句
});
```

---

### 6. **TIME_TO_SEC 函数计算错误**
**位置**: `Sqlite` 构造函数  
**代码**:
```typescript
this[_daoDB].function('TIME_TO_SEC', { deterministic: true }, 
    (time: string) => time.split(':').map((v, i) => 
        parseInt(v) * (i === 0 ? 360 : i === 1 ? 60 : 0)
    ).reduce((a, b) => a + b, 0)
);
```

**问题**:
- 小时应该乘以 3600，不是 360
- 秒应该乘以 1，不是 0

**建议**:
```typescript
this[_daoDB].function('TIME_TO_SEC', { deterministic: true }, 
    (time: string) => {
        const parts = time.split(':');
        const hours = parseInt(parts[0] || '0');
        const minutes = parseInt(parts[1] || '0');
        const seconds = parseInt(parts[2] || '0');
        return hours * 3600 + minutes * 60 + seconds;
    }
);
```

---

## 🟠 中等风险问题 (Medium)

### 7. **全局状态污染**
**位置**: 多处使用 `globalThis`  
**代码**:
```typescript
globalThis[_resultMap_SQLID] = {};
globalThis[_LoggerService]
globalThis[_GlobalSqlOption]
```

**问题**:
- 使用 globalThis 存储状态可能导致多实例冲突
- 在测试环境中难以隔离

**建议**:
- 使用依赖注入或单例模式
- 创建一个 Context 类来管理这些全局状态

---

### 8. **BigInt 原型污染**
**位置**: 文件开头  
**代码**:
```typescript
(BigInt.prototype as any).toJSON = function () { return this.toString() }
```

**问题**:
- 修改全局原型可能影响其他库
- 在某些环境中可能导致意外行为

**建议**:
```typescript
// 使用 JSON.stringify 的 replacer 参数
function jsonStringify(obj: any): string {
    return JSON.stringify(obj, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value
    );
}
```

---

### 9. **错误处理不一致**
**位置**: 多处  
**问题**:
- 有些地方抛出错误，有些地方返回 null
- 有些地方记录日志，有些地方不记录

**建议**:
- 统一错误处理策略
- 创建自定义错误类
- 确保所有错误都被正确记录和传播

---

### 10. **类型断言过度使用**
**位置**: 多处使用 `as any`  
**代码**:
```typescript
const result = _result as any;
const result = rowCount as any;
```

**问题**:
- 绕过了 TypeScript 的类型检查
- 可能隐藏类型错误

**建议**:
- 定义正确的接口类型
- 使用类型守卫而不是类型断言

---

## 🟢 低风险问题 (Low)

### 11. **拼写错误**
**位置**: 多处  
```typescript
'MYSQL not suppouted sync mode'  // suppouted -> supported
'SQLITE not suppoted async mode'  // suppoted -> supported
```

### 12. **未使用的参数**
**位置**: 多个空方法实现  
```typescript
backup(sync: SyncMode, name: string): Promise<void> | void {
    // 空实现
}
```

**建议**: 添加 `@deprecated` 注释或抛出 `NotImplementedError`

### 13. **魔法数字**
**位置**: 多处  
```typescript
setTimeout(() => this.keepAlive(), globalThis[_MysqlKeepAliveTime] ?? 30000);
```

**建议**: 定义常量
```typescript
const DEFAULT_KEEPALIVE_INTERVAL = 30000; // 30 seconds
```

---

## 📊 统计摘要

| 严重程度 | 数量 | 优先级 |
|---------|------|--------|
| 🔴 严重 | 3 | P0 - 立即修复 |
| 🟡 高风险 | 6 | P1 - 本周修复 |
| 🟠 中等 | 4 | P2 - 本月修复 |
| 🟢 低风险 | 3 | P3 - 计划修复 |

---

## 🎯 优先修复建议

### 立即修复 (P0)
1. PostgreSQL 参数替换的 SQL 注入风险
2. 事务状态不一致问题
3. keepAlive 连接泄漏

### 本周修复 (P1)
4. Promise 逻辑错误
5. PostgreSQL execute 返回值
6. TIME_TO_SEC 计算错误

### 本月修复 (P2)
7. 全局状态管理
8. BigInt 原型污染
9. 错误处理标准化
10. 类型安全改进

---

## 🔒 安全建议

1. **参数化查询**: 确保所有 SQL 查询都使用参数化，避免字符串拼接
2. **输入验证**: 对所有用户输入进行验证和清理
3. **错误信息**: 不要在错误消息中暴露敏感信息（如 SQL 语句、参数）
4. **连接管理**: 实现连接池监控和自动清理机制
5. **日志安全**: 确保日志中不包含敏感数据（密码、令牌等）

---

## 📝 代码质量建议

1. **单元测试**: 为关键方法添加单元测试，特别是事务和连接管理
2. **集成测试**: 测试多数据库场景和并发操作
3. **文档**: 为复杂逻辑添加详细注释
4. **代码审查**: 建立代码审查流程
5. **静态分析**: 使用 ESLint、TypeScript strict mode

---

## 🔄 重构建议

### 1. 提取公共逻辑
```typescript
// 创建基类
abstract class BaseConnection implements Connection {
    protected abstract executeQuery(sql: string, params: any): Promise<any>;
    
    async execute(sync: SyncMode, sql?: string, params?: any) {
        // 公共逻辑
    }
}
```

### 2. 统一错误处理
```typescript
class DatabaseError extends Error {
    constructor(
        message: string,
        public code: string,
        public sql?: string,
        public cause?: Error
    ) {
        super(message);
        this.name = 'DatabaseError';
    }
}
```

### 3. 连接池管理
```typescript
class ConnectionPool {
    private connections: Map<string, Connection> = new Map();
    private maxConnections = 10;
    
    async acquire(): Promise<Connection> { }
    async release(conn: Connection): Promise<void> { }
    async drain(): Promise<void> { }
}
```

---

## ✅ 审计结论

代码整体架构良好，但存在一些需要立即修复的安全和稳定性问题。建议：

1. **立即修复** P0 级别的 SQL 注入和连接泄漏问题
2. **优先处理** 事务和错误处理的一致性
3. **逐步改进** 代码质量和类型安全
4. **建立测试** 覆盖关键路径和边界情况

---

## 📞 联系

如有疑问，请联系开发团队。

**审计人**: AI Code Reviewer  
**审计工具**: 静态代码分析 + 人工审查
