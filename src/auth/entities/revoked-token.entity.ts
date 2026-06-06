import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('revoked_tokens')
export class RevokedToken {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 64, unique: true })
  jti: string;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  revokedAt: Date;
}
