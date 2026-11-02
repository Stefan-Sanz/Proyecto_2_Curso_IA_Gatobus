# Asistente de viajes

Demo de evaluación construida con Express 5, HTML, CSS y JavaScript. Incluye
consulta de viajes, selección de asientos, reservas, reporte de pago con
comprobante de prueba, revisión administrativa y chat conectado a Microsoft
Foundry.

## Funcionalidad demostrativa

- Consulta del itinerario, tarifas, disponibilidad de asientos y hospedaje.
- Reserva de uno o más asientos y habitaciones con cálculo del total.
- Reporte de pago ficticio con una referencia de prueba y un archivo de muestra.
- Acceso administrativo protegido para revisar reservas y confirmar o rechazar
  reportes de pago.
- Chat multi-turno con el agente de Foundry a través del backend.
- `GET /health` y `GET /api/viajes`.

**No se procesan pagos reales.** No realices transferencias ni ingreses datos
personales, financieros o bancarios reales. Para probar la carga de archivos,
usa material sintético, por ejemplo una fotografía de paisaje. Las reservas,
los pagos y los comprobantes solo existen para demostrar el flujo.

El inventario y las reservas se guardan en `data/database.json`; los
comprobantes se guardan en `uploads/`, que `.gitignore` excluye del repositorio.
Esta persistencia local está pensada para evaluación con una instancia, no para
operar una agencia ni manejar datos reales. Una nueva publicación puede
restablecer los datos de demostración.

## Requisitos y ejecución local

- Node.js 24 o posterior.
- Un proyecto de Microsoft Foundry y permisos para la identidad que ejecuta la
  aplicación.

1. Instala dependencias con `npm install`.
2. Copia `.env.example` a `.env` y completa la configuración.
3. Inicia sesión en Azure CLI (`az login`) para que
   `DefaultAzureCredential` pueda autenticarse.
4. Ejecuta `npm run dev` y abre `http://localhost:3000`.
5. Comprueba `http://localhost:3000/health`; debe responder
   `{ "status": "ok" }`.

`npm run dev` carga `.env` y reinicia el servidor al detectar cambios.
`npm start` ejecuta `node server.js` y usa las variables del entorno, como en
Azure App Service.

### Variables runtime

- `FOUNDRY_PROJECT_ENDPOINT`: endpoint del proyecto Foundry.
- `FOUNDRY_AGENT_NAME`: nombre del agente prompt.
- `ADMIN_USERNAME` y `ADMIN_PASSWORD`: credenciales de demostración del panel.
- `ADMIN_SESSION_SECRET`: secreto aleatorio de al menos 32 caracteres para las
  sesiones administrativas.
- `PORT`: opcional localmente; Azure App Service proporciona este valor.

Sin las tres variables administrativas, el panel no habilita el inicio de
sesión. No uses credenciales de producción ni agregues `.env`, reservas o
comprobantes al repositorio. En Azure, configura Foundry con identidad
administrada, no con API keys.

## Chat

El navegador envía preguntas a `POST /api/chat`; nunca se conecta directamente
a Foundry. El servidor valida mensajes de 1 a 2000 caracteres, conserva
`conversation_id` entre turnos y comparte con el agente la información del
viaje. Las entradas no válidas reciben HTTP 422 y los errores de Foundry un
HTTP 502 genérico.

## Límites

La demo usa un archivo JSON y almacenamiento local de comprobantes; no incluye
base de datos compartida, almacenamiento durable de archivos ni autenticación
empresarial. No es apta para transacciones ni operación con viajeros reales.
