import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const MAX_ENTRIES = 200;
const CACHE_DIR = '.archguard';
const CACHE_FILE = 'llm-cache.json';

interface CacheEntry {
  key: string;
  value: string;
  lastAccess: number;
}

/** Monotonic counter for LRU ordering (avoids Date.now() resolution issues). */
let accessCounter = 0;

/**
 * Build a deterministic cache key from finding attributes and code snippet.
 */
export function buildCacheKey(ruleId: string, file: string, line: number, codeSnippet: string): string {
  const raw = `${ruleId}\0${file}\0${line}\0${codeSnippet}`;
  return createHash('sha256').update(raw).digest('hex');
}

/**
 * Simple in-memory + file-based LRU cache for LLM suggestions.
 */
export class LlmCache {
  private entries: Map<string, CacheEntry> = new Map();

  get(key: string): string | null {
    const entry = this.entries.get(key);
    if (!entry) return null;
    // Update access counter for LRU
    entry.lastAccess = ++accessCounter;
    return entry.value;
  }

  set(key: string, value: string): void {
    // If key already exists, update it
    if (this.entries.has(key)) {
      const entry = this.entries.get(key)!;
      entry.value = value;
      entry.lastAccess = ++accessCounter;
      return;
    }

    // Evict least-recently-used if at capacity
    if (this.entries.size >= MAX_ENTRIES) {
      this.evictLru();
    }

    this.entries.set(key, {
      key,
      value,
      lastAccess: ++accessCounter,
    });
  }

  /** Load cache from disk. Silently ignores missing or corrupt files. */
  loadFromDisk(projectRoot: string): void {
    try {
      const filePath = join(projectRoot, CACHE_DIR, CACHE_FILE);
      const raw = readFileSync(filePath, 'utf-8');
      const data: CacheEntry[] = JSON.parse(raw);
      if (!Array.isArray(data)) return;

      this.entries.clear();
      for (const entry of data) {
        if (entry && typeof entry.key === 'string' && typeof entry.value === 'string') {
          this.entries.set(entry.key, {
            key: entry.key,
            value: entry.value,
            lastAccess: typeof entry.lastAccess === 'number' ? entry.lastAccess : ++accessCounter,
          });
        }
      }
    } catch {
      // File missing or corrupt — start with empty cache
    }
  }

  /** Persist cache to disk. Creates the directory if needed. */
  saveToDisk(projectRoot: string): void {
    try {
      const dirPath = join(projectRoot, CACHE_DIR);
      mkdirSync(dirPath, { recursive: true });

      const filePath = join(dirPath, CACHE_FILE);
      const data = Array.from(this.entries.values());
      writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch {
      // Silently ignore write failures — cache is best-effort
    }
  }

  /** Return the current number of entries (for testing). */
  get size(): number {
    return this.entries.size;
  }

  private evictLru(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.entries) {
      if (entry.lastAccess < oldestTime) {
        oldestTime = entry.lastAccess;
        oldestKey = key;
      }
    }

    if (oldestKey !== null) {
      this.entries.delete(oldestKey);
    }
  }
}
