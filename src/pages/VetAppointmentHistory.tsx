import { useState } from 'react';
import { Calendar, Clock, Search, Filter, User, FileText } from 'lucide-react';
import { useAppointmentStore } from '../stores/appointmentStore';
import { useServiceStore } from '../stores/serviceStore';

// For now, using a placeholder vet name. In production, this would come from auth/profile
const VET_NAME = 'Dr. Smith'; // This should be dynamic based on logged-in vet

export function VetAppointmentHistory() {
  const { appointments } = useAppointmentStore();
  const { services } = useServiceStore();
  
  // Get service name from service ID
  const getServiceName = (serviceId: string | undefined): string => {
    if (!serviceId) return 'N/A';
    const service = services.find(s => s.id === serviceId);
    return service ? service.name : serviceId; // Fallback to ID if service not found
  };
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('');

  // Filter appointments for this veterinarian
  const vetAppointments = appointments.filter(apt => apt.vet === VET_NAME);

  // Apply filters
  const filteredAppointments = vetAppointments.filter(apt => {
    const matchesSearch = 
      apt.petName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      apt.ownerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      apt.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || apt.status === statusFilter;
    const matchesDate = !dateFilter || apt.date === dateFilter;
    return matchesSearch && matchesStatus && matchesDate;
  });

  // Sort by date (newest first)
  const sortedAppointments = [...filteredAppointments].sort((a, b) => {
    const dateCompare = b.date.localeCompare(a.date);
    if (dateCompare !== 0) return dateCompare;
    return b.time.localeCompare(a.time);
  });

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTime12Hour = (time24: string): string => {
    const [hours, minutes] = time24.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12;
    return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      case 'rescheduled': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'Pending';
      case 'approved': return 'Approved';
      case 'cancelled': return 'Cancelled';
      case 'rescheduled': return 'Rescheduled';
      default: return status;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Appointment History</h1>
        <p className="text-gray-600 mt-2">View all your past and current appointments</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Search by pet, owner, or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="cancelled">Cancelled</option>
              <option value="rescheduled">Rescheduled</option>
            </select>
          </div>
          <div>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Appointments List */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold text-gray-900">
            Appointments ({sortedAppointments.length})
          </h2>
        </div>
        <div className="divide-y divide-gray-200">
          {sortedAppointments.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No appointments found</p>
            </div>
          ) : (
            sortedAppointments.map((apt) => (
              <div key={apt.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-4 mb-3">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-gray-400" />
                        <span className="font-medium text-gray-900">
                          {formatDate(apt.date)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-5 w-5 text-gray-400" />
                        <span className="text-gray-700">{formatTime12Hour(apt.time)}</span>
                      </div>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(apt.status)}`}>
                        {getStatusLabel(apt.status)}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm text-gray-500 mb-1">Pet Name</div>
                        <div className="font-medium text-gray-900">{apt.petName}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-500 mb-1">Owner</div>
                        <div className="font-medium text-gray-900">{apt.ownerName}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-500 mb-1">Email</div>
                        <div className="text-gray-700">{apt.email}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-500 mb-1">Phone</div>
                        <div className="text-gray-700">{apt.phone}</div>
                      </div>
                      {apt.serviceType && (
                        <div>
                          <div className="text-sm text-gray-500 mb-1">Service</div>
                          <div className="text-gray-700">{getServiceName(apt.serviceType)}</div>
                        </div>
                      )}
                      {apt.price && (
                        <div>
                          <div className="text-sm text-gray-500 mb-1">Price</div>
                          <div className="text-gray-700">₱{apt.price.toLocaleString()}</div>
                        </div>
                      )}
                    </div>
                    {apt.reason && (
                      <div className="mt-4">
                        <div className="text-sm text-gray-500 mb-1">Reason</div>
                        <div className="text-gray-700">{apt.reason}</div>
                      </div>
                    )}
                    {apt.notes && (
                      <div className="mt-4">
                        <div className="text-sm text-gray-500 mb-1">Notes</div>
                        <div className="text-gray-700">{apt.notes}</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

