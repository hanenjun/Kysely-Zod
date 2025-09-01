import { createPool, DatabasePool, sql, createTypeParserPreset } from 'slonik';
import { Kysely, Compilable, Selectable } from 'kysely';
import { TokenTable } from '../models/token';
import { z } from 'zod';

// 辅助函数：将 Kysely 编译的查询转换为 Slonik 可执行的 SQL
const buildSlonikQuery = (compiledQuery: { sql: string; parameters: readonly unknown[] }) => {
  let sqlString = compiledQuery.sql;
  const params = compiledQuery.parameters;
  
  console.log('原始 SQL:', sqlString);
  console.log('参数:', params);
  
  // 手动替换参数占位符
  params.forEach((param, index) => {
    const placeholder = `$${index + 1}`;
    let value: string;
    
    if (param === null || param === undefined) {
      value = 'NULL';
    } else if (typeof param === 'string') {
      value = `'${param.replace(/'/g, "''")}'`;
    } else if (typeof param === 'number') {
      value = param.toString();
    } else if (typeof param === 'boolean') {
      value = param ? 'TRUE' : 'FALSE';
    } else {
      value = `'${String(param).replace(/'/g, "''")}'`;
    }
    
    sqlString = sqlString.replace(new RegExp('\\' + placeholder + '\\b', 'g'), value);
  });
  
  console.log('最终 SQL:', sqlString);
  
  // 使用 Function 构造函数创建 sql 模板字符串
  const createSqlQuery = new Function('sql', `return sql\`${sqlString}\`;`);
  return createSqlQuery(sql);
};

// 数据库表类型定义
export interface Database {
  tokens: TokenTable;
}

// 数据库配置
const CONNECTION_STRING = 'postgres://postgres:postgres@127.0.0.1:7543/saito_db';

// 测试 Slonik 连接
export const testSlonikConnection = async (pool: DatabasePool): Promise<void> => {
  try {
    console.log('测试 Slonik 连接...');
    const result = await pool.query(sql.unsafe`SELECT 1 as test`);
    // 类型校验测试查询结果
    const testSchema = z.object({ test: z.number() });
    const validatedRows = result.rows.map(row => testSchema.parse(row));
    console.log('Slonik 连接成功:', validatedRows);
  } catch (error) {
    console.error('Slonik 连接失败:', error);
    throw error;
  }
};

// 创建 Slonik 连接池
export const createSlonikPool = async (): Promise<DatabasePool> => {
  const connectionString = CONNECTION_STRING;
  try {
    console.log('正在连接数据库...');
    console.log('连接字符串:', connectionString);
    
    console.log('创建 Slonik 连接池...');
    
    // 创建 Slonik 连接池
    const pool = await createPool(connectionString, {
      // 配置连接池选项
      maximumPoolSize: 10,
      idleTimeout: 5000,
      typeParsers: [
        ...createTypeParserPreset(),
        {
          name: 'int8',
          parse: (value) => {
            // 将 bigint 转换为字符串
            return value;
          }
        },
        {
          name: 'timestamp',
          parse: (value) => {
            // 将 timestamp 转换为 Date 对象
            return new Date(value);
          }
        },
        {
          name: 'timestamptz',
          parse: (value) => {
            // 将 timestamptz 转换为 Date 对象
            return new Date(value);
          }
        }
      ]
    });
    
    // 测试连接
    await testSlonikConnection(pool);
    
    console.log('Slonik 连接池创建成功！');
    return pool;
  } catch (error) {
    console.error('数据库连接失败：', error);
    throw new Error(`数据库连接失败：${error instanceof Error ? error.message : '未知错误'}`);
  }
};

// 创建 Kysely 实例（仅用于 SQL 构建，不连接数据库）
export const createKyselyInstance = (): Kysely<Database> => {
  // 我们将使用一个简化的方法：创建一个 Kysely 实例但不实际连接数据库
  // 这样我们可以使用 Kysely 的 SQL 构建功能，然后用 Slonik 执行
  const { PostgresDialect } = require('kysely');
  
  // 创建一个虚拟连接池，仅用于 SQL 构建
  const mockPool = {
    connect: () => Promise.resolve({
      query: () => Promise.resolve({ rows: [] }),
      release: () => {},
    }),
    end: () => Promise.resolve(),
  };
  
  const dialect = new PostgresDialect({
    pool: mockPool as any,
  });

  return new Kysely<Database>({
    dialect,
  });
};

// 创建执行器类，使用 Kysely 生成 SQL，Slonik 执行 SQL
export class QueryExecutor {
  private readonly kysely: Kysely<Database>;

  constructor(
    kysely: Kysely<Database>,
    private readonly slonikPool: DatabasePool
  ) {
    this.kysely = kysely;
  }

  // 获取 Kysely 实例
  getKysely(): Kysely<Database> {
    return this.kysely;
  }

  // 执行 Kysely 查询 - 使用 Slonik 执行 Kysely 生成的 SQL
  async executeKyselyQuery<T extends TokenTable>(
    queryBuilder: Compilable,
    schema: z.ZodSchema<any>
  ): Promise<Selectable<T>[]> {
    try {
      // 使用 Kysely 编译 SQL
      const compiledQuery = queryBuilder.compile();
      
      // 使用 Slonik 执行查询
      const result = await this.slonikPool.query(
        buildSlonikQuery(compiledQuery)
      );
      
      // 使用 Zod 进行类型校验
      const validatedRows = result.rows.map(row => schema.parse(row));
      
      return validatedRows as unknown as Selectable<T>[];
    } catch (error) {
      console.error('查询执行失败：', error);
      throw error;
    }
  }

  // 执行单行查询 - 使用 Slonik 执行 Kysely 生成的 SQL
  async executeKyselyQueryOne<T extends TokenTable>(
    queryBuilder: Compilable,
    schema: z.ZodSchema<any>
  ): Promise<Selectable<T> | null> {
    try {
      // 使用 Kysely 编译 SQL
      const compiledQuery = queryBuilder.compile();
      
      // 使用 Slonik 执行查询
      const result = await this.slonikPool.query(
        buildSlonikQuery(compiledQuery)
      );
      
      if (result.rows.length === 0) {
        return null;
      }
      
      // 使用 Zod 进行类型校验
      const validatedResult = schema.parse(result.rows[0]);
      
      return validatedResult as Selectable<T>;
    } catch (error: any) {
      console.error('单行查询执行失败：', error);
      if (error.message && error.message.includes('DataIntegrityError')) {
        return null;
      }
      throw error;
    }
  }

  // 执行插入操作 - 使用 Slonik 执行 Kysely 生成的 SQL
  async executeKyselyInsert<T extends TokenTable>(
    queryBuilder: Compilable,
    schema: z.ZodSchema<any>
  ): Promise<Selectable<T>> {
    try {
      // 使用 Kysely 编译 SQL
      const compiledQuery = queryBuilder.compile();
      
      // 使用 Slonik 执行插入
      const result = await this.slonikPool.query(
        buildSlonikQuery(compiledQuery)
      );
      
      // 使用 Zod 进行类型校验
      const validatedResult = schema.parse(result.rows[0]);
      
      return validatedResult as Selectable<T>;
    } catch (error) {
      console.error('插入操作执行失败：', error);
      throw error;
    }
  }

  // 执行更新操作 - 使用 Slonik 执行 Kysely 生成的 SQL
  async executeKyselyUpdate<T extends TokenTable>(
    queryBuilder: Compilable,
    schema: z.ZodSchema<any>
  ): Promise<Selectable<T> | null> {
    try {
      // 使用 Kysely 编译 SQL
      const compiledQuery = queryBuilder.compile();
      
      // 使用 Slonik 执行更新
      const result = await this.slonikPool.query(
        buildSlonikQuery(compiledQuery)
      );
      
      if (result.rows.length === 0) {
        return null;
      }
      
      // 使用 Zod 进行类型校验
      const validatedResult = schema.parse(result.rows[0]);
      
      return validatedResult as Selectable<T>;
    } catch (error: any) {
      console.error('更新操作执行失败：', error);
      if (error.message && error.message.includes('DataIntegrityError')) {
        return null;
      }
      throw error;
    }
  }



  // 关闭连接
  async end(): Promise<void> {
    try {
      await this.slonikPool.end();
      console.log('Slonik 连接池已关闭');
    } catch (error) {
      console.error('关闭 Slonik 连接池失败:', error);
      throw error;
    }
  }
}

// 创建查询执行器实例
export const createQueryExecutor = async (): Promise<QueryExecutor> => {
  try {
    const slonikPool = await createSlonikPool();
    const kyselyInstance = createKyselyInstance();
    return new QueryExecutor(kyselyInstance, slonikPool);
  } catch (error) {
    console.error('创建查询执行器失败：', error);
    throw error;
  }
};