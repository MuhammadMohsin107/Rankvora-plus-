import { competitorStatus } from "@/server/api/catalog";
import { nextRoute } from "@/server/http/next";

export const POST = nextRoute(competitorStatus);
