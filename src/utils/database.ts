import { createPool, DatabasePool, sql } from 'slonik';
import { Kysely, PostgresDialect, Compilable, Selectable } from 'kysely';
import { Pool, Client } from 'pg';
import { TokenTable } from '../models/token';
import { z } from 'zod';

// 数据库表类型定义
export interface Database {
  tokens: TokenTable;
}

// 数据库配置
const CONNECTION_STRING = 'postgres://postgres:postgres@127.0.0.1:7543/saito_db';

// 测试原生pg连接
export const testPgConnection = async (): Promise<void> => {
  const client = new Client({
    connectionString: CONNECTION_STRING,
  });
  
  try {
    console.log('使用原生pg客户端连接...');
    await client.connect();
    const result = await client.query('SELECT 1 as test');
    // 类型校验测试查询结果
    const testSchema = z.object({ test: z.number() });
    const validatedRows = result.rows.map(row => testSchema.parse(row));
    console.log('原生pg连接成功:', validatedRows);
    await client.end();
  } catch (error) {
    console.error('原生pg连接失败:', error);
    throw error;
  }
};

// 创建 Slonik 连接池
export const createSlonikPool = async (): Promise<DatabasePool> => {
  const connectionString = CONNECTION_STRING;
  try {
    console.log('正在连接数据库...');
    console.log('连接字符串:', connectionString);
    
    // 先测试原生连接
    await testPgConnection();
    
    console.log('创建Slonik连接池...');
    
    // 使用最简配置
    const pool = createPool(connectionString);
    
    console.log('Slonik连接池创建成功！');
    return pool;
  } catch (error) {
    console.error('数据库连接失败：', error);
    throw new Error(`数据库连接失败：${error instanceof Error ? error.message : '未知错误'}`);
  }
};

// 创建 Kysely 实例
export const createKyselyInstance = (): Kysely<Database> => {
  const pool = new Pool({
    connectionString: CONNECTION_STRING,
  });

  const dialect = new PostgresDialect({
    pool,
  });

  return new Kysely<Database>({
    dialect,
  });
};

// 创建执行器类，使用 Kysely 生成 SQL，Slonik 执行 SQL
export class QueryExecutor {
  private readonly kysely: Kysely<Database>;
  private readonly pgPool: Pool;

  constructor(
    kysely: Kysely<Database>,
    private readonly slonikPool: DatabasePool
  ) {
    this.kysely = kysely;
    // 创建原生 pg 连接池用于执行 Kysely 生成的 SQL
    this.pgPool = new Pool({
      connectionString: CONNECTION_STRING,
    });
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
      
      // 构建 SQL 查询
      const finalSql = this.buildFinalSql(compiledQuery.sql, compiledQuery.parameters);
      
      // 使用 Slonik 执行查询
      const result = await this.slonikPool.query(sql.unsafe([finalSql]));
      
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
      
      // 构建 SQL 查询
      const finalSql = this.buildFinalSql(compiledQuery.sql, compiledQuery.parameters);
      
      // 使用 Slonik 执行查询
      const result = await this.slonikPool.one(sql.unsafe([finalSql]));
      
      // 使用 Zod 进行类型校验
      const validatedResult = schema.parse(result);
      
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
      
      // 构建 SQL 查询
      const finalSql = this.buildFinalSql(compiledQuery.sql, compiledQuery.parameters);
      
      // 使用 Slonik 执行查询
      const result = await this.slonikPool.one(sql.unsafe([finalSql]));
      
      // 使用 Zod 进行类型校验
      const validatedResult = schema.parse(result);
      
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
      
      // 构建 SQL 查询
      const finalSql = this.buildFinalSql(compiledQuery.sql, compiledQuery.parameters);
      
      // 使用 Slonik 执行查询
      const result = await this.slonikPool.one(sql.unsafe([finalSql]));
      
      // 使用 Zod 进行类型校验
      const validatedResult = schema.parse(result);
      
      return validatedResult as Selectable<T>;
    } catch (error: any) {
      console.error('更新操作执行失败：', error);
      if (error.message && error.message.includes('DataIntegrityError')) {
        return null;
      }
      throw error;
    }
  }

  // 构建最终 SQL
  private buildFinalSql(sqlTemplate: string, parameters: readonly unknown[]): string {
    // 手动替换参数占位符为实际值
    let finalSql = sqlTemplate;
    const params = [...parameters];
    
    // 手动替换参数占位符为实际值
    for (let i = 0; i < params.length; i++) {
      const placeholder = `$${i + 1}`;
      const param = params[i];
      let value: string;
      
      if (typeof param === 'string') {
        value = `'${param.replace(/'/g, "''")}'`;
      } else if (param instanceof Date) {
        value = `'${param.toISOString()}'`;
      } else if (typeof param === 'number') {
        value = String(param);
      } else if (param === null || param === undefined) {
        value = 'NULL';
      } else {
        value = `'${String(param).replace(/'/g, "''")}'`;
      }
      
      finalSql = finalSql.replace(placeholder, value);
    }
    
    return finalSql;
  }

  // 关闭连接
  async end(): Promise<void> {
    try {
      await this.slonikPool.end();
      await this.pgPool.end();
      console.log('数据库连接已关闭');
    } catch (error) {
      console.error('关闭数据库连接时出错：', error);
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