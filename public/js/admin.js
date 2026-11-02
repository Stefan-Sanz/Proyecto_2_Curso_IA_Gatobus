document.addEventListener("DOMContentLoaded", () => {
  document
    .querySelector("#cerrar-sesion-admin")
    .addEventListener("click", cerrarSesion);
  cargarReservas();
});

async function cargarReservas() {
  const estado = document.querySelector("#estado-admin");
  const lista = document.querySelector("#lista-reservas");

  try {
    const respuesta = await fetch("/api/reservas");

    if (respuesta.status === 401) {
      window.location.assign("/admin-login.html");
      return;
    }

    const datos = await leerRespuestaJson(respuesta);

    if (!respuesta.ok) {
      throw new Error(
        datos.error || "No fue posible cargar las reservas."
      );
    }

    if (!datos.reservas || datos.reservas.length === 0) {
      estado.textContent = "No hay reservas registradas.";
      lista.innerHTML = "";
      return;
    }

    estado.textContent =
      `Se encontraron ${datos.reservas.length} reserva(s).`;

    lista.innerHTML = "";

    for (const reserva of datos.reservas) {
      lista.appendChild(crearTarjetaReserva(reserva));
    }
  } catch (error) {
    estado.textContent = error.message;
    estado.classList.add("error");

    console.error(error);
  }
}

function crearTarjetaReserva(reserva) {
  const tarjeta = document.createElement("article");

  tarjeta.className = "reserva-admin";

  const estadoPago =
  reserva.pago?.estado || "pendiente";

const referenciaPago =
  reserva.pago?.referencia || "No reportada";

const fechaTransferencia =
  reserva.pago?.fechaTransferencia || "No reportada";

const comprobanteHtml =
  reserva.pago?.comprobante
    ? `
      <p>
        <strong>Comprobante:</strong>
        <a
          href="/api/reservas/${escaparHtml(reserva.id)}/comprobante"
          target="_blank"
          rel="noopener"
        >
          Ver comprobante
        </a>
      </p>
    `
    : `
      <p>
        <strong>Comprobante:</strong>
        No adjunto
      </p>
    `;
  const accionesPagoHtml =
    estadoPago === "reportado"
    ? `
      <div class="acciones-reserva">
        <button
          type="button"
          class="boton confirmar"
          data-accion="confirmar"
          data-id="${escaparHtml(reserva.id)}"
        >
          Confirmar pago de prueba
        </button>

        <button
          type="button"
          class="boton rechazar"
          data-accion="rechazar"
          data-id="${escaparHtml(reserva.id)}"
        >
          Rechazar pago de prueba
        </button>
      </div>
    `
    : "";

  const textoEstado =
    obtenerTextoEstado(reserva.estado, estadoPago);

  const claseEstado =
    obtenerClaseEstado(reserva.estado, estadoPago);

  const nombresHuespedes =
    reserva.huespedes?.length
      ? reserva.huespedes.join(", ")
      : "No incluye hospedaje";
  const cantidadHabitaciones =
    reserva.habitacionId
      ? reserva.cantidadHabitaciones || 1
      : 0;
  const descripcionHabitaciones =
    cantidadHabitaciones > 0
      ? `${cantidadHabitaciones} habitación(es) para ${reserva.habitacion?.tipo || "tipo no disponible"} personas`
      : "No incluye hospedaje";
  const pagoReportado =
    estadoPago === "reportado"
      ? `
        <p><strong>Monto reportado:</strong> <span data-pago="monto"></span></p>
      `
      : "";

  tarjeta.innerHTML = `
    <div class="reserva-admin-cabecera">
      <h3>Reserva ${escaparHtml(reserva.id)}</h3>
      <span class="estado-reserva ${claseEstado}">
        ${textoEstado}
      </span>
    </div>

    <div class="reserva-admin-contenido">
      <p>
        <strong>Titular:</strong>
        ${escaparHtml(reserva.nombreTitular)}
      </p>

      <p>
        <strong>Teléfono:</strong>
        ${escaparHtml(reserva.telefono)}
      </p>

      <p>
        <strong>Correo:</strong>
        ${escaparHtml(reserva.correo || "No registrado")}
      </p>

      <p>
        <strong>Viaje:</strong>
        ${escaparHtml(reserva.viaje?.nombre || "No disponible")}
      </p>

      <p>
        <strong>Asientos:</strong>
        ${escaparHtml(reserva.asientos.join(", "))}
      </p>

      <p>
        <strong>Habitaciones:</strong>
        ${escaparHtml(descripcionHabitaciones)}
      </p>

      <p>
        <strong>Huéspedes:</strong>
        ${escaparHtml(nombresHuespedes)}
      </p>

      <p>
        <strong>Transporte:</strong>
        ${formatearMoneda(reserva.costos.transporte)}
      </p>

      <p>
        <strong>Hospedaje:</strong>
        ${formatearMoneda(reserva.costos.hospedaje)}
      </p>

      <p class="total-admin">
        <strong>Total:</strong>
        ${formatearMoneda(reserva.costos.total)}
      </p>

      <p>
        <strong>Estado del pago:</strong>
        ${escaparHtml(estadoPago)}
      </p>

      <p>
        <strong>Referencia:</strong>
        ${escaparHtml(referenciaPago)}
      </p>

      <p>
        <strong>Fecha de transferencia:</strong>
        ${escaparHtml(fechaTransferencia)}
      </p>

      ${comprobanteHtml}

      ${pagoReportado}
    </div>

    ${accionesPagoHtml}
  `;

  if (estadoPago === "reportado") {
    tarjeta.querySelector('[data-pago="monto"]').textContent =
      formatearMoneda(reserva.pago.monto);
  }

  const botones =
    tarjeta.querySelectorAll("button");

  botones.forEach((boton) => {
    boton.addEventListener("click", () => {
      cambiarEstadoPago(
        boton.dataset.id,
        boton.dataset.accion
      );
    });
  });

  return tarjeta;
}

async function cambiarEstadoPago(
  reservaId,
  accion
) {
  const mensaje =
    accion === "confirmar"
      ? "¿Confirmar este pago?"
      : "¿Rechazar este pago?";

  if (!confirm(mensaje)) {
    return;
  }

  const ruta =
    accion === "confirmar"
      ? `/api/reservas/${reservaId}/confirmar-pago`
      : `/api/reservas/${reservaId}/rechazar-pago`;

  try {
    const respuesta = await fetch(ruta, {
      method: "PUT"
    });

    const datos = await leerRespuestaJson(respuesta);

    if (!respuesta.ok) {
      throw new Error(
        datos.error ||
        "No fue posible actualizar el pago."
      );
    }

    alert(datos.mensaje);

    await cargarReservas();
  } catch (error) {
    alert(error.message);
    console.error(error);
  }
}

async function cerrarSesion() {
  try {
    const respuesta = await fetch("/api/admin/logout", {
      method: "POST"
    });

    if (!respuesta.ok) {
      throw new Error("No fue posible cerrar la sesión.");
    }

    window.location.assign("/admin-login.html");
  } catch (error) {
    alert(error.message);
    console.error(error);
  }
}

async function leerRespuestaJson(respuesta) {
  const contenido = await respuesta.text();

  try {
    return JSON.parse(contenido);
  } catch {
    throw new Error(
      contenido ||
      `El servidor respondió con un formato inválido (HTTP ${respuesta.status}).`
    );
  }
}

function obtenerTextoEstado(
  estadoReserva,
  estadoPago
) {
  if (
    estadoReserva === "comprobante_enviado" ||
    estadoPago === "reportado"
  ) {
    return "Pago reportado, pendiente de revisión";
  }

  if (estadoReserva === "pago_confirmado") {
    return "Pago confirmado";
  }

  if (estadoReserva === "pago_rechazado") {
    return "Pago rechazado";
  }

  if (estadoPago === "confirmado") {
    return "Pago confirmado";
  }

  return "Pendiente de pago";
}

function obtenerClaseEstado(
  estadoReserva,
  estadoPago
) {
  if (estadoReserva === "pago_confirmado") {
    return "confirmado";
  }

  if (estadoReserva === "pago_rechazado") {
    return "rechazado";
  }

  if (estadoPago === "confirmado") {
    return "confirmado";
  }

  return "pendiente";
}

function formatearMoneda(valor) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN"
  }).format(valor);
}

function escaparHtml(valor) {
  return String(valor).replace(/[&<>"']/g, (caracter) => {
    const entidades = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };

    return entidades[caracter];
  });
}