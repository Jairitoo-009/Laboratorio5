# Reporte de vulnerabilidades — Snyk

- **Fecha de verificación:** 28 de octubre de 2026
- **Proyecto:** UNA Chat
- **CLI:** Snyk 1.1308.2
- **Archivo analizado:** `package-lock.json`

## Proceso y hallazgos iniciales

Se ejecutó `snyk test` sobre las dependencias instaladas. El primer análisis encontró cuatro vulnerabilidades: una alta, una media y dos bajas; no se detectaron vulnerabilidades críticas.

| Severidad | Paquete y versión inicial | Hallazgo |
|---|---|---|
| Alta | `body-parser@1.20.8` | Excepción no controlada |
| Media | `qs@6.16.1` | Codificación o escape incorrecto de salida |
| Baja | `serialize-javascript@7.1.2` | Dos hallazgos de XSS |

## Mitigación

Se actualizaron las dependencias transitivas a versiones con los parches disponibles:

```bash
npm update body-parser qs serialize-javascript
```

Versiones resultantes en el árbol de dependencias:

- `body-parser@1.20.9`
- `qs@6.16.2`
- `serialize-javascript@7.1.4`

## Verificación final

Se volvió a ejecutar `snyk test` después de actualizar las dependencias.

| Resultado | Valor |
|---|---:|
| Dependencias evaluadas | 105 |
| Vulnerabilidades abiertas | 0 |
| Rutas vulnerables | 0 |
| Vulnerabilidades críticas o altas pendientes | 0 |

**Conclusión:** el análisis final no reportó vulnerabilidades abiertas. Los hallazgos iniciales, incluido el de severidad alta, quedaron mitigados mediante las actualizaciones indicadas.
