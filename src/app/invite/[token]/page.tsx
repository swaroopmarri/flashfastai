import { createClient } from "@/utils/supabase/server";
import type { InviteInfo } from "@/lib/organizations";
import { AcceptInviteForm } from "./AcceptInviteForm";

export default async function InvitePage({
  params,
  searchParams,
}: {
  params: { token: string };
  searchParams: { error?: string };
}) {
  const supabase = createClient();
  const { data: rpcData } = await supabase
    .rpc("get_invite_info", { p_token: params.token })
    .maybeSingle();
  const info = rpcData as InviteInfo | null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="mb-6 text-center text-2xl font-semibold text-gray-900">
          Campaign Monster
        </h1>

        {searchParams.error && (
          <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {searchParams.error}
          </p>
        )}

        {!info || info.status !== "pending" ? (
          <p className="text-sm text-gray-600">
            This invite link is invalid, expired, or has already been used.
            Ask your admin to send a new one.
          </p>
        ) : (
          <>
            <p className="mb-4 text-sm text-gray-600">
              You&apos;ve been invited to join{" "}
              <span className="font-medium text-gray-900">{info.organization_name}</span>{" "}
              on Campaign Monster.
            </p>
            <AcceptInviteForm token={params.token} email={info.email} />
          </>
        )}
      </div>
    </div>
  );
}
