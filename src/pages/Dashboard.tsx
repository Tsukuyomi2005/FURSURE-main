import { Calendar, Package, Users, DollarSign, Heart, Stethoscope } from 'lucide-react';
import { useInventoryStore } from '../stores/inventoryStore';
import { useAppointmentStore } from '../stores/appointmentStore';
import { useRoleStore } from '../stores/roleStore';
import { usePetRecordsStore } from '../stores/petRecordsStore';
import { useNavigate } from 'react-router-dom';

export function Dashboard() {
  const { items } = useInventoryStore();
  const { appointments } = useAppointmentStore();
  const { records } = usePetRecordsStore();
  const { role } = useRoleStore();
  const navigate = useNavigate();

  const hasFullAccess = role === 'vet' || role === 'staff';

  const lowStockItems = items.filter(item => item.stock < 10);
  const todayAppointments = appointments.filter(apt => {
    const today = new Date().toDateString();
    return new Date(apt.date).toDateString() === today;
  });
  const pendingAppointments = appointments.filter(apt => apt.status === 'pending');
  const myAppointments = hasFullAccess ? appointments : appointments.filter(apt => apt.status === 'approved');

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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                <div key={appointment.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{appointment.petName}</p>
                    <p className="text-sm text-gray-600">
                      {appointment.time} - {hasFullAccess ? appointment.ownerName : appointment.vet}
                    </p>
                  </div>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    appointment.status === 'approved' ? 'bg-green-100 text-green-800' :
                    appointment.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                    appointment.status === 'rejected' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {appointment.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Low Stock Alert / Pet Records */}
        {hasFullAccess ? (
          <div className="bg-white rounded-lg p-6 shadow-sm border">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Low Stock Alert</h3>
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
