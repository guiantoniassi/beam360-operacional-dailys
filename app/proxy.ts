import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'fallback-dev-secret-change-in-production'
);

const PUBLIC_PATHS = ['/login', '/api/auth/login'];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Liberar rotas públicas
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = req.cookies.get('beam360_session')?.value;

  if (!token) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);

    // Proteger rotas de orquestrador
    if (pathname.startsWith('/orchestrate') && payload.role !== 'orchestrator') {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }

    // Proteger rotas de membro do orquestrador (orquestrador vai pra /orchestrate)
    if (pathname.startsWith('/tasks') && payload.role === 'orchestrator') {
      return NextResponse.redirect(new URL('/orchestrate', req.url));
    }

    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL('/login', req.url));
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.).*)'],
};
