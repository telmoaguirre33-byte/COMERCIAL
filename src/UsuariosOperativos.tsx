import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { RolEmpresaSigo } from "./tenant";
import { listarClientesSigo, type ClienteSigo } from "./clientes";
import {
  actualizarUsuarioEmpresaSigo,
  agregarUsuarioEmpresaSigo,
  listarUsuariosEmpresaSigo,
  listarVinculosPortalClienteSigo,
  vincularUsuarioClienteSigo,
  type UsuarioEmpresaSigo,
  type VinculoPortalClienteSigo,
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
  const [clientes, setClientes] = useState<ClienteSigo[]>([]);
  const [vinculos, setVinculos] = useState<VinculoPortalClienteSigo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [rol, setRol] = useState<SigoRole>(actorRol === "admin" ? "seller" : "admin");
  const [clienteNuevoId, setClienteNuevoId] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const requestRef = useRef(0);

  const rolesPermitidos = useMemo<SigoRole[]>(
    () => actorRol === "admin" ? ["seller", "warehouse", "client"] : ["admin", "seller", "warehouse", "client"],
    [actorRol],
  );

  const vinculoPorUsuario = useMemo(() => {
    const mapa = new Map<string, VinculoPortalClienteSigo>();
    for (const vinculo of vinculos) mapa.set(vinculo.user_id, vinculo);
    return mapa;
  }, [vinculos]);

  async function cargar() {
    const requestId = ++requestRef.current;
    setLoading(true);
    setError("");
    try {
      const [usuariosData, clientesData, vinculosData] = await Promise.all([
        listarUsuariosEmpresaSigo(empresaId),
        listarClientesSigo(empresaId),
        listarVinculosPortalClienteSigo(empresaId),
      ]);
      if (requestId !== requestRef.current) return;
      setUsuarios(usuariosData);
      setClientes(clientesData);
      setVinculos(vinculosData);
    } catch (err) {
      if (requestId !== requestRef.current) return;
      setUsuarios([]);
      setClientes([]);
      setVinculos([]);
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
    if (rol === "client" && !clienteNuevoId) {
      setError("Elegí qué cliente comercial podrá ver este usuario en el Portal Cliente.");
      return;
    }

    setSaving(true);
    setError("");
    let membresiaCreada: string | null = null;
    try {
      membresiaCreada = await agregarUsuarioEmpresaSigo(empresaId, email, rol);
      if (rol === "client") {
        await vincularUsuarioClienteSigo(empresaId, membresiaCreada, clienteNuevoId);
      }
      setEmail("");
      setClienteNuevoId("");
      setRol(actorRol === "admin" ? "seller" : "admin");
      await cargar();
    } catch (err) {
      if (membresiaCreada) {
        try { await cargar(); } catch { /* cargar() ya presenta el error si corresponde */ }
      }
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

  async function guardarVinculo(usuario: UsuarioEmpresaSigo, clienteId: string) {
    if (usuario.rol !== "client" || !usuario.activo || !puedeEditar(usuario)) return;
    setLinkingId(usuario.membresia_id);
    setError("");
    try {
      await vincularUsuarioClienteSigo(empresaId, usuario.membresia_id, clienteId || null);
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo vincular el Portal Cliente.");
    } finally {
      setLinkingId(null);
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
        <p>La persona debe haber creado primero una cuenta de usuario SIGO con ese email. Si es Cliente, vinculalo a un cliente comercial concreto para habilitar su portal.</p>
        <form className="form-grid" onSubmit={(event) => void agregar(event)}>
          <div className="form-group form-span-2">
            <label htmlFor="usuario-email">Email</label>
            <input id="usuario-email" type="email" inputMode="email" autoCapitalize="none" spellCheck={false} value={email} onChange={(event) => setEmail(event.target.value)} required />
          </div>
          <div className="form-group">
            <label htmlFor="usuario-rol">Rol</label>
            <select
              id="usuario-rol"
              value={rol}
              onChange={(event) => {
                const nextRol = event.target.value as SigoRole;
                setRol(nextRol);
                if (nextRol !== "client") setClienteNuevoId("");
              }}
            >
              {rolesPermitidos.map((item) => <option key={item} value={item}>{ROLE_LABELS[item]}</option>)}
            </select>
          </div>
          {rol === "client" ? (
            <div className="form-group">
              <label htmlFor="usuario-cliente">Cliente comercial</label>
              <select id="usuario-cliente" value={clienteNuevoId} onChange={(event) => setClienteNuevoId(event.target.value)} required>
                <option value="">Seleccionar cliente…</option>
                {clientes.map((cliente) => <option key={cliente.id} value={cliente.id}>{cliente.nombre}</option>)}
              </select>
              {clientes.length === 0 ? <small>Primero cargá al cliente en Clientes / Ctas. corrientes.</small> : null}
            </div>
          ) : null}
          <div className="form-group" style={{ alignSelf: "end" }}>
            <button className="primary-button" type="submit" disabled={saving || (rol === "client" && !clienteNuevoId)}>{saving ? "Agregando…" : "Agregar a la empresa"}</button>
          </div>
        </form>
        {error ? <p className="sigo-onboarding-error" role="alert">{error}</p> : null}
      </div>

      <div className="panel">
        <div className="table-wrapper">
          <table className="products-table">
            <thead><tr><th>Usuario</th><th>Rol</th><th>Cliente portal</th><th>Estado</th><th>Acción</th></tr></thead>
            <tbody>
              {usuarios.map((usuario) => {
                const editable = puedeEditar(usuario);
                const busy = editingId === usuario.membresia_id || linkingId === usuario.membresia_id;
                const vinculo = vinculoPorUsuario.get(usuario.user_id);
                const vinculoValido = vinculo?.vinculos_activos === 1 && Boolean(vinculo.cliente_id);
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
                    <td>
                      {usuario.rol === "client" ? (
                        <>
                          <select
                            value={vinculoValido ? vinculo?.cliente_id ?? "" : ""}
                            disabled={!editable || !usuario.activo || busy}
                            onChange={(event) => void guardarVinculo(usuario, event.target.value)}
                          >
                            <option value="">Sin vincular</option>
                            {clientes.map((cliente) => <option key={cliente.id} value={cliente.id}>{cliente.nombre}</option>)}
                          </select>
                          {!usuario.activo ? <small>Portal bloqueado: usuario inactivo.</small> : null}
                          {usuario.activo && (vinculo?.vinculos_activos ?? 0) === 0 ? <small>Sin acceso al portal hasta vincular un cliente.</small> : null}
                          {usuario.activo && (vinculo?.vinculos_activos ?? 0) > 1 ? <small>Vinculación inválida: elegí un cliente para corregirla.</small> : null}
                          {usuario.activo && vinculoValido ? <small>Portal limitado a {vinculo?.cliente_nombre ?? "este cliente"}.</small> : null}
                        </>
                      ) : "—"}
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
