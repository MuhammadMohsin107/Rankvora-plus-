import { invitationLookup } from "@/server/api/organizations";
import { nextRoute } from "@/server/http/next";

/** POST, so the token stays out of URLs and logs. */
export const POST = nextRoute(invitationLookup);
