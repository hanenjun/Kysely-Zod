import { Generated } from 'kysely';
import { z } from 'zod';

// Zod schema for token validation
export const TokenSchema = z.object({
  id: z.number().int().positive(),
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address format'),
  total_supply: z.string().regex(/^\d+$/, 'Total supply must be a numeric string'),
  decimals: z.number().int().min(0).max(18),
  symbol: z.string().min(1).max(10),
  name: z.string().min(1).max(100),
  created_at: z.date(),
  updated_at: z.date()
});

// Zod schema for creating new tokens (without generated fields)
export const CreateTokenSchema = TokenSchema.omit({
  id: true,
  created_at: true,
  updated_at: true
});

// Zod schema for updating tokens
export const UpdateTokenSchema = TokenSchema.partial().omit({
  id: true,
  address: true,
  created_at: true
});

// Type inference from Zod schemas
export type Token = z.infer<typeof TokenSchema>;
export type CreateToken = z.infer<typeof CreateTokenSchema>;
export type UpdateToken = z.infer<typeof UpdateTokenSchema>;

// Zod schema for database table (with Generated fields)
export const TokenTableSchema = z.object({
  id: z.number().int().positive(),
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address format'),
  total_supply: z.bigint().transform(val => val.toString()), // 数据库返回 bigint，转换为字符串
  decimals: z.number().int().min(0).max(18),
  symbol: z.string().min(1).max(10),
  name: z.string().min(1).max(100),
  created_at: z.number().transform(val => new Date(val)), // 数据库返回时间戳，转换为 Date
  updated_at: z.number().transform(val => new Date(val)) // 数据库返回时间戳，转换为 Date
});

export type TokenTableData = z.infer<typeof TokenTableSchema>;

// Kysely compatible interface for database operations
export interface TokenTable {
  id: Generated<number>;
  address: string;
  total_supply: string;
  decimals: number;
  symbol: string;
  name: string;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}