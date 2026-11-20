// Deletes the LOCAL D1 database files (.wrangler/state/v3/d1). Never touches the remote account.
import { rmSync } from "node:fs";

rmSync(".wrangler/state/v3/d1", { recursive: true, force: true });
console.log("Local D1 database removed (.wrangler/state/v3/d1). Migrations are re-applied next.");
