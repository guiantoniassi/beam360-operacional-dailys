import { redirect, notFound } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { compileWeekly, toWeekStart } from '@/lib/weekly';
import { supabaseAdmin } from '@/lib/supabase';
import TopBar from '@/components/TopBar';
import WeeklyPresentation from './WeeklyPresentation';

export default async function WeeklyDetailPage({
  params,
}: {
  params: Promise<{ weekStart: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role !== 'orchestrator') redirect('/tasks');

  const { weekStart: rawWeekStart } = await params;
  const weekStart = toWeekStart(rawWeekStart);

  // Redireciona se a URL não está normalizada para segunda-feira
  if (weekStart !== rawWeekStart) {
    redirect(`/orchestrate/weekly/${weekStart}`);
  }

  let compiled;
  try {
    compiled = await compileWeekly(weekStart);
  } catch {
    notFound();
  }

  const { data: members } = await supabaseAdmin
    .from('users')
    .select('id, full_name')
    .eq('role', 'member')
    .eq('is_active', true)
    .order('full_name');

  return (
    <div className="min-h-screen">
      <TopBar userName="Orquestrador" role="orchestrator" color="#f59e0b" />
      <WeeklyPresentation compiled={compiled} members={members || []} />
    </div>
  );
}
