import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Menu, 
  X, 
  Home, 
  Calendar, 
  Package, 
  Heart,
  LogOut,
  FileText,
  Clock,
  CalendarCheck,
  Receipt,
  Stethoscope,
  Users,
  User,
  BarChart3,
  CreditCard
} from 'lucide-react';
import { useRoleStore } from '../stores/roleStore';
import { cn } from '../lib/utils';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { role, setRole, clearRole } = useRoleStore();

  const hasFullAccess = role === 'vet' || role === 'staff';
  const isVeterinarian = role === 'veterinarian';
  const isClinicStaff = role === 'clinicStaff';

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: Home, current: location.pathname === '/dashboard' },
    ...(isClinicStaff ? [
      { name: 'Manage Availability', href: '/staff-manage-availability', icon: Clock, current: location.pathname === '/staff-manage-availability' },
      { name: 'Inventory', href: '/staff-inventory', icon: Package, current: location.pathname === '/staff-inventory' },
      { name: 'Payment Management', href: '/staff-payment-management', icon: CreditCard, current: location.pathname === '/staff-payment-management' },
      { name: 'Profile Settings', href: '/staff-profile-settings', icon: User, current: location.pathname === '/staff-profile-settings' },
    ] : isVeterinarian ? [
      { name: 'My Appointments', href: '/vet-my-appointments', icon: CalendarCheck, current: location.pathname === '/vet-my-appointments' },
      { name: 'Manage Availability', href: '/vet-manage-availability', icon: Clock, current: location.pathname === '/vet-manage-availability' },
      { name: 'Pet Records', href: '/pet-records', icon: FileText, current: location.pathname === '/pet-records' },
      { name: 'Appointment History', href: '/vet-appointment-history', icon: Calendar, current: location.pathname === '/vet-appointment-history' },
      { name: 'Profile Settings', href: '/vet-profile-settings', icon: User, current: location.pathname === '/vet-profile-settings' },
    ] : hasFullAccess ? [
      { name: 'Appointments', href: '/appointments', icon: Calendar, current: location.pathname === '/appointments' },
      { name: 'Schedule Management', href: '/schedule-management', icon: Clock, current: location.pathname === '/schedule-management' },
      { name: 'Services', href: '/services', icon: Stethoscope, current: location.pathname === '/services' },
      { name: 'Veterinarians/Staff', href: '/staff-management', icon: Users, current: location.pathname === '/staff-management' },
      { name: 'Inventory', href: '/inventory', icon: Package, current: location.pathname === '/inventory' },
      { name: 'Payment Transactions', href: '/payment-transactions', icon: CreditCard, current: location.pathname === '/payment-transactions' },
      { name: 'Reports', href: '/reports', icon: BarChart3, current: location.pathname === '/reports' },
    ] : [
      { name: hasFullAccess ? 'Appointments' : 'Book Appointment', href: '/appointments', icon: Calendar, current: location.pathname === '/appointments' },
      { name: 'My Appointments', href: '/my-appointments', icon: CalendarCheck, current: location.pathname === '/my-appointments' },
      { name: 'Payment Timeline', href: '/payment-timeline', icon: Receipt, current: location.pathname === '/payment-timeline' },
      { name: 'Pet Records', href: '/pet-records', icon: FileText, current: location.pathname === '/pet-records' },
      { name: 'Profile Settings', href: '/owner-profile-settings', icon: User, current: location.pathname === '/owner-profile-settings' },
    ]),
  ];

  const getRoleBadgeColor = () => {
    switch (role) {
      case 'vet': return 'bg-blue-100 text-blue-800';
      case 'staff': return 'bg-green-100 text-green-800';
      case 'owner': return 'bg-purple-100 text-purple-800';
      case 'veterinarian': return 'bg-indigo-100 text-indigo-800';
      case 'clinicStaff': return 'bg-teal-100 text-teal-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleLogout = () => {
    // Clear stored user session
    localStorage.removeItem('fursure_current_user');
    // Clear role from store
    clearRole();
    // Navigate to login page
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Mobile sidebar */}
      <div className={cn(
        "fixed inset-0 z-50 lg:hidden",
        sidebarOpen ? "block" : "hidden"
      )}>
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
        <div className="fixed inset-y-0 left-0 flex w-64 flex-col bg-gradient-to-b from-purple-700 via-purple-600 to-purple-800 shadow-xl">
          <div className="flex h-16 items-center justify-between px-4 border-b border-purple-500/30">
            <div className="flex items-center gap-2">
              <Heart className="h-8 w-8 text-white" />
              <span className="text-xl font-bold text-white">FURSURE</span>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="text-white/70 hover:text-white"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          <nav className="flex-1 px-4 py-4 space-y-2">
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all relative",
                  item.current
                    ? "bg-white/20 text-white border-l-4 border-white/50"
                    : "text-white hover:bg-white/10 hover:text-white"
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.name}
              </Link>
            ))}
          </nav>
          <div className="p-4 border-t border-purple-500/30">
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-white hover:bg-white/10 w-full transition-colors"
            >
              <LogOut className="h-5 w-5" />
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:w-64 lg:flex-col lg:bg-gradient-to-b lg:from-purple-700 lg:via-purple-600 lg:to-purple-800 lg:border-r lg:border-purple-500/30">
        <div className="flex h-16 items-center px-4 border-b border-purple-500/30">
          <div className="flex items-center gap-2">
            <Heart className="h-8 w-8 text-white" />
            <span className="text-xl font-bold text-white">FURSURE</span>
          </div>
        </div>
        <nav className="flex-1 px-4 py-4 space-y-2">
          {navigation.map((item) => (
            <Link
              key={item.name}
              to={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all relative",
                item.current
                  ? "bg-white/20 text-white border-l-4 border-white/50"
                  : "text-white hover:bg-white/10 hover:text-white"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-purple-500/30">
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-white hover:bg-white/10 w-full transition-colors"
            >
              <LogOut className="h-5 w-5" />
              Logout
            </button>
          </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b px-4 lg:px-6 h-16 flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-gray-500 hover:text-gray-700"
          >
            <Menu className="h-6 w-6" />
          </button>
          
          <div className="flex items-center gap-4">
            <span className={cn(
              "px-3 py-1 rounded-full text-xs font-medium capitalize",
              getRoleBadgeColor()
            )}>
              {role === 'vet' ? 'Admin' : role === 'staff' ? 'Staff Member' : role === 'veterinarian' ? 'Veterinarian' : role === 'clinicStaff' ? 'Clinic Staff' : role === 'owner' ? 'Pet Owner' : 'Guest'}
            </span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
