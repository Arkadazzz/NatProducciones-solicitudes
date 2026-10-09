#!/bin/bash
# Uso: ./con_emulador.sh "node reglas.test.mjs"   (emulador local, proyecto demo; nada de producción)
H=/Users/agu/NatProducciones-privado/herramientas
export PATH=$H/entorno-pruebas/node/bin:$H/entorno-pruebas/jre/Contents/Home/bin:$PATH JAVA_HOME=$H/entorno-pruebas/jre/Contents/Home PLAYWRIGHT_BROWSERS_PATH=$H/entorno-pruebas/browsers
cd "$(dirname "$0")/.."
$H/firebase emulators:exec --only database,auth --project demo-solicitudes "$1" 2>&1 | grep -vE "^i |^⚠|^✔|Running script|FIREBASE WARNING"
