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

// Zod schema for database table (raw data from database)
export const TokenTableSchema = z.object({
  id: z.number().int().positive(),
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address format'),
  total_supply: z.string().regex(/^\d+$/, 'Total supply must be a valid number string'),
  decimals: z.number().int().min(0).max(18),
  symbol: z.string().min(1).max(10),
  name: z.string().min(1).max(100),
  created_at: z.date(),
  updated_at: z.date()
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
  created_at: Generated<Date>; // Date object from Slonik typeParser
  updated_at: Generated<Date>; // Date object from Slonik typeParser
}