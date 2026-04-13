import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { todayISO } from '@/lib/dates';

// GET /api/tasks?date=YYYY-MM-DD  OR  ?start=YYYY-MM-DD&end=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');
  const date = searchParams.get('date');

  let query = supabaseAdmin
    .from('tasks')
    .select('*, client:clients(id, name), user:users(id, full_name, color)')
    .order('task_date', { ascending: false })
    .order('created_at', { ascending: true });

  if (start && end) {
    query = query.gte('task_date', start).lte('task_date', end);
  } else {
    query = query.eq('task_date', date || todayISO());
  }

  // Membros só veem suas próprias tarefas
  if (session.role === 'member') {
    query = query.eq('user_id', session.userId);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ tasks: data });
}

// POST /api/tasks
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json();
  const { description, client_id, area, task_type, task_date, user_id } = body;

  if (!description || !task_date) {
    return NextResponse.json({ error: 'description e task_date são obrigatórios' }, { status: 400 });
  }

  // Membros só podem criar tarefas pra si mesmos
  const effectiveUserId = session.role === 'orchestrator' ? user_id || session.userId : session.userId;

  const { data, error } = await supabaseAdmin
    .from('tasks')
    .insert({
      user_id: effectiveUserId,
      client_id: client_id || null,
      description,
      area: area || null,
      task_type: task_type || 'pontual',
      status: 'pending',
      task_date,
      origin_date: task_date,
    })
    .select('*, client:clients(id, name)')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ task: data });
}
