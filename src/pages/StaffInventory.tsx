import { useState } from 'react';
import { Search, Filter, Package, Plus, Minus, Settings } from 'lucide-react';
import { useInventoryStore } from '../stores/inventoryStore';
import { toast } from 'sonner';
import type { InventoryItem } from '../types';

export function StaffInventory() {
  const { items, updateItem } = useInventoryStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [adjustingStock, setAdjustingStock] = useState<{ item: InventoryItem; adjustment: number } | null>(null);
  const [editingReorderPoint, setEditingReorderPoint] = useState<InventoryItem | null>(null);

  const categories = [...new Set(items.map(item => item.category))];

  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !categoryFilter || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory Management</h1>
          <p className="text-gray-600">View and manage inventory stock levels</p>
        </div>
      </div>

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
    </div>
  );
}

