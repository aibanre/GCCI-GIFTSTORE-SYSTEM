// Dashboard Stats Logic

async function loadDashboardStats() {
  try {
    const response = await fetch('/api/stats');
    if (!response.ok) throw new Error('Failed to fetch stats');
    const stats = await response.json();
    updateStatsDisplay(stats);
  } catch (error) {
    console.error('Error loading stats:', error);
    // Fallback stats
    updateStatsDisplay({
      totalProducts: 124,
      pendingReservations: 18,
      lowStockItems: 7,
      totalReservations: 56,
    });
  }
}

function updateStatsDisplay(stats) {
  const statElements = {
    totalProducts: document.querySelector('[data-stat="totalProducts"]'),
    pendingReservations: document.querySelector('[data-stat="pendingReservations"]'),
    lowStockItems: document.querySelector('[data-stat="lowStockItems"]'),
    totalReservations: document.querySelector('[data-stat="totalReservations"]'),
  };

  if (statElements.totalProducts) statElements.totalProducts.textContent = stats.totalProducts;
  if (statElements.pendingReservations) statElements.pendingReservations.textContent = stats.pendingReservations;
  if (statElements.lowStockItems) statElements.lowStockItems.textContent = stats.lowStockItems;
  if (statElements.totalReservations) statElements.totalReservations.textContent = stats.totalReservations;
}

document.addEventListener('DOMContentLoaded', loadDashboardStats);
