import { NextRequest, NextResponse } from 'next/server';
import { loginUser, createSession, setSessionCookie } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Usuário e senha são obrigatórios' },
        { status: 400 }
      );
    }

    const payload = await loginUser(username, password);
    if (!payload) {
      return NextResponse.json(
        { error: 'Usuário ou senha inválidos' },
        { status: 401 }
      );
    }

    const token = await createSession(payload);
    await setSessionCookie(token);

    return NextResponse.json({
      user: {
        username: payload.username,
        fullName: payload.fullName,
        role: payload.role,
      },
      redirect: payload.role === 'orchestrator' ? '/orchestrate' : '/tasks',
    });
  } catch (err) {
    console.error('Login error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
