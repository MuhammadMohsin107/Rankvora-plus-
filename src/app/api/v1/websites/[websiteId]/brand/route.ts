import { brandGet, brandSave } from "@/server/api/brand";
import { nextRoute } from "@/server/http/next";

export const GET = nextRoute(brandGet);
export const POST = nextRoute(brandSave);
