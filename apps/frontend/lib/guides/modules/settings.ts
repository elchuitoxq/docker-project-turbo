import { PERMISSIONS } from '@/lib/permissions';
import type { GuideModule } from '../types';

export const SETTINGS_GUIDE: GuideModule = {
  id: 'settings',
  title: 'Configuración',
  description:
    'Maestros y control de acceso. Aquí se decide quién puede hacer qué: usuarios, roles y parámetros compartidos por toda la operación.',
  href: '/dashboard/settings',
  permission: PERMISSIONS.SETTINGS.VIEW,
  icon: 'Settings',
  submodules: [
    {
      id: 'users',
      title: 'Usuarios',
      href: '/dashboard/settings/users',
      summary: 'Cuentas de acceso al sistema, su rol, su sucursal y su estado.',
      viewPermission: PERMISSIONS.SETTINGS.USERS.VIEW,
      actions: [
        { label: 'Consultar usuarios', permission: PERMISSIONS.SETTINGS.USERS.VIEW },
        { label: 'Crear usuario', permission: PERMISSIONS.SETTINGS.USERS.CREATE },
        { label: 'Editar usuario', permission: PERMISSIONS.SETTINGS.USERS.EDIT },
        { label: 'Administrar accesos', permission: PERMISSIONS.SETTINGS.USERS.MANAGE },
      ],
      steps: [
        'Crea el usuario con correo corporativo y sucursal predeterminada.',
        'Asigna uno o más roles: los permisos efectivos son la unión de todos.',
        'Verifica el acceso iniciando sesión con la cuenta creada.',
      ],
      rules: [
        'Los permisos efectivos son la unión de los roles asignados.',
        'Un usuario desactivado conserva su histórico de auditoría.',
        'Cambiar el rol no cierra la sesión activa hasta el próximo inicio.',
      ],
      pitfalls: [
        {
          symptom: 'El usuario no ve un módulo',
          cause: 'Ninguno de sus roles incluye el permiso de ese módulo.',
        },
      ],
      caution: 'Quitar el último rol de administración puede dejar el sistema sin administrador.',
    },
    {
      id: 'roles',
      title: 'Roles y permisos',
      href: '/dashboard/settings/roles',
      summary:
        'Definición de roles y asignación de permisos por módulo. Es la fuente de lo que cada usuario puede hacer.',
      viewPermission: PERMISSIONS.SETTINGS.ROLES.VIEW,
      actions: [
        { label: 'Consultar roles', permission: PERMISSIONS.SETTINGS.ROLES.VIEW },
        { label: 'Modificar permisos de un rol', permission: PERMISSIONS.SETTINGS.ROLES.MANAGE },
      ],
      steps: [
        'Selecciona el rol que quieres ajustar.',
        'Marca los permisos necesarios, agrupados por módulo.',
        'Guarda y valida entrando con un usuario de ese rol.',
        'Usa esta guía para confirmar el efecto de cada permiso.',
      ],
      rules: [
        'Los roles del sistema no se eliminan; se ajustan sus permisos.',
        'Un permiso quitado aplica al siguiente inicio de sesión del usuario.',
        'El principio de mínimo privilegio: concede sólo lo que la función exige.',
      ],
      pitfalls: [
        {
          symptom: 'El cambio de permisos no surte efecto',
          cause: 'La sesión del usuario mantiene los permisos anteriores hasta refrescar.',
        },
        {
          symptom: 'No puedo guardar cambios',
          cause: 'Falta `settings:roles:manage`.',
        },
      ],
      caution: 'Otorgar `settings:roles:manage` permite a ese rol redefinir todos los permisos.',
    },
    {
      id: 'branches',
      title: 'Sucursales',
      href: '/dashboard/settings/branches',
      summary:
        'Estructura empresa → sucursal. Determina el contexto con el que se opera y se filtra la información.',
      viewAnyPermissions: [PERMISSIONS.SETTINGS.COMPANIES.VIEW, PERMISSIONS.SETTINGS.BRANCHES.VIEW],
      actions: [
        {
          label: 'Consultar estructura',
          permission: PERMISSIONS.SETTINGS.COMPANIES.VIEW,
        },
        { label: 'Gestionar sucursales', permission: PERMISSIONS.SETTINGS.BRANCHES.MANAGE },
      ],
      steps: [
        'Revisa la empresa activa en el selector de contexto.',
        'Confirma qué sucursales tiene y cuál es la predeterminada.',
        'Cambia de sucursal desde el selector: la caché de datos se reinicia.',
      ],
      rules: [
        'Los datos operativos siempre están acotados a la sucursal activa.',
        'Cambiar de sucursal invalida la caché del servidor para evitar datos cruzados.',
        'Operar sobre sucursales no asignadas exige `core:branch:all` (super admin).',
      ],
      pitfalls: [
        {
          symptom: 'No veo datos de otra sucursal',
          cause: 'No está seleccionada en el contexto o no tienes `core:branch:all`.',
        },
      ],
    },
    {
      id: 'banks',
      title: 'Bancos',
      href: '/dashboard/settings/banks',
      summary: 'Catálogo de bancos usado al crear cuentas bancarias y registrar pagos.',
      viewPermission: PERMISSIONS.SETTINGS.BANKS.VIEW,
      actions: [
        { label: 'Consultar bancos', permission: PERMISSIONS.SETTINGS.BANKS.VIEW },
        { label: 'Gestionar bancos', permission: PERMISSIONS.SETTINGS.BANKS.MANAGE },
      ],
      steps: [
        'Verifica si el banco ya existe antes de crearlo.',
        'Crea el banco con su código y país.',
        'Confírmalo en el formulario de cuentas bancarias.',
      ],
      rules: [
        'El banco es un maestro compartido entre sucursales.',
        'Un banco con cuentas asociadas no se elimina.',
      ],
      pitfalls: [
        {
          symptom: 'No aparece mi banco al crear la cuenta',
          cause: 'El banco no está cargado en el catálogo.',
        },
      ],
    },
    {
      id: 'methods',
      title: 'Métodos de pago',
      href: '/dashboard/settings/methods',
      summary:
        'Formas de cobro y pago, con indicadores de IGTF, referencia obligatoria y manejo de efectivo.',
      viewPermission: PERMISSIONS.FINANCE.TREASURY.VIEW,
      actions: [
        { label: 'Consultar métodos', permission: PERMISSIONS.FINANCE.TREASURY.VIEW },
        {
          label: 'Gestionar métodos',
          permission: PERMISSIONS.FINANCE.TREASURY.CREATE_ACCOUNT,
        },
      ],
      steps: [
        'Revisa si el método aplica IGTF y exige referencia.',
        'Configúralo con su moneda y sucursal.',
        'Verifícalo en el formulario de pago.',
      ],
      rules: [
        'Un método marcado como efectivo afecta el arqueo de caja.',
        'Si exige referencia, el pago no se registra sin ella.',
        'La administración de métodos usa `finance:treasury:create_account`, no `:view`.',
      ],
      pitfalls: [
        {
          symptom: 'El sistema no pide referencia en un pago digital',
          cause: 'El método está mal configurado (sin «requiere referencia»).',
        },
      ],
    },
    {
      id: 'currencies',
      title: 'Monedas',
      href: '/dashboard/settings/currencies',
      summary:
        'Monedas habilitadas y su tasa. La moneda funcional del sistema es VES y los documentos congelan su tasa.',
      viewPermission: PERMISSIONS.SETTINGS.CURRENCIES.VIEW,
      actions: [
        { label: 'Consultar monedas y tasas', permission: PERMISSIONS.SETTINGS.CURRENCIES.VIEW },
        { label: 'Gestionar monedas', permission: PERMISSIONS.SETTINGS.CURRENCIES.MANAGE },
      ],
      steps: [
        'Verifica la tasa vigente antes de emitir documentos.',
        'Actualiza la tasa cuando cambie el mercado.',
        'Confirma el efecto en el siguiente documento emitido.',
      ],
      rules: [
        'La tasa se congela en el documento: cambiarla no revaloriza lo ya emitido.',
        'La moneda funcional es VES; los reportes muestran la equivalencia.',
      ],
      pitfalls: [
        {
          symptom: 'Los montos no coinciden con el día del documento',
          cause: 'La tasa se actualizó después de emitirlo: el documento conserva la suya.',
        },
      ],
    },
    {
      id: 'taxes',
      title: 'Impuestos',
      href: '/dashboard/settings/tax-concepts',
      summary: 'Conceptos de impuesto (IVA, IGTF y otros) aplicables a productos y documentos.',
      viewPermission: PERMISSIONS.SETTINGS.TAXES.VIEW,
      actions: [
        { label: 'Consultar impuestos', permission: PERMISSIONS.SETTINGS.TAXES.VIEW },
        { label: 'Gestionar impuestos', permission: PERMISSIONS.SETTINGS.TAXES.MANAGE },
      ],
      steps: [
        'Revisa la alícuota vigente del concepto.',
        'Asócialo a los productos que correspondan.',
        'Confirma el cálculo en el siguiente documento emitido.',
      ],
      rules: [
        'Un cambio de alícuota no altera documentos ya emitidos.',
        'El impuesto debe existir antes de asignarlo a un producto.',
      ],
      pitfalls: [
        {
          symptom: 'La factura calcula 0 % de impuesto',
          cause: 'El producto no tiene concepto de impuesto asociado.',
        },
      ],
    },
    {
      id: 'supplier-retentions',
      title: 'Retenciones al proveedor',
      href: '/dashboard/settings/retentions',
      summary: 'Porcentajes y conceptos de retención de IVA e ISLR que se aplican a las compras.',
      viewPermission: PERMISSIONS.FINANCE.INVOICES.VIEW,
      actions: [
        { label: 'Consultar configuración', permission: PERMISSIONS.FINANCE.INVOICES.VIEW },
        { label: 'Gestionar retenciones', permission: PERMISSIONS.SETTINGS.TAXES.MANAGE },
      ],
      steps: [
        'Verifica el porcentaje aplicable por concepto.',
        'Asocia el concepto al proveedor o al tipo de compra.',
        'Confirma el cálculo en la factura de compra.',
      ],
      rules: [
        'La retención se calcula sobre la base imponible del documento.',
        'Un porcentaje mal configurado se propaga a todas las compras del período.',
      ],
      pitfalls: [
        {
          symptom: 'La retención sale en cero',
          cause: 'El proveedor no tiene concepto de retención asociado.',
        },
      ],
      caution: 'Un porcentaje incorrecto afecta la declaración fiscal del período.',
    },
    {
      id: 'payroll-guide',
      title: 'Guía de parámetros legales',
      href: '/dashboard/settings/payroll-guide',
      summary:
        'Recorrido explicativo de los parámetros de nómina: qué exige la ley, cómo se aplica y qué decidir.',
      viewPermission: PERMISSIONS.HR.SETTINGS.VIEW,
      actions: [
        { label: 'Consultar la guía', permission: PERMISSIONS.HR.SETTINGS.VIEW },
        { label: 'Modificar parámetros', permission: PERMISSIONS.HR.SETTINGS.MANAGE },
      ],
      steps: [
        'Lee el estado de cada parámetro y su fuente legal.',
        'Identifica los que requieren validación con el contador.',
        'Aplica el cambio en Parámetros de nómina y valida en una corrida de prueba.',
      ],
      rules: [
        'Consultar la guía es de sólo lectura.',
        'Los valores deben confirmarse con el contador antes de procesar la nómina.',
      ],
      pitfalls: [
        {
          symptom: 'No veo la guía en el menú',
          cause: 'Falta `hr:settings:view`.',
        },
      ],
    },
    {
      id: 'audit',
      title: 'Auditoría',
      href: '/dashboard/settings/audit',
      summary:
        'Registro de acciones sensibles: quién hizo qué, cuándo, sobre qué documento y qué cambió.',
      viewPermission: PERMISSIONS.SETTINGS.AUDIT.VIEW,
      actions: [
        { label: 'Consultar la bitácora', permission: PERMISSIONS.SETTINGS.AUDIT.VIEW },
        { label: 'Exportar el resultado a CSV', permission: PERMISSIONS.SETTINGS.AUDIT.EXPORT },
      ],
      steps: [
        'Escribe el código del documento, el nombre del usuario o una palabra de la descripción en el buscador.',
        'Acota con los filtros de módulo, acción, resultado y fecha (o usa los atajos Hoy/Semana).',
        'Abre el registro para ver el antes y el después de cada campo.',
        'Comparte la búsqueda: los filtros quedan en la dirección de la página.',
      ],
      rules: [
        'La bitácora es de sólo lectura: no se edita ni se borra.',
        'Consultarla exige `settings:audit:view`; exportarla, `settings:audit:export`.',
        'Las horas se muestran en la zona horaria del navegador.',
      ],
      pitfalls: [
        {
          symptom: 'No encuentro una acción reciente',
          cause: 'El filtro de fechas la excluye o la acción no toca una entidad auditada.',
        },
        {
          symptom: 'No veo el botón de exportar',
          cause: 'Falta `settings:audit:export` en tu rol.',
        },
      ],
    },
  ],
};
