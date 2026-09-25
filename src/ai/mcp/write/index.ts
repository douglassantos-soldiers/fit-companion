/**
 * MCP WRITE tools — architecture + input validation only.
 * invokeTool always denies classification=write with write_not_enabled.
 */
import { defineWriteTool } from "@/ai/mcp/core/define-tool";

export function registerWriteTools(): void {
  defineWriteTool({
    id: "propose_training_adjustment",
    name: "propose_training_adjustment",
    description: "Placeholder write: would emit DecisionProposal (not enabled)",
    permission: "training.write.propose",
    mcp_namespace: "write",
    input_schema: {
      type: "object",
      required: ["proposed_type"],
      additionalProperties: false,
      properties: {
        proposed_type: { type: "string" },
        proposed_value: { type: ["string", "number", "boolean"] },
        date: { type: "string" },
      },
    },
  });

  defineWriteTool({
    id: "write_checkin_note",
    name: "write_checkin_note",
    description: "Placeholder write: check-in mutation (not enabled)",
    permission: "recovery.write.checkin",
    mcp_namespace: "write",
    input_schema: {
      type: "object",
      required: ["note"],
      additionalProperties: false,
      properties: {
        note: { type: "string" },
        date: { type: "string" },
      },
    },
  });
}
