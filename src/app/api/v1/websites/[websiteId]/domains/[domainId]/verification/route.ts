import { verificationStart } from "@/server/api/websites";
import { nextRoute } from "@/server/http/next";

export const POST = nextRoute(verificationStart);
