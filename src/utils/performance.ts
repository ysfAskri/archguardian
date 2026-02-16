import { logger } from './logger.js';

export interface TimingResult<T> {
  result: T;
  duration: number;
}

export async function timed<T>(label: string, fn: () => Promise<T>): Promise<TimingResult<T>> {
  const start = performance.now();
  const result = await fn();
  const duration = performance.now() - start;
  logger.debug(`${label}: ${duration.toFixed(1)}ms`);
  return { result, duration };
}

export async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}
