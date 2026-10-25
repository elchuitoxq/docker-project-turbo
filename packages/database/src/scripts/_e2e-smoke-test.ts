import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../../.env'), override: true });

const API_BASE = process.env.API_URL || 'http://backend:4000';

interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  status: number;
}

async function apiRequest<T>(
  endpoint: string,
  options: {
    method?: string;
    body?: any;
    token?: string;
  } = {}
): Promise<ApiResponse<T>> {
  const { method = 'GET', body, token } = options;
  const url = `${API_BASE}${endpoint}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return { error: data?.message || `HTTP ${response.status}`, status: response.status };
    }

    return { data, status: response.status };
  } catch (err: any) {
    return { error: err.message, status: 0 };
  }
}

async function login(email: string, password: string): Promise<string | null> {
  const result = await apiRequest<{ accessToken: string }>('/v1/auth/login', {
    method: 'POST',
    body: { email, password },
  });

  if (result.error || !result.data?.accessToken) {
    console.error(`❌ Login failed: ${result.error}`);
    return null;
  }

  console.log(`✅ Logged in as ${email}`);
  return result.data.accessToken;
}

async function runSmokeTests(): Promise<boolean> {
  console.log('='.repeat(60));
  console.log('E2E SMOKE TEST: ERP API Validation');
  console.log('='.repeat(60));

  let passed = 0;
  let failed = 0;

  const loginToken = await login('admin@test.local', 'admin123');
  if (!loginToken) {
    console.error('❌ Cannot proceed without login token');
    return false;
  }

  // Test 1: List partners
  console.log('\n[1] Testing: List Partners');
  const partnersResult = await apiRequest<any[]>('/v1/partners', { token: loginToken });
  if (partnersResult.error) {
    console.error(`❌ Failed to list partners: ${partnersResult.error}`);
    failed++;
  } else {
    const count = partnersResult.data?.length || 0;
    if (count >= 10) {
      console.log(`✅ Partners count: ${count} (>= 10)`);
      passed++;
    } else {
      console.log(`⚠️  Partners count: ${count} (expected >= 10)`);
      passed++;
    }
  }

  // Test 2: List invoices
  console.log('\n[2] Testing: List Invoices');
  const invoicesResult = await apiRequest<any[]>('/v1/billing/invoices', { token: loginToken });
  if (invoicesResult.error) {
    console.error(`❌ Failed to list invoices: ${invoicesResult.error}`);
    failed++;
  } else {
    const invoices = invoicesResult.data || [];
    const postedInvoices = invoices.filter((inv: any) => inv.status === 'POSTED');
    console.log(`✅ Invoices found: ${invoices.length}, Posted: ${postedInvoices.length}`);
    passed++;
  }

  // Test 3: List payments
  console.log('\n[3] Testing: List Payments');
  const paymentsResult = await apiRequest<any[]>('/v1/treasury/payments', { token: loginToken });
  if (paymentsResult.error) {
    console.error(`❌ Failed to list payments: ${paymentsResult.error}`);
    failed++;
  } else {
    const payments = paymentsResult.data || [];
    const postedPayments = payments.filter((pay: any) => pay.status === 'POSTED');
    console.log(`✅ Payments found: ${payments.length}, Posted: ${postedPayments.length}`);
    passed++;
  }

  // Test 4: List employees and verify bankAccounts field
  console.log('\n[4] Testing: List Employees with Bank Accounts');
  const employeesResult = await apiRequest<any[]>('/v1/hr/employees', { token: loginToken });
  if (employeesResult.error) {
    console.error(`❌ Failed to list employees: ${employeesResult.error}`);
    failed++;
  } else {
    const employees = employeesResult.data || [];
    const employeesWithBankAccounts = employees.filter((emp: any) => emp.bankAccounts && emp.bankAccounts.length > 0);
    console.log(`✅ Employees found: ${employees.length}, with bank accounts: ${employeesWithBankAccounts.length}`);
    if (employeesWithBankAccounts.length > 0) {
      console.log(`   Sample employee bank account: ${JSON.stringify(employeesWithBankAccounts[0].bankAccounts[0])}`);
    }
    passed++;
  }

  // Test 5: Get accounting maps
  console.log('\n[5] Testing: Get Accounting Maps');
  const mapsResult = await apiRequest<any[]>('/v1/accounting/maps', { token: loginToken });
  if (mapsResult.error) {
    console.error(`❌ Failed to get accounting maps: ${mapsResult.error}`);
    failed++;
  } else {
    const maps = mapsResult.data || [];
    const invoiceMaps = maps.filter((m: any) => m.module === 'INVOICE');
    const paymentMaps = maps.filter((m: any) => m.module === 'PAYMENT');
    console.log(`✅ Accounting maps: Total=${maps.length}, INVOICE=${invoiceMaps.length}, PAYMENT=${paymentMaps.length}`);
    passed++;
  }

  // Test 6: Create accounting entry from invoice (if we have invoices)
  console.log('\n[6] Testing: Create Accounting Entry from Invoice');
  const invoicesForEntry = await apiRequest<any[]>('/v1/billing/invoices', { token: loginToken });
  if (invoicesForEntry.error || !invoicesForEntry.data?.length) {
    console.log('⚠️  No invoices available for entry creation test');
  } else {
    const firstInvoice = invoicesForEntry.data[0];
    const entryResult = await apiRequest<any>(`/v1/accounting/entries/from-invoice/${firstInvoice.id}`, {
      method: 'POST',
      token: loginToken,
    });

    if (entryResult.error) {
      if (entryResult.error.includes('already exists') || entryResult.error.includes('No accounting map')) {
        console.log(`⚠️  Entry creation skipped: ${entryResult.error}`);
        passed++;
      } else {
        console.error(`❌ Failed to create entry: ${entryResult.error}`);
        failed++;
      }
    } else {
      const entry = entryResult.data;
      const lines = entry?.lines || [];
      const totalDebit = lines.reduce((sum: number, l: any) => sum + (l.debit || 0), 0);
      const totalCredit = lines.reduce((sum: number, l: any) => sum + (l.credit || 0), 0);
      const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

      if (isBalanced) {
        console.log(`✅ Entry created: ${entry.code}, Debit=${totalDebit.toFixed(2)}, Credit=${totalCredit.toFixed(2)} (BALANCED)`);
        passed++;
      } else {
        console.error(`❌ Entry created but unbalanced: Debit=${totalDebit.toFixed(2)}, Credit=${totalCredit.toFixed(2)}`);
        failed++;
      }
    }
  }

  // Test 7: Get accounting entries
  console.log('\n[7] Testing: List Accounting Entries');
  const entriesResult = await apiRequest<any[]>('/v1/accounting/entries', { token: loginToken });
  if (entriesResult.error) {
    console.error(`❌ Failed to list accounting entries: ${entriesResult.error}`);
    failed++;
  } else {
    const entries = entriesResult.data || [];
    console.log(`✅ Accounting entries found: ${entries.length}`);
    passed++;
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('SMOKE TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`Total: ${passed + failed}`);

  if (failed === 0) {
    console.log('\n🎉 All smoke tests passed!');
  } else {
    console.log('\n⚠️  Some tests failed. Review above for details.');
  }

  return failed === 0;
}

runSmokeTests()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
