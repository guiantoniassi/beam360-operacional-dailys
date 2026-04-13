'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';

interface TopBarProps {
  userName: string;
  role: 'member' | 'orchestrator';
  color?: string;
}

export default function TopBar({ userName, role, color = '#6366f1' }: TopBarProps) {
  const router = useRouter();
  const pathname = usePathname();

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  const navItems =
    role === 'orchestrator'
      ? [
          { href: '/orchestrate', label: 'Dashboard' },
          { href: '/orchestrate/clients', label: 'Clientes' },
          { href: '/orchestrate/weekly', label: 'Weekly' },
        ]
      : [
          { href: '/tasks', label: 'Minhas Tarefas' },
          { href: '/tasks/history', label: 'Histórico' },
        ];

  return (
    <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href={role === 'orchestrator' ? '/orchestrate' : '/tasks'} className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="Beam360" className="h-7 w-auto" />
            <span className="hidden sm:block text-xs text-zinc-500 border-l border-zinc-700 pl-2.5">
              Operacional
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                    active
                      ? 'bg-zinc-800 text-white'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-semibold"
              style={{ backgroundColor: color }}
            >
              {userName.charAt(0).toUpperCase()}
            </div>
            <div className="hidden sm:block">
              <div className="text-sm font-medium">{userName}</div>
              <div className="text-xs text-zinc-500 capitalize">
                {role === 'orchestrator' ? 'Orquestrador' : 'Colaborador'}
              </div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="text-xs text-zinc-400 hover:text-white px-3 py-2 rounded-lg hover:bg-zinc-800/50 transition"
          >
            Sair
          </button>
        </div>
      </div>
    </header>
  );
}
