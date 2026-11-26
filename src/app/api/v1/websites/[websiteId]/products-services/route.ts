import { productsCreate, productsList } from "@/server/api/catalog";
import { nextRoute } from "@/server/http/next";

export const GET = nextRoute(productsList);
export const POST = nextRoute(productsCreate);
