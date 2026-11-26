import { NextResponse, connection, type NextRequest } from "next/server";

import type { DemoStateV1 } from "@/demo-state/types";
import { MAX_STATE_BYTES, parsePutBody } from "@/db-d1/payload";
import {
  WORKSPACE_COOKIE,
  WORKSPACE_COOKIE_MAX_AGE,
  isJsonContentType,
  isSameOrigin,
  parseWorkspaceCookie,
} from "@/db-d1/request";
import { D1UnavailableError, deleteWorkspace, loadWorkspace, saveWorkspace } from "@/db-d1/workspaces";

/**
 * Demo workspace API (Cloudflare D1). The workspace id lives only in the httpOnly cookie `rv_ws`
 * (a random UUID issued here on first use); an id in a body or query string is never read.
 * No login: anyone with the cookie owns that workspace. Demo data only. State is never logged.
 *
 *   GET    -> 200 { revision, state | null }          (state null: nothing saved yet, revision 0)
 *   PUT    -> 200 { revision }                        body { state, expectedRevision? }
 *             409 { error: "conflict", revision, state | null }   (server copy, adopt it)
 *   DELETE -> 200 { revision: 0, state: null }        (reset)
 *   errors -> { error: code }: 400 invalid_body|invalid_json, 403 forbidden_origin, 413 too_large,
 *             415 unsupported_media_type, 503 d1_unavailable, 500 server_error
 *
 * Dynamic at request time: `await connection()` works with Cache Components on (local) and off (Cloudflare).
 */

type WorkspaceBody = { revision: number; state: DemoStateV1 | null };

const NO_STORE = { "Cache-Control": "no-store" };

function json(body: unknown, status: number, workspace?: { id: string; isNew: boolean }): NextResponse {
  const res = NextResponse.json(body, { status, headers: NO_STORE });
  if (workspace?.isNew) {
    res.cookies.set({
      name: WORKSPACE_COOKIE,
      value: workspace.id,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: WORKSPACE_COOKIE_MAX_AGE,
    });
  }
  return res;
}

function workspaceFor(request: NextRequest): { id: string; isNew: boolean } {
  const existing = parseWorkspaceCookie(request.cookies.get(WORKSPACE_COOKIE)?.value);
  return existing ? { id: existing, isNew: false } : { id: crypto.randomUUID(), isNew: true };
}

function failure(error: unknown, workspace: { id: string; isNew: boolean }): NextResponse {
  if (error instanceof D1UnavailableError) return json({ error: "d1_unavailable" }, 503, workspace);
  // Log the error type only: never the request body or the stored state.
  console.error("[demo-state] request failed:", error instanceof Error ? error.name : "unknown");
  return json({ error: "server_error" }, 500, workspace);
}

function guardWrite(request: NextRequest): NextResponse | null {
  if (!isSameOrigin(request.headers.get("origin"), request.headers.get("host"))) {
    return json({ error: "forbidden_origin" }, 403);
  }
  return null;
}

export async function GET(request: NextRequest) {
  await connection();
  const workspace = workspaceFor(request);
  try {
    const record = await loadWorkspace(workspace.id);
    const body: WorkspaceBody = record ? { revision: record.revision, state: record.state } : { revision: 0, state: null };
    return json(body, 200, workspace);
  } catch (error) {
    return failure(error, workspace);
  }
}

export async function PUT(request: NextRequest) {
  await connection();
  const forbidden = guardWrite(request);
  if (forbidden) return forbidden;
  if (!isJsonContentType(request.headers.get("content-type"))) return json({ error: "unsupported_media_type" }, 415);
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_STATE_BYTES + 1024) return json({ error: "too_large" }, 413);

  const parsed = parsePutBody(await request.text());
  if (!parsed.ok) return json({ error: parsed.code }, parsed.code === "too_large" ? 413 : 400);

  const workspace = workspaceFor(request);
  try {
    const outcome = await saveWorkspace(workspace.id, parsed.value.state, parsed.value.expectedRevision);
    if (outcome.ok) return json({ revision: outcome.revision }, 200, workspace);
    const body = {
      error: "conflict",
      revision: outcome.current?.revision ?? 0,
      state: outcome.current?.state ?? null,
    };
    return json(body, 409, workspace);
  } catch (error) {
    return failure(error, workspace);
  }
}

export async function DELETE(request: NextRequest) {
  await connection();
  const forbidden = guardWrite(request);
  if (forbidden) return forbidden;
  const workspace = workspaceFor(request);
  try {
    await deleteWorkspace(workspace.id);
    const body: WorkspaceBody = { revision: 0, state: null };
    return json(body, 200, workspace);
  } catch (error) {
    return failure(error, workspace);
  }
}
