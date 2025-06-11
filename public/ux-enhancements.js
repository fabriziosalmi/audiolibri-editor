// UX Enhancements Module
// This file contains additional UX improvements for the audiolibri editor

document.addEventListener('DOMContentLoaded', function() {
  
  // Enhanced search with suggestions
  let searchSuggestionsUX = null;
  const searchInputUX = document.getElementById('searchInput');
  
  function createSearchSuggestionsUX() {
    if (!searchSuggestionsUX) {
      searchSuggestionsUX = document.createElement('div');
      searchSuggestionsUX.className = 'search-suggestions';
      searchInputUX.parentNode.style.position = 'relative';
      searchInputUX.parentNode.appendChild(searchSuggestionsUX);
    }
    return searchSuggestionsUX;
  }

  function showSearchSuggestionsUX(query) {
    if (!query || query.length < 2 || typeof window.allData === 'undefined') {
      hideSearchSuggestionsUX();
      return;
    }

    const suggestions = createSearchSuggestionsUX();
    const items = Object.values(window.allData);
    const matches = items.filter(item => 
      item.real_title?.toLowerCase().includes(query.toLowerCase()) ||
      item.real_author?.toLowerCase().includes(query.toLowerCase()) ||
      item.real_genre?.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 5);

    if (matches.length === 0) {
      hideSearchSuggestionsUX();
      return;
    }

    suggestions.innerHTML = matches.map(item => `
      <div class="search-suggestion" data-id="${item.id}">
        <i class="fas fa-book"></i>
        <div>
          <div class="fw-bold">${item.real_title || item.title || 'Senza titolo'}</div>
          <div class="small text-muted">${item.real_author || item.author || 'Autore sconosciuto'}</div>
        </div>
      </div>
    `).join('');

    suggestions.style.display = 'block';

    // Add click handlers to suggestions
    suggestions.querySelectorAll('.search-suggestion').forEach(suggestion => {
      suggestion.addEventListener('click', function() {
        const itemId = this.dataset.id;
        if (typeof window.selectItem === 'function') {
          window.selectItem(itemId);
        }
        searchInputUX.value = items.find(item => item.id === itemId)?.real_title || '';
        hideSearchSuggestionsUX();
      });
    });
  }

  function hideSearchSuggestionsUX() {
    if (searchSuggestionsUX) {
      searchSuggestionsUX.style.display = 'none';
    }
  }

  // Enhanced search input with debouncing
  let searchTimeoutUX;
  if (searchInputUX) {
    searchInputUX.addEventListener('input', function() {
      clearTimeout(searchTimeoutUX);
      searchTimeoutUX = setTimeout(() => {
        const query = this.value.trim();
        showSearchSuggestionsUX(query);
      }, 300);
    });
  }

  // Hide suggestions when clicking outside
  document.addEventListener('click', function(e) {
    if (!searchInputUX?.contains(e.target) && !searchSuggestionsUX?.contains(e.target)) {
      hideSearchSuggestionsUX();
    }
  });

  // Enhanced loading states for buttons
  function showLoadingStateUX(element, text = 'Caricamento...') {
    if (!element) return;
    
    const originalContent = element.innerHTML;
    element.innerHTML = `
      <span class="loading-spinner"></span>
      ${text}
    `;
    element.disabled = true;
    element.dataset.originalContent = originalContent;
  }

  function hideLoadingStateUX(element) {
    if (!element) return;
    
    if (element.dataset.originalContent) {
      element.innerHTML = element.dataset.originalContent;
      element.disabled = false;
      delete element.dataset.originalContent;
    }
  }

  // Enhanced form interactions
  const formInputs = document.querySelectorAll('#editForm input, #editForm select, #editForm textarea');
  formInputs.forEach(input => {
    // Add focus/blur animations
    input.addEventListener('focus', function() {
      this.closest('.mb-3')?.classList.add('form-group-focused');
    });
    
    input.addEventListener('blur', function() {
      this.closest('.mb-3')?.classList.remove('form-group-focused');
    });
    
    // Add real-time validation feedback
    input.addEventListener('input', function() {
      validateFieldRealTime(this);
    });
  });

  function validateFieldRealTime(field) {
    const value = field.value.trim();
    
    // Remove existing validation classes
    field.classList.remove('is-valid', 'is-invalid');
    
    // Basic validation
    let isValid = true;
    switch(field.id) {
      case 'realTitle':
      case 'realAuthor':
        isValid = value.length >= 2;
        break;
      case 'realSynopsis':
        isValid = value.length <= 500;
        // Don't update character counter here - it's handled by script.js
        break;
      case 'realPublishedYear':
        const year = parseInt(value);
        isValid = !value || (year >= 1800 && year <= new Date().getFullYear() + 1);
        break;
    }
    
    if (value.length > 0) {
      field.classList.add(isValid ? 'is-valid' : 'is-invalid');
    }
  }

  function updateCharacterCounter(field, current, max) {
    const counter = document.getElementById('synopsisCount');
    if (counter) {
      counter.textContent = current;
      const parent = counter.closest('.form-text');
      if (parent) {
        parent.classList.remove('text-warning', 'text-danger');
        if (current > max * 0.8) {
          parent.classList.add(current > max ? 'text-danger' : 'text-warning');
        }
      }
    }
  }

  // Enhanced keyboard shortcuts
  document.addEventListener('keydown', function(e) {
    // Don't trigger shortcuts when typing in inputs
    if (e.target.matches('input, textarea, select')) {
      return;
    }
    
    if (e.ctrlKey || e.metaKey) {
      switch(e.key) {
        case 'k':
          e.preventDefault();
          if (searchInputUX) {
            searchInputUX.focus();
            searchInputUX.select();
          }
          break;
        case 'h':
          e.preventDefault();
          const helpBtn = document.getElementById('helpBtn');
          if (helpBtn) helpBtn.click();
          break;
      }
    }
    
    // Quick navigation with arrow keys
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!e.target.matches('input, textarea, select')) {
        e.preventDefault();
        navigateItemsUX(e.key === 'ArrowDown' ? 'next' : 'prev');
      }
    }
    
    // Escape to close panels
    if (e.key === 'Escape') {
      hideSearchSuggestionsUX();
      // Close any open quick actions
      const quickActionsPanel = document.getElementById('quickActionsPanel');
      if (quickActionsPanel && quickActionsPanel.classList.contains('show')) {
        const quickActionsFab = document.getElementById('quickActionsFab');
        if (quickActionsFab) quickActionsFab.click();
      }
    }
  });

  function navigateItemsUX(direction) {
    const items = document.querySelectorAll('#itemsList .list-group-item');
    const currentActive = document.querySelector('#itemsList .list-group-item.active');
    let currentIndex = Array.from(items).indexOf(currentActive);
    
    if (direction === 'next') {
      currentIndex = (currentIndex + 1) % items.length;
    } else {
      currentIndex = currentIndex <= 0 ? items.length - 1 : currentIndex - 1;
    }
    
    if (items[currentIndex]) {
      items[currentIndex].click();
      items[currentIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  // Enhanced visual feedback for interactions
  function addRippleEffect(element, event) {
    const rect = element.getBoundingClientRect();
    const ripple = document.createElement('div');
    const size = Math.max(rect.width, rect.height);
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;
    
    ripple.style.cssText = `
      position: absolute;
      width: ${size}px;
      height: ${size}px;
      left: ${x}px;
      top: ${y}px;
      background: rgba(255, 255, 255, 0.3);
      border-radius: 50%;
      transform: scale(0);
      transition: transform 0.6s ease;
      pointer-events: none;
      z-index: 1;
    `;
    
    element.style.position = 'relative';
    element.style.overflow = 'hidden';
    element.appendChild(ripple);
    
    setTimeout(() => {
      ripple.style.transform = 'scale(1)';
    }, 10);
    
    setTimeout(() => {
      ripple.remove();
    }, 600);
  }

  // Add ripple effect to buttons
  document.querySelectorAll('.btn').forEach(btn => {
    btn.addEventListener('click', function(e) {
      if (!this.disabled) {
        addRippleEffect(this, e);
      }
    });
  });

  // Enhanced progress indicators
  function updateProgressWithAnimation(progressBar, percentage) {
    if (!progressBar) return;
    
    const currentWidth = parseFloat(progressBar.style.width) || 0;
    const targetWidth = Math.min(100, Math.max(0, percentage));
    
    const duration = 500;
    const startTime = Date.now();
    
    function animate() {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      const easeOutCubic = 1 - Math.pow(1 - progress, 3);
      const currentPercentage = currentWidth + (targetWidth - currentWidth) * easeOutCubic;
      
      progressBar.style.width = currentPercentage + '%';
      progressBar.setAttribute('aria-valuenow', currentPercentage);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    }
    
    requestAnimationFrame(animate);
  }

  // Enhanced status indicators
  function createStatusIndicator(type, text) {
    return `<span class="status-indicator ${type}"></span>${text}`;
  }

  // Auto-scroll to active item
  function scrollToActiveItem() {
    const activeItem = document.querySelector('#itemsList .list-group-item.active');
    if (activeItem) {
      activeItem.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'nearest',
        inline: 'nearest'
      });
    }
  }

  // Debounced resize handler for responsive adjustments
  let resizeTimeout;
  window.addEventListener('resize', function() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      // Adjust layout for mobile/desktop
      const isMobile = window.innerWidth < 768;
      document.body.classList.toggle('mobile-layout', isMobile);
      
      // Reposition search suggestions if visible
      if (searchSuggestionsUX && searchSuggestionsUX.style.display === 'block') {
        hideSearchSuggestionsUX();
      }
    }, 250);
  });

  // Initialize mobile detection
  const isMobile = window.innerWidth < 768;
  document.body.classList.toggle('mobile-layout', isMobile);

  // Expose utility functions globally
  window.UXEnhancements = {
    showLoadingState: showLoadingStateUX,
    hideLoadingState: hideLoadingStateUX,
    updateProgress: updateProgressWithAnimation,
    createStatusIndicator: createStatusIndicator,
    scrollToActiveItem: scrollToActiveItem
  };

  console.log('🎨 UX Enhancements loaded successfully');
});
