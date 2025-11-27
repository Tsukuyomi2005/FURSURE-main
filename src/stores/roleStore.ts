import { create } from 'zustand';

interface RoleState {
  role: 'vet' | 'staff' | 'owner' | 'veterinarian' | 'clinicStaff' | null;
  setRole: (role: 'vet' | 'staff' | 'owner' | 'veterinarian' | 'clinicStaff' | null) => void;
  clearRole: () => void;
}

export const useRoleStore = create<RoleState>((set: (partial: Partial<RoleState> | ((state: RoleState) => Partial<RoleState>)) => void) => ({
  role: null,
  setRole: (role: 'vet' | 'staff' | 'owner' | 'veterinarian' | 'clinicStaff' | null) => set({ role }),
  clearRole: () => set({ role: null }),
}));
