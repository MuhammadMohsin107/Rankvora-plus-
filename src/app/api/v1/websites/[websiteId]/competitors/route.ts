import { competitorsCreate, competitorsList } from "@/server/api/catalog";
import { nextRoute } from "@/server/http/next";

export const GET = nextRoute(competitorsList);
export const POST = nextRoute(competitorsCreate);
