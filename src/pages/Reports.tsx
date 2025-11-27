import { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, AreaChart, Area } from 'recharts';
import { useAppointmentStore } from '../stores/appointmentStore';
import { useServiceStore } from '../stores/serviceStore';
import type { Appointment } from '../types';

type ReportPeriod = 'today' | 'yesterday' | 'thisWeek' | 'thisMonth' | 'lastMonth' | 'thisQuarter' | 'thisYear';

export function Reports() {
  const { appointments } = useAppointmentStore();
  const { services } = useServiceStore();
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

  // Get all appointments with confirmed payments (for revenue calculation)
  // We don't filter by period here - we'll filter by payment confirmation dates in revenueData
  const appointmentsWithPayments = useMemo(() => {
    return appointments.filter((apt: Appointment) => {
      if (!apt.price || apt.price <= 0) return false;
      if (apt.status !== 'approved') return false;
      
      const paymentData = apt.paymentData || {};
      // Include appointments with confirmed payments or with payment status indicating payment
      return paymentData.depositConfirmedAt || 
             paymentData.fullPaymentConfirmedAt || 
             paymentData.remainingBalanceConfirmedAt ||
             apt.paymentStatus === 'fully_paid' || 
             apt.paymentStatus === 'down_payment_paid';
    });
  }, [appointments]);

  // Calculate revenue data based on payment confirmation dates (consistent with Payment Transactions)
  const revenueData = useMemo(() => {
    const { start, end } = getDateRange(selectedPeriod);
    const days: Date[] = [];
    const current = new Date(start);
    
    // Generate array of days in the period
    while (current <= end) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    // For longer periods, sample data points to avoid too many points
    let sampledDays = days;
    if (days.length > 60) {
      // Sample every nth day for very long periods
      const step = Math.ceil(days.length / 60);
      sampledDays = days.filter((_, index) => index % step === 0 || index === days.length - 1);
    }

    return sampledDays.map(day => {
      const dateStr = day.toISOString().split('T')[0];
      
      // Calculate revenue from payments confirmed on this specific day
      // This matches the Payment Transactions page logic exactly - sum all transactions shown there
      const revenue = appointmentsWithPayments.reduce((sum, apt) => {
        const paymentData = apt.paymentData || {};
        const depositAmount = Math.round((apt.price || 0) * 0.3);
        const remainingAmount = (apt.price || 0) - depositAmount;
        
        let dayRevenue = 0;
        
        // 1. Check deposit confirmation date (matches Payment Transactions: always shows if depositConfirmedAt exists)
        if (paymentData.depositConfirmedAt) {
          const depositDate = new Date(paymentData.depositConfirmedAt).toISOString().split('T')[0];
          if (depositDate === dateStr) {
            dayRevenue += depositAmount;
          }
        }
        
        // 2. Check full payment confirmation date
        // Match Payment Transactions logic: shows full payment if (!depositConfirmedAt || method === 'at_clinic')
        if (paymentData.fullPaymentConfirmedAt) {
          const fullPaymentDate = new Date(paymentData.fullPaymentConfirmedAt).toISOString().split('T')[0];
          if (fullPaymentDate === dateStr) {
            // Only count if Payment Transactions would show this transaction
            if (!paymentData.depositConfirmedAt || paymentData.method === 'at_clinic') {
              dayRevenue += apt.price || 0;
            }
          }
        }
        
        // 3. Check remaining balance confirmation date (matches Payment Transactions: always shows if remainingBalanceConfirmedAt exists)
        if (paymentData.remainingBalanceConfirmedAt) {
          const remainingDate = new Date(paymentData.remainingBalanceConfirmedAt).toISOString().split('T')[0];
          if (remainingDate === dateStr) {
            dayRevenue += remainingAmount;
          }
        }
        
        // 4. Include online payments that are completed but not yet confirmed by staff
        // Use appointment date as fallback for these (matches Payment Transactions online payment logic)
        if (!paymentData.depositConfirmedAt && 
            !paymentData.fullPaymentConfirmedAt && 
            !paymentData.remainingBalanceConfirmedAt) {
          const method = paymentData.method;
          if ((apt.paymentStatus === 'fully_paid' || apt.paymentStatus === 'down_payment_paid') &&
              (method === 'online' || method === 'gcash' || method === 'paymaya')) {
            // Normalize appointment date for comparison
            const aptDateNormalized = new Date(apt.date).toISOString().split('T')[0];
            if (aptDateNormalized === dateStr) {
              if (apt.paymentStatus === 'fully_paid') {
                dayRevenue += apt.price || 0;
              } else if (apt.paymentStatus === 'down_payment_paid') {
                dayRevenue += depositAmount;
              }
            }
          }
        }
        
        return sum + dayRevenue;
      }, 0);

      return {
        date: day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        revenue: revenue || 0,
      };
    });
  }, [appointmentsWithPayments, selectedPeriod]);

  // Calculate service distribution based on confirmed payments (consistent with revenue data)
  const serviceDistribution = useMemo(() => {
    const { start, end } = getDateRange(selectedPeriod);
    // Group appointments by serviceType, counting only those with payments confirmed in the period
    const serviceCounts: { [key: string]: number } = {};
    
    appointmentsWithPayments.forEach((apt: Appointment) => {
      if (!apt.serviceType || apt.status !== 'approved') return;
      
      const paymentData = apt.paymentData || {};
      
      // Check if any payment was confirmed in the selected period
      let hasPaymentInPeriod = false;
      
      if (paymentData.depositConfirmedAt) {
        const depositDate = new Date(paymentData.depositConfirmedAt);
        if (depositDate >= start && depositDate <= end) {
          hasPaymentInPeriod = true;
        }
      }
      
      if (paymentData.fullPaymentConfirmedAt) {
        const fullPaymentDate = new Date(paymentData.fullPaymentConfirmedAt);
        if (fullPaymentDate >= start && fullPaymentDate <= end) {
          hasPaymentInPeriod = true;
        }
      }
      
      if (paymentData.remainingBalanceConfirmedAt) {
        const remainingDate = new Date(paymentData.remainingBalanceConfirmedAt);
        if (remainingDate >= start && remainingDate <= end) {
          hasPaymentInPeriod = true;
        }
      }
      
      // Include online payments using appointment date as fallback
      if (!hasPaymentInPeriod && !paymentData.depositConfirmedAt && 
          !paymentData.fullPaymentConfirmedAt && 
          !paymentData.remainingBalanceConfirmedAt) {
        const method = paymentData.method;
        if ((apt.paymentStatus === 'fully_paid' || apt.paymentStatus === 'down_payment_paid') &&
            (method === 'online' || method === 'gcash' || method === 'paymaya')) {
          const aptDate = new Date(apt.date);
          if (aptDate >= start && aptDate <= end) {
            hasPaymentInPeriod = true;
          }
        }
      }
      
      if (hasPaymentInPeriod) {
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
  }, [appointmentsWithPayments, services, selectedPeriod]);

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
                    tickFormatter={(value) => `P${value}`}
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
      </div>
    </div>
  );
}

