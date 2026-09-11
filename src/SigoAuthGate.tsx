import { FormEvent, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

type Props = {
  children: React.ReactNode;
};

export default function SigoAuthGate({ children }: Props) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;

    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!mounted) return;
      if (sessionError) setError("No se pudo verificar la sesión.");
      setSession(data.session ?? null);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function iniciarSesion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    const { error: loginError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (loginError) {
      setError("Email o contraseña incorrectos, o usuario no habilitado.");
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
  }

  if (loading) {
    return <main className="sigo-auth-screen">Verificando sesión…</main>;
  }

  if (session) return <>{children}</>;

  return (
    <main className="sigo-auth-screen">
      <section className="sigo-auth-card" aria-labelledby="sigo-login-title">
        <div className="sigo-auth-brand">
          <strong>SIGO</strong>
          <span>Sistema Inteligente de Gestión Operativa</span>
        </div>
        <h1 id="sigo-login-title">Ingresar</h1>
        <p>Accedé con tu usuario habilitado para trabajar dentro de tu empresa.</p>

        <form onSubmit={iniciarSesion} className="sigo-auth-form">
          <label>
            Email
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label>
            Contraseña
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>

          {error ? <div className="sigo-auth-error" role="alert">{error}</div> : null}

          <button type="submit" disabled={submitting}>
            {submitting ? "Ingresando…" : "Entrar a SIGO"}
          </button>
        </form>
      </section>
    </main>
  );
}
