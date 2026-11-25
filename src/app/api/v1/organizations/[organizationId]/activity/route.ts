import { organizationActivity } from "@/server/api/organizations";
import { nextRoute } from "@/server/http/next";

export const GET = nextRoute(organizationActivity);
