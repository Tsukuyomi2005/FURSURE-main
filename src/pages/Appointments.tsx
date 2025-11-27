import { useState, useMemo, type ChangeEvent } from 'react';
import Calendar from 'react-calendar';
import { Clock, ChevronRight, ChevronLeft, CreditCard, Smartphone, User, Phone, Mail, FileText, Building2 } from 'lucide-react';
import { useAppointmentStore } from '../stores/appointmentStore';
import { useScheduleStore } from '../stores/scheduleStore';
import { useRoleStore } from '../stores/roleStore';
import { usePetRecordsStore } from '../stores/petRecordsStore';
import { useServiceStore } from '../stores/serviceStore';
import { useStaffStore } from '../stores/staffStore';
import { useAvailabilityStore } from '../stores/availabilityStore';
import { PaymentModal } from '../components/PaymentModal';
import { AppointmentActions } from '../components/AppointmentActions';
import { toast } from 'sonner';
import type { Appointment, Service } from '../types';
import 'react-calendar/dist/Calendar.css';

type BookingStep = 1 | 2 | 3 | 4;

export function Appointments() {
  const { appointments, addAppointment, updateAppointment } = useAppointmentStore();
  const { isTimeSlotAvailable, getSchedulesByDate } = useScheduleStore();
  const { role } = useRoleStore();
  const { records: petRecords } = usePetRecordsStore();
  const { services } = useServiceStore();
  const { staff } = useStaffStore();
  const { allAvailability } = useAvailabilityStore();
  
  // Get active veterinarians from staff
  const allActiveVets = staff
    .filter(member => member.position === 'Veterinarian' && member.status === 'active')
    .map(member => member.name)
    .sort();
  
  // For admin accounts (walk-ins), automatically set date to today
  const isAdmin = role === 'vet' || role === 'staff';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const [currentStep, setCurrentStep] = useState<BookingStep>(1);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedVet, setSelectedVet] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date | null>(isAdmin ? today : null);
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [formData, setFormData] = useState({
    petName: '',
    ownerName: '',
    phone: '',
    email: '',
    reason: '',
  });
  const [showPayment, setShowPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'at_clinic' | 'online'>('at_clinic');

  // Get day name from date
  const getDayName = (date: Date): string => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[date.getDay()];
  };

  // Check if a date is available (at least one vet works on that day)
  const isDateAvailable = (date: Date): boolean => {
    const dayName = getDayName(date);
    return allAvailability.some(avail => avail.workingDays.includes(dayName));
  };

  // Generate time slots based on all veterinarians' availability
  const generateTimeSlots = useMemo(() => {
    if (allAvailability.length === 0) {
      // Fallback to default slots if no availability data
      return [
        '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
        '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
        '16:00', '16:30', '17:00', '17:30'
      ];
    }

    // Find earliest start time and latest end time
    let earliestStart = '23:59';
    let latestEnd = '00:00';
    
    allAvailability.forEach(avail => {
      if (avail.startTime < earliestStart) earliestStart = avail.startTime;
      if (avail.endTime > latestEnd) latestEnd = avail.endTime;
    });

    // Generate slots with 30-minute intervals between earliest and latest
    const slots: string[] = [];
    const parseTime = (timeStr: string): number => {
      const [hours, minutes] = timeStr.split(':').map(Number);
      return hours * 60 + minutes;
    };

    const formatTime = (minutes: number): string => {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
    };

    const startMinutes = parseTime(earliestStart);
    const endMinutes = parseTime(latestEnd);
    
    for (let minutes = startMinutes; minutes < endMinutes; minutes += 30) {
      slots.push(formatTime(minutes));
    }

    return slots;
  }, [allAvailability]);

  // Get available time slots for selected date
  const getAvailableTimeSlotsForDate = (date: Date | null): string[] => {
    if (!date) return [];
    
    const dayName = getDayName(date);
    const availableTimes = new Set<string>();

    // Find all vets working on this day
    allAvailability.forEach(avail => {
      if (avail.workingDays.includes(dayName)) {
        // Generate slots for this vet's working hours
        const parseTime = (timeStr: string): number => {
          const [hours, minutes] = timeStr.split(':').map(Number);
          return hours * 60 + minutes;
        };

        const formatTime = (minutes: number): string => {
          const hours = Math.floor(minutes / 60);
          const mins = minutes % 60;
          return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
        };

        const startMinutes = parseTime(avail.startTime);
        const endMinutes = parseTime(avail.endTime);
        const duration = avail.appointmentDuration || 30;

        // Generate slots with the vet's appointment duration
        for (let minutes = startMinutes; minutes + duration <= endMinutes; minutes += duration) {
          availableTimes.add(formatTime(minutes));
        }
      }
    });

    return Array.from(availableTimes).sort();
  };

  const dateForTimeSlots: Date | null = isAdmin ? today : selectedDate;
  const timeSlots = dateForTimeSlots ? getAvailableTimeSlotsForDate(dateForTimeSlots) : generateTimeSlots;

  const formatTime12Hour = (time24: string): string => {
    const [hours, minutes] = time24.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12;
    return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  const formatDateLocal = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Get available vets for selected date and time based on their availability
  const getAvailableVets = (): string[] => {
    const dateToCheck = isAdmin ? today : selectedDate;
    if (!dateToCheck || !selectedTime) {
      return allActiveVets;
    }

    const dayName = getDayName(dateToCheck);
    const parseTime = (timeStr: string): number => {
      const [hours, minutes] = timeStr.split(':').map(Number);
      return hours * 60 + minutes;
    };
    
    const requestedTime = parseTime(selectedTime);
    const availableVets = new Set<string>();
    
    // Check each vet's availability
    allAvailability.forEach(avail => {
      // Check if vet works on this day
      if (avail.workingDays.includes(dayName)) {
        const startMinutes = parseTime(avail.startTime);
        const endMinutes = parseTime(avail.endTime);
        const duration = avail.appointmentDuration || 30;
        
        // Check if the requested time falls within working hours
        // and there's enough time for an appointment
        if (requestedTime >= startMinutes && requestedTime + duration <= endMinutes) {
          // Find the vet name matching this availability
          const vet = allActiveVets.find(v => v === avail.veterinarianName);
          if (vet) {
            availableVets.add(vet);
          }
        }
      }
    });
    
    // Fallback: if no vets found by availability, check schedules
    if (availableVets.size === 0) {
      const dateStr = formatDateLocal(dateToCheck);
      const schedules = getSchedulesByDate(dateStr);
      
      schedules.forEach(schedule => {
        const startTime = parseTime(schedule.startTime);
        const endTime = parseTime(schedule.endTime);
        
        if (requestedTime >= startTime && requestedTime < endTime) {
          schedule.veterinarians.forEach(vet => availableVets.add(vet));
        }
      });
      
      // If still no vets found, return all active veterinarians
      if (availableVets.size === 0) {
        return allActiveVets;
      }
    }
    
    return Array.from(availableVets).sort();
  };

  const availableVets = getAvailableVets();

  const handleNext = () => {
    if (currentStep === 1) {
      if (!selectedService) {
        toast.error('Please select a service');
        return;
      }
      // For admin, auto-set date to today when moving to step 2
      if (isAdmin && !selectedDate) {
        setSelectedDate(today);
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      const dateToCheck = isAdmin ? today : selectedDate;
      if (!dateToCheck || !selectedTime) {
        toast.error(isAdmin ? 'Please select a time' : 'Please select a date and time');
        return;
      }
      setCurrentStep(3);
    } else if (currentStep === 3) {
      if (!selectedVet) {
        toast.error('Please select a veterinarian');
        return;
      }
      // For admin, skip payment step and go directly to booking
      if (isAdmin) {
        handleBookWalkIn();
      } else {
        setCurrentStep(4);
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as BookingStep);
    }
  };

  const handleServiceSelect = (service: Service) => {
    setSelectedService(service);
  };

  const isSlotBooked = (time: string) => {
    const dateToCheck = isAdmin ? today : selectedDate;
    if (!dateToCheck) return false;
    const dateStr = formatDateLocal(dateToCheck);
    return appointments.some(apt => apt.date === dateStr && apt.time === time && apt.status !== 'cancelled');
  };

  // Check if a time slot is available based on veterinarian availability
  const isSlotAvailableByAvailability = (time: string): boolean => {
    const dateToCheck = isAdmin ? today : selectedDate;
    if (!dateToCheck) return false;
    
    const dayName = getDayName(dateToCheck);
    const parseTime = (timeStr: string): number => {
      const [hours, minutes] = timeStr.split(':').map(Number);
      return hours * 60 + minutes;
    };
    
    const requestedTime = parseTime(time);
    
    // If no availability data exists, allow all slots (fallback)
    if (allAvailability.length === 0) {
      return true;
    }
    
    // Check if at least one veterinarian is available at this time
    return allAvailability.some(avail => {
      if (!avail.workingDays.includes(dayName)) return false;
      
      const startMinutes = parseTime(avail.startTime);
      const endMinutes = parseTime(avail.endTime);
      const duration = avail.appointmentDuration || 30;
      
      // Check if the requested time falls within working hours
      // and there's enough time for an appointment
      return requestedTime >= startMinutes && requestedTime + duration <= endMinutes;
    });
  };

  const isSlotAvailable = (time: string) => {
    const dateToCheck = isAdmin ? today : selectedDate;
    if (!dateToCheck) return false;
    
    // Check if slot is booked first
    if (isSlotBooked(time)) return false;
    
    const dateStr = formatDateLocal(dateToCheck);
    
    // Check availability based on veterinarian availability settings (primary check)
    const availabilityCheck = isSlotAvailableByAvailability(time);
    
    // Check availability based on veterinarian schedules (secondary check for backward compatibility)
    const scheduleAvailable = isTimeSlotAvailable(dateStr, time);
    
    // Slot is available if either:
    // 1. Availability check passes (veterinarians have set their working hours), OR
    // 2. Schedule check passes (admin has created specific schedules), OR
    // 3. No availability data exists (fallback to allow booking)
    return availabilityCheck || scheduleAvailable || allAvailability.length === 0;
  };

  const handleTimeSlotClick = (time: string) => {
    if (isSlotAvailable(time)) {
      setSelectedTime(time);
    }
  };

  const validateForm = () => {
    if (!formData.petName.trim()) {
      toast.error('Pet name is required');
      return false;
    }
    if (!formData.ownerName.trim()) {
      toast.error('Owner name is required');
      return false;
    }
    if (!formData.phone.trim()) {
      toast.error('Phone number is required');
      return false;
    }
    // Email is only required for pet owners
    if (role === 'owner') {
      if (!formData.email.trim()) {
        toast.error('Email is required');
        return false;
      }
      if (!/\S+@\S+\.\S+/.test(formData.email)) {
        toast.error('Email is invalid');
        return false;
      }
    }
    return true;
  };

  const handlePaymentSuccess = async (paymentData: any) => {
    if (!validateForm() || !selectedService || !selectedVet || !selectedDate || !selectedTime) {
      return;
    }

    try {
      await addAppointment({
        petName: formData.petName,
        ownerName: formData.ownerName,
        phone: formData.phone,
        email: role === 'owner' ? formData.email : (formData.email || ''),
        date: formatDateLocal(selectedDate),
        time: selectedTime,
        reason: formData.reason,
        vet: selectedVet,
        status: 'pending',
        serviceType: selectedService.id,
        price: selectedService.price,
        paymentStatus: 'down_payment_paid',
        paymentData: {
          ...paymentData,
          // Keep the original method ('gcash' or 'paymaya') from PaymentModal
        }
      });

      toast.success('Appointment booked successfully!');
      
      // Reset form
      setCurrentStep(1);
      setSelectedService(null);
      setSelectedVet('');
      setSelectedDate(null);
      setSelectedTime('');
      setFormData({
        petName: '',
        ownerName: '',
        phone: '',
        email: '',
        reason: '',
      });
      setPaymentMethod('at_clinic');
      setShowPayment(false);
    } catch (error) {
      console.error('Failed to book appointment:', error);
      toast.error('Failed to book appointment. Please try again.');
    }
  };

  const handleProceedToPayment = () => {
    if (!validateForm()) {
      return;
    }
    setShowPayment(true);
  };

  const handleBookWalkIn = async () => {
    if (!validateForm() || !selectedService || !selectedVet || !selectedTime) {
      return;
    }

    try {
      await addAppointment({
        petName: formData.petName,
        ownerName: formData.ownerName,
        phone: formData.phone,
        email: formData.email || '',
        date: formatDateLocal(today),
        time: selectedTime,
        reason: formData.reason,
        vet: selectedVet,
        status: 'approved', // Auto-approve walk-ins
        serviceType: selectedService.id,
        price: selectedService.price,
        paymentStatus: 'pending', // Payment happens at clinic counter
        paymentData: {
          method: 'at_clinic'
        }
      });

      toast.success('Walk-in appointment booked and approved!');
      
      // Reset form
      setCurrentStep(1);
      setSelectedService(null);
      setSelectedVet('');
      setSelectedTime('');
      setFormData({
        petName: '',
        ownerName: '',
        phone: '',
        email: '',
        reason: '',
      });
    } catch (error) {
      console.error('Failed to book walk-in appointment:', error);
      toast.error('Failed to book walk-in appointment. Please try again.');
    }
  };

  const handleBookAppointment = async () => {
    if (!validateForm() || !selectedService || !selectedVet || !selectedDate || !selectedTime) {
      return;
    }

    try {
      await addAppointment({
        petName: formData.petName,
        ownerName: formData.ownerName,
        phone: formData.phone,
        email: role === 'owner' ? formData.email : (formData.email || ''),
        date: formatDateLocal(selectedDate),
        time: selectedTime,
        reason: formData.reason,
        vet: selectedVet,
        status: 'pending',
        serviceType: selectedService.id,
        price: selectedService.price,
        paymentStatus: 'pending',
        paymentData: {
          method: 'at_clinic'
        }
      });

      toast.success('Appointment booked successfully!');
      
      // Reset form
      setCurrentStep(1);
      setSelectedService(null);
      setSelectedVet('');
      setSelectedDate(null);
      setSelectedTime('');
      setFormData({
        petName: '',
        ownerName: '',
        phone: '',
        email: '',
        reason: '',
      });
      setPaymentMethod('at_clinic');
    } catch (error) {
      console.error('Failed to book appointment:', error);
      toast.error('Failed to book appointment. Please try again.');
    }
  };

  const steps = isAdmin 
    ? [
        { number: 1, label: 'Select Service' },
        { number: 2, label: 'Select Time' },
        { number: 3, label: 'Choose Veterinarian' },
      ]
    : [
        { number: 1, label: 'Select Service' },
        { number: 2, label: 'Select Date and Time' },
        { number: 3, label: 'Choose Veterinarian' },
        { number: 4, label: 'Payment Method' },
      ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Book Your Appointment</h1>
        <p className="text-gray-600 mt-2">
          Schedule your next visit with our professional veterinarians
        </p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-between mb-8">
        {steps.map((step, index) => (
          <div key={step.number} className="flex items-center flex-1">
            <div className="flex flex-col items-center flex-1">
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center font-semibold text-lg transition-all duration-300 ${
                  currentStep === step.number
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/50 ring-4 ring-purple-200'
                    : currentStep > step.number
                    ? 'bg-purple-200 text-purple-700'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {step.number}
              </div>
              <span
                className={`mt-2 text-sm font-medium ${
                  currentStep === step.number
                    ? 'text-purple-600'
                    : currentStep > step.number
                    ? 'text-purple-500'
                    : 'text-gray-500'
                }`}
              >
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={`flex-1 h-1 mx-2 transition-all duration-300 ${
                  currentStep > step.number ? 'bg-purple-500' : 'bg-gray-200'
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Select Service */}
      {currentStep === 1 && (
        <div className="bg-white rounded-lg p-6 shadow-sm border">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">Select Your Service</h2>
          {services.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600">No services available. Please contact the clinic.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {services.map((service) => (
                <button
                  key={service.id}
                  onClick={() => handleServiceSelect(service)}
                  className={`p-4 rounded-lg border-2 text-left transition-all duration-200 ${
                    selectedService?.id === service.id
                      ? 'border-purple-500 bg-purple-50 shadow-lg shadow-purple-200'
                      : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50'
                  }`}
                >
                  <h3 className="font-semibold text-gray-900 mb-1">{service.name}</h3>
                  <p className="text-sm text-gray-600 mb-3">{service.description}</p>
                  <p className="text-lg font-bold text-purple-600">₱{service.price.toLocaleString()}</p>
                </button>
              ))}
            </div>
          )}
          <div className="mt-6 flex justify-end">
            <button
              onClick={handleNext}
              disabled={!selectedService}
              className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              Next
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Select Date and Time */}
      {currentStep === 2 && (
        <div className="bg-white rounded-lg p-6 shadow-sm border">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">
            {isAdmin ? 'Select Time' : 'Select Date and Time'}
          </h2>
          {isAdmin && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Walk-in Appointment</strong> - Date: {today.toLocaleDateString()}
              </p>
            </div>
          )}
          <div className={`grid grid-cols-1 ${isAdmin ? '' : 'lg:grid-cols-2'} gap-6`}>
            {!isAdmin && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Date</h3>
                <Calendar
                  onChange={(value) => {
                    const date = value as Date;
                    if (isDateAvailable(date)) {
                      setSelectedDate(date);
                      setSelectedTime(''); // Reset time when date changes
                    } else {
                      toast.error('No veterinarians are available on this day. Please select another date.');
                      setSelectedDate(null);
                      setSelectedTime('');
                    }
                  }}
                  value={selectedDate}
                  className="w-full"
                  minDate={new Date()}
                  tileDisabled={({ date, view }) => {
                    // Only disable dates in month view
                    if (view === 'month') {
                      return !isDateAvailable(date);
                    }
                    return false;
                  }}
                  tileClassName={({ date, view }) => {
                    if (view === 'month' && !isDateAvailable(date)) {
                      return 'disabled-date';
                    }
                    return null;
                  }}
                />
              </div>
            )}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Available Times {isAdmin ? `- ${today.toLocaleDateString()}` : (selectedDate ? `- ${selectedDate.toLocaleDateString()}` : '')}
              </h3>
              {(isAdmin || selectedDate) ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {timeSlots.map((time) => {
                    const isBooked = isSlotBooked(time);
                    const isAvailable = isSlotAvailable(time);
                    
                    return (
                      <button
                        key={time}
                        onClick={() => handleTimeSlotClick(time)}
                        disabled={!isAvailable}
                        className={`p-3 rounded-lg text-sm font-medium transition-colors ${
                          selectedTime === time
                            ? 'bg-purple-600 text-white shadow-lg shadow-purple-200'
                            : isBooked
                            ? 'bg-red-100 text-red-700 border-2 border-red-300 cursor-not-allowed'
                            : !isAvailable
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
                        }`}
                        title={isBooked ? 'This time slot is already booked' : !isAvailable ? 'This time slot is not available' : 'Click to select this time'}
                      >
                        <Clock className="h-4 w-4 inline mr-1" />
                        {formatTime12Hour(time)}
                        {isBooked && <span className="ml-1 text-xs">(Booked)</span>}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">Please select a date first</p>
              )}
            </div>
          </div>
          <div className="mt-6 flex justify-between">
            <button
              onClick={handleBack}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
            >
              <ChevronLeft className="h-5 w-5" />
              Back
            </button>
            <button
              onClick={handleNext}
              disabled={(!isAdmin && !selectedDate) || !selectedTime}
              className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              Next
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Choose Veterinarian (and Customer Details for Admin) */}
      {currentStep === 3 && (
        <div className="bg-white rounded-lg p-6 shadow-sm border">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">
            {isAdmin ? 'Customer Details & Veterinarian' : 'Choose Veterinarian'}
          </h2>
          {((isAdmin && today) || selectedDate) && selectedTime ? (
            <>
              <div className="mb-4 p-3 bg-purple-50 rounded-lg">
                <p className="text-sm text-purple-800">
                  <strong>Selected:</strong> {(isAdmin ? today : selectedDate)!.toLocaleDateString()} at {formatTime12Hour(selectedTime)}
                </p>
                <p className="text-xs text-purple-600 mt-1">
                  Available veterinarians for this date and time:
                </p>
              </div>
              
              {/* Customer Details Form for Admin */}
              {isAdmin && (
                <div className="mb-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Pet Name *
                    </label>
                    <input
                      type="text"
                      value={formData.petName}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, petName: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Enter pet name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Customer Name *
                    </label>
                    <input
                      type="text"
                      value={formData.ownerName}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, ownerName: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Enter customer name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone Number *
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Enter phone number"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Reason for Visit (Optional)
                    </label>
                    <textarea
                      value={formData.reason}
                      onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, reason: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      rows={3}
                      placeholder="Describe the reason for the visit"
                    />
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {availableVets.length > 0 ? (
                  availableVets.map((vet) => (
                    <button
                      key={vet}
                      onClick={() => setSelectedVet(vet)}
                      className={`p-4 rounded-lg border-2 text-left transition-all duration-200 ${
                        selectedVet === vet
                          ? 'border-purple-500 bg-purple-50 shadow-lg shadow-purple-200'
                          : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50'
                      }`}
                    >
                      <h3 className="font-semibold text-gray-900">{vet}</h3>
                    </button>
                  ))
                ) : (
                  <div className="col-span-2 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-yellow-800">
                      No veterinarians available for the selected date and time. Please choose a different date or time.
                    </p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <p className="text-gray-600">Please select a date and time first to see available veterinarians.</p>
            </div>
          )}
          <div className="mt-6 flex justify-between">
            <button
              onClick={handleBack}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
            >
              <ChevronLeft className="h-5 w-5" />
              Back
            </button>
            {isAdmin ? (
              <button
                onClick={handleBookWalkIn}
                disabled={!selectedVet || !selectedTime || !formData.petName || !formData.ownerName || !formData.phone}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                Book Walk-in Appointment
              </button>
            ) : (
              <button
                onClick={handleNext}
                disabled={!selectedVet || !selectedDate || !selectedTime}
                className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                Next
                <ChevronRight className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Step 4: Payment Method (Only for pet owners) */}
      {currentStep === 4 && !isAdmin && (
        <div className="bg-white rounded-lg p-6 shadow-sm border">
          {/* Form Fields - Moved to top */}
          <div className="space-y-4 mb-8">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pet Name *
              </label>
              {role === 'owner' ? (
                <select
                  value={formData.petName}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) => setFormData({ ...formData, petName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="">Select a pet</option>
                  {petRecords.map((pet) => (
                    <option key={pet.id} value={pet.petName}>
                      {pet.petName} {pet.breed ? `(${pet.breed})` : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={formData.petName}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, petName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Enter pet name"
                />
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Owner Name *
              </label>
              <input
                type="text"
                value={formData.ownerName}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, ownerName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder={role === 'owner' ? "Enter your name" : "Enter customer name"}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number *
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Enter phone number"
              />
            </div>

            {role === 'owner' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Enter email address"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reason for Visit (Optional)
              </label>
              <textarea
                value={formData.reason}
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, reason: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                rows={3}
                placeholder="Describe the reason for the visit"
              />
            </div>
          </div>

          {/* Booking Summary Section - Moved to top */}
          {selectedService && (
            <div className="mb-8 relative">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Booking Summary</h2>
              
              {/* Decorative opacity lines */}
              <div className="absolute top-0 right-0 opacity-10 pointer-events-none">
                <div className="flex gap-2">
                  <div className="w-1 h-16 bg-purple-500"></div>
                  <div className="w-1 h-12 bg-purple-500"></div>
                  <div className="w-1 h-20 bg-purple-500"></div>
                  <div className="w-1 h-14 bg-purple-500"></div>
                </div>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-6 border border-gray-200 relative overflow-hidden">
                {/* Additional decorative lines */}
                <div className="absolute inset-0 opacity-5 pointer-events-none">
                  <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                      <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                        <path d="M 20 0 L 0 0 0 20" fill="none" stroke="currentColor" strokeWidth="1"/>
                      </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#grid)" className="text-purple-500" />
                  </svg>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm relative z-10">
                  <div>
                    <span className="text-gray-600">Service:</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-900">{selectedService.name}</span>
                  </div>
                  
                  <div>
                    <span className="text-gray-600">Veterinarian:</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-900">{selectedVet}</span>
                  </div>
                  
                  <div>
                    <span className="text-gray-600">Date:</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-900">
                      {selectedDate ? formatDateLocal(selectedDate) : ''}
                    </span>
                  </div>
                  
                  <div>
                    <span className="text-gray-600">Time:</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-900">
                      {selectedTime ? formatTime12Hour(selectedTime) : ''}
                    </span>
                  </div>
                  
                  <div className="col-span-2 border-t border-gray-200 pt-2 mt-2">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Total Amount:</span>
                        <span className="text-lg font-bold text-purple-600">
                          ₱{selectedService.price.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Down Payment Required:</span>
                        <span className="font-semibold text-purple-600">
                          ₱{Math.round(selectedService.price * 0.3).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Balance After Deposit:</span>
                        <span className="font-semibold text-gray-900">
                          ₱{(selectedService.price - Math.round(selectedService.price * 0.3)).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Select Payment Method Section */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Select Payment Method</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Pay Balance at Clinic / Pay in Cash */}
              <button
                onClick={() => setPaymentMethod('at_clinic')}
                className={`p-4 rounded-lg border-2 text-left transition-all duration-200 ${
                  paymentMethod === 'at_clinic'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <Building2 className={`h-6 w-6 mt-1 ${paymentMethod === 'at_clinic' ? 'text-blue-600' : 'text-gray-600'}`} />
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-2">
                      {role === 'owner' ? 'Pay Balance at Clinic' : 'Pay in Cash'}
                    </h3>
                    {selectedService && (
                      <div className="text-sm text-gray-600 space-y-1">
                        {role === 'owner' ? (
                          <>
                            <p>Pay the ₱{Math.round(selectedService.price * 0.3).toLocaleString()} deposit online now.</p>
                            <p>Pay the remaining ₱{(selectedService.price - Math.round(selectedService.price * 0.3)).toLocaleString()} at the clinic on the day of your appointment.</p>
                          </>
                        ) : (
                          <>
                            <p>Pay the ₱{Math.round(selectedService.price * 0.3).toLocaleString()} deposit online now.</p>
                            <p>Pay the remaining ₱{(selectedService.price - Math.round(selectedService.price * 0.3)).toLocaleString()} here on the day of the appointment.</p>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </button>

              {/* Pay Online */}
              <button
                onClick={() => setPaymentMethod('online')}
                className={`p-4 rounded-lg border-2 text-left transition-all duration-200 ${
                  paymentMethod === 'online'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <Smartphone className={`h-6 w-6 mt-1 ${paymentMethod === 'online' ? 'text-blue-600' : 'text-gray-600'}`} />
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-2">Pay Online</h3>
                    {selectedService && (
                      <div className="text-sm text-gray-600 space-y-1">
                        <p>Pay the full amount or minimum ₱{Math.round(selectedService.price * 0.3).toLocaleString()} deposit via GCash/PayMaya and upload proof.</p>
                        <p className="text-xs text-gray-500">Remaining balance (₱{(selectedService.price - Math.round(selectedService.price * 0.3)).toLocaleString()}) can also be paid online if they choose.</p>
                      </div>
                    )}
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Navigation Buttons */}
          <div className="flex justify-between">
            <button
              onClick={handleBack}
              className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Previous
            </button>
            <button
              onClick={paymentMethod === 'online' ? handleProceedToPayment : handleBookAppointment}
              disabled={!formData.petName || !formData.ownerName || !formData.phone || (role === 'owner' && !formData.email)}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Book Appointment
            </button>
          </div>
        </div>
      )}

      <PaymentModal
        isOpen={showPayment}
        onClose={() => setShowPayment(false)}
        amount={selectedService ? Math.round(selectedService.price * 0.3) : 0}
        serviceType={selectedService?.name || ''}
        onPaymentSuccess={handlePaymentSuccess}
      />
    </div>
  );
}

