import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getDatabase, connectDatabaseEmulator } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";
import { getAuth, connectAuthEmulator } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { firebaseConfig } from "./config.js";

// Modo prueba: solo en el computador local y con ?emulador en la URL
const local = ["localhost", "127.0.0.1"].includes(location.hostname);
export const EMULADOR = local && new URLSearchParams(location.search).has("emulador");

const app = initializeApp(EMULADOR
  ? { apiKey: "demo", projectId: "demo-solicitudes", databaseURL: "http://127.0.0.1:9000?ns=demo-solicitudes" }
  : firebaseConfig);
export const db = getDatabase(app);
export const auth = getAuth(app);
if (EMULADOR) {
  connectDatabaseEmulator(db, "127.0.0.1", 9000);
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
}

export const PRIORIDADES = {
  alta: { nombre: "Alta", icono: "🔴", ayuda: "Urgente: algo no funciona o bloquea el trabajo. Además llámame o escríbeme por WhatsApp." },
  media: { nombre: "Media", icono: "🟠", ayuda: "Hay que hacerlo pronto, pero no es una emergencia." },
  baja: { nombre: "Baja", icono: "🟢", ayuda: "Sin apuro: colores, textos, detalles visuales." }
};
export const ORDEN_PRIORIDAD = { alta: 0, media: 1, baja: 2 };

export const ESTADOS = {
  en_proceso: { nombre: "En proceso", icono: "🔧", ayuda: "Estoy trabajando en esto" },
  recibida: { nombre: "Recibida", icono: "📥", ayuda: "Recibida, aún sin empezar" },
  terminada: { nombre: "Terminada", icono: "✅", ayuda: "Lista" },
  descartada: { nombre: "Descartada", icono: "✖️", ayuda: "No se hará" }
};

export const SECCIONES = {
  formulario: "Formulario de registro",
  tickets: "Tickets",
  previred: "Previred / LRE",
  contratos: "Contratos",
  pagos: "Pagos y efectivo",
  finanzas: "Finanzas",
  seguridad: "Seguridad",
  base_datos: "Base de datos y edición",
  nat_pagos: "NAT Pagos",
  otro: "Otro"
};

// Crea elementos sin usar innerHTML: todo texto escrito por personas va como texto, nunca como HTML
export function el(tag, props = {}, ...hijos) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === "class") e.className = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? "" : v);
  }
  for (const h of hijos.flat()) if (h != null && h !== false) e.append(h);
  return e;
}

export function fecha(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleString("es-CL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function chipPrioridad(p) {
  const x = PRIORIDADES[p] || PRIORIDADES.baja;
  return el("span", { class: `chip prio-${p}` }, `${x.icono} ${x.nombre}`);
}

export function chipEstado(s) {
  const x = ESTADOS[s] || ESTADOS.recibida;
  return el("span", { class: `chip estado-${s}`, title: x.ayuda }, `${x.icono} ${x.nombre}`);
}

// Orden: en proceso primero, luego recibidas (por prioridad y antigüedad), luego terminadas (más recientes primero)
export function ordenar(lista) {
  const grupo = { en_proceso: 0, recibida: 1, terminada: 2, descartada: 3 };
  return lista.sort((a, b) =>
    (grupo[a.estado] - grupo[b.estado]) ||
    (a.estado === "terminada" || a.estado === "descartada"
      ? (b.terminada || b.actualizada) - (a.terminada || a.actualizada)
      : (ORDEN_PRIORIDAD[a.prioridad] - ORDEN_PRIORIDAD[b.prioridad]) || (a.creada - b.creada)));
}
