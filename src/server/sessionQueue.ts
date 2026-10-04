/**
 * KAYDO BOT - Per-Session Isolated Asynchronous Task Queue
 * Ensures that commands within a session are processed reliably in order without ever blocking other sessions.
 */

export interface QueueTask {
  id: string;
  description: string;
  run: () => Promise<any>;
  timeoutMs: number;
  resolve: (val: any) => void;
  reject: (err: any) => void;
  createdAt: number;
}

export class SessionTaskQueue {
  private sessionId: string;
  private queue: QueueTask[] = [];
  private isProcessing: boolean = false;
  private currentTaskId: string | null = null;
  private totalCompleted: number = 0;
  private totalFailed: number = 0;
  private isPaused: boolean = false;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  /**
   * Enqueues an asynchronous task to be processed in this session's isolated queue.
   */
  public enqueue<T = any>(
    description: string,
    taskFn: () => Promise<T>,
    timeoutMs: number = 30000
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      // Prevent unbounded memory growth if queue exceeds 150 messages
      if (this.queue.length >= 150) {
        console.warn(`[QUEUE ${this.sessionId}] Queue limit reached (150 tasks). Dropping oldest pending task.`);
        const dropped = this.queue.shift();
        dropped?.reject(new Error(`Tâche expirée/annulée (surcharge de la file pour ${this.sessionId})`));
      }

      const task: QueueTask = {
        id: `task_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        description,
        run: taskFn,
        timeoutMs,
        resolve,
        reject,
        createdAt: Date.now(),
      };

      this.queue.push(task);
      this.processNext();
    });
  }

  private async processNext(): Promise<void> {
    if (this.isProcessing || this.isPaused || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const task = this.queue.shift()!;
    this.currentTaskId = task.id;

    let timeoutTimer: NodeJS.Timeout | null = null;
    let isSettled = false;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutTimer = setTimeout(() => {
        if (!isSettled) {
          isSettled = true;
          reject(new Error(`Délai d'exécution dépassé (> ${Math.round(task.timeoutMs / 1000)}s) pour "${task.description}"`));
        }
      }, task.timeoutMs);
    });

    try {
      const result = await Promise.race([
        task.run().then((val) => {
          if (!isSettled) {
            isSettled = true;
            return val;
          }
        }),
        timeoutPromise,
      ]);

      if (timeoutTimer) clearTimeout(timeoutTimer);
      this.totalCompleted++;
      task.resolve(result);
    } catch (err: any) {
      if (timeoutTimer) clearTimeout(timeoutTimer);
      this.totalFailed++;
      console.error(`[QUEUE ERROR ${this.sessionId}] Erreur lors de l'exécution de "${task.description}":`, err?.message || err);
      task.reject(err);
    } finally {
      this.isProcessing = false;
      this.currentTaskId = null;
      // Continue next task asynchronously in microtask loop
      setImmediate(() => this.processNext());
    }
  }

  public getStatus() {
    return {
      sessionId: this.sessionId,
      pendingTasks: this.queue.length,
      isProcessing: this.isProcessing,
      currentTaskId: this.currentTaskId,
      totalCompleted: this.totalCompleted,
      totalFailed: this.totalFailed,
    };
  }

  public clear(): void {
    while (this.queue.length > 0) {
      const t = this.queue.shift();
      t?.reject(new Error('File de session réinitialisée'));
    }
    this.isProcessing = false;
    this.currentTaskId = null;
  }
}
