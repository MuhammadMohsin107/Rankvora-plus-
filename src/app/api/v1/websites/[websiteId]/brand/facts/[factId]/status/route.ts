import { factStatus } from "@/server/api/brand";
import { nextRoute } from "@/server/http/next";

export const POST = nextRoute(factStatus);
