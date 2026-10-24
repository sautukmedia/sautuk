import { Pool, type PoolClient, type PoolConfig } from 'pg';
import { setTimeout as delay } from 'node:timers/promises';

type ConnectCallback = Parameters<Pool['connect']>[0];

export class ResilientPool extends Pool {
  constructor(config: PoolConfig = {}) {
    super({ query_timeout: 10000, ...config });
  }

  override connect(): Promise<PoolClient>;
  override connect(callback: ConnectCallback): void;
  override connect(callback?: ConnectCallback): Promise<PoolClient> | void {
    const acquisition = this.acquireWithDnsRetry();
    if (!callback) return acquisition;
    void acquisition.then(
      (client) => callback(undefined, client, client.release.bind(client)),
      (error: unknown) =>
        callback(
          error instanceof Error
            ? error
            : new Error('Database connection failed'),
          undefined,
          () => {},
        ),
    );
  }

  private async acquireWithDnsRetry(): Promise<PoolClient> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await super.connect();
      } catch (error) {
        const code =
          error instanceof Error && 'code' in error ? error.code : undefined;
        // Only retry failed acquisition. No SQL or transaction is replayed.
        if (
          attempt >= 2 ||
          this.ending ||
          (code !== 'ENOTFOUND' && code !== 'EAI_AGAIN')
        ) {
          throw error;
        }
        await delay(attempt === 0 ? 100 : 250);
      }
    }
  }
}
