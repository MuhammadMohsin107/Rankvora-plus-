import { promptDelete, promptGet, promptUpdate } from "@/server/api/prompts";
import { nextRoute } from "@/server/http/next";

export const GET = nextRoute(promptGet);
export const PATCH = nextRoute(promptUpdate);
export const DELETE = nextRoute(promptDelete);
