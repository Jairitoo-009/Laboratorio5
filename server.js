
// npm install para descargar los paquetes...

// libreriuas
var express = require('express');
var validation = require('./libs/unalib');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var port = process.env.PORT || 3000;

// parseo del cuerpo JSON en las peticiones HTTP
app.use(express.json());

// root: presentar html
app.get('/', function(req, res){
  // nunca cachear la interfaz: si no, el navegador sigue mostrando
  // una version vieja del chat aunque se haya actualizado el CSS/JS
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.sendFile(__dirname + '/index.html');
});

// ruta HTTP que recibe mensajes del chat.
// valida con una-lib, responde con el mensaje seguro y lo re-emite
// a todos los clientes conectados por Socket.IO.
app.post('/api/messages', function(req, res){
  var body = req.body || {};

  if (typeof body.mensaje !== 'string' || body.mensaje.trim() === '') {
    return res.status(400).json({ ok: false, error: 'el campo "mensaje" es obligatorio y debe ser texto' });
  }

  // siempre pasa por la validacion de una-lib (espiable en los tests)
  var salida = JSON.parse(validation.validateMessage(JSON.stringify({
    nombre: body.nombre || 'Anonimo',
    mensaje: body.mensaje,
    color: body.color || '#000000'
  })));

  // ¿el usuario intento enviar una URL que no es imagen/video valido?
  var crudo = validation.sanitizeMessage(body.mensaje).trim();
  var pareceUrl = /^(?:https?:\/\/|www\.|javascript:|data:|ftp:|file:)/i.test(crudo);
  if (pareceUrl && validation.classifyMessage(crudo) === 'text') {
    return res.status(400).json({
      ok: false,
      error: 'URL no permitida: solo se aceptan imagenes y videos validos (http/https)'
    });
  }

  // mensaje aceptado: se re-emite a todos los clientes conectados
  io.emit('Evento-Mensaje-Server', JSON.stringify(salida));
  return res.status(200).json({
    ok: true,
    nombre: salida.nombre,
    color: salida.color,
    mensaje: salida.mensaje
  });
});

// escuchar una conexion por socket
io.on('connection', function(socket){
  // si se escucha "chat message"
  socket.on('Evento-Mensaje-Server', function(msg){

    msg =  validation.validateMessage(msg);
    // volvemos a emitir el mismo mensaje
    io.emit('Evento-Mensaje-Server', msg);
  });
});

// solo abre el puerto cuando se ejecuta directamente (node server.js);
// los tests de integracion lo requieren sin escuchar en ningun puerto.
if (require.main === module) {
  http.listen(port, function(){
    console.log('listening on *:' + port);
  });
}

module.exports = { app: app, http: http, io: io, validation: validation };
