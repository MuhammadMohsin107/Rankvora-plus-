import { factsCreate, factsList } from "@/server/api/brand";
import { nextRoute } from "@/server/http/next";

export const GET = nextRoute(factsList);
export const POST = nextRoute(factsCreate);
