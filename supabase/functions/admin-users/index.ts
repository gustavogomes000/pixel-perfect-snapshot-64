import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Use external Supabase where usuarios_painel table lives
  const supabaseUrl = Deno.env.get("EXT_SUPABASE_URL") || Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("EXT_SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const body = await req.json();
    const { action, username, password, cargo, user_id } = body;

    // Map username to email format for Supabase Auth
    const email = username ? `${username.toLowerCase().replace(/[^a-z0-9_]/g, "")}@admin.painel` : "";

    if (action === "create") {
      if (!username || !password || !cargo) {
        return json({ error: "username, password e cargo são obrigatórios" }, 400);
      }

      if (username.length < 3 || username.length > 30) {
        return json({ error: "Username deve ter entre 3 e 30 caracteres" }, 400);
      }

      if (password.length < 6) {
        return json({ error: "Senha deve ter pelo menos 6 caracteres" }, 400);
      }

      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { username },
      });

      if (authError) {
        if (authError.message.includes("already been registered")) {
          return json({ error: "Usuário já existe" }, 409);
        }
        return json({ error: authError.message }, 400);
      }

      // Create role
      const { error: roleError } = await supabase
        .from("roles_usuarios")
        .insert({ user_id: authData.user.id, cargo });

      if (roleError) {
        // Rollback: delete auth user
        await supabase.auth.admin.deleteUser(authData.user.id);
        return json({ error: roleError.message }, 400);
      }

      return json({
        success: true,
        user: {
          id: authData.user.id,
          username,
          cargo,
        },
      });
    }

    if (action === "delete") {
      if (!user_id) return json({ error: "user_id é obrigatório" }, 400);

      // Delete role first
      await supabase.from("roles_usuarios").delete().eq("user_id", user_id);
      // Delete auth user
      await supabase.auth.admin.deleteUser(user_id);

      return json({ success: true });
    }

    if (action === "list") {
      const { data: roles } = await supabase.from("roles_usuarios").select("*");
      if (!roles) return json({ users: [] });

      const users = [];
      for (const role of roles) {
        const { data: { user } } = await supabase.auth.admin.getUserById(role.user_id);
        users.push({
          id: role.id,
          user_id: role.user_id,
          username: user?.user_metadata?.username || user?.email?.split("@")[0] || "unknown",
          cargo: role.cargo,
        });
      }
      return json({ users });
    }

    if (action === "reset-password") {
      if (!user_id || !password) {
        return json({ error: "user_id e password são obrigatórios" }, 400);
      }

      if (password.length < 6) {
        return json({ error: "Senha deve ter pelo menos 6 caracteres" }, 400);
      }

      const { error: updateError } = await supabase.auth.admin.updateUserById(user_id, {
        password,
      });

      if (updateError) {
        return json({ error: updateError.message }, 400);
      }

      return json({ success: true });
    }

    if (action === "update-username") {
      if (!user_id || !username) {
        return json({ error: "user_id e username são obrigatórios" }, 400);
      }

      if (username.length < 3 || username.length > 30) {
        return json({ error: "Username deve ter entre 3 e 30 caracteres" }, 400);
      }

      const newEmail = `${username.toLowerCase().replace(/[^a-z0-9_]/g, "")}@admin.painel`;

      const { error: updateError } = await supabase.auth.admin.updateUserById(user_id, {
        email: newEmail,
        email_confirm: true,
        user_metadata: { username },
      });

      if (updateError) {
        return json({ error: updateError.message }, 400);
      }

      return json({ success: true });
    }

    return json({ error: "Ação inválida. Use: create, delete, list, reset-password, update-username" }, 400);
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
