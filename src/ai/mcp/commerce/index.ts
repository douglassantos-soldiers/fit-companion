/**
 * MCP commerce tools (READ).
 */
import { defineReadTool } from "@/ai/mcp/core/define-tool";
import { PRODUCTS } from "@/data/products";

export function registerCommerceTools(): void {
  defineReadTool({
    id: "get_orders",
    name: "get_orders",
    description: "Purchase signals from hydrated state (no new SQL)",
    permission: "commerce.orders.read",
    mcp_namespace: "commerce",
    input_schema: {
      type: "object",
      additionalProperties: false,
      properties: { date: { type: "string" } },
    },
    output_schema: { type: "object", required: ["orders"] },
    handler: (ctx) => {
      const productIds = ctx.state.purchaseProductIds ?? [];
      const pc = ctx.performanceContext;
      return {
        orders: productIds.map((productId) => ({
          productId,
          source: "purchase_signal",
        })),
        commerce: pc?.commerce ?? {
          accessTier: "base",
          purchaseCount: productIds.length,
          restockSoon: false,
        },
      };
    },
  });

  defineReadTool({
    id: "get_products",
    name: "get_products",
    description: "Public product catalog (still requires authenticated invoke for audit)",
    permission: "commerce.products.read",
    mcp_namespace: "commerce",
    input_schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        date: { type: "string" },
        query: { type: "string" },
        limit: { type: "integer" },
      },
    },
    output_schema: { type: "object", required: ["products"] },
    handler: (_ctx, input) => {
      const q = typeof input["query"] === "string" ? input["query"].toLowerCase().trim() : "";
      const limitRaw = input["limit"];
      const limit =
        typeof limitRaw === "number" && Number.isFinite(limitRaw)
          ? Math.min(50, Math.max(1, Math.floor(limitRaw)))
          : 20;
      const filtered = q
        ? PRODUCTS.filter(
            (p) =>
              p.id.toLowerCase().includes(q) ||
              p.name.toLowerCase().includes(q) ||
              p.category.toLowerCase().includes(q),
          )
        : PRODUCTS;
      return {
        products: filtered.slice(0, limit).map((p) => ({
          id: p.id,
          name: p.name,
          category: p.category,
          timing: p.timing,
          serving: p.serving,
        })),
      };
    },
  });
}
