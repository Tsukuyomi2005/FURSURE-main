import { useState, useMemo } from 'react';
import { Search, Filter, Package, Plus, Minus, Settings, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { useInventoryStore } from '../stores/inventoryStore';
import { useAppointmentStore } from '../stores/appointmentStore';
import { createAppointmentIdMap, generateAppointmentId as generateSequentialAppointmentId } from '../utils/appointmentId';
import { RejectDeductionDialog } from '../components/RejectDeductionDialog';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { toast } from 'sonner';
import type { InventoryItem, Appointment } from '../types';

type TabType = 'current' | 'pending';

interface PendingDeduction {
  appointment: Appointment;
  itemsUsed: Array<{
    itemId: string;
    quantity: number;
    itemName: string;
    itemCategory: string;
    deductionStatus?: 'pending' | 'confirmed' | 'rejected';
    loggedAt?: string;
    rejectedReason?: string;
  }>;
}

export function StaffInventory() {
  const { items, updateItem } = useInventoryStore();
  const { appointments, updateAppointment } = useAppointmentStore();
  const [activeTab, setActiveTab] = useState<TabType>('current');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [adjustingStock, setAdjustingStock] = useState<{ item: InventoryItem; adjustment: number } | null>(null);
  const [editingReorderPoint, setEditingReorderPoint] = useState<InventoryItem | null>(null);
  
  // Pending deductions state
  const [selectedDeduction, setSelectedDeduction] = useState<PendingDeduction | null>(null);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Create appointment ID map for sequential numbering
  const appointmentIdMap = useMemo(() => createAppointmentIdMap(appointments), [appointments]);

  // Get pending deductions (appointments with itemsUsed that have deductionStatus: 'pending')
  const pendingDeductions = useMemo(() => {
    const deductions: PendingDeduction[] = [];
    
    appointments.forEach(appointment => {
      if (appointment.itemsUsed && appointment.itemsUsed.length > 0) {
        const hasPendingItems = appointment.itemsUsed.some(
          item => item.deductionStatus === 'pending' || !item.deductionStatus
        );
        
        if (hasPendingItems) {
          const pendingItems = appointment.itemsUsed.filter(
            item => item.deductionStatus === 'pending' || !item.deductionStatus
          );
          
          if (pendingItems.length > 0) {
            deductions.push({
              appointment,
              itemsUsed: pendingItems,
            });
          }
        }
      }
    });
    
    // Sort by loggedAt (most recent first)
    return deductions.sort((a, b) => {
      const timeA = a.itemsUsed[0]?.loggedAt ? new Date(a.itemsUsed[0].loggedAt).getTime() : 0;
      const timeB = b.itemsUsed[0]?.loggedAt ? new Date(b.itemsUsed[0].loggedAt).getTime() : 0;
      return timeB - timeA;
    });
  }, [appointments]);

  const categories = [...new Set(items.map(item => item.category))];

  const filteredItems = items
    .filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = !categoryFilter || item.category === categoryFilter;
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const isExpired = (expiryDate: string) => {
    return new Date(expiryDate) < new Date();
  };

  const isLowStock = (stock: number) => {
    return stock < 10;
  };

  const handleStockAdjustment = async (item: InventoryItem, adjustment: number) => {
    if (!adjustingStock || adjustment === 0) return;
    
    const newStock = item.stock + adjustment;
    if (newStock < 0) {
      toast.error('Stock cannot be negative');
      return;
    }

    try {
      await updateItem(item.id, { stock: newStock });
      toast.success(`Stock ${adjustment > 0 ? 'added' : 'deducted'} successfully`);
      setAdjustingStock(null);
    } catch (error) {
      console.error('Failed to update stock:', error);
      toast.error('Failed to update stock. Please try again.');
    }
  };

  const openAdjustModal = (item: InventoryItem, adjustment: number) => {
    setAdjustingStock({ item, adjustment });
  };

  const handleReorderPointUpdate = async (item: InventoryItem, reorderPoint: number) => {
    if (reorderPoint < 0) {
      toast.error('Reorder point must be a positive number');
      return;
    }

    try {
      await updateItem(item.id, { reorderPoint });
      toast.success('Reorder point updated successfully');
      setEditingReorderPoint(null);
    } catch (error) {
      console.error('Failed to update reorder point:', error);
      toast.error('Failed to update reorder point. Please try again.');
    }
  };

  // Get clinic staff name from localStorage
  const getStaffName = () => {
    try {
      const currentUserStr = localStorage.getItem('fursure_current_user');
      if (currentUserStr) {
        const currentUser = JSON.parse(currentUserStr);
        const storedUsers = JSON.parse(localStorage.getItem('fursure_users') || '{}');
        const userData = storedUsers[currentUser.username || currentUser.email];
        
        if (userData) {
          const fullName = `${userData.firstName || ''} ${userData.lastName || ''}`.trim();
          return fullName || 'Clinic Staff';
        }
      }
    } catch (error) {
      console.error('Error loading staff name:', error);
    }
    return 'Clinic Staff';
  };

  // Handle confirm deduction
  const handleConfirmDeduction = async () => {
    if (!selectedDeduction) return;

    try {
      // First, validate that all items have sufficient stock
      const stockCheckErrors: string[] = [];
      for (const item of selectedDeduction.itemsUsed) {
        const inventoryItem = items.find(i => i.id === item.itemId);
        if (!inventoryItem) {
          stockCheckErrors.push(`Item "${item.itemName}" not found in inventory`);
          continue;
        }
        if (inventoryItem.stock < item.quantity) {
          stockCheckErrors.push(
            `Cannot deduct ${item.quantity} from "${item.itemName}". Only ${inventoryItem.stock} available.`
          );
        }
      }

      if (stockCheckErrors.length > 0) {
        toast.error(stockCheckErrors.join('\n'));
        return;
      }

      // Get staff name and current timestamp
      const staffName = getStaffName();
      const approvalTimestamp = new Date().toISOString();

      // Update itemsUsed to mark as confirmed with approval info
      const updatedItemsUsed = selectedDeduction.appointment.itemsUsed?.map(item => {
        if (selectedDeduction.itemsUsed.some(pi => pi.itemId === item.itemId)) {
          return {
            ...item,
            deductionStatus: 'confirmed' as const,
            approvedAt: approvalTimestamp,
            approvedByName: staffName,
          };
        }
        return item;
      }) || [];

      await updateAppointment(selectedDeduction.appointment.id, {
        itemsUsed: updatedItemsUsed,
      });

      // Deduct items from inventory
      for (const item of selectedDeduction.itemsUsed) {
        const inventoryItem = items.find(i => i.id === item.itemId);
        if (inventoryItem) {
          const newStock = inventoryItem.stock - item.quantity;
          await updateItem(item.itemId, { stock: newStock });
        }
      }

      toast.success('Deduction confirmed and inventory updated successfully');
      setShowConfirmDialog(false);
      setSelectedDeduction(null);
    } catch (error) {
      console.error('Failed to confirm deduction:', error);
      toast.error('Failed to confirm deduction. Please try again.');
    }
  };

  // Handle reject deduction
  const handleRejectDeduction = async (reason: string) => {
    if (!selectedDeduction) return;

    try {
      // Get staff name and current timestamp
      const staffName = getStaffName();
      const rejectionTimestamp = new Date().toISOString();

      // Update itemsUsed to mark as rejected with reason and timestamp
      const updatedItemsUsed = selectedDeduction.appointment.itemsUsed?.map(item => {
        if (selectedDeduction.itemsUsed.some(pi => pi.itemId === item.itemId)) {
          return {
            ...item,
            deductionStatus: 'rejected' as const,
            rejectedReason: reason,
            // Store rejection timestamp in approvedAt field for consistency (or we could add rejectedAt to schema)
            approvedAt: rejectionTimestamp,
            approvedByName: staffName,
          };
        }
        return item;
      }) || [];

      await updateAppointment(selectedDeduction.appointment.id, {
        itemsUsed: updatedItemsUsed,
      });

      toast.success('Deduction rejected successfully');
      setShowRejectDialog(false);
      setSelectedDeduction(null);
    } catch (error) {
      console.error('Failed to reject deduction:', error);
      toast.error('Failed to reject deduction. Please try again.');
    }
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (time24: string): string => {
    const [hours, minutes] = time24.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12;
    return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  const formatDateTime = (dateTimeStr: string): string => {
    const date = new Date(dateTimeStr);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory Management</h1>
          <p className="text-gray-600">View and manage inventory stock levels</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('current')}
            className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === 'current'
                ? 'border-purple-500 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Package className="h-5 w-5" />
            Current Stock
          </button>
          <button
            onClick={() => setActiveTab('pending')}
            className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 relative ${
              activeTab === 'pending'
                ? 'border-purple-500 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <AlertCircle className="h-5 w-5" />
            Pending Deductions
            {pendingDeductions.length > 0 && (
              <span className="ml-2 bg-orange-500 text-white text-xs font-semibold px-2 py-0.5 rounded-full">
                {pendingDeductions.length}
              </span>
            )}
          </button>
        </nav>
      </div>

      {/* Current Stock Tab */}
      {activeTab === 'current' && (
        <>
          {/* Filters */}
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input
                  type="text"
                  placeholder="Search items..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
                >
                  <option value="">All Categories</option>
                  {categories.map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Desktop Table */}
          <div className="hidden lg:block overflow-hidden bg-white rounded-lg shadow-sm border">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expiry</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredItems.map((item) => (
                  <tr key={item.id} className={isExpired(item.expiryDate) ? 'bg-gray-50 opacity-60' : ''}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Package className="h-8 w-8 text-gray-400 mr-3" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">{item.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.category}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-sm font-medium ${isLowStock(item.stock) ? 'text-red-600' : 'text-gray-900'}`}>
                        {item.stock}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">₱{item.price.toFixed(2)}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-sm ${isExpired(item.expiryDate) ? 'text-red-600 font-medium' : 'text-gray-900'}`}>
                        {new Date(item.expiryDate).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openAdjustModal(item, 1)}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="Add Stock"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => openAdjustModal(item, -1)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Deduct Stock"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setEditingReorderPoint(item)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Set Reorder Point"
                        >
                          <Settings className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="lg:hidden space-y-4">
            {filteredItems.map((item) => (
              <div key={item.id} className={`bg-white rounded-lg p-4 shadow-sm border ${isExpired(item.expiryDate) ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center">
                    <Package className="h-8 w-8 text-gray-400 mr-3" />
                    <div>
                      <h3 className="font-medium text-gray-900">{item.name}</h3>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                  <div>
                    <span className="text-gray-500">Category:</span>
                    <p className="font-medium">{item.category}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Stock:</span>
                    <p className={`font-medium ${isLowStock(item.stock) ? 'text-red-600' : 'text-gray-900'}`}>
                      {item.stock}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">Price:</span>
                    <p className="font-medium">₱{item.price.toFixed(2)}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Expiry:</span>
                    <p className={`font-medium ${isExpired(item.expiryDate) ? 'text-red-600' : 'text-gray-900'}`}>
                      {new Date(item.expiryDate).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-3 border-t">
                  <button
                    onClick={() => openAdjustModal(item, 1)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    Add Stock
                  </button>
                  <button
                    onClick={() => openAdjustModal(item, -1)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                  >
                    <Minus className="h-4 w-4" />
                    Deduct Stock
                  </button>
                  <button
                    onClick={() => setEditingReorderPoint(item)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                  >
                    <Settings className="h-4 w-4" />
                    Set Levels
                  </button>
                </div>
              </div>
            ))}
          </div>

          {filteredItems.length === 0 && (
            <div className="text-center py-12 bg-white rounded-lg shadow-sm border">
              <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No items found</h3>
              <p className="text-gray-600">Try adjusting your search or filter criteria</p>
            </div>
          )}
        </>
      )}

      {/* Pending Deductions Tab */}
      {activeTab === 'pending' && (
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-6 border-b">
            <h2 className="text-xl font-semibold text-gray-900">Pending Deductions</h2>
            <p className="text-sm text-gray-600 mt-1">Review and confirm or reject item deductions logged by veterinarians</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Appointment ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date & Time</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client & Pet</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Veterinarian</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Items Used</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Logged At</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {pendingDeductions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                      <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-lg font-medium text-gray-900 mb-2">No pending deductions</p>
                      <p className="text-sm text-gray-600">All deductions have been processed</p>
                    </td>
                  </tr>
                ) : (
                  pendingDeductions.map((deduction) => {
                    const appointmentId = generateSequentialAppointmentId(deduction.appointment.id, appointmentIdMap);
                    return (
                      <tr key={deduction.appointment.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {appointmentId}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{formatDate(deduction.appointment.date)}</div>
                          <div className="text-sm text-gray-500">{formatTime(deduction.appointment.time)}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{deduction.appointment.ownerName}</div>
                          <div className="text-sm text-gray-500">Pet: {deduction.appointment.petName}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {deduction.appointment.vet}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900 space-y-1">
                            {deduction.itemsUsed.map((item, idx) => (
                              <div key={idx} className="flex items-center gap-2">
                                <Package className="h-4 w-4 text-gray-400" />
                                <span>{item.itemName} ({item.quantity})</span>
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {deduction.itemsUsed[0]?.loggedAt 
                            ? formatDateTime(deduction.itemsUsed[0].loggedAt)
                            : 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setSelectedDeduction(deduction);
                                setShowConfirmDialog(true);
                              }}
                              className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                              title="Confirm Deduction"
                            >
                              <CheckCircle2 className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => {
                                setSelectedDeduction(deduction);
                                setShowRejectDialog(true);
                              }}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Reject Deduction"
                            >
                              <XCircle className="h-5 w-5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Stock Adjustment Modal */}
      {adjustingStock && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setAdjustingStock(null)} />
            <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full">
              <div className="p-6 border-b">
                <h3 className="text-lg font-semibold text-gray-900">
                  {adjustingStock.adjustment > 0 ? 'Add Stock' : 'Deduct Stock'}
                </h3>
                <p className="text-sm text-gray-600 mt-1">{adjustingStock.item.name}</p>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Current Stock: <span className="font-bold">{adjustingStock.item.stock}</span>
                  </label>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {adjustingStock.adjustment > 0 ? 'Quantity to Add' : 'Quantity to Deduct'}
                  </label>
                  <input
                    type="number"
                    min="1"
                    defaultValue={1}
                    id="adjustment-amount"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter quantity"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setAdjustingStock(null)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      const input = document.getElementById('adjustment-amount') as HTMLInputElement;
                      const amount = parseInt(input.value) || 1;
                      handleStockAdjustment(adjustingStock.item, adjustingStock.adjustment * amount);
                    }}
                    className={`flex-1 px-4 py-2 text-white rounded-lg transition-colors ${
                      adjustingStock.adjustment > 0
                        ? 'bg-green-600 hover:bg-green-700'
                        : 'bg-red-600 hover:bg-red-700'
                    }`}
                  >
                    {adjustingStock.adjustment > 0 ? 'Add Stock' : 'Deduct Stock'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reorder Point / Target Level Modal */}
      {editingReorderPoint && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setEditingReorderPoint(null)} />
            <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full">
              <div className="p-6 border-b">
                <h3 className="text-lg font-semibold text-gray-900">Set Reorder Point</h3>
                <p className="text-sm text-gray-600 mt-1">{editingReorderPoint.name}</p>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Current Stock: <span className="font-bold">{editingReorderPoint.stock}</span>
                  </label>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reorder Point
                  </label>
                  <input
                    type="number"
                    min="0"
                    defaultValue={editingReorderPoint.reorderPoint || 0}
                    id="reorder-point"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter reorder point"
                  />
                  <p className="text-xs text-gray-500 mt-1">Stock level at which to reorder</p>
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setEditingReorderPoint(null)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      const reorderPointInput = document.getElementById('reorder-point') as HTMLInputElement;
                      const reorderPoint = parseInt(reorderPointInput.value) || 0;
                      handleReorderPointUpdate(editingReorderPoint, reorderPoint);
                    }}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Deduction Dialog */}
      <ConfirmDialog
        isOpen={showConfirmDialog}
        onClose={() => {
          setShowConfirmDialog(false);
          setSelectedDeduction(null);
        }}
        onConfirm={handleConfirmDeduction}
        title="Confirm Deduction"
        message={
          selectedDeduction
            ? `Are you sure you want to confirm the deduction for appointment ${generateSequentialAppointmentId(selectedDeduction.appointment.id, appointmentIdMap)}? This will deduct the items from inventory.`
            : ''
        }
        confirmText="Confirm"
        cancelText="Cancel"
        confirmVariant="primary"
      />

      {/* Reject Deduction Dialog */}
      <RejectDeductionDialog
        isOpen={showRejectDialog}
        onClose={() => {
          setShowRejectDialog(false);
          setSelectedDeduction(null);
        }}
        onConfirm={handleRejectDeduction}
        appointmentId={selectedDeduction ? generateSequentialAppointmentId(selectedDeduction.appointment.id, appointmentIdMap) : ''}
      />
    </div>
  );
}
