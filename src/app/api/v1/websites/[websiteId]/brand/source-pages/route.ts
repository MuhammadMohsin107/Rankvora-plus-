import { sourcePagesAdd, sourcePagesList } from "@/server/api/brand";
import { nextRoute } from "@/server/http/next";

export const GET = nextRoute(sourcePagesList);
export const POST = nextRoute(sourcePagesAdd);
