import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from 'react';
import {
  User,
  Contact,
  Occurrence,
  DeviceStatus,
  OccurrenceStatus,
  SafePlace,
  AppRole,
  AppSettings,
  ResponderUnit,
  TimelineEvent,
  STATUS_LABELS,
} from '../types';

interface AppContextData {
  user: User | null;
  setUser: (user: User | null) => void;
  login: (email: string, password: string) => { ok: boolean; message?: string };
  logout: () => void;
  updateUser: (data: Partial<User>) => void;
  role: AppRole;
  setRole: (role: AppRole) => void;
  contacts: Contact[];
  addContact: (contact: Contact) => void;
  updateContact: (id: string, data: Partial<Contact>) => void;
  removeContact: (id: string) => void;
  places: SafePlace[];
  activePlaceId: string;
  addPlace: (label: string, address: string) => void;
  removePlace: (id: string) => void;
  setActivePlaceId: (id: string) => void;
  occurrences: Occurrence[];
  currentOccurrence: Occurrence | null;
  triggerSOS: (reason?: string) => Promise<void>;
  updateOccurrenceStatus: (
    id: string,
    status: OccurrenceStatus,
    acceptedBy?: Occurrence['acceptedBy'],
  ) => void;
  acceptAlert: (occurrenceId: string, unitId: string) => boolean;
  cancelActive: () => void;
  device: DeviceStatus;
  setDeviceStatus: (status: Partial<DeviceStatus>) => void;
  isEmergencyMode: boolean;
  checkInUntil: number | null;
  startCheckIn: (minutes: number) => void;
  confirmSafe: () => void;
  settings: AppSettings;
  updateSettings: (patch: Partial<AppSettings>) => void;
  units: ResponderUnit[];
}

const AppContext = createContext<AppContextData>({} as AppContextData);

const DEMO_USER: User = {
  id: 'user-001',
  name: 'Ana Beatriz',
  email: 'ana.beatriz@email.com',
  phone: '+55 19 99999-0000',
  city: 'Hortolândia, SP',
  createdAt: new Date().toISOString(),
};

const DEMO_CONTACTS: Contact[] = [
  {
    id: 'c1',
    name: 'Maria Silva',
    phone: '+55 19 98888-1111',
    isEmergencyContact: true,
    relationship: 'Mãe',
  },
  {
    id: 'c2',
    name: 'João Santos',
    phone: '+55 19 97777-2222',
    isEmergencyContact: true,
    relationship: 'Irmão',
  },
  {
    id: 'c3',
    name: 'Carla Mendes',
    phone: '+55 19 96666-3333',
    isEmergencyContact: false,
    relationship: 'Amiga',
  },
];

const DEMO_PLACES: SafePlace[] = [
  { id: 'p1', label: 'Casa', address: 'Hortolândia, SP' },
  { id: 'p2', label: 'Trabalho', address: 'Colégio, Hortolândia' },
  { id: 'p3', label: 'Faculdade', address: 'Centro, Campinas' },
];

export const RESPONDER_UNITS: ResponderUnit[] = [
  { id: 'u1', name: 'Segurança Hotel Premium', kind: 'Segurança de hotel', area: 'Centro' },
  { id: 'u2', name: 'Delegacia da Mulher', kind: 'Polícia', area: 'Região' },
  { id: 'u3', name: 'Ronda do bairro', kind: 'Vigilância', area: 'Jardim' },
];

function stamp(text: string): TimelineEvent {
  return { at: new Date().toISOString(), text };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole>('woman');
  const [contacts, setContacts] = useState<Contact[]>(DEMO_CONTACTS);
  const [places, setPlaces] = useState<SafePlace[]>(DEMO_PLACES);
  const [activePlaceId, setActivePlaceId] = useState('p1');
  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
  const [currentOccurrence, setCurrentOccurrence] = useState<Occurrence | null>(null);
  const [device, setDevice] = useState<DeviceStatus>({
    connected: false,
    status: 'disconnected',
    battery: undefined,
  });
  const [isEmergencyMode, setIsEmergencyMode] = useState(false);
  const [checkInUntil, setCheckInUntil] = useState<number | null>(null);
  const [settings, setSettings] = useState<AppSettings>({
    discreetMode: false,
    shareLocation: true,
    notifyContacts: true,
    autoFallbackSeconds: 18,
  });

  const addContact = useCallback((contact: Contact) => {
    setContacts((prev) => [...prev, contact]);
  }, []);

  const updateContact = useCallback((id: string, data: Partial<Contact>) => {
    setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, ...data } : c)));
  }, []);

  const removeContact = useCallback((id: string) => {
    setContacts((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const addPlace = useCallback((label: string, address: string) => {
    setPlaces((prev) => [
      ...prev,
      { id: `p-${Date.now()}`, label: label.trim(), address: address.trim() },
    ]);
  }, []);

  const removePlace = useCallback((id: string) => {
    setPlaces((prev) => {
      const next = prev.filter((p) => p.id !== id);
      setActivePlaceId((cur) => (cur === id ? next[0]?.id ?? '' : cur));
      return next;
    });
  }, []);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const setDeviceStatus = useCallback((status: Partial<DeviceStatus>) => {
    setDevice((prev) => ({ ...prev, ...status }));
  }, []);

  const triggerSOS = useCallback(
    async (reason = 'Botão SOS pressionado') => {
      const place = places.find((p) => p.id === activePlaceId) ?? places[0];
      const warned = contacts.filter((c) => c.isEmergencyContact).map((c) => c.name);

      const events: TimelineEvent[] = [
        stamp(reason),
        stamp(
          settings.shareLocation
            ? `Local enviado: ${place?.address ?? 'sem referência'}`
            : 'Localização desligada nas configurações',
        ),
        stamp(
          settings.notifyContacts && warned.length
            ? `Rede avisada: ${warned.join(', ')}`
            : 'Nenhum contato marcado para alerta',
        ),
        stamp('Na fila da região. Quem aceitar primeiro assume.'),
      ];

      const newOccurrence: Occurrence = {
        id: `ALIA-${Date.now().toString(36).toUpperCase()}`,
        userId: user?.id || 'anonymous',
        status: 'waiting',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        reason,
        placeLabel: place?.label,
        events,
        location: settings.shareLocation
          ? {
              latitude: -22.8583,
              longitude: -47.22,
              address: place?.address ?? 'Hortolândia, SP',
            }
          : undefined,
      };

      setCurrentOccurrence(newOccurrence);
      setOccurrences((prev) => [newOccurrence, ...prev]);
      setIsEmergencyMode(true);
      setCheckInUntil(null);
      setRole('woman');
    },
    [user, places, activePlaceId, contacts, settings],
  );

  const updateOccurrenceStatus = useCallback(
    (id: string, status: OccurrenceStatus, acceptedBy?: Occurrence['acceptedBy']) => {
      const eventText = STATUS_LABELS[status];
      setOccurrences((prev) =>
        prev.map((o) =>
          o.id === id
            ? {
                ...o,
                status,
                acceptedBy: acceptedBy ?? o.acceptedBy,
                updatedAt: new Date().toISOString(),
                events: [...(o.events ?? []), stamp(eventText)],
              }
            : o,
        ),
      );
      setCurrentOccurrence((prev) =>
        prev?.id === id
          ? {
              ...prev,
              status,
              acceptedBy: acceptedBy ?? prev.acceptedBy,
              updatedAt: new Date().toISOString(),
              events: [...(prev.events ?? []), stamp(eventText)],
            }
          : prev,
      );
      if (status === 'finished' || status === 'cancelled') {
        setIsEmergencyMode(false);
        setCurrentOccurrence(null);
      }
    },
    [],
  );

  const acceptAlert = useCallback(
    (occurrenceId: string, unitId: string) => {
      const occ = occurrences.find((o) => o.id === occurrenceId);
      const unit = RESPONDER_UNITS.find((u) => u.id === unitId);
      if (!occ || !unit) return false;
      if (['accepted', 'in_progress', 'finished', 'cancelled'].includes(occ.status)) {
        return false;
      }
      const acceptedBy: Occurrence['acceptedBy'] = {
        id: unit.id,
        name: unit.name,
        type: unit.kind.includes('Polícia')
          ? 'police'
          : unit.kind.toLowerCase().includes('hotel')
            ? 'hotel_security'
            : 'professional',
      };
      const text = `${unit.name} aceitou. Os demais só veem em andamento.`;
      setOccurrences((prev) =>
        prev.map((o) =>
          o.id === occurrenceId
            ? {
                ...o,
                status: 'accepted' as const,
                acceptedBy,
                updatedAt: new Date().toISOString(),
                events: [...(o.events ?? []), stamp(text)],
              }
            : o,
        ),
      );
      setCurrentOccurrence((prev) =>
        prev?.id === occurrenceId
          ? {
              ...prev,
              status: 'accepted',
              acceptedBy,
              updatedAt: new Date().toISOString(),
              events: [...(prev.events ?? []), stamp(text)],
            }
          : prev,
      );
      return true;
    },
    [occurrences],
  );

  const cancelActive = useCallback(() => {
    if (!currentOccurrence) return;
    updateOccurrenceStatus(currentOccurrence.id, 'cancelled');
  }, [currentOccurrence, updateOccurrenceStatus]);

  const startCheckIn = useCallback((minutes: number) => {
    setCheckInUntil(Date.now() + minutes * 60_000);
  }, []);

  const confirmSafe = useCallback(() => {
    setCheckInUntil(null);
  }, []);

  // Check-in expiry → SOS
  useEffect(() => {
    if (!checkInUntil) return;
    const id = setInterval(() => {
      if (Date.now() >= checkInUntil) {
        clearInterval(id);
        setCheckInUntil(null);
        triggerSOS('Check-in não confirmado a tempo');
      }
    }, 1000);
    return () => clearInterval(id);
  }, [checkInUntil, triggerSOS]);

  // Auto-fallback if nobody accepts
  useEffect(() => {
    if (!currentOccurrence || currentOccurrence.status !== 'waiting') return;
    const ms = (settings.autoFallbackSeconds || 18) * 1000;
    const t = setTimeout(() => {
      const still = currentOccurrence;
      if (still.status === 'waiting') {
        updateOccurrenceStatus(still.id, 'accepted', {
          id: 'fallback-police',
          name: 'Delegacia da região',
          type: 'police',
        });
      }
    }, ms);
    return () => clearTimeout(t);
  }, [currentOccurrence?.id, currentOccurrence?.status, settings.autoFallbackSeconds]);


  const login = useCallback((email: string, password: string) => {
    const e = email.trim().toLowerCase();
    const p = password.trim();
    if (!e || !p) {
      return { ok: false, message: 'Preencha e-mail e senha.' };
    }
    if (p.length < 4) {
      return { ok: false, message: 'Senha deve ter pelo menos 4 caracteres.' };
    }
    // Demo: qualquer senha válida entra no perfil inicial
    const isDemo =
      e === DEMO_USER.email.toLowerCase() ||
      e === 'ana' ||
      e.includes('ana');
    setUser({
      ...DEMO_USER,
      email: isDemo ? DEMO_USER.email : e,
      name: isDemo ? DEMO_USER.name : e.split('@')[0] || 'Usuária',
    });
    return { ok: true };
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setRole('woman');
  }, []);

  const updateUser = useCallback((data: Partial<User>) => {
    setUser((prev) => (prev ? { ...prev, ...data } : prev));
  }, []);

  return (
    <AppContext.Provider
      value={{
        user,
        setUser,
        login,
        logout,
        updateUser,
        role,
        setRole,
        contacts,
        addContact,
        updateContact,
        removeContact,
        places,
        activePlaceId,
        addPlace,
        removePlace,
        setActivePlaceId,
        occurrences,
        currentOccurrence,
        triggerSOS,
        updateOccurrenceStatus,
        acceptAlert,
        cancelActive,
        device,
        setDeviceStatus,
        isEmergencyMode,
        checkInUntil,
        startCheckIn,
        confirmSafe,
        settings,
        updateSettings,
        units: RESPONDER_UNITS,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}
