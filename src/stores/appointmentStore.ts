import { useQuery, useMutation } from "convex/react";
// @ts-ignore - API types will be generated when Convex syncs
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import type { Appointment } from '../types';

// Helper function to convert Convex document to frontend type
function convertAppointment(doc: {
  _id: Id<"appointments">;
  _creationTime: number;
  petName: string;
  ownerName: string;
  phone: string;
  email: string;
  date: string;
  time: string;
  reason?: string;
  vet: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'rescheduled';
  notes?: string;
  serviceType?: string;
  price?: number;
  paymentStatus?: 'pending' | 'down_payment_paid' | 'fully_paid';
  paymentData?: any;
  itemsUsed?: Array<{
    itemId: string;
    quantity: number;
    itemName: string;
    itemCategory: string;
    deductionStatus?: 'pending' | 'confirmed' | 'rejected';
    loggedAt?: string;
    rejectedReason?: string;
  }>;
}): Appointment {
  return {
    id: doc._id,
    creationTime: doc._creationTime,
    petName: doc.petName,
    ownerName: doc.ownerName,
    phone: doc.phone,
    email: doc.email,
    date: doc.date,
    time: doc.time,
    reason: doc.reason,
    vet: doc.vet,
    status: doc.status,
    notes: doc.notes,
    serviceType: doc.serviceType,
    price: doc.price,
    paymentStatus: doc.paymentStatus,
    paymentData: doc.paymentData,
    itemsUsed: doc.itemsUsed,
  };
}

export function useAppointmentStore() {
  // @ts-ignore - API types will be generated when Convex syncs
  const appointmentsData = useQuery(api.appointments.list);
  // @ts-ignore
  const addAppointmentMutation = useMutation(api.appointments.add);
  // @ts-ignore
  const updateAppointmentMutation = useMutation(api.appointments.update);
  // @ts-ignore
  const deleteAppointmentMutation = useMutation(api.appointments.remove);

  const appointments: Appointment[] = appointmentsData?.map(convertAppointment) ?? [];

  const addAppointment = async (appointment: Omit<Appointment, 'id'>) => {
    await addAppointmentMutation({
      petName: appointment.petName,
      ownerName: appointment.ownerName,
      phone: appointment.phone,
      email: appointment.email,
      date: appointment.date,
      time: appointment.time,
      reason: appointment.reason,
      vet: appointment.vet,
      status: appointment.status,
      notes: appointment.notes,
      serviceType: appointment.serviceType,
      price: appointment.price,
      paymentStatus: appointment.paymentStatus,
      paymentData: appointment.paymentData,
    });
  };

  const updateAppointment = async (id: string, updates: Partial<Appointment>) => {
    const updateData: {
      id: Id<"appointments">;
      petName?: string;
      ownerName?: string;
      phone?: string;
      email?: string;
      date?: string;
      time?: string;
      reason?: string;
      vet?: string;
      status?: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'rescheduled';
      notes?: string;
      serviceType?: string;
      price?: number;
      paymentStatus?: 'pending' | 'down_payment_paid' | 'fully_paid';
      paymentData?: any;
      itemsUsed?: Array<{
        itemId: string;
        quantity: number;
        itemName: string;
        itemCategory: string;
        deductionStatus?: 'pending' | 'confirmed' | 'rejected';
        loggedAt?: string;
        rejectedReason?: string;
      }>;
    } = {
      id: id as Id<"appointments">,
    };

    if (updates.petName !== undefined) updateData.petName = updates.petName;
    if (updates.ownerName !== undefined) updateData.ownerName = updates.ownerName;
    if (updates.phone !== undefined) updateData.phone = updates.phone;
    if (updates.email !== undefined) updateData.email = updates.email;
    if (updates.date !== undefined) updateData.date = updates.date;
    if (updates.time !== undefined) updateData.time = updates.time;
    if (updates.reason !== undefined) updateData.reason = updates.reason;
    if (updates.vet !== undefined) updateData.vet = updates.vet;
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.notes !== undefined) updateData.notes = updates.notes;
    if (updates.serviceType !== undefined) updateData.serviceType = updates.serviceType;
    if (updates.price !== undefined) updateData.price = updates.price;
    if (updates.paymentStatus !== undefined) updateData.paymentStatus = updates.paymentStatus;
    if (updates.paymentData !== undefined) updateData.paymentData = updates.paymentData;
    if (updates.itemsUsed !== undefined) updateData.itemsUsed = updates.itemsUsed;

    await updateAppointmentMutation(updateData);
  };

  const deleteAppointment = async (id: string) => {
    await deleteAppointmentMutation({ id: id as Id<"appointments"> });
  };

  return {
    appointments,
    addAppointment,
    updateAppointment,
    deleteAppointment,
  };
}
