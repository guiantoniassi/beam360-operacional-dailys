import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { listRecentWeeks } from '@/lib/weekly';

// GET /api/weekly — lista semanas recentes (com ou sem review)
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (session.role !== 'orchestrator') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const weeks = await listRecentWeeks();
  return NextResponse.json({ weeks });
}
