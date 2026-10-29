function parseHttpUrl(value) {
  if (typeof value !== 'string') {
    return null;
  }

  try {
    var url = new URL(value.trim());
    if ((url.protocol !== 'http:' && url.protocol !== 'https:') ||
        url.username || url.password ||
        !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9-]{2,}$/i.test(url.hostname)) {
      return null;
    }
    return url;
  } catch (e) {
    return null;
  }
}

function getYouTubeId(value) {
  if (typeof value !== 'string') {
    return null;
  }

  var input = value.trim();
  var url = parseHttpUrl(/^[a-z][a-z0-9+.-]*:\/\//i.test(input) ? input : 'https://' + input);
  if (!url) {
    return null;
  }

  var host = url.hostname.toLowerCase();
  var id = null;
  if (host === 'youtu.be' || host === 'www.youtu.be') {
    id = url.pathname.split('/').filter(Boolean)[0];
  } else if (host === 'youtube.com' || host === 'www.youtube.com' || host === 'm.youtube.com') {
    if (url.pathname === '/watch') {
      id = url.searchParams.get('v');
    } else {
      var match = url.pathname.match(/^\/(?:embed|v|shorts|live)\/([\w-]{11})\/?$/);
      id = match ? match[1] : null;
    }
  }

  return id && /^[\w-]{11}$/.test(id) ? id : null;
}

// modulo de validacion y render de mensajes del chat UNA.
// fuente unica de verdad de la validacion de URLs y del saneado anti-XSS.

module.exports = {

    // ---------------------------------------------------------------
    // utilidades de saneado
    // ---------------------------------------------------------------

    // convierte texto del usuario a entidades HTML para que se muestre
    // literalmente y nunca se interprete como marcado.
    escapeHtml: function (text) {
      if (text === null || text === undefined) {
        return '';
      }
      return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    },

    // elimina etiquetas ejecutables y atributos de eventos del mensaje
    // del usuario: <script>, <iframe>, <object>, <embed> y atributos on*.
    sanitizeMessage: function (text) {
      if (!text || typeof text !== 'string') {
        return '';
      }
      var out = text;

      // 1) bloques <script>...</script> completos, con su contenido
      out = out.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '');
      // script sin cerrar
      out = out.replace(/<script\b[^>]*>/gi, '');
      out = out.replace(/<\/script\s*>/gi, '');

      // 2) etiquetas peligrosas (apertura, cierre o autocontenido)
      out = out.replace(/<\/?(?:iframe|object|embed|applet|form|svg|math)\b[^>]*>/gi, '');

      // 3) atributos de eventos on* (onerror, onload, onclick, ...)
      out = out.replace(/\s+on[a-z0-9_\-]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');

      return out;
    },

    // ---------------------------------------------------------------
    // validacion de URLs (regex estrictas y ancladas)
    // ---------------------------------------------------------------

    // logica que valida si un telefono esta correcto...
    is_valid_phone: function (phone) {
      // inicializacion lazy
      var isValid = false;
      // expresion regular copiada de StackOverflow
      var re = /^[+]*[(]{0,1}[0-9]{1,4}[)]{0,1}[-\s\./0-9]*$/i;

      // validacion Regex
      try {
        isValid = re.test(phone);
      } catch (e) {
        console.log(e);
      } finally {
          return isValid;
      }
      // fin del try-catch block
    },

    // solo http/https, host con dominio y extension de imagen al final.
    is_valid_url_image: function (url) {
      var parsed = parseHttpUrl(url);
      return !!parsed && /\.(?:jpg|jpeg|png|gif|bmp|webp|svg)$/i.test(parsed.pathname);
    },

    // solo http/https y extension de archivo de video al final.
    is_valid_url_video_file: function (url) {
      var parsed = parseHttpUrl(url);
      return !!parsed && /\.(?:mp4|webm|ogg|mov)$/i.test(parsed.pathname);
    },

    // URL completa de youtube con id de 11 caracteres obligatorio.
    is_valid_yt_video: function (url) {
      return getYouTubeId(url) !== null;
    },

    getYTVideoId: function(url){
      return getYouTubeId(url);
    },

    // ---------------------------------------------------------------
    // generacion de etiquetas (unico HTML que sale de la libreria)
    // ---------------------------------------------------------------

    getEmbeddedCode: function (url){
      var id = this.getYTVideoId(url);
      if (!id || !this.is_valid_yt_video(url)) {
        return '';
      }
      var code = '<iframe width="560" height="315" src="https://www.youtube.com/embed/'+id+ '" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>';
      return code;
    },

    getImageTag: function(url){
      // sin estilos inline: el layout lo gobierna el CSS del chat
      // (max-width:100%, max-height:320px, object-fit:contain, border-radius)
      var tag = '<img src="'+this.escapeHtml(url)+'" alt="imagen">';
      return tag;
    },

    getVideoTag: function(url){
      var tag = '<video controls src="'+this.escapeHtml(url)+'"></video>';
      return tag;
    },

    // ---------------------------------------------------------------
    // clasificacion y pipeline del mensaje
    // ---------------------------------------------------------------

    // devuelve 'image' | 'video' | 'text' segun la URL limpia recibida.
    classifyMessage: function(text){
      if (typeof text !== 'string') {
        return 'text';
      }
      var t = text.trim();
      if (this.is_valid_url_image(t)) {
        return 'image';
      }
      if (this.is_valid_yt_video(t) || this.is_valid_url_video_file(t)) {
        return 'video';
      }
      return 'text';
    },

    // punto de entrada usado por server.js: sanea, clasifica y devuelve
    // el payload JSON con el mensaje ya listo para renderizar de forma segura.
    validateMessage: function(msg){
      // Handle invalid input
      if (!msg || typeof msg !== 'string') {
        return JSON.stringify({ mensaje: '' });
      }

      try {
        var obj = JSON.parse(msg);

        if (!obj || typeof obj !== 'object') {
          throw new Error('payload invalido');
        }

        var raw = (typeof obj.mensaje === 'string') ? obj.mensaje : '';
        var limpio = this.sanitizeMessage(raw);
        var tipo = this.classifyMessage(limpio);

        if (tipo === 'image') {
          console.log("Es una imagen!");
          obj.mensaje = this.getImageTag(limpio.trim());
        }
        else if (tipo === 'video') {
          console.log("Es un video!");
          var url = limpio.trim();
          obj.mensaje = this.is_valid_yt_video(url) ? this.getEmbeddedCode(url) : this.getVideoTag(url);
        }
        else {
          console.log("Es un texto!");
          obj.mensaje = this.escapeHtml(limpio);
        }

        return JSON.stringify(obj);
      } catch (e) {
        console.log('Error processing message:', e);
        // payload no valido: devuelve el mensaje saneado y escapado
        var crudo = (typeof msg === 'string') ? msg : '';
        return JSON.stringify({ mensaje: this.escapeHtml(this.sanitizeMessage(crudo)) });
      }
    }

  // fin del modulo
  };
