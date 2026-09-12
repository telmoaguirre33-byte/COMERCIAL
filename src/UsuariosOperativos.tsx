import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { RolEmpresaSigo } from "./tenant";
import {
  actualizarUsuarioEmpresaSigo,
  agregarUsuarioEmpresaSigo,
  listarUsuariosEmpresaSigo,
  type UsuarioEmpresaSigo,
} from "./usuarios";
import type { SigoRole } from "./permissions";

const ROLE_LABELS: Record<SigoRole, string> = {
  superadmin: "Matriz / Superadmin",
  owner: "Propietario",
  admin: "Administrador",
  seller: "Vendedor",
  warehouse: "Depósito",
  client: "Cliente",
};

export default function UsuariosOperativos({ empresaId, actorRol }: { empresaId: string; actorRol: RolEmpresaSigo }) {
  const [usuarios, setUsuarios] = useState<UsuarioEmpresaSigo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [rol, setRol] = useState<SigoRole>(actorRol === "admin" ? "seller" : "admin");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const requestRef = useRef(0);

  const rolesPermitidos = useMemo<SigoRole[]>(
    () => actorRol === "admin" ? ["seller", "warehouse", "client"] : ["admin", "seller", "warehouse", "client"],
    [actorRol],
  );

  async function cargar() {
    const requestId = ++requestRef.current;
    setLoading(true);
    setError("");
    try {
      const data = await listarUsuariosEmpresaSigo(empresaId);
      if (requestId !== requestRef.current) return;
      setUsuarios(data);
    } catch (err) {
      if (requestId !== requestRef.current) return;
      setUsuarios([]);
      setError(err instanceof Error ? err.message : "No se pudieron cargar los usuarios.");
    } finally {
      if (requestId === requestRef.current) setLoading(false);
    }
  }

  useEffect(() => {
    void cargar();
    return () => { requestRef.current += 1; };
  }, [empresaId]);

  async function agregar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      await agregarUsuarioEmpresaSigo(empresaId, email, rol);
      setEmail("");
      setRol(actorRol === "admin" ? "seller" : "admin");
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo agregar el usuario.");
    } finally {
      setSaving(false);
    }
  }

  function puedeEditar(usuario: UsuarioEmpresaSigo) {
    if (usuario.rol === "owner") return false;
    if (actorRol === "admin" && usuario.rol === "admin") return false;
    return true;
  }

  async function guardarUsuario(usuario: UsuarioEmpresaSigo, nextRol: SigoRole, nextActivo: boolean) {
    if (!puedeEditar(usuario)) return;
    setEditingId(usuario.membresia_id);
    setError("");
    try {
      await actualizarUsuarioEmpresaSigo(empresaId, usuario.membresia_id, nextRol, nextActivo);
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar el usuario.");
    } finally {
      setEditingId(null);
    }
  }

  return (
    <div className="products-page">
      <div className="page-header">
        <div>
          <h2>Usuarios y permisos</h2>
          <p>Administrá el equipo de esta empresa sin mezclar accesos entre tenants. Los administradores sólo pueden gestionar usuarios operativos.</p>
        </div>
        <button className="admin-button" onClick={() => void cargar()} disabled={loading}>Actualizar</button>
      </div>

      <div className="panel">
        <h3>Agregar usuario</h3>
        <p>La persona debe haber creado primero una cuenta de usuario SIGO con ese email.</p>
        <form className="form-grid" onSubmit={(event) => void agregar(event)}>
          <div className="form-group form-span-2">
            <label htmlFor="usuario-email">Email</label>
            <input id="usuario-email" type="email" inputMode="email" autoCapitalize="none" spellCheck={false} value={email} onChange={(event) => setEmail(event.target.value)} required />
          </div>
          <div className="form-group">
            <label htmlFor="usuario-rol">Rol</label>
            <select id="usuario-rol" value={rol} onChange={(event) => setRol(event.target.value as SigoRole)}>
              {rolesPermitidos.map((item) => <option key={item} value={item}>{ROLE_LABELS[item]}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ alignSelf: "end" }}>
            <button className="primary-button" type="submit" disabled={saving}>{saving ? "Agregando…" : "Agregar a la empresa"}</button>
          </div>
        </form>
        {error ? <p className="sigo-onboarding-error" role="alert">{error}</p> : null}
      </div>

      <div className="panel">
        <div className="table-wrapper">
          <table className="products-table">
            <thead><tr><th>Usuario</th><th>Rol</th><th>Estado</th><th>Acción</th></tr></thead>
            <tbody>
              {usuarios.map((usuario) => {
                const editable = puedeEditar(usuario);
                const busy = editingId === usuario.membresia_id;
                return (
                  <tr key={usuario.membresia_id}>
                    <td><strong>{usuario.email || "Cuenta sin email visible"}</strong><small>{usuario.user_id}</small></td>
                    <td>
                      {editable ? (
                        <select
                          value={usuario.rol}
                          disabled={busy}
                          onChange={(event) => void guardarUsuario(usuario, event.target.value as SigoRole, usuario.activo)}
                        >
                          {rolesPermitidos.map((item) => <option key={item} value={item}>{ROLE_LABELS[item]}</option>)}
                        </select>
                      ) : ROLE_LABELS[usuario.rol]}
                    </td>
                    <td>{usuario.activo ? "Activo" : "Inactivo"}</td>
                    <td>
                      {editable ? (
                        <button className="admin-button" disabled={busy} onClick={() => void guardarUsuario(usuario, usuario.rol, !usuario.activo)}>
                          {busy ? "Guardando…" : usuario.activo ? "Desactivar" : "Reactivar"}
                        </button>
                      ) : "Protegido"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!loading && usuarios.length === 0 ? <div className="table-empty">No hay usuarios para mostrar.</div> : null}
          {loading ? <div className="table-empty">Cargando usuarios…</div> : null}
        </div>
      </div>
    </div>
  );
}
