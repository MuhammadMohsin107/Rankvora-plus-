import { promptsCreate, promptsList } from "@/server/api/prompts";
import { nextRoute } from "@/server/http/next";

export const GET = nextRoute(promptsList);
export const POST = nextRoute(promptsCreate);
