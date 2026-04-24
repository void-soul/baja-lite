# Baja-Lite

[![npm version](https://img.shields.io/npm/v/baja-lite.svg)](https://www.npmjs.com/package/baja-lite)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

一个功能强大的 TypeScript SQL 抽象层，支持多数据库、ORM、查询构建器、缓存和分布式锁等企业级特性。

## 📋 目录

- [特性](#特性)
- [架构](#架构)
- [安装](#安装)
- [快速开始](#快速开始)
- [核心概念](#核心概念)
- [API 文档](#api-文档)
- [高级功能](#高级功能)

## ✨ 特性

- 🗄️ **多数据库支持**: MySQL, PostgreSQL, SQLite, SQLite Remote
- 🔄 **同步/异步模式**: 根据数据库类型自动选择
- 🎯 **类型安全**: 完整的 TypeScript 类型支持
- 🔧 **ORM 功能**: 装饰器驱动的实体定义
- 🔍 **流式查询**: 链式 API 构建复杂查询
- 📝 **SQL 模板**: 支持 Mustache、XML (MyBatis 风格)、MU 格式
- 💾 **缓存系统**: 基于 Redis 的方法级缓存
- 🔒 **分布式锁**: Redis 实现的方法级锁
- 📊 **分页查询**: 内置分页支持
- 🔄 **事务管理**: 支持嵌套事务
- 📤 **导入导出**: Excel 数据交换支持
- 🔄 **自动迁移**: SQLite 版本管理和自动升级

## 🏗️ 架构

```
┌─────────────────────────────────────────────────────────────┐
│                        Application Layer                     │
│                    (Your Business Logic)                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      SqlService Layer                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   CRUD API   │  │ Stream Query │  │  Template    │      │
│  │ insert/update│  │  Fluent API  │  │   System     │      │
│  │ delete/select│  │              │  │              │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Connection Layer (Dao)                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  MySQL   │  │PostgreSQL│  │  SQLite  │  │  Remote  │   │
│  │Connection│  │Connection│  │Connection│  │Connection│   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Database Layer                          │
│     MySQL Server  │  PostgreSQL  │  SQLite File/Memory      │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    Auxiliary Services                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Redis Cache  │  │ Redis Lock   │  │   Logger     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### 核心组件

1. **Dao (Data Access Object)**
   - 管理数据库连接池
   - 提供事务支持
   - 统一的 CRUD 接口

2. **Connection**
   - 封装数据库连接
   - 执行 SQL 语句
   - 管理事务状态

3. **SqlService**
   - 业务层服务基类
   - 提供高级 CRUD 方法
   - 集成缓存和锁

4. **StreamQuery**
   - 流式查询构建器
   - 链式 API
   - 类型安全的查询条件

## 📦 安装

```bash
npm install baja-lite baja-lite-field

# 根据需要安装数据库驱动
npm install mysql2          # MySQL
npm install pg pg-pool      # PostgreSQL
npm install better-sqlite3  # SQLite

# 可选：缓存和锁
npm install ioredis redlock
```

## 🚀 快速开始

### 1. 初始化数据库

```typescript
import { boot } from 'baja-lite/boot.js';
import { DBType } from 'baja-lite';
import Database from 'better-sqlite3';

await boot({
  // MySQL 配置
  Mysql: {
    host: 'localhost',
    user: 'root',
    password: 'password',
    database: 'mydb',
    port: 3306
  },
  
  // SQLite 配置
  Sqlite: './data.db',
  BetterSqlite3: Database,
  
  // Redis 配置（可选）
  Redis: {
    host: 'localhost',
    port: 6379
  },
  
  // SQL 模板目录
  sqlDir: './sql',
  
  // 日志级别
  log: ['debug', 'info', 'warn', 'error']
});
```

### 2. 定义实体

```typescript
import { Field } from 'baja-lite-field';

export class User {
  @Field({ 
    type: 'String', 
    P: 'id',
    id: true,
    uuid: true,
    comment: '用户ID'
  })
  id: string;

  @Field({ 
    type: 'String', 
    P: 'username',
    comment: '用户名'
  })
  username: string;

  @Field({ 
    type: 'String', 
    P: 'email',
    comment: '邮箱'
  })
  email: string;

  @Field({ 
    type: 'Number', 
    P: 'age',
    comment: '年龄'
  })
  age: number;

  @Field({ 
    type: 'Date', 
    P: 'created_at',
    comment: '创建时间'
  })
  createdAt: Date;
}
```

### 3. 创建服务

```typescript
import { DB, SqlService, SyncMode, InsertMode } from 'baja-lite';

@DB({
  tableName: 'user',
  clz: User,
  dbType: DBType.Mysql,
  comment: '用户表'
})
export class UserService extends SqlService<User> {
  
  // 插入用户
  async createUser(user: User) {
    return await this.insert({
      data: user,
      mode: InsertMode.Insert
    });
  }

  // 更新用户
  async updateUser(user: Partial<User>) {
    return await this.update({
      data: user
    });
  }

  // 删除用户
  async deleteUser(id: string) {
    return await this.delete({
      id
    });
  }

  // 查询用户
  async getUser(id: string) {
    return await this.template({
      templateResult: TemplateResult.NotSureOne,
      id
    });
  }

  // 分页查询
  async listUsers(page: number, size: number) {
    return await this.stream()
      .select('id', 'username', 'email', 'age')
      .asc('createdAt')
      .page(page, size)
      .excutePage();
  }
}
```

### 4. 使用服务

```typescript
const userService = new UserService();

// 创建用户
const userId = await userService.createUser({
  username: 'john',
  email: 'john@example.com',
  age: 25
});

// 查询用户
const user = await userService.getUser(userId);

// 更新用户
await userService.updateUser({
  id: userId,
  age: 26
});

// 分页查询
const result = await userService.listUsers(1, 10);
console.log(result.records); // 用户列表
console.log(result.total);   // 总数
```

## 🔑 核心概念

### 1. 同步模式 (SyncMode)

```typescript
// 异步模式（MySQL, PostgreSQL, SQLite Remote）
const users = await service.select({
  sync: SyncMode.Async,
  sql: 'SELECT * FROM user'
});

// 同步模式（SQLite）
const users = service.select({
  sync: SyncMode.Sync,
  sql: 'SELECT * FROM user'
});
```

### 2. 插入模式 (InsertMode)

```typescript
// 普通插入
await service.insert({
  data: user,
  mode: InsertMode.Insert
});

// 不存在则插入
await service.insert({
  data: user,
  mode: InsertMode.InsertIfNotExists,
  existConditionOtherThanIds: ['email']
});

// 替换（存在则更新）
await service.insert({
  data: user,
  mode: InsertMode.Replace
});

// 使用临时表批量插入
await service.insert({
  data: users,
  mode: InsertMode.InsertWithTempTable
});
```

### 3. 查询结果类型 (SelectResult)

```typescript
// 一行一列，确定非空
const count = await service.select({
  selectResult: SelectResult.R_C_Assert,
  sql: 'SELECT COUNT(*) FROM user'
});

// 一行多列，可能为空
const user = await service.select({
  selectResult: SelectResult.R_CS_NotSure,
  sql: 'SELECT * FROM user WHERE id = ?',
  params: { id: 1 }
});

// 多行多列
const users = await service.select({
  selectResult: SelectResult.RS_CS,
  sql: 'SELECT * FROM user'
});
```

## 📚 API 文档

### SqlService 核心方法

#### insert(option)
插入数据

```typescript
interface InsertOption {
  data: T | T[];                    // 要插入的数据
  sync?: SyncMode;                  // 同步模式
  mode?: InsertMode;                // 插入模式
  existConditionOtherThanIds?: (keyof T)[]; // 判断存在的字段
  skipUndefined?: boolean;          // 跳过 undefined
  skipNull?: boolean;               // 跳过 null
  skipEmptyString?: boolean;        // 跳过空字符串
  maxDeal?: number;                 // 批量处理数量
  conn?: Connection;                // 连接对象
}

// 返回插入的 ID
const id = await service.insert({ data: user });
```

#### update(option)
更新数据

```typescript
interface UpdateOption {
  data: Partial<T> | Partial<T>[];  // 要更新的数据（必须包含 ID）
  sync?: SyncMode;
  skipUndefined?: boolean;
  skipNull?: boolean;
  skipEmptyString?: boolean;
  maxDeal?: number;
  conn?: Connection;
}

// 返回影响的行数
const count = await service.update({ data: user });
```

#### delete(option)
删除数据

```typescript
interface DeleteOption {
  sync?: SyncMode;
  id?: string | number | Array<string | number>; // 按 ID 删除
  where?: Partial<T> | Array<Partial<T>>;        // 按条件删除
  mode?: DeleteMode;                              // 删除模式
  forceDelete?: boolean;                          // 强制删除（忽略逻辑删除）
  whereSql?: string;                              // 自定义 WHERE
  whereParams?: Record<string, any>;
  conn?: Connection;
}

// 返回影响的行数
const count = await service.delete({ id: '123' });
```

#### select(option)
自由查询

```typescript
interface SelectOption {
  sync?: SyncMode;
  selectResult?: SelectResult;      // 结果类型
  sqlId?: string;                   // SQL 模板 ID
  sql?: string;                     // SQL 语句
  params?: Record<string, any>;     // 参数
  context?: any;                    // 上下文
  hump?: boolean;                   // 驼峰转换
  mapper?: string | SqlMapper;      // 结果映射
  dataConvert?: Record<string, string>; // 数据转换
  conn?: Connection;
}

const users = await service.select({
  sql: 'SELECT * FROM user WHERE age > :age',
  params: { age: 18 }
});
```

#### page(option)
分页查询

```typescript
interface PageOption {
  sync?: SyncMode;
  sqlId: string;                    // SQL 模板 ID
  params: Record<string, any>;      // 参数
  pageSize?: number;                // 每页数量
  pageNumber?: number;              // 页码
  sortName?: string;                // 排序字段
  sortType?: string;                // 排序方式 ASC/DESC
  sum?: boolean;                    // 是否汇总
  hump?: boolean;
  mapper?: string | SqlMapper;
  conn?: Connection;
}

const result = await service.page({
  sqlId: 'user.list',
  params: { status: 1 },
  pageNumber: 1,
  pageSize: 10
});

// result: { records: T[], total: number, size: number, sum?: {} }
```

#### transaction(option)
事务管理

```typescript
const result = await service.transaction({
  sync: SyncMode.Async,
  fn: async (conn) => {
    await service.insert({ data: user1, conn });
    await service.insert({ data: user2, conn });
    return 'success';
  }
});
```

### StreamQuery 流式查询

#### 条件方法

```typescript
const query = service.stream();

// 相等
query.eq('username', 'john');
query.eqs(['username', 'email'], 'john'); // OR 条件

// 不等
query.notEq('status', 0);

// 比较
query.grate('age', 18);      // >
query.grateEq('age', 18);    // >=
query.less('age', 60);       // <
query.lessEq('age', 60);     // <=

// 模糊查询
query.like('username', 'john');        // %john%
query.leftLike('username', 'john');    // %john
query.rightLike('username', 'john');   // john%

// 范围
query.in('status', [1, 2, 3]);
query.between('age', 18, 60);

// 空值
query.isNULL('deletedAt');
query.isNotNULL('deletedAt');
query.isEmpty('remark');
query.isNotEmpty('remark');

// 正则
query.regexp('email', '^[a-z]+@');

// 全文搜索
query.match('keyword', ['title', 'content']);

// 位运算
query.pow('permission', 4);  // POW(2, permission) & 4

// 组合条件
query.and(q => {
  q.eq('status', 1);
  q.grate('age', 18);
});

query.or(q => {
  q.eq('type', 'A');
  q.eq('type', 'B');
});

// 自定义 WHERE
query.where('t.score > :score', { score: 90 });
```

#### 聚合方法

```typescript
query.count('ct');                    // COUNT(1)
query.countDistinct('userId', 'uct'); // COUNT(DISTINCT userId)
query.sum('amount', 'total');         // SUM(amount)
query.avg('score', 'avgScore');       // AVG(score)
query.max('price', 'maxPrice');       // MAX(price)
query.min('price', 'minPrice');       // MIN(price)
query.groupConcat('tags', {           // GROUP_CONCAT
  distinct: true,
  separator: ',',
  asc: ['order']
});
```

#### 分组和排序

```typescript
query.groupBy('category', 'status');
query.asc('createdAt', 'id');
query.desc('score');
```

#### 分页

```typescript
query.limit(0, 10);        // LIMIT 0, 10
query.page(1, 10);         // 第 1 页，每页 10 条
```

#### 执行查询

```typescript
// 查询列表
const users = await query.excuteSelect();

// 查询单条
const user = await query.excuteSelect({
  selectResult: SelectResult.R_CS_NotSure
});

// 分页查询
const result = await query.excutePage();

// 更新
query.update('status', 1);
query.incr('viewCount', 1);
const count = await query.excuteUpdate();

// 删除
const count = await query.excuteDelete();
```

## 🚀 高级功能

### 1. SQL 模板系统

#### Mustache 模板

创建 `sql/user.ts`:

```typescript
export default {
  list: (options) => `
    SELECT 
      {{#page}} COUNT(1) ct {{/page}}
      {{#notPage}} * {{/notPage}}
    FROM user t
    {{#where}}
      {{#params.status}}
        AND t.status = :status
      {{/params.status}}
      {{#params.keyword}}
        AND t.username LIKE CONCAT('%', :keyword, '%')
      {{/params.keyword}}
    {{/where}}
    {{#order}} t.created_at DESC {{/order}}
  `
};
```

使用：

```typescript
const result = await service.page({
  sqlId: 'user.list',
  params: { status: 1, keyword: 'john' },
  pageNumber: 1,
  pageSize: 10
});
```

#### XML 模板 (MyBatis 风格)

创建 `sql/user.xml`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<mapper>
  <resultMap id="userMap">
    <id column="id" property="id"/>
    <result column="username" property="username"/>
    <result column="email" property="email"/>
  </resultMap>

  <select id="list" resultMap="userMap">
    SELECT * FROM user
    WHERE status = :status
    <if test="keyword != null">
      AND username LIKE CONCAT('%', :keyword, '%')
    </if>
    ORDER BY created_at DESC
  </select>
</mapper>
```

### 2. 缓存系统

```typescript
import { MethodCache, clearMethodCache } from 'baja-lite';

class UserService extends SqlService<User> {
  
  @MethodCache({
    key: (id) => `user:${id}`,
    autoClearTime: 60  // 60 分钟后自动清除
  })
  async getUser(id: string) {
    return await this.template({
      templateResult: TemplateResult.NotSureOne,
      id
    });
  }

  @MethodCache({
    key: (status) => `user:list:${status}`,
    clearKey: (status) => ['user:list']  // 关联清除
  })
  async listByStatus(status: number) {
    return await this.stream()
      .eq('status', status)
      .excuteSelect();
  }
}

// 手动清除缓存
await clearMethodCache('user:123');
await clearMethodCache('user:list');  // 清除所有关联缓存
```

### 3. 分布式锁

```typescript
import { MethodLock, excuteWithLock } from 'baja-lite';

class OrderService extends SqlService<Order> {
  
  @MethodLock({
    key: (orderId) => `order:${orderId}`,
    lockMaxActive: 1,        // 最大并发数
    lockMaxTime: 30000,      // 锁超时时间（毫秒）
    lockWait: true,          // 等待锁释放
    lockRetryInterval: 100   // 重试间隔
  })
  async processOrder(orderId: string) {
    // 业务逻辑
    const order = await this.getOrder(orderId);
    // ...
    return order;
  }
}

// 手动使用锁
await excuteWithLock({
  key: 'critical-section',
  lockMaxActive: 1
}, async () => {
  // 临界区代码
});
```

### 4. 数据映射

```typescript
// 定义映射
const userMapper: SqlMapper = [
  { columnName: 'user_id', mapNames: ['id'] },
  { columnName: 'user_name', mapNames: ['name'] },
  { columnName: 'dept_id', mapNames: ['department', 'id'] },
  { columnName: 'dept_name', mapNames: ['department', 'name'] }
];

// 使用映射
const users = await service.select({
  sql: 'SELECT user_id, user_name, dept_id, dept_name FROM user',
  mapper: userMapper
});

// 结果：
// [
//   {
//     id: 1,
//     name: 'John',
//     department: { id: 10, name: 'IT' }
//   }
// ]
```

### 5. 数据转换

```typescript
// 初始化时配置
await boot({
  dataConvert: {
    qiniu: (filename) => `https://cdn.example.com/${filename}`,
    date: (timestamp) => new Date(timestamp)
  }
});

// 使用转换
const users = await service.select({
  sql: 'SELECT id, avatar, created_at FROM user',
  dataConvert: {
    avatar: 'qiniu',
    created_at: 'date'
  }
});
```

### 6. 导入导出

```typescript
// 导出数据
const users = await service.stream().excuteSelect();
const exportData = service.exp(users);

// exportData 可直接用于 EJS-Excel
// {
//   title: '用户表',
//   titleSpan: 'A1:E1',
//   columnTitles: ['ID', '用户名', '邮箱', '年龄', '创建时间'],
//   datas: [...]
// }

// 导入模板
const template = service.imp();
```

### 7. 事务嵌套

```typescript
await service.transaction({
  fn: async (conn) => {
    // 外层事务
    await service.insert({ data: user1, conn });
    
    // 嵌套事务
    await service.transaction({
      conn,  // 传递连接
      fn: async (conn2) => {
        await service.insert({ data: user2, conn: conn2 });
        await service.update({ data: user3, conn: conn2 });
      }
    });
    
    await service.insert({ data: user4, conn });
  }
});
```

## 🔧 配置选项

### GlobalSqlOption

```typescript
interface GlobalSqlOption {
  // 数据库配置
  Mysql?: Record<string, any>;           // MySQL 配置
  Postgresql?: Record<string, any>;      // PostgreSQL 配置
  Sqlite?: string | Record<string, string>; // SQLite 配置
  BetterSqlite3?: any;                   // SQLite 驱动
  
  // Redis 配置
  Redis?: Record<string, any>;
  
  // SQL 模板
  sqlDir?: string;                       // SQL 目录
  sqlMap?: SqlModel;                     // SQL 映射
  sqlFNDir?: string;                     // SQL 函数目录
  sqlMapperDir?: string;                 // 映射目录
  
  // 行为配置
  skipUndefined?: boolean;               // 默认 true
  skipNull?: boolean;                    // 默认 true
  skipEmptyString?: boolean;             // 默认 true
  maxDeal?: number;                      // 默认 500
  
  // 列名转换
  columnMode?: ColumnMode;               // NONE | HUMP
  
  // 数据转换
  dataConvert?: Record<string, (data: any) => any>;
  
  // 日志
  log?: LogLevel[] | LogLevel;
  logger?: LoggerService;
  
  // 上下文
  ctx?: any;
}
```

## 📝 最佳实践

### 1. 服务组织

```typescript
// services/base.service.ts
export abstract class BaseService<T> extends SqlService<T> {
  // 通用方法
}

// services/user.service.ts
@DB({ tableName: 'user', clz: User })
export class UserService extends BaseService<User> {
  // 用户特定方法
}
```

### 2. 错误处理

```typescript
try {
  await service.transaction({
    fn: async (conn) => {
      // 业务逻辑
    }
  });
} catch (error) {
  console.error('Transaction failed:', error);
  // 错误处理
}
```

### 3. 性能优化

```typescript
// 使用批量操作
await service.insert({
  data: users,  // 数组
  maxDeal: 1000  // 每次处理 1000 条
});

// 使用临时表（大批量）
await service.insert({
  data: users,
  mode: InsertMode.InsertWithTempTable
});

// 使用流式查询避免 N+1
const users = await service.stream()
  .select('id', 'username')  // 只查询需要的字段
  .limit(0, 100)
  .excuteSelect();
```

### 4. 类型安全

```typescript
// 使用泛型
class UserService extends SqlService<User> {
  async findByEmail(email: string): Promise<User | null> {
    return await this.stream()
      .eq('email', email)  // 类型检查
      .excuteSelect({
        selectResult: SelectResult.R_CS_NotSure
      });
  }
}
```

## 📄 License

MIT

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📮 联系

- GitHub: [void-soul/baja-lite](https://github.com/void-soul/baja-lite)
- NPM: [baja-lite](https://www.npmjs.com/package/baja-lite)
