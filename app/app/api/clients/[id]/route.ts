import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

// PATCH /api/clients/[id] — atualizar cliente (só orquestrador)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (session.role !== 'orchestrator') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();

  const updateData: Record<string, unknown> = {};
  if (body.name !== undefined) updateData.name = body.name.trim();
  if (body.type !== undefined) {
    if (!['regular', 'event'].includes(body.type)) {
      return NextResponse.json({ error: 'type inválido' }, { status: 400 });
    }
    updateData.type = body.type;
  }
  if (body.status !== undefined) {
    if (!['active', 'paused', 'ended'].includes(body.status)) {
      return NextResponse.json({ error: 'status inválido' }, { status: 400 });
    }
    updateData.status = body.status;
  }
  if (body.demand_level !== undefined) updateData.demand_level = body.demand_level || null;
  if (body.deadline !== undefined) updateData.deadline = body.deadline || null;
  if (body.notes !== undefined) updateData.notes = body.notes || null;

  const { data, error } = await supabaseAdmin
    .from('clients')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ client: data });
}

// DELETE /api/clients/[id] — só deleta se não tiver tarefas associadas; caso contrário, arquiva
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (session.role !== 'orchestrator') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { id } = await params;

  const { count } = await supabaseAdmin
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', id);

  if ((count || 0) > 0) {
    return NextResponse.json(
      {
        error: `Cliente tem ${count} tarefa(s) no histórico e não pode ser deletado. Arquive-o em vez disso.`,
      },
      { status: 400 }
    );
  }

  const { error } = await supabaseAdmin.from('clients').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
