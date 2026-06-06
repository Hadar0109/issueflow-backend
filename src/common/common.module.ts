import { Global, Module } from '@nestjs/common';
import { TransactionRunner } from './database/transaction-runner';
import { CLOCK, SystemClock } from './utils/clock';

@Global()
@Module({
  providers: [
    TransactionRunner,
    { provide: CLOCK, useClass: SystemClock },
  ],
  exports: [TransactionRunner, CLOCK],
})
export class CommonModule {}
