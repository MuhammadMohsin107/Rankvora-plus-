"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Button, ButtonLink } from "@/components/ui/button";
import { useSession } from "@/features/session/session";
import { api } from "@/lib/api-client";

import { AuthCard, authLink, FormError, Loading, messageOf } from "./auth-ui";

type Invitation = { organizationName: string; role: string; status: string };
type Lookup = { token: string; invitation: Invitation | null; error: string | null };

export function AcceptInvitation() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const { state, refresh, selectOrganization, signOut } = useSession();
  const [lookup, setLookup] = useState<Lookup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rejected, setRejected] = useState(false);
  const [busy, setBusy] = useState(false);
  const signedIn = state.status === "ready";

  useEffect(() => {
    if (!signedIn || !token) return;
    let live = true;
    api<Invitation>("/api/v1/invitations/lookup", { method: "POST", body: { token } })
      .then((invitation) => live && setLookup({ token, invitation, error: null }))
      .catch((failure) => live && setLookup({ token, invitation: null, error: messageOf(failure) }));
    return () => {
      live = false;
    };
  }, [signedIn, token]);

  const here = `/invitations/accept?token=${encodeURIComponent(token)}`;

  if (!token) {
    return (
      <AuthCard title="Invitation">
        <FormError message="This invitation link is incomplete. Open it from the email again." />
      </AuthCard>
    );
  }
  if (state.status === "loading") {
    return (
      <AuthCard title="Invitation">
        <Loading />
      </AuthCard>
    );
  }
  if (!signedIn) {
    return (
      <AuthCard title="You are invited">
        <p className="text-body-sm text-fg-muted">Sign in with the email address that received the invitation.</p>
        <ButtonLink href={`/sign-in?next=${encodeURIComponent(here)}`} variant="primary" size="lg">Sign in</ButtonLink>
        <ButtonLink href={`/sign-up?next=${encodeURIComponent(here)}`} size="lg">Create an account</ButtonLink>
      </AuthCard>
    );
  }

  const respond = async (action: "accept" | "reject") => {
    setBusy(true);
    setError(null);
    try {
      const result = await api<{ organizationId?: string }>(`/api/v1/invitations/${action}`, { method: "POST", body: { token } });
      if (action === "reject") return setRejected(true);
      await refresh();
      if (result.organizationId) selectOrganization(result.organizationId);
      router.replace("/stores");
    } catch (failure) {
      setError(messageOf(failure));
    } finally {
      setBusy(false);
    }
  };

  const current = lookup?.token === token ? lookup : null;
  const invitation = current?.invitation;
  const otherAccount = (
    <button type="button" className={`${authLink} cursor-pointer`} onClick={() => void signOut()}>
      Use a different account
    </button>
  );

  return (
    <AuthCard
      title={invitation ? `Join ${invitation.organizationName}` : "Invitation"}
      footer={<><Link href="/stores" className={authLink}>Go to websites</Link>{otherAccount}</>}
    >
      <FormError message={error ?? current?.error ?? null} />
      {!current ? <Loading /> : null}
      {rejected ? <p className="text-body-sm text-fg-muted">You declined this invitation.</p> : null}
      {invitation && !rejected ? (
        invitation.status === "pending" ? (
          <>
            <p className="text-body-sm text-fg-muted">
              Role: <span className="font-medium capitalize text-fg">{invitation.role}</span>
            </p>
            <Button variant="primary" size="lg" loading={busy} onClick={() => void respond("accept")}>Accept</Button>
            <Button size="lg" disabled={busy} onClick={() => void respond("reject")}>Decline</Button>
          </>
        ) : (
          <p className="text-body-sm text-fg-muted">This invitation is {invitation.status}.</p>
        )
      ) : null}
    </AuthCard>
  );
}
