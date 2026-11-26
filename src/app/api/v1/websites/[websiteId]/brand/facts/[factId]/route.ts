import { factRemove, factUpdate } from "@/server/api/brand";
import { nextRoute } from "@/server/http/next";

export const PATCH = nextRoute(factUpdate);
export const DELETE = nextRoute(factRemove);
