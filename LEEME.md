# Solicitudes NAT

Página para que el equipo de la productora pida cambios en la plataforma.

- `index.html`: página pública (el link que se comparte). Nombre, qué necesitan, sección, prioridad. Debajo, la lista con el estado de cada solicitud, que se actualiza sola.
- `admin.html`: panel del administrador (correo y contraseña). Ve el detalle, cambia el estado (Recibida → En proceso → Terminada / Descartada), responde y elimina spam.
- `database.rules.json`: reglas de seguridad (Realtime Database). Sin login solo se puede **crear**; el detalle y los cambios de estado son solo del admin.

Es un proyecto Firebase **separado** del de NAT.

## Puesta en marcha (una vez)

1. **Crear el proyecto**: [console.firebase.google.com](https://console.firebase.google.com) → Agregar proyecto → `nat-solicitudes` (sin Analytics). Plan Spark (gratis).
2. **Realtime Database**: Compilación → Realtime Database → Crear base de datos → ubicación `us-central1` → modo bloqueado.
   Luego pestaña **Reglas** → pegar el contenido de `database.rules.json` → Publicar.
3. **Login**: Compilación → Authentication → Comenzar → Correo electrónico/contraseña → Habilitar.
   Pestaña Usuarios → Agregar usuario → tu correo y una contraseña. Copiar el **UID** que aparece.
4. **Marcarte como admin**: Realtime Database → Datos → agregar hijo en la raíz:
   `admins` → hijo `<tu UID>` con valor `true` (booleano, no texto).
5. **Configuración web**: Configuración del proyecto (⚙️) → Tus apps → Web (`</>`) → registrar app (sin Hosting) → copiar los valores a `config.js`.
6. **Dominio autorizado**: Authentication → Configuración → Dominios autorizados → agregar `arkadazzz.github.io`.
7. **GitHub**: crear el repo `NatProducciones-solicitudes`, subir esta carpeta, y en Settings → Pages → Deploy from branch → `main` / root.
   Link para compartir: `https://arkadazzz.github.io/NatProducciones-solicitudes/`
   Tu panel: `https://arkadazzz.github.io/NatProducciones-solicitudes/admin.html`

## Pruebas (emulador local, nada de producción)

```bash
pruebas/con_emulador.sh "node pruebas/reglas.test.mjs"   # 30 pruebas de reglas
pruebas/con_emulador.sh "node pruebas/e2e.mjs"           # flujo completo en navegador (celular y escritorio)
```

Para probar a mano: dentro de `con_emulador.sh "python3 -m http.server 8090"` y abrir `http://127.0.0.1:8090/index.html?emulador`.

## A tener en cuenta

- Como no hay login para pedir, cualquiera con el link puede enviar solicitudes. Las reglas limitan tamaño y formato; si aparece spam, se elimina desde el panel.
- La lista pública muestra título, sección, nombre, prioridad, estado y tu respuesta. El **detalle** solo lo ves tú. No escribir datos personales en el título.
