import { TokenRepository } from './repositories/token.repository';
import { TokenService } from './services/token.service';
import { createQueryExecutor, QueryExecutor, createSlonikPool } from './utils/database';
import { CreateToken, TokenTableSchema } from './models/token';
import { DatabasePool } from 'slonik';

// 添加全局未捕获异常处理
process.on('unhandledRejection', (reason, promise) => {
  console.error('未捕获的 Promise 拒绝：', reason);
});

process.on('uncaughtException', (error) => {
  console.error('未捕获的异常：', error);
});

async function main() {
  let queryExecutor: QueryExecutor | undefined;
  let slonikPool: DatabasePool | undefined;
  try {
    console.log('开始连接数据库...');
    
    queryExecutor = await createQueryExecutor();
    slonikPool = await createSlonikPool();
    console.log('数据库连接成功！');
    
    const tokenRepository = new TokenRepository(queryExecutor, slonikPool);
    const tokenService = new TokenService(tokenRepository);

    // 创建新的代币
    console.log('创建新代币...');
    const tokenData: CreateToken = {
      address: '0x1234567890123456789012345678901234567890',
      total_supply: '1000000',
      decimals: 18,
      symbol: 'MTK',
      name: 'MyToken'
    };
    const newToken = await tokenService.create(tokenData);
    console.log('新代币创建成功：', newToken);

    // 查找代币
    console.log('查找代币...');
    const token = await tokenService.findById(Number(newToken.id));
    if (!token) {
      throw new Error('代币未找到');
    }
    console.log('找到代币：', token);

    // 更新代币总供应量
    console.log('更新代币总供应量...');
    const updatedToken = await tokenService.updateTotalSupply(
      Number(token.id),
      { total_supply: '2000000' }
    );
    console.log('代币更新成功：', updatedToken);

  } catch (error) {
    console.error('发生错误:', error instanceof Error ? error.message : '未知错误');
  } finally {
    if (queryExecutor) {
      try {
        await queryExecutor.end();
      } catch (error) {
        console.error('关闭 Kysely 连接时发生错误:', error instanceof Error ? error.message : '未知错误');
      }
    }
    if (slonikPool) {
      try {
        await slonikPool.end();
      } catch (error) {
        console.error('关闭 Slonik 连接时发生错误:', error instanceof Error ? error.message : '未知错误');
      }
    }
  }
}

main();