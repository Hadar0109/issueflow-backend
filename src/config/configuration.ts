export default () => ({
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret',
  jwtExpiresIn: parseInt(process.env.JWT_EXPIRES_IN ?? '3600', 10),
  attachmentsPath: process.env.ATTACHMENTS_PATH ?? './storage/attachments',
});
