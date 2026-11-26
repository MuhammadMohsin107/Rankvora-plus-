import { groupsCreate, groupsList } from "@/server/api/prompts";
import { nextRoute } from "@/server/http/next";

export const GET = nextRoute(groupsList);
export const POST = nextRoute(groupsCreate);
