import { domainsAdd, domainsList } from "@/server/api/websites";
import { nextRoute } from "@/server/http/next";

export const GET = nextRoute(domainsList);
export const POST = nextRoute(domainsAdd);
