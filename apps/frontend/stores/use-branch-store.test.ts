import { describe, it, expect, beforeEach } from 'vitest';
import { useBranchStore } from './use-branch-store';

describe('useBranchStore', () => {
  beforeEach(() => {
    useBranchStore.setState({
      currentBranchId: null,
      availableBranches: [],
      hasHydrated: false,
    });
  });

  it('starts empty', () => {
    expect(useBranchStore.getState().currentBranchId).toBeNull();
    expect(useBranchStore.getState().availableBranches).toEqual([]);
  });

  it('setBranch() updates branch id', () => {
    useBranchStore.getState().setBranch('branch-1');
    expect(useBranchStore.getState().currentBranchId).toBe('branch-1');
  });

  it('setAvailableBranches() stores list', () => {
    const list = [
      {
        id: 'b1',
        companyId: 'c1',
        name: 'X',
        taxId: 'J-1',
        address: null,
        phone: null,
        email: null,
        isActive: true,
      },
    ];
    useBranchStore.getState().setAvailableBranches(list);
    expect(useBranchStore.getState().availableBranches).toEqual(list);
  });

  it('reset() clears all', () => {
    useBranchStore.getState().setBranch('b1');
    useBranchStore.getState().reset();
    expect(useBranchStore.getState().currentBranchId).toBeNull();
    expect(useBranchStore.getState().availableBranches).toEqual([]);
  });
});
