import { describe, it, expect, vi } from 'vitest';
import { createDriversRepo } from './drivers-repo';
import type { DriverRow } from '../../types/database';

// ---------------------------------------------------------------------------
// In-memory fake Supabase client for drivers-repo tests
// Supports: .select .eq .order .insert .update(patch).eq .delete().eq
// ---------------------------------------------------------------------------

function makeDriver(overrides: Partial<DriverRow> = {}): DriverRow {
  return {
    id: crypto.randomUUID(),
    name: 'Test Driver',
    phone_e164: '+447911000000',
    active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeFakeClient(seedRows: DriverRow[] = []) {
  const _inserted: DriverRow[] = [];
  const _updated: { id: unknown; patch: object }[] = [];
  const _deleted: unknown[] = [];

  return {
    from: (_table: string) => {
      let filtered = [...seedRows];
      let _eqCol: string | null = null;
      let _eqVal: unknown = null;

      const selectBuilder: any = {
        eq(col: string, val: unknown) {
          filtered = filtered.filter((r: any) => r[col] === val);
          return selectBuilder;
        },
        order(_col: string) {
          return selectBuilder;
        },
        // Promise resolution for queries
        then(resolve: (v: any) => void) {
          return Promise.resolve({ data: filtered, error: null }).then(resolve);
        },
      };

      const updateEqBuilder = (patch: object) => ({
        eq(col: string, val: unknown) {
          const target = seedRows.find((r: any) => r[col] === val);
          if (!target) {
            return Promise.resolve({ data: null, error: new Error('Row not found') });
          }
          const updated = { ...target, ...patch };
          _updated.push({ id: val, patch });
          return Promise.resolve({ data: [updated], error: null });
        },
      });

      const deleteEqBuilder = () => ({
        eq(col: string, val: unknown) {
          const idx = seedRows.findIndex((r: any) => r[col] === val);
          if (idx === -1) {
            return Promise.resolve({ data: null, error: new Error('Row not found') });
          }
          _deleted.push(val);
          return Promise.resolve({ data: null, error: null });
        },
      });

      return {
        select: (_cols?: string) => selectBuilder,
        insert: (row: DriverRow) => {
          const withId = { ...row, id: row.id ?? crypto.randomUUID() };
          _inserted.push(withId);
          return Promise.resolve({ data: [withId], error: null });
        },
        update: updateEqBuilder,
        delete: deleteEqBuilder,
      };
    },
    _inserted,
    _updated,
    _deleted,
  };
}

function makeFakeClientWithInsertError() {
  return {
    from: (_table: string) => ({
      select: () => ({
        eq: () => ({ order: () => ({ then: (r: any) => Promise.resolve({ data: [], error: null }).then(r) }) }),
        order: () => ({ then: (r: any) => Promise.resolve({ data: [], error: null }).then(r) }),
        then: (r: any) => Promise.resolve({ data: [], error: null }).then(r),
      }),
      insert: () => Promise.resolve({ data: null, error: new Error('Insert failed') }),
      update: () => ({
        eq: () => Promise.resolve({ data: null, error: new Error('Update failed') }),
      }),
      delete: () => ({
        eq: () => Promise.resolve({ data: null, error: new Error('Delete failed') }),
      }),
    }),
  };
}

// ---------------------------------------------------------------------------
// listDrivers
// ---------------------------------------------------------------------------

describe('listDrivers', () => {
  it('returns all drivers when activeOnly is not set', async () => {
    const drivers = [
      makeDriver({ name: 'Alice', active: true }),
      makeDriver({ name: 'Bob', active: false }),
    ];
    const fake = makeFakeClient(drivers);
    const repo = createDriversRepo(fake as any);
    const result = await repo.listDrivers();
    expect(result).toHaveLength(2);
  });

  it('returns only active drivers when activeOnly=true', async () => {
    const drivers = [
      makeDriver({ name: 'Alice', active: true }),
      makeDriver({ name: 'Bob', active: false }),
    ];
    const fake = makeFakeClient(drivers);
    const repo = createDriversRepo(fake as any);
    const result = await repo.listDrivers(true);
    // The fake .eq filter reduces to active rows only
    expect(result.every((d) => d.active)).toBe(true);
  });

  it('returns empty array and warns on read error', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorClient = {
      from: () => ({
        select: () => ({
          order: () => ({ then: (r: any) => Promise.resolve({ data: null, error: new Error('DB error') }).then(r) }),
          eq: () => ({
            order: () => ({ then: (r: any) => Promise.resolve({ data: null, error: new Error('DB error') }).then(r) }),
          }),
        }),
      }),
    };
    const repo = createDriversRepo(errorClient as any);
    const result = await repo.listDrivers();
    expect(result).toEqual([]);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// insertDriver
// ---------------------------------------------------------------------------

describe('insertDriver', () => {
  it('inserts the driver and returns the created row', async () => {
    const fake = makeFakeClient();
    const repo = createDriversRepo(fake as any);
    const result = await repo.insertDriver({ name: 'Charlie', phone_e164: '+447911123456' });
    expect(result).toMatchObject({ name: 'Charlie', phone_e164: '+447911123456' });
    expect(fake._inserted).toHaveLength(1);
  });

  it('throws when the insert returns an error', async () => {
    const errorClient = makeFakeClientWithInsertError();
    const repo = createDriversRepo(errorClient as any);
    await expect(repo.insertDriver({ name: 'Bad', phone_e164: '+447000000000' })).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// updateDriver
// ---------------------------------------------------------------------------

describe('updateDriver', () => {
  it('issues an update with active=false for the target id (deactivate)', async () => {
    const driver = makeDriver({ id: 'driver-id-1', active: true });
    const fake = makeFakeClient([driver]);
    const repo = createDriversRepo(fake as any);
    const result = await repo.updateDriver('driver-id-1', { active: false });
    expect(fake._updated).toHaveLength(1);
    expect(fake._updated[0].id).toBe('driver-id-1');
    expect((fake._updated[0].patch as any).active).toBe(false);
    expect(result.active).toBe(false);
  });

  it('throws when the update returns an error', async () => {
    const errorClient = makeFakeClientWithInsertError();
    const repo = createDriversRepo(errorClient as any);
    await expect(
      repo.updateDriver('some-id', { active: false }),
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// deleteDriver
// ---------------------------------------------------------------------------

describe('deleteDriver', () => {
  it('issues a hard delete for the target id', async () => {
    const driver = makeDriver({ id: 'driver-del-1' });
    const fake = makeFakeClient([driver]);
    const repo = createDriversRepo(fake as any);
    await repo.deleteDriver('driver-del-1');
    expect(fake._deleted).toContain('driver-del-1');
  });

  it('throws when the delete returns an error', async () => {
    const errorClient = makeFakeClientWithInsertError();
    const repo = createDriversRepo(errorClient as any);
    await expect(repo.deleteDriver('some-id')).rejects.toThrow();
  });
});
