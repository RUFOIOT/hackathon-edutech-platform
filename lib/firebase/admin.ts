import "server-only";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

/**
 * SDK de administración (solo servidor). Ignora las reglas de seguridad: toda escritura que pase
 * por aquí debe validar permisos en código y registrar auditoría (lib/audit.ts).
 *
 * Con emuladores (FIRESTORE_EMULATOR_HOST definido) no se necesitan credenciales.
 */
function initAdmin(): App {
  const existing = getApps()[0];
  if (existing) return existing;

  const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    return initializeApp({ projectId, storageBucket });
  }

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  // Netlify guarda los saltos de línea de la clave como "\n" literales.
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Faltan FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL o FIREBASE_PRIVATE_KEY (ver .env.example).");
  }
  return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId, storageBucket });
}

// Inicialización perezosa: `next build` importa los módulos sin credenciales; solo se conecta al usarse.
export const adminAuth = () => getAuth(initAdmin());
export const adminDb = () => getFirestore(initAdmin());
export const adminStorage = () => getStorage(initAdmin());
