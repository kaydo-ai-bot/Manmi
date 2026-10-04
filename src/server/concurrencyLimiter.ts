/**
 * KAYDO BOT - Global Concurrency Limiters
 * Prevents CPU & RAM spikes on Railway when handling up to 100 concurrent WhatsApp sessions.
 */

export class AsyncSemaphore {
  private maxConcurrency: number;
  private currentRunning: number = 0;
  private queue: Array<() => void> = [];

  constructor(maxConcurrency: number) {
    this.maxConcurrency = Math.max(1, maxConcurrency);
  }

  public setLimit(newLimit: number): void {
    this.maxConcurrency = Math.max(1, newLimit);
  }

  public getLimit(): number {
    return this.maxConcurrency;
  }

  public getRunningCount(): number {
    return this.currentRunning;
  }

  public getQueueLength(): number {
    return this.queue.length;
  }

  public async acquire(): Promise<() => void> {
    if (this.currentRunning < this.maxConcurrency) {
      this.currentRunning++;
      let released = false;
      return () => {
        if (!released) {
          released = true;
          this.release();
        }
      };
    }

    return new Promise<() => void>((resolve) => {
      this.queue.push(() => {
        this.currentRunning++;
        let released = false;
        resolve(() => {
          if (!released) {
            released = true;
            this.release();
          }
        });
      });
    });
  }

  private release(): void {
    this.currentRunning--;
    if (this.queue.length > 0 && this.currentRunning < this.maxConcurrency) {
      const next = this.queue.shift();
      if (next) next();
    }
  }

  public async runExclusive<T>(taskFn: () => Promise<T>): Promise<T> {
    const release = await this.acquire();
    try {
      return await taskFn();
    } finally {
      release();
    }
  }
}

// Configurable Semaphores
export const SESSION_START_CONCURRENCY = parseInt(process.env.SESSION_START_CONCURRENCY || '10', 10);
export const DOWNLOAD_CONCURRENCY = parseInt(process.env.DOWNLOAD_CONCURRENCY || '8', 10);
export const DATABASE_CONCURRENCY = parseInt(process.env.DATABASE_CONCURRENCY || '15', 10);
export const API_CONCURRENCY = parseInt(process.env.API_CONCURRENCY || '20', 10);

export const sessionStartLimiter = new AsyncSemaphore(SESSION_START_CONCURRENCY);
export const downloadLimiter = new AsyncSemaphore(DOWNLOAD_CONCURRENCY);
export const databaseLimiter = new AsyncSemaphore(DATABASE_CONCURRENCY);
export const apiLimiter = new AsyncSemaphore(API_CONCURRENCY);
