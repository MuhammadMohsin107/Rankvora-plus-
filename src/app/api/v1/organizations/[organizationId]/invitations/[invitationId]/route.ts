import { invitationRevoke } from "@/server/api/organizations";
import { nextRoute } from "@/server/http/next";

export const DELETE = nextRoute(invitationRevoke);
