# chat-media-preview Specification

## Purpose
Permite que el chat de UNA Chat muestre el contenido de URLs de imagen y video directamente en la conversación, en lugar de texto plano, manteniendo la validación centralizada en la librería `una-lib` y garantizando que cualquier mensaje no seguro (scripts, atributos de eventos, esquemas peligrosos) se saneie o se muestre sin interpretarse como HTML.
## Requirements
### Requirement: Detección de URL de imagen válida
El sistema SHALL detectar cuando el mensaje contiene una URL válida de imagen (extensiones .jpg, .jpeg, .png, .gif, .bmp, .webp, .svg, bajo esquema http/https) y renderizar la imagen incrustada en el chat, con dimensiones acotadas para no romper el layout de la lista de mensajes. La validación MUST realizarse en la librería `una-lib` antes de que el servidor re-emita el mensaje. El patrón MUST estar anclado a la URL completa: texto adicional o esquemas distintos de http/https invalidan la URL.

#### Scenario: Imagen válida se muestra como imagen
- **GIVEN** un usuario escribe en el chat la URL `https://ejemplo.com/foto.jpg`
- **WHEN** el mensaje es procesado por el servidor y entregado a los clientes
- **THEN** el mensaje se muestra con la imagen de `foto.jpg` incrustada junto al nombre del usuario, en lugar de la URL como texto

#### Scenario: Imagen aceptada y marcada como imagen
- **GIVEN** la librería recibe la URL `https://ejemplo.com/foto.png`
- **WHEN** se clasifica el contenido
- **THEN** la URL es aceptada y el contenido se marca/classifica como `image`

### Requirement: Detección de URL de video válida
El sistema SHALL detectar cuando el mensaje contiene una URL válida de video —ya sea un video de YouTube o un archivo de video con extensión .mp4, .webm, .ogg o .mov bajo esquema http/https— y renderizar un reproductor de video embebido en el chat (`<iframe>` para YouTube, `<video>` para archivos directos). El reproductor MUST provenir de la URL validada y no de entradas libres del usuario.

#### Scenario: Video válido se muestra como reproductor
- **GIVEN** un usuario escribe en el chat la URL `https://www.youtube.com/watch?v=qYwlqx-JLok`
- **WHEN** el mensaje es procesado por el servidor y entregado a los clientes
- **THEN** el mensaje se muestra con un reproductor de video embebido reproduciendo ese video, en lugar de la URL como texto

#### Scenario: Archivo de video válido se muestra como reproductor
- **GIVEN** un usuario escribe en el chat la URL `https://ejemplo.com/videos/clase.mp4`
- **WHEN** el mensaje es procesado por el servidor y entregado a los clientes
- **THEN** el mensaje se muestra con un reproductor `<video>` reproduciendo ese archivo, en lugar de la URL como texto

#### Scenario: Video aceptado y marcado como video
- **GIVEN** la librería recibe la URL `https://ejemplo.com/videos/clase.webm`
- **WHEN** se clasifica el contenido
- **THEN** la URL es aceptada y el contenido se clasifica como `video`

### Requirement: Rechazo de URL inválida
El sistema SHALL tratar como texto plano cualquier mensaje cuya URL no cumpla los criterios de validación de imagen o video: esquema no soportado (incluido `javascript:`), extensión desconocida o ausente, cadena incompleta o no-URL. El texto original MUST preservarse sin escapado adicional que altere su lectura.

#### Scenario: URL inválida se muestra como texto
- **GIVEN** un usuario escribe en el chat la cadena `https://ejemplo.com/archivo.xyz`
- **WHEN** el mensaje es procesado por el servidor y entregado a los clientes
- **THEN** el mensaje se muestra exactamente como texto plano, sin imagen ni reproductor

#### Scenario: URL sin extensión válida es rechazada
- **GIVEN** la librería recibe la URL `https://ejemplo.com/archivo`
- **WHEN** se clasifica el contenido
- **THEN** la URL es rechazada y el contenido se clasifica como `text`, sin generar etiqueta de media

#### Scenario: URL maliciosa con esquema javascript es rechazada
- **GIVEN** la librería recibe la cadena `javascript:alert(1)`
- **WHEN** se clasifica el contenido
- **THEN** la URL es rechazada, no se genera ninguna etiqueta de media y el contenido se entrega como texto saneado

### Requirement: Saneado de etiquetas y atributos peligrosos
El sistema SHALL eliminar o neutralizar del mensaje cualquier `<script>`, `<iframe>`, `<object>`, `<embed>` y cualquier atributo de evento `on*` (onerror, onload, onclick, etc.) antes de entregarlo al cliente. El mensaje entregado MUST ser seguro para insertarse como HTML: no debe contener etiquetas ejecutables ni handlers de eventos. Solo las etiquetas de media generadas por la propia librería a partir de URLs validadas pueden entregarse como marcado.

#### Scenario: Script malicioso se bloquea o sanea
- **GIVEN** un usuario escribe en el chat `<script>alert('xss')</script>`
- **WHEN** el mensaje es procesado por el servidor y entregado a los clientes
- **THEN** la salida NO contiene la cadena `<script>` y no se ejecuta ningún script ni se dispara ninguna alerta

#### Scenario: Atributo de evento onerror es eliminado
- **GIVEN** un usuario escribe en el chat `<img src="x" onerror="alert(1)">hola`
- **WHEN** el mensaje es procesado por el servidor y entregado a los clientes
- **THEN** la salida NO contiene `onerror` y no se ejecuta ninguna alerta, y el texto `hola` sigue siendo visible

#### Scenario: Payload con iframe u object del usuario es neutralizado
- **GIVEN** un usuario escribe `<object data="malicioso.swf"></object>` o un `<iframe>` arbitrario
- **WHEN** el mensaje es procesado por el servidor y entregado a los clientes
- **THEN** la salida no conserva esas etiquetas ejecutables como marcado activo y no se carga el recurso

### Requirement: Neutralización de payloads con scripts maliciosos
El sistema SHALL prevenir la ejecución de cualquier script embebido en el mensaje. Cuando el mensaje contenga HTML o scripts (por ejemplo `<script>`), el sistema MUST entregarlo renderizado como texto visible, sin interpretarlo como marcado. Tampoco SHALL renderizar media a partir de URLs con esquema peligroso (`javascript:`, `data:`) o contenido previo a la URL que rompa la estructura del HTML.

#### Scenario: Script malicioso se muestra como texto
- **GIVEN** un usuario escribe en el chat `<script>alert('xss')</script>`
- **WHEN** el mensaje es procesado por el servidor y entregado a los clientes
- **THEN** el chat muestra el contenido literalmente sin ejecutar ningún script ni disparar ninguna alerta

### Requirement: Endpoint HTTP para mensajes
El sistema SHALL exponer una ruta HTTP `POST /api/messages` que reciba mensajes del chat, aplique la validación de `una-lib` y responda con el resultado: `200` con el mensaje ya seguro cuando la entrada sea texto o media válida, o `400` con un error cuando la entrada sea una URL no permitida (esquema no soportado, extensión desconocida o ausente) o el campo `mensaje` falte. El sistema SHALL re-emitir a los clientes conectados por Socket.IO únicamente las peticiones aceptadas. El backend MUST invocar la función de validación de `una-lib` en cada petición procesada.

#### Scenario: Imagen válida aceptada por HTTP
- **GIVEN** una petición `POST /api/messages` con `mensaje` = `https://ejemplo.com/foto.jpg`
- **WHEN** el backend procesa la petición
- **THEN** responde `200` con el cuerpo conteniendo la etiqueta `<img>` de esa URL y re-emite el mensaje a los clientes de Socket.IO

#### Scenario: Video válido aceptado por HTTP
- **GIVEN** una petición `POST /api/messages` con `mensaje` = `https://ejemplo.com/videos/clase.mp4` (o una URL de YouTube)
- **WHEN** el backend procesa la petición
- **THEN** responde `200` con el cuerpo conteniendo la etiqueta de reproductor correspondiente (`<video>` o `<iframe>`)

#### Scenario: Script malicioso devuelto saneado
- **GIVEN** una petición `POST /api/messages` con `mensaje` = `<script>alert(1)</script>`
- **WHEN** el backend procesa la petición
- **THEN** la respuesta no contiene `<script>` ni ejecuta el contenido, y el backend ha invocado la validación de `una-lib`

#### Scenario: URL no permitida rechazada con HTTP 400
- **GIVEN** una petición `POST /api/messages` con `mensaje` = `https://ejemplo.com/archivo.xyz` o `javascript:alert(1)`
- **WHEN** el backend procesa la petición
- **THEN** responde `400` con un mensaje de error de URL no permitida, no devuelve etiqueta de media y no re-emite nada a los clientes

### Requirement: Compatibilidad del contrato de mensajes
El sistema SHALL mantener el formato del payload del evento `Evento-Mensaje-Server` (`{nombre, mensaje, color}` serializado en JSON) para que servidor, cliente y librería sigan interoperando sin cambios de protocolo.

#### Scenario: Mensaje de texto simple sigue funcionando
- **GIVEN** un usuario escribe `hola a todos`
- **WHEN** el mensaje es procesado por el servidor y entregado a los clientes
- **THEN** todos los clientes reciben un JSON con `nombre`, `mensaje` y `color`, y el mensaje se muestra con el nombre coloreado seguido del texto

#### Scenario: Mensaje con caracteres especiales se conserva legible
- **GIVEN** un usuario escribe `me gusta el pan & <3 de la UNA`
- **WHEN** el mensaje es procesado por el servidor y entregado a los clientes
- **THEN** el texto se muestra legible y sin ejecutar ningún marcado
