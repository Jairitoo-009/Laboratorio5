## Why

El chat de UNA Chat solo muestra texto plano: cuando un usuario pega una URL de imagen o video, el mensaje se imprime como enlace/cadena cruda y el resto de los participantes no pueden ver el contenido sin salir de la aplicación. Además, la validación actual de la librería `una-lib` tiene defectos (referencia a una variable inexistente, regex sin anclas) que impiden que la detección funcione y que dejan la puerta abierta a inyección de HTML/scripts.

## What Changes

- Corregir y robustecer en `libs/unalib.js` la detección de URLs de imagen y video (`is_valid_url_image`, `is_valid_yt_video`), eliminando la referencia a la variable inexistente y anclando las expresiones regulares a URLs completas y seguras: solo `http`/`https`, extensiones de imagen (.jpg, .jpeg, .png, .gif, .bmp, .webp, .svg) y de video (.mp4, .webm, .ogg, .mov), además de YouTube.
- Agregar en `una-lib` una función de clasificación de mensajes que indique el tipo de contenido (`image` | `video` | `text`) y devuelva el HTML seguro correspondiente.
- Endurecer la validación (`validateMessage`): eliminar o sanear `<script>`, `<iframe>`, `<object>`, `<embed>` y los atributos de eventos `on*` (onerror, onload, onclick, …), y rechazar URL con esquemas peligrosos (`javascript:`, `data:`), de modo que ningún mensaje entregue marcado ejecutable.
- Integrar en el frontend (`index.html`) el renderizado condicional: imágenes embebidas (`<img>`) y reproductores de video (`<iframe>` para YouTube, `<video>` para archivos directos) dentro de la lista de mensajes.
- **Nuevo endpoint HTTP `POST /api/messages`** que recibe mensajes por HTTP, aplica la validación de `una-lib`, responde `200` con el mensaje seguro (y lo re-emite a los sockets conectados) o `400` cuando la entrada es una URL no permitida.
- Refactor de `server.js` para exportar `app`/`http`/`io` y solo abrir el puerto al ejecutarse directamente, permitiendo pruebas de integración con Jest + Supertest.
- Mantener el contrato existente del evento `Evento-Mensaje-Server` (payload JSON `{nombre, mensaje, color}`) para no romper compatibilidad con el servidor y clientes actuales.
- Agregar escenarios BDD (GIVEN/WHEN/THEN) y tests Mocha que cubran: imagen válida, video válido, URL inválida y script malicioso.
- Agregar pruebas de integración `tests/integration/chat.test.js` (Jest + Supertest) que envíen peticiones HTTP reales al endpoint y espíen `validateMessage` para confirmar que el backend la invoca.

## Capabilities

### New Capabilities
- `chat-media-preview`: Detección, validación y renderizado de URLs de imagen y video dentro de los mensajes del chat, incluyendo el rechazo seguro de URLs inválidas y payloads con scripts maliciosos.

### Modified Capabilities
<!-- Ninguna: no existen specs previos en openspec/specs/ -->

## Impact

- **Código afectado**:
  - `libs/unalib.js` — corrección de validadores, nueva lógica de clasificación/sanitización, funciones generadoras de tags (`getImageTag`, `getEmbeddedCode`, `getVideoTag`).
  - `server.js` — nuevo endpoint `POST /api/messages` con `express.json()`, refactor para exportar `app`/`http`/`io`/`validation` y condicionar el `listen` a `require.main === module`.
  - `index.html` — receptor de `Evento-Mensaje-Server`, renderizado condicional de imagen/video/texto.
  - `test/test.js` — nuevos tests Mocha para los escenarios BDD.
  - `tests/integration/chat.test.js` — nuevas pruebas de integración HTTP (Jest + Supertest).
- **No afectado**: el flujo por Socket.IO (`Evento-Mensaje-Server`) mantiene su contrato; el frontend no requiere cambios para el endpoint.
- **Dependencias**: sin dependencias de producción nuevas; `jest` y `supertest` agregados como devDependencies. Scripts: `test` (Mocha) y `test:integration` (Jest).
- **Seguridad**: cambio sensible — el manejo de HTML del usuario pasa a ser escapado/whitelisted, lo que reduce el riesgo de XSS en todos los mensajes; el endpoint responde `400` ante URLs no permitidas.
