import { websiteGet, websiteRemove, websiteUpdate } from "@/server/api/websites";
import { nextRoute } from "@/server/http/next";

export const GET = nextRoute(websiteGet);
export const PATCH = nextRoute(websiteUpdate);
export const DELETE = nextRoute(websiteRemove);
