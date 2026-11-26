import { versionApprove } from "@/server/api/prompts";
import { nextRoute } from "@/server/http/next";

export const POST = nextRoute(versionApprove);
