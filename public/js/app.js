let viajeActual = null;
const asientosSeleccionados = new Set();
let chatConversationId = null;
let reconocimientoVozChat = null;
let leerRespuestasVoz = false;

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", cargarViaje, { once: true });
  document.addEventListener("DOMContentLoaded", configurarChat, { once: true });
} else {
  cargarViaje();
  configurarChat();
}

async function cargarViaje() {
  const estadoCarga = document.querySelector("#estado-carga");
  const contenidoViaje = document.querySelector("#contenido-viaje");

  try {
    const respuesta = await fetch("/api/viajes");
    const datos = await respuesta.json();

    if (!respuesta.ok) {
      throw new Error(datos.error || "No fue posible cargar el viaje.");
    }

    if (!datos.viajes || datos.viajes.length === 0) {
      throw new Error("No hay viajes disponibles.");
    }

    viajeActual = datos.viajes[0];
    leerAsientosPreseleccionados();
    mostrarInformacionViaje();
    mostrarAsientos();
    mostrarHospedaje();

    estadoCarga.classList.add("oculto");
    contenidoViaje.classList.remove("oculto");
  } catch (error) {
    estadoCarga.textContent = error.message;
    estadoCarga.classList.add("error");
    console.error(error);
  }
}

function mostrarInformacionViaje() {
  document.querySelector("#nombre-viaje").textContent =
    viajeActual.nombre;
  document.querySelector("#descripcion-viaje").textContent =
    viajeActual.descripcion;
  document.querySelector("#origen-viaje").textContent =
    viajeActual.origen;
  document.querySelector("#destino-viaje").textContent =
    viajeActual.destino;
  document.querySelector("#salida-viaje").textContent =
    `${formatearFecha(viajeActual.fechaSalida)} a las ${viajeActual.horaSalida}`;
  document.querySelector("#regreso-viaje").textContent =
    `${formatearFecha(viajeActual.fechaRegreso)} a las ${viajeActual.horaRegreso}`;
  document.querySelector("#precio-transporte").textContent =
    formatearMoneda(viajeActual.precioTransporte);
}

function mostrarAsientos() {
  const mapa = document.querySelector("#mapa-asientos");
  const disponibles = viajeActual.autobus.asientos.filter(
    (asiento) => asiento.estado === "disponible"
  ).length;

  mapa.replaceChildren();

  const conductor = document.createElement("div");
  conductor.className = "elemento-autobus conductor-autobus";
  conductor.textContent = "X";
  conductor.title = "Asiento del conductor";
  conductor.setAttribute("aria-hidden", "true");
  conductor.style.gridColumn = "1";
  conductor.style.gridRow = "1";
  mapa.appendChild(conductor);

  for (let fila = 2; fila <= 13; fila += 1) {
    const pasillo = document.createElement("div");
    pasillo.className = "pasillo-autobus";
    pasillo.textContent = fila === 2 ? "Pasillo" : "";
    pasillo.setAttribute("aria-hidden", "true");
    pasillo.style.gridColumn = "3";
    pasillo.style.gridRow = String(fila);
    mapa.appendChild(pasillo);
  }

  const bano = document.createElement("div");
  bano.className = "elemento-autobus bano-autobus";
  bano.textContent = "Baño";
  bano.setAttribute("aria-hidden", "true");
  bano.style.gridColumn = "4 / span 2";
  bano.style.gridRow = "13";
  mapa.appendChild(bano);

  for (const asiento of viajeActual.autobus.asientos) {
    const elemento = document.createElement("button");
    const estado = [
      "disponible",
      "apartado",
      "pagado"
    ].includes(asiento.estado)
      ? asiento.estado
      : "no-disponible";

    elemento.className = `asiento ${estado}`;
    elemento.type = "button";
    elemento.textContent = String(asiento.numero);
    elemento.title = `Asiento ${asiento.numero}: ${estado}`;
    elemento.setAttribute(
      "aria-label",
      `Asiento ${asiento.numero}: ${estado}`
    );
    elemento.setAttribute(
      "aria-pressed",
      String(asientosSeleccionados.has(asiento.numero))
    );
    elemento.style.gridColumn = String(asiento.columna);
    elemento.style.gridRow = String(asiento.fila);

    if (estado !== "disponible") {
      elemento.disabled = true;
    } else {
      if (asientosSeleccionados.has(asiento.numero)) {
        elemento.classList.add("seleccionado");
      }

      elemento.addEventListener("click", () => {
        if (asientosSeleccionados.has(asiento.numero)) {
          asientosSeleccionados.delete(asiento.numero);
        } else {
          asientosSeleccionados.add(asiento.numero);
        }

        mostrarAsientos();
      });
    }

    mapa.appendChild(elemento);
  }

  document.querySelector("#resumen-disponibilidad-asientos").textContent =
    `${disponibles} de ${viajeActual.autobus.asientos.length} asientos disponibles.`;
  actualizarResumenSeleccion();
}

function leerAsientosPreseleccionados() {
  const parametros = new URLSearchParams(window.location.search);
  const numeros = (parametros.get("asientos") || "")
    .split(",")
    .map(Number)
    .filter(Number.isInteger);
  const disponibles = new Set(
    viajeActual.autobus.asientos
      .filter((asiento) => asiento.estado === "disponible")
      .map((asiento) => asiento.numero)
  );

  for (const numero of numeros) {
    if (disponibles.has(numero)) {
      asientosSeleccionados.add(numero);
    }
  }
}

function actualizarResumenSeleccion() {
  const resumen = document.querySelector("#resumen-seleccion-asientos");
  const enlace = document.querySelector("#iniciar-reserva");
  const numeros = [...asientosSeleccionados].sort((a, b) => a - b);

  if (numeros.length === 0) {
    resumen.textContent =
      "Selecciona al menos un asiento para iniciar una reserva demostrativa.";
    enlace.href = "/reserva.html";
    enlace.setAttribute("aria-disabled", "true");
    enlace.classList.add("deshabilitado");
    return;
  }

  resumen.textContent =
    `Asientos seleccionados: ${numeros.join(", ")} · ` +
    `${formatearMoneda(numeros.length * viajeActual.precioTransporte)}`;
  enlace.href =
    `/reserva.html?viajeId=${encodeURIComponent(viajeActual.id)}` +
    `&asientos=${encodeURIComponent(numeros.join(","))}`;
  enlace.setAttribute("aria-disabled", "false");
  enlace.classList.remove("deshabilitado");
}

function mostrarHospedaje() {
  document.querySelector("#nombre-hotel").textContent =
    viajeActual.hospedaje.hotel;
  document.querySelector("#direccion-hotel").textContent =
    viajeActual.hospedaje.direccion;

  const contenedor = document.querySelector("#habitaciones");
  contenedor.replaceChildren();

  for (const habitacion of viajeActual.hospedaje.habitaciones) {
    const elemento = document.createElement("div");
    const titulo = document.createElement("h3");
    const precio = document.createElement("p");
    const disponibilidad = document.createElement("p");

    elemento.className = "habitacion";
    titulo.textContent = `Habitación para ${habitacion.tipo} personas`;
    precio.textContent =
      `Precio por persona: ${formatearMoneda(habitacion.precioPorPersona)}`;
    disponibilidad.textContent =
      `Habitaciones disponibles: ${habitacion.cantidadDisponible}`;

    elemento.append(titulo, precio, disponibilidad);
    contenedor.appendChild(elemento);
  }
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

function configurarChat() {
  const formulario = document.querySelector("#chat-form");

  if (!formulario) {
    return;
  }

  formulario.addEventListener("submit", enviarMensajeChat);
  configurarControlesVoz();
}

async function enviarMensajeChat(event) {
  event.preventDefault();

  const input = document.querySelector("#chat-input");
  const button = document.querySelector("#chat-send");
  const status = document.querySelector("#chat-status");
  const message = input.value.trim();

  if (!message) {
    return;
  }

  agregarMensajeChat(message, "usuario");
  input.value = "";
  button.disabled = true;
  button.textContent = "Enviando…";
  status.textContent = "Escribiendo…";

  const assistantMessage = agregarMensajeChat("Escribiendo…", "asistente");

  try {
    const body = { message };

    if (chatConversationId) {
      body.conversation_id = chatConversationId;
    }

    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error || "No fue posible obtener una respuesta."
      );
    }

    if (
      typeof data.reply !== "string" ||
      typeof data.conversation_id !== "string"
    ) {
      throw new Error("El servidor devolvió una respuesta incompleta.");
    }

    chatConversationId = data.conversation_id;
    assistantMessage.textContent = data.reply;
    status.textContent = "";

    if (leerRespuestasVoz && "speechSynthesis" in window) {
      leerRespuestaEnVoz(data.reply);
    }
  } catch (error) {
    assistantMessage.classList.add("error");
    assistantMessage.textContent = error.message;
    status.textContent = "No se pudo enviar la pregunta.";
  } finally {
    button.disabled = false;
    button.textContent = "Enviar";
    input.focus();
  }
}

function agregarMensajeChat(message, sender) {
  const messages = document.querySelector("#chat-messages");
  const bubble = document.createElement("p");

  bubble.classList.add("chat-message", sender);
  bubble.textContent = message;
  messages.appendChild(bubble);
  messages.scrollTop = messages.scrollHeight;

  return bubble;
}

function configurarControlesVoz() {
  const botonMicrofono = document.querySelector("#chat-voice-input");
  const botonLectura = document.querySelector("#chat-voice-output");
  const status = document.querySelector("#chat-status");
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (SpeechRecognition) {
    reconocimientoVozChat = new SpeechRecognition();
    reconocimientoVozChat.lang = "es-MX";
    reconocimientoVozChat.interimResults = true;
    reconocimientoVozChat.maxAlternatives = 1;

    reconocimientoVozChat.addEventListener("result", (event) => {
      const transcripcion = Array.from(event.results)
        .slice(event.resultIndex)
        .filter((result) => result.isFinal)
        .map((result) => result[0].transcript.trim())
        .filter(Boolean)
        .join(" ");

      if (transcripcion) {
        const input = document.querySelector("#chat-input");
        input.value = [input.value.trim(), transcripcion]
          .filter(Boolean)
          .join(" ");
        input.focus();
        status.textContent =
          "Transcripción lista. Puedes revisarla y enviarla.";
      }
    });

    reconocimientoVozChat.addEventListener("error", (event) => {
      const mensajesError = {
        "not-allowed": "Permite el uso del micrófono en el navegador para dictar tu pregunta.",
        "no-speech": "No se detectó voz. Inténtalo de nuevo.",
        "audio-capture": "No se encontró un micrófono disponible."
      };
      status.textContent =
        mensajesError[event.error] ||
        "No fue posible reconocer la voz. Inténtalo de nuevo.";
    });

    reconocimientoVozChat.addEventListener("end", () => {
      botonMicrofono.setAttribute("aria-pressed", "false");
      botonMicrofono.textContent = "Hablar pregunta";
    });

    botonMicrofono.addEventListener("click", () => {
      if (botonMicrofono.getAttribute("aria-pressed") === "true") {
        reconocimientoVozChat.stop();
        return;
      }

      status.textContent = "Escuchando…";
      botonMicrofono.setAttribute("aria-pressed", "true");
      botonMicrofono.textContent = "Detener dictado";

      try {
        reconocimientoVozChat.start();
      } catch (error) {
        botonMicrofono.setAttribute("aria-pressed", "false");
        botonMicrofono.textContent = "Hablar pregunta";
        status.textContent =
          "No se pudo iniciar el micrófono. Espera un momento e inténtalo de nuevo.";
        console.error(error);
      }
    });
  } else {
    botonMicrofono.disabled = true;
    botonMicrofono.title =
      "El dictado por voz no está disponible en este navegador.";
  }

  if ("speechSynthesis" in window) {
    botonLectura.addEventListener("click", () => {
      leerRespuestasVoz = !leerRespuestasVoz;
      botonLectura.setAttribute("aria-pressed", String(leerRespuestasVoz));
      botonLectura.textContent = leerRespuestasVoz
        ? "Leer respuestas: activado"
        : "Leer respuestas: desactivado";

      if (!leerRespuestasVoz) {
        window.speechSynthesis.cancel();
      } else {
        status.textContent =
          "Las próximas respuestas se leerán en voz alta.";
      }
    });
  } else {
    botonLectura.disabled = true;
    botonLectura.title =
      "La lectura en voz alta no está disponible en este navegador.";
  }

  if (!SpeechRecognition && !("speechSynthesis" in window)) {
    status.textContent =
      "La interacción por voz no está disponible en este navegador.";
  }
}

function leerRespuestaEnVoz(message) {
  const textoPlano = message
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_`#]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(textoPlano);
  utterance.lang = "es-MX";
  window.speechSynthesis.speak(utterance);
}
