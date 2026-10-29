/**
 * Pruebas de integracion del backend (Express + Socket.IO + una-lib).
 * Peticiones HTTP reales contra la ruta que recibe mensajes.
 *
 * Ejecutar: npx jest tests/integration --runInBand --env=node
 */
const request = require('supertest');
const { app, http, io, validation } = require('../../server');

describe('POST /api/messages (integracion)', () => {
  let validateSpy;
  let emitSpy;

  beforeAll(() => {
    // espia la validacion real de una-lib para confirmar que el backend la usa
    validateSpy = jest.spyOn(validation, 'validateMessage');
    // espia el broadcast a los clientes de Socket.IO
    emitSpy = jest.spyOn(io, 'emit');
  });

  afterEach(() => {
    validateSpy.mockClear();
    emitSpy.mockClear();
  });

  // cierra socket.io y el servidor de Express al terminar la suite
  afterAll(async () => {
    validateSpy.mockRestore();
    emitSpy.mockRestore();

    await new Promise((resolve) => {
      let finished = false;
      const finish = () => {
        if (!finished) {
          finished = true;
          resolve();
        }
      };
      const safety = setTimeout(finish, 3000);
      io.close(() => {
        clearTimeout(safety);
        finish();
      });
    });

    if (http.listening) {
      await new Promise((resolve) => http.close(() => resolve()));
    }
  });

  const post = (mensaje, extra) =>
    request(app)
      .post('/api/messages')
      .send(Object.assign({ nombre: 'tester', color: '#ff0000', mensaje }, extra || {}));

  // ---------------------------------------------------------------
  // 1) URL de imagen valida -> aceptada con contenido correcto
  // ---------------------------------------------------------------
  test('GIVEN una URL de imagen valida WHEN se envia al backend THEN responde 200 con la etiqueta img', async () => {
    const res = await post('https://ejemplo.com/foto.jpg');

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.mensaje).toMatch(/^<img /);
    expect(res.body.mensaje).toContain('https://ejemplo.com/foto.jpg');
    // el backend llamo realmente a validarMensaje de una-lib
    expect(validateSpy).toHaveBeenCalledTimes(1);
    expect(validateSpy.mock.calls[0][0]).toContain('https://ejemplo.com/foto.jpg');
    // y lo re-emitio a los clientes del chat
    expect(emitSpy).toHaveBeenCalledWith('Evento-Mensaje-Server', expect.any(String));
  });

  test('GIVEN una URL de imagen con parametros WHEN se envia al backend THEN responde con la etiqueta img', async () => {
    const res = await post('https://ejemplo.com/foto.jpg?width=800&format=webp');

    expect(res.status).toBe(200);
    expect(res.body.mensaje).toMatch(/^<img /);
    expect(res.body.mensaje).toContain('foto.jpg?width=800&amp;format=webp');
  });

  // ---------------------------------------------------------------
  // 2) URL de video valida -> aceptada
  // ---------------------------------------------------------------
  test('GIVEN una URL de video de youtube WHEN se envia al backend THEN responde 200 con iframe', async () => {
    const res = await post('https://www.youtube.com/watch?v=qYwlqx-JLok');

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.mensaje).toMatch(/^<iframe /);
    expect(res.body.mensaje).toContain('/embed/qYwlqx-JLok');
    expect(validateSpy).toHaveBeenCalledTimes(1);
  });

  test('GIVEN una URL de YouTube compartida WHEN se envia al backend THEN responde con el iframe', async () => {
    const res = await post('https://www.youtube.com/watch?v=qYwlqx-JLok&si=compartido');

    expect(res.status).toBe(200);
    expect(res.body.mensaje).toContain('/embed/qYwlqx-JLok');
  });

  test('GIVEN una URL de archivo de video WHEN se envia al backend THEN responde 200 con etiqueta video', async () => {
    const res = await post('https://ejemplo.com/videos/clase.mp4');

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.mensaje).toMatch(/^<video /);
    expect(res.body.mensaje).toContain('https://ejemplo.com/videos/clase.mp4');
  });

  // ---------------------------------------------------------------
  // 3) Script malicioso -> saneado (sin <script>)
  // ---------------------------------------------------------------
  test('GIVEN un script malicioso WHEN se envia al backend THEN devuelve contenido saneado sin <script>', async () => {
    const res = await post("<script>alert(1)</script>");

    expect(res.status).toBe(200);
    expect(res.body.mensaje).not.toContain('<script');
    expect(res.body.mensaje).not.toContain('alert(1)');
    expect(validateSpy).toHaveBeenCalledTimes(1);
  });

  test('GIVEN un script mezclado en texto WHEN se envia al backend THEN el texto sobrevive y el script no', async () => {
    const res = await post('hola <script>alert(1)</script> adios');

    expect(res.status).toBe(200);
    expect(res.body.mensaje).not.toContain('<script');
    expect(res.body.mensaje).toContain('hola');
    expect(res.body.mensaje).toContain('adios');
  });

  test('GIVEN un atributo onerror WHEN se envia al backend THEN la respuesta no lo contiene', async () => {
    const res = await post('<img src="x" onerror="alert(1)">hola');

    expect(res.status).toBe(200);
    expect(res.body.mensaje).not.toContain('onerror');
    expect(res.body.mensaje).not.toMatch(/^<img/); // no se renderiza como media
    expect(res.body.mensaje).toContain('hola');
  });

  // ---------------------------------------------------------------
  // 4) URL no permitida -> rechazada (400)
  // ---------------------------------------------------------------
  test('GIVEN una URL con extension no permitida WHEN se envia al backend THEN responde 400', async () => {
    const res = await post('https://ejemplo.com/archivo.xyz');

    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toMatch(/URL no permitida/i);
    expect(res.body.mensaje).toBeUndefined();
    // aun asi, la validacion de una-lib se ejecuto
    expect(validateSpy).toHaveBeenCalledTimes(1);
    // y no se broadcastea nada a los clientes
    expect(emitSpy).not.toHaveBeenCalled();
  });

  test('GIVEN una URL javascript:alert(1) WHEN se envia al backend THEN responde 400', async () => {
    const res = await post('javascript:alert(1)');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/URL no permitida/i);
    expect(emitSpy).not.toHaveBeenCalled();
  });

  test('GIVEN una URL sin extension WHEN se envia al backend THEN responde 400', async () => {
    const res = await post('https://ejemplo.com/archivo');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/URL no permitida/i);
  });

  // ---------------------------------------------------------------
  // Validaciones del endpoint
  // ---------------------------------------------------------------
  test('GIVEN un mensaje vacio o ausente WHEN se envia al backend THEN responde 400', async () => {
    const res = await request(app).post('/api/messages').send({ nombre: 'tester', color: '#0f0' });

    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
  });

  test('GIVEN un texto normal WHEN se envia al backend THEN responde 200 con el texto intacto', async () => {
    const res = await post('hola a todos');

    expect(res.status).toBe(200);
    expect(res.body.mensaje).toBe('hola a todos');
    expect(validateSpy).toHaveBeenCalledTimes(1);
  });

  test('GIVEN el frontend pedida la pagina WHEN se hace GET / THEN responde 200 con el chat', async () => {
    const res = await request(app).get('/');

    expect(res.status).toBe(200);
    expect(res.text).toContain('Chat Socket.IO UNA');
  });
});
