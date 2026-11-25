import { domainRetire } from "@/server/api/websites";
import { nextRoute } from "@/server/http/next";

export const DELETE = nextRoute(domainRetire);
