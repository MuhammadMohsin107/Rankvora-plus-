import { domainCheck, domainChecksList } from "@/server/api/websites";
import { nextRoute } from "@/server/http/next";

export const GET = nextRoute(domainChecksList);
export const POST = nextRoute(domainCheck);
