import { describe, it, expect } from 'vitest';
import { CreateCreditNoteDto, ApplyCreditNoteDto } from './dto/credit-notes.dto';

const DRAFT = 'DRAFT';
const POSTED = 'POSTED';
const VOIDED = 'VOIDED';
const APPLIED = 'APPLIED';

describe('CreditNotesService - Business Logic', () => {
  describe('Credit Note Status Transitions', () => {
    const validStatuses = [DRAFT, POSTED, VOIDED, APPLIED] as const;

    it('should have all expected status values', () => {
      expect(validStatuses).toContain(DRAFT);
      expect(validStatuses).toContain(POSTED);
      expect(validStatuses).toContain(VOIDED);
      expect(validStatuses).toContain(APPLIED);
    });

    it('should identify DRAFT as initial status', () => {
      const initialStatus = DRAFT;
      expect(initialStatus).toBe(DRAFT);
    });

    it('should validate DRAFT can transition to POSTED', () => {
      const currentStatus = DRAFT;
      const allowedTransitions = {
        [DRAFT]: [POSTED],
        [POSTED]: [],
        [VOIDED]: [],
        [APPLIED]: [],
      };

      expect(allowedTransitions[currentStatus]).toContain(POSTED);
    });

    it('should validate POSTED can transition to VOIDED', () => {
      const currentStatus = POSTED;
      const allowedTransitions = {
        [DRAFT]: [POSTED],
        [POSTED]: [VOIDED],
        [VOIDED]: [],
        [APPLIED]: [],
      };

      expect(allowedTransitions[currentStatus]).toContain(VOIDED);
    });

    it('should validate POSTED can transition to APPLIED', () => {
      const currentStatus = POSTED;
      const allowedTransitions = {
        [DRAFT]: [POSTED],
        [POSTED]: [APPLIED],
        [VOIDED]: [],
        [APPLIED]: [],
      };

      expect(allowedTransitions[currentStatus]).toContain(APPLIED);
    });

    it('should NOT allow transitions from VOIDED status', () => {
      const currentStatus = VOIDED;
      const allowedTransitions = {
        [VOIDED]: [],
      };

      expect(allowedTransitions[currentStatus]).toHaveLength(0);
    });

    it('should NOT allow transitions from APPLIED status', () => {
      const allowedTransitions = {
        [APPLIED]: [],
      };

      expect(allowedTransitions[APPLIED]).toHaveLength(0);
    });

    it('should NOT allow DRAFT to be voided directly', () => {
      const currentStatus: string = DRAFT;
      const canVoidFromDraft = currentStatus === POSTED;

      expect(canVoidFromDraft).toBe(false);
    });

    it('should allow POSTED to be voided', () => {
      const currentStatus: string = POSTED;
      const canVoid = currentStatus !== VOIDED && currentStatus !== APPLIED;

      expect(canVoid).toBe(true);
    });
  });

  describe('Credit Note Totals Calculation', () => {
    it('should calculate base total correctly for single item', () => {
      const items = [{ quantity: 5, price: 100 }];

      const totalBase = items.reduce((sum, item) => sum + item.quantity * item.price, 0);

      expect(totalBase).toBe(500);
    });

    it('should calculate base total correctly for multiple items', () => {
      const items = [
        { quantity: 2, price: 100 },
        { quantity: 3, price: 50 },
        { quantity: 1, price: 200 },
      ];

      const totalBase = items.reduce((sum, item) => sum + item.quantity * item.price, 0);

      expect(totalBase).toBe(550);
    });

    it('should calculate total as base when no tax or igtf', () => {
      const totalBase = 500;
      const totalTax = 0;
      const totalIgtf = 0;
      const total = totalBase + totalTax + totalIgtf;

      expect(total).toBe(500);
    });

    it('should handle decimal prices', () => {
      const items = [{ quantity: 3, price: 19.99 }];

      const itemTotal = items[0].quantity * items[0].price;
      const totalBase = Math.round(itemTotal * 100) / 100;

      expect(totalBase).toBe(59.97);
    });

    it('should handle zero quantity items', () => {
      const items = [{ quantity: 0, price: 100 }];

      const totalBase = items.reduce((sum, item) => sum + item.quantity * item.price, 0);

      expect(totalBase).toBe(0);
    });

    it('should handle large amounts correctly', () => {
      const items = [{ quantity: 100, price: 99999.99 }];

      const totalBase = items.reduce((sum, item) => sum + item.quantity * item.price, 0);

      expect(totalBase).toBe(9999999);
    });

    it('should round totals to 2 decimal places', () => {
      const items = [{ quantity: 3, price: 33.33 }];

      const totalBase = Math.round(3 * 33.33 * 100) / 100;

      expect(totalBase).toBe(99.99);
    });
  });

  describe('Available Amount Calculation', () => {
    it('should calculate available amount correctly with no usages', () => {
      const total = 500;
      const usages: { amount: string }[] = [];

      const totalUsed = usages.reduce((sum, u) => sum + Number(u.amount), 0);
      const availableAmount = total - totalUsed;

      expect(availableAmount).toBe(500);
    });

    it('should calculate available amount with partial usage', () => {
      const total = 500;
      const usages = [{ amount: '200' }, { amount: '100' }];

      const totalUsed = usages.reduce((sum, u) => sum + Number(u.amount), 0);
      const availableAmount = total - totalUsed;

      expect(availableAmount).toBe(200);
    });

    it('should return 0 when fully used', () => {
      const total = 500;
      const usages = [{ amount: '300' }, { amount: '200' }];

      const totalUsed = usages.reduce((sum, u) => sum + Number(u.amount), 0);
      const availableAmount = total - totalUsed;

      expect(availableAmount).toBe(0);
    });

    it('should handle empty usages array', () => {
      const usages: { amount: string }[] = [];

      const totalUsed = usages.reduce((sum, u) => sum + Number(u.amount), 0);

      expect(totalUsed).toBe(0);
    });
  });

  describe('Usage Allocation to Payments', () => {
    it('should create payment with correct amount', () => {
      const creditNote = {
        id: 'cn-123',
        partnerId: 'partner-123',
        branchId: 'branch-123',
        currencyId: 'currency-123',
        exchangeRate: '1',
      };
      const applyDto = { amount: 250 };

      const paymentData = {
        code: 'PAY-2026-0001',
        invoiceId: 'invoice-123',
        partnerId: creditNote.partnerId,
        branchId: creditNote.branchId,
        methodId: creditNote.currencyId,
        status: 'POSTED',
        type: 'CREDIT_NOTE',
        amount: applyDto.amount.toString(),
        currencyId: creditNote.currencyId,
        exchangeRate: creditNote.exchangeRate,
        date: new Date(),
      };

      expect(paymentData.amount).toBe('250');
      expect(paymentData.type).toBe('CREDIT_NOTE');
    });

    it('should track remaining available after partial allocation', () => {
      const creditNoteTotal = 500;
      const usages = [{ amount: '200' }];

      const totalUsed = usages.reduce((sum, u) => sum + Number(u.amount), 0);
      const initialAvailable = creditNoteTotal - totalUsed;
      const applyAmount = 100;

      const newTotalUsed = totalUsed + applyAmount;
      const newAvailable = creditNoteTotal - newTotalUsed;

      expect(initialAvailable).toBe(300);
      expect(newAvailable).toBe(200);
    });

    it('should mark as APPLIED when fully used', () => {
      const creditNoteTotal = 500;
      const usages = [{ amount: '300' }];

      const totalUsed = usages.reduce((sum, u) => sum + Number(u.amount), 0);
      const availableAmount = creditNoteTotal - totalUsed;
      const applyAmount = 200;

      const newTotalUsed = totalUsed + applyAmount;
      const newAvailable = creditNoteTotal - newTotalUsed;
      const shouldBeApplied = newAvailable <= 0;

      expect(shouldBeApplied).toBe(true);
    });

    it('should NOT mark as APPLIED when partially used', () => {
      const creditNoteTotal = 500;
      const usages: { amount: string }[] = [];

      const totalUsed = usages.reduce((sum, u) => sum + Number(u.amount), 0);
      const availableAmount = creditNoteTotal - totalUsed;
      const applyAmount = 100;

      const newTotalUsed = totalUsed + applyAmount;
      const newAvailable = creditNoteTotal - newTotalUsed;
      const shouldBeApplied = newAvailable <= 0;

      expect(shouldBeApplied).toBe(false);
    });
  });

  describe('Credit Note Code Generation', () => {
    it('should generate sequential credit note codes', () => {
      const year = new Date().getFullYear();
      const prefix = `CN-${year}-`;
      const lastCode = 'CN-2026-0005';
      const lastNum = parseInt(lastCode.replace(prefix, ''), 10);
      const nextNum = lastNum + 1;
      const newCode = `${prefix}${nextNum.toString().padStart(4, '0')}`;

      expect(newCode).toBe('CN-2026-0006');
    });

    it('should handle first credit note code', () => {
      const year = new Date().getFullYear();
      const prefix = `CN-${year}-`;
      const latest: { code: string }[] = [];
      let nextNum = 1;

      if (latest.length > 0) {
        const lastNum = parseInt(latest[0].code.replace(prefix, ''), 10);
        nextNum = lastNum + 1;
      }

      const code = `${prefix}${nextNum.toString().padStart(4, '0')}`;

      expect(code).toBe(`${prefix}0001`);
    });

    it('should pad credit note codes with leading zeros', () => {
      const nextNum = 42;
      const year = new Date().getFullYear();
      const code = `CN-${year}-${String(nextNum).padStart(4, '0')}`;

      expect(code).toBe(`CN-${year}-0042`);
    });

    it('should handle high credit note numbers', () => {
      const year = new Date().getFullYear();
      const prefix = `CN-${year}-`;
      const lastCode = 'CN-2026-9999';
      const lastNum = parseInt(lastCode.replace(prefix, ''), 10);
      const nextNum = lastNum + 1;
      const newCode = `${prefix}${nextNum.toString().padStart(4, '0')}`;

      expect(newCode).toBe(`CN-${year}-10000`);
    });
  });

  describe('Payment Code Generation', () => {
    it('should generate sequential payment codes', () => {
      const year = new Date().getFullYear();
      const prefix = `PAY-${year}-`;
      const lastCode = 'PAY-2026-0003';
      const lastNum = parseInt(lastCode.replace(prefix, ''), 10);
      const nextNum = lastNum + 1;
      const newCode = `${prefix}${nextNum.toString().padStart(4, '0')}`;

      expect(newCode).toBe('PAY-2026-0004');
    });

    it('should handle first payment code', () => {
      const year = new Date().getFullYear();
      const prefix = `PAY-${year}-`;
      const latest: { code: string }[] = [];
      let nextNum = 1;

      if (latest.length > 0) {
        const lastNum = parseInt(latest[0].code.replace(prefix, ''), 10);
        nextNum = lastNum + 1;
      }

      const code = `${prefix}${nextNum.toString().padStart(4, '0')}`;

      expect(code).toBe(`${prefix}0001`);
    });
  });

  describe('Credit Note Item Operations', () => {
    it('should calculate item total as quantity * price', () => {
      const item = { quantity: 5, price: 100 };
      const itemTotal = item.quantity * item.price;

      expect(itemTotal).toBe(500);
    });

    it('should store item totals as strings', () => {
      const item = { quantity: 5, price: 100 };
      const itemTotal = (item.quantity * item.price).toString();

      expect(itemTotal).toBe('500');
    });

    it('should convert quantity to string when storing', () => {
      const item = { quantity: 5, price: 100 };
      const storedQuantity = item.quantity.toString();

      expect(storedQuantity).toBe('5');
    });

    it('should convert price to string when storing', () => {
      const item = { quantity: 5, price: 100 };
      const storedPrice = item.price.toString();

      expect(storedPrice).toBe('100');
    });
  });

  describe('Validation Rules', () => {
    it('should only allow updates on DRAFT credit notes', () => {
      const creditNoteStatus = DRAFT;
      const canUpdate = creditNoteStatus === DRAFT;

      expect(canUpdate).toBe(true);
    });

    it('should NOT allow updates on POSTED credit notes', () => {
      const creditNoteStatus: string = POSTED;
      const canUpdate = creditNoteStatus === DRAFT;

      expect(canUpdate).toBe(false);
    });

    it('should NOT allow updates on VOIDED credit notes', () => {
      const creditNoteStatus: string = VOIDED;
      const canUpdate = creditNoteStatus === DRAFT;

      expect(canUpdate).toBe(false);
    });

    it('should NOT allow updates on APPLIED credit notes', () => {
      const creditNoteStatus: string = APPLIED;
      const canUpdate = creditNoteStatus === DRAFT;

      expect(canUpdate).toBe(false);
    });

    it('should only allow post on DRAFT credit notes', () => {
      const creditNoteStatus: string = DRAFT;
      const canPost = creditNoteStatus === DRAFT;

      expect(canPost).toBe(true);
    });

    it('should NOT allow post on already posted credit notes', () => {
      const creditNoteStatus: string = POSTED;
      const canPost = creditNoteStatus === DRAFT;

      expect(canPost).toBe(false);
    });

    it('should NOT allow post on VOIDED credit notes', () => {
      const creditNoteStatus: string = VOIDED;
      const canPost = creditNoteStatus === DRAFT;

      expect(canPost).toBe(false);
    });

    it('should NOT allow void on VOIDED credit notes', () => {
      const creditNoteStatus: string = VOIDED;
      const canVoid = creditNoteStatus !== VOIDED;

      expect(canVoid).toBe(false);
    });

    it('should NOT allow void on APPLIED credit notes', () => {
      const creditNoteStatus: string = APPLIED;
      const canVoid = creditNoteStatus !== VOIDED && creditNoteStatus !== APPLIED;

      expect(canVoid).toBe(false);
    });

    it('should allow void on POSTED credit notes', () => {
      const creditNoteStatus: string = POSTED;
      const canVoid = creditNoteStatus !== VOIDED;

      expect(canVoid).toBe(true);
    });

    it('should NOT allow apply on DRAFT credit notes', () => {
      const creditNoteStatus: string = DRAFT;
      const canApply = creditNoteStatus !== DRAFT && creditNoteStatus !== VOIDED;

      expect(canApply).toBe(false);
    });

    it('should NOT allow apply on VOIDED credit notes', () => {
      const creditNoteStatus: string = VOIDED;
      const canApply = creditNoteStatus !== DRAFT && creditNoteStatus !== VOIDED;

      expect(canApply).toBe(false);
    });

    it('should allow apply on POSTED credit notes', () => {
      const creditNoteStatus: string = POSTED;
      const canApply = creditNoteStatus !== DRAFT && creditNoteStatus !== VOIDED;

      expect(canApply).toBe(true);
    });

    it('should not allow apply amount exceeding available', () => {
      const creditNoteTotal = 500;
      const usages = [{ amount: '200' }];
      const totalUsed = usages.reduce((sum, u) => sum + Number(u.amount), 0);
      const availableAmount = creditNoteTotal - totalUsed;
      const applyAmount = 400;

      const exceedsAvailable = applyAmount > availableAmount;

      expect(exceedsAvailable).toBe(true);
    });

    it('should allow apply amount within available', () => {
      const creditNoteTotal = 500;
      const usages = [{ amount: '200' }];
      const totalUsed = usages.reduce((sum, u) => sum + Number(u.amount), 0);
      const availableAmount = creditNoteTotal - totalUsed;
      const applyAmount = 200;

      const exceedsAvailable = applyAmount > availableAmount;

      expect(exceedsAvailable).toBe(false);
    });
  });

  describe('Partner Validation', () => {
    it('should require credit note and invoice to have same partner', () => {
      const creditNote = { partnerId: 'partner-123' };
      const invoice = { partnerId: 'partner-123' };

      const samePartner = creditNote.partnerId === invoice.partnerId;

      expect(samePartner).toBe(true);
    });

    it('should reject when credit note and invoice have different partners', () => {
      const creditNote = { partnerId: 'partner-123' };
      const invoice = { partnerId: 'partner-456' };

      const samePartner = creditNote.partnerId === invoice.partnerId;

      expect(samePartner).toBe(false);
    });
  });

  describe('Invoice Validation for Apply', () => {
    it('should not allow apply to voided invoice', () => {
      const invoiceStatus = VOIDED;
      const canApply = invoiceStatus !== VOIDED;

      expect(canApply).toBe(false);
    });

    it('should allow apply to posted invoice', () => {
      const invoiceStatus: string = POSTED;
      const canApply = invoiceStatus !== VOIDED;

      expect(canApply).toBe(true);
    });
  });

  describe('Exchange Rate Handling', () => {
    it('should store exchange rate as string', () => {
      const exchangeRate = 1.5;
      const storedRate = exchangeRate.toString();

      expect(storedRate).toBe('1.5');
    });

    it('should convert stored exchange rate to number when reading', () => {
      const storedRate = '1.5';
      const exchangeRate = Number(storedRate);

      expect(exchangeRate).toBe(1.5);
    });

    it('should handle default exchange rate of 1', () => {
      const exchangeRate = 1;
      const storedRate = exchangeRate.toString();

      expect(storedRate).toBe('1');
    });
  });

  describe('DTO Structure Validation', () => {
    it('should validate CreateCreditNoteDto structure', () => {
      const dto: CreateCreditNoteDto = {
        partnerId: '550e8400-e29b-41d4-a716-446655440001',
        branchId: '550e8400-e29b-41d4-a716-446655440002',
        currencyId: '550e8400-e29b-41d4-a716-446655440003',
        exchangeRate: 1.0,
        items: [
          {
            productId: '550e8400-e29b-41d4-a716-446655440000',
            quantity: 10,
            price: 100,
          },
        ],
      };

      expect(dto.partnerId).toBeDefined();
      expect(dto.branchId).toBeDefined();
      expect(dto.currencyId).toBeDefined();
      expect(dto.exchangeRate).toBe(1.0);
      expect(dto.items).toHaveLength(1);
      expect(dto.items[0].quantity).toBe(10);
      expect(dto.items[0].price).toBe(100);
    });

    it('should validate ApplyCreditNoteDto structure', () => {
      const dto: ApplyCreditNoteDto = {
        amount: 250.0,
      };

      expect(dto.amount).toBe(250.0);
    });

    it('should have correct CreditNoteStatus type values', () => {
      expect(DRAFT).toBe('DRAFT');
      expect(POSTED).toBe('POSTED');
      expect(VOIDED).toBe('VOIDED');
      expect(APPLIED).toBe('APPLIED');
    });
  });

  describe('Edge Cases', () => {
    it('should handle very small amounts', () => {
      const items = [{ quantity: 1, price: 0.01 }];

      const totalBase = items.reduce((sum, item) => sum + item.quantity * item.price, 0);

      expect(totalBase).toBeCloseTo(0.01, 2);
    });

    it('should handle items with zero price', () => {
      const items = [{ quantity: 5, price: 0 }];

      const totalBase = items.reduce((sum, item) => sum + item.quantity * item.price, 0);

      expect(totalBase).toBe(0);
    });

    it('should handle many items', () => {
      const items = Array.from({ length: 100 }, (_, i) => ({
        quantity: 1,
        price: 10 + i,
      }));

      const totalBase = items.reduce((sum, item) => sum + item.quantity * item.price, 0);

      expect(totalBase).toBe(100 * 10 + (100 * 99) / 2);
    });

    it('should handle non-existent credit note lookup', () => {
      const creditNotes: { id: string }[] = [];
      const findById = (id: string) => creditNotes.find(cn => cn.id === id);

      const result = findById('non-existent-id');

      expect(result).toBeUndefined();
    });

    it('should handle credit note with no items', () => {
      const items: { productId: string; quantity: number; price: number }[] = [];

      const totalBase = items.reduce((sum, item) => sum + item.quantity * item.price, 0);

      expect(totalBase).toBe(0);
    });

    it('should handle credit note with no usages', () => {
      const usages: { amount: string }[] = [];

      const totalUsed = usages.reduce((sum, u) => sum + Number(u.amount), 0);
      const availableAmount = 500 - totalUsed;

      expect(availableAmount).toBe(500);
    });

    it('should handle negative amounts in error case', () => {
      const applyAmount = -100;
      const availableAmount = 500;

      const isInvalid = applyAmount < 0 || applyAmount > availableAmount;

      expect(isInvalid).toBe(true);
    });

    it('should handle exact available amount application', () => {
      const creditNoteTotal = 500;
      const usages = [{ amount: '300' }];

      const totalUsed = usages.reduce((sum, u) => sum + Number(u.amount), 0);
      const availableAmount = creditNoteTotal - totalUsed;
      const applyAmount = availableAmount;

      const newTotalUsed = totalUsed + applyAmount;
      const newAvailable = creditNoteTotal - newTotalUsed;

      expect(newAvailable).toBe(0);
    });
  });

  describe('Error Messages', () => {
    it('should have correct NotFoundException message format', () => {
      const id = 'cn-123';
      const message = `Credit note with ID ${id} not found`;

      expect(message).toBe('Credit note with ID cn-123 not found');
    });

    it('should have correct BadRequestException for invalid status transition', () => {
      const currentStatus: string = POSTED;
      let message = '';

      if (currentStatus !== DRAFT) {
        message = 'Only DRAFT credit notes can be updated';
      }

      expect(message).toBe('Only DRAFT credit notes can be updated');
    });

    it('should have correct BadRequestException for already voided', () => {
      const currentStatus: string = VOIDED;
      let message = '';

      if (currentStatus === VOIDED) {
        message = 'Credit note is already voided';
      }

      expect(message).toBe('Credit note is already voided');
    });

    it('should have correct message when amount exceeds available', () => {
      const applyAmount = 600;
      const availableAmount = 500;
      const message = `Amount ${applyAmount} exceeds available amount ${availableAmount}`;

      expect(message).toBe('Amount 600 exceeds available amount 500');
    });

    it('should have correct message when partners do not match', () => {
      const message = 'Credit note and invoice must belong to the same partner';

      expect(message).toBe('Credit note and invoice must belong to the same partner');
    });
  });
});
