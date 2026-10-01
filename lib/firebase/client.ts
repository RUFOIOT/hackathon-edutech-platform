"use client";

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore, type Firestore } from "firebase/firestore";

/**
 * SDK cliente: autenticación y lecturas en tiempo real. Nunca escribe (ver firestore.rules).
 * Se inicializa al primer uso en el navegador, no al importar: así el prerender del servidor
 * no necesita configuración de Firebase.
 */
const useEmulators = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true";

function app(): FirebaseApp {
  if (getApps().length) return getApp();
  return initializeApp({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  });
}

let auth: Auth | undefined;
let db: Firestore | undefined;

export function clientAuth(): Auth {
  if (!auth) {
    auth = getAuth(app());
    if (useEmulators) connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  }
  return auth;
}

export function clientDb(): Firestore {
  if (!db) {
    db = getFirestore(app());
    if (useEmulators) connectFirestoreEmulator(db, "127.0.0.1", 8080);
  }
  return db;
}
