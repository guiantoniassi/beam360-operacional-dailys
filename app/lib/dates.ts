import {
  format,
  parseISO,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isWeekend,
  addDays,
  subDays,
  isSameDay,
  isToday,
  isBefore,
  startOfDay,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function todayISO(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export function toISO(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export function fromISO(iso: string): Date {
  return parseISO(iso);
}

export function formatBR(date: Date | string, pattern = 'dd/MM/yyyy'): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, pattern, { locale: ptBR });
}

export function formatLong(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR });
}

export function isWeekday(date: Date): boolean {
  return !isWeekend(date);
}

export function getWeekdaysOfMonth(year: number, month: number): Date[] {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  return eachDayOfInterval({ start, end }).filter(isWeekday);
}

export function getCurrentWeekDays(): Date[] {
  const today = new Date();
  const start = startOfWeek(today, { weekStartsOn: 1 });
  const end = endOfWeek(today, { weekStartsOn: 1 });
  return eachDayOfInterval({ start, end }).filter(isWeekday);
}

export function getWeekRange(date: Date): { start: Date; end: Date } {
  const start = startOfWeek(date, { weekStartsOn: 1 });
  const end = addDays(start, 4); // Mon–Fri only
  return { start, end };
}

export function getPreviousWeekday(date: Date): Date {
  let prev = subDays(date, 1);
  while (isWeekend(prev)) {
    prev = subDays(prev, 1);
  }
  return prev;
}

export function getNextWeekday(date: Date): Date {
  let next = addDays(date, 1);
  while (isWeekend(next)) {
    next = addDays(next, 1);
  }
  return next;
}

export { isSameDay, isToday, isBefore, startOfDay };
