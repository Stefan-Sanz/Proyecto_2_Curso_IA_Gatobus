# Plan de trabajo: demo funcional del asistente de viajes

## Alcance

La demo de evaluación permite consultar información sintética, reservar asientos
y hospedaje, reportar pagos ficticios con comprobantes de prueba y revisar los
reportes desde un panel administrativo protegido. También ofrece el chat
conectado a Microsoft Foundry.

**No procesa dinero ni acepta datos reales.** No se deben realizar
transferencias ni adjuntar comprobantes reales. La persistencia en JSON y el
almacenamiento local de archivos sirven únicamente para la demostración y una
instancia; no son una arquitectura de producción.

## Constructor — implementar y validar

- Mantener en `data/database.json` solo el viaje y los inventarios sintéticos.
- Mantener habilitados los endpoints de reservas, reporte de pago,
  comprobantes y acciones administrativas.
- Hacer que la página permita seleccionar asientos, elegir hospedaje y crear
  una reserva con datos ficticios.
- Mostrar el total y permitir reportar un pago de prueba con un archivo
  sintético.
- Habilitar el panel administrativo para listar reservas y confirmar o
  rechazar únicamente pagos reportados.
- Mantener login administrativo configurado con variables de entorno; no
  incluir credenciales en el código ni en Git.
- Conservar el chat con Foundry, la validación 422 para mensajes inválidos y la
  respuesta 502 genérica ante fallos de Foundry.
- Documentar la demo y sus límites, incluyendo que no debe recibir datos ni
  pagos reales.

Antes del despliegue:

- Confirmar Node 24, las dependencias y `npm start` → `node server.js`.
- Probar salud, consulta, reservas, inventario, reporte de comprobante, acceso
  sin sesión, login, aprobación y rechazo de pago.
- Asegurar que no se guarden datos reales o comprobantes de prueba en Git.

## Desplegador — actualizar el App Service existente

- Publicar solo después de validar la funcionalidad local.
- Mantener la suscripción, región y App Service ya existente; no crear recursos
  ni elevar el SKU sin una autorización separada.
- Configurar el endpoint y agente de Foundry, `NODE_ENV=production` y las
  variables administrativas como App Settings; nunca imprimir sus valores.
- Usar identidad administrada para Foundry.
- Verificar salud, consulta, chat y el flujo de demostración publicado.
- Entregar el enlace, las verificaciones y los límites de persistencia.

La habilitación de pagos reales, datos personales, varios administradores o
uso operativo requiere un diseño aparte con persistencia y almacenamiento
durables y autenticación apropiada.
