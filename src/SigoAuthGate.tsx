import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import "./auth.css";

type Props = {
  children: ReactNode;
};

type AuthMode = "login" | "recovery";

function mensajeAcceso(errorMessage: string) {
  const normalized = errorMessage.toLowerCase();
  if (normalized.includes("email not confirmed")) {
    return "Tu cuenta todavía no está activada. Revisá tu correo o pedí al administrador que reenvíe la invitación.";
  }
  if (normalized.includes("rate limit") || normalized.includes("too many requests")) {
    return "Hubo varios intentos seguidos. Esperá unos minutos y volvé a intentar.";
  }
  if (normalized.includes("banned") || normalized.includes("disabled")) {
    return "Tu acceso está deshabilitado. Contactá al administrador de tu empresa.";
  }
  if (normalized.includes("network") || normalized.includes("fetch")) {
    return "No pudimos conectarnos. Revisá tu conexión a internet e intentá otra vez.";
  }
  return "No pudimos ingresar con esos datos. Revisá el email y la contraseña o recuperá tu acceso.";
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
      if (sessionError) setError("No pudimos verificar tu sesión. Intentá nuevamente.");
      setSession(data.session ?? null);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return;
      if (event === "PASSWORD_RECOVERY") {
        setMode("recovery");
        setError("");
        setSuccess("Enlace validado. Elegí una nueva contraseña.");
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

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) return;

    setSubmitting(true);
    setError("");
    setSuccess("");

    const { data, error: loginError } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (loginError || !data.session) {
      setError(mensajeAcceso(loginError?.message ?? "unknown"));
      setSubmitting(false);
      return;
    }

    setSession(data.session);
    setEmail(normalizedEmail);
    setSubmitting(false);
  }

  async function recuperarAcceso() {
    const normalizedEmail = email.trim().toLowerCase();
    setError("");
    setSuccess("");

    if (!normalizedEmail) {
      setError("Ingresá tu email para recuperar el acceso.");
      return;
    }

    setSubmitting(true);
    const { error: recoveryError } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: `${window.location.origin}${window.location.pathname}`,
    });
    setSubmitting(false);

    if (recoveryError) {
      setError(mensajeAcceso(recoveryError.message));
      return;
    }

    setEmail(normalizedEmail);
    setSuccess("Si el email está registrado, vas a recibir un mensaje para crear una nueva contraseña.");
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
      setError("No pudimos guardar la nueva contraseña. Volvé a abrir el enlace recibido e intentá otra vez.");
      return;
    }

    setNewPassword("");
    setMode("login");
    setSuccess("Contraseña actualizada. Ya podés continuar en SIGO.");
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
            <p className="sigo-auth-subtitle">Elegí una contraseña nueva para recuperar tu acceso.</p>
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
            <p className="sigo-auth-subtitle">Ingresá con tu email y contraseña.</p>

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
                Recuperar acceso
              </button>
            </form>
          </>
        )}

        <div className="sigo-auth-help">Acceso seguro por empresa, rol y permisos.</div>
      </section>
    </main>
  );
}
