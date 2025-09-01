import { TokenRepository } from '../repositories/token.repository';
import { CreateTokenSchema, UpdateTokenSchema, CreateToken, UpdateToken, TokenSchema, TokenTable, TokenTableSchema, TokenTableData } from '../models/token';
import { Selectable } from 'kysely';
import { z } from 'zod';

export class TokenService {
  constructor(private readonly tokenRepository: TokenRepository) {}

  async create(tokenData: CreateToken): Promise<TokenTableData> {
    // Validate input data using Zod schema
    const validatedData = CreateTokenSchema.parse(tokenData);
    
    const result = await this.tokenRepository.create(validatedData);
    
    // 使用 TokenTableSchema 进行额外的类型验证和转换
    return TokenTableSchema.parse(result);
  }

  async findById(id: number): Promise<TokenTableData | undefined> {
    // Validate ID
    const validatedId = z.number().int().positive().parse(id);
    const result = await this.tokenRepository.findById(validatedId);
    
    if (!result) {
      return undefined;
    }
    
    // 使用 TokenTableSchema 进行类型验证和转换
    return TokenTableSchema.parse(result);
  }

  async updateTotalSupply(
    id: number,
    updateData: Pick<UpdateToken, 'total_supply'>
  ): Promise<TokenTableData | undefined> {
    // Validate input data
    const validatedId = z.number().int().positive().parse(id);
    const validatedData = UpdateTokenSchema.pick({ total_supply: true }).parse(updateData);
    
    const result = await this.tokenRepository.updateTotalSupply(validatedId, validatedData.total_supply!);
    
    if (!result) {
      return undefined;
    }
    
    // 使用 TokenTableSchema 进行类型验证和转换
    return TokenTableSchema.parse(result);
  }
}