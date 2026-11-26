import { competitorHistoryList } from "@/server/api/catalog";
import { nextRoute } from "@/server/http/next";

export const GET = nextRoute(competitorHistoryList);
