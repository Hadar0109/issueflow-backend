import { DataSource, DataSourceOptions } from 'typeorm';
import { config } from 'dotenv';
import { User } from '../users/entities/user.entity';
import { RevokedToken } from '../auth/entities/revoked-token.entity';
import { Project } from '../projects/entities/project.entity';
import { ProjectMember } from '../projects/entities/project-member.entity';
import { Ticket } from '../tickets/entities/ticket.entity';
import { Comment } from '../comments/entities/comment.entity';
import { Mention } from '../comments/entities/mention.entity';
import { TicketDependency } from '../dependencies/entities/ticket-dependency.entity';
import { Attachment } from '../attachments/entities/attachment.entity';
import { AuditLog } from '../audit/entities/audit-log.entity';

config();

export const typeOrmOptions: DataSourceOptions = {
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [
    User,
    RevokedToken,
    Project,
    ProjectMember,
    Ticket,
    Comment,
    Mention,
    TicketDependency,
    Attachment,
    AuditLog,
  ],
  migrations: [
    __dirname + '/migrations/*{.ts,.js}',
  ],
  synchronize: false,
  logging: false,
};

const dataSource = new DataSource(typeOrmOptions);
export default dataSource;
