// Tab Switching Logic

function initTabs() {
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', function () {
      const container = this.closest('.tab-container');
      if (!container) return;

      const tabButtonsContainer = container.querySelector('.tab-buttons');
      const allButtons = tabButtonsContainer ? tabButtonsContainer.querySelectorAll('.tab-btn') : container.querySelectorAll('.tab-btn');
      const allContents = container.querySelectorAll('.tab-content');

      // Remove active class from all buttons and hide all contents
      allButtons.forEach((b) => b.classList.remove('active'));
      allContents.forEach((t) => t.classList.remove('active'));

      // Add active class to clicked button
      this.classList.add('active');

      // Show corresponding tab content based on button index
      const tabIndex = Array.from(allButtons).indexOf(this);
      if (allContents[tabIndex]) {
        allContents[tabIndex].classList.add('active');
      }
    });
  });

  // Set first tab as active by default
  document.querySelectorAll('.tab-container').forEach((container) => {
    const firstBtn = container.querySelector('.tab-btn');
    const firstContent = container.querySelector('.tab-content');
    if (firstBtn && !firstBtn.classList.contains('active')) {
      firstBtn.classList.add('active');
    }
    if (firstContent && !firstContent.classList.contains('active')) {
      firstContent.classList.add('active');
    }
  });
}

document.addEventListener('DOMContentLoaded', initTabs);
