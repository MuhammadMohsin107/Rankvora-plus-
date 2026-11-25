import { invitationAccept } from "@/server/api/organizations";
import { nextRoute } from "@/server/http/next";

export const POST = nextRoute(invitationAccept);
