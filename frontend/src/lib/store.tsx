import { createContext, useContext, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  demoCurriculum,
  demoAttempts,
  progress,
  type Attempt,
  type CurriculumRecord,
  type StudentProfile,
} from '@unipath/shared';
import { api, send, ApiError } from './api';
export type User = { id: string; name: string; email: string; role: string };
export type Plan = { id: string; term: string; courseCodes: string[]; curriculumId: string };
export type Student = {
  profile: (StudentProfile & { curriculum: CurriculumRecord }) | null;
  attempts: Attempt[];
  plans: Plan[];
};
const freshGuest = (): Student => ({
  profile: {
    curriculumId: 'demo',
    campus: 'Abu Dhabi',
    currentTerm: 'Fall 2026',
    semester: 5,
    revision: 1,
    curriculum: { id: 'demo', published: true, document: demoCurriculum, revision: 1 },
  },
  attempts: structuredClone(demoAttempts),
  plans: [],
});
type Store = {
  user: User | null | undefined;
  isGuest: boolean;
  student: Student | undefined;
  loading: boolean;
  error: Error | null;
  notice: string;
  notify: (message: string) => void;
  enterGuest: () => void;
  leaveGuest: () => void;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  saveProfile: (data: unknown) => Promise<void>;
  saveAttempts: (attempts: Attempt[]) => Promise<void>;
  savePlan: (term: string, codes: string[]) => Promise<void>;
  deletePlan: (id: string) => Promise<void>;
};
const Context = createContext<Store>(null!);
export function StoreProvider({ children }: { children: ReactNode }) {
  const cache = useQueryClient();
  const navigate = useNavigate();
  const [isGuest, setGuest] = useState(() => sessionStorage.getItem('unipath-guest') === 'true');
  const [guest, setGuestData] = useState<Student>(() => {
    try {
      const stored = sessionStorage.getItem('unipath-guest-data');
      return stored ? JSON.parse(stored) : freshGuest();
    } catch {
      return freshGuest();
    }
  });
  const [notice, setNotice] = useState('');
  const auth = useQuery({
    queryKey: ['auth'],
    queryFn: () => api<{ user: User | null }>('/auth/me'),
    retry: false,
    staleTime: 60_000,
  });
  const studentQuery = useQuery({
    queryKey: ['student', auth.data?.user?.id],
    queryFn: () => api<Student>('/student'),
    enabled: !!auth.data?.user && !isGuest,
    retry: false,
  });
  const updateGuest = (next: Student) => {
    setGuestData(next);
    sessionStorage.setItem('unipath-guest-data', JSON.stringify(next));
  };
  const refresh = async () => {
    await cache.invalidateQueries({ queryKey: ['auth'] });
    await cache.invalidateQueries({ queryKey: ['student'] });
  };
  const notify = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 5000);
  };
  const saveAttempts = async (attempts: Attempt[]) => {
    if (isGuest) {
      updateGuest({ ...guest, attempts });
      return;
    }
    const student = studentQuery.data;
    if (!student?.profile) throw new Error('Finish setup first.');
    try {
      await api(
        '/student/attempts',
        send('PUT', {
          attempts: attempts.map(({ id, ...a }) => a),
          revision: student.profile.revision,
        }),
      );
      await cache.invalidateQueries({ queryKey: ['student'] });
    } catch (e) {
      if (e instanceof ApiError && e.status === 409)
        await cache.invalidateQueries({ queryKey: ['student'] });
      throw e;
    }
  };
  return (
    <Context.Provider
      value={{
        user: auth.data?.user,
        isGuest,
        student: isGuest ? guest : studentQuery.data,
        loading: isGuest ? false : auth.isPending || (!!auth.data?.user && studentQuery.isPending),
        error: isGuest ? null : (auth.error ?? studentQuery.error),
        notice,
        notify,
        enterGuest: () => {
          sessionStorage.setItem('unipath-guest', 'true');
          setGuest(true);
          navigate('/app');
        },
        leaveGuest: () => {
          sessionStorage.removeItem('unipath-guest');
          setGuest(false);
        },
        logout: async () => {
          await api('/auth/logout', send('POST'));
          sessionStorage.removeItem('unipath-guest');
          sessionStorage.removeItem('unipath-guest-data');
          setGuest(false);
          cache.clear();
          navigate('/');
        },
        refresh,
        saveAttempts,
        saveProfile: async (data) => {
          if (isGuest) {
            const d = data as StudentProfile;
            updateGuest({ ...guest, profile: { ...guest.profile!, ...d } });
          } else {
            await api('/student/profile', send('PUT', data));
            await cache.invalidateQueries({ queryKey: ['student'] });
          }
        },
        savePlan: async (term, codes) => {
          if (isGuest) {
            const next = guest.plans.filter((p) => p.term !== term);
            updateGuest({
              ...guest,
              plans: [
                ...next,
                { id: crypto.randomUUID(), curriculumId: 'demo', term, courseCodes: codes },
              ],
            });
          } else {
            await api('/student/plans', send('PUT', { term, courseCodes: codes }));
            await cache.invalidateQueries({ queryKey: ['student'] });
          }
        },
        deletePlan: async (id) => {
          if (isGuest) updateGuest({ ...guest, plans: guest.plans.filter((p) => p.id !== id) });
          else {
            await api(`/student/plans/${id}`, send('DELETE'));
            await cache.invalidateQueries({ queryKey: ['student'] });
          }
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const useStore = () => useContext(Context);
export function useAcademic() {
  const s = useStore();
  const curriculum = s.student?.profile?.curriculum.document ?? demoCurriculum;
  return {
    ...s,
    curriculum,
    attempts: s.student?.attempts ?? [],
    stats: progress(
      curriculum,
      s.student?.attempts ?? [],
      s.student?.plans.find((p) => p.term === s.student?.profile?.currentTerm)?.courseCodes ?? [],
      s.student?.profile?.currentTerm,
    ),
  };
}
