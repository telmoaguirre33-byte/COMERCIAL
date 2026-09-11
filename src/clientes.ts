import { supabase } from "./supabase";

export type ClienteSigo = {
  id: string;
  empresa_id: string;
  nombre: string;
  documento: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  limite_credito: number | null;
  saldo_actual: number;
  activo: boolean;
  created_at: string;
  updated_at: string;
};

export type ClienteInput = {
  id?: string | null;
  empresaId: string;
  nombre: string;
  documento?: string | null;
  telefono?: string | null;
  email?: string | null;
  direccion?: string | null;
  limiteCredito?: number | null;
};

function texto(valor?: string | null) {
  const limpio = valor?.trim();
  return limpio ? limpio : null;
}

export async function listarClientesSigo(empresaId: string): Promise<ClienteSigo[]> {
  const { data, error } = await supabase
    .from("clientes_sigo")
    .select("id,empresa_id,nombre,documento,telefono,email,direccion,limite_credito,saldo_actual,activo,created_at,updated_at")
    .eq("empresa_id", empresaId)
    .eq("activo", true)
    .order("nombre", { ascending: true });

  if (error) throw error;
  return (data ?? []) as ClienteSigo[];
}

export async function guardarClienteSigo(input: ClienteInput): Promise<ClienteSigo> {
  if (!input.empresaId) throw new Error("Seleccioná una empresa activa.");
  if (!input.nombre.trim()) throw new Error("El nombre del cliente es obligatorio.");

  const payload = {
    empresa_id: input.empresaId,
    nombre: input.nombre.trim(),
    documento: texto(input.documento),
    telefono: texto(input.telefono),
    email: texto(input.email),
    direccion: texto(input.direccion),
    limite_credito: input.limiteCredito == null ? null : Number(input.limiteCredito),
    updated_at: new Date().toISOString(),
  };

  const consulta = input.id
    ? supabase.from("clientes_sigo").update(payload).eq("empresa_id", input.empresaId).eq("id", input.id)
    : supabase.from("clientes_sigo").insert(payload);

  const { data, error } = await consulta.select("id,empresa_id,nombre,documento,telefono,email,direccion,limite_credito,saldo_actual,activo,created_at,updated_at").single();
  if (error) throw error;
  return data as ClienteSigo;
}

export async function registrarCobroClienteSigo(input: {
  empresaId: string;
  clienteId: string;
  importe: number;
  concepto?: string;
}): Promise<string> {
  if (!Number.isFinite(input.importe) || input.importe <= 0) throw new Error("Ingresá un importe de cobro válido.");

  const { data, error } = await supabase.rpc("registrar_cobro_cliente_sigo", {
    p_empresa_id: input.empresaId,
    p_cliente_id: input.clienteId,
    p_importe: input.importe,
    p_concepto: input.concepto?.trim() || "Cobro cuenta corriente",
  });

  if (error) throw error;
  return String(data);
}
