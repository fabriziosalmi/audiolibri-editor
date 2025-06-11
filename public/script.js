document.addEventListener('DOMContentLoaded', function() {
  // DOM elements
  const itemsList = document.getElementById('itemsList');
  const searchInput = document.getElementById('searchInput');
  const searchBtn = document.getElementById('searchBtn');
  const clearSearchBtn = document.getElementById('clearSearchBtn');
  const genreFilter = document.getElementById('genreFilter');
  const statusFilter = document.getElementById('statusFilter');
  const editForm = document.getElementById('editForm');
  const noItemSelected = document.getElementById('noItemSelected');
  const itemDetails = document.getElementById('itemDetails');
  const updateItemBtn = document.getElementById('updateItemBtn');
  const resetFormBtn = document.getElementById('resetFormBtn');
  const saveChangesBtn = document.getElementById('saveChangesBtn');
  const bulkEditBtn = document.getElementById('bulkEditBtn');
  const exportBtn = document.getElementById('exportBtn');
  const genreManagementBtn = document.getElementById('genreManagementBtn');
  
  // Modals
  const prModal = new bootstrap.Modal(document.getElementById('prModal'));
  const successModal = new bootstrap.Modal(document.getElementById('successModal'));
  const bulkEditModal = new bootstrap.Modal(document.getElementById('bulkEditModal'));
  const exportModal = new bootstrap.Modal(document.getElementById('exportModal'));
  const importModal = new bootstrap.Modal(document.getElementById('importModal'));
  const genreManagementModal = new bootstrap.Modal(document.getElementById('genreManagementModal'));
  const mergeGenresModal = new bootstrap.Modal(document.getElementById('mergeGenresModal'));
  
  const submitPrBtn = document.getElementById('submitPrBtn');
  const prLink = document.getElementById('prLink');
  const applyBulkEditBtn = document.getElementById('applyBulkEditBtn');
  const downloadExportBtn = document.getElementById('downloadExportBtn');

  // Import elements
  const importBtn = document.getElementById('importBtn');
  const importSingleVideoBtn = document.getElementById('importSingleVideoBtn');
  const importPlaylistBtn = document.getElementById('importPlaylistBtn');
  const importProgress = document.getElementById('importProgress');
  const importStatus = document.getElementById('importStatus');

  // Statistics elements
  const totalItems = document.getElementById('totalItems');
  const processedItems = document.getElementById('processedItems');
  const pendingItems = document.getElementById('pendingItems');
  const modifiedItems = document.getElementById('modifiedItems');
  const itemsCount = document.getElementById('itemsCount');

  // Pagination elements
  const itemsPerPage = document.getElementById('itemsPerPage');
  const pagination = document.getElementById('pagination');

  // Form elements
  const synopsisTextarea = document.getElementById('realSynopsis');
  const synopsisCount = document.getElementById('synopsisCount');

  // State management
  let allData = {};
  let filteredData = {};
  let currentItemId = null;
  let changedItems = {};
  let selectedItems = new Set();
  let currentPage = 1;
  let itemsPerPageValue = 20;
  let undoStack = [];
  
  // Make variables globally available for genre management
  window.allData = allData;
  window.filteredData = filteredData;
  window.changedItems = changedItems;
  
  // Genre management state
  let allGenres = {};
  let selectedGenres = new Set();
  let genreChanges = {};

  // Fetch all data on page load
  fetchData();

  // Event listeners
  searchBtn.addEventListener('click', performSearch);
  clearSearchBtn.addEventListener('click', clearSearch);
  searchInput.addEventListener('keyup', function(event) {
    if (event.key === 'Enter') {
      performSearch();
    }
  });

  genreFilter.addEventListener('change', applyFilters);
  statusFilter.addEventListener('change', applyFilters);
  itemsPerPage.addEventListener('change', function() {
    itemsPerPageValue = parseInt(this.value);
    currentPage = 1;
    renderItems(filteredData);
  });

  updateItemBtn.addEventListener('click', updateItem);
  resetFormBtn.addEventListener('click', resetForm);
  saveChangesBtn.addEventListener('click', openPrModal);
  bulkEditBtn.addEventListener('click', openBulkEditModal);
  exportBtn.addEventListener('click', openExportModal);
  // Note: genreManagementBtn listener is in genre-management.js to avoid conflicts
  
  // Enhanced FAB and Quick Actions functionality
  const quickActionsFab = document.getElementById('quickActionsFab');
  const quickActionsPanel = document.getElementById('quickActionsPanel');
  let isQuickActionsOpen = false;

  // Toggle quick actions panel
  quickActionsFab.addEventListener('click', function(e) {
    e.stopPropagation();
    toggleQuickActions();
  });

  function toggleQuickActions() {
    isQuickActionsOpen = !isQuickActionsOpen;
    
    if (isQuickActionsOpen) {
      quickActionsPanel.style.display = 'block';
      setTimeout(() => {
        quickActionsPanel.classList.add('show');
        quickActionsFab.classList.add('active');
      }, 10);
    } else {
      quickActionsPanel.classList.remove('show');
      quickActionsFab.classList.remove('active');
      setTimeout(() => {
        if (!isQuickActionsOpen) {
          quickActionsPanel.style.display = 'none';
        }
      }, 300);
    }
  }

  // Close quick actions when clicking outside
  document.addEventListener('click', function(e) {
    if (isQuickActionsOpen && 
        !quickActionsPanel.contains(e.target) && 
        !quickActionsFab.contains(e.target)) {
      toggleQuickActions();
    }
  });

  // Quick action buttons with navigation integration
  document.getElementById('quickImportBtn').addEventListener('click', () => {
    importModal.show();
    // Close quick actions panel on mobile
    if (window.innerWidth < 992 && isQuickActionsOpen) {
      toggleQuickActions();
    }
  });
  // Note: quickGenreBtn listener is in genre-management.js to avoid conflicts
  document.getElementById('quickBulkEditBtn').addEventListener('click', () => {
    openBulkEditModal();
    if (window.innerWidth < 992 && isQuickActionsOpen) {
      toggleQuickActions();
    }
  });
  document.getElementById('quickExportBtn').addEventListener('click', () => {
    openExportModal();
    if (window.innerWidth < 992 && isQuickActionsOpen) {
      toggleQuickActions();
    }
  });
  document.getElementById('quickSaveBtn').addEventListener('click', () => {
    openPrModal();
    if (window.innerWidth < 992 && isQuickActionsOpen) {
      toggleQuickActions();
    }
  });
  document.getElementById('quickHelpBtn').addEventListener('click', () => {
    const helpModal = new bootstrap.Modal(document.getElementById('helpModal'));
    helpModal.show();
    if (window.innerWidth < 992 && isQuickActionsOpen) {
      toggleQuickActions();
    }
  });
  
  // Quick search functionality
  document.getElementById('quickSearchBtn')?.addEventListener('click', function() {
    toggleQuickActions();
    setTimeout(() => {
      searchInput.focus();
      searchInput.select();
    }, 100);
  });
  
  submitPrBtn.addEventListener('click', submitChanges);
  applyBulkEditBtn.addEventListener('click', applyBulkEdit);
  downloadExportBtn.addEventListener('click', downloadExport);

  // Import event listeners
  importSingleVideoBtn.addEventListener('click', importSingleVideo);
  importPlaylistBtn.addEventListener('click', importPlaylist);
  
  // Import tab switching
  document.getElementById('single-video-tab').addEventListener('shown.bs.tab', function () {
    importSingleVideoBtn.style.display = 'inline-block';
    importPlaylistBtn.style.display = 'none';
  });
  
  document.getElementById('playlist-tab').addEventListener('shown.bs.tab', function () {
    importSingleVideoBtn.style.display = 'none';
    importPlaylistBtn.style.display = 'inline-block';
  });

  // YouTube URL and thumbnail buttons
  document.getElementById('openYouTubeBtn').addEventListener('click', function() {
    const url = document.getElementById('youtubeUrl').value;
    if (url) {
      window.open(url, '_blank');
    }
  });

  document.getElementById('viewThumbnailBtn').addEventListener('click', function() {
    const thumbnailUrl = document.getElementById('thumbnail').value;
    if (thumbnailUrl) {
      window.open(thumbnailUrl, '_blank');
    }
  });

  // Character counter for synopsis
  synopsisTextarea.addEventListener('input', updateCharacterCount);

  // Bulk edit form toggles
  document.getElementById('bulkEditGenre').addEventListener('change', function() {
    document.getElementById('bulkGenre').disabled = !this.checked;
  });
  document.getElementById('bulkEditLanguage').addEventListener('change', function() {
    document.getElementById('bulkLanguage').disabled = !this.checked;
  });
  document.getElementById('bulkEditProcessed').addEventListener('change', function() {
    const radios = document.querySelectorAll('input[name="bulkProcessed"]');
    radios.forEach(radio => radio.disabled = !this.checked);
  });

  // Form validation
  const formFields = ['realTitle', 'realAuthor', 'realGenre', 'realContentType', 'realLanguage', 'realSynopsis', 'realDuration', 'realPublishedYear', 'realNarrator'];
  formFields.forEach(fieldId => {
    const field = document.getElementById(fieldId);
    if (field) {
      field.addEventListener('input', validateField);
      field.addEventListener('blur', validateField);
    }
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', function(event) {
    if (event.ctrlKey || event.metaKey) {
      switch(event.key) {
        case 's':
          event.preventDefault();
          if (Object.keys(changedItems).length > 0) {
            openPrModal();
          }
          break;
        case 'f':
          event.preventDefault();
          searchInput.focus();
          break;
        case 'z':
          if (!event.shiftKey && undoStack.length > 0) {
            event.preventDefault();
            undoLastChange();
          }
          break;
      }
    }
  });

  // Prevent form submission on enter key
  document.getElementById('editForm').addEventListener('submit', function(e) {
    e.preventDefault();
    updateItem();
  });

  document.getElementById('prForm').addEventListener('submit', function(e) {
    e.preventDefault();
    submitChanges();
  });

  document.getElementById('bulkEditForm').addEventListener('submit', function(e) {
    e.preventDefault();
    applyBulkEdit();
  });

  // Functions
  function fetchData() {
    itemsList.innerHTML = '<div class="list-group-item text-center py-3"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Caricamento...</span></div></div>';
    
    fetch('/api/data')
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        // Validate data structure
        if (!data || typeof data !== 'object') {
          throw new Error('Invalid data format received from server');
        }
        
        allData = data;
        filteredData = data;
        populateGenreFilter();
        populateGenreDropdown();
        updateStatistics();
        renderItems(data);
        
        showToast(`${Object.keys(data).length} elementi caricati con successo!`, 'success');
      })
      .catch(error => {
        console.error('Error fetching data:', error);
        itemsList.innerHTML = `
          <div class="list-group-item text-center py-3 text-danger">
            <i class="fas fa-exclamation-triangle mb-2"></i>
            <p>Errore nel caricamento dei dati: ${error.message}</p>
            <button class="btn btn-outline-primary btn-sm" onclick="fetchData()">
              <i class="fas fa-retry me-1"></i>Riprova
            </button>
          </div>
        `;
        showToast('Errore nel caricamento dei dati. Controlla la connessione.', 'danger');
      });
  }

  function populateGenreFilter() {
    const genres = new Set();
    Object.values(allData).forEach(item => {
      if (item.real_genre && item.real_genre.trim()) {
        genres.add(item.real_genre.trim());
      }
    });
    
    genreFilter.innerHTML = '<option value="">Tutti i Generi</option>';
    Array.from(genres).sort().forEach(genre => {
      const option = document.createElement('option');
      option.value = genre;
      option.textContent = genre;
      genreFilter.appendChild(option);
    });
  }

  function populateGenreDropdown() {
    const genres = new Set();
    Object.values(allData).forEach(item => {
      if (item.real_genre && item.real_genre.trim()) {
        genres.add(item.real_genre.trim());
      }
    });
    
    const realGenreSelect = document.getElementById('realGenre');
    realGenreSelect.innerHTML = '<option value="">Seleziona genere</option>';
    Array.from(genres).sort().forEach(genre => {
      const option = document.createElement('option');
      option.value = genre;
      option.textContent = genre;
      realGenreSelect.appendChild(option);
    });
  }

  function updateStatistics() {
    const total = Object.keys(allData).length;
    const processed = Object.values(allData).filter(item => item.processed === true).length;
    const pending = total - processed;
    const modified = Object.keys(changedItems).length;

    // Update main statistics (if elements exist)
    if (totalItems) totalItems.textContent = total.toLocaleString();
    if (processedItems) processedItems.textContent = processed.toLocaleString();
    if (pendingItems) pendingItems.textContent = pending.toLocaleString();
    if (modifiedItems) modifiedItems.textContent = modified.toLocaleString();
    
    // Update navbar statistics
    const totalItemsNav = document.getElementById('totalItemsNav');
    const processedItemsNav = document.getElementById('processedItemsNav');
    const pendingItemsNav = document.getElementById('pendingItemsNav');
    const modifiedItemsNav = document.getElementById('modifiedItemsNav');
    
    if (totalItemsNav) totalItemsNav.textContent = total.toLocaleString();
    if (processedItemsNav) processedItemsNav.textContent = processed.toLocaleString();
    if (pendingItemsNav) pendingItemsNav.textContent = pending.toLocaleString();
    if (modifiedItemsNav) modifiedItemsNav.textContent = modified.toLocaleString();
  }

  function performSearch() {
    const query = searchInput.value.trim();
    
    if (query === '') {
      clearSearch();
      return;
    }
    
    // Show searching message
    itemsList.innerHTML = `
      <div class="list-group-item text-center py-3">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Ricerca in corso...</span>
        </div>
        <p class="mt-2 text-primary">Ricerca in corso...</p>
      </div>
    `;
    
    fetch(`/api/search?query=${encodeURIComponent(query)}`)
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json();
      })
      .then(data => {
        filteredData = data;
        currentPage = 1;
        renderItems(data);
      })
      .catch(error => {
        console.error('Errore durante la ricerca:', error);
        itemsList.innerHTML = `
          <div class="list-group-item text-danger">
            <i class="fas fa-exclamation-circle me-2"></i>
            Errore durante la ricerca: ${error.message}
          </div>
        `;
      });
  }

  function clearSearch() {
    searchInput.value = '';
    filteredData = allData;
    currentPage = 1;
    applyFilters();
  }

  function applyFilters() {
    let data = searchInput.value.trim() ? filteredData : allData;
    
    // Apply genre filter
    if (genreFilter.value) {
      data = Object.fromEntries(
        Object.entries(data).filter(([id, item]) => 
          item.real_genre === genreFilter.value
        )
      );
    }
    
    // Apply status filter
    if (statusFilter.value) {
      switch(statusFilter.value) {
        case 'processed':
          data = Object.fromEntries(
            Object.entries(data).filter(([id, item]) => item.processed === true)
          );
          break;
        case 'pending':
          data = Object.fromEntries(
            Object.entries(data).filter(([id, item]) => item.processed !== true)
          );
          break;
        case 'modified':
          data = Object.fromEntries(
            Object.entries(data).filter(([id, item]) => changedItems[id] !== undefined)
          );
          break;
      }
    }
    
    filteredData = data;
    currentPage = 1;
    renderItems(data);
  }

  function renderItems(data) {
    const totalItems = Object.keys(data).length;
    
    if (totalItems === 0) {
      itemsList.innerHTML = `<div class="list-group-item"><i class="fas fa-info-circle me-2"></i>Nessun elemento trovato</div>`;
      itemsCount.textContent = '0';
      document.getElementById('pagination').innerHTML = '';
      return;
    }
    
    // Update items count
    itemsCount.textContent = totalItems.toLocaleString();
    
    // Sort items to show modified items at the top
    const sortedItems = Object.entries(data).sort((a, b) => {
      const isAChanged = changedItems[a[0]] !== undefined;
      const isBChanged = changedItems[b[0]] !== undefined;
      
      if (isAChanged && !isBChanged) return -1; // A is modified, B is not
      if (!isAChanged && isBChanged) return 1;  // B is modified, A is not
      return 0; // Both modified or both not modified
    });
    
    // Calculate pagination
    const startIndex = (currentPage - 1) * itemsPerPageValue;
    const endIndex = startIndex + itemsPerPageValue;
    const pageItems = sortedItems.slice(startIndex, endIndex);
    
    // Clear and populate items list
    itemsList.innerHTML = '';
    
    pageItems.forEach(([id, item]) => {
      const isChanged = changedItems[id] !== undefined;
      const isSelected = selectedItems.has(id);
      
      const itemElement = document.createElement('a');
      itemElement.href = '#';
      itemElement.className = `list-group-item list-group-item-action ${currentItemId === id ? 'active' : ''} ${isSelected ? 'bulk-selected' : ''}`;
      itemElement.innerHTML = `
        <div class="bulk-select-checkbox">
          <input type="checkbox" class="form-check-input" ${isSelected ? 'checked' : ''} data-item-id="${id}">
        </div>
        <div class="d-flex w-100 justify-content-between">
          <h6 class="mb-1">${item.real_title || item.title || 'Nessun Titolo'}</h6>
          ${isChanged ? '<span class="badge bg-warning text-dark changes-badge"><i class="fas fa-pen-fancy me-1"></i>Modificato</span>' : ''}
        </div>
        <p class="mb-1">${item.real_author || 'Autore Sconosciuto'}</p>
        <div class="d-flex justify-content-between align-items-center">
          <small class="text-muted">${item.real_genre || 'Genere Sconosciuto'}</small>
          ${item.processed ? '<span class="badge badge-processed-true">Processato</span>' : '<span class="badge badge-processed-false">Non Processato</span>'}
        </div>
      `;
      
      // Add click handler for item selection (not checkbox)
      itemElement.addEventListener('click', function(e) {
        if (e.target.type !== 'checkbox') {
          e.preventDefault();
          selectItem(id);
        }
      });
      
      // Add checkbox handler for bulk selection
      const checkbox = itemElement.querySelector('input[type="checkbox"]');
      checkbox.addEventListener('change', function(e) {
        e.stopPropagation();
        if (this.checked) {
          selectedItems.add(id);
          itemElement.classList.add('bulk-selected');
        } else {
          selectedItems.delete(id);
          itemElement.classList.remove('bulk-selected');
        }
      });
      
      itemsList.appendChild(itemElement);
    });
    
    // Add pagination info
    const paginationInfo = document.createElement('div');
    paginationInfo.className = 'list-group-item text-center text-muted bg-light';
    paginationInfo.innerHTML = `
      <small>
        Mostra ${startIndex + 1}-${Math.min(endIndex, totalItems)} di ${totalItems} elementi
        ${selectedItems.size > 0 ? `| ${selectedItems.size} selezionati` : ''}
      </small>
    `;
    itemsList.appendChild(paginationInfo);
    
    // Render pagination controls
    renderPagination(totalItems);
  }

  function selectItem(id) {
    currentItemId = id;
    const item = allData[id];
    
    // Update UI to show the selected item is active
    document.querySelectorAll('#itemsList .list-group-item').forEach(el => {
      el.classList.remove('active');
    });
    
    const selectedElement = Array.from(document.querySelectorAll('#itemsList .list-group-item'))
      .find(el => el.textContent.includes(item.real_title || item.title));
    
    if (selectedElement) {
      selectedElement.classList.add('active');
      // Scroll to the selected element if needed
      selectedElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    
    // Show the item details form
    noItemSelected.style.display = 'none';
    itemDetails.style.display = 'block';
    
    // Populate Basic Information Tab
    document.getElementById('realTitle').value = item.real_title || item.title || '';
    document.getElementById('realAuthor').value = item.real_author || item.author || '';
    document.getElementById('realGenre').value = item.real_genre || item.genre || '';
    document.getElementById('realContentType').value = item.content_type || 'audiobook';
    document.getElementById('realLanguage').value = item.real_language || item.language || 'it';
    document.getElementById('realNarrator').value = item.real_narrator || item.narrator || item.channel || '';
    document.getElementById('realSynopsis').value = item.real_synopsis || item.synopsis || '';
    document.getElementById('realPublishedYear').value = item.real_published_year || item.published_year || '';
    document.getElementById('isProcessed').checked = item.processed || false;
    
    // Populate YouTube Metadata Tab
    document.getElementById('originalTitle').value = item.title || '';
    document.getElementById('channelName').value = item.channel || item.channel_name || '';
    document.getElementById('viewCount').value = item.view_count ? item.view_count.toLocaleString() : '';
    document.getElementById('likeCount').value = item.like_count ? item.like_count.toLocaleString() : '';
    document.getElementById('duration').value = item.duration ? formatDuration(item.duration) : '';
    document.getElementById('uploadDate').value = item.upload_date ? formatDate(item.upload_date) : '';
    document.getElementById('youtubeUrl').value = item.youtube_url || item.url || '';
    document.getElementById('originalDescription').value = item.description || '';
    document.getElementById('thumbnail').value = item.thumbnail || '';
    
    // Populate Content & Tags Tab
    document.getElementById('audioFile').value = item.audio_file || '';
    document.getElementById('summary').value = item.summary || '';
    document.getElementById('transcript').value = item.transcript || '';
    
    // Display categories
    const categoriesDisplay = document.getElementById('categoriesDisplay');
    if (item.categories && item.categories.length > 0) {
      categoriesDisplay.innerHTML = item.categories.map(cat => 
        `<span class="badge bg-info me-1">${cat}</span>`
      ).join('');
    } else {
      categoriesDisplay.innerHTML = '<span class="text-muted">Nessuna categoria</span>';
    }
    
    // Display tags
    const tagsDisplay = document.getElementById('tagsDisplay');
    if (item.tags && item.tags.length > 0) {
      tagsDisplay.innerHTML = item.tags.map(tag => 
        `<span class="badge bg-secondary me-1 mb-1">${tag}</span>`
      ).join('');
    } else {
      tagsDisplay.innerHTML = '<span class="text-muted">Nessun tag</span>';
    }
    
    // Show thumbnail preview
    const thumbnailPreview = document.getElementById('thumbnailPreview');
    if (item.thumbnail) {
      thumbnailPreview.innerHTML = `<img src="${item.thumbnail}" class="img-thumbnail" style="max-width: 120px;" alt="Thumbnail">`;
    } else {
      thumbnailPreview.innerHTML = '<span class="text-muted">Nessuna immagine</span>';
    }
    
    // Update character count
    updateCharacterCount();
    
    // Clear any existing validation states
    const formElements = document.querySelectorAll('#editForm .form-control, #editForm .form-select');
    formElements.forEach(element => {
      element.classList.remove('is-valid', 'is-invalid');
    });
    
    // Remove feedback messages
    const feedbacks = document.querySelectorAll('#editForm .invalid-feedback, #editForm .valid-feedback');
    feedbacks.forEach(feedback => feedback.remove());
  }

  function updateItem(silent = false) {
    if (!currentItemId) {
      showToast('Nessun elemento selezionato per l\'aggiornamento', 'warning');
      return;
    }
    
    try {
      // Validate form first
      let isFormValid = true;
      const formElements = document.querySelectorAll('#editForm .form-control, #editForm .form-select');
      formElements.forEach(element => {
        // Check if element has value property and handle different input types
        if (element.value !== undefined && typeof element.value === 'string') {
          const hasValue = element.hasAttribute('required') || element.value.trim();
          
          if (hasValue) {
            const event = { target: element };
            if (!validateField(event)) {
              isFormValid = false;
            }
          }
        }
      });
      
      if (!isFormValid) {
        showToast('Correggi gli errori nel form prima di salvare', 'danger');
        return;
      }
      
      // Store previous state for undo
      const previousData = { ...allData[currentItemId] };
      undoStack.push({
        type: 'update',
        itemId: currentItemId,
        previousData
      });
      
      const formData = sanitizeObject({
        real_title: document.getElementById('realTitle').value.trim(),
        real_author: document.getElementById('realAuthor').value.trim(),
        real_genre: document.getElementById('realGenre').value.trim(),
        content_type: document.getElementById('realContentType').value,
        real_language: document.getElementById('realLanguage').value,
        real_synopsis: document.getElementById('realSynopsis').value.trim(),
        real_published_year: document.getElementById('realPublishedYear').value ? parseInt(document.getElementById('realPublishedYear').value) : null,
        real_narrator: document.getElementById('realNarrator').value.trim()
        // Note: Removed readonly fields: processed, audio_file, summary, transcript
      });
      
      // Remove empty values
      Object.keys(formData).forEach(key => {
        if (formData[key] === '' || formData[key] === null) {
          delete formData[key];
        }
      });
      
      // Check if there are actual changes
      let hasChanges = false;
      const originalItem = allData[currentItemId];
      Object.keys(formData).forEach(key => {
        if (formData[key] !== originalItem[key]) {
          hasChanges = true;
        }
      });
      
      if (!hasChanges) {
        showToast('Nessuna modifica rilevata', 'info');
        return;
      }
      
      // Update the local data
      allData[currentItemId] = { ...allData[currentItemId], ...formData };
      
      // Add to changed items - only store the actual changes
      if (!changedItems[currentItemId]) {
        changedItems[currentItemId] = {};
      }
      
      Object.keys(formData).forEach(key => {
        if (formData[key] !== previousData[key]) {
          changedItems[currentItemId][key] = formData[key];
        }
      });
      
      // Update global reference
      window.changedItems = changedItems;
      
      // Update the UI
      updateStatistics();
      renderItems(filteredData);
      updateSaveChangesBtn();
      
      // Show success toast
      if (!silent) {
        showToast('Elemento aggiornato con successo!', 'success');
      }
      
    } catch (error) {
      console.error('Errore durante l\'aggiornamento dell\'elemento:', error);
      showToast('Errore durante l\'aggiornamento: ' + error.message, 'danger');
    }
  }

  function updateSaveChangesBtn() {
    const numChanges = Object.keys(changedItems).length;
    console.log('Updating save button - changes:', numChanges, changedItems);
    
    saveChangesBtn.innerHTML = numChanges > 0 ? 
      `<i class="fas fa-save me-1"></i>Salva Modifiche (${numChanges})` : 
      '<i class="fas fa-save me-1"></i>Salva Modifiche';
    saveChangesBtn.classList.toggle('btn-warning', numChanges > 0);
    saveChangesBtn.classList.toggle('btn-outline-light', numChanges === 0);
    
    // Enable/disable the button based on changes
    saveChangesBtn.disabled = numChanges === 0;
  }

  function openPrModal() {
    if (!changedItems || Object.keys(changedItems).length === 0) {
      showToast('Nessuna modifica da salvare. Effettua prima alcune modifiche.', 'warning');
      return;
    }
    
    try {
      // Generate a unique branch name with timestamp
      const timestamp = Date.now();
      const branchName = `update-audiolibri-${timestamp}`;
      document.getElementById('branchName').value = branchName;
      
      // Generate default commit message
      const numChanges = Object.keys(changedItems).length;
      document.getElementById('commitMessage').value = `Aggiorna ${numChanges} elementi audiolibri`;
      
      // Generate default PR title
      document.getElementById('prTitle').value = `Aggiornamento dati audiolibri (${numChanges} elementi)`;
      
      // Generate PR description with list of modified items
      let prDescription = 'Questa PR aggiorna i dati degli audiolibri con le seguenti modifiche:\n\n';
      
      // Add list of modified items with their changes
      let itemCount = 0;
      Object.entries(changedItems).forEach(([id, changes]) => {
        if (itemCount >= 10) return; // Limit to first 10 items in description
        
        const originalItem = allData[id];
        if (!originalItem) return;
        
        const title = changes.real_title || originalItem.real_title || originalItem.title || 'Senza titolo';
        const modifiedFields = Object.keys(changes);
        
        prDescription += `- **${title}** (${modifiedFields.join(', ')})\n`;
        itemCount++;
      });
      
      if (Object.keys(changedItems).length > 10) {
        prDescription += `\n... e altri ${Object.keys(changedItems).length - 10} elementi\n`;
      }
      
      prDescription += `\n**Totale:** ${Object.keys(changedItems).length} elementi modificati`;
      
      // Set the PR description
      document.getElementById('prDescription').value = prDescription;
      
      // Show the modal
      prModal.show();
      
    } catch (error) {
      console.error('Errore nell\'apertura del modal PR:', error);
      showToast('Errore nell\'apertura del modal di salvataggio: ' + error.message, 'danger');
    }
  }

  function submitChanges() {
    const branchName = document.getElementById('branchName').value;
    const commitMessage = document.getElementById('commitMessage').value;
    const prTitle = document.getElementById('prTitle').value;
    const prDescription = document.getElementById('prDescription').value;
    
    // Validate required fields
    if (!branchName.trim()) {
      showToast('Nome branch richiesto', 'danger');
      return;
    }
    
    if (!commitMessage.trim()) {
      showToast('Messaggio commit richiesto', 'danger');
      return;
    }
    
    if (!prTitle.trim()) {
      showToast('Titolo PR richiesto', 'danger');
      return;
    }
    
    // Check if there are changes to submit
    if (!changedItems || Object.keys(changedItems).length === 0) {
      showToast('Nessuna modifica da salvare', 'warning');
      return;
    }
    
    // Disable the submit button and show loading state
    submitPrBtn.disabled = true;
    submitPrBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Invio in corso...';
    
    // Submit the changes to the server
    fetch('/api/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        changes: changedItems,
        branchName: branchName.trim(),
        commitMessage: commitMessage.trim(),
        prTitle: prTitle.trim(),
        prDescription: prDescription.trim()
      })
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      // Hide the PR modal
      prModal.hide();
      
      // Reset the submit button
      submitPrBtn.disabled = false;
      submitPrBtn.innerHTML = '<i class="fas fa-paper-plane me-1"></i>Invia PR';
      
      if (data.success) {
        // Show the success modal with the PR link
        prLink.href = data.prUrl;
        prLink.innerHTML = '<i class="fab fa-github me-1"></i>Visualizza PR';
        successModal.show();
        
        // Reset the changed items
        changedItems = {};
        updateSaveChangesBtn();
        
        // Update UI to reflect saved state
        updateStatistics();
        renderItems(filteredData);
        
        showToast('Pull Request creata con successo!', 'success');
      } else {
        throw new Error(data.error || 'Errore sconosciuto durante il salvataggio');
      }
    })
    .catch(error => {
      console.error('Errore durante l\'invio delle modifiche:', error);
      showToast('Errore durante l\'invio delle modifiche: ' + error.message, 'danger');
      
      // Reset the submit button
      submitPrBtn.disabled = false;
      submitPrBtn.innerHTML = '<i class="fas fa-paper-plane me-1"></i>Invia PR';
    });
  }

  function renderPagination(totalItems) {
    const paginationContainer = document.getElementById('pagination');
    const totalPages = Math.ceil(totalItems / itemsPerPageValue);
    
    paginationContainer.innerHTML = '';
    
    if (totalPages <= 1) return;
    
    // Previous button
    if (currentPage > 1) {
      const prevButton = document.createElement('button');
      prevButton.className = 'btn btn-outline-primary btn-sm me-1';
      prevButton.innerHTML = '<i class="fas fa-chevron-left"></i>';
      prevButton.addEventListener('click', () => {
        currentPage--;
        renderItems(filteredData);
      });
      paginationContainer.appendChild(prevButton);
    }
    
    // Page numbers
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);
    
    for (let i = startPage; i <= endPage; i++) {
      const pageButton = document.createElement('button');
      pageButton.className = `btn btn-sm me-1 ${i === currentPage ? 'btn-primary' : 'btn-outline-primary'}`;
      pageButton.textContent = i;
      pageButton.addEventListener('click', () => {
        currentPage = i;
        renderItems(filteredData);
      });
      paginationContainer.appendChild(pageButton);
    }
    
    // Next button
    if (currentPage < totalPages) {
      const nextButton = document.createElement('button');
      nextButton.className = 'btn btn-outline-primary btn-sm ms-1';
      nextButton.innerHTML = '<i class="fas fa-chevron-right"></i>';
      nextButton.addEventListener('click', () => {
        currentPage++;
        renderItems(filteredData);
      });
      paginationContainer.appendChild(nextButton);
    }
  }

  function applyBulkEdit() {
    if (selectedItems.size === 0) {
      showToast('Seleziona almeno un elemento per applicare le modifiche multiple.', 'warning');
      return;
    }
    
    const bulkGenre = document.getElementById('bulkEditGenre').checked ? document.getElementById('bulkGenre').value : null;
    const bulkLanguage = document.getElementById('bulkEditLanguage').checked ? document.getElementById('bulkLanguage').value : null;
    const bulkProcessed = document.getElementById('bulkEditProcessed').checked ? 
      document.querySelector('input[name="bulkProcessed"]:checked')?.value : null;
    
    let changesCount = 0;
    const selectedItemsCount = selectedItems.size; // Store count before clearing
    
    selectedItems.forEach(itemId => {
      const updates = {};
      
      if (bulkGenre) {
        updates.real_genre = bulkGenre;
        changesCount++;
      }
      
      if (bulkLanguage) {
        updates.real_language = bulkLanguage;
        changesCount++;
      }
      
      if (bulkProcessed !== null) {
        updates.processed = bulkProcessed === 'true';
        changesCount++;
      }
      
      if (Object.keys(updates).length > 0) {
        // Apply updates to local data
        allData[itemId] = { ...allData[itemId], ...updates };
        
        // Track changes
        changedItems[itemId] = { ...changedItems[itemId], ...updates };
      }
    });
    
    // Update UI
    updateStatistics();
    renderItems(filteredData);
    updateSaveChangesBtn();
    
    // Close modal and clear selections
    bulkEditModal.hide();
    selectedItems.clear();
    
    showToast(`Modifiche applicate a ${selectedItemsCount} elementi`, 'success');
  }

  function openBulkEditModal() {
    if (selectedItems.size === 0) {
      alert('Seleziona almeno un elemento per modificare multiple.');
      return;
    }
    
    // Update selected items count in modal
    document.getElementById('selectedItemsCount').textContent = selectedItems.size;
    
    // Show list of selected items
    const selectedItemsList = document.getElementById('selectedItemsList');
    selectedItemsList.innerHTML = '';
    
    Array.from(selectedItems).slice(0, 5).forEach(itemId => {
      const item = allData[itemId];
      const listItem = document.createElement('div');
      listItem.textContent = item.real_title || item.title || `Item ${itemId}`;
      selectedItemsList.appendChild(listItem);
    });
    
    if (selectedItems.size > 5) {
      const moreItem = document.createElement('div');
      moreItem.textContent = `... e altri ${selectedItems.size - 5} elementi`;
      moreItem.className = 'text-muted';
      selectedItemsList.appendChild(moreItem);
    }
    
    bulkEditModal.show();
  }

  function openExportModal() {
    exportModal.show();
  }

  function downloadExport() {
    const format = document.querySelector('input[name="exportFormat"]:checked')?.value || 'json';
    const dataType = document.querySelector('input[name="exportData"]:checked')?.value || 'all';
    
    let dataToExport = {};
    
    switch (dataType) {
      case 'all':
        dataToExport = allData;
        break;
      case 'filtered':
        dataToExport = filteredData;
        break;
      case 'modified':
        dataToExport = Object.fromEntries(
          Object.entries(allData).filter(([id]) => changedItems[id])
        );
        break;
    }
    
    const totalItems = Object.keys(dataToExport).length;
    
    if (totalItems === 0) {
      alert('Nessun dato da esportare con i criteri selezionati.');
      return;
    }
    
    let content, filename, mimeType;
    
    switch (format) {
      case 'json':
        content = JSON.stringify(dataToExport, null, 2);
        filename = `audiolibri-export-${Date.now()}.json`;
        mimeType = 'application/json';
        break;
      case 'csv':
        content = convertToCSV(dataToExport);
        filename = `audiolibri-export-${Date.now()}.csv`;
        mimeType = 'text/csv';
        break;
      case 'xml':
        content = convertToXML(dataToExport);
        filename = `audiolibri-export-${Date.now()}.xml`;
        mimeType = 'application/xml';
        break;
    }
    
    // Create and trigger download
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    
    exportModal.hide();
    showToast(`${totalItems} elementi esportati in formato ${format.toUpperCase()}`, 'success');
  }

  function convertToCSV(data) {
    const items = Object.values(data);
    if (items.length === 0) return '';
    
    // Get all unique keys
    const keys = new Set();
    items.forEach(item => {
      Object.keys(item).forEach(key => keys.add(key));
    });
    
    const headers = Array.from(keys);
    const csvContent = [
      headers.join(','),
      ...items.map(item => 
        headers.map(key => {
          const value = item[key];
          if (Array.isArray(value)) {
            return `"${value.join('; ')}"`;
          }
          if (typeof value === 'string') {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value || '';
        }).join(',')
      )
    ].join('\n');
    
    return csvContent;
  }

  function convertToXML(data) {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<audiolibri>\n';
    
    Object.entries(data).forEach(([id, item]) => {
      xml += `  <item id="${id}">\n`;
      
      Object.entries(item).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          xml += `    <${key}>\n`;
          value.forEach(v => {
            xml += `      <item>${escapeXml(String(v))}</item>\n`;
          });
          xml += `    </${key}>\n`;
        } else if (value !== null && value !== undefined) {
          xml += `    <${key}>${escapeXml(String(value))}</${key}>\n`;
        }
      });
      
      xml += '  </item>\n';
    });
    
    xml += '</audiolibri>';
    return xml;
  }

  function escapeXml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function importSingleVideo() {
    const url = document.getElementById('singleVideoUrl').value.trim();
    if (!url) {
      alert('Inserisci un URL YouTube valido.');
      return;
    }
    
    // Disable button and show loading
    importSingleVideoBtn.disabled = true;
    importSingleVideoBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Importazione...';
    
    fetch('/api/import/video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        // Add new item to local data
        allData[data.id] = data.item;
        filteredData = allData;
        
        updateStatistics();
        renderItems(filteredData);
        
        importModal.hide();
        showToast('Video importato con successo!', 'success');
        
        // Clear input
        document.getElementById('singleVideoUrl').value = '';
      } else {
        throw new Error(data.error || 'Errore durante l\'importazione');
      }
    })
    .catch(error => {
      console.error('Errore importazione:', error);
      showToast('Errore durante l\'importazione: ' + error.message, 'danger');
    })
    .finally(() => {
      // Reset button
      importSingleVideoBtn.disabled = false;
      importSingleVideoBtn.innerHTML = '<i class="fas fa-plus me-1"></i>Importa Video';
    });
  }

  function importPlaylist() {
    const url = document.getElementById('playlistUrl').value.trim();
    if (!url) {
      alert('Inserisci un URL playlist YouTube valido.');
      return;
    }
    
    // Disable button and show loading
    importPlaylistBtn.disabled = true;
    importPlaylistBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Importazione...';
    
    fetch('/api/import/playlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        // Add new items to local data
        Object.assign(allData, data.items);
        filteredData = allData;
        
        updateStatistics();
        renderItems(filteredData);
        
        importModal.hide();
        showToast(`${Object.keys(data.items).length} video importati dalla playlist!`, 'success');
        
        // Clear input
        document.getElementById('playlistUrl').value = '';
      } else {
        throw new Error(data.error || 'Errore durante l\'importazione');
      }
    })
    .catch(error => {
      console.error('Errore importazione playlist:', error);
      showToast('Errore durante l\'importazione: ' + error.message, 'danger');
    })
    .finally(() => {
      // Reset button
      importPlaylistBtn.disabled = false;
      importPlaylistBtn.innerHTML = '<i class="fas fa-list me-1"></i>Importa Playlist';
    });
  }

  // Utility functions for formatting
  function formatDuration(seconds) {
    if (!seconds) return '';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else {
      return `${minutes}m ${secs}s`;
    }
  }

  function formatDate(dateString) {
    if (!dateString) return '';
    // Parse YYYYMMDD format
    const year = dateString.substr(0, 4);
    const month = dateString.substr(4, 2);
    const day = dateString.substr(6, 2);
    return `${day}/${month}/${year}`;
  }

  // Utility functions for input sanitization
  function sanitizeInput(input) {
    if (typeof input !== 'string') return input;
    return input.trim().replace(/<script[^>]*>.*?<\/script>/gi, '').replace(/<[\/\!]*?[^<>]*?>/gi, '');
  }

  function sanitizeObject(obj) {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        sanitized[key] = sanitizeInput(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  function resetForm() {
    if (!currentItemId) return;
    
    // Get the original item data
    const item = allData[currentItemId];
    
    // Reset only editable form fields to original values
    document.getElementById('realTitle').value = item.real_title || '';
    document.getElementById('realAuthor').value = item.real_author || '';
    document.getElementById('realGenre').value = item.real_genre || '';
    document.getElementById('realContentType').value = item.content_type || '';
    document.getElementById('realLanguage').value = item.real_language || '';
    document.getElementById('realSynopsis').value = item.real_synopsis || '';
    document.getElementById('realPublishedYear').value = item.real_published_year || '';
    document.getElementById('realNarrator').value = item.real_narrator || '';
    
    // Note: Readonly fields (processed, audio_file, summary, transcript) are not reset
    // as they are managed automatically by the system
    
    // Reset YouTube metadata fields (read-only)
    document.getElementById('youtubeUrl').value = item.url || '';
    document.getElementById('originalTitle').value = item.title || '';
    document.getElementById('channelName').value = item.channel_name || '';
    document.getElementById('viewCount').value = item.view_count ? item.view_count.toLocaleString() : '';
    document.getElementById('likeCount').value = item.like_count ? item.like_count.toLocaleString() : '';
    document.getElementById('duration').value = formatDuration(item.duration);
    document.getElementById('uploadDate').value = formatDate(item.upload_date);
    document.getElementById('youtubeDescription').value = item.description || '';
    document.getElementById('thumbnail').value = item.thumbnail || '';
    
    // Reset categories display
    const categoriesDisplay = document.getElementById('categoriesDisplay');
    if (item.categories && item.categories.length > 0) {
      categoriesDisplay.innerHTML = item.categories.map(category => 
        `<span class="badge bg-info me-1 mb-1">${category}</span>`
      ).join('');
    } else {
      categoriesDisplay.innerHTML = '<span class="text-muted">Nessuna categoria</span>';
    }
    
    // Reset tags display
    const tagsDisplay = document.getElementById('tagsDisplay');
    if (item.tags && item.tags.length > 0) {
      tagsDisplay.innerHTML = item.tags.map(tag => 
        `<span class="badge bg-secondary me-1 mb-1">${tag}</span>`
      ).join('');
    } else {
      tagsDisplay.innerHTML = '<span class="text-muted">Nessun tag</span>';
    }
    
    // Reset thumbnail preview
    const thumbnailPreview = document.getElementById('thumbnailPreview');
    if (item.thumbnail) {
      thumbnailPreview.innerHTML = `<img src="${item.thumbnail}" class="img-thumbnail" style="max-width: 120px;" alt="Thumbnail">`;
    } else {
      thumbnailPreview.innerHTML = '<span class="text-muted">Nessuna immagine</span>';
    }
    
    // Update character count
    updateCharacterCount();
    
    // Clear any validation states
    const formElements = document.querySelectorAll('#editForm .form-control, #editForm .form-select');
    formElements.forEach(element => {
      element.classList.remove('is-valid', 'is-invalid');
    });
    
    // Remove feedback messages
    const feedbacks = document.querySelectorAll('#editForm .invalid-feedback, #editForm .valid-feedback');
    feedbacks.forEach(feedback => feedback.remove());
    
    // Show success message
    showToast('Form ripristinato ai valori originali', 'success');
  }

  function validateField(event) {
    const field = event.target;
    const value = field.value.trim();
    const fieldName = field.name || field.id;
    
    // Remove existing feedback
    const existingFeedback = field.parentNode.querySelector('.invalid-feedback, .valid-feedback');
    if (existingFeedback) {
      existingFeedback.remove();
    }
    
    field.classList.remove('is-valid', 'is-invalid');
    
    let isValid = true;
    let message = '';
    
    // Validation rules
    switch (fieldName) {
      case 'real_title':
      case 'realTitle':
        if (field.hasAttribute('required') && !value) {
          isValid = false;
          message = 'Il titolo è obbligatorio';
        } else if (value.length > 200) {
          isValid = false;
          message = 'Il titolo non può superare i 200 caratteri';
        }
        break;
        
      case 'real_author':
      case 'realAuthor':
        if (field.hasAttribute('required') && !value) {
          isValid = false;
          message = 'L\'autore è obbligatorio';
        } else if (value.length > 100) {
          isValid = false;
          message = 'L\'autore non può superare i 100 caratteri';
        }
        break;
        
      case 'real_published_year':
      case 'realPublishedYear':
        if (value && (isNaN(value) || value < 1000 || value > new Date().getFullYear())) {
          isValid = false;
          message = 'Inserire un anno valido';
        }
        break;
        
      case 'real_synopsis':
      case 'realSynopsis':
        if (value.length > 2000) {
          isValid = false;
          message = 'La sinossi non può superare i 2000 caratteri';
        }
        break;
    }
    
    // Apply validation state
    if (isValid) {
      field.classList.add('is-valid');
      if (value) {
        const feedback = document.createElement('div');
        feedback.className = 'valid-feedback';
        feedback.textContent = 'Valore valido';
        field.parentNode.appendChild(feedback);
      }
    } else {
      field.classList.add('is-invalid');
      const feedback = document.createElement('div');
      feedback.className = 'invalid-feedback';
      feedback.textContent = message;
      field.parentNode.appendChild(feedback);
    }
    
    return isValid;
  }

  function updateCharacterCount() {
    const textarea = document.getElementById('realSynopsis');
    const counter = document.getElementById('synopsisCount');
    
    if (textarea && counter) {
      const currentLength = textarea.value.length;
      const maxLength = 2000;
      
      counter.textContent = `${currentLength}/${maxLength}`;
      
      // Update color based on length
      counter.classList.remove('text-warning', 'text-danger');
      if (currentLength > maxLength * 0.9) {
        counter.classList.add('text-danger');
      } else if (currentLength > maxLength * 0.8) {
        counter.classList.add('text-warning');
      }
    }
  }

  function showToast(message, type = 'info') {
    // Create toast element
    const toastContainer = document.getElementById('toastContainer') || createToastContainer();
    
    const toast = document.createElement('div');
    toast.className = `toast align-items-center text-white bg-${type} border-0`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');
    
    toast.innerHTML = `
      <div class="d-flex">
        <div class="toast-body">
          ${message}
        </div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
      </div>
    `;
    
    toastContainer.appendChild(toast);
    
    // Show toast
    const bsToast = new bootstrap.Toast(toast);
    bsToast.show();
    
    // Remove toast after it's hidden
    toast.addEventListener('hidden.bs.toast', () => {
      toast.remove();
    });
  }

  function createToastContainer() {
    const container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container position-fixed top-0 end-0 p-3';
    container.style.zIndex = '9999';
    document.body.appendChild(container);
    return container;
  }

  function undoLastChange() {
    if (undoStack.length === 0) return;
    
    const lastAction = undoStack.pop();
    
    if (lastAction.type === 'update' && lastAction.itemId) {
      // Restore previous data
      allData[lastAction.itemId] = lastAction.previousData;
      
      // Remove from changed items if it exists
      if (changedItems[lastAction.itemId]) {
        delete changedItems[lastAction.itemId];
      }
      
      // Update UI if this item is currently selected
      if (currentItemId === lastAction.itemId) {
        selectItem(lastAction.itemId);
      }
      
      // Update save button
      updateSaveChangesBtn();
      
      // Update list display
      renderItems(filteredData);
      
      showToast('Ultima modifica annullata', 'success');
    }
  }

  // Initialize tooltips for better UX
  function initializeTooltips() {
    // Initialize Bootstrap tooltips
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
      return new bootstrap.Tooltip(tooltipTriggerEl);
    });
    
    // Add custom tooltips to key elements
    const elementsWithTooltips = [
      { selector: '#searchInput', title: 'Cerca per titolo, autore, genere o qualsiasi altro campo. Usa Ctrl+K per focus rapido' },
      { selector: '#genreFilter', title: 'Filtra gli elementi per genere specifico' },
      { selector: '#statusFilter', title: 'Mostra solo elementi processati, in attesa o modificati' },
      { selector: '#saveChangesBtn', title: 'Crea una Pull Request con tutte le modifiche effettuate' },
      { selector: '#bulkEditBtn', title: 'Seleziona più elementi e modificali contemporaneamente' },
      { selector: '#updateItemBtn', title: 'Salva le modifiche all\'elemento selezionato' },
      { selector: '#resetFormBtn', title: 'Ripristina i valori originali dell\'elemento' }
    ];
    
    elementsWithTooltips.forEach(({ selector, title }) => {
      const element = document.querySelector(selector);
      if (element && !element.hasAttribute('title')) {
        element.setAttribute('title', title);
        element.setAttribute('data-bs-toggle', 'tooltip');
        element.setAttribute('data-bs-placement', 'top');
        new bootstrap.Tooltip(element);
      }
    });
  }

  // Override the original showToast function with enhanced version
  window.showToast = showEnhancedToast;

  // Import button event listener (backup for Bootstrap modal trigger)
  importBtn.addEventListener('click', function(e) {
    console.log('Import button clicked');
    e.preventDefault();
    importModal.show();
  });

  // Debug: Check if import button exists and is visible
  console.log('Import button:', importBtn);
  console.log('Import modal:', importModal);

  // Initialize all enhanced features
  setTimeout(() => {
    initializeEnhancedKeyboardNavigation();
    initializeWelcomeModal();
    initializeTooltips();
  }, 1000);
});

// Enhanced navigation behavior and fixes
document.addEventListener('DOMContentLoaded', function() {
  // Enhanced navbar scroll behavior
  const navbar = document.querySelector('.navbar');
  let lastScrollTop = 0;
  
  window.addEventListener('scroll', function() {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    
    if (scrollTop > 20) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
    
    lastScrollTop = scrollTop <= 0 ? 0 : scrollTop;
  });

  // Enhanced mobile navigation
  const navbarToggler = document.querySelector('.navbar-toggler');
  const navbarCollapse = document.querySelector('.navbar-collapse');
  
  if (navbarToggler && navbarCollapse) {
    navbarToggler.addEventListener('click', function() {
      // Add smooth animation class
      navbarCollapse.classList.add('transitioning');
      
      setTimeout(() => {
        navbarCollapse.classList.remove('transitioning');
      }, 350);
    });

    // Close mobile menu when clicking on nav items
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
      link.addEventListener('click', function() {
        if (window.innerWidth < 992) {
          const bsCollapse = bootstrap.Collapse.getInstance(navbarCollapse);
          if (bsCollapse) {
            bsCollapse.hide();
          }
        }
      });
    });
  }

  // Enhanced statistics badge updates with animation
  function updateStatsBadgeWithAnimation(badgeId, value) {
    const badge = document.getElementById(badgeId);
    if (badge) {
      const span = badge.querySelector('span');
      if (span && span.textContent !== value.toString()) {
        badge.classList.add('updated');
        span.textContent = value;
        
        setTimeout(() => {
          badge.classList.remove('updated');
        }, 600);
      }
    }
  }

  // Enhanced save button state management
  function updateSaveButtonState(hasChanges) {
    if (saveChangesBtn && changesIndicator) {
      if (hasChanges) {
        saveChangesBtn.classList.add('has-changes');
        changesIndicator.style.display = 'block';
        changesIndicator.setAttribute('aria-hidden', 'false');
      } else {
        saveChangesBtn.classList.remove('has-changes');
        changesIndicator.style.display = 'none';
        changesIndicator.setAttribute('aria-hidden', 'true');
      }
    }
  }

  // Keyboard navigation improvements
  document.addEventListener('keydown', function(e) {
    // ESC to close mobile menu
    if (e.key === 'Escape' && navbarCollapse && navbarCollapse.classList.contains('show')) {
      const bsCollapse = bootstrap.Collapse.getInstance(navbarCollapse);
      if (bsCollapse) {
        bsCollapse.hide();
      }
    }
    
    // Tab navigation improvements
    if (e.key === 'Tab') {
      // Ensure focus is visible
      document.body.classList.add('keyboard-navigation');
    }
  });

  // Remove keyboard navigation class on mouse use
  document.addEventListener('mousedown', function() {
    document.body.classList.remove('keyboard-navigation');
  });

  // Export functions for use in other scripts
  window.navigationEnhancements = {
    updateStatsBadgeWithAnimation,
    updateSaveButtonState
  };
});