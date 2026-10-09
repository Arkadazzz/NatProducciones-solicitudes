// Avisos por correo de solicitudes nuevas (Google Apps Script, en script.google.com).
// Lee solo la lista pública (tablero) y te manda un correo por cada solicitud nueva.
// No necesita claves: lo que lee es lo mismo que ve cualquiera con el link.
//
// Puesta en marcha: pegar este código, guardar, elegir la función "activarAvisos" y apretar Ejecutar (una sola vez).

const TABLERO = "https://nat-solicitudes-default-rtdb.firebaseio.com/tablero.json";
const PANEL = "https://arkadazzz.github.io/NatProducciones-solicitudes/admin.html";

// Prioridades que generan correo. Para no recibir las bajas: ["alta", "media"]
const AVISAR = ["alta", "media", "baja"];

const PRIORIDADES = { alta: "🔴 ALTA", media: "🟠 Media", baja: "🟢 Baja" };
const SECCIONES = {
  formulario: "Formulario de registro", tickets: "Tickets", previred: "Previred / LRE",
  contratos: "Contratos", pagos: "Pagos y efectivo", finanzas: "Finanzas", seguridad: "Seguridad",
  base_datos: "Base de datos y edición", nat_pagos: "NAT Pagos", otro: "Otro"
};

function revisarSolicitudes() {
  const props = PropertiesService.getScriptProperties();
  const respuesta = UrlFetchApp.fetch(TABLERO, { muteHttpExceptions: true });
  if (respuesta.getResponseCode() !== 200) return; // sin conexión: se reintenta en 5 minutos
  const tablero = JSON.parse(respuesta.getContentText()) || {};
  const ids = Object.keys(tablero);

  // Primera vez: marca como vistas las que ya existen, para no mandar correos viejos
  if (!props.getProperty("iniciado")) {
    props.setProperties({ iniciado: "1", vistos: JSON.stringify(ids) });
    return;
  }

  const vistos = new Set(JSON.parse(props.getProperty("vistos") || "[]"));
  const orden = { alta: 0, media: 1, baja: 2 };
  const nuevas = ids
    .filter((id) => !vistos.has(id))
    .map((id) => tablero[id])
    .sort((a, b) => (orden[a.prioridad] ?? 3) - (orden[b.prioridad] ?? 3))
    .slice(0, 20); // tope por si alguien llena de spam

  const destino = Session.getEffectiveUser().getEmail();
  for (const s of nuevas) {
    if (!AVISAR.includes(s.prioridad)) continue;
    const prioridad = PRIORIDADES[s.prioridad] || s.prioridad;
    MailApp.sendEmail({
      to: destino,
      subject: `${prioridad} · Nueva solicitud: ${limpiar(s.titulo, 90)}`,
      body:
        `Pedida por: ${limpiar(s.nombre, 60)}\n` +
        `Sección: ${SECCIONES[s.seccion] || limpiar(s.seccion, 30)}\n` +
        `Prioridad: ${prioridad}\n\n` +
        `${limpiar(s.titulo, 120)}\n\n` +
        `Ver el detalle y cambiar el estado:\n${PANEL}`,
      name: "Solicitudes NAT"
    });
  }

  // Solo se recuerdan las que todavía existen (las eliminadas se olvidan)
  props.setProperty("vistos", JSON.stringify(ids));
}

// Texto plano de una línea y con largo máximo (lo escriben personas en la página pública)
function limpiar(texto, max) {
  return String(texto || "").replace(/[\r\n\t]+/g, " ").slice(0, max);
}

// Ejecutar UNA vez: deja revisando cada 5 minutos
function activarAvisos() {
  desactivarAvisos();
  ScriptApp.newTrigger("revisarSolicitudes").timeBased().everyMinutes(5).create();
  revisarSolicitudes();
}

// Por si algún día quieres apagar los avisos
function desactivarAvisos() {
  for (const t of ScriptApp.getProjectTriggers()) ScriptApp.deleteTrigger(t);
}

// Opcional: manda un correo de prueba para ver cómo se ve
function correoDePrueba() {
  MailApp.sendEmail({
    to: Session.getEffectiveUser().getEmail(),
    subject: "🔴 ALTA · Nueva solicitud: (prueba) así se verán los avisos",
    body: "Pedida por: Prueba\nSección: Tickets\nPrioridad: 🔴 ALTA\n\n(prueba) así se verán los avisos\n\nVer el detalle y cambiar el estado:\n" + PANEL,
    name: "Solicitudes NAT"
  });
}
