import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

// PATCH /api/tasks/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  // Membros só podem editar suas próprias tarefas
  if (session.role === 'member') {
    const { data: existing } = await supabaseAdmin
      .from('tasks')
      .select('user_id')
      .eq('id', id)
      .single();
    if (!existing || existing.user_id !== session.userId) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
  }

  const updateData: Record<string, unknown> = {};
  if (body.description !== undefined) updateData.description = body.description;
  if (body.client_id !== undefined) updateData.client_id = body.client_id;
  if (body.area !== undefined) updateData.area = body.area;
  if (body.task_type !== undefined) updateData.task_type = body.task_type;
  if (body.status !== undefined) {
    updateData.status = body.status;
    if (body.status === 'done') updateData.completed_at = new Date().toISOString();
  }

  const { data, error } = await supabaseAdmin
    .from('tasks')
    .update(updateData)
    .eq('id', id)
    .select('*, client:clients(id, name)')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ task: data });
}

// DELETE /api/tasks/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await params;

  if (session.role === 'member') {
    const { data: existing } = await supabaseAdmin
      .from('tasks')
      .select('user_id, status')
      .eq('id', id)
      .single();
    if (!existing || existing.user_id !== session.userId) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    // Não permite deletar tarefas já processadas em daily
    if (existing.status !== 'pending' && existing.status !== 'in_progress') {
      return NextResponse.json(
        { error: 'Tarefas já processadas em daily não podem ser excluídas' },
        { status: 400 }
      );
    }
  }

  const { error } = await supabaseAdmin.from('tasks').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
