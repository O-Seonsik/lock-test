import { OnModuleDestroy } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { LockAcquisitionError } from './errors/lock-acquisition.error';

export class DistributedLockService implements OnModuleDestroy {
  private readonly lockPrefix = 'lock:';
  private readonly defaultTTL = 30000; // 30 seconds
  private acquiredLocks: Set<string> = new Set<string>();

  constructor(@InjectRedis() private readonly redis: Redis) {}

  /**
   * 분산 락 획득을 시도합니다.
   * @param key - 락의 키
   * @param ttl - 락의 유효 시간 (밀리초)
   * @returns 락 획득 성공 여부
   */
  private async acquireLock(
    key: string,
    ttl: number = this.defaultTTL,
  ): Promise<string | null> {
    const lockKey = this.getLockKey(key);
    const lockValue = uuidv4();

    const acquired = await this.redis.set(lockKey, lockValue, 'PX', ttl, 'NX');

    if (acquired === 'OK') {
      this.acquiredLocks.add(lockKey);
      return lockValue;
    }

    return null;
  }

  /**
   * 분산 락을 해제합니다.
   * @param key - 락의 키
   * @param lockValue - 락의 값 (획득 시 반환된 값)
   */
  private async releaseLock(key: string, lockValue: string): Promise<boolean> {
    const lockKey = this.getLockKey(key);

    // Lua 스크립트를 사용하여 원자적으로 락 해제
    const script = `
      if redis.call('get', KEYS[1]) == ARGV[1] then
        return redis.call('del', KEYS[1])
      else
        return 0
      end
    `;

    const result = await this.redis.eval(script, 1, lockKey, lockValue);

    if (result === 1) {
      this.acquiredLocks.delete(lockKey);
      return true;
    }

    return false;
  }

  /**
   * 락이 존재하는지 확인합니다.
   * @param key - 락의 키
   */
  async isLocked(key: string): Promise<boolean> {
    const lockKey = this.getLockKey(key);
    const exists = await this.redis.exists(lockKey);
    return exists === 1;
  }

  /**
   * 분산 락을 사용하여 작업을 실행합니다.
   * @param key - 락의 키
   * @param work - 실행할 작업
   * @param ttl - 락의 유효 시간
   * @param retryDelay
   * @param maxRetries
   * @param processId
   */
  async withLock<T>({
    key,
    work,
    ttl = this.defaultTTL,
    retryDelay = 1000,
    maxRetries = 5,
    processId,
  }: {
    key: string;
    work: () => Promise<T>;
    ttl?: number;
    retryDelay?: number; // 1 second default retry delay
    maxRetries?: number; // default max retries
    processId: number; // debugging 용 processId
  }): Promise<T> {
    let lockValue: string | null = null;
    let retries = 0;

    while (!lockValue && retries < maxRetries) {
      lockValue = await this.acquireLock(key, ttl);
      if (!lockValue) {
        retries++;
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
    }

    if (!lockValue) {
      throw new LockAcquisitionError(
        `[process${processId}]Failed to acquire lock after maximum retries`,
      );
    }

    console.log(`[process${processId}]lock 획득!`);

    try {
      console.log(`[process${processId}]lock 을 통해 작업 시작`);
      const result = await work();
      console.log(`[process${processId}]lock 을 통해 작업 완료`);
      return result;
    } finally {
      console.log(`[process${processId}]lock 반환!`);
      await this.releaseLock(key, lockValue);
    }
  }
  /**
   * 모듈이 종료될 때 획득한 모든 락을 해제합니다.
   */
  async onModuleDestroy() {
    for (const lockKey of this.acquiredLocks) {
      await this.redis.del(lockKey);
    }
    this.acquiredLocks.clear();
  }

  private getLockKey(key: string): string {
    return `${this.lockPrefix}${key}`;
  }
}
