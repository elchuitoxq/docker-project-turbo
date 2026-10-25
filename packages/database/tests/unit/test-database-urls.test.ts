import { describe, expect, it } from 'vitest';
import { validateLocalUrl } from '../../src/scripts/test-database-urls';

describe('test database URL validation', () => {
  it('accepts the expected local test database and port', () => {
    expect(
      validateLocalUrl(
        'DATABASE_TEST_URL',
        'postgresql://testuser:testpassword@localhost:5433/testdb_database',
        'testdb_database'
      )
    ).toBe('postgresql://testuser:testpassword@localhost:5433/testdb_database');
  });

  it('rejects the development PostgreSQL port', () => {
    expect(() =>
      validateLocalUrl(
        'DATABASE_TEST_URL',
        'postgresql://testuser:testpassword@localhost:5432/testdb_database',
        'testdb_database'
      )
    ).toThrow('must use the isolated test PostgreSQL port 5433');
  });

  it('rejects a different database name', () => {
    expect(() =>
      validateLocalUrl(
        'DATABASE_TEST_URL',
        'postgresql://testuser:testpassword@localhost:5433/postgres',
        'testdb_database'
      )
    ).toThrow('must target the isolated testdb_database database');
  });
});
