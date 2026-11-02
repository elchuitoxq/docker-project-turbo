import { redirect } from 'next/navigation';

/**
 * El panel de BI duplicaba `/dashboard` y consumía un contrato que el backend no expone
 * (KPIs como arreglo). Se mantiene la URL por compatibilidad, redirigiendo al panel real.
 */
export default function BiPage() {
  redirect('/dashboard');
}
