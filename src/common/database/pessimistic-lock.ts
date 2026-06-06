import { ConflictException } from '@nestjs/common';
import { EntityManager, EntityTarget, ObjectLiteral } from 'typeorm';

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
  } catch {
    throw new ConflictException(
      'This resource is being updated by another request. Please retry.',
    );
  }
}
