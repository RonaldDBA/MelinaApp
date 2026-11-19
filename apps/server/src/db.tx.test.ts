import { describe, expect, it } from 'vitest';
import { tx, type DB } from './db';

/** Fake database: records the commands and can fail on BEGIN (database busy with another process). */
function fakeDb(failBegin: number) {
  const log: string[] = [];
  let fails = failBegin;
  const db = {
    exec(sql: string) {
      if (sql === 'BEGIN IMMEDIATE' && fails-- > 0) throw new Error('database is locked');
      log.push(sql);
    },
  } as unknown as DB;
  return { db, log };
}

describe('tx', () => {
  it('a failing BEGIN (database busy) does not leave the following transactions switched off', () => {
    const { db, log } = fakeDb(1);
    expect(() => tx(db, () => 1)).toThrow(/locked/);
    // the next call must open a real transaction, not run in autocommit
    expect(tx(db, () => 2)).toBe(2);
    expect(log).toEqual(['BEGIN IMMEDIATE', 'COMMIT']);
  });

  it('an error inside the transaction triggers ROLLBACK and rethrows the original error, even if ROLLBACK fails', () => {
    const log: string[] = [];
    const db = {
      exec(sql: string) {
        log.push(sql);
        if (sql === 'ROLLBACK') throw new Error('no transaction is active');
      },
    } as unknown as DB;
    expect(() =>
      tx(db, () => {
        throw new Error('original error');
      }),
    ).toThrow('original error');
    expect(tx(db, () => 3)).toBe(3);
    expect(log).toEqual(['BEGIN IMMEDIATE', 'ROLLBACK', 'BEGIN IMMEDIATE', 'COMMIT']);
  });

  it('ROLLBACK fails with the transaction still open: retries, and the next transaction opens normally', () => {
    const log: string[] = [];
    let open = false;
    let failRollback = 1;
    const db = {
      get isTransaction() {
        return open;
      },
      exec(sql: string) {
        if (sql === 'BEGIN IMMEDIATE') {
          if (open) throw new Error('cannot start a transaction within a transaction');
          open = true;
        }
        if (sql === 'ROLLBACK' && failRollback-- > 0) throw new Error('rollback failed');
        if (sql === 'ROLLBACK' || sql === 'COMMIT') open = false;
        log.push(sql);
      },
    } as unknown as DB;
    expect(() =>
      tx(db, () => {
        throw new Error('original error');
      }),
    ).toThrow('original error');
    expect(tx(db, () => 4)).toBe(4);
  });

  it('an old transaction was left open (both ROLLBACKs failed): the next one rolls it back and opens again', () => {
    let open = true; // left open
    const db = {
      get isTransaction() {
        return open;
      },
      exec(sql: string) {
        if (sql === 'BEGIN IMMEDIATE') {
          if (open) throw new Error('cannot start a transaction within a transaction');
          open = true;
        }
        if (sql === 'ROLLBACK' || sql === 'COMMIT') open = false;
      },
    } as unknown as DB;
    expect(tx(db, () => 5)).toBe(5);
    expect(open).toBe(false);
  });
});

