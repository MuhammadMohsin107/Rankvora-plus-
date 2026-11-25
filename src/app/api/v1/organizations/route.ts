import { organizationsCreate, organizationsList } from "@/server/api/organizations";
import { nextRoute } from "@/server/http/next";

export const GET = nextRoute(organizationsList);
export const POST = nextRoute(organizationsCreate);
