const TAMANO_MAXIMO_COMPROBANTE = 5 * 1024 * 1024;
let viajeActual = null;
let reservaActual = null;
const asientosSeleccionados = new Set();

document.addEventListener("DOMContentLoaded", iniciarReserva, { once: true });

async function iniciarReserva() {
  const estado = document.querySelector("#estado-carga-reserva");

  try {
    const respuesta = await fetch("/api/viajes");
    const datos = await leerRespuestaJson(respuesta);

    if (!respuesta.ok) {
      throw new Error(datos.error || "No fue posible cargar el viaje.");
    }

    const parametros = new URLSearchParams(window.location.search);
    const viajeId = parametros.get("viajeId");
    viajeActual = datos.viajes.find((viaje) => viaje.id === viajeId)
      || datos.viajes[0];

    if (!viajeActual) {
      throw new Error("No hay viajes disponibles.");
    }

    leerAsientosPreseleccionados(parametros);
    configurarFormularioReserva();
    configurarFormularioPago();
    mostrarViaje();
    mostrarAsientos();
    mostrarOpcionesHabitacion();
    actualizarResumenReserva();

    estado.classList.add("oculto");
    document.querySelector("#contenido-reserva").classList.remove("oculto");
  } catch (error) {
    estado.textContent = error.message;
    estado.classList.add("error");
  }
}

function leerAsientosPreseleccionados(parametros) {
  const disponibles = new Set(
    viajeActual.autobus.asientos
      .filter((asiento) => asiento.estado === "disponible")
      .map((asiento) => asiento.numero)
  );
  const numeros = (parametros.get("asientos") || "")
    .split(",")
    .map(Number)
    .filter(Number.isInteger);

  for (const numero of numeros) {
    if (disponibles.has(numero)) {
      asientosSeleccionados.add(numero);
    }
  }
}

function mostrarViaje() {
  document.querySelector("#nombre-viaje-reserva").textContent =
    viajeActual.nombre;
  document.querySelector("#resumen-viaje-reserva").textContent =
    `${viajeActual.origen} a ${viajeActual.destino} · ` +
    `${formatearFecha(viajeActual.fechaSalida)} · ` +
    `${formatearMoneda(viajeActual.precioTransporte)} por asiento`;
}

function mostrarAsientos() {
  const mapa = document.querySelector("#mapa-asientos-reserva");
  mapa.replaceChildren();

  for (const asiento of viajeActual.autobus.asientos) {
    const boton = document.createElement("button");
    const disponible = asiento.estado === "disponible";
    const seleccionado = asientosSeleccionados.has(asiento.numero);

    boton.type = "button";
    boton.className = `asiento ${disponible ? "disponible" : "no-disponible"}`;
    if (seleccionado) {
      boton.classList.add("seleccionado");
    }
    boton.textContent = String(asiento.numero);
    boton.setAttribute(
      "aria-label",
      `Asiento ${asiento.numero}: ${disponible ? "disponible" : asiento.estado}`
    );
    boton.setAttribute("aria-pressed", String(seleccionado));
    boton.style.gridColumn = String(asiento.columna);
    boton.style.gridRow = String(asiento.fila);
    boton.disabled = !disponible;

    if (disponible) {
      boton.addEventListener("click", () => {
        if (seleccionado) {
          asientosSeleccionados.delete(asiento.numero);
        } else {
          asientosSeleccionados.add(asiento.numero);
        }

        mostrarAsientos();
        actualizarResumenReserva();
        actualizarHuespedes();
      });
    }

    mapa.appendChild(boton);
  }

  const seleccion = [...asientosSeleccionados].sort((a, b) => a - b);
  document.querySelector("#resumen-asientos-reserva").textContent =
    seleccion.length
      ? `Seleccionados: ${seleccion.join(", ")}`
      : "Selecciona uno o más asientos disponibles.";
}

function mostrarOpcionesHabitacion() {
  const selector = document.querySelector("#habitacion-id");
  selector.replaceChildren();

  const opcionInicial = document.createElement("option");
  opcionInicial.value = "";
  opcionInicial.textContent = "Selecciona una habitación";
  selector.appendChild(opcionInicial);

  for (const habitacion of viajeActual.hospedaje.habitaciones) {
    const opcion = document.createElement("option");
    opcion.value = habitacion.id;
    opcion.textContent =
      `${habitacion.tipo} personas · ` +
      `${habitacion.cantidadDisponible} disponibles · ` +
      `${formatearMoneda(habitacion.precioPorPersona)} por huésped`;
    selector.appendChild(opcion);
  }
}

function configurarFormularioReserva() {
  const formulario = document.querySelector("#formulario-reserva");
  const hospedaje = document.querySelector("#incluye-hospedaje");
  const habitacion = document.querySelector("#habitacion-id");

  hospedaje.addEventListener("change", () => {
    document.querySelector("#opciones-hospedaje")
      .classList.toggle("oculto", !hospedaje.checked);
    habitacion.required = hospedaje.checked;
    actualizarHuespedes();
    actualizarResumenReserva();
  });
  habitacion.addEventListener("change", () => {
    actualizarHuespedes();
    actualizarResumenReserva();
  });
  formulario.addEventListener("submit", crearReserva);
}

function actualizarHuespedes() {
  const contenedor = document.querySelector("#lista-huespedes");
  const formulario = document.querySelector("#formulario-reserva");
  const incluyeHospedaje =
    document.querySelector("#incluye-hospedaje").checked;
  const habitacionId = document.querySelector("#habitacion-id").value;
  const habitacion = viajeActual.hospedaje.habitaciones.find(
    (item) => item.id === habitacionId
  );

  contenedor.replaceChildren();
  if (!incluyeHospedaje || !habitacion) {
    return;
  }

  const cantidadHuespedes = document.createElement("input");
  cantidadHuespedes.id = "cantidad-huespedes";
  cantidadHuespedes.type = "number";
  cantidadHuespedes.min = "1";
  cantidadHuespedes.max = String(Math.max(asientosSeleccionados.size, 1));
  cantidadHuespedes.value = String(Math.max(asientosSeleccionados.size, 1));
  cantidadHuespedes.required = true;

  const etiquetaCantidad = document.createElement("label");
  etiquetaCantidad.htmlFor = cantidadHuespedes.id;
  etiquetaCantidad.textContent = "Cantidad de huéspedes";
  contenedor.append(etiquetaCantidad, cantidadHuespedes);

  const etiquetaNombres = document.createElement("p");
  etiquetaNombres.className = "ayuda";
  etiquetaNombres.textContent = "Usa nombres ficticios para la demostración.";
  contenedor.appendChild(etiquetaNombres);

  cantidadHuespedes.addEventListener("input", () => {
    const cantidad = Number(cantidadHuespedes.value);
    actualizarCamposHuespedes(contenedor, cantidad);
    actualizarResumenReserva();
  });

  const cantidadInicial = Number(cantidadHuespedes.value);
  actualizarCamposHuespedes(contenedor, cantidadInicial);
}

function actualizarCamposHuespedes(contenedor, cantidad) {
  contenedor.querySelectorAll(".campo-huesped").forEach((campo) => campo.remove());
  if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 46) {
    actualizarResumenReserva();
    return;
  }

  for (let indice = 0; indice < cantidad; indice += 1) {
    const campo = document.createElement("div");
    const etiqueta = document.createElement("label");
    const entrada = document.createElement("input");

    campo.className = "campo-huesped";
    etiqueta.htmlFor = `huesped-${indice + 1}`;
    etiqueta.textContent = `Huésped de prueba ${indice + 1}`;
    entrada.id = etiqueta.htmlFor;
    entrada.name = "huespedes";
    entrada.type = "text";
    entrada.maxLength = 100;
    entrada.autocomplete = "off";
    entrada.required = true;
    entrada.addEventListener("input", actualizarResumenReserva);
    campo.append(etiqueta, entrada);
    contenedor.appendChild(campo);
  }

  actualizarResumenReserva();
}

function actualizarResumenReserva() {
  const asientos = [...asientosSeleccionados];
  const hospedajeActivo =
    document.querySelector("#incluye-hospedaje").checked;
  const habitacion = viajeActual.hospedaje.habitaciones.find(
    (item) => item.id === document.querySelector("#habitacion-id").value
  );
  const cantidadHuespedes =
    Number(document.querySelector("#cantidad-huespedes")?.value) || 0;
  const costoTransporte = asientos.length * viajeActual.precioTransporte;
  const costoHospedaje =
    hospedajeActivo && habitacion
      ? cantidadHuespedes * habitacion.precioPorPersona
      : 0;

  document.querySelector("#costo-transporte-reserva").textContent =
    formatearMoneda(costoTransporte);
  document.querySelector("#costo-hospedaje-reserva").textContent =
    formatearMoneda(costoHospedaje);
  document.querySelector("#total-reserva").textContent =
    formatearMoneda(costoTransporte + costoHospedaje);
}

async function crearReserva(event) {
  event.preventDefault();
  const formulario = event.currentTarget;
  const boton = document.querySelector("#crear-reserva");
  const resultado = document.querySelector("#resultado-reserva");

  if (asientosSeleccionados.size === 0) {
    mostrarResultado(resultado, "Selecciona al menos un asiento.", false);
    return;
  }

  if (!formulario.reportValidity()) {
    return;
  }

  const incluyeHospedaje =
    document.querySelector("#incluye-hospedaje").checked;
  const datos = new FormData(formulario);
  const cuerpo = {
    viajeId: viajeActual.id,
    nombreTitular: datos.get("nombreTitular"),
    telefono: datos.get("telefono"),
    correo: datos.get("correo"),
    asientos: [...asientosSeleccionados],
    incluyeHospedaje,
    habitacionId: incluyeHospedaje ? datos.get("habitacionId") : null,
    huespedes: incluyeHospedaje
      ? datos.getAll("huespedes").map((nombre) => String(nombre).trim())
      : []
  };

  boton.disabled = true;
  boton.textContent = "Creando reserva...";

  try {
    const respuesta = await fetch("/api/reservas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo)
    });
    const respuestaDatos = await leerRespuestaJson(respuesta);

    if (!respuesta.ok) {
      const detalles = Array.isArray(respuestaDatos.detalles)
        ? ` ${respuestaDatos.detalles.join(" ")}`
        : "";
      throw new Error(
        (respuestaDatos.error || "No fue posible crear la reserva.") + detalles
      );
    }

    reservaActual = respuestaDatos.reserva;
    mostrarResultado(
      resultado,
      `Reserva demostrativa creada. Folio: ${reservaActual.id}`,
      true
    );
    formulario.classList.add("oculto");
    mostrarFormularioPago();
  } catch (error) {
    mostrarResultado(resultado, error.message, false);
  } finally {
    boton.disabled = false;
    boton.textContent = "Crear reserva demostrativa";
  }
}

function configurarFormularioPago() {
  const formulario = document.querySelector("#formulario-pago");
  const fecha = document.querySelector("#fecha-transferencia");
  const hoy = new Date();
  fecha.value = [
    hoy.getFullYear(),
    String(hoy.getMonth() + 1).padStart(2, "0"),
    String(hoy.getDate()).padStart(2, "0")
  ].join("-");
  formulario.addEventListener("submit", reportarPago);
}

function mostrarFormularioPago() {
  document.querySelector("#identificador-reserva").textContent =
    `Folio de prueba: ${reservaActual.id}`;
  document.querySelector("#monto-pago").textContent =
    formatearMoneda(reservaActual.costos.total);
  document.querySelector("#seccion-pago").classList.remove("oculto");
  document.querySelector("#seccion-pago").scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

async function reportarPago(event) {
  event.preventDefault();
  const formulario = event.currentTarget;
  const boton = document.querySelector("#reportar-pago");
  const resultado = document.querySelector("#resultado-pago");
  const datos = new FormData(formulario);
  const archivo = datos.get("comprobante");

  if (!(archivo instanceof File) || archivo.size === 0) {
    mostrarResultado(resultado, "Selecciona un archivo de prueba.", false);
    return;
  }

  if (archivo.size > TAMANO_MAXIMO_COMPROBANTE) {
    mostrarResultado(resultado, "El archivo no puede superar los 5 MB.", false);
    return;
  }

  if (!["application/pdf", "image/jpeg", "image/png"].includes(archivo.type)) {
    mostrarResultado(
      resultado,
      "El archivo debe ser PDF, JPG o PNG.",
      false
    );
    return;
  }

  boton.disabled = true;
  boton.textContent = "Enviando reporte...";

  try {
    const contenidoBase64 = await leerArchivoBase64(archivo);
    const respuesta = await fetch(
      `/api/reservas/${encodeURIComponent(reservaActual.id)}/reportar-pago`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          monto: reservaActual.costos.total,
          referencia: datos.get("referencia"),
          fechaTransferencia: datos.get("fechaTransferencia"),
          comprobante: {
            nombre: archivo.name,
            tipo: archivo.type,
            contenidoBase64
          }
        })
      }
    );
    const respuestaDatos = await leerRespuestaJson(respuesta);

    if (!respuesta.ok) {
      throw new Error(
        respuestaDatos.error || "No fue posible enviar el reporte de prueba."
      );
    }

    mostrarResultado(
      resultado,
      "Reporte de pago de prueba enviado. El administrador puede revisarlo en el panel.",
      true
    );
    formulario.classList.add("oculto");
    const enlaceAdmin = document.createElement("a");
    enlaceAdmin.href = "/admin-login.html";
    enlaceAdmin.textContent = "Abrir el acceso de demostración para administración";
    enlaceAdmin.className = "boton secundario enlace-boton";
    resultado.after(enlaceAdmin);
  } catch (error) {
    mostrarResultado(resultado, error.message, false);
  } finally {
    boton.disabled = false;
    boton.textContent = "Enviar reporte de pago de prueba";
  }
}

function leerArchivoBase64(archivo) {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.addEventListener("load", () => {
      if (typeof lector.result !== "string") {
        reject(new Error("No fue posible leer el archivo seleccionado."));
        return;
      }

      resolve(lector.result.split(",")[1]);
    });
    lector.addEventListener("error", () => {
      reject(new Error("No fue posible leer el archivo seleccionado."));
    });
    lector.readAsDataURL(archivo);
  });
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

function mostrarResultado(elemento, mensaje, exito) {
  elemento.classList.remove("oculto", "exito", "error");
  elemento.classList.add(exito ? "exito" : "error");
  elemento.textContent = mensaje;
}

function formatearMoneda(valor) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN"
  }).format(valor);
}

function formatearFecha(fecha) {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "long"
  }).format(new Date(`${fecha}T00:00:00`));
}