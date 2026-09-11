import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import "./auth.css";

type Props = {
  children: ReactNode;
};

type AuthMode = "login" | "recovery";

function mensajeLogin(errorMessage: string) {
  const normalized = errorMessage.toLowerCase();
  if (normalized.includes("invalid login credentials")) {
    return "El email o la contraseña no coinciden. Podés recuperar la contraseña desde esta pantalla.";
  }
  if (normalized.includes("email not confirmed")) {
    return "Tu email todavía no fue confirmado. Revisá el correo de activación antes de ingresar.";
  }
  if (normalized.includes("network") || normalized.includes("fetch")) {
    return "No se pudo conectar con el servicio de acceso. Revisá internet e intentá nuevamente.";
  }
  return "No se pudo iniciar sesión. Intentá nuevamente o recuperá tu contraseña.";
}

export default function SigoAuthGate({ children }: Props) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState<AuthMode>("login");

  useEffect(() => {
    let mounted = true;

    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!mounted) return;
      if (sessionError) setError("No se pudo verificar la sesión.");
      setSession(data.session ?? null);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return;
      if (event === "PASSWORD_RECOVERY") {
        setMode("recovery");
        setError("");
        setSuccess("Enlace validado. Elegí una nueva contraseña para recuperar el acceso.");
      }
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
    if (submitting) return;
    setSubmitting(true);
    setError("");
    setSuccess("");

    const { error: loginError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (loginError) {
      setError(mensajeLogin(loginError.message));
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
  }

  async function recuperarAcceso() {
    const normalizedEmail = email.trim();
    setError("");
    setSuccess("");

    if (!normalizedEmail) {
      setError("Ingresá primero tu email para poder recuperar la contraseña.");
      return;
    }

    setSubmitting(true);
    const { error: recoveryError } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: window.location.origin,
    });
    setSubmitting(false);

    if (recoveryError) {
      setError("No se pudo enviar el correo de recuperación. Verificá el email e intentá nuevamente.");
      return;
    }

    setSuccess("Te enviamos un correo para recuperar el acceso. Abrí el enlace desde ese mensaje y volvé a SIGO.");
  }

  async function guardarNuevaPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setError("");
    setSuccess("");

    if (newPassword.length < 8) {
      setError("La nueva contraseña debe tener al menos 8 caracteres.");
      return;
    }

    setSubmitting(true);
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    setSubmitting(false);

    if (updateError) {
      setError("No se pudo guardar la nueva contraseña. Volvé a abrir el enlace de recuperación e intentá nuevamente.");
      return;
    }

    setNewPassword("");
    setMode("login");
    setSuccess("Contraseña actualizada. Tu sesión ya está habilitada para continuar en SIGO.");
  }

  if (loading) {
    return <main className="sigo-auth-screen"><section className="sigo-auth-card">Verificando sesión…</section></main>;
  }

  if (session && mode !== "recovery") return <>{children}</>;

  return (
    <main className="sigo-auth-screen">
      <section className="sigo-auth-card" aria-labelledby="sigo-login-title">
        <div className="sigo-auth-brand">
          <div className="sigo-auth-brand-mark" aria-hidden="true">SG</div>
          <div className="sigo-auth-brand-copy">
            <strong>SIGO</strong>
            <span>Sistema Inteligente de Gestión Operativa</span>
          </div>
        </div>

        {mode === "recovery" ? (
          <>
            <h1 id="sigo-login-title">Nueva contraseña</h1>
            <p className="sigo-auth-subtitle">Definí una contraseña nueva para recuperar tu acceso a SIGO.</p>
            <form onSubmit={guardarNuevaPassword} className="sigo-auth-form">
              <label className="sigo-auth-field">
                <span>Nueva contraseña</span>
                <div className="sigo-password-wrap">
                  <input
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    minLength={8}
                    required
                  />
                  <button className="sigo-password-toggle" type="button" onClick={() => setShowPassword((value) => !value)}>
                    {showPassword ? "Ocultar" : "Ver"}
                  </button>
                </div>
              </label>
              {error ? <div className="sigo-auth-error" role="alert">{error}</div> : null}
              {success ? <div className="sigo-auth-success" role="status">{success}</div> : null}
              <button className="sigo-auth-submit" type="submit" disabled={submitting}>
                {submitting ? "Guardando…" : "Guardar contraseña"}
              </button>
            </form>
          </>
        ) : (
          <>
            <h1 id="sigo-login-title">Ingresar</h1>
            <p className="sigo-auth-subtitle">Accedé con tu usuario habilitado para trabajar dentro de tu empresa.</p>

            <form onSubmit={iniciarSesion} className="sigo-auth-form">
              <label className="sigo-auth-field">
                <span>Email</span>
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </label>

              <label className="sigo-auth-field">
                <span>Contraseña</span>
                <div className="sigo-password-wrap">
                  <input
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                  />
                  <button className="sigo-password-toggle" type="button" onClick={() => setShowPassword((value) => !value)}>
                    {showPassword ? "Ocultar" : "Ver"}
                  </button>
                </div>
              </label>

              {error ? <div className="sigo-auth-error" role="alert">{error}</div> : null}
              {success ? <div className="sigo-auth-success" role="status">{success}</div> : null}

              <button className="sigo-auth-submit" type="submit" disabled={submitting}>
                {submitting ? "Ingresando…" : "Ingresar a SIGO"}
              </button>
              <button className="sigo-auth-secondary" type="button" disabled={submitting} onClick={() => void recuperarAcceso()}>
                ¿Olvidaste tu contraseña?
              </button>
            </form>
          </>
        )}

        <div className="sigo-auth-help">Acceso protegido por empresa, rol y permisos.</div>
      </section>
    </main>
  );
}
