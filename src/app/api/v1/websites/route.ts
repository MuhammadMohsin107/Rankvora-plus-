import { websitesCreate, websitesList } from "@/server/api/websites";
import { nextRoute } from "@/server/http/next";

export const GET = nextRoute(websitesList);
export const POST = nextRoute(websitesCreate);
