import { createClient } from "npm:@supabase/supabase-js@2";

const OWNER_USER_ID = "ba0a89e3-565e-4be6-bb2c-2365461b3114";
const ALLOWED_ORIGIN = "https://ivancm347.github.io";
const CONFIRMATION = "ASSIGN_OWNER_TO_BR";

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");

  if (origin && origin !== ALLOWED_ORIGIN) {
    return new Response("Origin not allowed", { status: 403 });
  }

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  if (Deno.env.get("ENABLE_OWNER_MARKET_ASSIGNMENT") !== "true") {
    return json({ error: "Assignment is disabled" }, 403);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: "Server configuration incomplete" }, 500);
  }

  const authorization = req.headers.get("Authorization") ?? "";
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];

  if (!token) {
    return json({ error: "Authentication required" }, 401);
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: callerData, error: callerError } =
    await authClient.auth.getUser(token);

  if (callerError || !callerData.user) {
    return json({ error: "Invalid session" }, 401);
  }

  if (callerData.user.app_metadata?.role !== "admin") {
    return json({ error: "Global administrator required" }, 403);
  }

  let body: { confirm?: string };

  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  if (body.confirm !== CONFIRMATION) {
    return json({ error: "Explicit confirmation required" }, 400);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: targetData, error: targetError } =
    await adminClient.auth.admin.getUserById(OWNER_USER_ID);

  if (targetError || !targetData.user) {
    return json({ error: "Target account not found" }, 404);
  }

  const currentMetadata = targetData.user.app_metadata ?? {};

  if (currentMetadata.role === "admin") {
    return json({
      error: "A global administrator cannot receive an exclusive market assignment",
    }, 409);
  }

  const existingMarket = currentMetadata.market_code;

  if (existingMarket && existingMarket !== "BR") {
    return json({
      error: "Target already has a different market assignment",
    }, 409);
  }

  if (existingMarket === "BR") {
  const { data: existingAudit, error: auditCheckError } =
    await adminClient
      .from("admin_audit_logs")
      .select("id")
      .eq("action", "assign_market")
      .eq("entity_id", OWNER_USER_ID)
      .contains("details", {
        operation: "assign-owner-market",
      })
      .limit(1)
      .maybeSingle();

  if (auditCheckError) {
    return json({
      error: "Could not verify audit record",
    }, 500);
  }

  if (!existingAudit) {
    const { error: recoveryAuditError } = await adminClient
      .from("admin_audit_logs")
      .insert({
        actor_id: callerData.user.id,
        actor_email: callerData.user.email ?? null,
        action: "assign_market",
        entity_type: "auth_user",
        entity_id: OWNER_USER_ID,
        entity_name: targetData.user.email ?? OWNER_USER_ID,
        details: {
          previous_market_code: null,
          new_market_code: "BR",
          operation: "assign-owner-market",
          recovered_after_partial_success: true,
        },
      });

    if (recoveryAuditError) {
      return json({
        error: "Market is BR, but audit recovery failed",
        audit_recorded: false,
      }, 500);
    }

    return json({
      ok: true,
      unchanged: true,
      market_code: "BR",
      audit_recorded: true,
      audit_recovered: true,
    });
  }

  return json({
    ok: true,
    unchanged: true,
    market_code: "BR",
    audit_recorded: true,
  });
}
  const { error: updateError } =
    await adminClient.auth.admin.updateUserById(OWNER_USER_ID, {
      app_metadata: {
        ...currentMetadata,
        market_code: "BR",
      },
    });

  if (updateError) {
    return json({ error: "Could not update target account" }, 500);
  }

  const { error: auditError } = await adminClient
    .from("admin_audit_logs")
    .insert({
      actor_id: callerData.user.id,
      actor_email: callerData.user.email ?? null,
      action: "assign_market",
      entity_type: "auth_user",
      entity_id: OWNER_USER_ID,
      entity_name: targetData.user.email ?? OWNER_USER_ID,
      details: {
        previous_market_code: existingMarket ?? null,
        new_market_code: "BR",
        operation: "assign-owner-market",
      },
    });

  if (auditError) {
    console.error("Audit insert failed:", auditError.message);

    return json({
      error: "Market assigned, but audit logging failed",
      audit_recorded: false,
      token_refresh_required: true,
    }, 500);
  }

  return json({
    ok: true,
    market_code: "BR",
    audit_recorded: true,
    token_refresh_required: true,
  });
})