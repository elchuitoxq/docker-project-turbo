import { http, HttpResponse } from 'msw';

const API = 'http://localhost:4000/v1';
const companies = [
  {
    id: 'company-1',
    taxId: 'J-12345678-9',
    name: 'Acme Holdings C.A.',
    address: 'Av. Libertador',
    phone: '+58-212-555-1234',
    email: 'info@acme.com',
    isActive: true,
    branchCount: 2,
    branches: [
      {
        id: 'branch-1',
        companyId: 'company-1',
        name: 'Sucursal Caracas',
        taxId: 'J-12345678-9',
        isActive: true,
      },
      {
        id: 'branch-2',
        companyId: 'company-1',
        name: 'Sucursal Valencia',
        taxId: 'J-12345678-9',
        isActive: true,
      },
    ],
  },
  {
    id: 'company-2',
    taxId: 'J-98765432-1',
    name: 'Otra Empresa',
    address: 'Av. 2',
    phone: '+58-212-555-9999',
    email: 'info@other.com',
    isActive: true,
    branchCount: 1,
    branches: [
      {
        id: 'branch-3',
        companyId: 'company-2',
        name: 'Otra Empresa',
        taxId: 'J-98765432-1',
        isActive: true,
      },
    ],
  },
];

export const handlers = [
  http.post(`${API}/auth/login`, async ({ request }) => {
    const body = (await request.json()) as { email?: string; password?: string };
    if (body.email === 'fail@test.com') {
      return HttpResponse.json({ message: 'Invalid credentials' }, { status: 401 });
    }
    return HttpResponse.json({
      accessToken: 'test-token',
      user: {
        id: 'user-1',
        name: 'Test User',
        email: body.email ?? 'test@test.com',
        permissions: [
          'dashboard:view',
          'operations:view',
          'operations:partners:view',
          'operations:partners:create',
          'operations:partners:edit',
          'finance:view',
          'finance:invoices:view',
          'inventory:view',
          'inventory:products:view',
          'hr:view',
          'hr:employees:view',
          'settings:view',
        ],
        branches: [
          {
            id: 'branch-1',
            name: 'Sucursal Caracas',
            companyId: 'company-1',
            taxId: 'J-12345678-9',
          },
          {
            id: 'branch-2',
            name: 'Sucursal Valencia',
            companyId: 'company-1',
            taxId: 'J-12345678-9',
          },
        ],
      },
    });
  }),

  http.get(`${API}/branches/companies`, () => HttpResponse.json([companies[0]])),
  http.get(`${API}/branches/companies/all`, () => HttpResponse.json(companies)),
  http.get(`${API}/branches`, () => {
    return HttpResponse.json([
      {
        id: 'branch-1',
        companyId: 'company-1',
        name: 'Sucursal Caracas',
        taxId: 'J-12345678-9',
        isActive: true,
      },
      {
        id: 'branch-2',
        companyId: 'company-1',
        name: 'Sucursal Valencia',
        taxId: 'J-12345678-9',
        isActive: true,
      },
    ]);
  }),
  http.get(`${API}/branches/all`, () =>
    HttpResponse.json(companies.flatMap(company => company.branches))
  ),
  http.get(`${API}/users`, () =>
    HttpResponse.json([
      {
        id: 'user-1',
        name: 'Test User',
        email: 'user@test.local',
        createdAt: null,
        updatedAt: null,
        roles: ['ADMIN'],
        branches: [
          { id: 'branch-1', name: 'Sucursal Caracas', companyId: 'company-1', isDefault: true },
        ],
      },
    ])
  ),
  http.get(`${API}/roles`, () =>
    HttpResponse.json([
      {
        id: 'role-admin',
        name: 'ADMIN',
        description: 'Administrator role',
        isSystem: true,
        permissions: [
          {
            id: 'permission-dashboard',
            code: 'dashboard:view',
            description: null,
            module: 'dashboard',
          },
        ],
      },
    ])
  ),
  http.get(`${API}/roles/permissions`, () =>
    HttpResponse.json([
      {
        id: 'permission-dashboard',
        code: 'dashboard:view',
        description: 'View dashboard',
        module: 'dashboard',
      },
    ])
  ),

  http.get(`${API}/partners`, ({ request }) => {
    const url = new URL(request.url);
    const search = url.searchParams.get('search')?.toLowerCase();
    const all = [
      {
        id: 'p-1',
        name: 'Cliente ABC C.A.',
        email: 'abc@cliente.com',
        taxId: 'J-11111111-1',
        address: 'Av. Principal',
        phone: '+58-212-1111111',
        type: 'CUSTOMER',
        taxpayerType: 'ORDINARY',
        retentionRate: '75',
        isSpecialTaxpayer: false,
        creditLimit: '5000',
        islrConceptId: null,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
      {
        id: 'p-2',
        name: 'Proveedor XYZ S.A.',
        email: 'xyz@proveedor.com',
        taxId: 'J-22222222-2',
        address: 'Calle 42',
        phone: '+58-212-2222222',
        type: 'VENDOR',
        taxpayerType: 'SPECIAL',
        retentionRate: '100',
        isSpecialTaxpayer: true,
        creditLimit: '0',
        islrConceptId: null,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
      {
        id: 'p-3',
        name: 'Corporación Delta C.A.',
        email: 'delta@delta.com',
        taxId: 'J-33333333-3',
        address: 'Av. Libertador',
        phone: '+58-212-3333333',
        type: 'VENDOR',
        taxpayerType: 'ORDINARY',
        retentionRate: '50',
        isSpecialTaxpayer: false,
        creditLimit: '10000',
        islrConceptId: null,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
    ];
    let filtered = all;
    if (search)
      filtered = filtered.filter(
        p => p.name.toLowerCase().includes(search) || p.taxId.toLowerCase().includes(search)
      );
    return HttpResponse.json(filtered);
  }),

  http.get(`${API}/partners/:id`, ({ params }) => {
    return HttpResponse.json({
      id: params.id,
      name: 'Cliente ABC C.A.',
      email: 'abc@cliente.com',
      taxId: 'J-11111111-1',
      address: 'Av. Principal',
      phone: '+58-212-1111111',
      type: 'CUSTOMER',
      taxpayerType: 'ORDINARY',
      retentionRate: '75',
      isSpecialTaxpayer: false,
      creditLimit: '5000',
      islrConceptId: null,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    });
  }),

  http.get(`${API}/treasury/statements/:partnerId`, ({ params }) => {
    return HttpResponse.json({
      partnerId: params.partnerId,
      partnerName: 'Cliente ABC C.A.',
      partnerTaxId: 'J-11111111-1',
      totalPaid: 999.5,
      totalOutstanding: 1500.5,
      creditBalance: -501,
      recentPayments: [
        { id: 'p-1', code: 'PAG-001', date: '2026-05-15', amount: 500, type: 'INCOME' },
        { id: 'p-2', code: 'PAG-002', date: '2026-06-03', amount: 499.5, type: 'INCOME' },
      ],
      outstandingInvoices: [
        { id: 'i-1', code: 'FAC-001', date: '2026-05-01', total: 1000, paid: 500, pending: 500 },
        { id: 'i-2', code: 'FAC-002', date: '2026-06-01', total: 1500, paid: 0, pending: 1500 },
      ],
    });
  }),

  http.post(`${API}/partners`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({ id: 'p-new', ...body }, { status: 201 });
  }),

  http.patch(`${API}/partners/:id`, async ({ params, request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({ id: params.id, ...body });
  }),

  http.delete(`${API}/partners/:id`, () => {
    return HttpResponse.json({ message: 'Partner deleted' });
  }),

  http.get(`${API}/billing/invoices`, ({ request }) => {
    const url = new URL(request.url);
    const type = url.searchParams.get('type') ?? 'SALE';
    return HttpResponse.json({
      data: [
        {
          id: 'inv-1',
          code: type === 'SALE' ? 'FAC-A-00001' : 'CMP-A-00001',
          partnerId: 'p-1',
          partnerName: 'Cliente ABC C.A.',
          type,
          status: 'POSTED',
          total: '1500.00',
          tax: '240.00',
          currencyCode: 'USD',
          issueDate: '2026-05-15',
          dueDate: '2026-06-15',
        },
        {
          id: 'inv-2',
          code: type === 'SALE' ? 'FAC-A-00002' : 'CMP-A-00002',
          partnerId: 'p-3',
          partnerName: 'Corporación Delta C.A.',
          type,
          status: 'DRAFT',
          total: '500.00',
          tax: '80.00',
          currencyCode: 'USD',
          issueDate: '2026-06-01',
          dueDate: '2026-07-01',
        },
      ],
      total: 2,
      page: 1,
      limit: 20,
    });
  }),

  http.get(`${API}/orders`, () => {
    return HttpResponse.json({
      data: [
        {
          id: 'o-1',
          code: 'PED-A-00001',
          partnerId: 'p-1',
          partnerName: 'Cliente ABC C.A.',
          type: 'SALE',
          status: 'APPROVED',
          total: '1200.00',
          currencyCode: 'USD',
          orderDate: '2026-05-10',
          deliveryDate: '2026-05-20',
        },
        {
          id: 'o-2',
          code: 'PED-A-00002',
          partnerId: 'p-2',
          partnerName: 'Proveedor XYZ S.A.',
          type: 'PURCHASE',
          status: 'PENDING',
          total: '3000.00',
          currencyCode: 'USD',
          orderDate: '2026-06-01',
          deliveryDate: '2026-06-15',
        },
      ],
      total: 2,
      page: 1,
      limit: 20,
    });
  }),

  http.get(`${API}/products`, ({ request }) => {
    const url = new URL(request.url);
    const search = url.searchParams.get('search')?.toLowerCase();
    const all = [
      {
        id: 'pr-1',
        sku: 'SKU-001',
        name: 'Laptop HP ProBook',
        description: 'Laptop empresarial 14"',
        categoryId: 'cat-1',
        cost: '800',
        price: '1200',
        isExempt: false,
        taxRate: '16',
        type: 'PHYSICAL',
        minStock: '5',
        hasBatches: false,
        currencyId: null,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
      {
        id: 'pr-2',
        sku: 'SRV-001',
        name: 'Consultoría IT',
        description: 'Hora de consultoría',
        categoryId: 'cat-2',
        cost: '0',
        price: '80',
        isExempt: true,
        taxRate: '0',
        type: 'SERVICE',
        minStock: '0',
        hasBatches: false,
        currencyId: null,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
    ];
    const filtered = search
      ? all.filter(
          p => p.name.toLowerCase().includes(search) || p.sku.toLowerCase().includes(search)
        )
      : all;
    return HttpResponse.json({ data: filtered, total: filtered.length, page: 1, limit: 20 });
  }),

  http.post(`${API}/products`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({ id: 'pr-new', ...body }, { status: 201 });
  }),

  http.get(`${API}/products/categories`, () => {
    return HttpResponse.json([
      { id: 'cat-1', name: 'Electrónica', description: null, parentId: null },
      { id: 'cat-2', name: 'Servicios profesionales', description: null, parentId: null },
    ]);
  }),

  http.get(`${API}/products/:id`, ({ params }) => {
    return HttpResponse.json({
      id: params.id,
      sku: 'SKU-001',
      name: 'Laptop HP ProBook',
      description: 'Laptop empresarial 14"',
      categoryId: 'cat-1',
      cost: '800',
      price: '1200',
      isExempt: false,
      taxRate: '16',
      type: 'PHYSICAL',
      minStock: '5',
      hasBatches: false,
      currencyId: null,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    });
  }),

  http.patch(`${API}/products/:id`, async ({ params, request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({ id: params.id, ...body });
  }),

  http.delete(`${API}/products/:id`, () => {
    return HttpResponse.json({ message: 'Product deleted' });
  }),

  http.get(`${API}/inventory/warehouses`, () => {
    return HttpResponse.json([
      {
        id: 'wh-1',
        branchId: 'branch-1',
        name: 'Almacén Principal',
        address: 'Av. Industrial',
        isActive: true,
      },
      {
        id: 'wh-2',
        branchId: 'branch-1',
        name: 'Almacén Secundario',
        address: 'Calle 5',
        isActive: true,
      },
    ]);
  }),

  http.post(`${API}/inventory/warehouses`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({ id: 'wh-new', ...body }, { status: 201 });
  }),

  http.delete(`${API}/inventory/warehouses/:id`, () => {
    return HttpResponse.json({ message: 'Warehouse deleted' });
  }),

  http.get(`${API}/inventory/moves`, () => {
    return HttpResponse.json({
      data: [
        {
          id: 'mv-1',
          code: 'MOV-00001',
          type: 'IN',
          status: 'APPROVED',
          productId: 'pr-1',
          productName: 'Laptop HP ProBook',
          productSku: 'SKU-001',
          warehouseId: 'wh-1',
          warehouseName: 'Almacén Principal',
          warehouseDestId: null,
          warehouseDestName: null,
          quantity: '10',
          unitCost: '800',
          totalCost: '8000',
          date: '2026-05-15',
        },
        {
          id: 'mv-2',
          code: 'MOV-00002',
          type: 'OUT',
          status: 'APPROVED',
          productId: 'pr-1',
          productName: 'Laptop HP ProBook',
          productSku: 'SKU-001',
          warehouseId: 'wh-1',
          warehouseName: 'Almacén Principal',
          warehouseDestId: null,
          warehouseDestName: null,
          quantity: '3',
          unitCost: '800',
          totalCost: '2400',
          date: '2026-05-20',
        },
        {
          id: 'mv-3',
          code: 'MOV-00003',
          type: 'TRANSFER',
          status: 'DRAFT',
          productId: 'pr-2',
          productName: 'Consultoría IT',
          productSku: 'SRV-001',
          warehouseId: 'wh-1',
          warehouseName: 'Almacén Principal',
          warehouseDestId: 'wh-2',
          warehouseDestName: 'Almacén Secundario',
          quantity: '5',
          unitCost: '0',
          totalCost: '0',
          date: '2026-06-01',
        },
      ],
      total: 3,
      page: 1,
      limit: 20,
    });
  }),

  http.post(`${API}/inventory/moves/:id/approve`, () => {
    return HttpResponse.json({ message: 'approved' });
  }),

  http.post(`${API}/inventory/moves/:id/reject`, () => {
    return HttpResponse.json({ message: 'cancelled' });
  }),

  http.get(`${API}/billing/invoices/stats`, () => {
    return HttpResponse.json({
      draft: 5,
      posted: 42,
      void: 2,
      totalPosted: '15750.50',
    });
  }),

  http.post(`${API}/billing/invoices/:id/post`, ({ params }) => {
    return HttpResponse.json({ id: params.id, status: 'POSTED', code: 'FAC-A-00001' });
  }),

  http.post(`${API}/billing/invoices/:id/void`, async ({ params, request }) => {
    const body = (await request.json().catch(() => ({}))) as { reason?: string };
    return HttpResponse.json({ id: params.id, status: 'VOID', voidReason: body.reason ?? '' });
  }),

  http.get(`${API}/billing/invoices/:id/fiscal-json`, ({ params }) => {
    return HttpResponse.json({
      id: params.id,
      header: {
        rifEmisor: 'J-12345678-9',
        numeroFactura: 'FAC-A-00001',
        fechaEmision: '2026-05-15',
      },
      items: [],
      totals: { baseImponible: '1260.50', iva: '201.68', total: '1462.18' },
    });
  }),

  http.get(`${API}/treasury/bank-accounts`, () => {
    return HttpResponse.json([
      {
        id: 'ba-1',
        bankId: 'b-1',
        bankName: 'Banco Mercantil',
        accountNumber: '0105-0001-12-1234567890',
        accountType: 'CHECKING',
        currencyId: 'c-1',
        currencyCode: 'USD',
        isActive: true,
        balance: '12500.00',
      },
      {
        id: 'ba-2',
        bankId: 'b-2',
        bankName: 'Banco Banesco',
        accountNumber: '0134-0002-22-9876543210',
        accountType: 'CHECKING',
        currencyId: 'c-2',
        currencyCode: 'VES',
        isActive: true,
        balance: '450000.00',
      },
    ]);
  }),

  http.get(`${API}/treasury/payments`, () => {
    return HttpResponse.json({
      data: [
        {
          id: 'pay-1',
          code: 'PAG-00001',
          partnerId: 'p-1',
          partnerName: 'Cliente ABC C.A.',
          bankAccountId: 'ba-1',
          type: 'INBOUND',
          amount: '1500.00',
          currencyId: 'c-1',
          currencyCode: 'USD',
          date: '2026-05-20',
          reference: 'REF-001',
          status: 'CONFIRMED',
        },
        {
          id: 'pay-2',
          code: 'PAG-00002',
          partnerId: 'p-2',
          partnerName: 'Proveedor XYZ S.A.',
          bankAccountId: 'ba-1',
          type: 'OUTBOUND',
          amount: '800.00',
          currencyId: 'c-1',
          currencyCode: 'USD',
          date: '2026-05-25',
          reference: 'REF-002',
          status: 'CONFIRMED',
        },
      ],
      total: 2,
    });
  }),

  http.post(`${API}/accounting/retentions`, () => {
    return HttpResponse.json({ message: 'ok' });
  }),

  http.get(`${API}/accounting/retentions`, () => {
    return HttpResponse.json({
      data: [
        {
          id: 'r-1',
          type: 'IVA',
          documentCode: 'RET-IVA-00001',
          partnerId: 'p-1',
          partnerName: 'Cliente ABC C.A.',
          invoiceId: 'inv-1',
          invoiceCode: 'FAC-A-00001',
          taxAmount: '240.00',
          retentionRate: '75',
          retentionAmount: '180.00',
          date: '2026-05-15',
          status: 'APPLIED',
        },
        {
          id: 'r-2',
          type: 'ISLR',
          documentCode: 'RET-ISLR-00001',
          partnerId: 'p-3',
          partnerName: 'Corporación Delta C.A.',
          invoiceId: 'inv-2',
          invoiceCode: 'FAC-A-00002',
          taxAmount: '1000.00',
          retentionRate: '3',
          retentionAmount: '30.00',
          date: '2026-06-01',
          status: 'DRAFT',
        },
      ],
      total: 2,
    });
  }),

  http.get(`${API}/accounting/retentions/iva/txt`, () => {
    return HttpResponse.json({
      content: 'RET-IVA-00001|180.00|2026-05-15',
      filename: 'RET-IVA-2026.txt',
    });
  }),

  http.get(`${API}/accounting/retentions/islr/xml`, () => {
    return HttpResponse.json({ content: '<RetencionISLR/>', filename: 'RET-ISLR-2026.xml' });
  }),

  http.get(`${API}/treasury/daily-close`, () => {
    return HttpResponse.json({
      data: [
        {
          id: 'dc-1',
          date: '2026-06-01',
          status: 'CLOSED',
          totalInflow: '5000.00',
          totalOutflow: '2300.00',
          netMovement: '2700.00',
          closedAt: '2026-06-01T18:00:00.000Z',
          closedBy: 'admin',
        },
        {
          id: 'dc-2',
          date: '2026-06-02',
          status: 'CLOSED',
          totalInflow: '3200.00',
          totalOutflow: '1100.00',
          netMovement: '2100.00',
          closedAt: '2026-06-02T18:00:00.000Z',
          closedBy: 'admin',
        },
        {
          id: 'dc-3',
          date: '2026-06-04',
          status: 'OPEN',
          totalInflow: '1500.00',
          totalOutflow: '500.00',
          netMovement: '1000.00',
        },
      ],
      total: 3,
    });
  }),

  http.get(`${API}/reports/balance-sheet`, () =>
    HttpResponse.json({ assets: {}, liabilities: {}, equity: {} })
  ),
  http.get(`${API}/reports/income-statement`, () =>
    HttpResponse.json({ revenue: {}, expenses: {} })
  ),
  http.get(`${API}/reports/iva-book`, () => HttpResponse.json({ rows: [] })),
  http.get(`${API}/reports/islr-book`, () => HttpResponse.json({ rows: [] })),

  http.get(`${API}/hr/employees`, () => {
    return HttpResponse.json({
      data: [
        {
          id: 'e-1',
          code: 'EMP-00001',
          firstName: 'Juan',
          lastName: 'Pérez',
          nationalId: 'V-12345678',
          email: 'juan.perez@empresa.com',
          phone: '+58-412-1234567',
          birthDate: '1985-05-10',
          hireDate: '2020-01-15',
          status: 'ACTIVE',
          departmentId: 'dep-1',
          departmentName: 'Administración',
          positionId: 'pos-1',
          positionName: 'Gerente Administrativo',
          branchId: 'branch-1',
          salary: '2500.00',
          salaryCurrencyId: 'c-1',
          salaryCurrencyCode: 'USD',
        },
        {
          id: 'e-2',
          code: 'EMP-00002',
          firstName: 'María',
          lastName: 'González',
          nationalId: 'V-23456789',
          email: 'maria.gonzalez@empresa.com',
          phone: '+58-414-2345678',
          birthDate: '1990-08-20',
          hireDate: '2021-03-10',
          status: 'ACTIVE',
          departmentId: 'dep-2',
          departmentName: 'Contabilidad',
          positionId: 'pos-2',
          positionName: 'Contador Senior',
          branchId: 'branch-1',
          salary: '1800.00',
          salaryCurrencyId: 'c-1',
          salaryCurrencyCode: 'USD',
        },
        {
          id: 'e-3',
          code: 'EMP-00003',
          firstName: 'Carlos',
          lastName: 'Rodríguez',
          nationalId: 'V-15678912',
          email: 'carlos.r@empresa.com',
          hireDate: '2019-06-01',
          status: 'SUSPENDED',
          departmentId: 'dep-3',
          departmentName: 'Ventas',
          positionId: 'pos-3',
          positionName: 'Ejecutivo de Ventas',
          branchId: 'branch-2',
          salary: '1200.00',
          salaryCurrencyId: 'c-1',
          salaryCurrencyCode: 'USD',
        },
      ],
      total: 3,
      page: 1,
      limit: 20,
    });
  }),

  http.get(`${API}/hr/departments`, () => {
    return HttpResponse.json([
      {
        id: 'dep-1',
        name: 'Administración',
        description: 'Gestión administrativa y financiera',
        parentId: null,
        managerId: 'e-1',
        managerName: 'Juan Pérez',
        isActive: true,
      },
      {
        id: 'dep-2',
        name: 'Contabilidad',
        description: 'Contabilidad y finanzas',
        parentId: 'dep-1',
        managerId: 'e-2',
        managerName: 'María González',
        isActive: true,
      },
      {
        id: 'dep-3',
        name: 'Ventas',
        description: 'Fuerza de ventas',
        parentId: null,
        managerId: null,
        isActive: true,
      },
    ]);
  }),

  http.get(`${API}/hr/positions`, () => {
    return HttpResponse.json([
      {
        id: 'pos-1',
        name: 'Gerente Administrativo',
        departmentId: 'dep-1',
        departmentName: 'Administración',
        baseSalary: '2500',
        level: 'G4',
        isActive: true,
      },
      {
        id: 'pos-2',
        name: 'Contador Senior',
        departmentId: 'dep-2',
        departmentName: 'Contabilidad',
        baseSalary: '1800',
        level: 'P3',
        isActive: true,
      },
      {
        id: 'pos-3',
        name: 'Ejecutivo de Ventas',
        departmentId: 'dep-3',
        departmentName: 'Ventas',
        baseSalary: '1200',
        level: 'P2',
        isActive: true,
      },
    ]);
  }),

  http.get(`${API}/hr/incidents`, () => {
    return HttpResponse.json({
      data: [
        {
          id: 'i-1',
          employeeId: 'e-2',
          employeeName: 'María González',
          type: 'VACATION',
          date: '2026-06-15',
          days: 5,
          reason: 'Vacaciones anuales',
          status: 'PENDING',
        },
        {
          id: 'i-2',
          employeeId: 'e-1',
          employeeName: 'Juan Pérez',
          type: 'OVERTIME',
          date: '2026-05-30',
          hours: 8,
          amount: '120.00',
          reason: 'Cierre mensual',
          status: 'APPROVED',
        },
        {
          id: 'i-3',
          employeeId: 'e-3',
          employeeName: 'Carlos Rodríguez',
          type: 'ABSENCE',
          date: '2026-06-02',
          days: 1,
          reason: 'Inasistencia injustificada',
          status: 'REJECTED',
        },
      ],
      total: 3,
    });
  }),

  http.get(`${API}/hr/payroll`, () => {
    return HttpResponse.json([
      {
        id: 'pr-1',
        code: 'NOM-000001',
        branchId: 'b-1',
        frequency: 'MONTHLY',
        currencyId: 'ves',
        startDate: '2026-09-01T00:00:00.000Z',
        endDate: '2026-09-30T00:00:00.000Z',
        totalAmount: 6420.5,
        status: 'PAID',
      },
      {
        id: 'pr-2',
        code: 'NOM-000002',
        branchId: 'b-1',
        frequency: 'MONTHLY',
        currencyId: 'ves',
        startDate: '2026-10-01T00:00:00.000Z',
        endDate: '2026-10-31T00:00:00.000Z',
        totalAmount: 10910,
        status: 'DRAFT',
      },
    ]);
  }),

  http.get(`${API}/hr/payroll/:id/parameters`, () => {
    return HttpResponse.json([
      {
        id: 'ps-1',
        companyId: 'c-1',
        key: 'SSO_EMP',
        label: 'Seguro social trabajador (%)',
        value: 4,
        type: 'PERCENT',
        branchId: null,
        effectiveFrom: '2020-01-01T00:00:00.000Z',
        isActive: true,
      },
      {
        id: 'ps-2',
        companyId: 'c-1',
        key: 'CESTATICKET_USD',
        label: 'Cestaticket mensual (USD)',
        value: 40,
        type: 'MONEY_USD',
        branchId: null,
        effectiveFrom: '2020-01-01T00:00:00.000Z',
        isActive: true,
      },
    ]);
  }),

  http.post(`${API}/hr/payroll/:id/pay`, () => {
    return HttpResponse.json({
      payrollRunId: 'pr-2',
      runCode: 'NOM-000002',
      runStatus: 'PAID',
      alreadyPaid: false,
      paymentId: 'pay-1',
      paymentCode: 'PAY-00001',
      amount: 10910,
      amountBase: 10910,
      currencyId: 'ves',
      exchangeRate: 1,
      date: '2026-10-27T00:00:00.000Z',
    });
  }),

  http.get(`${API}/hr/payroll/:id`, ({ params }) => {
    const id = String(params.id);
    return HttpResponse.json({
      id,
      code: 'NOM-000002',
      branchId: 'b-1',
      frequency: 'MONTHLY',
      currencyId: 'ves',
      startDate: '2026-10-01T00:00:00.000Z',
      endDate: '2026-10-31T00:00:00.000Z',
      totalAmount: 10910,
      status: 'DRAFT',
      items: [
        {
          id: 'pi-1',
          employeeId: 'e-1',
          employeeName: 'Juan Pérez',
          baseAmount: 10000,
          bonuses: 1460,
          deductions: 550,
          netTotal: 10910,
          lines: [
            {
              conceptCode: 'SALARY',
              conceptName: 'Sueldo del período',
              category: 'ASSIGNMENT',
              base: 10000,
              rate: 1,
              amount: 10000,
            },
            {
              conceptCode: 'CESTATICKET',
              conceptName: 'Cestaticket',
              category: 'ASSIGNMENT',
              base: 1460,
              rate: 1,
              amount: 1460,
            },
            {
              conceptCode: 'SSO_EMP',
              conceptName: 'Seguro social trabajador',
              category: 'DEDUCTION',
              base: 10000,
              rate: 0.04,
              amount: 400,
            },
            {
              conceptCode: 'SSO_PAT',
              conceptName: 'Seguro social patronal',
              category: 'EMPLOYER_CONTRIBUTION',
              base: 10000,
              rate: 0.1,
              amount: 1000,
            },
          ],
        },
      ],
    });
  }),

  http.get(`${API}/hr/settings`, () => {
    return HttpResponse.json([
      {
        id: 'ps-1',
        companyId: 'c-1',
        key: 'SSO_EMP',
        label: 'Seguro social trabajador (%)',
        value: 4,
        type: 'PERCENT',
        branchId: null,
        effectiveFrom: '2020-01-01T00:00:00.000Z',
        isActive: true,
      },
      {
        id: 'ps-2',
        companyId: 'c-1',
        key: 'DIAS_UTILIDADES',
        label: 'Días mínimos de utilidades',
        value: 30,
        type: 'NUMBER',
        branchId: null,
        effectiveFrom: '2020-01-01T00:00:00.000Z',
        isActive: true,
      },
    ]);
  }),

  http.patch(`${API}/hr/settings`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({
      id: 'ps-1',
      companyId: 'c-1',
      key: String(body.key),
      label: String(body.label ?? body.key),
      value: Number(body.value),
      type: String(body.type ?? 'NUMBER'),
      branchId: null,
      effectiveFrom: '2026-10-27T00:00:00.000Z',
      isActive: true,
    });
  }),

  http.get(`${API}/hr/concept-types`, () => {
    return HttpResponse.json([
      {
        id: 'pc-1',
        code: 'SALARY',
        name: 'Sueldo del período',
        category: 'ASSIGNMENT',
        kind: 'FORMULA',
        expression: 'SALARY_BASE * (PERIOD_DAYS / MONTH_DAYS)',
        affectsIntegralSalary: true,
        isSalarial: true,
        isSystem: true,
        branchId: null,
      },
      {
        id: 'pc-2',
        code: 'CESTATICKET',
        name: 'Cestaticket',
        category: 'ASSIGNMENT',
        kind: 'FORMULA',
        expression: 'CESTATICKET_USD * (PERIOD_DAYS / MONTH_DAYS)',
        affectsIntegralSalary: false,
        isSalarial: false,
        isSystem: true,
        branchId: null,
      },
      {
        id: 'pc-3',
        code: 'SSO_PAT',
        name: 'Seguro social patronal',
        category: 'EMPLOYER_CONTRIBUTION',
        kind: 'FORMULA',
        expression: 'BASE_IVSS * SSO_PAT / 100',
        affectsIntegralSalary: false,
        isSalarial: true,
        isSystem: true,
        branchId: null,
      },
    ]);
  }),

  http.post(`${API}/hr/concept-types`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(
      {
        id: 'pc-new',
        code: String(body.code),
        name: String(body.name),
        category: String(body.category),
        kind: String(body.kind ?? 'FIXED'),
        expression: (body.expression as string | null) ?? null,
        affectsIntegralSalary: Boolean(body.affectsIntegralSalary),
        isSalarial: body.isSalarial !== false,
        isSystem: false,
        branchId: null,
      },
      { status: 201 }
    );
  }),

  http.patch(`${API}/hr/concept-types/:id`, async ({ request, params }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({
      id: String(params.id),
      code: 'PRIMA',
      name: String(body.name ?? 'Prima'),
      category: String(body.category ?? 'ASSIGNMENT'),
      kind: String(body.kind ?? 'FIXED'),
      expression: (body.expression as string | null) ?? null,
      affectsIntegralSalary: Boolean(body.affectsIntegralSalary),
      isSalarial: body.isSalarial !== false,
      isSystem: false,
      branchId: null,
    });
  }),

  http.delete(`${API}/hr/concept-types/:id`, () => {
    return HttpResponse.json({ deleted: true });
  }),

  http.get(`${API}/hr/employees/:id/vacations`, ({ params }) => {
    return HttpResponse.json({
      employeeId: String(params.id),
      years: 3,
      vacationDays: 17,
      bonusDays: 9,
      daysTaken: 0,
      daysPending: 17,
      normalDaily: 333.333333,
    });
  }),

  http.get(`${API}/hr/employees/:id/benefits`, ({ params }) => {
    return HttpResponse.json({
      employeeId: String(params.id),
      years: 3,
      integralDaily: 367.592592,
      quartersDeposited: 1,
      guaranteeAccumulated: 5513.89,
      retroactive: 33083.33,
      payable: 33083.33,
      modality: 'RETROACTIVE',
    });
  }),

  http.get(`${API}/hr/employees/:id/settlement`, ({ params }) => {
    return HttpResponse.json({
      id: 'st-1',
      employeeId: String(params.id),
      terminationDate: '2026-10-31T00:00:00.000Z',
      cause: 'RENUNCIA',
      years: 3,
      integralSalary: 367.59,
      normalSalary: 333.33,
      guaranteeAccumulated: 5513.89,
      retroactive: 33083.33,
      benefitsAmount: 33083.33,
      benefitsModality: 'RETROACTIVE',
      vacationDays: 17,
      vacationAmount: 5666.67,
      bonusDays: 9,
      bonusAmount: 3000,
      profitDays: 25,
      profitAmount: 8333.33,
      indemnificationDays: 0,
      indemnificationAmount: 0,
      totalAmount: 50083.33,
      status: 'CALCULATED',
    });
  }),

  http.get(`${API}/bi/kpis`, () => {
    return HttpResponse.json([
      {
        id: 'k-1',
        title: 'Ventas del día',
        value: 12500,
        formatted: '$12,500.00',
        change: 12.5,
        changeLabel: 'vs ayer',
        icon: 'DollarSign',
        variant: 'default',
      },
      {
        id: 'k-2',
        title: 'Cuentas por cobrar',
        value: 4500,
        formatted: '$4,500.00',
        change: -3.2,
        changeLabel: 'vs mes anterior',
        icon: 'Wallet',
        variant: 'warning',
      },
      {
        id: 'k-3',
        title: 'Inventario valorizado',
        value: 89000,
        formatted: '$89,000.00',
        change: 5.8,
        changeLabel: 'vs semana',
        icon: 'Package',
        variant: 'success',
      },
      {
        id: 'k-4',
        title: 'Pedidos pendientes',
        value: 7,
        formatted: '7',
        change: 2,
        changeLabel: 'vs ayer',
        icon: 'ShoppingCart',
        variant: 'warning',
      },
      {
        id: 'k-5',
        title: 'Nómina del mes',
        value: 6420,
        formatted: '$6,420.50',
        change: 0,
        changeLabel: 'cerrado',
        icon: 'Users',
        variant: 'default',
      },
      {
        id: 'k-6',
        title: 'Productos bajo stock',
        value: 3,
        formatted: '3',
        change: -25,
        changeLabel: 'reabastecidos',
        icon: 'AlertCircle',
        variant: 'destructive',
      },
      {
        id: 'k-7',
        title: 'Ingresos del mes',
        value: 45000,
        formatted: '$45,000.00',
        change: 18.2,
        changeLabel: 'vs mes anterior',
        icon: 'TrendingUp',
        variant: 'success',
      },
      {
        id: 'k-8',
        title: 'Egresos del mes',
        value: 28750,
        formatted: '$28,750.00',
        change: 4.1,
        changeLabel: 'vs mes anterior',
        icon: 'TrendingDown',
        variant: 'destructive',
      },
    ]);
  }),

  http.get(`${API}/bi/chart`, () => {
    const days = 30;
    const today = new Date('2026-06-04');
    const data = Array.from({ length: days }).map((_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (days - 1 - i));
      const base = 1500 + Math.sin(i / 4) * 600;
      return {
        date: d.toISOString().split('T')[0],
        income: Math.round(base + Math.random() * 800),
        expense: Math.round(base * 0.7 + Math.random() * 400),
      };
    });
    return HttpResponse.json(data);
  }),

  http.get(`${API}/bi/activity`, () => {
    return HttpResponse.json([
      {
        id: 'a-1',
        type: 'INVOICE',
        title: 'Factura FAC-A-00125 emitida',
        description: 'Cliente ABC C.A. — $1,500.00',
        userName: 'admin',
        timestamp: '2026-06-04T14:32:00.000Z',
      },
      {
        id: 'a-2',
        type: 'PAYMENT',
        title: 'Pago recibido PAG-00042',
        description: 'Corporación Delta C.A. — $2,300.00',
        userName: 'cajero',
        timestamp: '2026-06-04T11:15:00.000Z',
      },
      {
        id: 'a-3',
        type: 'MOVE',
        title: 'Movimiento MOV-00031 aprobado',
        description: 'Entrada de 10 unidades SKU-001',
        userName: 'almacen',
        timestamp: '2026-06-04T09:45:00.000Z',
      },
      {
        id: 'a-4',
        type: 'INCIDENT',
        title: 'Vacaciones aprobadas',
        description: 'María González — 5 días',
        userName: 'rrhh',
        timestamp: '2026-06-03T16:20:00.000Z',
      },
      {
        id: 'a-5',
        type: 'EMPLOYEE',
        title: 'Nuevo empleado registrado',
        description: 'EMP-00015 — Carlos Méndez',
        userName: 'rrhh',
        timestamp: '2026-06-03T10:00:00.000Z',
      },
    ]);
  }),

  http.get(`${API}/branches/companies`, () => {
    return HttpResponse.json([
      {
        taxId: 'J-12345678-9',
        name: 'Acme Holdings C.A.',
        address: 'Av. Libertador',
        phone: '+58-212-555-1234',
        email: 'info@acme.com',
        branchCount: 2,
        branches: [
          { id: 'branch-1', name: 'Sucursal Caracas', taxId: 'J-12345678-9', isActive: true },
          { id: 'branch-2', name: 'Sucursal Valencia', taxId: 'J-12345678-9', isActive: true },
        ],
      },
      {
        taxId: 'J-98765432-1',
        name: 'Otra Empresa',
        address: 'Av. 2',
        phone: '+58-212-555-9999',
        email: 'info@other.com',
        branchCount: 1,
        branches: [{ id: 'branch-3', name: 'Otra Empresa', taxId: 'J-98765432-1', isActive: true }],
      },
    ]);
  }),

  http.get(`${API}/settings/exchange-rates/current`, () => {
    return HttpResponse.json({
      id: 'rate-1',
      rate: '36.5234',
      date: '2026-06-04T00:00:00.000Z',
      source: 'BCV',
    });
  }),

  http.get(`${API}/search`, ({ request }) => {
    const url = new URL(request.url);
    const q = url.searchParams.get('q') ?? '';
    return HttpResponse.json([
      { type: 'partner', id: 'p-1', title: `Cliente ABC (${q})`, subtitle: 'J-11111111-1' },
      { type: 'product', id: 'pr-1', title: `Producto XYZ (${q})` },
    ]);
  }),
];
