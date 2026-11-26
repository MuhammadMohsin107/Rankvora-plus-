import { promptsImport } from "@/server/api/prompts";
import { nextRoute } from "@/server/http/next";

export const POST = nextRoute(promptsImport);
