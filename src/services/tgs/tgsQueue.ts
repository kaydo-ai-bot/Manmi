interface QueueTask<T> {
  fn: () => Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: any) => void;
}

export class TgsQueue {
  private concurrency: number;
  private activeCount = 0;
  private queue: QueueTask<any>[] = [];

  constructor(concurrency = 3) {
    this.concurrency = concurrency;
  }

  public async add<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this.processNext();
    });
  }

  private processNext() {
    if (this.activeCount >= this.concurrency || this.queue.length === 0) {
      return;
    }

    const task = this.queue.shift();
    if (!task) return;

    this.activeCount++;
    task.fn()
      .then(task.resolve)
      .catch(task.reject)
      .finally(() => {
        this.activeCount--;
        this.processNext();
      });
  }
}
