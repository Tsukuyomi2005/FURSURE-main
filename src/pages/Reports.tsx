import { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, AreaChart, Area, BarChart, Bar, ReferenceLine } from 'recharts';
import { useAppointmentStore } from '../stores/appointmentStore';
import { useServiceStore } from '../stores/serviceStore';
import { useInventoryStore } from '../stores/inventoryStore';
import type { Appointment } from '../types';

type ReportPeriod = 'today' | 'yesterday' | 'thisWeek' | 'thisMonth' | 'lastMonth' | 'thisQuarter' | 'thisYear';

export function Reports() {
  // Fetch appointments directly from Convex database (appointments table)
  // This uses useQuery(api.appointments.list) which queries ctx.db.query("appointments").collect()
  const { appointments } = useAppointmentStore();
  const { services } = useServiceStore();
  const { items } = useInventoryStore();
  const [selectedPeriod, setSelectedPeriod] = useState<ReportPeriod>('today');

  // Helper function to get date range based on period
  const getDateRange = (period: ReportPeriod): { start: Date; end: Date } => {
    const now = new Date();
    now.setHours(23, 59, 59, 999);
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    switch (period) {
      case 'today':
        return { start, end: now };
      
      case 'yesterday':
        start.setDate(start.getDate() - 1);
        const yesterdayEnd = new Date(start);
        yesterdayEnd.setHours(23, 59, 59, 999);
        return { start, end: yesterdayEnd };
      
      case 'thisWeek':
        const dayOfWeek = start.getDay();
        start.setDate(start.getDate() - dayOfWeek);
        return { start, end: now };
      
      case 'thisMonth':
        start.setDate(1);
        return { start, end: now };
      
      case 'lastMonth':
        start.setMonth(start.getMonth() - 1);
        start.setDate(1);
        const lastMonthEnd = new Date(start);
        lastMonthEnd.setMonth(lastMonthEnd.getMonth() + 1);
        lastMonthEnd.setDate(0);
        lastMonthEnd.setHours(23, 59, 59, 999);
        return { start, end: lastMonthEnd };
      
      case 'thisQuarter':
        const quarter = Math.floor(start.getMonth() / 3);
        start.setMonth(quarter * 3);
        start.setDate(1);
        return { start, end: now };
      
      case 'thisYear':
        start.setMonth(0);
        start.setDate(1);
        return { start, end: now };
      
      default:
        return { start, end: now };
    }
  };

  // Calculate revenue data using the SAME logic as Dashboard revenue overview
  // Adapted to work with different time periods (daily for short periods, monthly for long periods)
  const revenueData = useMemo(() => {
    const { start, end } = getDateRange(selectedPeriod);
    
    // Determine if we should group by day or month based on period length
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const useMonthlyGrouping = daysDiff > 60; // Use monthly grouping for periods longer than 60 days
    
    if (useMonthlyGrouping) {
      // Monthly grouping (same as Dashboard) - for long periods like "This Year", "This Quarter"
      const months: { month: number; year: number; monthName: string }[] = [];
      const current = new Date(start);
      current.setDate(1); // Start of month
      
      while (current <= end) {
        const monthName = current.toLocaleDateString('en-US', { month: 'short' });
        months.push({
          month: current.getMonth(),
          year: current.getFullYear(),
          monthName: monthName,
        });
        current.setMonth(current.getMonth() + 1);
      }
      
      return months.map(({ month, year, monthName }) => {
        // Calculate revenue from completed appointments in this month - SAME logic as Dashboard
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
          // This matches Dashboard and PaymentTransactions logic exactly
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
          if (confirmationDate.getFullYear() === year && confirmationDate.getMonth() === month) {
            return sum + apt.price; // Full price of the service
          }
          
          return sum;
        }, 0);
        
        return {
          date: monthName,
          revenue: monthRevenue,
        };
      });
    } else {
      // Daily grouping for short periods (today, yesterday, this week, this month, last month)
      const days: Date[] = [];
      const current = new Date(start);
      current.setHours(0, 0, 0, 0);
      const endNormalized = new Date(end);
      endNormalized.setHours(23, 59, 59, 999);
      
      while (current <= endNormalized) {
        days.push(new Date(current));
        current.setDate(current.getDate() + 1);
      }
      
      return days.map(day => {
        const dayStart = new Date(day);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(day);
        dayEnd.setHours(23, 59, 59, 999);
        
        // Calculate revenue from completed appointments on this specific day - SAME logic as Dashboard
        const dayRevenue = appointments.reduce((sum, apt) => {
          if (!apt.price || apt.price <= 0) return sum;
          if (apt.status !== 'approved') return sum;
          
          const paymentData = apt.paymentData || {};
          
          // An appointment is considered completed/fully paid if:
          const isFullyPaid = apt.paymentStatus === 'fully_paid' || 
                             paymentData.fullPaymentConfirmedAt || 
                             paymentData.remainingBalanceConfirmedAt;
          
          if (!isFullyPaid) return sum;
          
          // Determine the confirmation date
          let confirmationDate: Date | null = null;
          
          if (paymentData.remainingBalanceConfirmedAt) {
            confirmationDate = new Date(paymentData.remainingBalanceConfirmedAt);
          } else if (paymentData.fullPaymentConfirmedAt) {
            confirmationDate = new Date(paymentData.fullPaymentConfirmedAt);
          } else {
            confirmationDate = new Date(apt.date);
          }
          
          // Normalize confirmation date for comparison
          const confirmationDateNormalized = new Date(confirmationDate);
          confirmationDateNormalized.setHours(0, 0, 0, 0);
          
          // Count the FULL price on the day when the appointment was completed
          if (confirmationDateNormalized >= dayStart && confirmationDateNormalized <= dayEnd) {
            return sum + apt.price; // Full price of the service
          }
          
          return sum;
        }, 0);
        
        return {
          date: day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          revenue: dayRevenue,
        };
      });
    }
  }, [appointments, selectedPeriod]);

  // Calculate service distribution based on completed appointments (consistent with revenue data)
  const serviceDistribution = useMemo(() => {
    const { start, end } = getDateRange(selectedPeriod);
    // Group appointments by serviceType, counting only completed appointments in the period
    const serviceCounts: { [key: string]: number } = {};
    
    appointments.forEach((apt: Appointment) => {
      if (!apt.serviceType || apt.status !== 'approved') return;
      if (!apt.price || apt.price <= 0) return;
      
      const paymentData = apt.paymentData || {};
      
      // An appointment is considered completed/fully paid if:
      const isFullyPaid = apt.paymentStatus === 'fully_paid' || 
                         paymentData.fullPaymentConfirmedAt || 
                         paymentData.remainingBalanceConfirmedAt;
      
      if (!isFullyPaid) return;
      
      // Determine the confirmation date
      let confirmationDate: Date | null = null;
      
      if (paymentData.remainingBalanceConfirmedAt) {
        confirmationDate = new Date(paymentData.remainingBalanceConfirmedAt);
      } else if (paymentData.fullPaymentConfirmedAt) {
        confirmationDate = new Date(paymentData.fullPaymentConfirmedAt);
      } else {
        confirmationDate = new Date(apt.date);
      }
      
      // Normalize dates for comparison
      const confirmationDateNormalized = new Date(confirmationDate);
      confirmationDateNormalized.setHours(0, 0, 0, 0);
      const startNormalized = new Date(start);
      startNormalized.setHours(0, 0, 0, 0);
      const endNormalized = new Date(end);
      endNormalized.setHours(23, 59, 59, 999);
      
      // Count service if the appointment was completed within the selected period
      if (confirmationDateNormalized >= startNormalized && confirmationDateNormalized <= endNormalized) {
        serviceCounts[apt.serviceType] = (serviceCounts[apt.serviceType] || 0) + 1;
      }
    });

    const total = Object.values(serviceCounts).reduce((sum, count) => sum + count, 0);
    
    // Map service IDs to service names and create chart data
    const distribution = Object.entries(serviceCounts).map(([serviceId, count]) => {
      const service = services.find(s => s.id === serviceId);
      const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : '0';
      return {
        name: service?.name || 'Unknown Service',
        value: count,
        percentage: parseFloat(percentage),
      };
    });

    return distribution.sort((a, b) => b.value - a.value);
  }, [appointments, services, selectedPeriod]);

  // Calculate peak hours heatmap data
  // Data source: Convex appointments table (fetched via useAppointmentStore)
  // Only count Confirmed (approved but not fully paid) and Completed (approved and fully paid) appointments
  // IMPORTANT: Includes appointments from ALL veterinarians (no vet filtering)
  // IMPORTANT: Shows ALL appointments regardless of date (not filtered by report period)
  // All data comes directly from the Convex database appointments table
  const peakHoursData = useMemo(() => {
    // Initialize heatmap: days (Sunday=0 to Saturday=6) x hours (9 AM=9 to 6 PM=18)
    const heatmap: { [key: string]: number } = {};
    
    // Days of week: Sunday (0) to Saturday (6)
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    // Filter appointments: only Confirmed and Completed (approved status, not pending or cancelled)
    // NOTE: This includes appointments from ALL veterinarians - no vet filtering applied
    // NOTE: This includes ALL appointments regardless of date - no date filtering applied
    // Confirmed = status === 'approved' && (paymentStatus !== 'fully_paid' || paymentStatus is undefined/null)
    // Completed = status === 'approved' && paymentStatus === 'fully_paid'
    const validAppointments = appointments.filter((apt) => {
      // Only include approved appointments (this covers both Confirmed and Completed)
      // Explicitly check for approved status
      if (apt.status !== 'approved') return false;
      
      // Exclude any appointments that are explicitly cancelled, rejected, or pending
      // (though these shouldn't have status === 'approved', this is a safety check)
      if (apt.status === 'cancelled' || apt.status === 'rejected' || apt.status === 'pending') {
        return false;
      }
      
      // Both Confirmed and Completed appointments have status === 'approved'
      // Confirmed: paymentStatus !== 'fully_paid' (or undefined/null)
      // Completed: paymentStatus === 'fully_paid'
      // We include both, so no additional paymentStatus check needed here
      
      // No date filtering - include all approved appointments regardless of date
      return true;
    });
    
    // Count appointments by day of week and hour
    // This aggregates appointments from ALL veterinarians
    validAppointments.forEach((apt) => {
      try {
        // Parse date string (YYYY-MM-DD) in local timezone to avoid UTC issues
        let aptDate: Date;
        if (apt.date && typeof apt.date === 'string' && apt.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
          const [year, month, day] = apt.date.split('-').map(Number);
          aptDate = new Date(year, month - 1, day);
        } else {
          aptDate = new Date(apt.date);
        }
        
        // Validate date
        if (isNaN(aptDate.getTime())) {
          console.warn('Invalid appointment date:', apt.date, apt.id);
          return;
        }
        
        const dayOfWeek = aptDate.getDay(); // 0 = Sunday, 6 = Saturday
        
        // Parse time (format: "HH:MM" in 24-hour format)
        if (!apt.time || typeof apt.time !== 'string') {
          console.warn('Invalid appointment time:', apt.time, apt.id);
          return;
        }
        
        const timeParts = apt.time.split(':');
        if (timeParts.length !== 2) {
          console.warn('Invalid time format:', apt.time, apt.id);
          return;
        }
        
        const hours = parseInt(timeParts[0], 10);
        const minutes = parseInt(timeParts[1], 10);
        
        // Validate parsed time
        if (isNaN(hours) || isNaN(minutes)) {
          console.warn('Invalid time values:', apt.time, apt.id);
          return;
        }
        
        // Only count hours from 9 AM (9) to 6 PM (18)
        if (hours >= 9 && hours <= 18) {
          const key = `${dayOfWeek}-${hours}`;
          heatmap[key] = (heatmap[key] || 0) + 1;
        }
      } catch (error) {
        console.error('Error processing appointment for heatmap:', apt.id, error);
      }
    });
    
    // Generate heatmap data structure
    const hours = Array.from({ length: 10 }, (_, i) => i + 9); // 9 AM to 6 PM (9-18)
    const days = Array.from({ length: 7 }, (_, i) => i); // Sunday (0) to Saturday (6)
    
    return {
      heatmap,
      hours,
      days,
      daysOfWeek,
    };
  }, [appointments]); // Removed selectedPeriod dependency - heatmap shows all appointments

  // Get color for heatmap cell based on appointment count ranges
  const getHeatmapColor = (count: number): string => {
    // White/transparent: 0 appointments - No activity
    if (count === 0) return 'bg-white';
    
    // Very Light Purple: 1-2 appointments - Low activity / off-peak
    if (count >= 1 && count <= 2) return 'bg-purple-100';
    
    // Light Purple: 3-4 appointments - Moderate activity
    if (count >= 3 && count <= 4) return 'bg-purple-200';
    
    // Soft Purple: 5-6 appointments - Busy hours
    if (count >= 5 && count <= 6) return 'bg-purple-300';
    
    // Medium Purple: 7-8 appointments - High activity / peak hours starting
    if (count >= 7 && count <= 8) return 'bg-purple-400';
    
    // Dark Purple: 9+ appointments - Heavy peak hours / fully booked
    return 'bg-purple-600';
  };

  // Colors for the donut chart - diverse colors
  const COLORS = [
    '#3b82f6', // Blue
    '#10b981', // Green
    '#f59e0b', // Amber/Orange
    '#ef4444', // Red
    '#8b5cf6', // Purple
    '#06b6d4', // Cyan
    '#f97316', // Orange
    '#ec4899', // Pink
    '#14b8a6', // Teal
    '#6366f1', // Indigo
    '#84cc16', // Lime
    '#f43f5e', // Rose
  ];

  // Custom tooltip for service distribution
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      // Recharts Pie chart passes data in payload[0].payload or payload[0]
      const data = payload[0].payload || payload[0];
      const percentage = typeof data.percentage === 'number' 
        ? data.percentage.toFixed(1) 
        : '0';
      const serviceName = data.name || 'Unknown Service';
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="text-sm font-semibold text-gray-900">{serviceName}</p>
          <p className="text-sm text-gray-600">{percentage}%</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="text-gray-600">Data analytics and insights for your clinic</p>
      </div>

      <div className="space-y-6">
        {/* Report Period Section */}
        <div className="bg-white rounded-lg p-6 shadow-sm border">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Report Period</h2>
          <div className="flex flex-wrap gap-2">
            {(['today', 'yesterday', 'thisWeek', 'thisMonth', 'lastMonth', 'thisQuarter', 'thisYear'] as ReportPeriod[]).map((period) => (
              <button
                key={period}
                onClick={() => setSelectedPeriod(period)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedPeriod === period
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {period === 'today' && 'Today'}
                {period === 'yesterday' && 'Yesterday'}
                {period === 'thisWeek' && 'This Week'}
                {period === 'thisMonth' && 'This Month'}
                {period === 'lastMonth' && 'Last Month'}
                {period === 'thisQuarter' && 'This Quarter'}
                {period === 'thisYear' && 'This Year'}
              </button>
            ))}
          </div>
        </div>

        {/* Revenue Trend and Service Distribution Side by Side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Revenue Trend */}
          <div className="bg-white rounded-lg p-6 shadow-sm border">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Revenue Trend</h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueData}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="date" 
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

          {/* Service Distribution */}
          <div className="bg-white rounded-lg p-6 shadow-sm border">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Service Distribution</h2>
            {serviceDistribution.length > 0 ? (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={serviceDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                      label={false}
                    >
                      {serviceDistribution.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={COLORS[index % COLORS.length]} 
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend 
                      verticalAlign="bottom" 
                      height={36}
                      formatter={(value, entry: any) => (
                        <span style={{ color: '#374151', fontSize: '14px' }}>
                          {value} ({entry.payload.percentage}%)
                        </span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-80 flex items-center justify-center text-gray-500">
                <p>No service data available for the selected period</p>
              </div>
            )}
          </div>
        </div>

        {/* Peak Hours Heatmap */}
        <div className="bg-white rounded-lg p-6 shadow-sm border overflow-visible">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Peak Hours</h2>
          
          <div className="overflow-x-auto overflow-y-visible">
            <div className="inline-block min-w-full overflow-visible">
              {/* Header row with hours */}
              <div className="flex mb-2 overflow-visible pb-1 mt-3">
                <div className="w-24 flex-shrink-0 overflow-visible"></div> {/* Empty cell for day labels */}
                {peakHoursData.hours.map((hour) => {
                  const hour12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
                  const period = hour >= 12 ? 'PM' : 'AM';
                  return (
                    <div
                      key={hour}
                      className="flex-1 min-w-[60px] text-center text-xs font-medium text-gray-600 px-1 overflow-visible"
                    >
                      {hour12}{period}
                    </div>
                  );
                })}
              </div>
              
              {/* Heatmap rows for each day */}
              {peakHoursData.days.map((dayIndex) => {
                const dayName = peakHoursData.daysOfWeek[dayIndex];
                return (
                  <div key={dayIndex} className="flex mb-1 min-h-[40px] overflow-visible relative pt-1">
                    {/* Day label */}
                    <div className="w-24 flex-shrink-0 text-sm font-medium text-gray-700 py-2 px-2 overflow-visible">
                      {dayName}
                    </div>
                    
                    {/* Hour cells container */}
                    <div className="flex flex-1 min-w-0 overflow-visible">
                      {peakHoursData.hours.map((hour) => {
                        const key = `${dayIndex}-${hour}`;
                        const count = peakHoursData.heatmap[key] || 0;
                        const colorClass = getHeatmapColor(count);
                        const hour12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
                        const period = hour >= 12 ? 'PM' : 'AM';
                        
                        return (
                          <div
                            key={hour}
                            className={`group relative flex-1 min-w-[60px] h-10 border border-gray-200 rounded transition-colors cursor-pointer overflow-visible ${colorClass}`}
                          >
                            {/* Tooltip */}
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-lg">
                              <div className="font-semibold">{dayName} {hour12}{period}</div>
                              <div className="text-gray-300">{count} appointment{count !== 1 ? 's' : ''}</div>
                              {/* Arrow */}
                              <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                                <div className="border-4 border-transparent border-t-gray-900"></div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          
          {/* Legend */}
          <div className="mt-6 flex items-center justify-center gap-4">
            <span className="text-xs text-gray-600">Less</span>
            <div className="flex gap-1">
              <div className="w-6 h-6 bg-gray-50 border border-gray-200 rounded"></div>
              <div className="w-6 h-6 bg-purple-200 rounded"></div>
              <div className="w-6 h-6 bg-purple-300 rounded"></div>
              <div className="w-6 h-6 bg-purple-400 rounded"></div>
              <div className="w-6 h-6 bg-purple-500 rounded"></div>
              <div className="w-6 h-6 bg-purple-600 rounded"></div>
            </div>
            <span className="text-xs text-gray-600">More</span>
          </div>
        </div>

        {/* Inventory Stock Level - Bullet Chart */}
        <div className="bg-white rounded-lg p-6 shadow-sm border">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Inventory Stock Level</h2>
          <p className="text-sm text-gray-600 mb-6">Current stock vs reorder point</p>
          
          {useMemo(() => {
            const inventoryData = items
              .filter(item => item.reorderPoint !== undefined && item.reorderPoint > 0)
              .map(item => {
                const rop = item.reorderPoint || 0;
                const current = item.stock;
                
                // Determine status based on stock level vs reorder point
                let status = 'Good';
                
                if (current <= rop) {
                  status = 'Reorder Now';
                } else if (current <= rop * 1.2) {
                  status = 'Monitor';
                }
                
                const maxValue = Math.max(current, rop * 1.5, 1);
                const chartMax = maxValue * 1.2;
                
                // For stacking: ROP at bottom, current stock on top
                // Base bar: ROP value
                // Top bar: current - ROP (if current > ROP), or 0 (if current <= ROP)
                const currentAboveROP = current > rop ? current - rop : 0;
                
                // Calculate ROP bar segments with threshold (10% of ROP or minimum 2 units)
                const ropThreshold = Math.max(rop * 0.1, 2);
                const ropRedZone = Math.max(0, rop - ropThreshold); // Red: below ROP
                const ropYellowZone = ropThreshold * 2; // Yellow: around ROP (ROP-threshold to ROP+threshold)
                const ropGreenZone = Math.max(0, chartMax - (rop + ropThreshold)); // Green: above ROP
                
                return {
                  name: item.name.length > 20 ? item.name.substring(0, 20) + '...' : item.name,
                  fullName: item.name,
                  current: current,
                  reorderPoint: rop,
                  currentAboveROP: currentAboveROP,
                  max: maxValue * 1.2,
                  ropRedZone: ropRedZone,
                  ropYellowZone: ropYellowZone,
                  ropGreenZone: ropGreenZone,
                  status: status,
                };
              })
              .sort((a, b) => b.current - a.current)
              .slice(0, 10); // Show top 10 items

            if (inventoryData.length === 0) {
              return (
                <div className="h-80 flex items-center justify-center text-gray-500">
                  <p>No inventory items with reorder points set</p>
                </div>
              );
            }

            return (
              <div className="h-96 overflow-y-auto">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={inventoryData}
                    layout="vertical"
                    margin={{ top: 20, right: 30, left: 100, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis 
                      dataKey="name" 
                      type="category" 
                      width={90}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                              <p className="font-semibold text-gray-900 mb-2">{data.fullName}</p>
                              <p className="text-sm text-gray-700">
                                <span className="font-medium">Current Stock:</span> {data.current}
                              </p>
                              <p className="text-sm text-gray-700">
                                <span className="font-medium">Reorder Point:</span> {data.reorderPoint}
                              </p>
                              <p className="text-sm mt-1">
                                <span className={`font-medium px-2 py-1 rounded ${data.status === 'Reorder Now' ? 'bg-red-100 text-red-800' : data.status === 'Monitor' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
                                  {data.status}
                                </span>
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    {/* Background range bar */}
                    <Bar 
                      dataKey="max" 
                      fill="#f3f4f6" 
                      name="Max Range"
                      radius={[0, 4, 4, 0]}
                      opacity={0.2}
                      stackId="background"
                    />
                    {/* Reorder point bar segments - Red zone (below ROP) */}
                    <Bar 
                      dataKey="ropRedZone" 
                      name="Below ROP"
                      fill="#ef4444"
                      radius={[0, 0, 0, 0]}
                      opacity={0.7}
                      stackId="rop"
                      barSize={40}
                    />
                    {/* Yellow zone (at/near ROP) */}
                    <Bar 
                      dataKey="ropYellowZone" 
                      name="At ROP"
                      fill="#f59e0b"
                      radius={[0, 0, 0, 0]}
                      opacity={0.7}
                      stackId="rop"
                      barSize={40}
                    />
                    {/* Green zone (above ROP) */}
                    <Bar 
                      dataKey="ropGreenZone" 
                      name="Above ROP"
                      fill="#10b981"
                      radius={[0, 0, 0, 0]}
                      opacity={0.7}
                      stackId="rop"
                      barSize={40}
                    />
                    {/* Current stock on top of ROP - only shows the portion above ROP (thinner, gray) */}
                    <Bar 
                      dataKey="currentAboveROP" 
                      name="Current Stock"
                      fill="#e5e7eb"
                      radius={[0, 4, 4, 0]}
                      stackId="stock"
                      barSize={25}
                    />
                    {/* For items where current <= ROP, show current as a separate bar below ROP (thinner, gray) */}
                    {inventoryData.map((entry, index) => {
                      if (entry.current <= entry.reorderPoint && entry.current > 0) {
                        return (
                          <Bar
                            key={`current-low-${index}`}
                            dataKey={() => entry.current}
                            fill="#e5e7eb"
                            name=""
                            radius={[0, 4, 4, 0]}
                            stackId={`low-${index}`}
                            data={[entry]}
                            barSize={25}
                          />
                        );
                      }
                      return null;
                    })}
                    <Legend 
                      wrapperStyle={{ paddingTop: '20px' }}
                      formatter={(value) => {
                        const labels: { [key: string]: string } = {
                          'Max Range': 'Max Range',
                          'Reorder Point': 'Reorder Point',
                          'Current Stock': 'Current Stock',
                        };
                        return labels[value] || value;
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
                
                {/* Legend for color coding */}
                <div className="mt-4 flex items-center justify-center gap-6 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-red-500"></div>
                    <span className="text-gray-700">Reorder Now (≤ ROP)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-yellow-500"></div>
                    <span className="text-gray-700">Monitor (slightly above ROP)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-green-500"></div>
                    <span className="text-gray-700">Good (comfortably above ROP)</span>
                  </div>
                </div>
              </div>
            );
          }, [items])}
        </div>
      </div>
    </div>
  );
}

