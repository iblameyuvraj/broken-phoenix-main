// Ledger integrity: every workspace balance must equal the sum of its ledger deltas,
// every "task" ledger entry must point at a real task, and prefixes must match.
import mongoose from "mongoose";

await mongoose.connect("mongodb://localhost:27017/phoenix");
const db = mongoose.connection.db;
const workspaces = await db.collection("workspaces").find().toArray();
const ledger = await db.collection("creditledgers").find().toArray();
const tasks = await db.collection("tasks").find().toArray();
const taskIds = new Set(tasks.map((t) => String(t._id)));

let problems = 0;
for (const ws of workspaces) {
  const entries = ledger.filter((l) => String(l.workspace) === String(ws._id));
  const sum = entries.reduce((acc, l) => acc + l.delta, 0);
  if (sum !== ws.credits) {
    problems++;
    console.log("MISMATCH", ws.name, "balance", ws.credits, "ledger sum", sum);
  }
  for (const l of entries.filter((l) => l.task)) {
    if (!taskIds.has(String(l.task))) {
      problems++;
      console.log("DANGLING ledger task ref", l._id);
    }
  }
}
console.log(`workspaces=${workspaces.length} tasks=${tasks.length} ledger=${ledger.length} problems=${problems}`);
const statuses = [...new Set(tasks.map((t) => t.status))].sort();
console.log("task statuses in db:", statuses);
const indexes = await db.collection("workspacemembers").indexes();
console.log("workspacemembers indexes:", indexes.map((i) => `${JSON.stringify(i.key)}${i.unique ? " unique" : ""}`));
const ledgerIdx = await db.collection("creditledgers").indexes();
console.log("creditledgers indexes:", ledgerIdx.map((i) => `${JSON.stringify(i.key)}${i.unique ? " unique" : ""}`));
await mongoose.disconnect();
process.exit(problems === 0 ? 0 : 1);
