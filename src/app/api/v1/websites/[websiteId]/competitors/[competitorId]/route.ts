import { competitorRemove, competitorUpdate } from "@/server/api/catalog";
import { nextRoute } from "@/server/http/next";

export const PATCH = nextRoute(competitorUpdate);
export const DELETE = nextRoute(competitorRemove);
