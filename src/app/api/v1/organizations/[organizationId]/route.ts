import { organizationDelete, organizationGet, organizationUpdate } from "@/server/api/organizations";
import { nextRoute } from "@/server/http/next";

export const GET = nextRoute(organizationGet);
export const PATCH = nextRoute(organizationUpdate);
export const DELETE = nextRoute(organizationDelete);
