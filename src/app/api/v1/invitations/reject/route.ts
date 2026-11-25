import { invitationReject } from "@/server/api/organizations";
import { nextRoute } from "@/server/http/next";

export const POST = nextRoute(invitationReject);
