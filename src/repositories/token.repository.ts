import { Kysely, Selectable } from 'kysely';
import { Database, QueryExecutor } from '../utils/database';
import { TokenTable, TokenTableSchema, CreateTokenSchema } from '../models/token';
import { z } from 'zod';

export class TokenRepository {
  private readonly kysely: Kysely<Database>;

  constructor(private readonly queryExecutor: QueryExecutor) {
    this.kysely = queryExecutor.getKysely();
  }

  async create(
    address: string,
    totalSupply: string,
    decimals: number,
    symbol: string,
    name: string
  ): Promise<Selectable<TokenTable>> {
    // Validate input data using Zod schema
    const inputData = {
      address,
      total_supply: totalSupply,
      decimals,
      symbol,
      name
    };
    
    // Validate against CreateTokenSchema
    const validatedData = CreateTokenSchema.parse(inputData);
    
    const query = this.kysely
      .insertInto('tokens')
      .values({
        address: validatedData.address,
        total_supply: validatedData.total_supply,
        decimals: validatedData.decimals,
        symbol: validatedData.symbol,
        name: validatedData.name,
        created_at: new Date(),
        updated_at: new Date()
      })
      .returning([
        'id',
        'address',
        'total_supply',
        'decimals',
        'symbol',
        'name',
        'created_at',
        'updated_at'
      ]);

    const result = await this.queryExecutor.executeKyselyInsert<TokenTable>(query, TokenTableSchema);
    
    return result as Selectable<TokenTable>;
  }

  async findById(id: number): Promise<Selectable<TokenTable> | undefined> {
    // Validate ID
    const validatedId = z.number().int().positive().parse(id);
    
    const query = this.kysely
      .selectFrom('tokens')
      .selectAll()
      .where('id', '=', validatedId);

    const result = await this.queryExecutor.executeKyselyQueryOne(query, TokenTableSchema);
    
    return result as Selectable<TokenTable> | undefined;
  }

  async updateTotalSupply(
    id: number,
    totalSupply: string
  ): Promise<Selectable<TokenTable> | undefined> {
    // Validate ID
    const validatedId = z.number().int().positive().parse(id);
    
    // Validate total supply format
    const validatedTotalSupply = z.string().regex(/^\d+$/, 'Total supply must be a numeric string').parse(totalSupply);
    
    const query = this.kysely
      .updateTable('tokens')
      .set({
        total_supply: validatedTotalSupply,
        updated_at: new Date()
      })
      .where('id', '=', validatedId)
      .returning([
        'id',
        'address',
        'total_supply',
        'decimals',
        'symbol',
        'name',
        'created_at',
        'updated_at'
      ]);

    const result = await this.queryExecutor.executeKyselyUpdate(query, TokenTableSchema);
    
    return result as Selectable<TokenTable> | undefined;
  }
}