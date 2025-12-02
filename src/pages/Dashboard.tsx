import { Calendar, Package, Users, DollarSign, Heart, Stethoscope } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useInventoryStore } from '../stores/inventoryStore';
import type { InventoryItem } from '../types';
import { useAppointmentStore } from '../stores/appointmentStore';
import { useRoleStore } from '../stores/roleStore';
import { usePetRecordsStore } from '../stores/petRecordsStore';
import { useScheduleStore } from '../stores/scheduleStore';
import { useStaffStore } from '../stores/staffStore';
import { useServiceStore } from '../stores/serviceStore';
import { useNavigate } from 'react-router-dom';
import type { Appointment } from '../types';

// Legacy service mapping for backward compatibility with old appointment data
const legacyServices: Record<string, string> = {
  'vaccination-deworming': 'Vaccination & Deworming',
  'surgery': 'Surgery',
  'consultation-treatment': 'Consultation Treatment & Confinement',
  'boarding': 'Boarding',
  'laboratory': 'Laboratory',
  'grooming': 'Grooming',
  'pet-accessories': 'Pet Accessories',
  'pet-foods': 'Pet Foods',
};

export function Dashboard() {
  const { items } = useInventoryStore();
  const { appointments } = useAppointmentStore();
  const { records } = usePetRecordsStore();
  const { role } = useRoleStore();
  const { schedules } = useScheduleStore();
  const { staff } = useStaffStore();
  const { services } = useServiceStore();
  const navigate = useNavigate();

  const hasFullAccess = role === 'vet' || role === 'staff';

  // Get pet owner's display name from localStorage (shared with other parts of the app)
  const getOwnerDisplayName = (): string => {
    try {
      const currentUserStr = localStorage.getItem('fursure_current_user');
      if (!currentUserStr) return '';

      const currentUser = JSON.parse(currentUserStr);
      const storedUsers = JSON.parse(localStorage.getItem('fursure_users') || '{}');
      const userData = storedUsers[currentUser.username || currentUser.email];

      if (userData) {
        const fullName = `${userData.firstName || ''} ${userData.lastName || ''}`.trim();
        if (fullName) return fullName;
        if (userData.username) return userData.username;
      }

      return currentUser.email || currentUser.username || '';
    } catch (error) {
      console.error('Error loading owner display name:', error);
      return '';
    }
  };

  const ownerDisplayName = !hasFullAccess ? getOwnerDisplayName() : '';

  // Get service name from service ID
  const getServiceName = (serviceId: string | undefined): string => {
    if (!serviceId) return 'N/A';
    const service = services.find(s => s.id === serviceId);
    if (service) return service.name;
    // Check legacy mapping for backward compatibility
    if (legacyServices[serviceId]) return legacyServices[serviceId];
    // Fallback to ID if service not found
    return serviceId;
  };

  // Get status label based on appointment status and payment status
  const getStatusLabel = (appointment: Appointment): string => {
    if (appointment.status === 'cancelled') {
      return 'CANCELLED';
    }
    if (appointment.status === 'pending') {
      return 'PENDING';
    }
    if (appointment.status === 'approved') {
      // Check if completed (fully paid)
      if (appointment.paymentStatus === 'fully_paid') {
        return 'COMPLETED';
      }
      // Confirmed (approved but not fully paid)
      return 'CONFIRMED';
    }
    // Default fallback
    return appointment.status.toUpperCase();
  };

  // Get status color classes based on appointment status
  const getStatusColorClasses = (appointment: Appointment): string => {
    if (appointment.status === 'cancelled') {
      return 'bg-gray-100 text-gray-800';
    }
    if (appointment.status === 'pending') {
      return 'bg-yellow-100 text-yellow-800';
    }
    if (appointment.status === 'approved') {
      // Check if completed (fully paid) - show blue
      if (appointment.paymentStatus === 'fully_paid') {
        return 'bg-blue-100 text-blue-800';
      }
      // Confirmed (approved but not fully paid) - show green
      return 'bg-green-100 text-green-800';
    }
    // Default fallback
    return 'bg-gray-100 text-gray-800';
  };

  const getStockStatus = (item: InventoryItem): 'safe' | 'low' | 'critical' => {
    const reorderPoint = item.reorderPoint;
    
    if (reorderPoint === undefined || reorderPoint === 0) {
      // If no reorder point set, use default thresholds
      if (item.stock < 10) return 'critical';
      if (item.stock < 20) return 'low';
      return 'safe';
    }
    
    // Critical: stock is below reorder point
    if (item.stock < reorderPoint) return 'critical';
    
    // Low: stock is approaching reorder point (within 20% above reorder point)
    const lowThreshold = reorderPoint * 1.2;
    if (item.stock < lowThreshold) return 'low';
    
    return 'safe';
  };

  const lowStockItems = items.filter(item => {
    const status = getStockStatus(item as InventoryItem);
    return status === 'low' || status === 'critical';
  });
  const todayAppointments = appointments.filter(apt => {
    const today = new Date().toDateString();
    return new Date(apt.date).toDateString() === today;
  }).sort((a, b) => a.time.localeCompare(b.time));
  const pendingAppointments = appointments.filter(apt => apt.status === 'pending');
  const myAppointments = hasFullAccess ? appointments : appointments.filter(apt => apt.status === 'approved');

  // Format time to 12-hour format
  const formatTime12Hour = (time24: string): string => {
    const [hours, minutes] = time24.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12;
    return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  // Format date for display
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  // Get vet schedules - schedules that vets have set for themselves
  const vetSchedules = schedules
    .filter(schedule => {
      // Get all vet names from staff
      const vetNames = staff
        .filter(member => member.position === 'Veterinarian' && member.status === 'active')
        .map(member => member.name);
      // Check if schedule has any vets
      return schedule.veterinarians.some(vet => vetNames.includes(vet));
    })
    .sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      return a.startTime.localeCompare(b.startTime);
    })
    .slice(0, 10); // Limit to 10 most recent

  // Calculate monthly revenue for the current year (Jan-Dec) based on payment confirmation dates
  // This matches PaymentTransactions logic: count FULL price per completed appointment
  const currentYear = new Date().getFullYear();
  const monthlyRevenueData = Array.from({ length: 12 }, (_, monthIndex) => {
    const monthName = new Date(2000, monthIndex, 1).toLocaleDateString('en-US', { month: 'short' });
    
    // Calculate revenue from completed appointments in this month
    // Match PaymentTransactions: only count fully paid/completed appointments with full price
    const monthRevenue = appointments.reduce((sum, apt) => {
      if (!apt.price || apt.price <= 0) return sum;
      if (apt.status !== 'approved') return sum;
      
      const paymentData = apt.paymentData || {};
      
      // An appointment is considered completed/fully paid if:
      // 1. paymentStatus is 'fully_paid', OR
      // 2. There's a fullPaymentConfirmedAt or remainingBalanceConfirmedAt (staff confirmed full payment)
      const isFullyPaid = apt.paymentStatus === 'fully_paid' || 
                         paymentData.fullPaymentConfirmedAt || 
                         paymentData.remainingBalanceConfirmedAt;
      
      if (!isFullyPaid) return sum; // Only count fully paid/completed appointments
      
      // Determine the confirmation date (when the appointment was fully completed)
      // This matches PaymentTransactions logic exactly
      let confirmationDate: Date | null = null;
      
      // Prioritize: remainingBalanceConfirmedAt > fullPaymentConfirmedAt > appointment date
      if (paymentData.remainingBalanceConfirmedAt) {
        confirmationDate = new Date(paymentData.remainingBalanceConfirmedAt);
      } else if (paymentData.fullPaymentConfirmedAt) {
        confirmationDate = new Date(paymentData.fullPaymentConfirmedAt);
      } else {
        // For fully paid appointments without explicit confirmation dates, use appointment date
        confirmationDate = new Date(apt.date);
      }
      
      // Count the FULL price in the month when the appointment was completed
      if (confirmationDate.getFullYear() === currentYear && confirmationDate.getMonth() === monthIndex) {
        return sum + apt.price; // Full price of the service
      }
      
      return sum;
    }, 0);
    
    return {
      month: monthName,
      revenue: monthRevenue,
    };
  });

  const stats = [
    ...(hasFullAccess
      ? [
          {
            name: 'Total Items',
            value: items.length.toString(),
            icon: Package,
            color: 'text-blue-600 bg-blue-100',
          },
          {
            name: 'Low Stock Items',
            value: lowStockItems.length.toString(),
            icon: Package,
            color: 'text-red-600 bg-red-100',
          },
        ]
      : []),
    {
      name: hasFullAccess ? "Today's Appointments" : 'Upcoming Appointments',
      value: hasFullAccess
        ? todayAppointments.length.toString()
        : myAppointments.length.toString(),
      icon: Calendar,
      color: hasFullAccess ? 'text-green-600 bg-green-100' : 'text-purple-600 bg-purple-100',
    },
    {
      name: hasFullAccess ? 'Pending Appointments' : 'Pets with Records',
      value: hasFullAccess
        ? pendingAppointments.length.toString()
        : new Set(records.map((r) => r.petName)).size.toString(),
      icon: Users,
      color: hasFullAccess ? 'text-yellow-600 bg-yellow-100' : 'text-pink-600 bg-pink-100',
    },
  ];

  // Engaging pet owner dashboard layout
  if (!hasFullAccess) {
    const upcomingAppointments = myAppointments
      .filter((apt) => new Date(apt.date) >= new Date())
      .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))
      .slice(0, 3);

    const hasPets = records.length > 0;

    return (
      <div className="space-y-8">
        {/* Hero section */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-500 p-6 sm:p-8">
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top,_#fff,_transparent_60%)]" />
          <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 text-xs font-medium text-white mb-3">
                <Heart className="h-4 w-4" />
                <span>Caring for your pets made simple</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-white flex items-center gap-3">
                <span>
                  Welcome back
                  {ownerDisplayName ? `, ${ownerDisplayName}!` : '!'}
                </span>
              </h1>
              <p className="mt-2 text-sm sm:text-base text-indigo-100 max-w-xl">
                Track your upcoming visits, manage your pet&apos;s records, and stay on top of their
                health in one friendly dashboard.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  onClick={() => navigate('/appointments')}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white text-purple-700 text-sm font-semibold shadow-sm hover:bg-indigo-50 transition-colors"
                >
                  <Calendar className="h-4 w-4" />
                  Book a new appointment
                </button>
                <button
                  onClick={() => navigate('/pet-records')}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 text-white text-sm font-semibold border border-white/30 hover:bg-white/15 transition-colors"
                >
                  <Heart className="h-4 w-4" />
                  View pet records
                </button>
              </div>
            </div>
            <div className="relative w-full max-w-xs mx-auto md:mx-0">
              <div className="rounded-2xl bg-white/10 border border-white/30 backdrop-blur-md p-4 shadow-lg">
                <p className="text-xs font-semibold text-indigo-100 mb-2">Next appointment</p>
                {upcomingAppointments.length === 0 ? (
                  <p className="text-sm text-indigo-100">
                    You don&apos;t have any upcoming appointments yet. Book one to get started.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {upcomingAppointments.map((apt) => (
                      <div
                        key={apt.id}
                        className="rounded-lg bg-white/10 p-3 border border-white/20 text-xs text-indigo-50"
                      >
                        <p className="font-semibold">
                          {formatDate(apt.date)} · {formatTime12Hour(apt.time)}
                        </p>
                        <p className="mt-1">
                          With <span className="font-medium">{apt.vet}</span>
                        </p>
                        {apt.serviceType && (
                          <p className="mt-0.5 text-[11px] text-indigo-100">
                            {getServiceName(apt.serviceType)}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Stats + pets summary */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Stat cards */}
          <div className="lg:col-span-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {stats.map((stat) => (
                <div
                  key={stat.name}
                  className="bg-white rounded-2xl p-5 shadow-sm border hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                        {stat.name}
                      </p>
                      <p className="mt-1 text-2xl font-bold text-gray-900">{stat.value}</p>
                    </div>
                    <div className={`p-3 rounded-xl ${stat.color}`}>
                      <stat.icon className="h-6 w-6" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pets summary */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Your pets</h3>
            {hasPets ? (
              <div className="space-y-2">
                {records.slice(0, 4).map((record) => (
                  <div
                    key={record.id}
                    className="flex items-center justify-between rounded-lg bg-purple-50 px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium text-purple-900">{record.petName}</p>
                      <p className="text-xs text-purple-700">
                        {record.breed} · {record.age} yrs · {record.weight} kg
                      </p>
                    </div>
                  </div>
                ))}
                {records.length > 4 && (
                  <button
                    onClick={() => navigate('/pet-records')}
                    className="mt-1 text-xs font-medium text-purple-700 hover:text-purple-900"
                  >
                    View all records
                  </button>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-500">
                You don&apos;t have any pet records yet. Add your pet&apos;s information to track their
                health history.
              </p>
            )}
          </div>
        </div>

        {/* Appointments + records */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch min-h-[40vh]">
          {/* My recent appointments */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border lg:col-span-2 flex flex-col h-full">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">My recent appointments</h3>
            <div className="space-y-3 flex-1">
              {myAppointments.slice(0, 5).length === 0 ? (
                <p className="text-sm text-gray-500">No appointments found.</p>
              ) : (
                myAppointments
                  .slice()
                  .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`))
                  .slice(0, 5)
                  .map((appointment) => (
                    <div
                      key={appointment.id}
                      className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex-1">
                        <p className="text-sm text-gray-900">
                          <span className="font-semibold text-purple-700">
                            {formatDate(appointment.date)}
                          </span>{' '}
                          · {formatTime12Hour(appointment.time)}
                        </p>
                        <p className="text-xs text-gray-600">
                          With {appointment.vet}
                          {appointment.serviceType && (
                            <span> · {getServiceName(appointment.serviceType)}</span>
                          )}
                        </p>
                      </div>
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ml-2 ${getStatusColorClasses(
                          appointment,
                        )}`}
                      >
                        {getStatusLabel(appointment)}
                      </span>
                    </div>
                  ))
              )}
            </div>
          </div>

          {/* Recent records - tall card to match appointments visually */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border flex flex-col h-full">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Recent pet records</h3>
            <div className="space-y-3 flex-1">
              {records.length === 0 ? (
                <p className="text-sm text-gray-500">No pet records found.</p>
              ) : (
                records.slice(0, 6).map((record) => (
                  <div
                    key={record.id}
                    className="p-3 bg-purple-50 rounded-lg border border-purple-100"
                  >
                    <h4 className="font-medium text-purple-900 mb-1">{record.petName}</h4>
                    <p className="text-xs text-purple-800">
                      {record.recentIllness
                        ? `Recent concern: ${record.recentIllness}`
                        : 'No recent illness recorded'}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Admin / staff dashboard layout
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Stethoscope className="h-8 w-8 text-blue-600" />
          Admin Dashboard
        </h1>
        <p className="text-gray-600">
          Manage your veterinary clinic operations and patient care
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.name} className="bg-white rounded-lg p-6 shadow-sm border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              </div>
              <div className={`p-3 rounded-lg ${stat.color}`}>
                <stat.icon className="h-6 w-6" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        {/* Today's Appointments / My Appointments */}
        <div className="bg-white rounded-lg p-6 shadow-sm border flex flex-col min-h-[420px]">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {hasFullAccess ? "Today's Appointments" : "My Recent Appointments"}
          </h3>
          <div className="space-y-3 flex-1">
            {(hasFullAccess ? todayAppointments : myAppointments.slice(0, 5)).length === 0 ? (
              <p className="text-gray-500 text-sm">
                {hasFullAccess ? 'No appointments today' : 'No appointments found'}
              </p>
            ) : (
              (hasFullAccess ? todayAppointments : myAppointments).slice(0, 5).map((appointment) => (
                <div key={appointment.id} className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm text-gray-900">
                      <span className="text-purple-600 font-mono font-semibold">
                        {formatTime12Hour(appointment.time)}
                      </span>
                      {' - '}
                      {hasFullAccess ? appointment.ownerName : appointment.vet}
                      {appointment.serviceType && (
                        <span className="text-gray-600"> ({getServiceName(appointment.serviceType)})</span>
                      )}
                    </p>
                  </div>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ml-2 ${getStatusColorClasses(appointment)}`}>
                    {getStatusLabel(appointment)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Vet's Schedule - Only show for admin */}
        {hasFullAccess && (
          <div className="bg-white rounded-lg p-6 shadow-sm border">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Vet's Schedule</h3>
            <div className="space-y-3">
              {vetSchedules.length === 0 ? (
                <p className="text-gray-500 text-sm">No vet schedules found</p>
              ) : (
                vetSchedules.slice(0, 5).map((schedule) => (
                  schedule.veterinarians.map((vetName, idx) => (
                    <div key={`${schedule.id}-${idx}`} className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-blue-600 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{vetName}</p>
                        <p className="text-xs text-gray-600">
                          {formatDate(schedule.date)} @ {formatTime12Hour(schedule.startTime)}
                        </p>
                      </div>
                    </div>
                  ))
                )).flat().slice(0, 5)
              )}
            </div>
          </div>
        )}

        {/* Low Stock Alert / Pet Records */}
        {hasFullAccess ? (
          <div className="bg-white rounded-lg p-6 shadow-sm border flex flex-col min-h-[420px]">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Stock Alerts</h3>
            <div className="space-y-3 flex-1">
              {lowStockItems.length === 0 ? (
                <p className="text-gray-500 text-sm">All items are well stocked</p>
              ) : (
                lowStockItems.slice(0, 5).map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{item.name}</p>
                      <p className="text-sm text-gray-600">{item.category}</p>
                    </div>
                    <span className="text-red-600 font-semibold">{item.stock} left</span>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg p-6 shadow-sm border flex flex-col min-h-[420px]">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Pet Records</h3>
            <div className="space-y-3 flex-1">
              {records.length === 0 ? (
                <p className="text-gray-500 text-sm">No pet records found</p>
              ) : (
                records.slice(0, 3).map((record) => (
                  <div key={record.id} className="p-3 bg-purple-50 rounded-lg">
                    <h4 className="font-medium text-purple-900 mb-1">{record.petName}</h4>
                    <p className="text-sm text-purple-800">
                      {record.recentIllness ? `Recent: ${record.recentIllness}` : 'No recent illness recorded'}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Revenue Overview - Only show for admin */}
      {hasFullAccess && (
        <div className="bg-white rounded-lg p-6 shadow-sm border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue Overview</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyRevenueData}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  dataKey="month" 
                  stroke="#6b7280"
                  style={{ fontSize: '12px' }}
                />
                <YAxis 
                  stroke="#6b7280"
                  style={{ fontSize: '12px' }}
                  tickFormatter={(value) => `P${value.toLocaleString()}`}
                />
                <Tooltip 
                  formatter={(value: number) => [`P${value.toLocaleString()}`, 'Revenue']}
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  fill="url(#colorRevenue)"
                  dot={{ fill: '#3b82f6', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      {!hasFullAccess && (
        <div className="bg-white rounded-lg p-6 shadow-sm border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button 
              onClick={() => navigate('/appointments')}
              className="p-4 bg-blue-50 rounded-lg text-left hover:bg-blue-100 transition-colors"
            >
              <Calendar className="h-8 w-8 text-blue-600 mb-2" />
              <h4 className="font-medium text-gray-900">Book Appointment</h4>
              <p className="text-sm text-gray-600">Schedule a visit for your pet</p>
            </button>
            <button 
              onClick={() => navigate('/pet-records')}
              className="p-4 bg-green-50 rounded-lg text-left hover:bg-green-100 transition-colors"
            >
              <Heart className="h-8 w-8 text-green-600 mb-2" />
              <h4 className="font-medium text-gray-900">Pet Records</h4>
              <p className="text-sm text-gray-600">Manage your pet's health records</p>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
