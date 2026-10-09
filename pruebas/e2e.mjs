// Prueba de punta a punta en navegador. Uso: ./con_emulador.sh "node pruebas/e2e.mjs"
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { chromium, devices } from "playwright";

const RAIZ = new URL("..", import.meta.url).pathname;
const CAPTURAS = process.env.CAPTURAS || "/tmp/capturas-solicitudes";
mkdirSync(CAPTURAS, { recursive: true });
const servidor = spawn("python3", ["-m", "http.server", "8090", "--bind", "127.0.0.1", "-d", RAIZ], { stdio: "ignore" });
await new Promise((r) => setTimeout(r, 800));

let ok = 0, mal = 0;
const check = (nombre, cond) => { cond ? ok++ : mal++; console.log(cond ? "  ✔" : "  ✘", nombre); };

// Cuenta admin en el emulador
const r = await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "admin@prueba.cl", password: "clave123", returnSecureToken: true })
});
const { localId } = await r.json();
await fetch(`http://127.0.0.1:9000/admins/${localId}.json?ns=demo-solicitudes`, { method: "PUT", headers: { Authorization: "Bearer owner" }, body: "true" });
// Una cuenta que NO es admin
await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "otra@prueba.cl", password: "clave123" })
});

const navegador = await chromium.launch();
const errores = [];
const nueva = async (opts = {}) => {
  const p = await (await navegador.newContext(opts)).newPage();
  p.on("pageerror", (e) => errores.push(e.message));
  p.on("dialog", (d) => { errores.push("dialog: " + d.message()); d.accept(); });
  return p;
};
const URL_PUB = "http://127.0.0.1:8090/index.html?emulador";
const URL_ADM = "http://127.0.0.1:8090/admin.html?emulador";

try {
  console.log("Página pública (celular)");
  const jefa = await nueva({ ...devices["iPhone 13"] });
  await jefa.goto(URL_PUB);
  await jefa.waitForSelector("text=No hay solicitudes pendientes");
  check("lista vacía al inicio", true);

  await jefa.click("#enviar");
  check("pide el nombre si falta", await jefa.isVisible("text=Escribe tu nombre."));

  await jefa.fill("#nombre", "Ana");
  await jefa.fill("#titulo", "No carga el PDF de cortesías");
  await jefa.fill("#detalle", "Al apretar Descargar no pasa nada.");
  await jefa.selectOption("#seccion", "tickets");
  await jefa.click("label[for=p-alta]");
  check("aviso de llamar/WhatsApp con prioridad alta", await jefa.isVisible("#aviso-alta"));
  await jefa.screenshot({ path: `${CAPTURAS}/1_formulario_celular.png`, fullPage: true });
  await jefa.click("#enviar");
  await jefa.waitForSelector("text=recuerda llamarme o escribirme por WhatsApp");
  check("confirmación de envío con recordatorio", true);
  await jefa.waitForSelector(".item >> text=No carga el PDF de cortesías");
  check("aparece en la lista como Recibida", await jefa.isVisible(".item .estado-recibida"));
  check("recuerda el nombre", (await jefa.inputValue("#nombre")) === "Ana");

  // Otra persona, prioridad baja, con texto malicioso
  await jefa.fill("#nombre", "Pedro");
  await jefa.fill("#titulo", '<img src=x onerror="alert(1)"> cambiar color del botón');
  await jefa.selectOption("#seccion", "otro");
  await jefa.click("label[for=p-baja]");
  await jefa.click("#enviar");
  await jefa.waitForSelector("text=Solicitud enviada. Puedes ver");
  await jefa.waitForSelector('.item h3 >> text=<img src=x onerror="alert(1)"> cambiar color del botón');
  check("el HTML se muestra como texto (sin inyección)", (await jefa.locator(".item img").count()) === 0);
  check("la alta va antes que la baja", (await jefa.locator(".item h3").first().textContent()).includes("PDF"));

  console.log("Panel admin");
  const yo = await nueva();
  await yo.goto(URL_ADM);
  await yo.fill("#correo", "otra@prueba.cl");
  await yo.fill("#clave", "clave123");
  await yo.click("#entrar");
  await yo.waitForSelector("text=Esta cuenta no es administradora.");
  check("una cuenta que no es admin no entra", !(await yo.isVisible("#panel")));
  await yo.fill("#correo", "admin@prueba.cl");
  await yo.fill("#clave", "mala");
  await yo.click("#entrar");
  await yo.waitForSelector("text=Correo o contraseña incorrectos.");
  check("clave incorrecta rechazada", true);
  await yo.fill("#clave", "clave123");
  await yo.click("#entrar");
  await yo.waitForSelector("#panel:not(.oculto) .item");
  check("admin ve el detalle", await yo.isVisible("text=Al apretar Descargar no pasa nada."));
  check("contador de altas pendientes", await yo.isVisible("text=Alta pendientes: 1"));

  const itemPdf = yo.locator(".item", { hasText: "No carga el PDF" });
  await itemPdf.locator("button", { hasText: "Empezar" }).click();
  await jefa.waitForSelector(".item.estado-en_proceso >> text=No carga el PDF de cortesías");
  check("la jefa ve 'En proceso' al instante", await jefa.isVisible(".chip.estado-en_proceso"));
  await jefa.screenshot({ path: `${CAPTURAS}/2_en_proceso_celular.png`, fullPage: true });

  // Borrador no se pierde si llega otra solicitud mientras escribo
  await itemPdf.locator("textarea").fill("Ya lo encontré, era el navegador. Listo en la v40.");
  await jefa.fill("#titulo", "Agregar columna de RUT");
  await jefa.selectOption("#seccion", "previred");
  await jefa.click("label[for=p-media]");
  await jefa.click("#enviar");
  await yo.waitForSelector(".item >> text=Agregar columna de RUT");
  check("el borrador de respuesta no se pierde", (await itemPdf.locator("textarea").inputValue()).startsWith("Ya lo encontré"));
  await itemPdf.locator("button", { hasText: "Guardar respuesta" }).click();
  await itemPdf.locator("button", { hasText: "Terminar" }).click();
  await yo.screenshot({ path: `${CAPTURAS}/3_admin.png`, fullPage: true });

  await jefa.waitForSelector(".item >> text=No carga el PDF", { state: "detached" });
  check("terminada sale de Pendientes", true);
  await jefa.click("button[data-filtro=terminada]");
  await jefa.waitForSelector(".item.estado-terminada >> text=Listo en la v40");
  check("en Terminadas con fecha y respuesta", await jefa.isVisible(".item.estado-terminada >> text=terminada"));
  await jefa.screenshot({ path: `${CAPTURAS}/4_terminadas_celular.png`, fullPage: true });

  await jefa.click("button[data-filtro=todas]");
  await jefa.check("#solo-mias");
  check("'Solo las mías' filtra por nombre (Pedro)", (await jefa.locator(".item").count()) === 2);

  // Eliminar spam
  await yo.click("button[data-filtro=todas]");
  await yo.locator(".item", { hasText: "onerror" }).locator("button", { hasText: "Eliminar" }).click();
  await jefa.waitForSelector("text=onerror", { state: "detached" });
  check("admin elimina y desaparece para todos", true);

  const escritorio = await nueva({ viewport: { width: 1280, height: 900 } });
  await escritorio.goto(URL_PUB);
  await escritorio.waitForSelector(".item");
  await escritorio.screenshot({ path: `${CAPTURAS}/5_escritorio.png`, fullPage: true });
  const anchoOk = await jefa.evaluate(() => window.innerWidth === 390 && document.documentElement.scrollWidth <= 390);
  check("sin desplazamiento horizontal en celular", anchoOk);
} catch (e) {
  mal++; console.log("  ✘ error:", e.message.split("\n")[0]);
} finally {
  check("sin errores de JavaScript ni alertas", errores.filter((e) => !e.includes("dialog: ¿Eliminar")).length === 0);
  if (errores.length) console.log("   ", errores);
  await navegador.close();
  servidor.kill();
}
console.log(`\n${ok} correctas, ${mal} fallidas · capturas en ${CAPTURAS}`);
process.exit(mal ? 1 : 0);
