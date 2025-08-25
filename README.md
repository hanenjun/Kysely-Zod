# Web3 数据解决方案 (Kysely + 原生 pg + Zod)

这是一个基于 Kysely、原生 pg 和 Zod 的现代化 Web3 数据解决方案，**完全使用 Zod 进行类型定义**，提供类型安全的数据库操作和强大的运行时类型验证功能。

## 核心特性

### 🔒 类型安全
- **编译时类型安全**：Kysely 提供完整的 TypeScript 类型推断
- **运行时类型验证**：Zod 确保数据完整性和格式正确性
- **自动类型转换**：数据库类型到应用层类型的无缝转换

### 🚀 高性能架构
- **原生 pg 驱动**：直接使用 PostgreSQL 原生驱动获得最佳性能
- **连接池管理**：高效的数据库连接复用
- **查询优化**：Kysely 生成优化的 SQL 查询

### 🛡️ 数据验证
- **以太坊地址验证**：自动验证 0x 开头的 40 位十六进制地址
- **大整数处理**：安全的 BigInt 字符串验证和转换
- **范围和格式验证**：decimals、symbol、name 等字段的严格验证
- **详细错误信息**：精确定位验证失败的字段和原因

### 🏗️ 架构设计
- **分层架构**：Models、Repository、Service 清晰的职责分离
- **模块化设计**：易于扩展和维护的代码结构
- **统一接口**：标准化的数据访问模式

## 项目结构

```
src/
  ├── models/                    # 数据模型和 Zod Schema 定义
  │   ├── token.ts              # Token 相关的类型定义和验证规则
  │   └── database.ts           # 数据库表结构定义
  ├── repositories/              # 数据访问层
  │   └── token.repository.ts   # Token 数据库操作封装
  ├── services/                  # 业务逻辑层
  │   └── token.service.ts      # Token 业务逻辑处理
  ├── utils/                     # 工具类和辅助函数
  │   ├── database.ts           # 数据库连接和查询执行器
  │   └── bigint.ts             # 大整数处理工具
  ├── example.ts                # 基础功能演示
  └── type-validation-example.ts # 类型校验功能演示
docs/
  ├── ARCHITECTURE.md           # 架构设计文档
  └── TYPE_VALIDATION_GUIDE.md  # 类型校验使用指南
```

## 安装

```bash
npm install
```

## 使用方法

### 1. 数据模型定义

使用 Zod schema 定义数据模型，提供强大的运行时验证：

```typescript
// models/token.ts
import { z } from 'zod';
import { BigIntString } from '../utils/bigint';

// 数据库表 Schema（用于数据库操作的类型验证）
export const TokenTableSchema = z.object({
  id: z.number().int().positive(),
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address format'),
  total_supply: BigIntString, // 自定义 BigInt 字符串验证器
  decimals: z.number().int().min(0).max(18),
  symbol: z.string().min(1).max(10),
  name: z.string().min(1).max(100),
  created_at: z.number(), // Unix 时间戳
  updated_at: z.number() // Unix 时间戳
});

// 应用层 Schema（用于业务逻辑的类型验证）
export const TokenSchema = z.object({
  id: z.number().int().positive(),
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address format'),
  total_supply: z.bigint(), // 应用层使用 BigInt 类型
  decimals: z.number().int().min(0).max(18),
  symbol: z.string().min(1).max(10),
  name: z.string().min(1).max(100),
  created_at: z.date(),
  updated_at: z.date()
});

// 创建 Token 的 schema（排除自动生成的字段）
export const CreateTokenSchema = TokenSchema.omit({
  id: true,
  created_at: true,
  updated_at: true
});

// 更新 Token 的 schema
export const UpdateTokenSchema = TokenSchema.partial().omit({
  id: true,
  address: true,
  created_at: true
});

// 类型推断
export type Token = z.infer<typeof TokenSchema>;
export type CreateToken = z.infer<typeof CreateTokenSchema>;
export type UpdateToken = z.infer<typeof UpdateTokenSchema>;
export type TokenTable = z.infer<typeof TokenTableSchema>;
```

### 2. 服务层使用

服务层自动进行数据验证和类型转换：

```typescript
import { tokenService } from './services/token.service';

// 创建代币（自动进行类型验证）
const tokenData: CreateToken = {
  address: '0x1234567890123456789012345678901234567890',
  total_supply: 1000000n, // 使用 BigInt 类型
  decimals: 18,
  symbol: 'MTK',
  name: 'MyToken'
};

const newToken = await tokenService.create(tokenData);
console.log('Created token:', newToken);

// 查找代币（自动进行类型校验）
const foundToken = await tokenService.findById(1);
if (foundToken) {
  console.log('Found token:', foundToken);
}

// 更新代币（部分更新）
const updatedToken = await tokenService.update(1, {
  total_supply: 2000000n,
  name: 'Updated MyToken'
});
console.log('Updated token:', updatedToken);
```

### 3. 类型校验功能

本项目实现了完整的类型校验架构，提供编译时和运行时的双重类型安全保障：

#### 🔍 自动类型校验

所有数据库操作都会自动进行类型校验：

```typescript
// Repository 层自动校验
const token = await tokenRepository.findById(1); // 自动校验返回结果
const newToken = await tokenRepository.create(tokenData); // 自动校验输入和输出
```

#### 🛠️ QueryExecutor 集成

`QueryExecutor` 提供了内置的类型校验方法：

```typescript
// 自动校验的查询方法
const result = await queryExecutor.executeKyselyQueryOne(
  query,
  TokenTableSchema // 传入 Schema 进行自动校验
);
```

#### ✅ 验证特性

- **以太坊地址验证**: 自动验证 `0x` 开头的 40 位十六进制地址
- **BigInt 字符串验证**: 安全的大整数字符串格式验证
- **范围验证**: `decimals` 限制在 0-18 之间
- **长度验证**: `symbol` (1-10字符) 和 `name` (1-100字符) 的长度限制
- **类型转换**: 数据库类型到应用层类型的自动转换
- **详细错误**: 精确定位验证失败的字段和原因

#### 🎯 演示示例

运行类型校验演示：

```bash
npx ts-node src/type-validation-example.ts
```

该示例展示了：
- ✅ 有效数据的成功验证
- ❌ 无效数据的错误捕获
- 🔄 自动类型转换过程
- 📝 详细的错误信息输出

## 🔢 大整数处理

项目提供了完整的大整数处理解决方案，确保精度安全：

### BigIntString 验证器

```typescript
// utils/bigint.ts
export const BigIntString = z.string()
  .regex(/^\d+$/, 'Must be a numeric string')
  .transform((val) => val) // 保持字符串格式
  .refine((val) => {
    try {
      BigInt(val);
      return true;
    } catch {
      return false;
    }
  }, 'Invalid BigInt format');
```

### 类型转换工具

```typescript
// 字符串 ↔ BigInt 转换
export const stringToBigInt = (str: string): bigint => BigInt(str);
export const bigIntToString = (bigint: bigint): string => bigint.toString();
```

### 数据流转换

- **数据库层**: 使用 `NUMERIC` 类型存储，查询返回字符串
- **Repository层**: 使用 `BigIntString` 验证器确保格式正确
- **Service层**: 自动转换为 `BigInt` 类型供业务逻辑使用

## 📚 示例和文档

### 运行示例

```bash
# 基础功能演示
npx ts-node src/example.ts

# 类型校验功能演示
npx ts-node src/type-validation-example.ts
```

### 文档资源

- 📖 [架构设计文档](docs/ARCHITECTURE.md) - 详细的技术架构说明
- 🛠️ [类型校验指南](docs/TYPE_VALIDATION_GUIDE.md) - 类型校验功能使用指南

## ⚠️ 重要注意事项

1. **大整数存储**: 数据库中使用 `NUMERIC` 类型，应用层使用 `BigInt`
2. **类型校验**: 所有数据库操作都会自动进行类型验证
3. **错误处理**: 注意捕获和处理 Zod 验证错误
4. **性能考虑**: 大量数据操作时注意连接池配置
5. **类型安全**: 充分利用 TypeScript 和 Zod 的类型推断能力

## 🚀 快速开始

1. 安装依赖：`npm install`
2. 配置数据库连接
3. 运行示例：`npx ts-node src/example.ts`
4. 查看文档：`docs/ARCHITECTURE.md`