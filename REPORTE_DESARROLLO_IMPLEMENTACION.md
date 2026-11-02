# Reporte de desarrollo e implementación

## Asistente de viajes Gatobus

| Dato | Detalle |
|---|---|
| Autor | Carlos Sánchez |
| Fecha del reporte | 1 de noviembre de 2026 |
| Tipo de entrega | Demo funcional para evaluación académica |
| Estado | Implementada y desplegada; no apta para operación con viajeros reales |

## 1. Resumen ejecutivo

Se desarrolló y publicó una demo web para consultar información de un viaje,
conversar con un asistente conectado a Microsoft Foundry, seleccionar asientos,
crear reservas de prueba, reportar pagos demostrativos y revisar esos reportes
desde un panel administrativo protegido.

La aplicación está disponible en
[https://gatobus-asistente-viajes-2026.azurewebsites.net/](https://gatobus-asistente-viajes-2026.azurewebsites.net/).
Se verificaron los endpoints principales, el chat con Foundry y el acceso al
panel. También se probó localmente el flujo de reserva, comprobante de prueba,
aprobación y rechazo.

La demo no procesa dinero. El inventario, las reservas y los archivos se
almacenan en archivos locales, por lo que la solución no garantiza persistencia
duradera. Debe utilizarse exclusivamente con información ficticia y archivos
sintéticos.

## 2. Objetivo y alcance

El objetivo fue entregar una experiencia demostrable que cubriera las
principales interacciones del asistente de viajes:

- Consultar itinerario, precios, asientos y hospedaje.
- Preguntar sobre el viaje mediante el chat con IA.
- Seleccionar asientos disponibles y opciones de habitación.
- Crear una reserva demostrativa y calcular su costo.
- Enviar un reporte de pago ficticio con un comprobante sintético.
- Iniciar sesión en el panel para revisar reservas y confirmar o rechazar
  reportes de pago.

La aplicación muestra un aviso de que las reservas y pagos son demostrativos.
No se deben realizar transferencias ni ingresar datos personales, bancarios o
financieros reales. Para probar comprobantes se deben utilizar archivos de
muestra, como una fotografía de paisaje.

## 3. Arquitectura y tecnologías

### Aplicación

- **Backend:** Node.js 24, Express 5 y módulos ES.
- **Interfaz:** HTML, CSS y JavaScript vanilla; sin frameworks ni bundlers.
- **Datos de demostración:** archivo JSON incluido con un viaje sintético,
  inventario de asientos y opciones de habitaciones.
- **Comprobantes de prueba:** archivos guardados localmente en `uploads/`, ruta
  ignorada por Git.
- **Sesiones administrativas:** `express-session`, cookie `httpOnly` y
  configuración de credenciales mediante variables de entorno.

### Microsoft Foundry

El navegador se comunica exclusivamente con `POST /api/chat`; el servidor
invoca el agente mediante `@azure/ai-projects` 2.x. El identificador
`conversation_id` permite continuar una conversación entre turnos. La
autenticación de Azure se configura con `DefaultAzureCredential` y la identidad
administrada de App Service. Los endpoints y nombres de agente se obtienen de
la configuración del entorno, no del código fuente.

### Flujo general

```text
Navegador
  ├─ consulta viaje y disponibilidad ──> Express ──> JSON de demostración
  ├─ reserva / reporte de pago ─────────> Express ──> JSON y archivo local
  ├─ administración ────────────────────> Express ──> sesión y JSON local
  └─ chat ──────────────────────────────> Express ──> Microsoft Foundry
```

## 4. Implementación funcional

1. **Consulta del viaje:** se muestra un itinerario sintético a Cancún, con
   horarios, costo de transporte, 46 asientos y tres opciones de hospedaje.
2. **Selección de asientos:** los asientos disponibles se pueden seleccionar
   desde la página principal o en la página de reserva; los ya ocupados no se
   pueden elegir.
3. **Reserva:** el backend valida el viaje, los asientos y, si aplica, la
   habitación y los huéspedes. Calcula transporte, hospedaje y total, y actualiza
   la disponibilidad de demostración.
4. **Reporte de pago:** se valida monto, referencia, fecha, formato y tamaño
   máximo de 5 MB del archivo. Se aceptan PDF, JPG y PNG para la demostración.
5. **Administración:** el login se habilita mediante configuración del entorno.
   Sin autenticación, el panel redirige al acceso y el endpoint de reservas
   responde con no autorizado. Las acciones de confirmación o rechazo se
   limitan a pagos reportados.
6. **Chat:** el backend valida los mensajes, conserva la conversación y envía
   al agente la información del viaje. Los errores de Foundry no exponen
   trazas al usuario.

## 5. Seguridad y tratamiento de datos

- La demo utiliza exclusivamente inventario y datos sintéticos.
- Las credenciales y el secreto de sesión administrativos se configuraron como
  App Settings; no se incluyen en este reporte ni en el código.
- La identidad administrada se utiliza para la integración con Foundry.
- El panel requiere autenticación y las acciones administrativas verifican la
  sesión.
- Los comprobantes solo deben ser archivos sintéticos; no se aceptan para
  verificar una transferencia real.
- No se deben agregar `.env`, credenciales, reservas de prueba o comprobantes
  al repositorio.
- Las pruebas locales se limpiaron al finalizar: la base quedó sin reservas ni
  pagos, y no quedaron archivos de comprobante de prueba.

## 6. Pruebas y verificaciones

| Área | Verificación | Resultado |
|---|---|---|
| Calidad básica | Sintaxis de `server.js` y de los scripts JavaScript | Correcta |
| Dependencias | Dependencias instaladas frente a los imports del proyecto | Correctas |
| Datos | `data/database.json` válido y sin reservas ni pagos al finalizar | Correcto |
| Flujo local | Crear reserva de asiento y hospedaje; validar total | Correcto |
| Comprobante local | Enviar una imagen sintética y abrirla desde el panel | Correcto |
| Panel local | Login, lista de reservas, confirmar/rechazar pago y logout | Correcto |
| Inventario local | Confirmar pago ocupa asiento; rechazo devuelve disponibilidad; se rechaza doble reserva | Correcto |
| Interfaz | Selección de asientos y flujo de reserva en navegador a 360 px | Sin desbordamiento horizontal |
| Azure | `GET /health` | HTTP 200, `status: ok` |
| Azure | `GET /api/viajes` | HTTP 200; un viaje, 46 asientos y tres tipos de habitación |
| Azure | Chat con Microsoft Foundry | Respuesta correcta con `conversation_id` |
| Azure | Acceso administrativo con credenciales de `.env` | La usuaria confirmó que el login funciona; no se incluyen las credenciales en este reporte |
| Azure | Panel administrativo en captura de evidencia | Muestra una reserva demostrativa con pago reportado pendiente; no acredita aprobación ni rechazo |

La verificación del ciclo de pago y de sus mutaciones de inventario se realizó
localmente. Las capturas 04, 05 y 07 muestran una reserva demostrativa y un
reporte de pago pendiente en el sitio publicado. Esto no representa una
transferencia real ni acredita que el pago se haya aprobado o rechazado.

## 7. Evidencia visual

Las capturas están en [`evidencias/capturas/`](./evidencias/capturas/). Se
revisó que los ocho archivos estén presentes, que sus referencias apunten a
los nombres correctos y que las capturas 04 y 06 se hayan reemplazado. No
incluyas contraseñas, tokens, datos personales ni comprobantes reales.

| Archivo esperado | Evidencia que debe mostrar | Entorno recomendado |
|---|---|---|
| [01-inicio-y-viaje.png](./evidencias/capturas/01-inicio-y-viaje.png) | Página pública con itinerario, precio, hospedaje y aviso de demostración | Azure |
| [02-disponibilidad-asientos.png](./evidencias/capturas/02-disponibilidad-asientos.png) | Plano con asientos disponibles y uno seleccionado | Azure |
| [03-chat-foundry.png](./evidencias/capturas/03-chat-foundry.png) | Pregunta sobre el viaje y respuesta del asistente | Azure |
| [04-reserva-y-hospedaje.png](./evidencias/capturas/04-reserva-y-hospedaje.png) | Hospedaje para tres personas seleccionado y total demostrativo calculado; no hay asientos seleccionados, por lo que el total corresponde al hospedaje | Azure |
| [05-reporte-pago-demo.png](./evidencias/capturas/05-reporte-pago-demo.png) | Formulario con referencia ficticia y archivo de prueba seleccionado | Azure |
| [06-acceso-administrativo.png](./evidencias/capturas/06-acceso-administrativo.png) | Pantalla de acceso administrativo con los campos de usuario y contraseña vacíos | Azure |
| [07-revision-admin-demo.png](./evidencias/capturas/07-revision-admin-demo.png) | Reserva de prueba con pago reportado pendiente; no demuestra que se haya confirmado o rechazado | Azure |
| [08-salud-publicada.png](./evidencias/capturas/08-salud-publicada.png) | Terminal con solicitud al `/health` publicado y respuesta HTTP 200 `{"status":"ok"}` | Azure |

Las capturas 04, 05 y 07 muestran el hostname de Azure y datos presentados en
la interfaz como ficticios; por ello, el reporte no afirma que no se creó una
reserva demostrativa en producción. La captura 07 muestra un pago pendiente,
pero no una acción de confirmación o rechazo. No realices nuevas pruebas de
reserva o pago en Azure; utiliza el entorno local y datos ficticios para
capturas adicionales.

## 8. Despliegue en Azure

| Recurso o configuración | Valor |
|---|---|
| Aplicación | `gatobus-asistente-viajes-2026` |
| URL | [https://gatobus-asistente-viajes-2026.azurewebsites.net/](https://gatobus-asistente-viajes-2026.azurewebsites.net/) |
| Grupo de recursos | `rggtv26` |
| Región | West US |
| Servicio | Azure App Service para Linux |
| Plan actual | Basic B1 |
| Runtime | Node.js 24 LTS |
| Comando de inicio | `npm start` (`node server.js`) |
| Identidad | Identidad administrada del sistema para Foundry |

Durante el despliegue se identificó que el ZIP creado en Windows contenía
separadores `\` en las rutas. Linux/Oryx los interpretaba como rutas inválidas y
fallaba al copiar los archivos. Se reconstruyó el paquete con separadores `/`;
el build terminó sin errores y la app respondió correctamente.

### Estimación de costo

Se inició con el plan F1 gratuito. Azure dejó la aplicación en estado
`QuotaExceeded`, deshabilitando el sitio y Kudu. Como contingencia previamente
autorizada, se escaló el plan existente a B1, sin crear recursos adicionales.

- Precio de referencia previamente consultado para Linux B1 en West US:
  **USD 0.018 por hora**.
- Estimado a 730 horas: **aproximadamente USD 13.14 al mes**, más impuestos.
- El importe real puede variar; el plan genera costo mientras permanezca en B1.
- El consumo variable del modelo de Foundry no está incluido en la cifra del
  App Service.

## 9. Limitaciones y trabajo futuro

La demo cubre el flujo funcional de evaluación, pero **no está terminada para
uso operativo**:

- Las reservas se guardan en JSON local, no en una base de datos compartida.
- Los comprobantes se guardan en el almacenamiento local de la instancia, no
  en almacenamiento de objetos durable.
- Reinicios, nuevas publicaciones o cambios de instancia pueden afectar los
  datos locales; no se garantiza conservar reservas ni comprobantes.
- La gestión de sesiones utiliza almacenamiento en memoria del proceso, por lo
  que no está preparada para múltiples instancias.
- No hay integración con bancos, pasarelas de pago ni validación financiera:
  los estados de pago solo demuestran el flujo de interfaz y administración.
- La autenticación administrativa es básica y no incorpora identidad
  empresarial, gestión multiusuario ni controles propios de producción.

Para operar con usuarios reales se requiere diseñar y aprobar una arquitectura
separada que incluya base de datos persistente, almacenamiento durable de
comprobantes, autenticación administrativa apropiada, controles de privacidad,
pruebas de concurrencia, monitorización y una integración de pagos autorizada.

## 10. Archivos principales

- [`server.js`](./server.js): servidor Express, Foundry, reservas, pagos y
  administración.
- [`public/index.html`](./public/index.html): consulta del viaje y selección
  inicial de asientos.
- [`public/reserva.html`](./public/reserva.html): reserva y reporte de pago
  demostrativo.
- [`public/admin-login.html`](./public/admin-login.html) y
  [`public/admin.html`](./public/admin.html): acceso y panel de administración.
- [`data/database.json`](./data/database.json): viaje e inventario sintéticos.
- [`README.md`](./README.md): instrucciones para desarrollo y ejecución.

## 11. Conclusión

El resultado es una demo publicada y funcional para evaluación de los flujos
principales de consulta, chat, reservas, reportes ficticios y revisión
administrativa. La implementación no procesa pagos reales y no debe utilizarse
con información personal ni para operar viajes. El uso del plan B1 tiene el
costo estimado indicado mientras permanezca activo.
