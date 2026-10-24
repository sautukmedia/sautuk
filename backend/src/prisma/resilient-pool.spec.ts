import { Pool, PoolClient } from 'pg';
import { ResilientPool } from './resilient-pool';
import { EventEmitter } from 'node:events';

describe('database connection acquisition', () => {
  const releaseClient = jest.fn();
  const client = { release: releaseClient } as unknown as PoolClient;
  afterEach(() => jest.restoreAllMocks());

  it.each(['ENOTFOUND', 'EAI_AGAIN'])(
    'retries a transient %s before handing out a connection',
    async (code) => {
      const connect = jest.spyOn(Pool.prototype, 'connect');
      connect.mockRejectedValueOnce(
        Object.assign(new Error('DNS failed'), { code }),
      );
      connect.mockResolvedValueOnce(client);
      await expect(new ResilientPool().connect()).resolves.toBe(client);
      expect(connect).toHaveBeenCalledTimes(2);
    },
  );

  it('bounds retries when DNS remains unavailable', async () => {
    const error = Object.assign(new Error('DNS failed'), { code: 'ENOTFOUND' });
    const connect = jest
      .spyOn(Pool.prototype, 'connect')
      .mockRejectedValue(error);
    await expect(new ResilientPool().connect()).rejects.toBe(error);
    expect(connect).toHaveBeenCalledTimes(3);
  });

  it('does not retry non-DNS failures', async () => {
    const error = Object.assign(new Error('Invalid password'), {
      code: '28P01',
    });
    const connect = jest
      .spyOn(Pool.prototype, 'connect')
      .mockRejectedValue(error);
    await expect(new ResilientPool().connect()).rejects.toBe(error);
    expect(connect).toHaveBeenCalledTimes(1);
  });

  it('supports callback acquisition and preserves release', async () => {
    jest.spyOn(Pool.prototype, 'connect').mockResolvedValue(client);
    await new Promise<void>((resolve, reject) => {
      new ResilientPool().connect((error, acquired, release) => {
        if (error) return reject(error);
        expect(acquired).toBe(client);
        release();
        expect(releaseClient).toHaveBeenCalled();
        resolve();
      });
    });
  });

  it('never replays SQL when a checked-out client fails', async () => {
    const error = Object.assign(new Error('Connection failed during SQL'), {
      code: 'EAI_AGAIN',
    });
    const query = jest.fn(
      (_sql: string, _values: unknown, callback: (error: Error) => void) =>
        callback(error),
    );
    const acquired = Object.assign(new EventEmitter(), {
      query,
      release: jest.fn(),
    });
    const connect = jest
      .spyOn(Pool.prototype, 'connect')
      .mockResolvedValue(acquired as unknown as PoolClient);
    await expect(
      new ResilientPool().query('UPDATE example SET value = 1'),
    ).rejects.toBe(error);
    expect(connect).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledTimes(1);
    expect(acquired.release).toHaveBeenCalledWith(error);
  });

  it('reports exhausted acquisition failures to callback callers once', async () => {
    const error = Object.assign(new Error('DNS failed'), { code: 'ENOTFOUND' });
    const connect = jest
      .spyOn(Pool.prototype, 'connect')
      .mockRejectedValue(error);
    const callback = jest.fn();
    await new Promise<void>((resolve) => {
      new ResilientPool().connect((failure, acquired) => {
        callback(failure, acquired);
        resolve();
      });
    });
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(error, undefined);
    expect(connect).toHaveBeenCalledTimes(3);
  });
});
