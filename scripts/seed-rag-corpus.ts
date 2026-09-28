/**
 * Idempotent RAG corpus seed against the configured VectorStore.
 * Usage: npm run rag:seed
 * Production: set AI_RAG_ENV=production (requires Supabase service role).
 */
import {
  ensureVectorStore,
  resetVectorStore,
  seedProductionCorpus,
  type SeedCorpusReport,
} from "../src/ai/rag/index.ts";

async function main(): Promise<void> {
  resetVectorStore();
  const store = await ensureVectorStore({ force: true });
  console.log(`[rag:seed] store=${store.id} env=${process.env["AI_RAG_ENV"] ?? process.env["NODE_ENV"] ?? "development"}`);

  const report = (await seedProductionCorpus({
    report: true,
    onDuplicate: "upsert",
  })) as SeedCorpusReport;

  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) {
    process.exitCode = 1;
    return;
  }

  // Second pass — idempotency check
  const again = (await seedProductionCorpus({
    report: true,
    onDuplicate: "upsert",
  })) as SeedCorpusReport;
  console.log(
    `[rag:seed] idempotent re-seed docs=${again.documents} chunks=${again.chunks} ok=${again.ok}`,
  );
  if (!again.ok || again.documents !== report.documents) {
    console.error("[rag:seed] idempotency mismatch");
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error("[rag:seed] failed", e);
  process.exitCode = 1;
});
