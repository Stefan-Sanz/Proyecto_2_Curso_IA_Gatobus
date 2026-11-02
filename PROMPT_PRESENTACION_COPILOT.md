# Prompt para generar la presentación del proyecto

Copia y pega el siguiente prompt en Copilot junto con el archivo
[`REPORTE_DESARROLLO_IMPLEMENTACION.md`](./REPORTE_DESARROLLO_IMPLEMENTACION.md).

---

Actúa como diseñador de presentaciones académicas y comunicador técnico.
Genera una presentación en español para exponer el desarrollo e
implementación del **Asistente de viajes Gatobus**.

## Fuentes de información

- Usa [`REPORTE_DESARROLLO_IMPLEMENTACION.md`](./REPORTE_DESARROLLO_IMPLEMENTACION.md)
  como fuente principal de hechos, cifras y resultados.
- Usa las capturas disponibles en [`evidencias/capturas/`](./evidencias/capturas/)
  como evidencia visual. El reporte indica los nombres previstos y cuáles
  podrían seguir pendientes.
- No inventes resultados, funcionalidades, cifras, nombres, métricas ni
  capturas. Si una captura o dato no está disponible, omítelo o identifícalo
  claramente como pendiente.

## Audiencia y formato

- Audiencia: docente y evaluadores académicos con conocimientos generales de
  desarrollo web.
- Duración: 5 a 7 minutos.
- Extensión: 8 diapositivas, más una diapositiva opcional de preguntas.
- Tono: profesional, claro y directo; evita párrafos largos y jerga innecesaria.
- En cada diapositiva usa un título, hasta 3-5 viñetas breves y una sugerencia
  visual. Añade notas del presentador de 2-4 frases por diapositiva.

## Estructura requerida

1. **Portada:** nombre del proyecto, autor Carlos Sánchez y propósito de la
   demo.
2. **Problema y objetivo:** qué ayuda a consultar el asistente y qué se busca
   demostrar en la evaluación.
3. **Experiencia del usuario:** itinerario, hospedaje y disponibilidad; usa
   `01-inicio-y-viaje.png` y/o `02-disponibilidad-asientos.png` si existen.
4. **Chat con IA:** recorrido navegador → backend Express → Microsoft Foundry;
   usa `03-chat-foundry.png` si existe. Explica que el navegador no llama
   directamente a Foundry.
5. **Reserva y pago demostrativos:** selección, cálculo del total y archivo
   sintético; usa `04-reserva-y-hospedaje.png` y
   `05-reporte-pago-demo.png` si existen. Aclara que no se mueve dinero.
6. **Panel administrativo:** autenticación, revisión y confirmación/rechazo de
   reportes; usa `06-acceso-administrativo.png` y
   `07-revision-admin-demo.png` si existen. Oculta credenciales en las
   capturas.
7. **Implementación y despliegue:** Node.js 24, Express 5, JavaScript vanilla,
   App Service Linux en West US, plan B1 y URL pública. Incluye la causa del
   error de empaquetado (rutas Windows incompatibles con Linux) y su
   corrección. Presenta el costo del reporte como estimado, no como cargo
   facturado: alrededor de USD 13.14 al mes más impuestos, sin incluir Foundry.
8. **Validación, límites y conclusión:** pruebas locales y de Azure que constan
   en el reporte; usa `08-salud-publicada.png` si existe. Concluye que es una
   demo funcional para evaluación, pero no está lista para operar con viajeros
   reales por usar almacenamiento local y no integrar pagos reales.

## Reglas de seguridad y precisión

- Nunca muestres contraseñas, tokens, endpoints secretos, cookies de sesión,
  datos personales, números bancarios ni comprobantes reales.
- Los datos y las reservas de las pruebas son ficticios. El App Service no se
  utilizó para crear una reserva de prueba.
- Diferencia las pruebas locales de las verificaciones realizadas en Azure.
- No describas el pago de demostración como una transacción real.
- No afirmes que la persistencia es durable: reservas e imágenes usan
  almacenamiento local y pueden perderse con cambios o reinicios.
- No agregues recursos ni costos distintos a los documentados.
- Mantén los textos breves y suficientemente grandes para proyección.

Entrega el contenido completo por diapositiva, con texto visible, sugerencia
visual, referencia exacta a cada imagen utilizada y notas del presentador.
