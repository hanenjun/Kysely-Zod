import { createQueryExecutor } from './utils/database';
import { TokenService } from './services/token.service';
import { TokenRepository } from './repositories/token.repository';
import { z } from 'zod';

// 演示类型校验功能的示例
async function demonstrateTypeValidation() {
  console.log('=== 类型校验功能演示 ===\n');
  
  try {
    // 创建数据库连接
    console.log('1. 连接数据库...');
    const queryExecutor = await createQueryExecutor();
    const tokenRepository = new TokenRepository(queryExecutor);
    const tokenService = new TokenService(tokenRepository);
    
    // 正常的代币创建（应该成功）
    console.log('\n2. 创建有效代币（应该成功）...');
    const validToken = await tokenService.create({
      address: '0x1234567890123456789012345678901234567890',
      total_supply: '1000000',
      decimals: 18,
      symbol: 'VALID',
      name: 'Valid Token'
    });
    console.log('✅ 有效代币创建成功:', {
      id: validToken.id,
      symbol: validToken.symbol,
      name: validToken.name
    });
    
    // 查询代币（验证查询结果的类型校验）
    console.log('\n3. 查询代币（验证类型校验）...');
    const foundToken = await tokenService.findById(validToken.id);
    if (foundToken) {
      console.log('✅ 代币查询成功，类型校验通过:', {
        id: foundToken.id,
        symbol: foundToken.symbol,
        address: foundToken.address
      });
    }
    
    // 演示类型校验错误处理
    console.log('\n4. 演示类型校验错误处理...');
    
    // 模拟数据库返回错误格式的数据
    try {
      // 直接使用 QueryExecutor 执行一个会返回错误格式数据的查询
      const kysely = queryExecutor.getKysely();
      
      // 创建一个返回错误格式数据的查询（模拟数据损坏情况）
      const invalidQuery = kysely
        .selectFrom('tokens')
        .select([
          'id',
          'address', 
          'total_supply',
          'decimals',
          'symbol',
          'name',
          'created_at',
          'updated_at'
        ])
        .where('id', '=', validToken.id)
        .limit(1);
      
      // 正常情况下这应该成功
      const { TokenTableSchema } = await import('./models/token');
      const result = await queryExecutor.executeKyselyQueryOne(invalidQuery, TokenTableSchema);
      console.log('✅ 正常查询通过类型校验');
      
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        console.log('❌ Zod 类型校验失败:');
        error.errors.forEach(err => {
          console.log(`  - ${err.path.join('.')}: ${err.message}`);
        });
      } else {
        console.log('❌ 其他错误:', error?.message || error);
      }
    }
    
    // 演示手动类型校验
    console.log('\n5. 演示手动类型校验...');
    
    // 模拟一些可能的错误数据
    const testCases = [
      {
        name: '无效的以太坊地址',
        data: {
          id: 1,
          address: 'invalid_address', // 错误：不是有效的以太坊地址
          total_supply: BigInt('1000000'),
          decimals: 18,
          symbol: 'TEST',
          name: 'Test Token',
          created_at: Date.now(),
          updated_at: Date.now()
        }
      },
      {
        name: '无效的总供应量',
        data: {
          id: 1,
          address: '0x1234567890123456789012345678901234567890',
          total_supply: 'not_a_number', // 错误：不是bigint类型
          decimals: 18,
          symbol: 'TEST',
          name: 'Test Token',
          created_at: Date.now(),
          updated_at: Date.now()
        }
      },
      {
        name: '无效的小数位数',
        data: {
          id: 1,
          address: '0x1234567890123456789012345678901234567890',
          total_supply: BigInt('1000000'),
          decimals: 25, // 错误：超过最大值18
          symbol: 'TEST',
          name: 'Test Token',
          created_at: Date.now(),
          updated_at: Date.now()
        }
      },
      {
        name: '符号太长',
        data: {
          id: 1,
          address: '0x1234567890123456789012345678901234567890',
          total_supply: BigInt('1000000'),
          decimals: 18,
          symbol: 'VERYLONGSYMBOL', // 错误：超过10个字符
          name: 'Test Token',
          created_at: Date.now(),
          updated_at: Date.now()
        }
      }
    ];
    
    // 导入 TokenTableSchema 进行手动验证
    const { TokenTableSchema } = await import('./models/token');
    
    for (const testCase of testCases) {
      try {
        TokenTableSchema.parse(testCase.data);
        console.log(`✅ ${testCase.name}: 验证通过`);
      } catch (error) {
        if (error instanceof z.ZodError) {
          console.log(`❌ ${testCase.name}: 验证失败`);
          error.errors.forEach(err => {
            console.log(`    - ${err.path.join('.')}: ${err.message}`);
          });
        }
      }
    }
    
    // 清理：删除测试代币
    console.log('\n6. 清理测试数据...');
    await queryExecutor.end();
    console.log('✅ 数据库连接已关闭');
    
  } catch (error) {
    console.error('演示过程中发生错误:', error);
  }
}

// 运行演示
if (require.main === module) {
  demonstrateTypeValidation()
    .then(() => {
      console.log('\n=== 类型校验功能演示完成 ===');
      process.exit(0);
    })
    .catch((error) => {
      console.error('演示失败:', error);
      process.exit(1);
    });
}

export { demonstrateTypeValidation };