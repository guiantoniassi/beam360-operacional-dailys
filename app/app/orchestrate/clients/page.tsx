import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import TopBar from '@/components/TopBar';
import ClientsManager from './ClientsManager';
import { Client } from '@/lib/types';

export default async function ClientsPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role !== 'orchestrator') redirect('/tasks');

  const { data } = await supabaseAdmin
    .from('clients')
    .select('*')
    .order('name', { ascending: true });

  return (
    <div className="min-h-screen">
      <TopBar userName="Orquestrador" role="orchestrator" color="#f59e0b" />
      <ClientsManager initialClients={(data as Client[]) || []} />
    </div>
  );
}
