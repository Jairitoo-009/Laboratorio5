## Context

`server.js` valida cada mensaje con `validation.validateMessage(msg)` antes de re-emitarlo por el evento `Evento-Mensaje-Server`; `index.html` hace `append` del campo `mensaje` con jQuery `.html()`, es decir, inyecta el string como HTML. `libs/unalib.js` ya declara `is_valid_url_image`, `is_valid_yt_video`, `getImageTag` y `getEmbeddedCode`, pero los dos validadores llaman a `re.test(phone)` con una variable inexistente (`ReferenceError` capturado) y por lo tanto siempre devuelven `false`. Sus regex además no están ancladas y `getImageTag`/`getEmbeddedCode` concatenan la URL sin escapar. Ver `proposal.md` - Why.

## Goals / Non-Goals

**Goals:**
- Que la detección de imagen/video funcione de verdad y sea validada en `una-lib` (única fuente de verdad de la regla).
- Renderizado condicional en el frontend sin cambiar el protocolo del evento.
- Salida HTML segura: ningún mensaje del usuario puede ejecutar script.
- Cubrir los cuatro escenarios BDD con tests automatizados ejecutables con `npm test`.

**Non-Goals:**
- Vimeo y plataformas de video distintas de YouTube (los archivos de video directos .mp4/.webm/.ogg/.mov sí están en alcance, renderizados con `<video>`).
- Autenticación, persistencia o historial de mensajes.
- Reescribir el frontend a un framework moderno o migrar jQuery/Socket.IO.

## Decisions

1. **Clasificar en el servidor, no en el cliente.**
   El servidor ya llama a `validateMessage`; se mantiene ahí la decisión (`image` | `video` | `text`) y se emite el HTML ya seguro.
   - *Alternativa*: enviar el tipo en el payload y renderizar en el cliente. Se descarta porque duplicaría la regla de validación en dos lenguajes/ubicaciones y haría que un cliente malicioso pueda enviar `tipo: 'image'` con HTML arbitrario.
   - *Riesgo*: un solo punto de procesamiento; aceptable porque el chat ya es centralizado en `io.emit`.

2. **Validadores corregidos con regex ancladas (`^...$`) y saneo previo.**
   Se corrige `re.test(phone)` → `re.test(url)`, se ancla el patrón a la URL completa y se exige esquema `http(s)://`. Cualquier cosa que no matchee cae al caso `text`.
   - *Alternativa*: usar `new URL()` + whitelist de extensiones. Se descarta como paso único porque rompería los tests existentes de `is_valid_url_image` con valores como `http://image.com/image.jpg`; la regex anclada es compatible con esos tests ya escritos.

3. **Escapado obligatorio antes de decidir el render.**
   El mensaje se escapa (`& < > " '`) primero; la detección opera sobre la URL original, y solo los HTML generado por la librería (que no contiene datos de usuario sin escapar) se emite crudo. Si el mensaje contiene marcado HTML/script, se clasifica como `text` y se muestra escapado.
   - *Alternativa*: DOMPurify u otra librería de sanitización. Se descarta: agrega dependencia nueva a un laboratorio con `package.json` mínimo, y el requisito es "mostrar literalmente", no "sanitizar parcialmente".

4. **Frontend con detección por prefijo de contenido, sin `innerHTML` arbitrario.**
   El receptor distingue: si el mensaje empieza por `<img`/`<iframe`/`<video` (únicos tags que la librería emite) usa `.html()`, en cualquier otro caso usa `.text()`, que escapa por definición.
   - *Alternativa*: marca `tipo` explícita en el JSON. Se descarta por el punto 1 (confiar en el cliente) y porque exige cambiar el contrato del evento.

5. **Video embebido: iframe de YouTube o `<video>` para archivos directos.**
   Se reutiliza `getEmbeddedCode` para YouTube, validando primero con `is_valid_yt_video` para evitar un `TypeError` en `getYTVideoId` con URLs que no son de YouTube. Las URLs de archivo (.mp4/.webm/.ogg/.mov) usan `<video controls>` con la URL escapada.

6. **Saneado explícito de tags y atributos peligrosos en `validateMessage`.**
   Antes de clasificar, se remueven del mensaje del usuario `<script>`, `<iframe>`, `<object>`, `<embed>` (expresiones regulares globales, incluyendo variantes con atributos) y los atributos `on*` (`onerror`, `onload`, `onclick`, …). Cualquier URL que no sea imagen/video http(s) válida cae a `text` con el resto escapado. Así el único HTML que sale de la librería es el que ella misma construye.
   - *Alternativa*: DOMPurify u otra librería de sanitización. Se descarta: agrega dependencia nueva a un laboratorio con `package.json` mínimo, y el requisito es "mostrar literalmente", no "sanitizar parcialmente".
   - *Nota*: `<iframe>` de YouTube es generado por la librería tras validar la URL, no entrada del usuario — el saneado aplica al mensaje de entrada.

## Risks / Trade-offs

- [Regex de imagen sin el host bien definido acepta `http://a.b/c.jpg`] → se ancla a esquema + estructura de URL y se prueba con contrajemplos (`nota.txt`, `javascript:...`).
- [`getYTVideoId` lanza excepción si la URL no coincide] → se llama solo cuando `is_valid_yt_video` ya devolvió `true`; además envolver en try/catch.
- [Escapar todo rompe mensajes con `<3` o `&`] → escapado de solo los 5 caracteres críticos; se agrega test de texto con caracteres especiales.
- [Un cliente manipulado emite HTML directamente por el evento] → el receptor solo acepta como HTML los tags que produce la librería (prefijo `<img`/`<iframe`), todo lo demás se inserta como texto.
- [Los tests actuales de `is_valid_url_image` podrían fallar con el nuevo anclaje] → se ejecuta `npm test` antes y después; los casos listados en `test/test.js` deben seguir pasando.

## Migration Plan

Sin despliegue ni datos persistentes: el cambio es en la misma app. Pasos:
1. Corregir `una-lib` + tests (backward compatible: la interfaz pública no cambia).
2. Ajustar `server.js` solo si se necesita pasar el payload ya clasificado.
3. Actualizar el render del frontend.
4. Verificar manualmente con `npm start` en dos pestañas.
Rollback: revertir el commit; no hay cambios de esquema ni de protocolo.

## Open Questions

- Si más adelante se desea soporte de video fuera de YouTube (archivos `.mp4`), ¿se extiende la misma capacidad o se crea una nueva (`chat-video-html5`)? No afecta esta propuesta; se responde en su momento.
