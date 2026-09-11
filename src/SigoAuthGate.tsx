import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import "./auth.css";

type Props = { children: ReactNode };
type AuthMode = "login" | "register" | "recovery";

function mensajeAcceso(errorMessage: string) {
  const normalized = errorMessage.toLowerCase();
  if (normalized.includes("email not confirmed")) return "Tu cuenta todavía no está activada.";
  if (normalized.includes("already registered") || normalized.includes("user already registered")) return "Ese email ya tiene una cuenta. Ingresá o usá Recuperar acceso.";
  if (normalized.includes("rate limit") || normalized.includes("too many requests")) return "Hubo varios intentos seguidos. Esperá unos minutos y volvé a intentar.";
  if (normalized.includes("banned") || normalized.includes("disabled")) return "Tu acceso está deshabilitado. Contactá al administrador de tu empresa.";
  if (normalized.includes("network") || normalized.includes("fetch")) return "No pudimos conectarnos. Revisá tu conexión a internet e intentá otra vez.";
  return "No pudimos completar la operación. Revisá los datos e intentá nuevamente.";
}

export default function SigoAuthGate({ children }: Props) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [empresaNombre, setEmpresaNombre] = useState("");
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

  function limpiarMensajes() {
    setError("");
    setSuccess("");
  }

  function cambiarModo(next: AuthMode) {
    limpiarMensajes();
    setMode(next);
  }

  async function iniciarSesion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) return;

    setSubmitting(true);
    limpiarMensajes();
    const { data, error: loginError } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
    setSubmitting(false);

    if (loginError || !data.session) {
      setError(mensajeAcceso(loginError?.message ?? "unknown"));
      return;
    }
    setEmail(normalizedEmail);
    setSession(data.session);
  }

  async function registrarme(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const normalizedEmail = email.trim().toLowerCase();
    const nombre = empresaNombre.trim();

    if (!nombre) {
      setError("Ingresá el nombre de tu empresa o negocio.");
      return;
    }
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    setSubmitting(true);
    limpiarMensajes();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: { emailRedirectTo: `${window.location.origin}${window.location.pathname}` },
    });

    if (signUpError) {
      setSubmitting(false);
      setError(mensajeAcceso(signUpError.message));
      return;
    }

    if (!data.session) {
      setSubmitting(false);
      setSuccess("Cuenta creada. Revisá tu correo para activarla y después ingresá normalmente.");
      setMode("login");
      return;
    }

    const { error: empresaError } = await supabase.rpc("crear_empresa", {
      p_nombre: nombre,
      p_razon_social: null,
      p_cuit: null,
    });
    setSubmitting(false);

    if (empresaError) {
      setError("La cuenta se creó, pero no pudimos terminar el alta de la empresa. Volvé a intentar en unos minutos.");
      setSession(data.session);
      return;
    }

    setSuccess("Cuenta y empresa creadas correctamente. Entrando a SIGO…");
    setSession(data.session);
  }

  async function recuperarAcceso() {
    const normalizedEmail = email.trim().toLowerCase();
    limpiarMensajes();
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
    setSuccess("Si ese email tiene una cuenta, vas a recibir un mensaje para crear una nueva contraseña.");
  }

  async function guardarNuevaPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    limpiarMensajes();
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

  if (loading) return <main className="sigo-auth-screen"><section className="sigo-auth-card">Verificando sesión…</section></main>;
  if (session && mode !== "recovery") return <>{children}</>;

  const campoPassword = (value: string, onChange: (value: string) => void, autoComplete: string) => (
    <label className="sigo-auth-field">
      <span>Contraseña</span>
      <div className="sigo-password-wrap">
        <input
          type={showPassword ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          minLength={mode === "register" || mode === "recovery" ? 8 : undefined}
          required
        />
        <button className="sigo-password-toggle" type="button" onClick={() => setShowPassword((value) => !value)}>
          {showPassword ? "Ocultar" : "Ver"}
        </button>
      </div>
    </label>
  );

  return (
    <main className="sigo-auth-screen">
      <section className="sigo-auth-card" aria-labelledby="sigo-login-title">
        <div className="sigo-auth-brand">
          <div className="sigo-auth-brand-mark" aria-hidden="true">SG</div>
          <div className="sigo-auth-brand-copy"><strong>SIGO</strong><span>Sistema Inteligente de Gestión Operativa</span></div>
        </div>

        {mode === "recovery" ? (
          <>
            <h1 id="sigo-login-title">Nueva contraseña</h1>
            <p className="sigo-auth-subtitle">Elegí una contraseña nueva para recuperar tu acceso.</p>
            <form onSubmit={guardarNuevaPassword} className="sigo-auth-form">
              {campoPassword(newPassword, setNewPassword, "new-password")}
              {error ? <div className="sigo-auth-error" role="alert">{error}</div> : null}
              {success ? <div className="sigo-auth-success" role="status">{success}</div> : null}
              <button className="sigo-auth-submit" type="submit" disabled={submitting}>{submitting ? "Guardando…" : "Guardar contraseña"}</button>
            </form>
          </>
        ) : mode === "register" ? (
          <>
            <h1 id="sigo-login-title">Crear cuenta</h1>
            <p className="sigo-auth-subtitle">Creá tu empresa y quedá como administrador principal.</p>
            <form onSubmit={registrarme} className="sigo-auth-form">
              <label className="sigo-auth-field"><span>Empresa o negocio</span><input value={empresaNombre} onChange={(e) => setEmpresaNombre(e.target.value)} autoComplete="organization" required /></label>
              <label className="sigo-auth-field"><span>Email</span><input type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
              {campoPassword(password, setPassword, "new-password")}
              {error ? <div className="sigo-auth-error" role="alert">{error}</div> : null}
              {success ? <div className="sigo-auth-success" role="status">{success}</div> : null}
              <button className="sigo-auth-submit" type="submit" disabled={submitting}>{submitting ? "Creando cuenta…" : "Crear cuenta y empresa"}</button>
              <button className="sigo-auth-secondary" type="button" onClick={() => cambiarModo("login")}>Ya tengo cuenta</button>
            </form>
          </>
        ) : (
          <>
            <h1 id="sigo-login-title">Ingresar</h1>
            <p className="sigo-auth-subtitle">Ingresá con tu email y contraseña.</p>
            <form onSubmit={iniciarSesion} className="sigo-auth-form">
              <label className="sigo-auth-field"><span>Email</span><input type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
              {campoPassword(password, setPassword, "current-password")}
              {error ? <div className="sigo-auth-error" role="alert">{error}</div> : null}
              {success ? <div className="sigo-auth-success" role="status">{success}</div> : null}
              <button className="sigo-auth-submit" type="submit" disabled={submitting}>{submitting ? "Ingresando…" : "Ingresar a SIGO"}</button>
              <button className="sigo-auth-secondary" type="button" disabled={submitting} onClick={() => cambiarModo("register")}>Crear cuenta</button>
              <button className="sigo-auth-secondary" type="button" disabled={submitting} onClick={() => void recuperarAcceso()}>Recuperar acceso</button>
            </form>
          </>
        )}

        <div className="sigo-auth-help">Acceso seguro por empresa, rol y permisos.</div>
      </section>
    </main>
  );
}
