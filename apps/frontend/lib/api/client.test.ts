import { describe, it, expect } from 'vitest';
import { ApiError } from './client';

describe('ApiError', () => {
  it('captures status, message and body', () => {
    const e = new ApiError(404, 'not found', { detail: 'x' });
    expect(e).toBeInstanceOf(Error);
    expect(e.status).toBe(404);
    expect(e.message).toBe('not found');
    expect(e.body).toEqual({ detail: 'x' });
    expect(e.name).toBe('ApiError');
  });
});
