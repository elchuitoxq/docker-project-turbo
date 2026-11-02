import { PERMISSIONS } from '@/lib/permissions';
import type { GuideModule } from '../types';

export const HR_GUIDE: GuideModule = {
  id: 'hr',
  title: 'Recursos Humanos',
  description:
    'Expediente del personal y proceso de nómina bajo normativa venezolana: desde el alta del empleado hasta el pago de la corrida.',
  href: '/dashboard/hr',
  permission: PERMISSIONS.HR.VIEW,
  icon: 'Users',
  submodules: [
    {
      id: 'employees',
      title: 'Empleados',
      href: '/dashboard/hr/employees',
      summary:
        'Expediente laboral: datos personales, cargo, departamento, fecha de ingreso y salario.',
      viewPermission: PERMISSIONS.HR.EMPLOYEES.VIEW,
      actions: [
        { label: 'Consultar empleados', permission: PERMISSIONS.HR.EMPLOYEES.VIEW },
        { label: 'Dar de alta', permission: PERMISSIONS.HR.EMPLOYEES.CREATE },
        { label: 'Editar expediente', permission: PERMISSIONS.HR.EMPLOYEES.EDIT },
        { label: 'Dar de baja', permission: PERMISSIONS.HR.EMPLOYEES.DELETE },
      ],
      steps: [
        'Crea el empleado con cédula, cargo y departamento.',
        'Registra la fecha de ingreso y el salario base.',
        'Confirma que aparezca en la corrida de nómina del período.',
      ],
      rules: [
        'Estados: Activo, Inactivo, Suspendido y Egresado.',
        'La fecha de ingreso determina la antigüedad y los beneficios.',
        'Un empleado egresado no se elimina: conserva su histórico de nómina.',
      ],
      pitfalls: [
        {
          symptom: 'El empleado no sale en la nómina',
          cause: 'Está Inactivo o no tiene salario base configurado.',
        },
      ],
      caution: 'Dar de baja a un empleado con nómina procesada afecta el histórico legal.',
    },
    {
      id: 'positions',
      title: 'Cargos',
      href: '/dashboard/hr/positions',
      summary: 'Catálogo de cargos que se asignan a los empleados y alimentan la nómina.',
      viewPermission: PERMISSIONS.HR.VIEW,
      actions: [{ label: 'Gestionar cargos', permission: PERMISSIONS.HR.POSITIONS.MANAGE }],
      steps: [
        'Crea el cargo con su nombre y nivel.',
        'Asígnalo a los empleados que correspondan.',
        'Verifica que el cargo aparezca al dar de alta un empleado.',
      ],
      rules: [
        'Consultar el catálogo requiere `hr:view`; modificarlo exige `hr:positions:manage`.',
        'Un cargo en uso no se elimina.',
      ],
      pitfalls: [
        {
          symptom: 'No veo el botón para crear cargos',
          cause: 'Falta `hr:positions:manage`.',
        },
      ],
    },
    {
      id: 'departments',
      title: 'Departamentos',
      href: '/dashboard/hr/departments',
      summary: 'Estructura organizativa que agrupa cargos y empleados.',
      viewPermission: PERMISSIONS.HR.VIEW,
      actions: [
        { label: 'Gestionar departamentos', permission: PERMISSIONS.HR.DEPARTMENTS.MANAGE },
      ],
      steps: [
        'Crea el departamento con su responsable.',
        'Asocia los cargos correspondientes.',
        'Verifica la distribución en el expediente del empleado.',
      ],
      rules: [
        'Consultar requiere `hr:view`; modificar exige `hr:departments:manage`.',
        'Un departamento con empleados activos no se elimina.',
      ],
      pitfalls: [
        {
          symptom: 'No puedo crear departamentos',
          cause: 'Falta `hr:departments:manage`.',
        },
      ],
    },
    {
      id: 'payroll',
      title: 'Nómina',
      href: '/dashboard/hr/payroll',
      summary:
        'Corridas de nómina por período: devengos, deducciones legales y aportes patronales.',
      viewPermission: PERMISSIONS.HR.PAYROLL.VIEW,
      actions: [
        { label: 'Consultar corridas', permission: PERMISSIONS.HR.PAYROLL.VIEW },
        { label: 'Procesar nómina', permission: PERMISSIONS.HR.PAYROLL.PROCESS },
      ],
      steps: [
        'Confirma que los parámetros legales estén configurados y vigentes.',
        'Genera la corrida del período: queda en Borrador.',
        'Revisa devengos, deducciones y aportes por empleado.',
        'Procesa la corrida y luego registra el pago.',
      ],
      rules: [
        'Estados: Borrador → Procesada → Pagada; también Anulada.',
        'Sólo el Borrador se puede recalcular; procesar congela los montos.',
        'Las deducciones se calculan con los parámetros legales vigentes del período.',
      ],
      pitfalls: [
        {
          symptom: 'La corrida no genera montos',
          cause: 'Faltan parámetros legales o empleados activos con salario.',
        },
        {
          symptom: 'No aparece el botón Procesar',
          cause: 'Falta `hr:payroll:process`.',
        },
      ],
      caution: 'Procesar una corrida congela los cálculos del período; verifícalos antes.',
    },
    {
      id: 'payroll-settings',
      title: 'Parámetros de nómina',
      href: '/dashboard/settings/payroll-settings',
      summary:
        'Topes y alícuotas legales (SSO, paro forzoso, FAOV, cestaticket, utilidades, vacaciones, ISLR).',
      viewPermission: PERMISSIONS.HR.SETTINGS.VIEW,
      actions: [
        { label: 'Consultar parámetros', permission: PERMISSIONS.HR.SETTINGS.VIEW },
        { label: 'Modificar parámetros', permission: PERMISSIONS.HR.SETTINGS.MANAGE },
      ],
      steps: [
        'Revisa la vigencia de cada parámetro antes del período.',
        'Actualiza las alícuotas y topes según gaceta.',
        'Valida el efecto en una corrida de prueba antes de procesar.',
      ],
      rules: [
        'Un parámetro mal cargado altera todas las corridas del período.',
        'Consultar no habilita modificar: se requiere `hr:settings:manage`.',
      ],
      pitfalls: [
        {
          symptom: 'Las deducciones no coinciden con la ley',
          cause: 'Alícuota o tope desactualizado en los parámetros.',
        },
      ],
      caution: 'Cambiar parámetros afecta cálculos legales: valida con el contador.',
    },
    {
      id: 'payroll-concepts',
      title: 'Conceptos de nómina',
      href: '/dashboard/settings/payroll-concepts',
      summary:
        'Catálogo de conceptos que componen la nómina: asignaciones, deducciones y aportes patronales.',
      viewPermission: PERMISSIONS.HR.CONCEPTS.VIEW,
      actions: [
        { label: 'Consultar conceptos', permission: PERMISSIONS.HR.CONCEPTS.VIEW },
        { label: 'Gestionar conceptos', permission: PERMISSIONS.HR.CONCEPTS.MANAGE },
      ],
      steps: [
        'Revisa qué conceptos son asignaciones y cuáles deducciones.',
        'Crea el concepto con su fórmula o monto fijo.',
        'Verifica que aparezca en la corrida del período.',
      ],
      rules: [
        'Un concepto mal clasificado invierte el signo del cálculo.',
        'Desactivar un concepto no borra lo ya procesado.',
      ],
      pitfalls: [
        {
          symptom: 'Un concepto no aparece en la corrida',
          cause: 'Está inactivo o no aplica al tipo de empleado.',
        },
      ],
    },
    {
      id: 'incidents',
      title: 'Novedades',
      href: '/dashboard/hr/incidents',
      summary:
        'Ausencias, horas extra, permisos y otros eventos que ajustan la nómina del período.',
      viewPermission: PERMISSIONS.HR.INCIDENTS.VIEW,
      actions: [
        { label: 'Consultar novedades', permission: PERMISSIONS.HR.INCIDENTS.VIEW },
        { label: 'Registrar novedad', permission: PERMISSIONS.HR.INCIDENTS.CREATE },
        { label: 'Aprobar o rechazar', permission: PERMISSIONS.HR.INCIDENTS.APPROVE },
      ],
      steps: [
        'Registra la novedad con empleado, tipo y fechas.',
        'Queda Pendiente hasta que un aprobador la revise.',
        'Al aprobarse, impacta la corrida de nómina del período.',
      ],
      rules: [
        'Estados: Pendiente → Aprobada / Rechazada.',
        'Sólo las aprobadas afectan la nómina.',
        'Quien registra no debe aprobar su propia novedad.',
      ],
      pitfalls: [
        {
          symptom: 'La novedad no afectó el pago',
          cause: 'Sigue Pendiente o el período ya fue procesado.',
        },
      ],
    },
  ],
};
