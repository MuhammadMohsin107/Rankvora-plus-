import { factHistoryList } from "@/server/api/brand";
import { nextRoute } from "@/server/http/next";

export const GET = nextRoute(factHistoryList);
