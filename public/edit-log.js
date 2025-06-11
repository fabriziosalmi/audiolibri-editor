document.addEventListener('DOMContentLoaded', function() {
  // Load changes from localStorage
  let changedItems = JSON.parse(localStorage.getItem('changedItems') || '{}');
  let changeHistory = JSON.parse(localStorage.getItem('changeHistory') || '[]');

  // DOM Elements
  const totalChangesCount = document.getElementById('totalChangesCount');
  const modifiedItemsCount = document.getElementById('modifiedItemsCount');
  const lastModifiedTime = document.getElementById('lastModifiedTime');
  const totalChangesCount2 = document.getElementById('totalChangesCount2');
  const readyToSave = document.getElementById('readyToSave');
  const changesLog = document.getElementById('changesLog');
  const noChangesMessage = document.getElementById('noChangesMessage');
  const searchChangesInput = document.getElementById('searchChangesInput');
  const changeTypeFilter = document.getElementById('changeTypeFilter');
  const timeSortFilter = document.getElementById('timeSortFilter');

  // Buttons
  const clearAllChangesBtn = document.getElementById('clearAllChangesBtn');
  const exportChangesBtn = document.getElementById('exportChangesBtn');
  const saveAllChangesBtn = document.getElementById('saveAllChangesBtn');
  const expandAllBtn = document.getElementById('expandAllBtn');
  const collapseAllBtn = document.getElementById('collapseAllBtn');
  const searchChangesBtn = document.getElementById('searchChangesBtn');
  const clearSearchChangesBtn = document.getElementById('clearSearchChangesBtn');

  // Modals
  const changeDetailsModal = new bootstrap.Modal(document.getElementById('changeDetailsModal'));
  const confirmationModal = new bootstrap.Modal(document.getElementById('confirmationModal'));

  // State
  let filteredChanges = [];
  let selectedChangeId = null;

  // Helper function to escape HTML
  function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    str = String(str); // Ensure it's a string
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Initialize page
  updateStatistics();
  renderChanges();

  // Event Listeners
  clearAllChangesBtn.addEventListener('click', () => confirmAction('clear'));
  exportChangesBtn.addEventListener('click', exportChanges);
  saveAllChangesBtn.addEventListener('click', () => confirmAction('save'));
  expandAllBtn.addEventListener('click', expandAllChanges);
  collapseAllBtn.addEventListener('click', collapseAllChanges);
  searchChangesBtn.addEventListener('click', filterChanges); // Changed to filterChanges
  clearSearchChangesBtn.addEventListener('click', clearSearch); // Changed to clearSearch
  searchChangesInput.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') filterChanges();
  });
  changeTypeFilter.addEventListener('change', filterChanges);
  timeSortFilter.addEventListener('change', filterChanges);

  document.getElementById('confirmActionBtn').addEventListener('click', executeConfirmedAction);
  document.getElementById('revertChangeBtn').addEventListener('click', revertSingleChange);

  // Functions
  function updateStatistics() {
    const itemCount = Object.keys(changedItems).length;
    const totalChanges = Object.values(changedItems).reduce((total, changes) => {
      return total + Object.keys(changes).length;
    }, 0);

    const lastModified = changeHistory.length > 0 ?
      new Date(changeHistory[changeHistory.length - 1].timestamp).toLocaleString('it-IT') : '-';

    totalChangesCount.textContent = totalChanges;
    modifiedItemsCount.textContent = itemCount;
    lastModifiedTime.textContent = lastModified;
    totalChangesCount2.textContent = totalChanges;
    readyToSave.textContent = totalChanges > 0 ? 'Sì' : 'No';
    readyToSave.className = totalChanges > 0 ? 'mb-0 text-success' : 'mb-0 text-muted';

    // Update save button state
    saveAllChangesBtn.disabled = totalChanges === 0;
    saveAllChangesBtn.classList.toggle('btn-warning', totalChanges > 0);
    saveAllChangesBtn.classList.toggle('btn-outline-secondary', totalChanges === 0);
  }

  function renderChanges() {
    if (Object.keys(changedItems).length === 0) {
      noChangesMessage.style.display = 'block';
      changesLog.innerHTML = '';
      return;
    }

    noChangesMessage.style.display = 'none';

    // Group changes by item
    const groupedChanges = {};
    changeHistory.forEach(change => {
      if (!groupedChanges[change.itemId]) {
        groupedChanges[change.itemId] = {
          itemTitle: change.itemTitle || `Elemento ${change.itemId}`,
          changes: []
        };
      }
      groupedChanges[change.itemId].changes.push(change);
    });

    // Apply filters and sorting
    filteredChanges = Object.entries(groupedChanges);
    applyFilters();
    applySorting();

    // Render
    changesLog.innerHTML = '';
    filteredChanges.forEach(([itemId, itemData]) => {
      const itemElement = createItemChangeElement(itemId, itemData);
      changesLog.appendChild(itemElement);
    });
  }

  function createItemChangeElement(itemId, itemData) {
    const element = document.createElement('div');
    element.className = 'change-item border-bottom';

    const itemTitleHTML = escapeHTML(itemData.itemTitle);
    const lastModifiedTimeHTML = escapeHTML(new Date(itemData.changes[itemData.changes.length - 1].timestamp).toLocaleString('it-IT'));

    const changesHTML = itemData.changes.map(change => {
      const fieldDisplayNameHTML = escapeHTML(getFieldDisplayName(change.field));
      const timestampHTML = escapeHTML(new Date(change.timestamp).toLocaleString('it-IT'));
      const oldValueHTML = (change.oldValue !== null && change.oldValue !== undefined) ? escapeHTML(change.oldValue) : '<em>vuoto</em>';
      const newValueHTML = (change.newValue !== null && change.newValue !== undefined) ? escapeHTML(change.newValue) : '<em>vuoto</em>';

      return `
              <div class="change-entry p-2 mb-2 bg-light rounded">
                <div class="d-flex justify-content-between align-items-start">
                  <div class="flex-grow-1">
                    <strong class="text-primary">${fieldDisplayNameHTML}</strong>
                    <small class="text-muted d-block">
                      <i class="fas fa-clock me-1"></i>${timestampHTML}
                    </small>
                    <div class="mt-2">
                      <div class="change-values">
                        <div class="old-value">
                          <small class="text-muted">Prima:</small>
                          <div class="value-box bg-danger-subtle p-2 rounded">
                            ${oldValueHTML}
                          </div>
                        </div>
                        <div class="arrow-indicator text-center py-1">
                          <i class="fas fa-arrow-down text-muted"></i>
                        </div>
                        <div class="new-value">
                          <small class="text-muted">Dopo:</small>
                          <div class="value-box bg-success-subtle p-2 rounded">
                            ${newValueHTML}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <button class="btn btn-sm btn-outline-danger ms-2" onclick="revertSingleChangeById('${escapeHTML(change.id)}')">
                    <i class="fas fa-undo"></i>
                  </button>
                </div>
              </div>
            `;
        }).join('');

    element.innerHTML = `
      <div class="p-3">
        <div class="d-flex justify-content-between align-items-center cursor-pointer" data-bs-toggle="collapse" data-bs-target="#item-${escapeHTML(itemId)}">
          <div>
            <h6 class="mb-1">
              <i class="fas fa-book me-2"></i>${itemTitleHTML}
              <span class="badge bg-warning ms-2">${itemData.changes.length} modifiche</span>
            </h6>
            <small class="text-muted">
              <i class="fas fa-clock me-1"></i>
              Ultima modifica: ${lastModifiedTimeHTML}
            </small>
          </div>
          <div class="d-flex gap-2">
            <button class="btn btn-sm btn-outline-info" onclick="viewItemDetails('${escapeHTML(itemId)}')">
              <i class="fas fa-eye"></i>
            </button>
            <button class="btn btn-sm btn-outline-danger" onclick="revertItemChanges('${escapeHTML(itemId)}')">
              <i class="fas fa-undo"></i>
            </button>
            <i class="fas fa-chevron-down"></i>
          </div>
        </div>
        
        <div class="collapse mt-3" id="item-${escapeHTML(itemId)}">
          <div class="change-details">
            ${changesHTML}
          </div>
        </div>
      </div>
    `;
    return element;
  }

  function getFieldDisplayName(field) {
    const fieldNames = {
      'real_title': 'Titolo',
      'real_author': 'Autore',
      'real_genre': 'Genere',
      'real_language': 'Lingua',
      'real_synopsis': 'Sinossi',
      'real_narrator': 'Narratore',
      'real_published_year': 'Anno Pubblicazione',
      'content_type': 'Tipo Contenuto'
    };
    return fieldNames[field] || field;
  }

  function applyFilters() {
    const searchTerm = searchChangesInput.value.toLowerCase();
    const typeFilter = changeTypeFilter.value;

    if (searchTerm || typeFilter) {
      filteredChanges = filteredChanges.filter(([itemId, itemData]) => {
        const matchesSearch = !searchTerm ||
          itemData.itemTitle.toLowerCase().includes(searchTerm) ||
          itemData.changes.some(change =>
            getFieldDisplayName(change.field).toLowerCase().includes(searchTerm) ||
            (change.oldValue && change.oldValue.toLowerCase().includes(searchTerm)) ||
            (change.newValue && change.newValue.toLowerCase().includes(searchTerm))
          );

        const matchesType = !typeFilter || itemData.changes.some(change => {
          switch(typeFilter) {
            case 'title': return change.field === 'real_title';
            case 'author': return change.field === 'real_author';
            case 'genre': return change.field === 'real_genre';
            case 'language': return change.field === 'real_language';
            case 'synopsis': return change.field === 'real_synopsis';
            case 'other': return !['real_title', 'real_author', 'real_genre', 'real_language', 'real_synopsis'].includes(change.field);
            default: return true;
          }
        });

        return matchesSearch && matchesType;
      });
    }
  }

  function applySorting() {
    const sortType = timeSortFilter.value;

    filteredChanges.sort(([, a], [, b]) => {
      const aTime = Math.max(...a.changes.map(c => new Date(c.timestamp).getTime()));
      const bTime = Math.max(...b.changes.map(c => new Date(c.timestamp).getTime()));

      switch(sortType) {
        case 'newest': return bTime - aTime;
        case 'oldest': return aTime - bTime;
        case 'item': return a.itemTitle.localeCompare(b.itemTitle);
        default: return bTime - aTime;
      }
    });
  }

  function filterChanges() {
    renderChanges();
  }

  function clearSearch() {
    searchChangesInput.value = '';
    changeTypeFilter.value = ''; // Assuming default/all value is empty string or 'all'
    renderChanges();
  }

  function expandAllChanges() {
    console.log('Expand all changes');
    const collapseElements = changesLog.querySelectorAll('.collapse');
    collapseElements.forEach(collapseEl => {
      const bsCollapse = bootstrap.Collapse.getInstance(collapseEl) || new bootstrap.Collapse(collapseEl, { toggle: false });
      bsCollapse.show();
    });
  }

  function collapseAllChanges() {
    console.log('Collapse all changes');
    const collapseElements = changesLog.querySelectorAll('.collapse');
    collapseElements.forEach(collapseEl => {
      const bsCollapse = bootstrap.Collapse.getInstance(collapseEl) || new bootstrap.Collapse(collapseEl, { toggle: false });
      bsCollapse.hide();
    });
  }

  function confirmAction(action) {
    const messages = {
      clear: 'Sei sicuro di voler cancellare tutte le modifiche? Questa azione non può essere annullata.',
      save: 'Sei sicuro di voler salvare tutte le modifiche? Verrà creata una Pull Request.'
    };

    document.getElementById('confirmationMessage').textContent = messages[action];
    document.getElementById('confirmActionBtn').setAttribute('data-action', action);
    confirmationModal.show();
  }

  function executeConfirmedAction() {
    const action = document.getElementById('confirmActionBtn').getAttribute('data-action');

    switch(action) {
      case 'clear':
        clearAllChanges();
        break;
      case 'save':
        saveAllChanges();
        break;
    }

    confirmationModal.hide();
  }

  function clearAllChanges() {
    localStorage.removeItem('changedItems');
    localStorage.removeItem('changeHistory');
    changedItems = {};
    changeHistory = [];
    updateStatistics();
    renderChanges();
    showToast('Tutte le modifiche sono state cancellate', 'success');
  }

  function saveAllChanges() {
    // Redirect to main page and trigger save
    localStorage.setItem('triggerSave', 'true');
    window.location.href = 'index.html';
  }

  function exportChanges() {
    const exportData = {
      changedItems,
      changeHistory,
      exportTimestamp: new Date().toISOString(),
      totalItems: Object.keys(changedItems).length,
      totalChanges: Object.values(changedItems).reduce((total, changes) => total + Object.keys(changes).length, 0)
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `audiolibri-modifiche-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);

    showToast('Log modifiche esportato con successo', 'success');
  }

  function revertSingleChangeById(changeId) {
    const changeIndex = changeHistory.findIndex(c => c.id === changeId);
    if (changeIndex === -1) return;

    const change = changeHistory[changeIndex];

    // Remove from changedItems
    if (changedItems[change.itemId] && changedItems[change.itemId][change.field]) {
      delete changedItems[change.itemId][change.field];
      if (Object.keys(changedItems[change.itemId]).length === 0) {
        delete changedItems[change.itemId];
      }
    }

    // Remove from history
    changeHistory.splice(changeIndex, 1);

    // Update localStorage
    localStorage.setItem('changedItems', JSON.stringify(changedItems));
    localStorage.setItem('changeHistory', JSON.stringify(changeHistory));

    updateStatistics();
    renderChanges();
    showToast('Modifica annullata', 'success');
  }

  function revertItemChanges(itemId) {
    // Remove all changes for this item
    delete changedItems[itemId];
    changeHistory = changeHistory.filter(change => change.itemId !== itemId);

    // Update localStorage
    localStorage.setItem('changedItems', JSON.stringify(changedItems));
    localStorage.setItem('changeHistory', JSON.stringify(changeHistory));

    updateStatistics();
    renderChanges();
    showToast('Tutte le modifiche per questo elemento sono state annullate', 'success');
  }

  function viewItemDetails(itemId) {
    // This could open the main editor for this specific item
    window.location.href = `index.html?edit=${itemId}`;
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

  // Global functions for onclick handlers
  window.viewItemDetails = viewItemDetails;
  window.revertItemChanges = revertItemChanges;
  window.revertSingleChangeById = revertSingleChangeById;

  // Auto-refresh if changes are made in another tab
  window.addEventListener('storage', function(e) {
    if (e.key === 'changedItems' || e.key === 'changeHistory') {
      changedItems = JSON.parse(e.newValue || '{}');
      if (e.key === 'changeHistory') {
        changeHistory = JSON.parse(e.newValue || '[]');
      }
      updateStatistics();
      renderChanges();
    }
  });
});
