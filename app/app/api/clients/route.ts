import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

// GET /api/clients?all=true — lista clientes (padrão: só ativos)
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const all = searchParams.get('all') === 'true';

  let query = supabaseAdmin.from('clients').select('*').order('name', { ascending: true });
  if (!all) query = query.eq('status', 'active');

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ clients: data });
}

// POST /api/clients — criar cliente (só orquestrador)
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (session.role !== 'orchestrator') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const { name, type, demand_level, deadline, notes } = body;

  if (!name || !type) {
    return NextResponse.json({ error: 'name e type são obrigatórios' }, { status: 400 });
  }
  if (!['regular', 'event'].includes(type)) {
    return NextResponse.json({ error: 'type inválido' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('clients')
    .insert({
      name: name.trim(),
      type,
      status: 'active',
      demand_level: demand_level || null,
      deadline: deadline || null,
      notes: notes || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ client: data });
}
