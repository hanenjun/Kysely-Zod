import { TokenRepository } from '../repositories/token.repository';
import { CreateTokenSchema, UpdateTokenSchema, CreateToken, UpdateToken, TokenSchema } from '../models/token';
import { Selectable } from 'kysely';
import { z } from 'zod';

export class TokenService {
  constructor(private readonly tokenRepository: TokenRepository) {}

  async create(tokenData: CreateToken): Promise<Selectable<z.infer<typeof TokenSchema>>> {
    // Validate input data using Zod schema
    const validatedData = CreateTokenSchema.parse(tokenData);
    
    return this.tokenRepository.create(
      validatedData.address,
      validatedData.total_supply,
      validatedData.decimals,
      validatedData.symbol,
      validatedData.name
    );
  }

  async findById(id: number): Promise<Selectable<z.infer<typeof TokenSchema>> | undefined> {
    // Validate ID
    const validatedId = z.number().int().positive().parse(id);
    return this.tokenRepository.findById(validatedId);
  }

  async updateTotalSupply(
    id: number,
    updateData: Pick<UpdateToken, 'total_supply'>
  ): Promise<Selectable<z.infer<typeof TokenSchema>> | undefined> {
    // Validate input data
    const validatedId = z.number().int().positive().parse(id);
    const validatedData = UpdateTokenSchema.pick({ total_supply: true }).parse(updateData);
    
    return this.tokenRepository.updateTotalSupply(validatedId, validatedData.total_supply!);
  }
}