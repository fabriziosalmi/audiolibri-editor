// Genre Management Functionality
// This file contains all the genre management functions

// Global variables for genre management
let allGenres = {};
let selectedGenres = new Set();
let genreChanges = {};

// Initialize genre management when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  // Get modal references
  const genreManagementModal = new bootstrap.Modal(document.getElementById('genreManagementModal'));
  const mergeGenresModal = new bootstrap.Modal(document.getElementById('mergeGenresModal'));
  
  // Set up event listeners
  document.getElementById('genreManagementBtn').addEventListener('click', openGenreManagementModal);
  
  function openGenreManagementModal() {
    loadGenresData();
    genreManagementModal.show();
    setupGenreManagementListeners();
  }

  function setupGenreManagementListeners() {
    // Search and filter functionality
    document.getElementById('genreSearchInput').addEventListener('input', filterGenres);
    document.getElementById('clearGenreSearchBtn').addEventListener('click', clearGenreSearch);
    document.getElementById('genreFilterSelect').addEventListener('change', filterGenres);
    document.getElementById('genreSortSelect').addEventListener('change', renderGenres);
    
    // Bulk actions
    document.getElementById('selectAllGenresBtn').addEventListener('click', selectAllGenres);
    document.getElementById('clearGenreSelectionBtn').addEventListener('click', clearGenreSelection);
    document.getElementById('mergeGenresBtn').addEventListener('click', openMergeModal);
    document.getElementById('deleteGenresBtn').addEventListener('click', deleteSelectedGenres);
    document.getElementById('refreshGenresBtn').addEventListener('click', loadGenresData);
    document.getElementById('addGenreBtn').addEventListener('click', addNewGenre);
    
    // Apply changes
    document.getElementById('applyGenreChangesBtn').addEventListener('click', applyGenreChanges);
    
    // Merge modal
    document.getElementById('confirmMergeBtn').addEventListener('click', confirmMergeGenres);
  }

  function loadGenresData() {
    // Extract genres from all data (assuming allData is globally available)
    allGenres = {};
    
    if (typeof window.allData !== 'undefined') {
      Object.entries(window.allData).forEach(([id, item]) => {
        const genre = item.real_genre;
        if (genre && genre.trim()) {
          const normalizedGenre = genre.trim();
          if (!allGenres[normalizedGenre]) {
            allGenres[normalizedGenre] = {
              name: normalizedGenre,
              count: 0,
              items: [],
              lastModified: null
            };
          }
          allGenres[normalizedGenre].count++;
          allGenres[normalizedGenre].items.push(item);
          
          // Check if this item was recently modified
          if (window.changedItems && window.changedItems[id]) {
            allGenres[normalizedGenre].lastModified = new Date().toISOString();
          }
        }
      });
    }
    
    updateGenreStatistics();
    renderGenres();
  }

  function updateGenreStatistics() {
    const genres = Object.values(allGenres);
    const totalGenres = genres.length;
    const usedGenres = genres.filter(g => g.count > 0).length;
    const suspiciousGenres = findSuspiciousGenres().length;
    const emptyGenres = genres.filter(g => g.count === 0).length;
    
    document.getElementById('totalGenresCount').textContent = totalGenres;
    document.getElementById('usedGenresCount').textContent = usedGenres;
    document.getElementById('suspiciousGenresCount').textContent = suspiciousGenres;
    document.getElementById('emptyGenresCount').textContent = emptyGenres;
  }

  function findSuspiciousGenres() {
    const genres = Object.keys(allGenres);
    const suspicious = [];
    
    for (let i = 0; i < genres.length; i++) {
      for (let j = i + 1; j < genres.length; j++) {
        const genre1 = genres[i].toLowerCase();
        const genre2 = genres[j].toLowerCase();
        
        if (areSimilarGenres(genre1, genre2)) {
          suspicious.push(genres[i], genres[j]);
        }
      }
    }
    
    return [...new Set(suspicious)];
  }

  function areSimilarGenres(genre1, genre2) {
    if (genre1 === genre2) return true;
    if (Math.abs(genre1.length - genre2.length) > 3) return false;
    
    // Check for common typos or plurals
    const commonPatterns = [
      [/s$/, ''], // plurals
      [/i$/, 'o'], // Italian endings
      [/ia$/, 'io'], // Italian endings
    ];
    
    let normalized1 = genre1;
    let normalized2 = genre2;
    
    commonPatterns.forEach(([pattern, replacement]) => {
      normalized1 = normalized1.replace(pattern, replacement);
      normalized2 = normalized2.replace(pattern, replacement);
    });
    
    return normalized1 === normalized2 || 
           genre1.includes(genre2) || 
           genre2.includes(genre1) ||
           levenshteinDistance(genre1, genre2) <= 2;
  }

  function levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  function renderGenres() {
    const genresList = document.getElementById('genresList');
    const searchTerm = document.getElementById('genreSearchInput').value.toLowerCase();
    const filterType = document.getElementById('genreFilterSelect').value;
    const sortType = document.getElementById('genreSortSelect').value;
    
    let genres = Object.values(allGenres);
    
    // Apply filters
    if (searchTerm) {
      genres = genres.filter(genre => 
        genre.name.toLowerCase().includes(searchTerm)
      );
    }
    
    if (filterType) {
      switch (filterType) {
        case 'duplicates':
          const suspicious = findSuspiciousGenres();
          genres = genres.filter(genre => suspicious.includes(genre.name));
          break;
        case 'empty':
          genres = genres.filter(genre => genre.count === 0);
          break;
        case 'single':
          genres = genres.filter(genre => genre.count === 1);
          break;
        case 'popular':
          genres = genres.filter(genre => genre.count >= 5);
          break;
      }
    }
    
    // Apply sorting
    switch (sortType) {
      case 'name':
        genres.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'count':
        genres.sort((a, b) => b.count - a.count);
        break;
      case 'recent':
        genres.sort((a, b) => {
          if (!a.lastModified && !b.lastModified) return 0;
          if (!a.lastModified) return 1;
          if (!b.lastModified) return -1;
          return new Date(b.lastModified) - new Date(a.lastModified);
        });
        break;
    }
    
    genresList.innerHTML = '';
    
    if (genres.length === 0) {
      genresList.innerHTML = `
        <div class="text-center py-4 text-muted">
          <i class="fas fa-search me-2"></i>Nessun genere trovato
        </div>
      `;
      return;
    }
    
    genres.forEach(genre => {
      const isSelected = selectedGenres.has(genre.name);
      const isSuspicious = findSuspiciousGenres().includes(genre.name);
      
      const genreElement = document.createElement('div');
      genreElement.className = `list-group-item list-group-item-action genre-item ${isSelected ? 'active' : ''} ${isSuspicious ? 'genre-suspicious' : ''}`;
      genreElement.innerHTML = `
        <div class="d-flex align-items-center">
          <input type="checkbox" class="form-check-input me-3" ${isSelected ? 'checked' : ''} 
                 data-genre-name="${genre.name}">
          <div class="flex-grow-1">
            <div class="d-flex justify-content-between align-items-center">
              <h6 class="mb-1">
                ${genre.name}
                ${isSuspicious ? '<i class="fas fa-exclamation-triangle text-warning ms-2" title="Potenziale duplicato"></i>' : ''}
              </h6>
              <div class="text-end">
                <span class="badge bg-primary">${genre.count} elementi</span>
                ${genre.lastModified ? '<span class="badge bg-warning ms-1">Modificato</span>' : ''}
              </div>
            </div>
            <div class="d-flex justify-content-between align-items-center">
              <small class="text-muted">
                ${genre.count === 1 ? '1 elemento' : `${genre.count} elementi`}
              </small>
              <div class="btn-group btn-group-sm genre-action-btn">
                <button type="button" class="btn btn-outline-primary btn-sm" 
                        onclick="editGenre('${genre.name}')">
                  <i class="fas fa-edit"></i>
                </button>
                <button type="button" class="btn btn-outline-info btn-sm" 
                        onclick="viewGenreItems('${genre.name}')">
                  <i class="fas fa-eye"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      `;
      
      // Add click handler for checkbox
      const checkbox = genreElement.querySelector('input[type="checkbox"]');
      checkbox.addEventListener('change', function(e) {
        e.stopPropagation();
        if (this.checked) {
          selectedGenres.add(genre.name);
          genreElement.classList.add('active');
        } else {
          selectedGenres.delete(genre.name);
          genreElement.classList.remove('active');
        }
        updateGenreSelectionButtons();
      });
      
      genresList.appendChild(genreElement);
    });
    
    updateGenreSelectionButtons();
  }

  function updateGenreSelectionButtons() {
    const count = selectedGenres.size;
    document.getElementById('selectedGenresCount').textContent = count;
    document.getElementById('mergeGenresBtn').disabled = count < 2;
    document.getElementById('deleteGenresBtn').disabled = count === 0;
    document.getElementById('applyGenreChangesBtn').disabled = Object.keys(genreChanges).length === 0;
  }

  function filterGenres() {
    renderGenres();
  }

  function clearGenreSearch() {
    document.getElementById('genreSearchInput').value = '';
    renderGenres();
  }

  function selectAllGenres() {
    const checkboxes = document.querySelectorAll('#genresList input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
      checkbox.checked = true;
      selectedGenres.add(checkbox.dataset.genreName);
    });
    renderGenres();
  }

  function clearGenreSelection() {
    selectedGenres.clear();
    renderGenres();
  }

  function openMergeModal() {
    if (selectedGenres.size < 2) {
      if (typeof window.showToast === 'function') {
        window.showToast('Seleziona almeno 2 generi da unire', 'warning');
      } else {
        alert('Seleziona almeno 2 generi da unire');
      }
      return;
    }
    
    const mergeList = document.getElementById('mergeGenresList');
    mergeList.innerHTML = '';
    
    Array.from(selectedGenres).forEach(genreName => {
      const genreItem = document.createElement('div');
      genreItem.className = 'mb-2 p-2 border rounded bg-white merge-genre-item';
      genreItem.innerHTML = `
        <strong>${genreName}</strong> 
        <span class="text-muted">(${allGenres[genreName].count} elementi)</span>
      `;
      mergeList.appendChild(genreItem);
    });
    
    // Suggest the most common genre as target
    const sortedGenres = Array.from(selectedGenres).sort((a, b) => 
      allGenres[b].count - allGenres[a].count
    );
    document.getElementById('targetGenreName').value = sortedGenres[0];
    
    mergeGenresModal.show();
  }

  function confirmMergeGenres() {
    const targetName = document.getElementById('targetGenreName').value.trim();
    if (!targetName) {
      if (typeof window.showToast === 'function') {
        window.showToast('Inserisci un nome per il genere finale', 'warning');
      } else {
        alert('Inserisci un nome per il genere finale');
      }
      return;
    }
    
    // Apply merge to all affected items
    if (window.allData && window.changedItems) {
      Object.entries(window.allData).forEach(([id, item]) => {
        if (selectedGenres.has(item.real_genre)) {
          // Store the change
          if (!genreChanges[id]) {
            genreChanges[id] = { ...item };
          }
          genreChanges[id].real_genre = targetName;
          
          // Update local data
          window.allData[id] = { ...window.allData[id], real_genre: targetName };
          
          // Add to changed items
          window.changedItems[id] = { ...window.changedItems[id], real_genre: targetName };
        }
      });
    }
    
    if (typeof window.showToast === 'function') {
      window.showToast(`${selectedGenres.size} generi uniti in "${targetName}"`, 'success');
    } else {
      alert(`${selectedGenres.size} generi uniti in "${targetName}"`);
    }
    
    mergeGenresModal.hide();
    loadGenresData();
    
    // Update other parts of the UI if functions are available
    if (typeof window.updateStatistics === 'function') window.updateStatistics();
    if (typeof window.renderItems === 'function' && window.filteredData) window.renderItems(window.filteredData);
    if (typeof window.populateGenreFilter === 'function') window.populateGenreFilter();
    if (typeof window.populateGenreDropdown === 'function') window.populateGenreDropdown();
  }

  function deleteSelectedGenres() {
    if (selectedGenres.size === 0) return;
    
    const affectedItems = [];
    if (window.allData) {
      Object.entries(window.allData).forEach(([id, item]) => {
        if (selectedGenres.has(item.real_genre)) {
          affectedItems.push(item.real_title || 'Senza titolo');
        }
      });
    }
    
    if (affectedItems.length > 0) {
      const confirmed = confirm(
        `Attenzione: Stai per eliminare ${selectedGenres.size} generi che sono usati da ${affectedItems.length} elementi.\n\n` +
        `Gli elementi interessati avranno il genere rimosso. Continuare?`
      );
      
      if (!confirmed) return;
    }
    
    // Remove genre from affected items
    if (window.allData && window.changedItems) {
      Object.entries(window.allData).forEach(([id, item]) => {
        if (selectedGenres.has(item.real_genre)) {
          if (!genreChanges[id]) {
            genreChanges[id] = { ...item };
          }
          genreChanges[id].real_genre = '';
          
          // Update local data
          window.allData[id] = { ...window.allData[id], real_genre: '' };
          
          // Add to changed items
          window.changedItems[id] = { ...window.changedItems[id], real_genre: '' };
        }
      });
    }
    
    if (typeof window.showToast === 'function') {
      window.showToast(`${selectedGenres.size} generi eliminati`, 'success');
    } else {
      alert(`${selectedGenres.size} generi eliminati`);
    }
    
    selectedGenres.clear();
    loadGenresData();
    
    // Update other parts of the UI if functions are available
    if (typeof window.updateStatistics === 'function') window.updateStatistics();
    if (typeof window.renderItems === 'function' && window.filteredData) window.renderItems(window.filteredData);
    if (typeof window.populateGenreFilter === 'function') window.populateGenreFilter();
    if (typeof window.populateGenreDropdown === 'function') window.populateGenreDropdown();
  }

  function addNewGenre() {
    const genreName = prompt('Inserisci il nome del nuovo genere:');
    if (!genreName || !genreName.trim()) return;
    
    const normalizedName = genreName.trim();
    if (allGenres[normalizedName]) {
      if (typeof window.showToast === 'function') {
        window.showToast('Questo genere esiste già', 'warning');
      } else {
        alert('Questo genere esiste già');
      }
      return;
    }
    
    allGenres[normalizedName] = {
      name: normalizedName,
      count: 0,
      items: [],
      lastModified: new Date().toISOString()
    };
    
    if (typeof window.showToast === 'function') {
      window.showToast(`Genere "${normalizedName}" aggiunto`, 'success');
    } else {
      alert(`Genere "${normalizedName}" aggiunto`);
    }
    loadGenresData();
  }

  function editGenre(genreName) {
    const newName = prompt(`Modifica il nome del genere:`, genreName);
    if (!newName || !newName.trim() || newName.trim() === genreName) return;
    
    const normalizedNewName = newName.trim();
    if (allGenres[normalizedNewName] && normalizedNewName !== genreName) {
      if (typeof window.showToast === 'function') {
        window.showToast('Un genere con questo nome esiste già', 'warning');
      } else {
        alert('Un genere con questo nome esiste già');
      }
      return;
    }
    
    // Update all items with this genre
    if (window.allData && window.changedItems) {
      Object.entries(window.allData).forEach(([id, item]) => {
        if (item.real_genre === genreName) {
          if (!genreChanges[id]) {
            genreChanges[id] = { ...item };
          }
          genreChanges[id].real_genre = normalizedNewName;
          
          // Update local data
          window.allData[id] = { ...window.allData[id], real_genre: normalizedNewName };
          
          // Add to changed items
          window.changedItems[id] = { ...window.changedItems[id], real_genre: normalizedNewName };
        }
      });
    }
    
    if (typeof window.showToast === 'function') {
      window.showToast(`Genere modificato in "${normalizedNewName}"`, 'success');
    } else {
      alert(`Genere modificato in "${normalizedNewName}"`);
    }
    
    loadGenresData();
    
    // Update other parts of the UI if functions are available
    if (typeof window.updateStatistics === 'function') window.updateStatistics();
    if (typeof window.renderItems === 'function' && window.filteredData) window.renderItems(window.filteredData);
    if (typeof window.populateGenreFilter === 'function') window.populateGenreFilter();
    if (typeof window.populateGenreDropdown === 'function') window.populateGenreDropdown();
  }

  function viewGenreItems(genreName) {
    // Close genre management modal and filter by this genre
    genreManagementModal.hide();
    
    // Set the genre filter and apply if functions are available
    const genreFilter = document.getElementById('genreFilter');
    if (genreFilter) {
      genreFilter.value = genreName;
      if (typeof window.applyFilters === 'function') {
        window.applyFilters();
      }
    }
    
    if (typeof window.showToast === 'function') {
      window.showToast(`Visualizzazione di ${allGenres[genreName].count} elementi con genere "${genreName}"`, 'info');
    }
  }

  function applyGenreChanges() {
    if (Object.keys(genreChanges).length === 0) {
      if (typeof window.showToast === 'function') {
        window.showToast('Nessuna modifica da applicare', 'info');
      } else {
        alert('Nessuna modifica da applicare');
      }
      return;
    }
    
    const changeCount = Object.keys(genreChanges).length;
    if (typeof window.showToast === 'function') {
      window.showToast(`${changeCount} modifiche ai generi applicate`, 'success');
    } else {
      alert(`${changeCount} modifiche ai generi applicate`);
    }
    
    genreChanges = {};
    updateGenreSelectionButtons();
    if (typeof window.updateSaveChangesBtn === 'function') {
      window.updateSaveChangesBtn();
    }
  }

  // Make functions globally available for onclick handlers
  window.editGenre = editGenre;
  window.viewGenreItems = viewGenreItems;
});
