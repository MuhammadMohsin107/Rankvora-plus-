import { assignmentRemove, assignmentUpdate } from "@/server/api/prompts";
import { nextRoute } from "@/server/http/next";

export const PATCH = nextRoute(assignmentUpdate);
export const DELETE = nextRoute(assignmentRemove);
