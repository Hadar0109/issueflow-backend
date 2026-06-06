import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { typeOrmOptions } from './data-source';

const typeOrmRoot = TypeOrmModule.forRoot(typeOrmOptions);

@Module({
  imports: [typeOrmRoot],
  exports: [typeOrmRoot],
})
export class DatabaseModule {}
