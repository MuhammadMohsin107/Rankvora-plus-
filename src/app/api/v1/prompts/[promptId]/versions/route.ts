import { versionsCreate, versionsList } from "@/server/api/prompts";
import { nextRoute } from "@/server/http/next";

export const GET = nextRoute(versionsList);
export const POST = nextRoute(versionsCreate);
