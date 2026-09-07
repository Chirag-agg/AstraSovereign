import type { Scenario, AgentStep, TaskCategory } from "./types";

function classify(text: string): { category: TaskCategory; label: string; modelId: string } {
  const t = text.toLowerCase();
  if (/(script|python|code|function|test|debug|sandbox|calculate|formula)/.test(t)) {
    return { category: "coding", label: "Coding · Sandbox execution", modelId: "qwen3-32b" };
  }
  if (/(sop|policy|procedure|clause|manual|permit|regulation|says|say )/.test(t)) {
    return { category: "knowledge-retrieval", label: "Knowledge retrieval · RAG", modelId: "llama-3.3-70b" };
  }
  if (/(scan|image|photo|drawing|p&id|pid|ocr|handwrit|vision)/.test(t)) {
    return { category: "document-analysis", label: "Document analysis · OCR · Vision", modelId: "gemma3-27b-vision" };
  }
  if (/(excel|sheet|xlsx|slide|ppt|presentation|chart|report|summar)/.test(t)) {
    return { category: "multimodal-report", label: "Spreadsheet analysis · Report generation", modelId: "qwen3-32b" };
  }
  return { category: "knowledge-retrieval", label: "General reasoning", modelId: "deepseek-r1-70b" };
}

let counter = 0;

export function buildGenericScenario(promptText: string, attachedNames: string[] = []): Scenario {
  const { category, label, modelId } = classify(promptText);
  counter += 1;
  const id = `custom-${counter}`;

  const attachNote =
    attachedNames.length > 0
      ? ` Attached for this task: ${attachedNames.join(", ")}.`
      : "";

  const steps: AgentStep[] = [
    {
      id: `${id}-s1`,
      kind: "plan",
      title: "Plan",
      detail: `Classified as ${label.toLowerCase()}. Decomposing into retrieval, execution and drafting steps before responding.${attachNote}`,
      status: "done",
      durationMs: 260,
    },
    {
      id: `${id}-s2`,
      kind: "tool-call",
      title: "knowledge_search · organization knowledge base",
      tool: "knowledge_search",
      detail: "Checking the local knowledge base and past sessions for relevant grounding before answering.",
      status: "done",
      durationMs: 300,
    },
    {
      id: `${id}-s3`,
      kind: "model",
      title: "Compose response",
      modelId,
      detail:
        "This on-premises preview ships with four fully grounded task walkthroughs backed by real refinery documents. Your request has been routed the same way a production run would be, but response content is limited to the four scenarios in this build. Try one of the sample prompts on the left to see a complete run through, including tool calls, citations and the human-in-the-loop gate.",
      status: "done",
      durationMs: 700,
    },
  ];

  return {
    id,
    label: promptText.slice(0, 60),
    prompt: promptText,
    category,
    categoryLabel: label,
    routedModelId: modelId,
    attachedFiles: [],
    steps,
    audit: [
      { id: `${id}-a0`, time: "T+0.0s", actor: "router", category: "routing", message: `Task classified as ${category}, routed to ${modelId}` },
      { id: `${id}-a1`, time: "T+0.3s", actor: "tool", category: "tool", message: "knowledge_search executed against local vector database" },
      { id: `${id}-a2`, time: "T+1.0s", actor: "system", category: "system", message: "Response composed from preview scenario library" },
    ],
  };
}
