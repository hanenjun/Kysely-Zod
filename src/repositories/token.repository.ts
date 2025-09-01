import { Selectable } from 'kysely';
import { TokenTable, CreateTokenSchema, UpdateTokenSchema, TokenTableSchema, TokenTableData } from '../models/token';
import { QueryExecutor } from '../utils/database';
import { DatabasePool, sql } from 'slonik';
import { z } from 'zod';

export class TokenRepository {
  constructor(
    private readonly queryExecutor: QueryExecutor,
    private readonly slonikPool: DatabasePool
  ) {}

  async create(data: z.infer<typeof CreateTokenSchema>): Promise<TokenTableData> {
    // 使用 Zod 验证输入数据
    const validatedData = CreateTokenSchema.parse(data);
    
    const now = new Date().toISOString();
    
    // 直接使用 Slonik 的 SQL 构建
    const result = await this.slonikPool.query(sql.type(TokenTableSchema)`
      INSERT INTO tokens (address, total_supply, decimals, symbol, name, created_at, updated_at)
      VALUES (${validatedData.address}, ${validatedData.total_supply}, ${validatedData.decimals}, ${validatedData.symbol}, ${validatedData.name}, ${now}, ${now})
      RETURNING id, address, total_supply, decimals, symbol, name, created_at, updated_at
    `);
    
    if (result.rows.length === 0) {
      throw new Error('插入失败');
    }
    
    // 使用 Zod 验证返回结果
    const validatedResult = TokenTableSchema.parse(result.rows[0]);
    
    return validatedResult;
  }

  async findById(id: number): Promise<TokenTableData | undefined> {
    // Validate ID
    const validatedId = z.number().int().positive().parse(id);
    
    // 直接使用 Slonik 的 SQL 构建
    const result = await this.slonikPool.query(sql.type(TokenTableSchema)`
      SELECT id, address, total_supply, decimals, symbol, name, created_at, updated_at
      FROM tokens
      WHERE id = ${id}
    `);
    
    if (result.rows.length === 0) {
      return undefined;
    }
    
    // 使用 Zod 验证返回结果
    const validatedResult = TokenTableSchema.parse(result.rows[0]);
    
    return validatedResult;
  }

  async updateTotalSupply(
    id: number,
    totalSupply: string
  ): Promise<TokenTableData | undefined> {
    // Validate ID
    const validatedId = z.number().int().positive().parse(id);
    
    // Validate total supply format
    const validatedTotalSupply = z.string().regex(/^\d+$/, 'Total supply must be a numeric string').parse(totalSupply);
    
    const now = new Date().toISOString();
    
    // 直接使用 Slonik 的 SQL 构建
    const result = await this.slonikPool.query(sql.type(TokenTableSchema)`
      UPDATE tokens
      SET total_supply = ${totalSupply}, updated_at = ${now}
      WHERE id = ${id}
      RETURNING id, address, total_supply, decimals, symbol, name, created_at, updated_at
    `);
    
    if (result.rows.length === 0) {
      return undefined;
    }
    
    // 使用 Zod 验证返回结果
    const validatedResult = TokenTableSchema.parse(result.rows[0]);
    
    return validatedResult;
  }
}