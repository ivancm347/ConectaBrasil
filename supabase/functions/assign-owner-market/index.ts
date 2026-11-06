import { createClient } from "npm:@supabase/supabase-js@2";

// Operação única e restrita: vincula a conta proprietária conhecida ao Brasil.
// Não recebe user_id nem market_code do navegador.
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
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // Trava adicional: mesmo após deploy, a operação permanece desligada
  // até que um administrador habilite explicitamente esta variável.
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
  if (!token) return json({ error: "Authentication required" }, 401);

  // Valida a identidade no Auth; não confia em claims enviados pelo cliente.
  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: callerData, error: callerError } = await authClient.auth.getUser(token);
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

  // Cliente privilegiado existe somente no servidor.
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
    return json({ error: "A global administrator cannot receive an exclusive market assignment" }, 409);
  }
  const existingMarket = currentMetadata.market_code;
  if (existingMarket && existingMarket !== "BR") {
    return json({ error: "Target already has a different market assignment" }, 409);
  }

  if (existingMarket === "BR") {
    return json({ ok: true, unchanged: true, market_code: "BR" });
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

// Registrar a operação na auditoria.
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
}); ({ error: "Could not update target account" }, 500);
}

// Registrar a operação na auditoria.
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