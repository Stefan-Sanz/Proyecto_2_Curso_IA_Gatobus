import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import express from "express";
import session from "express-session";
import { AIProjectClient } from "@azure/ai-projects";
import { DefaultAzureCredential } from "@azure/identity";

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(import.meta.dirname, "public");
const DATABASE_FILE = path.join(import.meta.dirname, "data", "database.json");

const UPLOADS_DIR = path.join(
  import.meta.dirname,
  "uploads",
  "comprobantes"
);

const app = express();

const configuredAdminSessionSecret =
  process.env.ADMIN_SESSION_SECRET;
const adminSessionSecret =
  configuredAdminSessionSecret ||
  crypto.randomBytes(32).toString("hex");
const adminLoginConfigured = Boolean(
  process.env.ADMIN_USERNAME &&
  process.env.ADMIN_PASSWORD &&
  configuredAdminSessionSecret &&
  Buffer.byteLength(configuredAdminSessionSecret, "utf8") >= 32
);

if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

app.use(express.json({ limit: "8mb" }));
app.use(session({
  name: "asistente.sid",
  secret: adminSessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: "auto"
  }
}));

const projectEndpoint = process.env.FOUNDRY_PROJECT_ENDPOINT;
const agentName = process.env.FOUNDRY_AGENT_NAME;
const projectClient = projectEndpoint
  ? new AIProjectClient(projectEndpoint, new DefaultAzureCredential())
  : null;
const openai = projectClient?.getOpenAIClient();

const TAMANO_MAXIMO_COMPROBANTE =
  5 * 1024 * 1024;

const TIPOS_COMPROBANTE_PERMITIDOS = [
  "application/pdf",
  "image/jpeg",
  "image/png"
];

function obtenerExtension(tipoArchivo) {
  const extensiones = {
    "application/pdf": ".pdf",
    "image/jpeg": ".jpg",
    "image/png": ".png"
  };

  return extensiones[tipoArchivo] || "";
}

function leerBaseDatos() {
  const contenido = fs.readFileSync(
    DATABASE_FILE,
    "utf-8"
  );

  return JSON.parse(contenido);
}

function guardarBaseDatos(database) {
  fs.writeFileSync(
    DATABASE_FILE,
    JSON.stringify(database, null, 2),
    "utf-8"
  );
}

function enviarJson(response, statusCode, data) {
  response.status(statusCode).json(data);
}

function generarId() {
  return `reserva-${crypto.randomUUID()}`;
}

function validarReserva(datos, viaje) {
  const errores = [];

  if (!datos.nombreTitular ||
      datos.nombreTitular.trim().length < 3) {
    errores.push("El nombre del titular es obligatorio.");
  }

  if (!datos.telefono ||
      datos.telefono.trim().length < 7) {
    errores.push("El teléfono es obligatorio.");
  }

  if (!Array.isArray(datos.asientos) ||
      datos.asientos.length === 0) {
    errores.push("Debes seleccionar al menos un asiento.");
  }

  if (Array.isArray(datos.asientos)) {
    const asientosRepetidos =
      new Set(datos.asientos.map(Number)).size !== datos.asientos.length;

    if (asientosRepetidos) {
      errores.push(
        "No puedes seleccionar un asiento más de una vez."
      );
    }

    const asientosExistentes =
      viaje.autobus.asientos.map(
        (asiento) => asiento.numero
      );

    for (const numero of datos.asientos) {
      if (!asientosExistentes.includes(Number(numero))) {
        errores.push(`El asiento ${numero} no existe.`);
      }
    }
  }

  if (datos.incluyeHospedaje) {
    if (!datos.habitacionId) {
      errores.push(
        "Debes seleccionar una habitación."
      );
    }

    if (!Array.isArray(datos.huespedes) ||
        datos.huespedes.length === 0) {
      errores.push(
        "Debes registrar al menos un huésped."
      );
    } else if (
      datos.huespedes.some(
        (huesped) =>
          typeof huesped !== "string" ||
          huesped.trim().length === 0
      )
    ) {
      errores.push(
        "Todos los huéspedes deben tener un nombre."
      );
    }

    const habitacion =
      viaje.hospedaje.habitaciones.find(
        (item) => item.id === datos.habitacionId
      );

    if (!habitacion) {
      errores.push(
        "La habitación seleccionada no existe."
      );
    }
  }

  return errores;
}

function crearReserva(datos, response) {
  const database = leerBaseDatos();

  const viaje = database.viajes.find(
    (item) => item.id === datos.viajeId
  );

  if (!viaje) {
    enviarJson(response, 404, {
      error: "El viaje no existe."
    });

    return;
  }

  const errores = validarReserva(datos, viaje);

  if (errores.length > 0) {
    enviarJson(response, 400, {
      error: "La reserva contiene errores.",
      detalles: errores
    });

    return;
  }

  const numerosAsientos =
    datos.asientos.map(Number);

  const asientosNoDisponibles =
    viaje.autobus.asientos.filter((asiento) => {
      return (
        numerosAsientos.includes(asiento.numero) &&
        asiento.estado !== "disponible"
      );
    });

  if (asientosNoDisponibles.length > 0) {
    enviarJson(response, 409, {
      error: "Uno o más asientos ya no están disponibles.",
      asientos: asientosNoDisponibles.map(
        (asiento) => asiento.numero
      )
    });

    return;
  }

  let habitacion = null;
  let cantidadHabitaciones = 0;

  if (datos.incluyeHospedaje) {
    habitacion =
      viaje.hospedaje.habitaciones.find(
        (item) => item.id === datos.habitacionId
      );

    cantidadHabitaciones = habitacion
      ? Math.ceil(datos.huespedes.length / habitacion.tipo)
      : 0;

    if (
      !habitacion ||
      habitacion.cantidadDisponible < cantidadHabitaciones
    ) {
      enviarJson(response, 409, {
        error:
          "No hay suficientes habitaciones disponibles para todos los huéspedes."
      });

      return;
    }
  }

  const cantidadAsientos =
    numerosAsientos.length;

  const huespedes =
    datos.incluyeHospedaje
      ? datos.huespedes.map((huesped) => huesped.trim())
      : [];

  const costoTransporte =
    cantidadAsientos * viaje.precioTransporte;

  const cantidadHuespedes =
    huespedes.length;

  const costoHospedaje =
    datos.incluyeHospedaje && habitacion
      ? cantidadHuespedes * habitacion.precioPorPersona
      : 0;

  const reserva = {
    id: generarId(),
    viajeId: viaje.id,
    nombreTitular: datos.nombreTitular.trim(),
    telefono: datos.telefono.trim(),
    correo: datos.correo
      ? datos.correo.trim()
      : "",
    asientos: numerosAsientos,
    incluyeHospedaje:
      Boolean(datos.incluyeHospedaje),
    habitacionId:
      datos.incluyeHospedaje
        ? datos.habitacionId
        : null,
    cantidadHabitaciones,
    huespedes,
    costos: {
      transporte: costoTransporte,
      hospedaje: costoHospedaje,
      total: costoTransporte + costoHospedaje
    },
    estado: "pendiente_pago",
    fechaCreacion: new Date().toISOString()
  };

  for (const asiento of viaje.autobus.asientos) {
    if (numerosAsientos.includes(asiento.numero)) {
      asiento.estado = "apartado";
    }
  }

  if (habitacion) {
    habitacion.cantidadDisponible -= cantidadHabitaciones;
  }

  database.reservas.push(reserva);
  guardarBaseDatos(database);

  enviarJson(response, 201, {
    mensaje: "Reserva creada correctamente.",
    reserva
  });
}

function obtenerReservas(response) {
  const database = leerBaseDatos();

  const reservas = database.reservas.map((reserva) => {
    const viaje = database.viajes.find(
      (item) => item.id === reserva.viajeId
    );

    let habitacion = null;

    if (
      viaje &&
      reserva.habitacionId &&
      viaje.hospedaje
    ) {
      habitacion =
        viaje.hospedaje.habitaciones.find(
          (item) => item.id === reserva.habitacionId
        );
    }

    return {
      ...reserva,
      viaje: viaje
        ? {
            nombre: viaje.nombre,
            origen: viaje.origen,
            destino: viaje.destino,
            fechaSalida: viaje.fechaSalida
          }
        : null,
      habitacion
    };
  });

  enviarJson(response, 200, {
    reservas
  });
}

function actualizarEstadoPago(
  reservaId,
  nuevoEstado,
  response
) {
  const database = leerBaseDatos();

  const reserva = database.reservas.find(
    (item) => item.id === reservaId
  );

  if (!reserva) {
    enviarJson(response, 404, {
      error: "La reserva no existe."
    });

    return;
  }

  const viaje = database.viajes.find(
    (item) => item.id === reserva.viajeId
  );

  if (!viaje) {
    enviarJson(response, 404, {
      error: "El viaje relacionado no existe."
    });

    return;
  }

  if (
    reserva.estado !== "comprobante_enviado" ||
    reserva.pago?.estado !== "reportado"
  ) {
    enviarJson(response, 409, {
      error: "Solo se pueden revisar pagos reportados."
    });

    return;
  }

  reserva.pago.estado = nuevoEstado;
  reserva.pago.fechaConfirmacion =
    nuevoEstado === "confirmado"
      ? new Date().toISOString()
      : null;

  if (nuevoEstado === "confirmado") {
    reserva.estado = "pago_confirmado";

    for (const asiento of viaje.autobus.asientos) {
      if (reserva.asientos.includes(asiento.numero)) {
        asiento.estado = "pagado";
      }
    }
  }

  if (nuevoEstado === "rechazado") {
    reserva.estado = "pago_rechazado";

    for (const asiento of viaje.autobus.asientos) {
      if (reserva.asientos.includes(asiento.numero)) {
        asiento.estado = "disponible";
      }
    }

    if (reserva.habitacionId) {
      const habitacion =
        viaje.hospedaje.habitaciones.find(
          (item) => item.id === reserva.habitacionId
        );

      if (habitacion) {
        habitacion.cantidadDisponible +=
          reserva.cantidadHabitaciones ?? 1;
      }
    }
  }

  guardarBaseDatos(database);

  enviarJson(response, 200, {
    mensaje: "Estado del pago actualizado.",
    reserva
  });
}

function reportarPago(
  reservaId,
  datos,
  response
) {
  const database = leerBaseDatos();

  const reserva = database.reservas.find(
    (item) => item.id === reservaId
  );

  if (!reserva) {
    enviarJson(response, 404, {
      error: "La reserva no existe."
    });

    return;
  }

  if (reserva.estado === "pago_confirmado") {
    enviarJson(response, 409, {
      error: "Esta reserva ya tiene el pago confirmado."
    });

    return;
  }

  if (reserva.estado === "pago_rechazado") {
    enviarJson(response, 409, {
      error: "La reserva fue rechazada. Crea una nueva para volver a intentarlo."
    });

    return;
  }

  const monto = Number(datos.monto);
  const referencia = String(
    datos.referencia || ""
  ).trim();
  const fechaTransferencia = String(
    datos.fechaTransferencia || ""
  ).trim();

  if (!Number.isFinite(monto) || monto <= 0) {
    enviarJson(response, 400, {
      error: "El monto de la transferencia no es válido."
    });

    return;
  }

  if (monto !== reserva.costos.total) {
    enviarJson(response, 400, {
      error:
        "El monto reportado no coincide con el total de la reserva.",
      totalReserva: reserva.costos.total
    });

    return;
  }

  if (!referencia) {
    enviarJson(response, 400, {
      error: "La referencia de transferencia es obligatoria."
    });

    return;
  }

  if (!fechaTransferencia) {
    enviarJson(response, 400, {
      error:
        "La fecha de transferencia es obligatoria."
    });

    return;
  }

  if (!datos.comprobante || typeof datos.comprobante !== "object") {
    enviarJson(response, 400, {
      error: "Debes adjuntar el comprobante de transferencia."
    });

    return;
  }

  const tipoArchivo = String(datos.comprobante.tipo || "");
  const nombreOriginal = String(
    datos.comprobante.nombre || "comprobante"
  );
  const contenidoBase64 = String(
    datos.comprobante.contenidoBase64 || ""
  );

  if (!TIPOS_COMPROBANTE_PERMITIDOS.includes(tipoArchivo)) {
    enviarJson(response, 400, {
      error: "El comprobante debe ser PDF, JPG, JPEG o PNG."
    });

    return;
  }

  const indiceRelleno = contenidoBase64.indexOf("=");
  const cantidadRelleno =
    contenidoBase64.endsWith("==")
      ? 2
      : contenidoBase64.endsWith("=")
        ? 1
        : 0;
  const rellenoValido =
    indiceRelleno === -1 ||
    indiceRelleno === contenidoBase64.length - cantidadRelleno;

  if (
    !contenidoBase64 ||
    contenidoBase64.length % 4 !== 0 ||
    /[^A-Za-z0-9+/=]/.test(contenidoBase64) ||
    !rellenoValido
  ) {
    enviarJson(response, 400, {
      error: "El archivo del comprobante está vacío o no es válido."
    });

    return;
  }

  const archivoBuffer = Buffer.from(contenidoBase64, "base64");

  if (archivoBuffer.length === 0) {
    enviarJson(response, 400, {
      error: "El archivo del comprobante está vacío o no es válido."
    });

    return;
  }

  if (archivoBuffer.length > TAMANO_MAXIMO_COMPROBANTE) {
    enviarJson(response, 400, {
      error: "El comprobante no puede superar los 5 MB."
    });

    return;
  }

  const nombreSeguro = path.basename(nombreOriginal)
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/\.[^/.]+$/, "");
  const extension = obtenerExtension(tipoArchivo);
  const nombreArchivo =
    `${reservaId}-${Date.now()}-${nombreSeguro}${extension}`;
  const rutaArchivo = path.join(UPLOADS_DIR, nombreArchivo);

  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  fs.writeFileSync(rutaArchivo, archivoBuffer);

  const comprobante = {
    nombreOriginal,
    nombreArchivo,
    tipo: tipoArchivo,
    tamano: archivoBuffer.length,
    fechaCarga: new Date().toISOString()
  };

  reserva.pago = {
    estado: "reportado",
    monto,
    referencia,
    fechaReporte: new Date().toISOString(),
    fechaTransferencia,
    fechaConfirmacion: null,
    comentarios: "",
    comprobante
  };

  reserva.estado = "comprobante_enviado";

  guardarBaseDatos(database);

  enviarJson(response, 200, {
    mensaje:
      "El pago fue reportado y quedó pendiente de revisión.",
    reserva
  });
}

function obtenerContextoViaje() {
  const database = leerBaseDatos();

  return database.viajes.map((viaje) => ({
    nombre: viaje.nombre,
    origen: viaje.origen,
    destino: viaje.destino,
    fechaSalida: viaje.fechaSalida,
    horaSalida: viaje.horaSalida,
    fechaRegreso: viaje.fechaRegreso,
    horaRegreso: viaje.horaRegreso,
    precioTransporte: viaje.precioTransporte,
    hotel: viaje.hospedaje.hotel,
    habitaciones: viaje.hospedaje.habitaciones.map((habitacion) => ({
      capacidad: habitacion.tipo,
      precioPorPersona: habitacion.precioPorPersona,
      disponibles: habitacion.cantidadDisponible
    })),
    asientos: viaje.autobus.asientos.map((asiento) => ({
      numero: asiento.numero,
      estado: asiento.estado
    }))
  }));
}

function sonIgualesDeFormaSegura(valor, esperado) {
  const valorBuffer = Buffer.from(String(valor));
  const esperadoBuffer = Buffer.from(String(esperado));

  return (
    valorBuffer.length === esperadoBuffer.length &&
    crypto.timingSafeEqual(valorBuffer, esperadoBuffer)
  );
}

function requerirAdministrador(request, response, next) {
  if (!adminLoginConfigured) {
    response.status(503).json({
      error: "El acceso administrativo no está configurado."
    });
    return;
  }

  if (!request.session.esAdministrador) {
    response.status(401).json({
      error: "Debes iniciar sesión como administrador."
    });
    return;
  }

  next();
}

app.get(["/health", "/heatlh"], (request, response) => {
  response.json({ status: "ok" });
});

app.post("/api/admin/login", (request, response, next) => {
  if (!adminLoginConfigured) {
    response.status(503).json({
      error: "El acceso administrativo no está configurado."
    });
    return;
  }

  const { username, password } = request.body || {};
  const usernameMatches = sonIgualesDeFormaSegura(
    username || "",
    process.env.ADMIN_USERNAME
  );
  const passwordMatches = sonIgualesDeFormaSegura(
    password || "",
    process.env.ADMIN_PASSWORD
  );

  if (!usernameMatches || !passwordMatches) {
    response.status(401).json({
      error: "Usuario o contraseña incorrectos."
    });
    return;
  }

  request.session.regenerate((error) => {
    if (error) {
      next(error);
      return;
    }

    request.session.esAdministrador = true;
    request.session.save((saveError) => {
      if (saveError) {
        next(saveError);
        return;
      }

      response.json({ authenticated: true });
    });
  });
});

app.post("/api/admin/logout", (request, response, next) => {
  request.session.destroy((error) => {
    if (error) {
      next(error);
      return;
    }

    response.clearCookie("asistente.sid", {
      httpOnly: true,
      sameSite: "lax",
      secure: "auto"
    });
    response.status(204).end();
  });
});

app.get("/admin.html", (request, response) => {
  if (!adminLoginConfigured) {
    response.status(503).send(
      "El acceso administrativo no está configurado."
    );
    return;
  }

  if (!request.session.esAdministrador) {
    response.redirect("/admin-login.html");
    return;
  }

  response.sendFile(path.join(PUBLIC_DIR, "admin.html"));
});

app.get("/api/viajes", (request, response) => {
  try {
    const database = leerBaseDatos();
    const viajes = database.viajes.map((viaje) => ({
      id: viaje.id,
      nombre: viaje.nombre,
      descripcion: viaje.descripcion,
      origen: viaje.origen,
      destino: viaje.destino,
      fechaSalida: viaje.fechaSalida,
      horaSalida: viaje.horaSalida,
      fechaRegreso: viaje.fechaRegreso,
      horaRegreso: viaje.horaRegreso,
      precioTransporte: viaje.precioTransporte,
      autobus: {
        asientos: viaje.autobus.asientos.map((asiento) => ({
          numero: asiento.numero,
          fila: asiento.fila,
          columna: asiento.columna,
          estado: asiento.estado
        }))
      },
      hospedaje: {
        hotel: viaje.hospedaje.hotel,
        direccion: viaje.hospedaje.direccion,
        habitaciones: viaje.hospedaje.habitaciones.map((habitacion) => ({
          id: habitacion.id,
          tipo: habitacion.tipo,
          precioPorPersona: habitacion.precioPorPersona,
          cantidadDisponible: habitacion.cantidadDisponible
        }))
      }
    }));

    response.json({ viajes });
  } catch (error) {
    console.error("No fue posible leer los viajes:", error);
    response.status(500).json({
      error: "No fue posible leer la información de los viajes."
    });
  }
});

app.get("/api/reservas", requerirAdministrador, (request, response) => {
  try {
    obtenerReservas(response);
  } catch (error) {
    console.error("No fue posible obtener las reservas:", error);
    response.status(500).json({
      error: "No fue posible obtener las reservas."
    });
  }
});

app.put(
  "/api/reservas/:reservaId/:accion",
  requerirAdministrador,
  (request, response) => {
    const { reservaId, accion } = request.params;

    if (!["confirmar-pago", "rechazar-pago"].includes(accion)) {
      response.status(404).json({
        error: "La ruta de API no existe."
      });
      return;
    }

    const nuevoEstado =
      accion === "confirmar-pago" ? "confirmado" : "rechazado";

    actualizarEstadoPago(reservaId, nuevoEstado, response);
  }
);

app.post("/api/reservas", (request, response) => {
  try {
    crearReserva(request.body || {}, response);
  } catch (error) {
    console.error("No fue posible crear la reserva:", error);
    response.status(error.statusCode || 400).json({
      error: error.message
    });
  }
});

app.post("/api/reservas/:reservaId/reportar-pago", (request, response) => {
  try {
    reportarPago(request.params.reservaId, request.body || {}, response);
  } catch (error) {
    console.error("No fue posible reportar el pago:", error);
    response.status(error.statusCode || 400).json({
      error: error.message
    });
  }
});

app.get(
  "/api/reservas/:reservaId/comprobante",
  requerirAdministrador,
  (request, response) => {
    const database = leerBaseDatos();
    const reserva = database.reservas.find(
      (item) => item.id === request.params.reservaId
    );

    if (!reserva) {
      response.status(404).json({
        error: "La reserva no existe."
      });
      return;
    }

    if (!reserva.pago?.comprobante) {
      response.status(404).json({
        error: "La reserva no tiene comprobante."
      });
      return;
    }

    response
      .type(reserva.pago.comprobante.tipo)
      .sendFile(
        path.basename(reserva.pago.comprobante.nombreArchivo),
        { root: UPLOADS_DIR },
        (error) => {
          if (error && !response.headersSent) {
            console.error("No fue posible leer el comprobante:", error);
            response.status(404).json({
              error: "No fue posible leer el comprobante."
            });
          }
        }
      );
  }
);

app.post("/api/chat", async (request, response) => {
  const message = request.body?.message;
  const conversationId = request.body?.conversation_id;

  if (
    typeof message !== "string" ||
    message.length < 1 ||
    message.length > 2000 ||
    message.trim().length === 0
  ) {
    response.status(422).json({
      error: "El mensaje debe contener entre 1 y 2000 caracteres."
    });
    return;
  }

  if (
    conversationId !== undefined &&
    (typeof conversationId !== "string" || conversationId.length > 256)
  ) {
    response.status(422).json({
      error: "El identificador de conversación no es válido."
    });
    return;
  }

  if (!openai || !agentName) {
    console.error("La integración de Foundry no está configurada.");
    response.status(502).json({
      error: "No fue posible responder en este momento."
    });
    return;
  }

  try {
    const conversation = conversationId
      ? { id: conversationId }
      : await openai.conversations.create();
    const input = [
      "Datos actuales del viaje (fuente del servidor):",
      JSON.stringify(obtenerContextoViaje()),
      "",
      "Pregunta del usuario:",
      message.trim()
    ].join("\n");
    const agentReference = {
      body: {
        agent_reference: {
          name: agentName,
          type: "agent_reference"
        }
      }
    };
    const result = await openai.responses.create(
      {
        conversation: conversation.id,
        input
      },
      agentReference
    );

    if (typeof result.output_text !== "string" || !result.output_text) {
      throw new Error("Foundry no devolvió una respuesta textual.");
    }

    response.json({
      reply: result.output_text,
      conversation_id: conversation.id
    });
  } catch (error) {
    console.error("Falló la solicitud a Foundry:", error);
    response.status(502).json({
      error: "No fue posible responder en este momento."
    });
  }
});

app.use(express.static(PUBLIC_DIR));

app.use((error, request, response, next) => {
  if (response.headersSent) {
    next(error);
    return;
  }

  if (error.type === "entity.too.large") {
    response.status(413).json({
      error: "La solicitud supera el tamaño máximo permitido."
    });
    return;
  }

  if (error instanceof SyntaxError && "body" in error) {
    response.status(400).json({
      error: "El cuerpo no contiene JSON válido."
    });
    return;
  }

  console.error("Error inesperado del servidor:", error);
  response.status(500).json({
    error: "Ocurrió un error interno."
  });
});

app.listen(PORT, () => {
  if (!projectEndpoint || !agentName) {
    console.warn(
      "Configura FOUNDRY_PROJECT_ENDPOINT y FOUNDRY_AGENT_NAME para habilitar el chat."
    );
  }

  console.log(`Servidor iniciado en http://localhost:${PORT}`);
});