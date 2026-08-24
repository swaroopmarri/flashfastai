import { createClient } from "@/utils/supabase/server";

export default async function UnsubscribePage({
  params,
}: {
  params: { token: string };
}) {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc("unsubscribe_by_token", { p_token: params.token })
    .maybeSingle();

  const result = data as { email: string; already_unsubscribed: boolean } | null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm">
        <h1 className="mb-4 text-xl font-semibold text-gray-900">Campaign Monster</h1>
        {error || !result ? (
          <p className="text-sm text-gray-600">
            This unsubscribe link is invalid or has expired.
          </p>
        ) : (
          <p className="text-sm text-gray-600">
            {result.already_unsubscribed ? (
              <>
                <span className="font-medium">{result.email}</span> was
                already unsubscribed.
              </>
            ) : (
              <>
                <span className="font-medium">{result.email}</span> has been
                unsubscribed and won&apos;t receive future campaigns from
                this sender.
              </>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
