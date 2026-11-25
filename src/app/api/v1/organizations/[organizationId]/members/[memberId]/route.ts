import { memberRemove, memberUpdate } from "@/server/api/organizations";
import { nextRoute } from "@/server/http/next";

export const PATCH = nextRoute(memberUpdate);
export const DELETE = nextRoute(memberRemove);
