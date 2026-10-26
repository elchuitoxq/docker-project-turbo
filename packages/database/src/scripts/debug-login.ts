import { db } from '../index';
import { users, usersBranches, branches, companies } from '../schema';
import { eq } from 'drizzle-orm';

async function debugLogin() {
  console.log('=== Debug Login Flow ===\n');

  // 1. Find user by email
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, 'test-admin@test.local'))
    .limit(1);

  if (!user) {
    console.log('❌ User not found');
    return;
  }
  console.log('✅ User found:', user.email, '| ID:', user.id);

  // 2. Check user branches
  const userBranches = await db
    .select({
      branchId: usersBranches.branchId,
      branchName: branches.name,
      companyId: companies.id,
      companyName: companies.name,
      taxId: companies.taxId,
      isDefault: usersBranches.isDefault,
    })
    .from(usersBranches)
    .innerJoin(branches, eq(usersBranches.branchId, branches.id))
    .innerJoin(companies, eq(branches.companyId, companies.id))
    .where(eq(usersBranches.userId, user.id));

  console.log('\n=== User Branches ===');
  if (userBranches.length === 0) {
    console.log('❌ User has NO branches assigned');
  } else {
    console.log(`✅ User has ${userBranches.length} branch(es):`);
    for (const ub of userBranches) {
      console.log(`   - ${ub.branchName} (taxId: ${ub.taxId}) - Default: ${ub.isDefault}`);
    }
  }

  // 3. Group branches by their company record.
  const companiesMap = new Map<string, typeof userBranches>();
  for (const ub of userBranches) {
    const key = ub.companyId;
    if (!companiesMap.has(key)) companiesMap.set(key, []);
    companiesMap.get(key)!.push(ub);
  }

  console.log('\n=== Assigned Companies ===');
  if (companiesMap.size === 0) {
    console.log('❌ User has NO companies');
  } else {
    console.log(`✅ User has ${companiesMap.size} company(ies):`);
    for (const [companyId, branches] of companiesMap) {
      const company = branches[0];
      console.log(
        `   - ${company.companyName} (${company.taxId ?? 'no tax ID'}; ${companyId}) | branches: ${branches.map(b => b.branchName).join(', ')}`
      );
    }
  }

  // 4. Simulate what the API returns
  console.log('\n=== API Response Simulation ===');
  const apiResponse = Array.from(companiesMap.entries()).map(([taxId, branches]) => ({
    taxId,
    name: branches[0].branchName,
    branchCount: branches.length,
    branches: branches.map(b => ({
      id: b.branchId,
      name: b.branchName,
      taxId: b.taxId,
    })),
  }));

  console.log('Response:', JSON.stringify(apiResponse, null, 2));

  // 5. Check if the first company has a valid taxId
  const firstCompany = apiResponse[0];
  if (!firstCompany || !firstCompany.taxId || firstCompany.taxId === 'UNKNOWN') {
    console.log('\n❌ PROBLEM: First company has no valid taxId!');
  } else {
    console.log('\n✅ First company has valid taxId:', firstCompany.taxId);
  }
}

debugLogin()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
