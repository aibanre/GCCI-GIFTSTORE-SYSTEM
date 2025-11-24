// Dashboard Navigation Logic

const navLinkMap = {
  Dashboard: 'dashboardSection',
  'POS System': 'posSystemSection',
  Inventory: 'inventorySection',
  Reservations: 'reservationsSection',
  Reports: 'reportsSection',
};

function initDashboardNavigation() {
  document.querySelectorAll('.admin-nav a').forEach((link) => {
    link.addEventListener('click', function (e) {
      e.preventDefault();
      document
        .querySelectorAll('.admin-nav a')
        .forEach((l) => l.classList.remove('active'));
      this.classList.add('active');

      // Hide all sections
      document.querySelectorAll('[id$="Section"]').forEach((section) => {
        section.classList.add('hidden');
      });

      // Get the text content and map to section ID
      const linkText = this.textContent.trim();
      const sectionId = navLinkMap[linkText];

      if (sectionId) {
        const section = document.getElementById(sectionId);
        if (section) {
          section.classList.remove('hidden');
          
          // Trigger data refresh for Inventory section
          if (linkText === 'Inventory' && typeof fetchProducts === 'function') {
            console.log('Inventory tab clicked, fetching products');
            fetchProducts();
          }
        }
      }
    });
  });
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', initDashboardNavigation);
