// Pruebas de database.rules.json contra el emulador. Uso: ./con_emulador.sh "node reglas.test.mjs"
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { ref, update, get, set, serverTimestamp } from "firebase/database";

const env = await initializeTestEnvironment({
  projectId: "demo-solicitudes",
  database: { host: "127.0.0.1", port: 9000, rules: readFileSync(new URL("../database.rules.json", import.meta.url), "utf8") }
});
await env.withSecurityRulesDisabled(async (c) => { await set(ref(c.database(), "admins/admin1"), true); });

const anon = env.unauthenticatedContext().database();
const admin = env.authenticatedContext("admin1").database();
const intruso = env.authenticatedContext("otro").database();

let ok = 0, mal = 0;
async function prueba(nombre, fn) {
  try { await fn(); ok++; console.log("  ✔", nombre); }
  catch (e) { mal++; console.log("  ✘", nombre, "→", e.message); }
}

const base = { nombre: "Macarena", titulo: "Cambiar color", detalle: "El botón", seccion: "tickets", prioridad: "media" };
const crear = (db, id, s = {}, t = {}) => update(ref(db), {
  [`solicitudes/${id}`]: { ...base, creada: serverTimestamp(), ...s },
  [`tablero/${id}`]: { nombre: base.nombre, titulo: base.titulo, seccion: base.seccion, prioridad: base.prioridad,
    estado: "recibida", respuesta: "", creada: serverTimestamp(), actualizada: serverTimestamp(), ...t }
});

console.log("Crear (sin login)");
await prueba("crea una solicitud válida", () => assertSucceeds(crear(anon, "s1")));
await prueba("no puede crear solo en solicitudes", () => assertFails(set(ref(anon, "solicitudes/s2"), { ...base, creada: serverTimestamp() })));
await prueba("no puede crear solo en tablero", () => assertFails(set(ref(anon, "tablero/s3"), { ...base, estado: "recibida", respuesta: "", creada: serverTimestamp(), actualizada: serverTimestamp() })));
await prueba("no puede crear ya terminada", () => assertFails(crear(anon, "s4", {}, { estado: "terminada" })));
await prueba("no puede crear con respuesta", () => assertFails(crear(anon, "s5", {}, { respuesta: "hecho" })));
await prueba("no puede poner otro título en el tablero", () => assertFails(crear(anon, "s6", {}, { titulo: "otro" })));
await prueba("prioridad inválida", () => assertFails(crear(anon, "s7", { prioridad: "urgente" }, { prioridad: "urgente" })));
await prueba("sección inválida", () => assertFails(crear(anon, "s8", { seccion: "x" }, { seccion: "x" })));
await prueba("título vacío", () => assertFails(crear(anon, "s9", { titulo: "" }, { titulo: "" })));
await prueba("título de 121 caracteres", () => assertFails(crear(anon, "s10", { titulo: "a".repeat(121) }, { titulo: "a".repeat(121) })));
await prueba("detalle de 3001 caracteres", () => assertFails(crear(anon, "s11", { detalle: "a".repeat(3001) })));
await prueba("campo extra", () => assertFails(crear(anon, "s12", { extra: 1 })));
await prueba("fecha falsa", () => assertFails(crear(anon, "s13", { creada: 1 }, { creada: 1 })));
await prueba("no puede marcar terminada al crear", () => assertFails(crear(anon, "s14", {}, { terminada: serverTimestamp() })));

console.log("Leer");
await prueba("cualquiera lee el tablero", () => assertSucceeds(get(ref(anon, "tablero"))));
await prueba("sin login no lee el detalle", () => assertFails(get(ref(anon, "solicitudes"))));
await prueba("otra cuenta no lee el detalle", () => assertFails(get(ref(intruso, "solicitudes"))));
await prueba("admin lee el detalle", () => assertSucceeds(get(ref(admin, "solicitudes"))));
await prueba("no se lee la lista de admins", () => assertFails(get(ref(anon, "admins"))));

console.log("Modificar");
await prueba("sin login no cambia el estado", () => assertFails(update(ref(anon, "tablero/s1"), { estado: "terminada" })));
await prueba("sin login no sobrescribe", () => assertFails(crear(anon, "s1", { titulo: "hackeado" }, { titulo: "hackeado" })));
await prueba("sin login no borra", () => assertFails(update(ref(anon), { "solicitudes/s1": null, "tablero/s1": null })));
await prueba("otra cuenta no cambia el estado", () => assertFails(update(ref(intruso, "tablero/s1"), { estado: "terminada", actualizada: serverTimestamp() })));
await prueba("nadie se hace admin", () => assertFails(set(ref(intruso, "admins/otro"), true)));
await prueba("admin pasa a En proceso", () => assertSucceeds(update(ref(admin, "tablero/s1"), { estado: "en_proceso", actualizada: serverTimestamp() })));
await prueba("admin termina", () => assertSucceeds(update(ref(admin, "tablero/s1"), { estado: "terminada", actualizada: serverTimestamp(), terminada: serverTimestamp() })));
await prueba("admin responde", () => assertSucceeds(update(ref(admin, "tablero/s1"), { respuesta: "Listo en la v40", actualizada: serverTimestamp() })));
await prueba("admin no usa un estado inválido", () => assertFails(update(ref(admin, "tablero/s1"), { estado: "pausada", actualizada: serverTimestamp() })));
await prueba("admin no cambia el título público", () => assertFails(update(ref(admin, "tablero/s1"), { titulo: "otro" })));
await prueba("admin elimina", () => assertSucceeds(update(ref(admin), { "solicitudes/s1": null, "tablero/s1": null })));

console.log(`\n${ok} correctas, ${mal} fallidas`);
await env.cleanup();
process.exit(mal ? 1 : 0);
