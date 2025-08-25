# 项目架构设计文档

## 概述

本项目采用了一种创新的数据库访问架构，将 **Kysely**（类型安全的 SQL 查询构建器）、**原生 pg**（PostgreSQL 客户端）和 **Zod**（运行时类型验证）三者有机结合，实现了类型安全、高性能和可维护的数据库操作层。

## 技术栈介绍

### Kysely

**Kysely** 是一个类型安全的 TypeScript SQL 查询构建器，专为 PostgreSQL、MySQL 和 SQLite 设计。

**核心特性：**
- 🔒 **编译时类型安全**：在编译阶段就能发现 SQL 错误
- 🏗️ **链式 API**：提供直观的查询构建体验
- 📝 **SQL 生成**：将 TypeScript 代码转换为标准 SQL
- 🎯 **精确的类型推导**：自动推导查询结果类型

**示例：**
```typescript
// Kysely 查询构建
const query = db
  .selectFrom('tokens')
  .select(['id', 'address', 'total_supply'])
  .where('id', '=', tokenId)
  .compile(); // 生成 SQL 和参数
```

### 原生 pg

**原生 pg** 是 Node.js 的官方 PostgreSQL 客户端，提供了高性能和稳定的数据库连接。

**核心特性：**
- 🚀 **高性能**：直接的数据库连接，最小化开销
- 🔧 **灵活配置**：完全可控的连接池和查询参数
- 📊 **事务支持**：完整的事务管理功能
- 🛡️ **参数化查询**：防止 SQL 注入攻击

### Zod

**Zod** 是一个 TypeScript 优先的模式验证库。

**核心特性：**
- ✅ **运行时验证**：确保数据符合预期格式
- 🔄 **类型推导**：从 schema 自动生成 TypeScript 类型
- 🛠️ **数据转换**：支持数据清洗和格式化
- 📋 **详细错误信息**：提供精确的验证错误

## 架构设计

### 整体架构图

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Service 层    │    │  Repository 层  │    │    Model 层     │
│                 │    │                 │    │                 │
│ • 业务逻辑      │───▶│ • 数据访问      │───▶│ • Zod Schema    │
│ • 数据转换      │    │ • SQL 操作      │    │ • 类型定义      │
│ • 错误处理      │    │ • 结果映射      │    │ • 验证规则      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │ QueryExecutor   │
                       │                 │
                       │ ┌─────────────┐ │
                       │ │   Kysely    │ │ ◀── SQL 构建
                       │ │ (SQL 生成)  │ │
                       │ └─────────────┘ │
                       │        │        │
                       │        ▼        │
                       │ ┌─────────────┐ │
                       │ │   原生 pg   │ │ ◀── SQL 执行
                       │ │ (连接池)    │ │
                       │ └─────────────┘ │
                       │        │        │
                       │        ▼        │
                       │ ┌─────────────┐ │
                       │ │ Zod 校验    │ │ ◀── 类型验证
                       │ │ (类型安全)  │ │
                       │ └─────────────┘ │
                       └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   PostgreSQL    │
                       │    数据库       │
                       └─────────────────┘
```

### 核心设计理念

#### 1. 职责分离

- **Kysely**：专注于类型安全的 SQL 构建，生成标准 SQL 和参数
- **原生 pg**：专注于高性能的 SQL 执行和连接管理
- **Zod**：专注于运行时数据验证和类型转换

#### 2. 数据流向

```
业务请求 → Service → Repository → QueryExecutor
    ↓
Kysely 构建 SQL → 参数替换 → 原生 pg 执行
    ↓
原始结果 → Zod 验证 → 类型转换 → 返回给业务层
```

## 设计优势

### 相比传统方案的优势

#### 1. **类型安全性大幅提升**

**传统原生 pg：**
```typescript
// 容易出错，无编译时检查
const result = await client.query(
  'SELECT * FROM tokens WHERE id = $1',
  [tokenId]
);
// result.rows[0] 类型为 any，需要手动断言
```

**当前架构：**
```typescript
// 编译时类型检查，自动类型推导
const query = db
  .selectFrom('tokens')
  .select(['id', 'address', 'total_supply'])
  .where('id', '=', tokenId);
// 结果经过 Zod 验证，类型安全保障
```

#### 2. **SQL 构建的可维护性**

**传统字符串拼接：**
```typescript
// 复杂查询难以维护，容易出错
const complexQuery = `
  SELECT t.*, 
         COUNT(tr.id) as transaction_count
  FROM tokens t
  LEFT JOIN transactions tr ON t.id = tr.token_id
  WHERE t.created_at > $1
    AND t.total_supply > $2
  GROUP BY t.id
  ORDER BY t.created_at DESC
  LIMIT $3
`;
const params = [startDate, minSupply, limit];
```

**当前架构：**
```typescript
// 链式 API，清晰易读
const complexQuery = db
  .selectFrom('tokens as t')
  .leftJoin('transactions as tr', 't.id', 'tr.token_id')
  .select([
    't.id',
    't.address', 
    't.total_supply',
    eb => eb.fn.count('tr.id').as('transaction_count')
  ])
  .where('t.created_at', '>', startDate)
  .where('t.total_supply', '>', minSupply)
  .groupBy('t.id')
  .orderBy('t.created_at', 'desc')
  .limit(limit);
```

#### 3. **重构安全性**

- **数据库 schema 变更**：Kysely 在编译时就能发现不兼容的变更
- **字段重命名**：TypeScript 编译器会标记所有需要更新的位置
- **类型变更**：自动传播到整个应用

### 解决的核心问题

#### 1. **运行时错误预防**

```typescript
// 编译时就能发现的错误
const query = db
  .selectFrom('tokens')
  .select('non_existent_field') // ❌ 编译错误
  .where('id', '=', 'invalid_type'); // ❌ 类型错误
```

#### 2. **复杂查询的可测试性**

```typescript
// 可以单独测试 SQL 生成逻辑
const compiledQuery = buildTokenQuery(filters).compile();
expect(compiledQuery.sql).toContain('WHERE');
expect(compiledQuery.parameters).toEqual([expectedValue]);
```

#### 3. **性能优化的灵活性**

- 可以轻松切换执行引擎（pg、pg-pool、其他驱动）
- 保持 Kysely 的查询构建逻辑不变
- 针对不同场景优化执行策略

## 类型校验功能详解

### 核心特性

本项目的类型校验系统提供了完整的运行时类型安全保障：

#### 1. **自动类型验证**
```typescript
// 所有数据库查询结果都会自动进行类型验证
const token = await tokenRepository.findById(1);
// token 的类型已经通过 Zod 验证，确保数据完整性
```

#### 2. **类型转换**
```typescript
// 数据库返回的类型自动转换为应用层期望的类型
const TokenTableSchema = z.object({
  id: z.number(),
  total_supply: z.bigint().transform(val => val.toString()), // bigint → string
  created_at: z.number().transform(val => new Date(val)),    // timestamp → Date
  updated_at: z.number().transform(val => new Date(val))
});
```

#### 3. **详细错误信息**
```typescript
try {
  const result = TokenTableSchema.parse(invalidData);
} catch (error) {
  if (error instanceof z.ZodError) {
    error.errors.forEach(err => {
      console.log(`${err.path.join('.')}: ${err.message}`);
    });
    // 输出：total_supply: Expected bigint, received string
  }
}
```

### QueryExecutor 方法

#### 1. **executeKyselyQuery**
```typescript
// 执行查询并返回多条记录
const tokens = await queryExecutor.executeKyselyQuery(
  db.selectFrom('tokens').selectAll(),
  TokenTableSchema
);
```

#### 2. **executeKyselyQueryOne**
```typescript
// 执行查询并返回单条记录
const token = await queryExecutor.executeKyselyQueryOne(
  db.selectFrom('tokens').selectAll().where('id', '=', 1),
  TokenTableSchema
);
```

#### 3. **executeKyselyInsert**
```typescript
// 执行插入操作并验证返回结果
const newToken = await queryExecutor.executeKyselyInsert(
  db.insertInto('tokens').values(tokenData).returningAll(),
  TokenTableSchema
);
```

#### 4. **executeKyselyUpdate**
```typescript
// 执行更新操作并验证返回结果
const updatedToken = await queryExecutor.executeKyselyUpdate(
  db.updateTable('tokens').set(updates).where('id', '=', 1).returningAll(),
  TokenTableSchema
);
```

### 使用示例

#### Repository 层实现
```typescript
class TokenRepository {
  async create(tokenData: NewToken): Promise<Token> {
    const queryBuilder = this.queryExecutor
      .getKysely()
      .insertInto('tokens')
      .values(tokenData)
      .returningAll();
    
    return await this.queryExecutor.executeKyselyInsert(
      queryBuilder,
      TokenTableSchema
    );
  }
  
  async findAll(): Promise<Token[]> {
    const queryBuilder = this.queryExecutor
      .getKysely()
      .selectFrom('tokens')
      .selectAll();
    
    return await this.queryExecutor.executeKyselyQuery(
      queryBuilder,
      TokenTableSchema
    );
  }
}
```

## 大整数精度处理

### Kysely 对大整数的影响

**Kysely 本身不会影响大整数精度**，因为：

1. **Kysely 只负责 SQL 生成**：它将 TypeScript 代码转换为标准 SQL 字符串
2. **数据传输保持原始格式**：参数以原始类型传递给执行引擎
3. **精度由执行引擎决定**：最终的数据处理由 pg 驱动负责

### 大整数处理策略

#### 1. **数据库层面**
```sql
-- 使用 NUMERIC 类型存储大整数
CREATE TABLE tokens (
  id SERIAL PRIMARY KEY,
  total_supply NUMERIC(78, 0), -- 支持 78 位整数
  balance NUMERIC(78, 0)
);
```

#### 2. **应用层面**
```typescript
// Zod Schema 定义
const TokenSchema = z.object({
  id: z.number(),
  total_supply: z.string(), // 使用字符串避免精度丢失
  balance: z.string()
});

// 业务逻辑中的处理
import { BigNumber } from 'bignumber.js';

class TokenService {
  async updateBalance(tokenId: number, amount: string) {
    const currentToken = await this.repository.findById(tokenId);
    const currentBalance = new BigNumber(currentToken.balance);
    const newBalance = currentBalance.plus(amount);
    
    return this.repository.updateBalance(tokenId, newBalance.toString());
  }
}
```

#### 3. **类型安全的大整数操作**
```typescript
// 自定义 Zod 转换器
const BigIntString = z.string().refine(
  (val) => /^\d+$/.test(val),
  { message: "必须是有效的大整数字符串" }
).transform((val) => val); // 保持字符串格式

const TokenSchema = z.object({
  total_supply: BigIntString,
  balance: BigIntString
});
```

## 技术集成方案

### 三者结合的工作流程

#### 1. **查询构建阶段（Kysely）**
```typescript
// Repository 层
class TokenRepository {
  async findById(id: number) {
    const queryBuilder = this.queryExecutor
      .getKysely()
      .selectFrom('tokens')
      .selectAll()
      .where('id', '=', id);
    
    // Kysely 编译 SQL
    const compiledQuery = queryBuilder.compile();
    // 结果：{ sql: "SELECT * FROM tokens WHERE id = $1", parameters: [id] }
  }
}
```

#### 2. **SQL 执行阶段（原生 pg）**
```typescript
// QueryExecutor 内部
class QueryExecutor {
  async executeKyselyQueryOne<T>(queryBuilder: Compilable, schema: z.ZodSchema<T>) {
    const compiledQuery = queryBuilder.compile();
    
    // 参数安全替换
    let finalSql = compiledQuery.sql;
    compiledQuery.parameters.forEach((param, index) => {
      const placeholder = `$${index + 1}`;
      const safeValue = this.formatParameter(param);
      finalSql = finalSql.replace(placeholder, safeValue);
    });
    
    // 原生 pg 执行
    const result = await this.pool.query(finalSql);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    // Zod 验证和类型转换
    return schema.parse(result.rows[0]);
  }
}
```

#### 3. **数据验证阶段（Zod）**
```typescript
// Repository 层继续
class TokenRepository {
  async findById(id: number): Promise<Token | null> {
    const queryBuilder = this.queryExecutor
      .getKysely()
      .selectFrom('tokens')
      .selectAll()
      .where('id', '=', id);
    
    // 执行查询并自动进行类型验证
    return await this.queryExecutor.executeKyselyQueryOne(
      queryBuilder,
      TokenTableSchema
    );
  }
}
```

### 错误处理和类型安全

#### 1. **编译时错误捕获**
```typescript
// 这些错误在编译时就会被发现
const query = db
  .selectFrom('nonexistent_table') // ❌ 表不存在
  .select('invalid_column')        // ❌ 列不存在
  .where('id', '=', 'string')      // ❌ 类型不匹配
```

#### 2. **运行时验证**
```typescript
// Zod 在运行时验证数据完整性
try {
  const token = TokenSchema.parse(rawData);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.log('数据验证失败:', error.errors);
    // 处理具体的验证错误
  }
}
```

## 项目结构

```
src/
├── models/                    # 数据模型层
│   └── token.ts              # Zod Schema 和类型定义
├── repositories/             # 数据访问层
│   └── token.repository.ts   # 数据库操作封装
├── services/                 # 业务逻辑层
│   └── token.service.ts      # 业务规则和数据转换
├── utils/                    # 工具层
│   └── database.ts           # 数据库连接和 QueryExecutor
├── example.ts                # 基础使用示例
└── type-validation-example.ts # 类型校验功能演示

# 项目根目录
├── ARCHITECTURE.md           # 架构设计文档（本文档）
├── TYPE_VALIDATION_GUIDE.md  # 类型校验使用指南
├── README.md                 # 项目说明文档
├── package.json              # 项目依赖配置
└── tsconfig.json             # TypeScript 配置
```

### 各层职责

#### Models 层
- 定义 Zod Schema 和验证规则
- 导出 TypeScript 类型定义
- 处理数据库类型到应用层类型的转换
- 支持 bigint、时间戳等特殊类型处理

#### Repository 层
- 封装数据库 CRUD 操作
- 使用 Kysely 构建类型安全的查询
- 调用 QueryExecutor 执行查询
- 自动进行 Zod 验证和类型转换

#### Service 层
- 实现业务逻辑和规则
- 处理复杂的数据转换和计算
- 协调多个 Repository 的操作
- 统一的错误处理和日志记录

#### Utils 层
- 数据库连接池管理
- QueryExecutor 核心实现
- Kysely 实例配置和管理
- 通用工具函数和类型定义

#### 示例和文档
- **example.ts**：基础功能使用示例
- **type-validation-example.ts**：完整的类型校验演示
- **TYPE_VALIDATION_GUIDE.md**：详细的使用指南和最佳实践

## 性能考虑

### 1. **连接池优化**
```typescript
// 分离的连接池配置
const pgPool = new Pool({
  connectionString: CONNECTION_STRING,
  max: 20,                    // 最大连接数
  idleTimeoutMillis: 30000,   // 空闲超时
  connectionTimeoutMillis: 2000 // 连接超时
});
```

### 2. **查询优化**
- Kysely 生成的 SQL 是标准的、优化的
- 支持索引提示和查询计划
- 可以轻松添加查询缓存层

### 3. **内存管理**
- 及时释放数据库连接
- Zod 验证后的对象复用
- 大结果集的流式处理

## 扩展性

### 1. **多数据库支持**
```typescript
// 可以轻松扩展到其他数据库
const mysqlExecutor = new QueryExecutor(
  createMySQLKyselyInstance(),
  createMySQLPool()
);
```

### 2. **查询缓存**
```typescript
// 在 QueryExecutor 中添加缓存层
class CachedQueryExecutor extends QueryExecutor {
  private cache = new Map();
  
  async executeKyselyQueryOne<T>(queryBuilder: Compilable) {
    const cacheKey = this.generateCacheKey(queryBuilder);
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }
    
    const result = await super.executeKyselyQueryOne(queryBuilder);
    this.cache.set(cacheKey, result);
    return result;
  }
}
```

### 3. **监控和日志**
```typescript
// 添加查询监控
class MonitoredQueryExecutor extends QueryExecutor {
  async executeKyselyQueryOne<T>(queryBuilder: Compilable) {
    const startTime = Date.now();
    const compiledQuery = queryBuilder.compile();
    
    console.log('执行查询:', compiledQuery.sql);
    
    try {
      const result = await super.executeKyselyQueryOne(queryBuilder);
      const duration = Date.now() - startTime;
      console.log(`查询完成，耗时: ${duration}ms`);
      return result;
    } catch (error) {
      console.error('查询失败:', error);
      throw error;
    }
  }
}
```

## 总结

这种创新的架构设计成功实现了：

✅ **完整的类型安全**：编译时（Kysely）和运行时（Zod）的双重类型保障  
✅ **卓越的性能**：原生 pg 连接池提供最优的执行效率  
✅ **出色的可维护性**：清晰的分层架构和职责分离  
✅ **强大的可扩展性**：模块化设计支持灵活的功能扩展  
✅ **优秀的开发体验**：完整的 IDE 支持、类型提示和错误检查  
✅ **自动类型转换**：数据库类型到应用层类型的无缝转换  
✅ **详细的错误信息**：精确的验证错误定位和描述  

### 核心价值

1. **零运行时类型错误**：所有数据库操作都经过严格的类型验证
2. **开发效率提升**：类型安全的查询构建和自动补全
3. **维护成本降低**：编译时错误检查减少生产环境问题
4. **团队协作优化**：统一的数据访问模式和清晰的接口定义

通过将 **Kysely**（类型安全的 SQL 构建）、**原生 pg**（高性能执行）和 **Zod**（运行时验证）的优势有机结合，我们构建了一个既安全又高效的现代化数据库访问层，为企业级应用的长期发展奠定了坚实的技术基础。

### 适用场景

- 🏢 **企业级应用**：需要高度类型安全和数据完整性保障
- 🚀 **高性能系统**：对数据库访问性能有严格要求
- 👥 **团队协作项目**：需要统一的开发规范和接口标准
- 🔄 **快速迭代项目**：需要在保证质量的前提下快速开发
- 📊 **数据密集型应用**：涉及复杂的数据操作和类型转换