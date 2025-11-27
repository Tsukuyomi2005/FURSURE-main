import { Calendar, Clock, Users, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react';
import { useAppointmentStore } from '../stores/appointmentStore';
import { useRoleStore } from '../stores/roleStore';

// For now, using a placeholder staff name. In production, this would come from auth/profile
const STAFF_NAME = 'Staff Member'; // This should be dynamic based on logged-in staff

export function StaffDashboard() {
  const { appointments } = useAppointmentStore();
  const { role } = useRoleStore();

  // Calculate statistics
  const today = new Date().toISOString().split('T')[0];
  const todayAppointments = appointments.filter(apt => apt.date === today);
  const pendingAppointments = appointments.filter(apt => apt.status === 'pending');
  const upcomingAppointments = appointments
    .filter(apt => apt.status === 'approved' && apt.date >= today)
    .sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      return a.time.localeCompare(b.time);
    })
    .slice(0, 5);

  const formatTime12Hour = (time24: string): string => {
    const [hours, minutes] = time24.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12;
    return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  const formatDate = (dateStr: string): string => {
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
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-2">Welcome back, {STAFF_NAME}</p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-6 shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Today's Appointments</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{todayAppointments.length}</p>
            </div>
            <div className="p-3 rounded-lg bg-blue-100 text-blue-600">
              <Calendar className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-yellow-600 mt-1">{pendingAppointments.length}</p>
            </div>
            <div className="p-3 rounded-lg bg-yellow-100 text-yellow-600">
              <Clock className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Appointments</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{appointments.length}</p>
            </div>
            <div className="p-3 rounded-lg bg-green-100 text-green-600">
              <CheckCircle className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">This Month</p>
              <p className="text-2xl font-bold text-purple-600 mt-1">
                {appointments.filter(apt => {
                  const aptDate = new Date(apt.date);
                  const now = new Date();
                  return aptDate.getMonth() === now.getMonth() && 
                         aptDate.getFullYear() === now.getFullYear();
                }).length}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-purple-100 text-purple-600">
              <TrendingUp className="h-6 w-6" />
            </div>
          </div>
        </div>
      </div>

      {/* Upcoming Appointments */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Upcoming Appointments</h2>
        </div>
        <div className="p-6">
          {upcomingAppointments.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No upcoming appointments</p>
            </div>
          ) : (
            <div className="space-y-4">
              {upcomingAppointments.map((apt) => (
                <div key={apt.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Calendar className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{apt.petName}</div>
                      <div className="text-sm text-gray-600">{apt.ownerName}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium text-gray-900">{formatDate(apt.date)}</div>
                    <div className="text-sm text-gray-600">{formatTime12Hour(apt.time)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

