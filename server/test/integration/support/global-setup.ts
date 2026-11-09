import {MySqlContainer} from '@testcontainers/mysql';

const MYSQL_IMAGE = 'mysql:9.7.4';

export default async function startTestDatabase() {
  const container = await new MySqlContainer(MYSQL_IMAGE).start();

  Object.assign(process.env, {
    DB_HOST: container.getHost(),
    DB_PORT: String(container.getPort()),
    DB_NAME: container.getDatabase(),
    DB_USER: container.getUsername(),
    DB_PASSWORD: container.getUserPassword(),
  });

  return async () => {
    await container.stop();
  };
}
