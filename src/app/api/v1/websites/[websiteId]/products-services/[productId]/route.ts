import { productRemove, productUpdate } from "@/server/api/catalog";
import { nextRoute } from "@/server/http/next";

export const PATCH = nextRoute(productUpdate);
export const DELETE = nextRoute(productRemove);
