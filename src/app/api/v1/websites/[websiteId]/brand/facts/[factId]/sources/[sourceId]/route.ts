import { factSourceRemove } from "@/server/api/brand";
import { nextRoute } from "@/server/http/next";

export const DELETE = nextRoute(factSourceRemove);
