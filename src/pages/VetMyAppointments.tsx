import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Hourglass, CheckCircle } from 'lucide-react';
import { useAppointmentStore } from '../stores/appointmentStore';
import { useAvailabilityStore } from '../stores/availabilityStore';
import { useServiceStore } from '../stores/serviceStore';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { toast } from 'sonner';
import type { Appointment } from '../types';

// Get veterinarian's full name from localStorage
const getVetName = () => {
  try {
    const currentUserStr = localStorage.getItem('fursure_current_user');
    if (currentUserStr) {
      const currentUser = JSON.parse(currentUserStr);
      const storedUsers = JSON.parse(localStorage.getItem('fursure_users') || '{}');
      const userData = storedUsers[currentUser.username || currentUser.email];
      
      if (userData) {
        // Combine firstName and lastName into full name (matching how it's stored in appointments)
        const fullName = `${userData.firstName || ''} ${userData.lastName || ''}`.trim();
        return fullName || 'Veterinarian';
      }
    }
  } catch (error) {
    console.error('Error loading vet name:', error);
  }
  return 'Veterinarian'; // Fallback
};

export function VetMyAppointments() {
  const { appointments, updateAppointment } = useAppointmentStore();
  const { allAvailability } = useAvailabilityStore();
  const { services } = useServiceStore();
  
  const currentVetName = useMemo(() => getVetName(), []);
  
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
    const monday = new Date(today.setDate(diff));
    return monday;
  });

  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [appointmentToConfirm, setAppointmentToConfirm] = useState<Appointment | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);

  // Filter appointments for this veterinarian only
  const vetAppointments = useMemo(() => {
    let filtered = appointments.filter(apt => apt.vet === currentVetName);
    
    // Apply status filter
    if (selectedStatus !== 'all') {
      if (selectedStatus === 'confirmed') {
        filtered = filtered.filter(apt => apt.status === 'approved' && apt.paymentStatus !== 'fully_paid');
      } else if (selectedStatus === 'completed') {
        filtered = filtered.filter(apt => apt.status === 'approved' && apt.paymentStatus === 'fully_paid');
      } else {
        filtered = filtered.filter(apt => apt.status === selectedStatus);
      }
    }
    
    return filtered;
  }, [appointments, currentVetName, selectedStatus]);

  // Get appointments for weekly schedule (include all, even cancelled)
  const scheduleAppointments = useMemo(() => {
    return vetAppointments;
  }, [vetAppointments]);

  // Get color classes based on appointment status
  const getStatusColorClasses = (appointment: Appointment) => {
    if (appointment.status === 'cancelled') {
      return 'bg-red-50 border-red-200 hover:bg-red-100';
    }
    if (appointment.status === 'pending') {
      return 'bg-yellow-50 border-yellow-200 hover:bg-yellow-100';
    }
    if (appointment.status === 'approved') {
      // Check if completed (fully paid) - show blue
      if (appointment.paymentStatus === 'fully_paid') {
        return 'bg-blue-50 border-blue-200 hover:bg-blue-100';
      }
      // Confirmed (approved but not fully paid) - show green
      return 'bg-green-50 border-green-200 hover:bg-green-100';
    }
    if (appointment.status === 'rejected') {
      return 'bg-red-50 border-red-200 hover:bg-red-100';
    }
    if (appointment.status === 'rescheduled') {
      return 'bg-purple-50 border-purple-200 hover:bg-purple-100';
    }
    // Default
    return 'bg-gray-50 border-gray-200 hover:bg-gray-100';
  };

  // Get week dates
  const getWeekDates = () => {
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(currentWeekStart);
      date.setDate(date.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  const weekDates = getWeekDates();

  // Format date for comparison
  const formatDateForComparison = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Get appointments for a specific date for this veterinarian
  const getAppointmentsForVetOnDate = (date: Date) => {
    const dateStr = formatDateForComparison(date);
    return scheduleAppointments
      .filter(apt => apt.date === dateStr)
      .sort((a, b) => a.time.localeCompare(b.time));
  };

  // Navigate weeks
  const goToPreviousWeek = () => {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(newDate.getDate() - 7);
    setCurrentWeekStart(newDate);
  };

  const goToNextWeek = () => {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(newDate.getDate() + 7);
    setCurrentWeekStart(newDate);
  };

  // Get day name
  const getDayName = (date: Date): string => {
    return date.toLocaleDateString('en-US', { weekday: 'long' });
  };

  // Format time to 24-hour format
  const formatTime24Hour = (time: string): string => {
    // If already in 24-hour format (HH:MM:SS or HH:MM), return as is
    if (time.includes(':') && !time.includes('AM') && !time.includes('PM')) {
      return time.split(':').slice(0, 2).join(':'); // Extract HH:MM if it's HH:MM:SS
    }
    return time; // Fallback
  };

  // Format time to 12-hour format
  const formatTime12Hour = (time24: string): string => {
    const [hours, minutes] = time24.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12;
    return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  // Get service name from service ID
  const getServiceName = (serviceId: string | undefined): string => {
    if (!serviceId) return '';
    const service = services.find(s => s.id === serviceId);
    return service ? service.name : serviceId; // Fallback to ID if service not found
  };

  // Get availability for this veterinarian
  const getAvailabilityForVet = () => {
    return allAvailability.find(av => av.veterinarianName === currentVetName);
  };

  const vetAvailability = getAvailabilityForVet();

  // Get status counts
  const getStatusCounts = () => {
    const allVetAppointments = appointments.filter(apt => apt.vet === currentVetName);
    return {
      pending: allVetAppointments.filter(a => a.status === 'pending').length,
      confirmed: allVetAppointments.filter(a => a.status === 'approved' && a.paymentStatus !== 'fully_paid').length,
      completed: allVetAppointments.filter(a => a.status === 'approved' && a.paymentStatus === 'fully_paid').length,
      cancelled: allVetAppointments.filter(a => a.status === 'cancelled').length,
    };
  };

  const statusCounts = getStatusCounts();

  // Get pending appointments for the table
  const pendingAppointments = useMemo(() => {
    return appointments
      .filter(apt => apt.vet === currentVetName && apt.status === 'pending')
      .sort((a, b) => {
        const dateCompare = a.date.localeCompare(b.date);
        if (dateCompare !== 0) return dateCompare;
        return a.time.localeCompare(b.time);
      });
  }, [appointments, currentVetName]);

  // Handle confirm appointment
  const handleConfirmClick = (appointment: Appointment) => {
    setAppointmentToConfirm(appointment);
    setShowConfirmDialog(true);
  };

  const handleConfirmAppointment = async () => {
    if (!appointmentToConfirm) return;

    try {
      await updateAppointment(appointmentToConfirm.id, { status: 'approved' });
      setShowConfirmDialog(false);
      setShowSuccessPopup(true);
      // Auto close success popup after 2 seconds
      setTimeout(() => {
        setShowSuccessPopup(false);
        setAppointmentToConfirm(null);
      }, 2000);
    } catch (error) {
      console.error('Failed to confirm appointment:', error);
      toast.error('Failed to confirm appointment. Please try again.');
      setShowConfirmDialog(false);
      setAppointmentToConfirm(null);
    }
  };

  // Format date for display
  const formatDateDisplay = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">My Appointments</h1>
        <p className="text-gray-600 mt-2">View your weekly schedule and appointments</p>
      </div>

      {/* Weekly Schedule */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Weekly Schedule</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={goToPreviousWeek}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
              >
                <ChevronLeft className="h-5 w-5" />
                Previous Week
              </button>
              <button
                onClick={goToNextWeek}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
              >
                Next Week
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
          
          {/* Status Filters */}
          <div className="flex flex-wrap gap-3 mt-4">
            <button
              onClick={() => setSelectedStatus('all')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedStatus === 'all'
                  ? 'bg-gray-800 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setSelectedStatus('pending')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedStatus === 'pending'
                  ? 'bg-yellow-500 text-white'
                  : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
              }`}
            >
              Pending ({statusCounts.pending})
            </button>
            <button
              onClick={() => setSelectedStatus('confirmed')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedStatus === 'confirmed'
                  ? 'bg-green-500 text-white'
                  : 'bg-green-100 text-green-800 hover:bg-green-200'
              }`}
            >
              Confirmed ({statusCounts.confirmed})
            </button>
            <button
              onClick={() => setSelectedStatus('completed')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedStatus === 'completed'
                  ? 'bg-blue-500 text-white'
                  : 'bg-blue-100 text-blue-800 hover:bg-blue-200'
              }`}
            >
              Completed ({statusCounts.completed})
            </button>
            <button
              onClick={() => setSelectedStatus('cancelled')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedStatus === 'cancelled'
                  ? 'bg-red-500 text-white'
                  : 'bg-red-100 text-red-800 hover:bg-red-200'
              }`}
            >
              Cancelled ({statusCounts.cancelled})
            </button>
          </div>
        </div>
        <div className="p-6 overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr>
                {weekDates.map((date, index) => (
                  <th key={index} className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                    <div>{getDayName(date).substring(0, 3)}</div>
                    <div className="text-gray-900 font-normal mt-1">
                      {date.getDate()} {date.toLocaleDateString('en-US', { month: 'short' })}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              <tr>
                {weekDates.map((date, dayIndex) => {
                  const dayName = getDayName(date);
                  const isWorkingDay = vetAvailability?.workingDays.includes(dayName) || false;
                  const dayAppointments = getAppointmentsForVetOnDate(date);
                  const appointmentCount = dayAppointments.length;
                  
                  return (
                    <td key={dayIndex} className="px-2 py-4 align-top relative min-w-[100px]">
                      <div className="space-y-1 pt-1">
                        {appointmentCount > 0 && (
                          <div className="absolute top-1 left-1 w-5 h-5 rounded-full bg-blue-500 text-white text-[10px] font-semibold flex items-center justify-center z-10 shadow-sm">
                            {appointmentCount}
                          </div>
                        )}
                        {dayAppointments.map((apt) => (
                          <div
                            key={apt.id}
                            className={`border rounded p-2 text-xs transition-colors cursor-pointer ${getStatusColorClasses(apt)}`}
                          >
                            <div className="font-medium text-gray-900">
                              {formatTime24Hour(apt.time)}
                              {apt.serviceType && (
                                <span className="text-gray-700 ml-1">- {getServiceName(apt.serviceType)}</span>
                              )}
                            </div>
                          </div>
                        ))}
                        {appointmentCount === 0 && (
                          <div className="text-xs text-gray-400 text-center py-2">
                            {isWorkingDay && vetAvailability ? (
                              <div className="flex flex-col items-center">
                                <span className="font-medium">Available</span>
                              </div>
                            ) : 'Off'}
                          </div>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Pending Appointments */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-6 border-b">
          <div className="flex items-center gap-2">
            <Hourglass className="h-5 w-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Pending Appointments</h2>
          </div>
        </div>
        <div className="p-6">
          {pendingAppointments.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No pending appointments</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingAppointments.map((apt) => (
                <div
                  key={apt.id}
                  className="flex items-center justify-between p-4 border-b border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  {/* Left side: Date, Time, and Action buttons */}
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-gray-900">
                        {formatDateDisplay(apt.date)}
                      </span>
                      <span className="text-sm text-gray-600">
                        {formatTime12Hour(formatTime24Hour(apt.time))}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 text-xs font-medium rounded-lg bg-yellow-100 border border-yellow-200 text-yellow-800">
                        Pending
                      </span>
                      <button
                        onClick={() => handleConfirmClick(apt)}
                        className="px-4 py-1.5 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors"
                      >
                        Confirm
                      </button>
                    </div>
                  </div>

                  {/* Right side: Owner name and Service */}
                  <div className="flex flex-col items-end text-right">
                    <span className="text-sm font-semibold text-gray-900">
                      {apt.ownerName}
                    </span>
                    <span className="text-sm text-gray-600">
                      {apt.serviceType ? getServiceName(apt.serviceType) : 'N/A'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showConfirmDialog}
        onClose={() => {
          setShowConfirmDialog(false);
          setAppointmentToConfirm(null);
        }}
        onConfirm={handleConfirmAppointment}
        title="Confirm Appointment"
        message={`Are you sure you want to confirm the appointment with ${appointmentToConfirm?.ownerName} on ${appointmentToConfirm ? formatDateDisplay(appointmentToConfirm.date) : ''} at ${appointmentToConfirm ? formatTime12Hour(formatTime24Hour(appointmentToConfirm.time)) : ''}?`}
        confirmText="Confirm"
        cancelText="Cancel"
        confirmVariant="purple"
      />

      {/* Success Popup */}
      {showSuccessPopup && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="fixed inset-0 bg-gray-600 bg-opacity-75" />
            <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-8">
              <div className="flex flex-col items-center text-center">
                <div className="p-3 bg-green-100 rounded-full mb-4">
                  <CheckCircle className="h-12 w-12 text-green-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Appointment Confirmed
                </h3>
                <p className="text-gray-600">
                  The appointment has been successfully confirmed.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
