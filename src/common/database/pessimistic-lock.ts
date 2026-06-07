import { ConflictException } from '@nestjs/common';
import { EntityManager, EntityTarget, ObjectLiteral, QueryFailedError } from 'typeorm';

function isLockNotAvailable(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) {
    return false;
  }
  const driverError = (error as QueryFailedError & { driverError?: { code?: string } })
    .driverError;
  return driverError?.code === '55P03';
}

export async function lockRowForUpdateNowait<T extends ObjectLiteral>(
  manager: EntityManager,
  entity: EntityTarget<T>,
  alias: string,
  idColumn: string,
  id: number,
): Promise<T | null> {
  try {
    return await manager
      .createQueryBuilder(entity, alias)
      .setLock('pessimistic_write_or_fail')
      .where(`${alias}.${idColumn} = :id`, { id })
      .getOne();
  } catch (error) {
    if (isLockNotAvailable(error)) {
      throw new ConflictException(
        'This resource is being updated by another request. Please retry.',
      );
    }
    throw error;
  }
}
