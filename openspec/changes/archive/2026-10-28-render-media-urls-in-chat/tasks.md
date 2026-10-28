## 1. Validación y saneado en una-lib

- [x] 1.1 Corregir `is_valid_url_image` en `libs/unalib.js`: usar el parámetro `url` (hoy referencia a `phone`) y anclar la regex a una URL completa con esquema `http(s)://` y extensión de imagen al final (.jpg, .jpeg, .png, .gif, .bmp, .webp, .svg)
- [x] 1.2 Corregir `is_valid_yt_video` con el mismo criterio (parámetro `url` y regex anclada a la URL completa de YouTube)
- [x] 1.3 Crear `is_valid_url_video_file` para archivos de video directos (.mp4, .webm, .ogg, .mov) con regex estricta: solo `http`/`https`, URL completa anclada
- [x] 1.4 Crear la función de saneado que elimine `<script>`, `<iframe>`, `<object>`, `<embed>` y los atributos de evento `on*` (onerror, onload, onclick, etc.) del mensaje del usuario
- [x] 1.5 Agregar la función de clasificación de mensajes que devuelva `image` | `video` | `text` y el HTML seguro correspondiente (img / iframe de YouTube / video / texto escapado), descartando esquemas peligrosos (`javascript:`, `data:`)
- [x] 1.6 Ajustar `validateMessage` para que saneie primero el mensaje, use la clasificación y solo acepte como HTML los tags generados por la propia librería (`<img`, `<iframe`, `<video`), escapando todo lo demás

## 2. Render en el frontend

- [x] 2.1 Modificar el listener de `Evento-Mensaje-Server` en `index.html` para insertar con `.html()` solo los mensajes que empiezan por `<img`/`<iframe`/`<video`, y con `.text()` (escapado) para el resto
- [x] 2.2 Verificar que el nombre de usuario y el color siguen igual y que el payload JSON `{nombre, mensaje, color}` no cambia
- [x] 2.3 Agregar estilos mínimos en `index.html` para que imagen y reproductor no rompan la lista de mensajes (alto/ancho/márgenes)

## 3. Escenarios BDD (tests Mocha)

- [x] 3.1 Test GIVEN imagen válida / WHEN se clasifica / THEN es aceptada y marcada como `image` (y `validateMessage` devuelve el tag `<img>`)
- [x] 3.2 Test GIVEN video válido (YouTube y archivo .mp4) / WHEN se clasifica / THEN es aceptado y marcado como `video` (YouTube devuelve `<iframe>`)
- [x] 3.3 Test GIVEN URL inválida sin extensión válida o de esquema no soportado / WHEN se clasifica / THEN es rechazada y clasificada como `text`
- [x] 3.4 Test GIVEN `<script>alert(1)</script>` / WHEN se procesa / THEN la salida NO contiene `<script>`
- [x] 3.5 Test GIVEN un atributo `onerror` en el mensaje / WHEN se procesa / THEN `onerror` es eliminado de la salida
- [x] 3.6 Test GIVEN una URL maliciosa `javascript:alert(1)` / WHEN se clasifica / THEN es rechazada sin generar etiqueta de media
- [x] 3.7 Test GIVEN mensaje con caracteres especiales (`<3`, `&`) / WHEN se procesa / THEN el texto se conserva legible
- [x] 3.8 Ejecutar `npm test` y corregir fallos hasta que toda la suite pase (tests preexistentes incluidos) — **30/30 pruebas pasando**

## 4. Verificación manual

- [x] 4.1 Arrancar el servidor y probar los escenarios (imagen, video YouTube, video .mp4, URL inválida, script, onerror, javascript:) confirmando que no se ejecuta ningún script — verificado end-to-end por el protocolo de Socket.IO en el puerto 3000; 8/8 escenarios correctos

## 5. Endpoint HTTP y pruebas de integración (Jest + Supertest)

- [x] 5.1 Instalar `jest` y `supertest` como devDependencies y configurar Jest (`testEnvironment: node`, `testMatch` limitado a `tests/`) para no interferir con la suite Mocha
- [x] 5.2 Refactorizar `server.js`: exportar `app`/`http`/`io`/`validation` y ejecutar `http.listen` solo con `require.main === module`
- [x] 5.3 Crear la ruta `POST /api/messages` con `express.json()` que llama a `validateMessage`, responde `200` con el mensaje seguro y re-emite a los sockets
- [x] 5.4 Devolver `400` cuando la entrada es una URL no permitida (extensión desconocida, sin extensión o esquema `javascript:`/`data:`) o el campo `mensaje` falta/vacío
- [x] 5.5 Crear `tests/integration/chat.test.js` con peticiones HTTP reales: imagen válida, video válido, script malicioso saneado, URL no permitida (400), `javascript:` (400) y texto normal
- [x] 5.6 Espiar `validation.validateMessage` con `jest.spyOn` para confirmar que el backend invoca la validación de `una-lib` en cada petición
- [x] 5.7 Cerrar Socket.IO y el servidor de Express en `afterAll`
- [x] 5.8 Ejecutar `npx jest tests/integration --runInBand --env=node` hasta que pase (12/12) y re-ejecutar `npm test` de Mocha (30/30)

## 6. Pruebas E2E con Playwright

- [x] 6.1 Inicializar Playwright en la raíz del proyecto en JavaScript (`@playwright/test` + `@types/node` como devDependencies)
- [x] 6.2 Configurar `playwright.config.js`: `testDir: './tests/e2e'` y `use.baseURL: 'http://localhost:3000'`
- [x] 6.3 Habilitar `webServer` (`npm run start` con `reuseExistingServer`) para que las pruebas E2E tengan el chat disponible
- [x] 6.4 Instalar los navegadores con `npx playwright install chromium firefox webkit` (chromium, firefox, webkit, ffmpeg y headless shell descargados)
- [x] 6.5 Crear `tests/e2e/chat.spec.js` con los flujos completos: imagen válida (`<img>` visible + `naturalWidth > 0`), video válido (`<video>` + `readyState >= 2` y `videoWidth > 0`) y script malicioso (`page.on('dialog')` antes del envío, sin alert, sin `<script>` en el DOM y mensaje saneado)
- [x] 6.6 Verificar la config con `npx playwright test --list` (los tests resueltos por navegador: chromium/firefox/webkit)
- [x] 6.7 Ejecutar `npx playwright test --project=chromium --headed` y corregir fallos — 5/5 pruebas pasando (la URL de miniatura de Wikimedia devolvía 400; se sustituyó por la imagen original de Wikimedia Commons)

## 7. Mejora de UX de los medios en el chat

- [x] 7.1 Diagnóstico previo al código: identificar los 8 problemas (sin `<meta name="viewport">`, media sin `object-fit`, sin tope de alto, burbuja al 100%, sin estado de carga, URLs largas desbordando, sin responsive, `style` inline de 400px de la librería ganando al CSS)
- [x] 7.2 Agregar `<meta name="viewport" content="width=device-width, initial-scale=1">` y reglas base: `max-width:100%`, `height:auto`, `object-fit:contain`, `border-radius:8px`, `max-height:320px`
- [x] 7.3 Limitar el media al 70-80 % del contenedor (`.con-media` al 80 %, `.media-wrap` con `max-width:100%`) y dar `controls` al `<video>`
- [x] 7.4 Agregar estado de carga `.media-wrap.cargando` con `background:#f0f0f0` que se retira en `load`
- [x] 7.5 `overflow-wrap:anywhere` para URLs largas y bloque `@media (max-width:640px)` con burbujas al 90 %, media a `max-height:240px` y entradas apiladas
- [x] 7.6 Quitar el `style="max-height:400px"` inline de `getImageTag`/`getVideoTag` en `libs/unalib.js` (el CSS del frontend queda como única fuente de layout)
- [x] 7.7 Verificar con las 3 suites tras los cambios CSS/JS — 30/30, 12/12 y 5/5 sin modificar aserciones

## 8. Auditoría de seguridad con Snyk

- [x] 8.1 Instalar `snyk` globalmente y autenticar (`snyk auth`, org `jairitoo-009`)
- [x] 8.2 Línea base `snyk test --json-file-output` → **52 issues (1 CRITICAL, 30 HIGH, 17 MEDIUM, 4 LOW)**
- [x] 8.3 Aplicar fixes compatibles: `express ^4.22.3`, `socket.io ^4.8.4`, `mocha ^12.0.3`, `overrides: { "ws": "^8.21.0" }` y `npm update proxy-addr socket.io-parser picomatch`
- [x] 8.4 Re-ejecutar `snyk test` → **0 issues (exit 0)**; `npm audit` → 0 critical / 0 high / 19 moderate (cadena dev de Jest, justificada)
- [x] 8.5 Re-validar las 3 suites con las dependencias nuevas (Mocha 12 incluido): **30/30, 12/12, 5/5**
- [x] 8.6 Crear `docs/snyk-report.md` con fecha, comandos, antes/después, fixes aplicados y justificación de lo no resuelto
