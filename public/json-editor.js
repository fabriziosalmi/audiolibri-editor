// JSON Editor - Advanced tabular editor for large datasets
class JSONEditor {
  constructor() {
    this.data = [];
    this.filteredData = [];
    this.currentPage = 1;
    this.itemsPerPage = 50;
    this.columns = [];
    this.visibleColumns = [];
    this.hiddenColumns = [];
    this.changedItems = new Map();
    this.sortColumn = null;
    this.sortDirection = 'asc';
    this.filters = {
      global: '',
      column: '',
      value: ''
    };
    this.autoSaveTimeout = null;
    this.editingCell = null;
    this.lastDataHash = null;
    this.monitoringInterval = null;
    this.isMonitoring = false;
    
    // Configurable monitoring settings
    this.monitoringIntervalMinutes = parseInt(localStorage.getItem('monitoringInterval')) || 5; // Default 5 minutes
    this.lastCheckTime = null;
    this.nextCheckTime = null;
    this.countdownInterval = null;
    
    this.selectedItems = new Set(); // Track selected items for bulk operations
    
    this.init();
  }

  async init() {
    try {
      this.showLoading();
      await this.loadData();
      this.setupEventListeners();
      this.startMonitoring();
    } catch (error) {
      console.error('Error initializing JSON Editor:', error);
      this.showError('Errore durante l\'inizializzazione dell\'editor: ' + error.message);
    } finally {
      this.hideLoading();
    }
  }

  async loadData() {
    try {
      console.log('Loading data from /api/data...');
      const response = await fetch('/api/data');
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const rawData = await response.json();
      console.log('Data loaded successfully, processing...');
      
      // Validate data structure
      if (!rawData || typeof rawData !== 'object') {
        throw new Error('Invalid data format received from server');
      }
      
      // Generate hash of the raw data for monitoring
      this.lastDataHash = this.generateDataHash(rawData);
      
      // Convert object to array format with ID preserved
      this.data = Object.entries(rawData).map(([id, item]) => ({
        id,
        ...item
      }));
      
      console.log(`Processed ${this.data.length} items`);
      
      this.extractColumns();
      this.applyFiltersAndSort();
      this.updateUI();
      
      console.log('JSON Editor initialized successfully');
    } catch (error) {
      console.error('Error loading data:', error);
      this.showError('Errore nel caricamento dei dati: ' + error.message);
      
      // Initialize with empty data to prevent complete failure
      this.data = [];
      this.filteredData = [];
      this.extractColumns();
      this.updateUI();
    }
  }

  extractColumns() {
    const allKeys = new Set();
    
    // Extract all possible column names from the data
    this.data.forEach(item => {
      Object.keys(item).forEach(key => allKeys.add(key));
    });

    this.columns = Array.from(allKeys).sort();
    
    // Columns to hide by default
    const hiddenByDefault = [
      'processed', 'view_count', 'like_count', 'duration', 'upload_date', 
      'thumbnail', 'url', 'audio_file', 'summary', 'categories', 'tags', 'description'
    ];
    
    // Enhanced priority columns for audiolibri data - only visible columns
    const priorityColumns = [
      'id', 'real_title', 'real_author', 'real_genre', 'content_type', 
      'real_language', 'real_published_year', 'real_narrator'
    ];
    
    this.visibleColumns = priorityColumns.filter(col => this.columns.includes(col));
    
    // Add remaining important columns that are not hidden by default
    const importantColumns = [
      'title', 'channel_name', 'real_synopsis'
    ];
    
    importantColumns.forEach(col => {
      if (this.columns.includes(col) && !this.visibleColumns.includes(col)) {
        this.visibleColumns.push(col);
      }
    });
    
    // Add remaining columns if we have space (limit to 15 initially for better UX)
    // Exclude columns that should be hidden by default
    const remainingColumns = this.columns.filter(col => 
      !this.visibleColumns.includes(col) && 
      !hiddenByDefault.includes(col) &&
      !['transcript'].includes(col) // Hide very long text fields by default
    );
    
    while (this.visibleColumns.length < 15 && remainingColumns.length > 0) {
      this.visibleColumns.push(remainingColumns.shift());
    }
    
    this.hiddenColumns = this.columns.filter(col => !this.visibleColumns.includes(col));
    
    this.populateColumnSelectors();
  }

  populateColumnSelectors() {
    const filterColumnSelect = document.getElementById('filterColumn');
    const sortColumnSelect = document.getElementById('sortColumn');
    
    // Clear existing options
    filterColumnSelect.innerHTML = '<option value="">Tutte le colonne</option>';
    sortColumnSelect.innerHTML = '<option value="">Nessun ordinamento</option>';
    
    // Add column options
    this.columns.forEach(column => {
      const filterOption = new Option(this.formatColumnName(column), column);
      const sortOption = new Option(this.formatColumnName(column), column);
      filterColumnSelect.appendChild(filterOption);
      sortColumnSelect.appendChild(sortOption);
    });
  }

  formatColumnName(column) {
    return column.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  setupEventListeners() {
    // Pagination
    document.getElementById('itemsPerPage').addEventListener('change', (e) => {
      this.itemsPerPage = parseInt(e.target.value);
      this.currentPage = 1;
      this.renderTable();
      this.renderPagination();
    });

    // Filters
    document.getElementById('searchGlobal').addEventListener('input', this.debounce((e) => {
      this.filters.global = e.target.value.toLowerCase();
      this.applyFiltersAndSort();
    }, 300));

    document.getElementById('filterColumn').addEventListener('change', (e) => {
      this.filters.column = e.target.value;
      this.applyFiltersAndSort();
    });

    document.getElementById('filterValue').addEventListener('input', this.debounce((e) => {
      this.filters.value = e.target.value.toLowerCase();
      this.applyFiltersAndSort();
    }, 300));

    document.getElementById('clearFiltersBtn').addEventListener('click', () => {
      this.clearFilters();
    });

    // Sorting
    document.getElementById('sortColumn').addEventListener('change', (e) => {
      this.sortColumn = e.target.value;
      this.applyFiltersAndSort();
    });

    document.getElementById('sortDirection').addEventListener('change', (e) => {
      this.sortDirection = e.target.value;
      this.applyFiltersAndSort();
    });

    // Column management
    document.getElementById('columnsToggleBtn').addEventListener('click', () => {
      this.openColumnsModal();
    });

    document.getElementById('applyColumnsBtn').addEventListener('click', () => {
      this.applyColumnChanges();
    });

    // Save functionality
    document.getElementById('saveAllBtn').addEventListener('click', () => {
      this.saveChanges();
    });

    document.getElementById('saveChangesNowBtn').addEventListener('click', () => {
      this.saveChanges();
    });

    document.getElementById('discardChangesBtn').addEventListener('click', () => {
      this.discardChanges();
    });

    // Export
    document.getElementById('exportCurrentPageBtn').addEventListener('click', () => {
      this.exportCurrentPage();
    });

    // Add row
    document.getElementById('addRowBtn').addEventListener('click', () => {
      this.addNewRow();
    });

    // Select all functionality
    document.getElementById('selectAllBtn').addEventListener('click', () => {
      this.selectAllItems();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      this.handleKeyboard(e);
    });

    // Auto-save when data changes
    document.addEventListener('cellChanged', () => {
      this.scheduleAutoSave();
    });
  }

  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  applyFiltersAndSort() {
    let filtered = [...this.data];

    // Apply global search
    if (this.filters.global) {
      filtered = filtered.filter(item => {
        return Object.values(item).some(value => {
          if (value === null || value === undefined) return false;
          return String(value).toLowerCase().includes(this.filters.global);
        });
      });
    }

    // Apply column filter
    if (this.filters.column && this.filters.value) {
      filtered = filtered.filter(item => {
        const value = item[this.filters.column];
        if (value === null || value === undefined) return false;
        return String(value).toLowerCase().includes(this.filters.value);
      });
    }

    // Apply sorting
    if (this.sortColumn) {
      filtered.sort((a, b) => {
        const aVal = a[this.sortColumn];
        const bVal = b[this.sortColumn];
        
        // Handle null/undefined values
        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;
        
        // Numeric sorting
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return this.sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
        }
        
        // String sorting
        const aStr = String(aVal).toLowerCase();
        const bStr = String(bVal).toLowerCase();
        
        if (this.sortDirection === 'asc') {
          return aStr < bStr ? -1 : aStr > bStr ? 1 : 0;
        } else {
          return aStr > bStr ? -1 : aStr < bStr ? 1 : 0;
        }
      });
    }

    this.filteredData = filtered;
    this.currentPage = 1; // Reset to first page when filtering
    this.updateUI();
  }

  updateUI() {
    this.updateStatistics();
    this.renderTable();
    this.renderPagination();
    this.updateChangesPanel();
  }

  renderPagination() {
    const totalItems = this.filteredData.length;
    const totalPages = Math.ceil(totalItems / this.itemsPerPage);
    const paginationContainer = document.getElementById('paginationContainer');
    
    if (!paginationContainer) return;
    
    if (totalPages <= 1) {
      paginationContainer.innerHTML = '';
      return;
    }
    
    let paginationHTML = '<nav><ul class="pagination justify-content-center">';
    
    // Previous button
    paginationHTML += `
      <li class="page-item ${this.currentPage === 1 ? 'disabled' : ''}">
        <a class="page-link" href="#" onclick="window.jsonEditor.goToPage(${this.currentPage - 1})" ${this.currentPage === 1 ? 'tabindex="-1"' : ''}>
          <i class="fas fa-chevron-left"></i>
        </a>
      </li>
    `;
    
    // Page numbers
    const startPage = Math.max(1, this.currentPage - 2);
    const endPage = Math.min(totalPages, this.currentPage + 2);
    
    if (startPage > 1) {
      paginationHTML += `<li class="page-item"><a class="page-link" href="#" onclick="window.jsonEditor.goToPage(1)">1</a></li>`;
      if (startPage > 2) {
        paginationHTML += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
      }
    }
    
    for (let i = startPage; i <= endPage; i++) {
      paginationHTML += `
        <li class="page-item ${i === this.currentPage ? 'active' : ''}">
          <a class="page-link" href="#" onclick="window.jsonEditor.goToPage(${i})">${i}</a>
        </li>
      `;
    }
    
    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        paginationHTML += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
      }
      paginationHTML += `<li class="page-item"><a class="page-link" href="#" onclick="window.jsonEditor.goToPage(${totalPages})">${totalPages}</a></li>`;
    }
    
    // Next button
    paginationHTML += `
      <li class="page-item ${this.currentPage === totalPages ? 'disabled' : ''}">
        <a class="page-link" href="#" onclick="window.jsonEditor.goToPage(${this.currentPage + 1})" ${this.currentPage === totalPages ? 'tabindex="-1"' : ''}>
          <i class="fas fa-chevron-right"></i>
        </a>
      </li>
    `;
    
    paginationHTML += '</ul></nav>';
    paginationContainer.innerHTML = paginationHTML;
  }

  goToPage(page) {
    const totalPages = Math.ceil(this.filteredData.length / this.itemsPerPage);
    if (page < 1 || page > totalPages) return;
    
    this.currentPage = page;
    this.renderTable();
    this.renderPagination();
  }

  updateStatistics() {
    document.getElementById('totalItemsCount').textContent = this.data.length;
    document.getElementById('currentPageItems').textContent = this.getCurrentPageData().length;
    document.getElementById('modifiedCount').textContent = this.changedItems.size;
    document.getElementById('columnsCount').textContent = this.visibleColumns.length;
    
    // Update monitoring status
    const monitoringStatusEl = document.getElementById('monitoringStatus');
    if (monitoringStatusEl) {
      if (this.isMonitoring) {
        monitoringStatusEl.innerHTML = '<i class="fas fa-circle text-success"></i>';
        monitoringStatusEl.title = `Monitoraggio attivo (ogni ${this.monitoringIntervalMinutes} minuti)`;
      } else {
        monitoringStatusEl.innerHTML = '<i class="fas fa-circle text-secondary"></i>';
        monitoringStatusEl.title = 'Monitoraggio disattivato';
      }
    }
  }

  getCurrentPageData() {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    return this.filteredData.slice(startIndex, endIndex);
  }

  renderTable() {
    const table = document.getElementById('jsonTable');
    const thead = document.getElementById('tableHeader');
    const tbody = document.getElementById('tableBody');

    // Clear existing content
    thead.innerHTML = '';
    tbody.innerHTML = '';

    // Render header
    const headerRow = document.createElement('tr');
    this.visibleColumns.forEach(column => {
      const th = document.createElement('th');
      th.className = 'column-header';
      th.innerHTML = `
        <div>
          ${this.formatColumnName(column)}
          <div class="column-controls">
            <small class="text-muted">${column}</small>
          </div>
        </div>
      `;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);

    // Render body
    const currentData = this.getCurrentPageData();
    currentData.forEach((item, rowIndex) => {
      const row = document.createElement('tr');
      const itemId = item.id || rowIndex;
      
      // Add row selection functionality
      row.addEventListener('click', (e) => {
        // Only handle row selection if not clicking on a cell for editing
        if (e.target.classList.contains('editable-cell') || e.target.closest('.editable-cell')) {
          return; // Let cell editing handle this
        }
        
        if (e.ctrlKey || e.metaKey) {
          // Toggle selection
          if (this.selectedItems.has(itemId)) {
            this.selectedItems.delete(itemId);
          } else {
            this.selectedItems.add(itemId);
          }
        } else {
          // Single selection
          this.selectedItems.clear();
          this.selectedItems.add(itemId);
        }
        
        this.updateSelectionUI();
      });
      
      this.visibleColumns.forEach(column => {
        const td = document.createElement('td');
        const cellValue = item[column];
        const cellType = this.getValueType(cellValue);
        
        td.className = 'editable-cell';
        td.dataset.row = rowIndex;
        td.dataset.column = column;
        td.dataset.itemId = itemId;
        
        td.innerHTML = `
          <span class="cell-type-indicator type-${cellType}">${cellType.toUpperCase().substring(0, 3)}</span>
          <div class="cell-content">${this.formatCellValue(cellValue, column)}</div>
        `;
        
        // Add click listener for editing (with event stopPropagation to prevent row selection)
        td.addEventListener('click', (e) => {
          e.stopPropagation();
          this.startCellEdit(td, item, column);
        });
        
        row.appendChild(td);
      });
      
      tbody.appendChild(row);
    });

    // Update selection UI after rendering
    this.updateSelectionUI();

    // Update page info
    const totalPages = Math.ceil(this.filteredData.length / this.itemsPerPage);
    document.getElementById('pageInfo').textContent = `Pagina ${this.currentPage} di ${totalPages}`;
  }

  getValueType(value) {
    if (value === null) return 'null';
    if (value === undefined) return 'null';
    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'number') return 'number';
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'object') return 'object';
    return 'string';
  }

  // Enhanced formatting for audiolibri-specific data
  formatCellValue(value, column) {
    if (value === null || value === undefined) {
      return '<span class="text-muted">—</span>';
    }

    // Handle specific column types for audiolibri data
    switch (column) {
      case 'processed':
        return value ? 
          '<span class="badge bg-success">Processato</span>' : 
          '<span class="badge bg-warning">Non Processato</span>';
          
      case 'view_count':
      case 'like_count':
        return typeof value === 'number' ? value.toLocaleString() : value;
        
      case 'duration':
        if (typeof value === 'number') {
          return this.formatDuration(value);
        }
        return value;
        
      case 'upload_date':
        if (typeof value === 'string' && value.length === 8) {
          return this.formatDate(value);
        }
        return value;
        
      case 'thumbnail':
      case 'url':
        if (typeof value === 'string' && value.startsWith('http')) {
          const displayText = column === 'thumbnail' ? '🖼️ Immagine' : '🔗 Link';
          return `<a href="${value}" target="_blank" class="text-decoration-none">${displayText}</a>`;
        }
        return value;
        
      case 'categories':
      case 'tags':
        if (Array.isArray(value)) {
          const badgeColor = column === 'categories' ? 'info' : 'secondary';
          return value.map(item => 
            `<span class="badge bg-${badgeColor} me-1">${item}</span>`
          ).join('');
        }
        return Array.isArray(value) ? value.join(', ') : value;
        
      case 'real_synopsis':
      case 'description':
      case 'summary':
      case 'transcript':
        if (typeof value === 'string' && value.length > 100) {
          const truncated = value.substring(0, 100) + '...';
          return `<span title="${this.escapeHtml(value)}">${this.escapeHtml(truncated)}</span>`;
        }
        return this.escapeHtml(String(value));
        
      case 'real_published_year':
        return typeof value === 'number' ? value : value;
        
      default:
        if (typeof value === 'object') {
          return `<code>${JSON.stringify(value, null, 2)}</code>`;
        }
        return this.escapeHtml(String(value));
    }
  }

  // Utility functions for enhanced formatting
  formatDuration(seconds) {
    if (!seconds || typeof seconds !== 'number') return seconds;
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m ${secs}s`;
    }
  }

  formatDate(dateString) {
    if (!dateString || typeof dateString !== 'string' || dateString.length !== 8) {
      return dateString;
    }
    
    // Parse YYYYMMDD format
    const year = dateString.substr(0, 4);
    const month = dateString.substr(4, 2);
    const day = dateString.substr(6, 2);
    return `${day}/${month}/${year}`;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Enhanced cell editing for specific data types
  startCellEdit(td, item, column) {
    if (this.editingCell) {
      this.finishCellEdit();
    }

    this.editingCell = td;
    td.classList.add('editing');

    const currentValue = item[column];
    let displayValue = currentValue === null || currentValue === undefined ? '' : currentValue;
    
    // Handle special data types
    if (typeof currentValue === 'object') {
      displayValue = JSON.stringify(currentValue, null, 2);
    } else {
      displayValue = String(currentValue);
    }

    // Create appropriate editor based on column type
    let editor;
    
    switch (column) {
      case 'processed':
        editor = document.createElement('select');
        editor.className = 'form-select cell-editor';
        editor.innerHTML = `
          <option value="false" ${!currentValue ? 'selected' : ''}>Non Processato</option>
          <option value="true" ${currentValue ? 'selected' : ''}>Processato</option>
        `;
        break;
        
      case 'real_genre':
        editor = document.createElement('select');
        editor.className = 'form-select cell-editor';
        editor.innerHTML = '<option value="">Seleziona genere...</option>';
        
        // Get unique genres from data for dropdown
        const genres = new Set();
        this.data.forEach(item => {
          if (item.real_genre) {
            genres.add(item.real_genre);
          }
        });
        
        Array.from(genres).sort().forEach(genre => {
          const option = document.createElement('option');
          option.value = genre;
          option.textContent = genre;
          option.selected = genre === currentValue;
          editor.appendChild(option);
        });
        break;
        
      case 'content_type':
        editor = document.createElement('select');
        editor.className = 'form-select cell-editor';
        editor.innerHTML = `
          <option value="">Seleziona tipo...</option>
          <option value="audiobook" ${currentValue === 'audiobook' ? 'selected' : ''}>Audiolibro</option>
          <option value="story" ${currentValue === 'story' ? 'selected' : ''}>Racconto</option>
          <option value="novel" ${currentValue === 'novel' ? 'selected' : ''}>Romanzo</option>
          <option value="poetry" ${currentValue === 'poetry' ? 'selected' : ''}>Poesia</option>
        `;
        break;
        
      case 'real_language':
        editor = document.createElement('select');
        editor.className = 'form-select cell-editor';
        editor.innerHTML = `
          <option value="">Seleziona lingua...</option>
          <option value="it" ${currentValue === 'it' ? 'selected' : ''}>Italiano</option>
          <option value="en" ${currentValue === 'en' ? 'selected' : ''}>Inglese</option>
          <option value="fr" ${currentValue === 'fr' ? 'selected' : ''}>Francese</option>
          <option value="de" ${currentValue === 'de' ? 'selected' : ''}>Tedesco</option>
          <option value="es" ${currentValue === 'es' ? 'selected' : ''}>Spagnolo</option>
        `;
        break;
        
      case 'real_synopsis':
      case 'description':
      case 'summary':
      case 'transcript':
        editor = document.createElement('textarea');
        editor.className = 'form-control cell-editor';
        editor.value = displayValue;
        editor.rows = 4;
        break;
        
      case 'real_published_year':
        editor = document.createElement('input');
        editor.type = 'number';
        editor.className = 'form-control cell-editor';
        editor.value = displayValue;
        editor.min = '1000';
        editor.max = new Date().getFullYear();
        break;
        
      case 'categories':
      case 'tags':
        editor = document.createElement('textarea');
        editor.className = 'form-control cell-editor';
        editor.value = Array.isArray(currentValue) ? currentValue.join(', ') : displayValue;
        editor.rows = 2;
        editor.placeholder = 'Inserisci elementi separati da virgola';
        break;
        
      default:
        editor = document.createElement('textarea');
        editor.className = 'form-control cell-editor';
        editor.value = displayValue;
        if (displayValue.length > 100) {
          editor.rows = 3;
        }
    }
    
    // Replace cell content with editor
    const cellContent = td.querySelector('.cell-content');
    cellContent.style.display = 'none';
    td.appendChild(editor);
    
    editor.focus();
    if (editor.select) editor.select();

    // Handle editor events
    editor.addEventListener('blur', () => this.finishCellEdit());
    editor.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && editor.tagName !== 'TEXTAREA') {
        e.preventDefault();
        this.finishCellEdit();
      }
      if (e.key === 'Escape') {
        this.cancelCellEdit();
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        this.finishCellEdit();
        this.moveToNextCell(e.shiftKey);
      }
    });

    // Auto-resize textarea
    if (editor.tagName === 'TEXTAREA') {
      editor.style.height = 'auto';
      editor.style.height = (editor.scrollHeight) + 'px';
      
      // Auto-resize on input
      editor.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
      });
    }
  }

  // Enhanced value parsing for specific data types
  parseValue(stringValue, column) {
    if (stringValue === '' || stringValue === 'null') return null;
    
    // Handle specific column types
    switch (column) {
      case 'processed':
        return stringValue === 'true';
        
      case 'real_published_year':
      case 'view_count':
      case 'like_count':
      case 'duration':
        const numberValue = Number(stringValue);
        return !isNaN(numberValue) && isFinite(numberValue) ? numberValue : stringValue;
        
      case 'categories':
      case 'tags':
        if (typeof stringValue === 'string') {
          return stringValue.split(',').map(item => item.trim()).filter(item => item);
        }
        return stringValue;
        
      default:
        if (stringValue === 'true') return true;
        if (stringValue === 'false') return false;
        
        // Try to parse as number
        const numberVal = Number(stringValue);
        if (!isNaN(numberVal) && isFinite(numberVal)) {
          return numberVal;
        }
        
        // Try to parse as JSON (for objects/arrays)
        try {
          return JSON.parse(stringValue);
        } catch {
          // Return as string
          return stringValue;
        }
    }
  }

  // Missing navigation function
  moveToNextCell(reverse = false) {
    if (!this.editingCell) return;
    
    const currentRow = parseInt(this.editingCell.dataset.row);
    const currentColumnIndex = this.visibleColumns.indexOf(this.editingCell.dataset.column);
    
    let nextRow = currentRow;
    let nextColumnIndex = currentColumnIndex;
    
    if (reverse) {
      // Move to previous cell
      nextColumnIndex--;
      if (nextColumnIndex < 0) {
        nextColumnIndex = this.visibleColumns.length - 1;
        nextRow--;
      }
    } else {
      // Move to next cell
      nextColumnIndex++;
      if (nextColumnIndex >= this.visibleColumns.length) {
        nextColumnIndex = 0;
        nextRow++;
      }
    }
    
    // Check if we're within bounds
    const currentPageData = this.getCurrentPageData();
    if (nextRow >= 0 && nextRow < currentPageData.length) {
      const nextCell = document.querySelector(`[data-row="${nextRow}"][data-column="${this.visibleColumns[nextColumnIndex]}"]`);
      if (nextCell) {
        const nextItem = currentPageData[nextRow];
        setTimeout(() => {
          this.startCellEdit(nextCell, nextItem, this.visibleColumns[nextColumnIndex]);
        }, 50);
      }
    }
  }

  discardChanges() {
    if (confirm('Sei sicuro di voler scartare tutte le modifiche non salvate?')) {
      this.changedItems.clear();
      this.loadData(); // Reload original data
      this.updateChangesPanel();
    }
  }

  // Cleanup function to prevent memory leaks
  cleanup() {
    // Clear intervals
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
    
    if (this.autoSaveTimeout) {
      clearTimeout(this.autoSaveTimeout);
      this.autoSaveTimeout = null;
    }
    
    // Remove event listeners
    document.removeEventListener('keydown', this.handleKeyboard);
    document.removeEventListener('cellChanged', this.scheduleAutoSave);
    
    // Clear editing state
    if (this.editingCell) {
      this.cancelCellEdit();
    }
    
    console.log('JSON Editor cleanup completed');
  }

  clearFilters() {
    this.filters = { global: '', column: '', value: '' };
    document.getElementById('searchGlobal').value = '';
    document.getElementById('filterColumn').value = '';
    document.getElementById('filterValue').value = '';
    document.getElementById('sortColumn').value = '';
    this.sortColumn = null;
    this.applyFiltersAndSort();
  }

  openColumnsModal() {
    const modal = new bootstrap.Modal(document.getElementById('columnsModal'));
    this.renderColumnManagement();
    modal.show();
  }

  renderColumnManagement() {
    const visibleContainer = document.getElementById('visibleColumns');
    const hiddenContainer = document.getElementById('hiddenColumns');
    
    visibleContainer.innerHTML = '';
    hiddenContainer.innerHTML = '';
    
    // Render visible columns
    this.visibleColumns.forEach(column => {
      const columnItem = this.createColumnItem(column, true);
      visibleContainer.appendChild(columnItem);
    });
    
    // Render hidden columns
    this.hiddenColumns.forEach(column => {
      const columnItem = this.createColumnItem(column, false);
      hiddenContainer.appendChild(columnItem);
    });
    
    // Make sortable
    new Sortable(visibleContainer, {
      group: 'columns',
      animation: 150
    });
    
    new Sortable(hiddenContainer, {
      group: 'columns',
      animation: 150
    });
  }

  createColumnItem(column, isVisible) {
    const item = document.createElement('div');
    item.className = `p-2 mb-2 bg-light border rounded d-flex justify-content-between align-items-center ${isVisible ? 'border-primary' : ''}`;
    item.dataset.column = column;
    item.innerHTML = `
      <span>
        <strong>${this.formatColumnName(column)}</strong>
        <br><small class="text-muted">${column}</small>
      </span>
      <i class="fas fa-grip-vertical text-muted"></i>
    `;
    return item;
  }

  applyColumnChanges() {
    const visibleContainer = document.getElementById('visibleColumns');
    const hiddenContainer = document.getElementById('hiddenColumns');
    
    this.visibleColumns = Array.from(visibleContainer.children).map(item => item.dataset.column);
    this.hiddenColumns = Array.from(hiddenContainer.children).map(item => item.dataset.column);
    
    this.populateColumnSelectors();
    this.renderTable();
    
    const modal = bootstrap.Modal.getInstance(document.getElementById('columnsModal'));
    modal.hide();
  }

  addNewRow() {
    const newItem = { id: Date.now() }; // Temporary ID
    this.visibleColumns.forEach(column => {
      if (column !== 'id') {
        newItem[column] = null;
      }
    });
    
    this.data.unshift(newItem);
    this.applyFiltersAndSort();
    
    // Highlight the new row
    setTimeout(() => {
      const firstCell = document.querySelector('[data-row="0"]');
      if (firstCell) {
        firstCell.click();
      }
    }, 100);
  }

  exportCurrentPage() {
    const currentData = this.getCurrentPageData();
    const exportData = currentData.map(item => {
      const filteredItem = {};
      this.visibleColumns.forEach(column => {
        filteredItem[column] = item[column];
      });
      return filteredItem;
    });
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `audiolibri-page-${this.currentPage}.json`;
    link.click();
  }

  handleKeyboard(e) {
    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case 's':
          e.preventDefault();
          this.saveChanges();
          break;
        case 'f':
          e.preventDefault();
          document.getElementById('searchGlobal').focus();
          break;
        case 'z':
          if (!this.editingCell) {
            e.preventDefault();
            this.undoLastChange();
          }
          break;
        case 'a':
          if (!this.editingCell) {
            e.preventDefault();
            this.selectAllItems();
          }
          break;
      }
    }
    
    if (e.key === 'Escape') {
      if (this.editingCell) {
        this.cancelCellEdit();
      } else if (this.selectedItems.size > 0) {
        this.clearSelection();
      }
    }
    
    if (e.key === 'Delete' && this.selectedItems.size > 0 && !this.editingCell) {
      e.preventDefault();
      this.bulkDelete();
    }
    
    // Page navigation
    if (!this.editingCell) {
      if (e.key === 'PageDown') {
        e.preventDefault();
        this.goToPage(this.currentPage + 1);
      } else if (e.key === 'PageUp') {
        e.preventDefault();
        this.goToPage(this.currentPage - 1);
      } else if (e.key === 'Home') {
        e.preventDefault();
        this.goToPage(1);
      } else if (e.key === 'End') {
        e.preventDefault();
        const totalPages = Math.ceil(this.filteredData.length / this.itemsPerPage);
        this.goToPage(totalPages);
      }
    }
  }

  undoLastChange() {
    if (this.changedItems.size === 0) return;
    
    // Get the last changed item
    const lastItemId = Array.from(this.changedItems.keys()).pop();
    const itemChanges = this.changedItems.get(lastItemId);
    const lastField = Array.from(itemChanges.keys()).pop();
    const lastChange = itemChanges.get(lastField);
    
    // Revert the change
    const item = this.data.find(item => (item.id || this.data.indexOf(item)) == lastItemId);
    if (item) {
      item[lastField] = lastChange.old;
      itemChanges.delete(lastField);
      
      if (itemChanges.size === 0) {
        this.changedItems.delete(lastItemId);
      }
      
      this.renderTable();
      this.updateChangesPanel();
    }
  }

  showSaveIndicator() {
    const indicator = document.getElementById('saveIndicator');
    indicator.classList.add('show');
    setTimeout(() => {
      indicator.classList.remove('show');
    }, 2000);
  }

  showLoading() {
    document.getElementById('loadingOverlay').style.display = 'flex';
  }

  hideLoading() {
    document.getElementById('loadingOverlay').style.display = 'none';
  }

  showError(message) {
    // Create or update error toast
    let errorToast = document.getElementById('errorToast');
    if (!errorToast) {
      errorToast = document.createElement('div');
      errorToast.id = 'errorToast';
      errorToast.className = 'toast position-fixed top-0 end-0 m-3';
      errorToast.style.zIndex = '9999';
      errorToast.innerHTML = `
        <div class="toast-header bg-danger text-white">
          <i class="fas fa-exclamation-triangle me-2"></i>
          <strong class="me-auto">Errore</strong>
          <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast"></button>
        </div>
        <div class="toast-body" id="errorToastBody">
          ${message}
        </div>
      `;
      document.body.appendChild(errorToast);
    } else {
      document.getElementById('errorToastBody').textContent = message;
    }
    
    const toast = new bootstrap.Toast(errorToast);
    toast.show();
  }

  showSuccessMessage(message) {
    // Create or update success toast
    let successToast = document.getElementById('successToast');
    if (!successToast) {
      successToast = document.createElement('div');
      successToast.id = 'successToast';
      successToast.className = 'toast position-fixed top-0 end-0 m-3';
      successToast.style.zIndex = '9999';
      successToast.innerHTML = `
        <div class="toast-header bg-success text-white">
          <i class="fas fa-check-circle me-2"></i>
          <strong class="me-auto">Successo</strong>
          <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast"></button>
        </div>
        <div class="toast-body" id="successToastBody">
          ${message}
        </div>
      `;
      document.body.appendChild(successToast);
    } else {
      document.getElementById('successToastBody').innerHTML = message;
    }
    
    const toast = new bootstrap.Toast(successToast);
    toast.show();
 }
  finishCellEdit() {
    if (!this.editingCell) return;

    const editor = this.editingCell.querySelector('.cell-editor');
    const cellContent = this.editingCell.querySelector('.cell-content');
    
    if (editor) {
      const column = this.editingCell.dataset.column;
      const newValue = this.parseValue(editor.value, column);
      const itemId = this.editingCell.dataset.itemId;
      
      // Update data
      this.updateItemValue(itemId, column, newValue);
      
      // Update display with enhanced formatting
      cellContent.innerHTML = this.formatCellValue(newValue, column);
      cellContent.style.display = 'block';
      editor.remove();
    }

    this.editingCell.classList.remove('editing');
    this.editingCell = null;

    // Dispatch change event for auto-save
    document.dispatchEvent(new CustomEvent('cellChanged'));
  }

  cancelCellEdit() {
    if (!this.editingCell) return;

    const editor = this.editingCell.querySelector('.cell-editor');
    const cellContent = this.editingCell.querySelector('.cell-content');
    
    if (editor) {
      cellContent.style.display = 'block';
      editor.remove();
    }

    this.editingCell.classList.remove('editing');
    this.editingCell = null;
  }

  // Data validation functionality
  validateCellValue(value, column, itemId) {
    const errors = [];
    
    // Column-specific validation
    switch (column) {
      case 'real_published_year':
        if (value !== null && value !== undefined) {
          const year = parseInt(value);
          if (isNaN(year) || year < 0 || year > new Date().getFullYear() + 10) {
            errors.push(`Anno di pubblicazione non valido: ${value}`);
          }
        }
        break;
        
      case 'view_count':
      case 'like_count':
      case 'duration':
        if (value !== null && value !== undefined) {
          const num = parseFloat(value);
          if (isNaN(num) || num < 0) {
            errors.push(`${this.formatColumnName(column)} deve essere un numero positivo`);
          }
        }
        break;
        
      case 'real_language':
        if (value && typeof value === 'string') {
          const validLanguages = ['it', 'en', 'fr', 'de', 'es', 'pt', 'ru', 'ja', 'zh', 'ar'];
          if (!validLanguages.includes(value.toLowerCase())) {
            errors.push(`Codice lingua non riconosciuto: ${value}`);
          }
        }
        break;
        
      case 'url':
      case 'thumbnail':
        if (value && typeof value === 'string') {
          try {
            new URL(value);
          } catch {
            errors.push(`URL non valido: ${value}`);
          }
        }
        break;
        
      case 'categories':
      case 'tags':
        if (Array.isArray(value)) {
          if (value.some(item => typeof item !== 'string' || item.trim() === '')) {
            errors.push(`${this.formatColumnName(column)} devono essere stringhe non vuote`);
          }
        }
        break;
    }
    
    return errors;
  }

  // Enhanced error display with validation
  showValidationErrors(errors, column) {
    if (errors.length === 0) return;
    
    const errorMessages = errors.map(error => `• ${error}`).join('<br>');
    
    // Create validation error toast
    let validationToast = document.getElementById('validationToast');
    if (!validationToast) {
      validationToast = document.createElement('div');
      validationToast.id = 'validationToast';
      validationToast.className = 'toast position-fixed top-0 end-0 m-3';
      validationToast.style.zIndex = '9999';
      validationToast.innerHTML = `
        <div class="toast-header bg-warning text-dark">
          <i class="fas fa-exclamation-triangle me-2"></i>
          <strong class="me-auto">Errore di Validazione</strong>
          <button type="button" class="btn-close" data-bs-dismiss="toast"></button>
        </div>
        <div class="toast-body" id="validationToastBody">
          ${errorMessages}
        </div>
      `;
      document.body.appendChild(validationToast);
    } else {
      document.getElementById('validationToastBody').innerHTML = errorMessages;
    }
    
    const toast = new bootstrap.Toast(validationToast, { delay: 5000 });
    toast.show();
  }

  updateItemValue(itemId, column, newValue) {
    // Find the item in data
    const item = this.data.find(item => (item.id || this.data.indexOf(item)) == itemId);
    
    if (item) {
      const oldValue = item[column];
      
      // Validate the new value
      const validationErrors = this.validateCellValue(newValue, column, itemId);
      if (validationErrors.length > 0) {
        this.showValidationErrors(validationErrors, column);
        return false; // Validation failed
      }
      
      // Only proceed if value actually changed
      if (oldValue !== newValue) {
        // Store change for undo/tracking
        if (!this.changedItems.has(itemId)) {
          this.changedItems.set(itemId, new Map());
        }
        
        const itemChanges = this.changedItems.get(itemId);
        if (!itemChanges.has(column)) {
          itemChanges.set(column, { old: oldValue, new: newValue });
        } else {
          // Update the new value, keep original old value
          itemChanges.get(column).new = newValue;
        }
        
        // Update the actual data
        item[column] = newValue;
        
        // Update UI indicators
        this.updateChangesPanel();
        
        return true; // Success
      }
      
      return true; // No change needed
    }
    
    return false; // Item not found
  }

  updateChangesPanel() {
    const changesPanel = document.getElementById('changesPanel');
    const changesCount = document.getElementById('changesCount');
    
    if (this.changedItems.size > 0) {
      changesCount.textContent = this.changedItems.size;
      changesPanel.classList.add('show');
      
      // Update save buttons state
      this.updateSaveButtonsState(true);
    } else {
      changesPanel.classList.remove('show');
      
      // Update save buttons state
      this.updateSaveButtonsState(false);
    }
    
    // Update statistics
    this.updateStatistics();
  }

  updateSaveButtonsState(hasChanges) {
    const saveAllBtn = document.getElementById('saveAllBtn');
    const saveChangesNowBtn = document.getElementById('saveChangesNowBtn');
    
    if (saveAllBtn) {
      if (hasChanges) {
        saveAllBtn.innerHTML = `<i class="fas fa-save me-1"></i>Salva Modifiche (${this.changedItems.size})`;
        saveAllBtn.classList.remove('disabled');
        saveAllBtn.style.pointerEvents = 'auto';
      } else {
        saveAllBtn.innerHTML = '<i class="fas fa-save me-1"></i>Salva Modifiche';
        saveAllBtn.classList.add('disabled');
        saveAllBtn.style.pointerEvents = 'none';
      }
    }
    
    if (saveChangesNowBtn) {
      saveChangesNowBtn.disabled = !hasChanges;
      if (hasChanges) {
        saveChangesNowBtn.innerHTML = `<i class="fas fa-save me-1"></i>Salva Ora (${this.changedItems.size})`;
        saveChangesNowBtn.classList.remove('btn-outline-success');
        saveChangesNowBtn.classList.add('btn-success');
      } else {
        saveChangesNowBtn.innerHTML = '<i class="fas fa-save me-1"></i>Salva Ora';
        saveChangesNowBtn.classList.remove('btn-success');
        saveChangesNowBtn.classList.add('btn-outline-success');
      }
    }
  }
  
  // Data monitoring functionality
  generateDataHash(data) {
    try {
      // Use a safer hash generation method that handles Unicode characters
      const jsonString = JSON.stringify(data);
      // Simple hash based on string length and content sample
      let hash = 0;
      for (let i = 0; i < Math.min(jsonString.length, 1000); i++) {
        const char = jsonString.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
      }
      return Math.abs(hash) + '_' + jsonString.length + '_' + Date.now();
    } catch (error) {
      console.error('Error generating data hash:', error);
      return 'error_' + Date.now();
    }
  }

  startMonitoring() {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    const intervalMs = this.monitoringIntervalMinutes * 60 * 1000; // Convert minutes to milliseconds
    console.log(`Starting data monitoring... (checking every ${this.monitoringIntervalMinutes} minutes)`);
    
    // Initial check
    this.checkForUpdates();
    
    // Set next check time
    this.nextCheckTime = new Date(Date.now() + intervalMs);
    
    // Set up interval for periodic checks
    this.monitoringInterval = setInterval(() => {
      this.checkForUpdates();
      this.nextCheckTime = new Date(Date.now() + intervalMs);
    }, intervalMs);
    
    // Start countdown timer
    this.startCountdown();
    
    // Add UI indicator
    this.updateMonitoringStatus(true);
  }

  stopMonitoring() {
    if (!this.isMonitoring) return;
    
    this.isMonitoring = false;
    console.log('Stopping data monitoring...');
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
    
    this.nextCheckTime = null;
    
    this.updateMonitoringStatus(false);
  }

  startCountdown() {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
    
    this.countdownInterval = setInterval(() => {
      this.updateCountdown();
    }, 1000); // Update every second
  }

  updateCountdown() {
    const nextCheckEl = document.getElementById('nextCheckIn');
    if (!nextCheckEl || !this.nextCheckTime || !this.isMonitoring) {
      if (nextCheckEl) {
        nextCheckEl.textContent = '-';
      }
      return;
    }
    
    const now = new Date();
    const timeDiff = this.nextCheckTime.getTime() - now.getTime();
    
    if (timeDiff <= 0) {
      nextCheckEl.textContent = 'Ora';
      return;
    }
    
    const minutes = Math.floor(timeDiff / (1000 * 60));
    const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);
    
    if (minutes > 0) {
      nextCheckEl.textContent = `${minutes}m ${seconds}s`;
    } else {
      nextCheckEl.textContent = `${seconds}s`;
    }
  }

  async checkForUpdates() {
    try {
      this.lastCheckTime = new Date();
      console.log(`Checking for remote data updates... (${this.lastCheckTime.toLocaleTimeString('it-IT')})`);
      
      const response = await fetch('/api/data-hash');
      const result = await response.json();
      
      if (result.hash && result.hash !== this.lastDataHash) {
        console.log('Remote data has changed, showing notification...');
        this.showUpdateNotification();
      } else {
        console.log('No remote changes detected');
      }
    } catch (error) {
      console.error('Error checking for updates:', error);
    }
  }

  showUpdateNotification() {
    // Create update notification
    let updateNotification = document.getElementById('updateNotification');
    if (!updateNotification) {
      updateNotification = document.createElement('div');
      updateNotification.id = 'updateNotification';
      updateNotification.className = 'alert alert-warning position-fixed top-0 start-50 translate-middle-x mt-3';
      updateNotification.style.zIndex = '9999';
      updateNotification.style.width = 'auto';
      updateNotification.innerHTML = `
        <div class="d-flex align-items-center">
          <i class="fas fa-exclamation-triangle me-2"></i>
          <span class="me-3">Il file remoto è stato aggiornato. Vuoi ricaricare i dati?</span>
          <button class="btn btn-sm btn-warning me-2" onclick="window.jsonEditor.reloadRemoteData()">
            <i class="fas fa-sync me-1"></i>Ricarica
          </button>
          <button class="btn btn-sm btn-outline-secondary" onclick="window.jsonEditor.dismissUpdateNotification()">
            <i class="fas fa-times me-1"></i>Ignora
          </button>
        </div>
      `;
      document.body.appendChild(updateNotification);
    }
    
    updateNotification.style.display = 'block';
  }

  dismissUpdateNotification() {
    const updateNotification = document.getElementById('updateNotification');
    if (updateNotification) {
      updateNotification.style.display = 'none';
    }
  }

  async reloadRemoteData() {
    if (this.changedItems.size > 0) {
      const confirmed = confirm(
        'Hai modifiche non salvate che verranno perse. Sei sicuro di voler ricaricare i dati remoti?'
      );
      
      if (!confirmed) {
        return;
      }
    }
    
    this.showLoading();
    
    try {
      // Clear all changes
      this.changedItems.clear();
      
      // Reload data
      await this.loadData();
      
      // Dismiss notification
      this.dismissUpdateNotification();
      
      this.showSuccessMessage('Dati ricaricati con successo dal file remoto!');
    } catch (error) {
      console.error('Error reloading remote data:', error);
      this.showError('Errore durante il ricaricamento dei dati: ' + error.message);
    } finally {
      this.hideLoading();
    }
  }

  updateMonitoringStatus(isActive) {
    // Update navbar to show monitoring status
    let monitoringIndicator = document.getElementById('monitoringIndicator');
    if (!monitoringIndicator) {
      // Find the navbar nav element
      const navbarNav = document.querySelector('.navbar-nav');
      if (navbarNav) {
        const li = document.createElement('li');
        li.className = 'nav-item dropdown';
        li.innerHTML = `
          <a class="nav-link dropdown-toggle" href="#" role="button" data-bs-toggle="dropdown" aria-expanded="false" id="monitoringIndicator">
            <i class="fas fa-circle text-secondary me-1"></i>
            <small>Monitor: Off</small>
          </a>
          <ul class="dropdown-menu dropdown-menu-end">
            <li><h6 class="dropdown-header">Monitoraggio File Remoto</h6></li>
            <li><a class="dropdown-item" href="#" id="toggleMonitoring">
              <i class="fas fa-power-off me-2"></i>Disattiva Monitoraggio
            </a></li>
            <li><hr class="dropdown-divider"></li>
            <li><h6 class="dropdown-header">Intervallo di Controllo</h6></li>
            <li><a class="dropdown-item" href="#" onclick="window.jsonEditor.setMonitoringInterval(3)">
              <i class="fas fa-clock me-2"></i>3 minuti ${this.monitoringIntervalMinutes === 3 ? '<i class="fas fa-check text-success ms-auto"></i>' : ''}
            </a></li>
            <li><a class="dropdown-item" href="#" onclick="window.jsonEditor.setMonitoringInterval(5)">
              <i class="fas fa-clock me-2"></i>5 minuti ${this.monitoringIntervalMinutes === 5 ? '<i class="fas fa-check text-success ms-auto"></i>' : ''}
            </a></li>
            <li><a class="dropdown-item" href="#" onclick="window.jsonEditor.setMonitoringInterval(10)">
              <i class="fas fa-clock me-2"></i>10 minuti ${this.monitoringIntervalMinutes === 10 ? '<i class="fas fa-check text-success ms-auto"></i>' : ''}
            </a></li>
            <li><a class="dropdown-item" href="#" onclick="window.jsonEditor.setMonitoringInterval(15)">
              <i class="fas fa-clock me-2"></i>15 minuti ${this.monitoringIntervalMinutes === 15 ? '<i class="fas fa-check text-success ms-auto"></i>' : ''}
            </a></li>
            <li><a class="dropdown-item" href="#" onclick="window.jsonEditor.setMonitoringInterval(30)">
              <i class="fas fa-clock me-2"></i>30 minuti ${this.monitoringIntervalMinutes === 30 ? '<i class="fas fa-check text-success ms-auto"></i>' : ''}
            </a></li>
            <li><hr class="dropdown-divider"></li>
            <li class="dropdown-item-text small text-muted" id="lastCheckTime">
              Ultimo controllo: Mai
            </li>
          </ul>
        `;
        navbarNav.appendChild(li);
        monitoringIndicator = document.getElementById('monitoringIndicator');
        
        // Add toggle functionality
        document.getElementById('toggleMonitoring').addEventListener('click', (e) => {
          e.preventDefault();
          if (this.isMonitoring) {
            this.stopMonitoring();
          } else {
            this.startMonitoring();
          }
        });
      }
    }
    
    if (monitoringIndicator) {
      const toggleBtn = document.getElementById('toggleMonitoring');
      const lastCheckTimeEl = document.getElementById('lastCheckTime');
      
      if (isActive) {
        monitoringIndicator.innerHTML = `
          <i class="fas fa-circle text-success me-1"></i>
          <small>Monitor: Attivo (${this.monitoringIntervalMinutes}min)</small>
        `;
        monitoringIndicator.title = `Monitoraggio file remoto attivo (controllo ogni ${this.monitoringIntervalMinutes} minuti)`;
        if (toggleBtn) {
          toggleBtn.innerHTML = '<i class="fas fa-power-off me-2"></i>Disattiva Monitoraggio';
        }
      } else {
        monitoringIndicator.innerHTML = `
          <i class="fas fa-circle text-secondary me-1"></i>
          <small>Monitor: Off</small>
        `;
        monitoringIndicator.title = 'Monitoraggio file remoto disattivato';
        if (toggleBtn) {
          toggleBtn.innerHTML = '<i class="fas fa-play me-2"></i>Attiva Monitoraggio';
        }
      }
      
      // Update last check time
      if (lastCheckTimeEl && this.lastCheckTime) {
        lastCheckTimeEl.textContent = `Ultimo controllo: ${this.lastCheckTime.toLocaleTimeString('it-IT')}`;
      }
    }
  }

  setMonitoringInterval(minutes) {
    this.monitoringIntervalMinutes = minutes;
    localStorage.setItem('monitoringInterval', minutes.toString());
    
    // Restart monitoring with new interval if currently active
    if (this.isMonitoring) {
      this.stopMonitoring();
      this.startMonitoring();
    }
    
    this.updateMonitoringStatus(this.isMonitoring);
    this.updateStatistics(); // Update the statistics display
    
    // Show confirmation
    this.showSuccessMessage(`Intervallo di monitoraggio impostato a ${minutes} minuti`);
  }

  scheduleAutoSave() {
    if (this.autoSaveTimeout) {
      clearTimeout(this.autoSaveTimeout);
    }
    
    // Auto-save after 2 seconds of inactivity
    this.autoSaveTimeout = setTimeout(() => {
      if (this.changedItems.size > 0) {
        console.log('Auto-saving changes...');
        this.saveChanges();
      }
    }, 2000);
  }

  async saveChanges() {
    if (this.changedItems.size === 0) {
      this.showError('Nessuna modifica da salvare');
      return;
    }

    this.showLoading();

    try {
      // Convert changedItems Map to plain object for server
      const changes = {};
      for (const [itemId, fieldChanges] of this.changedItems) {
        changes[itemId] = {};
        for (const [field, change] of fieldChanges) {
          changes[itemId][field] = change.new;
        }
      }

      console.log('Saving changes:', changes);

      const response = await fetch('/api/data/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(changes)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `HTTP error! status: ${response.status}`);
      }

      if (result.success) {
        // Clear changes after successful save
        this.changedItems.clear();
        this.updateChangesPanel();
        
        // Show success message with PR link if available
        let successMessage = `✅ ${result.changesCount || 'Tutte le'} modifiche salvate con successo!`;
        if (result.prUrl) {
          successMessage += `<br><a href="${result.prUrl}" target="_blank" class="btn btn-sm btn-outline-success mt-2">
            <i class="fab fa-github me-1"></i>Visualizza PR #${result.prNumber}
          </a>`;
        }
        
        this.showSuccessMessage(successMessage);
        
        // Update data hash for monitoring
        if (result.dataHash) {
          this.lastDataHash = result.dataHash;
        } else {
          // Generate new hash from updated data if not provided
          this.lastDataHash = this.generateDataHash(this.data);
        }
      } else {
        throw new Error(result.error || 'Errore sconosciuto durante il salvataggio');
      }

    } catch (error) {
      console.error('Error saving changes:', error);
      
      let errorMessage = 'Errore durante il salvataggio delle modifiche: ' + error.message;
      
      // Handle specific error cases
      if (error.message.includes('Failed to fetch')) {
        errorMessage = 'Errore di connessione. Verifica la tua connessione internet e riprova.';
      } else if (error.message.includes('401')) {
        errorMessage = 'Errore di autenticazione. Le credenziali GitHub potrebbero essere scadute.';
      } else if (error.message.includes('403')) {
        errorMessage = 'Accesso negato. Verifica i permessi del repository GitHub.';
      } else if (error.message.includes('404')) {
        errorMessage = 'Repository o file non trovato. Verifica la configurazione.';
      }
      
      this.showError(errorMessage);
      
    } finally {
      this.hideLoading();
    }
  }

  // Bulk operations functionality
  selectAllItems() {
    this.selectedItems = new Set(this.getCurrentPageData().map(item => item.id || this.data.indexOf(item)));
    this.updateSelectionUI();
  }

  clearSelection() {
    this.selectedItems = new Set();
    this.updateSelectionUI();
  }

  updateSelectionUI() {
    // Update selection indicators in the table
    document.querySelectorAll('.json-table tbody tr').forEach((row, index) => {
      const currentData = this.getCurrentPageData();
      const itemId = currentData[index]?.id || index;
      
      if (this.selectedItems.has(itemId)) {
        row.classList.add('table-info');
        row.style.backgroundColor = '#d1ecf1';
      } else {
        row.classList.remove('table-info');
        row.style.backgroundColor = '';
      }
    });
    
    // Update bulk actions toolbar
    this.updateBulkActionsToolbar();
  }

  updateBulkActionsToolbar() {
    let bulkToolbar = document.getElementById('bulkActionsToolbar');
    
    if (this.selectedItems.size > 0) {
      if (!bulkToolbar) {
        bulkToolbar = document.createElement('div');
        bulkToolbar.id = 'bulkActionsToolbar';
        bulkToolbar.className = 'alert alert-info position-sticky';
        bulkToolbar.style.top = '70px';
        bulkToolbar.style.zIndex = '100';
        bulkToolbar.innerHTML = `
          <div class="d-flex justify-content-between align-items-center">
            <span>
              <i class="fas fa-check-square me-2"></i>
              <span id="selectedCount">${this.selectedItems.size}</span> elementi selezionati
            </span>
            <div class="btn-group btn-group-sm">
              <button class="btn btn-outline-warning" id="bulkEditBtn">
                <i class="fas fa-edit me-1"></i>Modifica in blocco
              </button>
              <button class="btn btn-outline-danger" id="bulkDeleteBtn">
                <i class="fas fa-trash me-1"></i>Elimina selezionati
              </button>
              <button class="btn btn-outline-secondary" onclick="window.jsonEditor.clearSelection()">
                <i class="fas fa-times me-1"></i>Deseleziona
              </button>
            </div>
          </div>
        `;
        
        // Insert after pagination controls
        const paginationControls = document.querySelector('.pagination-controls');
        paginationControls.parentNode.insertBefore(bulkToolbar, paginationControls.nextSibling);
        
        // Add event listeners
        document.getElementById('bulkEditBtn').addEventListener('click', () => this.openBulkEditModal());
        document.getElementById('bulkDeleteBtn').addEventListener('click', () => this.bulkDelete());
      } else {
        document.getElementById('selectedCount').textContent = this.selectedItems.size;
      }
      
      bulkToolbar.style.display = 'block';
    } else if (bulkToolbar) {
      bulkToolbar.style.display = 'none';
    }
  }

  openBulkEditModal() {
    // Create bulk edit modal if it doesn't exist
    let bulkEditModal = document.getElementById('bulkEditModal');
    if (!bulkEditModal) {
      bulkEditModal = document.createElement('div');
      bulkEditModal.id = 'bulkEditModal';
      bulkEditModal.className = 'modal fade';
      bulkEditModal.innerHTML = `
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">
                <i class="fas fa-edit me-2"></i>Modifica in Blocco
              </h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <div class="alert alert-info">
                <i class="fas fa-info-circle me-2"></i>
                Stai per modificare <strong>${this.selectedItems.size}</strong> elementi contemporaneamente.
              </div>
              <div class="row">
                <div class="col-md-6">
                  <label for="bulkField" class="form-label">Campo da modificare</label>
                  <select class="form-select" id="bulkField">
                    <option value="">Seleziona un campo...</option>
                  </select>
                </div>
                <div class="col-md-6">
                  <label for="bulkValue" class="form-label">Nuovo valore</label>
                  <input type="text" class="form-control" id="bulkValue" placeholder="Inserisci il nuovo valore">
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annulla</button>
              <button type="button" class="btn btn-warning" id="applyBulkEdit">
                <i class="fas fa-edit me-1"></i>Applica Modifiche
              </button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(bulkEditModal);
      
      // Populate field options
      const fieldSelect = document.getElementById('bulkField');
      this.visibleColumns.forEach(column => {
        if (column !== 'id') { // Don't allow bulk editing IDs
          const option = document.createElement('option');
          option.value = column;
          option.textContent = this.formatColumnName(column);
          fieldSelect.appendChild(option);
        }
      });
      
      // Add apply handler
      document.getElementById('applyBulkEdit').addEventListener('click', () => this.applyBulkEdit());
    }
    
    const modal = new bootstrap.Modal(bulkEditModal);
    modal.show();
  }

  applyBulkEdit() {
    const field = document.getElementById('bulkField').value;
    const value = document.getElementById('bulkValue').value;
    
    if (!field) {
      this.showError('Seleziona un campo da modificare');
      return;
    }
    
    const parsedValue = this.parseValue(value, field);
    
    // Apply changes to selected items
    let changedCount = 0;
    for (const itemId of this.selectedItems) {
      const success = this.updateItemValue(itemId, field, parsedValue);
      if (success) changedCount++;
    }
    
    this.renderTable();
    this.clearSelection();
    
    // Close modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('bulkEditModal'));
    modal.hide();
    
    this.showSuccessMessage(`${changedCount} elementi modificati con successo`);
  }

  bulkDelete() {
    if (!confirm(`Sei sicuro di voler eliminare ${this.selectedItems.size} elementi selezionati?`)) {
      return;
    }
    
    // Remove selected items from data
    this.data = this.data.filter(item => {
      const itemId = item.id || this.data.indexOf(item);
      return !this.selectedItems.has(itemId);
    });
    
    this.clearSelection();
    this.applyFiltersAndSort();
    
    this.showSuccessMessage(`${this.selectedItems.size} elementi eliminati`);
  }
}

// Initialize the JSON Editor when the page loads
document.addEventListener('DOMContentLoaded', function() {
  // Initialize tooltips
  function initializeTooltips() {
    // Initialize custom tooltips for navigation
    const elementsWithTooltips = document.querySelectorAll('[data-has-tooltip="true"]');
    
    elementsWithTooltips.forEach(element => {
      const tooltipText = element.getAttribute('data-tooltip');
      if (tooltipText) {
        element.setAttribute('data-bs-toggle', 'tooltip');
        element.setAttribute('data-bs-placement', 'bottom');
        element.setAttribute('title', tooltipText);
        new bootstrap.Tooltip(element);
      }
    });
  }
  
  // Initialize tooltips first
  initializeTooltips();
  
  // Then initialize the JSON Editor
  window.jsonEditor = new JSONEditor();
});

// Cleanup when page is unloaded
window.addEventListener('beforeunload', function(e) {
  if (window.jsonEditor) {
    // Check for unsaved changes
    if (window.jsonEditor.changedItems.size > 0) {
      const confirmationMessage = 'Hai modifiche non salvate che verranno perse. Sei sicuro di voler uscire?';
      e.returnValue = confirmationMessage;
      return confirmationMessage;
    }
    
    // Cleanup resources
    window.jsonEditor.cleanup();
  }
});

// Cleanup when page is hidden (mobile/tab switching)
document.addEventListener('visibilitychange', function() {
  if (document.hidden && window.jsonEditor) {
    // Save any pending changes automatically
    if (window.jsonEditor.changedItems.size > 0) {
      console.log('Page hidden, auto-saving changes...');
      window.jsonEditor.saveChanges();
    }
  }
});
