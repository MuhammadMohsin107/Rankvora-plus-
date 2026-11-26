import { assignmentsCreate, assignmentsList } from "@/server/api/prompts";
import { nextRoute } from "@/server/http/next";

export const GET = nextRoute(assignmentsList);
export const POST = nextRoute(assignmentsCreate);
