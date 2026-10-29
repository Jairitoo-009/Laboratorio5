var val = require('../libs/unalib');
var assert = require('assert');


describe('unalib', function(){


  describe('funcion is_valid_phone', function(){

    it('deberia devolver true para 8297-8547', function(){

      assert.equal(val.is_valid_phone('8297-8547'), true);

    });

    it('deberia devolver false para 8297p-8547', function(){

      assert.equal(val.is_valid_phone('8297p-8547'), false);

    });

  });


  describe('funcion is_valid_url_image', function(){

    it('deberia devolver true para http://image.com/image.jpg', function(){

      assert.equal(val.is_valid_url_image('http://image.com/image.jpg'), true);

    });

    it('deberia devolver true para http://image.com/image.gif', function(){

      assert.equal(val.is_valid_url_image('http://image.com/image.gif'), true);

    });

    it('deberia aceptar https://ejemplo.com/foto.webp', function(){

      assert.equal(val.is_valid_url_image('https://ejemplo.com/foto.webp'), true);

    });

    it('deberia aceptar una imagen con parametros de consulta', function(){

      assert.equal(val.is_valid_url_image('https://images.ejemplo.com/foto.jpg?width=800&format=webp'), true);

    });

    it('deberia rechazar una URL sin extension valida', function(){

      assert.equal(val.is_valid_url_image('https://ejemplo.com/archivo'), false);

    });

    it('deberia rechazar una extension desconocida', function(){

      assert.equal(val.is_valid_url_image('https://ejemplo.com/archivo.xyz'), false);

    });

  });

  describe('funcion is_valid_yt_video', function(){

    it('deberia devolver true para https://www.youtube.com/watch?v=qYwlqx-JLok', function(){

      assert.equal(val.is_valid_yt_video('https://www.youtube.com/watch?v=qYwlqx-JLok'), true);

    });

    it('deberia aceptar enlaces de YouTube con parametros adicionales', function(){

      assert.equal(val.is_valid_yt_video('https://www.youtube.com/watch?v=qYwlqx-JLok&si=compartido'), true);
      assert.equal(val.is_valid_yt_video('https://youtu.be/qYwlqx-JLok?si=compartido'), true);

    });

    it('deberia rechazar una URL que no es de youtube', function(){

      assert.equal(val.is_valid_yt_video('http://image.com/image.jpg'), false);

    });

  });

  describe('funcion is_valid_url_video_file', function(){

    it('deberia devolver true para https://ejemplo.com/videos/clase.mp4', function(){

      assert.equal(val.is_valid_url_video_file('https://ejemplo.com/videos/clase.mp4'), true);

    });

    it('deberia devolver true para .webm, .ogg y .mov', function(){

      assert.equal(val.is_valid_url_video_file('https://ejemplo.com/a.webm'), true);
      assert.equal(val.is_valid_url_video_file('https://ejemplo.com/a.ogg'), true);
      assert.equal(val.is_valid_url_video_file('https://ejemplo.com/a.mov'), true);

    });

    it('deberia aceptar un video con parametros de consulta', function(){

      assert.equal(val.is_valid_url_video_file('https://media.ejemplo.com/video.mp4?token=abc123'), true);

    });

    it('deberia rechazar javascript:alert(1)', function(){

      assert.equal(val.is_valid_url_video_file('javascript:alert(1)'), false);

    });

  });


  // -----------------------------------------------------------------
  // BDD: clasificacion de contenido (image | video | text)
  // -----------------------------------------------------------------
  describe('classifyMessage', function(){

    it('GIVEN una URL de imagen valida WHEN se clasifica THEN es aceptada y marcada como imagen', function(){

      assert.equal(val.classifyMessage('https://ejemplo.com/foto.jpg'), 'image');
      assert.equal(val.classifyMessage('https://ejemplo.com/foto.jpeg'), 'image');
      assert.equal(val.classifyMessage('https://ejemplo.com/foto.png'), 'image');
      assert.equal(val.classifyMessage('https://ejemplo.com/foto.svg'), 'image');

    });

    it('GIVEN una URL de video valida WHEN se clasifica THEN es aceptada y marcada como video', function(){

      assert.equal(val.classifyMessage('https://ejemplo.com/videos/clase.mp4'), 'video');
      assert.equal(val.classifyMessage('https://www.youtube.com/watch?v=qYwlqx-JLok'), 'video');

    });

    it('GIVEN una URL sin extension valida WHEN se clasifica THEN es rechazada como texto', function(){

      assert.equal(val.classifyMessage('https://ejemplo.com/archivo'), 'text');
      assert.equal(val.classifyMessage('https://ejemplo.com/archivo.xyz'), 'text');

    });

    it('GIVEN una URL maliciosa javascript:alert(1) WHEN se clasifica THEN es rechazada como texto', function(){

      assert.equal(val.classifyMessage('javascript:alert(1)'), 'text');

    });

    it('GIVEN un mensaje cualquiera WHEN se clasifica THEN es texto', function(){

      assert.equal(val.classifyMessage('hola a todos'), 'text');

    });

  });


  // -----------------------------------------------------------------
  // BDD: validateMessage (pipeline del servidor, anti-XSS)
  // -----------------------------------------------------------------
  describe('validateMessage', function(){

    function parse(salida){
      return JSON.parse(salida);
    }

    it('GIVEN una imagen valida WHEN se procesa THEN devuelve la etiqueta img con esa URL', function(){

      var out = parse(val.validateMessage(JSON.stringify({ nombre:'ana', mensaje:'https://ejemplo.com/foto.jpg', color:'#ff0000' })));
      assert.equal(out.mensaje.indexOf('<img'), 0);
      assert.ok(out.mensaje.indexOf('https://ejemplo.com/foto.jpg') !== -1);

    });

    it('GIVEN un video valido de youtube WHEN se procesa THEN devuelve el iframe con el id correcto', function(){

      var out = parse(val.validateMessage(JSON.stringify({ nombre:'ana', mensaje:'https://www.youtube.com/watch?v=qYwlqx-JLok', color:'#ff0000' })));
      assert.equal(out.mensaje.indexOf('<iframe'), 0);
      assert.ok(out.mensaje.indexOf('/embed/qYwlqx-JLok') !== -1);

    });

    it('GIVEN un archivo de video valido WHEN se procesa THEN devuelve la etiqueta video', function(){

      var out = parse(val.validateMessage(JSON.stringify({ nombre:'ana', mensaje:'https://ejemplo.com/videos/clase.mp4', color:'#ff0000' })));
      assert.equal(out.mensaje.indexOf('<video'), 0);
      assert.ok(out.mensaje.indexOf('https://ejemplo.com/videos/clase.mp4') !== -1);

    });

    it('GIVEN una URL sin extension valida WHEN se procesa THEN no genera etiqueta de media', function(){

      var out = parse(val.validateMessage(JSON.stringify({ nombre:'ana', mensaje:'https://ejemplo.com/archivo.xyz', color:'#ff0000' })));
      assert.ok(out.mensaje.indexOf('<img') === -1);
      assert.ok(out.mensaje.indexOf('<video') === -1);
      assert.ok(out.mensaje.indexOf('<iframe') === -1);
      assert.ok(out.mensaje.indexOf('https://ejemplo.com/archivo.xyz') !== -1);

    });

    it('GIVEN un intento de inyeccion <script>alert(1)</script> WHEN se procesa THEN la salida no contiene <script>', function(){

      var out = parse(val.validateMessage(JSON.stringify({ nombre:'ana', mensaje:"<script>alert(1)</script>", color:'#ff0000' })));
      assert.ok(out.mensaje.indexOf('<script') === -1);
      assert.ok(out.mensaje.indexOf('</script') === -1);

    });

    it('GIVEN un payload con <script> mezclado en el texto WHEN se procesa THEN no queda ninguna etiqueta script', function(){

      var out = parse(val.validateMessage(JSON.stringify({ nombre:'ana', mensaje:'hola <script>alert(1)</script> adios', color:'#ff0000' })));
      assert.ok(out.mensaje.indexOf('<script') === -1);
      assert.ok(out.mensaje.indexOf('hola') !== -1);
      assert.ok(out.mensaje.indexOf('adios') !== -1);

    });

    it('GIVEN un atributo onerror WHEN se procesa THEN onerror es eliminado de la salida', function(){

      var out = parse(val.validateMessage(JSON.stringify({ nombre:'ana', mensaje:'<img src="x" onerror="alert(1)">hola', color:'#ff0000' })));
      assert.ok(out.mensaje.indexOf('onerror') === -1);
      assert.ok(out.mensaje.indexOf('alert(1)') === -1);
      assert.ok(out.mensaje.indexOf('hola') !== -1);

    });

    it('GIVEN un onload/onclick WHEN se procesa THEN el atributo on* es eliminado', function(){

      var out = parse(val.validateMessage(JSON.stringify({ nombre:'ana', mensaje:'<div onload="hack()">texto</div>', color:'#ff0000' })));
      assert.ok(out.mensaje.indexOf('onload') === -1);
      assert.ok(out.mensaje.indexOf('hack()') === -1);
      assert.ok(out.mensaje.indexOf('texto') !== -1);

    });

    it('GIVEN un iframe u object del usuario WHEN se procesa THEN las etiquetas peligrosas se eliminan', function(){

      var out = parse(val.validateMessage(JSON.stringify({ nombre:'ana', mensaje:'<iframe src="http://malo.com"></iframe><object data="malo.swf"></object>ok', color:'#ff0000' })));
      assert.ok(out.mensaje.indexOf('<iframe') === -1);
      assert.ok(out.mensaje.indexOf('<object') === -1);
      assert.ok(out.mensaje.indexOf('malo.swf') === -1);
      assert.ok(out.mensaje.indexOf('ok') !== -1);

    });

    it('GIVEN una URL maliciosa javascript:alert(1) WHEN se procesa THEN no se genera media y se entrega como texto', function(){

      var out = parse(val.validateMessage(JSON.stringify({ nombre:'ana', mensaje:'javascript:alert(1)', color:'#ff0000' })));
      assert.ok(out.mensaje.indexOf('<img') === -1);
      assert.ok(out.mensaje.indexOf('<video') === -1);
      assert.ok(out.mensaje.indexOf('<iframe') === -1);

    });

    it('GIVEN un mensaje con caracteres especiales WHEN se procesa THEN el texto se conserva legible', function(){

      var out = parse(val.validateMessage(JSON.stringify({ nombre:'ana', mensaje:'me gusta el pan & <3 de la UNA', color:'#ff0000' })));
      assert.ok(out.mensaje.indexOf('&amp;') !== -1);   // & se muestra como &
      assert.ok(out.mensaje.indexOf('&lt;3') !== -1);   // <3 se muestra como <3
      assert.ok(out.mensaje.indexOf('<3') === -1);       // no queda marcado crudo

    });

    it('GIVEN un mensaje de texto simple WHEN se procesa THEN conserva el payload completo', function(){

      var out = parse(val.validateMessage(JSON.stringify({ nombre:'ana', mensaje:'hola a todos', color:'#ff0000' })));
      assert.equal(out.nombre, 'ana');
      assert.equal(out.mensaje, 'hola a todos');
      assert.equal(out.color, '#ff0000');

    });

    it('GIVEN una entrada no valida (null / no JSON) WHEN se procesa THEN devuelve mensaje vacio o saneado', function(){

      assert.equal(parse(val.validateMessage(null)).mensaje, '');
      assert.equal(parse(val.validateMessage(undefined)).mensaje, '');
      var crudo = parse(val.validateMessage('<script>alert(1)</script>'));
      assert.ok(crudo.mensaje.indexOf('<script') === -1);

    });

  });

});
