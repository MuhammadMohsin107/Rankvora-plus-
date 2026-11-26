import { sourcePageRemove, sourcePageUpdate } from "@/server/api/brand";
import { nextRoute } from "@/server/http/next";

export const PATCH = nextRoute(sourcePageUpdate);
export const DELETE = nextRoute(sourcePageRemove);
