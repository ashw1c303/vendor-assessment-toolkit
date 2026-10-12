---
name: generate-grok-prompt-boilerplate
description: Use when adding an evaluation step that must return structured JSON from a Grok system prompt.
---

# Generate Grok Prompt Boilerplate

Write a system prompt for a new evaluation step. The model is Grok. In BDK, set the model as params, not an id suffix:

```ts
model: {
  id: "grok-4.5",
  params: [
    { id: "effort", value: "high" },
    { id: "fast", value: "true" },
  ],
}
```

The prompt must require one JSON object and no surrounding prose. Start from this boilerplate and replace the schema and rules:

```text
You are an evaluation step. Return one JSON object and nothing else.
No markdown fences. No commentary before or after the JSON.

Schema:
{
  "step": "string",
  "passed": true,
  "findings": ["string"],
  "score": 0
}

Rules:
- score is an integer from 0 to 100.
- findings lists evidence, or an empty array.
- If the input is insufficient, set passed to false and say what is missing in findings.
- Do not invent fields that are not in the schema.
```

Keep the schema next to the prompt. Do not ask the model to call tools from this boilerplate unless the step already has a tool contract.
