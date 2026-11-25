import { websiteActivityList } from "@/server/api/websites";
import { nextRoute } from "@/server/http/next";

export const GET = nextRoute(websiteActivityList);
