'use client';

import { FormEvent, useMemo, useState } from 'react';
import { Client } from '@/lib/types';
import { formatBR } from '@/lib/dates';

interface Props {
  initialClients: Client[];
}

const STATUS_META: Record<Client['status'], { label: string; color: string }> = {
  active: { label: 'Ativo', color: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' },
  paused: { label: 'Pausado', color: 'bg-amber-500/10 text-amber-300 border-amber-500/30' },
  ended: { label: 'Encerrado', color: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30' },
};

const TYPE_META: Record<Client['type'], { label: string; color: string }> = {
  regular: { label: 'Regular', color: 'bg-green-500/10 text-green-300 border-green-500/30' },
  event: { label: 'Evento', color: 'bg-purple-500/10 text-purple-300 border-purple-500/30' },
};

const DEMAND_LABELS: Record<string, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
};

type FormState = {
  name: string;
  type: Client['type'];
  demand_level: '' | 'low' | 'medium' | 'high';
  deadline: string;
  notes: string;
};

const emptyForm: FormState = {
  name: '',
  type: 'regular',
  demand_level: '',
  deadline: '',
  notes: '',
};

export default function ClientsManager({ initialClients }: Props) {
  const [clients, setClients] = useState<Client[]>(initialClients);
  const [filter, setFilter] = useState<'all' | Client['status']>('all');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (filter === 'all') return clients;
    return clients.filter((c) => c.status === filter);
  }, [clients, filter]);

  const counts = useMemo(() => {
    return {
      all: clients.length,
      active: clients.filter((c) => c.status === 'active').length,
      paused: clients.filter((c) => c.status === 'paused').length,
      ended: clients.filter((c) => c.status === 'ended').length,
    };
  }, [clients]);

  function openNew() {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
    setError(null);
  }

  function openEdit(client: Client) {
    setEditingId(client.id);
    setForm({
      name: client.name,
      type: client.type,
      demand_level: (client.demand_level as FormState['demand_level']) || '',
      deadline: client.deadline || '',
      notes: client.notes || '',
    });
    setShowForm(true);
    setError(null);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const payload = {
        name: form.name.trim(),
        type: form.type,
        demand_level: form.demand_level || null,
        deadline: form.deadline || null,
        notes: form.notes || null,
      };

      const url = editingId ? `/api/clients/${editingId}` : '/api/clients';
      const method = editingId ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Erro ao salvar cliente');
        return;
      }
      if (editingId) {
        setClients((prev) =>
          prev.map((c) => (c.id === editingId ? { ...c, ...data.client } : c))
        );
      } else {
        setClients((prev) => [...prev, data.client].sort((a, b) => a.name.localeCompare(b.name)));
      }
      closeForm();
    } finally {
      setBusy(false);
    }
  }

  async function updateStatus(client: Client, status: Client['status']) {
    setError(null);
    const res = await fetch(`/api/clients/${client.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Erro ao atualizar');
      return;
    }
    setClients((prev) => prev.map((c) => (c.id === client.id ? { ...c, ...data.client } : c)));
  }

  async function handleDelete(client: Client) {
    if (!confirm(`Deletar "${client.name}"? Só funciona se não houver tarefas associadas.`)) return;
    setError(null);
    const res = await fetch(`/api/clients/${client.id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Erro ao deletar');
      return;
    }
    setClients((prev) => prev.filter((c) => c.id !== client.id));
  }

  return (
    <main className="max-w-5xl mx-auto px-4 md:px-6 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold">Clientes</h1>
          <p className="text-zinc-400 text-sm mt-2">
            Gerencie os clientes e eventos que a agência está atendendo.
          </p>
        </div>
        <button
          onClick={openNew}
          className="bg-green-500 hover:bg-green-600 text-white font-medium px-4 py-2.5 rounded-lg transition self-start md:self-auto"
        >
          + Novo cliente
        </button>
      </div>

      {error && (
        <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        <FilterPill
          active={filter === 'all'}
          onClick={() => setFilter('all')}
          label={`Todos (${counts.all})`}
        />
        <FilterPill
          active={filter === 'active'}
          onClick={() => setFilter('active')}
          label={`Ativos (${counts.active})`}
        />
        <FilterPill
          active={filter === 'paused'}
          onClick={() => setFilter('paused')}
          label={`Pausados (${counts.paused})`}
        />
        <FilterPill
          active={filter === 'ended'}
          onClick={() => setFilter('ended')}
          label={`Encerrados (${counts.ended})`}
        />
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-zinc-500">
          <p className="text-lg">Nenhum cliente nesta categoria.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((client) => (
            <div
              key={client.id}
              className="bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700 rounded-xl p-4 transition group"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-zinc-100 font-semibold">{client.name}</h3>
                    <span
                      className={`text-xs px-2 py-0.5 rounded border ${TYPE_META[client.type].color}`}
                    >
                      {TYPE_META[client.type].label}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded border ${STATUS_META[client.status].color}`}
                    >
                      {STATUS_META[client.status].label}
                    </span>
                    {client.demand_level && (
                      <span className="text-xs px-2 py-0.5 rounded border bg-zinc-800/60 text-zinc-300 border-zinc-700">
                        Demanda: {DEMAND_LABELS[client.demand_level]}
                      </span>
                    )}
                    {client.deadline && (
                      <span className="text-xs px-2 py-0.5 rounded border bg-blue-500/10 text-blue-300 border-blue-500/30">
                        Deadline: {formatBR(client.deadline)}
                      </span>
                    )}
                  </div>
                  {client.notes && (
                    <p className="text-sm text-zinc-400 mt-2">{client.notes}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition flex-shrink-0">
                  <button
                    onClick={() => openEdit(client)}
                    className="text-xs text-zinc-400 hover:text-white px-2 py-1 rounded hover:bg-zinc-800 transition"
                    title="Editar"
                  >
                    Editar
                  </button>
                  {client.status === 'active' ? (
                    <button
                      onClick={() => updateStatus(client, 'paused')}
                      className="text-xs text-zinc-400 hover:text-amber-300 px-2 py-1 rounded hover:bg-zinc-800 transition"
                    >
                      Pausar
                    </button>
                  ) : client.status === 'paused' ? (
                    <button
                      onClick={() => updateStatus(client, 'active')}
                      className="text-xs text-zinc-400 hover:text-emerald-300 px-2 py-1 rounded hover:bg-zinc-800 transition"
                    >
                      Reativar
                    </button>
                  ) : (
                    <button
                      onClick={() => updateStatus(client, 'active')}
                      className="text-xs text-zinc-400 hover:text-emerald-300 px-2 py-1 rounded hover:bg-zinc-800 transition"
                    >
                      Reabrir
                    </button>
                  )}
                  {client.status !== 'ended' && (
                    <button
                      onClick={() => updateStatus(client, 'ended')}
                      className="text-xs text-zinc-400 hover:text-zinc-200 px-2 py-1 rounded hover:bg-zinc-800 transition"
                    >
                      Encerrar
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(client)}
                    className="text-xs text-zinc-500 hover:text-red-400 px-2 py-1 rounded hover:bg-zinc-800 transition"
                    title="Deletar"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">
              {editingId ? 'Editar cliente' : 'Novo cliente'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">
                  Nome
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  autoFocus
                  className="w-full px-3 py-2 bg-zinc-950/60 border border-zinc-700 rounded-lg text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">
                    Tipo
                  </label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value as Client['type'] })}
                    className="w-full px-3 py-2 bg-zinc-950/60 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="regular">Regular</option>
                    <option value="event">Evento</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">
                    Demanda
                  </label>
                  <select
                    value={form.demand_level}
                    onChange={(e) =>
                      setForm({ ...form, demand_level: e.target.value as FormState['demand_level'] })
                    }
                    className="w-full px-3 py-2 bg-zinc-950/60 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">—</option>
                    <option value="low">Baixa</option>
                    <option value="medium">Média</option>
                    <option value="high">Alta</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">
                  Deadline {form.type === 'event' && <span className="text-purple-400">(importante p/ eventos)</span>}
                </label>
                <input
                  type="date"
                  value={form.deadline}
                  onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-950/60 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">
                  Observações
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={3}
                  placeholder="Contexto sobre o cliente, pontos de atenção..."
                  className="w-full px-3 py-2 bg-zinc-950/60 border border-zinc-700 rounded-lg text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-300 text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={busy}
                  className="flex-1 bg-green-500 hover:bg-green-600 disabled:bg-green-800 text-white font-medium py-2.5 rounded-lg transition"
                >
                  {busy ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Criar cliente'}
                </button>
                <button
                  type="button"
                  onClick={closeForm}
                  className="text-zinc-400 hover:text-white px-4 py-2.5 rounded-lg transition"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

function FilterPill({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-sm px-3 py-1.5 rounded-lg border transition ${
        active
          ? 'bg-green-500/20 text-green-300 border-green-500/40'
          : 'text-zinc-400 hover:text-white border-zinc-800 hover:border-zinc-700'
      }`}
    >
      {label}
    </button>
  );
}
