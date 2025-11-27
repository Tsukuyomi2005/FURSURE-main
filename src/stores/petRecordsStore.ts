import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PetRecord } from '../types';

interface PetRecordsState {
  records: PetRecord[];
  addRecord: (record: Omit<PetRecord, 'id'>) => void;
  updateRecord: (id: string, updates: Partial<PetRecord>) => void;
  deleteRecord: (id: string) => void;
}

export const usePetRecordsStore = create<PetRecordsState>()(
  persist(
    (set) => ({
      records: [],
      addRecord: (record: Omit<PetRecord, 'id'>) =>
        set((state: PetRecordsState) => ({
          records: [...state.records, { ...record, id: Date.now().toString() }],
        })),
      updateRecord: (id: string, updates: Partial<PetRecord>) =>
        set((state: PetRecordsState) => ({
          records: state.records.map((record: PetRecord) =>
            record.id === id ? { ...record, ...updates } : record
          ),
        })),
      deleteRecord: (id: string) =>
        set((state: PetRecordsState) => ({
          records: state.records.filter((record: PetRecord) => record.id !== id),
        })),
    }),
    {
      name: 'pet-records-storage',
    }
  )
);
