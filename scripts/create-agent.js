import { AIProjectClient } from "@azure/ai-projects";
import { DefaultAzureCredential } from "@azure/identity";

const projectEndpoint = process.env.FOUNDRY_PROJECT_ENDPOINT;
const agentName = process.env.FOUNDRY_AGENT_NAME;
const modelName =
  process.env.FOUNDRY_MODEL_DEPLOYMENT_NAME ||
  process.env.FOUNDRY_MODEL_DEPLOYMENT;

const missingVariables = [
  ["FOUNDRY_PROJECT_ENDPOINT", projectEndpoint],
  ["FOUNDRY_AGENT_NAME", agentName],
  ["FOUNDRY_MODEL_DEPLOYMENT_NAME (o FOUNDRY_MODEL_DEPLOYMENT)", modelName]
]
  .filter(([, value]) => !value)
  .map(([name]) => name);

if (missingVariables.length > 0) {
  throw new Error(
    `Configura estas variables antes de crear el agente: ${missingVariables.join(", ")}.`
  );
}

const project = new AIProjectClient(
  projectEndpoint,
  new DefaultAzureCredential()
);

const agent = await project.agents.createVersion(agentName, {
  kind: "prompt",
  model: modelName,
  instructions: [
    "Eres el asistente de una página de viajes y respondes en español.",
    "Usa los datos actuales del viaje que aparecen en el mensaje para responder sobre destinos, fechas, horarios, precios, asientos, habitaciones y transferencia.",
    "No inventes disponibilidad, costos ni políticas. Si falta un dato, dilo claramente.",
    "No confirmes reservas ni pagos; explica que el administrador revisa las transferencias."
  ].join(" ")
});

console.log(
  `Agente creado: ${agent.name} (versión ${agent.version}).`
);
