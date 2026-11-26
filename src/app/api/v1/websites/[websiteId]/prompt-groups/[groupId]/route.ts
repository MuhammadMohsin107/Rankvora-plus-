import { groupRemove, groupRename } from "@/server/api/prompts";
import { nextRoute } from "@/server/http/next";

export const PATCH = nextRoute(groupRename);
export const DELETE = nextRoute(groupRemove);
