/**
 * MCP Tool Layer — registry (READ / WRITE catalogs).
 */
import type { RegisteredTool } from "@/ai/mcp/core/types";

const byId = new Map<string, RegisteredTool>();

export function registerTool(tool: RegisteredTool): void {
  if (!tool.id?.trim()) throw new Error("tool_missing_id");
  byId.set(tool.id, tool);
}

export function getTool(toolId: string): RegisteredTool | undefined {
  return byId.get(toolId);
}

export function listTools(classification?: "read" | "write"): RegisteredTool[] {
  const all = [...byId.values()];
  if (!classification) return all;
  return all.filter((t) => t.classification === classification);
}

export function listReadTools(): RegisteredTool[] {
  return listTools("read");
}

export function listWriteTools(): RegisteredTool[] {
  return listTools("write");
}

/** Test helper — clear registry between suites. */
export function clearToolRegistry(): void {
  byId.clear();
}

export function hasTool(toolId: string): boolean {
  return byId.has(toolId);
}
