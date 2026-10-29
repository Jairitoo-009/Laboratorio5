// @ts-check
import { test, expect } from '@playwright/test';

/**
 * E2E del chat UNA contra frontend y backend reales.
 * Frontend: http://localhost:3000 (baseURL del config)
 * El servidor lo levanta/reutiliza `webServer` del playwright.config.js.
 *
 * Ejecutar: npx playwright test --project=chromium --headed
 */

// Medios de prueba publicos y estables
const IMAGEN_URL = 'https://upload.wikimedia.org/wikipedia/commons/a/a9/Example.jpg';
const VIDEO_URL = 'https://mdn.github.io/shared-assets/videos/flower.mp4';
const SCRIPT_MALICIOSO = "<script>alert('Inyección de script');</script>";

/** Rellena el formulario del chat y envia el mensaje. */
async function enviarMensaje(page, texto, nombre = 'e2e') {
  await page.getByPlaceholder('Tu nombre').fill(nombre);
  await page.getByPlaceholder('Escriba un mensaje o pega una URL de imagen/video').fill(texto);
  await page.getByRole('button', { name: 'Enviar' }).click();
}

// ------------------------------------------------------------------
// Smoke
// ------------------------------------------------------------------
test('la pagina del chat carga correctamente', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle('Chat Socket.IO UNA');
  await expect(page.getByPlaceholder('Tu nombre')).toBeVisible();
  await expect(page.getByPlaceholder('Escriba un mensaje o pega una URL de imagen/video')).toBeVisible();
  await expect(page.locator('.chat-shell')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(page.locator('.chat-shell')).toHaveCSS('border-radius', '20px');
  await expect(page.locator('#messages')).toHaveCSS('overflow-y', 'auto');
});

test('el chat muestra una imagen y un video precargados', async ({ page }) => {
  await page.goto('/');

  const image = page.locator('#messages li img').first();
  const video = page.locator('#messages li video').first();
  await expect(image).toHaveAttribute('src', IMAGEN_URL);
  await expect(video).toHaveAttribute('src', VIDEO_URL);
  await expect.poll(() => image.evaluate((element) => element.naturalWidth)).toBeGreaterThan(0);
  await expect.poll(() => video.evaluate((element) => element.readyState)).toBeGreaterThanOrEqual(2);
});

test('un mensaje de texto enviado se muestra en el chat', async ({ page }) => {
  await page.goto('/');
  await enviarMensaje(page, 'hola desde playwright');

  const ultimo = page.locator('#messages li').last();
  await expect(ultimo).toContainText('hola desde playwright');
  await expect(ultimo).toContainText('e2e');
});

// ------------------------------------------------------------------
// 1) Imagen valida -> <img> visible y completamente cargada
// ------------------------------------------------------------------
test('1) URL de imagen valida: aparece <img> visible y termina de cargar', async ({ page }) => {
  await page.goto('/');
  await enviarMensaje(page, IMAGEN_URL);

  const img = page.locator('#messages li img').last();
  await expect(img).toBeVisible();
  await expect(img).toHaveAttribute('src', IMAGEN_URL);
  await expect(img).toHaveCSS('display', 'block');
  await expect(img).toHaveCSS('max-height', '420px');

  // la imagen descargo por completo desde el CDN (ancho real > 0)
  await expect
    .poll(() => img.evaluate((el) => el.naturalWidth), { timeout: 20000, message: 'la imagen nunca termino de cargar' })
    .toBeGreaterThan(0);
});

test('URL de imagen con parametros tambien se muestra como imagen', async ({ page }) => {
  await page.goto('/');
  const url = 'https://upload.wikimedia.org/wikipedia/commons/a/a9/Example.jpg?cache=1';
  await enviarMensaje(page, url);

  await expect(page.locator('#messages li img').last()).toHaveAttribute('src', url);
});

test('URL directa sin extension se detecta por su contenido', async ({ page }) => {
  const url = 'https://media.example.com/photo?width=16&format=svg';
  await page.route(/^https:\/\/media\.example\.com\/photo\?/, (route) =>
    route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"></svg>',
    })
  );
  await page.goto('/');
  await enviarMensaje(page, url);

  const image = page.locator('#messages li img').last();
  await expect(image).toHaveAttribute('src', url);
  await expect.poll(() => image.evaluate((element) => element.naturalWidth)).toBe(16);
});

// ------------------------------------------------------------------
// 2) Video valido -> <video> visible y con contenido cargado
// ------------------------------------------------------------------
test('2) URL de video valida: aparece <video> y carga el contenido', async ({ page }) => {
  await page.goto('/');
  await enviarMensaje(page, VIDEO_URL);

  const video = page.locator('#messages li video').last();
  await expect(video).toBeVisible();
  await expect(video).toHaveAttribute('src', VIDEO_URL);

  // HAVE_CURRENT_DATA o mejor: hay datos descargados del video
  await expect
    .poll(() => video.evaluate((el) => el.readyState), { timeout: 20000, message: 'el video nunca llego a readyState >= 2' })
    .toBeGreaterThanOrEqual(2);

  // el reproductor decodifica frames reales
  const videoWidth = await video.evaluate((el) => el.videoWidth);
  expect(videoWidth).toBeGreaterThan(0);
});

// ------------------------------------------------------------------
// 3) Script malicioso -> ningun alert y mensaje saneado
// ------------------------------------------------------------------
test('3) script malicioso: no se ejecuta ningun alert y el mensaje queda saneado', async ({ page }) => {
  // se registra ANTES del envio para detectar cualquier alert
  let dialogoDetectado = null;
  page.on('dialog', async (dialog) => {
    dialogoDetectado = `${dialog.type()}: ${dialog.message()}`;
    await dialog.dismiss();
  });

  await page.goto('/');
  await enviarMensaje(page, SCRIPT_MALICIOSO);

  // el servidor proceso y re-emitio el mensaje (aparece la linea del usuario)
  const ultimo = page.locator('#messages li').last();
  await expect(ultimo).toContainText('e2e');

  // margen para un posible alert tardio (onerror, onload, ...)
  await page.waitForTimeout(500);

  // (a) no se ejecuto ningun dialogo
  expect(dialogoDetectado).toBeNull();

  // (b) no existe ni un <script> en el DOM del chat
  await expect(page.locator('#messages script')).toHaveCount(0);

  // (c) el contenido quedo rechazado/saneado: no se muestra como marcado
  await expect(ultimo).not.toContainText('<script');
  await expect(ultimo).not.toContainText('Inyección de script');
});
