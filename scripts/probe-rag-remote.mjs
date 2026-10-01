import { probeRemoteRagPopulation } from "../src/ai/rag/rag-readiness.ts";

const r = await probeRemoteRagPopulation();
console.log(JSON.stringify(r, null, 2));
process.exit(r.status === "pass" ? 0 : r.status === "fail" ? 1 : 3);
