/**
 * Hora actual del servidor. Para ensayos y tests e2e se puede simular con APP_FECHA_SIMULADA
 * (ISO con offset), pero SOLO si la app apunta a los emuladores de Firebase: un despliegue real
 * nunca define FIRESTORE_EMULATOR_HOST, así que en producción siempre es la hora real (D-16).
 */
export function ahora(): Date {
  const simulada = process.env.APP_FECHA_SIMULADA;
  if (simulada && process.env.FIRESTORE_EMULATOR_HOST) {
    const d = new Date(simulada);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}
