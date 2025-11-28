import { Calendar, Package, Users, DollarSign, Heart, Stethoscope } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useInventoryStore } from '../stores/inventoryStore';
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

  const lowStockItems = items.filter(item => item.stock < 10);
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
  const currentYear = new Date().getFullYear();
  const monthlyRevenueData = Array.from({ length: 12 }, (_, monthIndex) => {
    const monthName = new Date(2000, monthIndex, 1).toLocaleDateString('en-US', { month: 'short' });
    
    // Calculate revenue from confirmed payments in this month
    // Use the same logic as Reports and PaymentTransactions - based on confirmation dates
    const monthRevenue = appointments.reduce((sum, apt) => {
      if (!apt.price || apt.price <= 0) return sum;
      if (apt.status !== 'approved') return sum;
      
      const paymentData = apt.paymentData || {};
      const depositAmount = Math.round(apt.price * 0.3);
      const remainingAmount = apt.price - depositAmount;
      
      let monthRevenueForApt = 0;
      
      // Check deposit confirmation date
      if (paymentData.depositConfirmedAt) {
        const depositDate = new Date(paymentData.depositConfirmedAt);
        if (depositDate.getFullYear() === currentYear && depositDate.getMonth() === monthIndex) {
          monthRevenueForApt += depositAmount;
        }
      }
      
      // Check full payment confirmation date
      if (paymentData.fullPaymentConfirmedAt) {
        const fullPaymentDate = new Date(paymentData.fullPaymentConfirmedAt);
        if (fullPaymentDate.getFullYear() === currentYear && fullPaymentDate.getMonth() === monthIndex) {
          // Only count if it's a full payment (not split with deposit)
          if (!paymentData.depositConfirmedAt || paymentData.method === 'at_clinic') {
            monthRevenueForApt += apt.price;
          }
        }
      }
      
      // Check remaining balance confirmation date
      if (paymentData.remainingBalanceConfirmedAt) {
        const remainingDate = new Date(paymentData.remainingBalanceConfirmedAt);
        if (remainingDate.getFullYear() === currentYear && remainingDate.getMonth() === monthIndex) {
          monthRevenueForApt += remainingAmount;
        }
      }
      
      // Fallback: If no confirmation dates but payment status indicates payment, use appointment date
      // This handles online payments that were paid but not yet confirmed by staff
      if (!paymentData.depositConfirmedAt && 
          !paymentData.fullPaymentConfirmedAt && 
          !paymentData.remainingBalanceConfirmedAt) {
        const method = paymentData.method;
        if ((apt.paymentStatus === 'fully_paid' || apt.paymentStatus === 'down_payment_paid') &&
            (method === 'online' || method === 'gcash' || method === 'paymaya')) {
          const aptDate = new Date(apt.date);
          if (aptDate.getFullYear() === currentYear && aptDate.getMonth() === monthIndex) {
            if (apt.paymentStatus === 'fully_paid') {
              monthRevenueForApt += apt.price;
            } else if (apt.paymentStatus === 'down_payment_paid') {
              monthRevenueForApt += depositAmount;
            }
          }
        }
      }
      
      return sum + monthRevenueForApt;
    }, 0);
    
    return {
      month: monthName,
      revenue: monthRevenue,
    };
  });

  const stats = [
    ...(hasFullAccess ? [
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
    ] : []),
    {
      name: hasFullAccess ? "Today's Appointments" : "My Appointments",
      value: hasFullAccess ? todayAppointments.length.toString() : myAppointments.length.toString(),
      icon: Calendar,
      color: 'text-green-600 bg-green-100',
    },
    {
      name: hasFullAccess ? 'Pending Appointments' : 'Pet Records',
      value: hasFullAccess ? pendingAppointments.length.toString() : records.length.toString(),
      icon: Users,
      color: 'text-yellow-600 bg-yellow-100',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          {hasFullAccess ? (
            <>
              <Stethoscope className="h-8 w-8 text-blue-600" />
              Admin Dashboard
            </>
          ) : (
            <>
              <Heart className="h-8 w-8 text-purple-600" />
              Pet Owner Dashboard
            </>
          )}
        </h1>
        <p className="text-gray-600">
          {hasFullAccess 
            ? 'Manage your veterinary clinic operations and patient care' 
            : 'Welcome to FURSURE - Manage your pet\'s health and appointments'
          }
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's Appointments / My Appointments */}
        <div className="bg-white rounded-lg p-6 shadow-sm border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {hasFullAccess ? "Today's Appointments" : "My Recent Appointments"}
          </h3>
          <div className="space-y-3">
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
          <div className="bg-white rounded-lg p-6 shadow-sm border">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Stock Alerts</h3>
            <div className="space-y-3">
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
          <div className="bg-white rounded-lg p-6 shadow-sm border">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Pet Records</h3>
            <div className="space-y-3">
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
