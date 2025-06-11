// Enhanced validation utilities
class ValidationManager {
  static patterns = {
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    youtubeUrl: /^https?:\/\/(www\.)?(youtube\.com\/(watch\?v=|playlist\?list=)|youtu\.be\/)/,
    isbn: /^(?:ISBN(?:-1[03])?:? )?(?=[0-9X]{10}$|(?=(?:[0-9]+[- ]){3})[- 0-9X]{13}$|97[89][0-9]{10}$|(?=(?:[0-9]+[- ]){4})[- 0-9]{17}$)(?:97[89][- ]?)?[0-9]{1,5}[- ]?[0-9]+[- ]?[0-9]+[- ]?[0-9X]$/,
    duration: /^(?:(?:([01]?\d|2[0-3]):)?([0-5]?\d):)?([0-5]?\d)$/
  };

  static sanitizeHtml(input) {
    const div = document.createElement('div');
    div.textContent = input;
    return div.innerHTML;
  }

  static validateUrl(url) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  static validateYouTubeUrl(url) {
    return this.patterns.youtubeUrl.test(url);
  }

  static validateYear(year) {
    const currentYear = new Date().getFullYear();
    const numYear = parseInt(year);
    return numYear >= 1000 && numYear <= currentYear + 5;
  }

  static validateDuration(duration) {
    if (typeof duration === 'number') {
      return duration > 0 && duration < 999999; // Max ~11 days in minutes
    }
    if (typeof duration === 'string') {
      return this.patterns.duration.test(duration);
    }
    return false;
  }

  static validateRequired(value, fieldName) {
    if (!value || (typeof value === 'string' && !value.trim())) {
      return { isValid: false, message: `${fieldName} è obbligatorio` };
    }
    return { isValid: true };
  }

  static validateLength(value, min = 0, max = Infinity, fieldName = 'Campo') {
    const length = value ? value.toString().length : 0;
    if (length < min) {
      return { isValid: false, message: `${fieldName} deve essere di almeno ${min} caratteri` };
    }
    if (length > max) {
      return { isValid: false, message: `${fieldName} non può superare ${max} caratteri` };
    }
    return { isValid: true };
  }

  static validateGenre(genre) {
    // Check for suspicious patterns
    const suspicious = [
      /^\s*$/, // Empty or whitespace only
      /^.{1,2}$/, // Too short
      /[0-9]{3,}/, // Contains 3+ consecutive numbers
      /^[^a-zA-ZÀ-ÿ\s]/, // Starts with special character
      /[<>{}[\]]/  // Contains HTML-like characters
    ];

    for (const pattern of suspicious) {
      if (pattern.test(genre)) {
        return { isValid: false, message: 'Genere sospetto o non valido' };
      }
    }

    return this.validateLength(genre, 2, 50, 'Genere');
  }

  static validateItemData(item) {
    const errors = [];

    // Required fields validation
    const requiredFields = [
      { field: 'real_title', name: 'Titolo' },
      { field: 'real_author', name: 'Autore' }
    ];

    for (const { field, name } of requiredFields) {
      const validation = this.validateRequired(item[field], name);
      if (!validation.isValid) {
        errors.push({ field, message: validation.message });
      }
    }

    // Length validations
    const lengthChecks = [
      { field: 'real_title', max: 200, name: 'Titolo' },
      { field: 'real_author', max: 100, name: 'Autore' },
      { field: 'real_synopsis', max: 2000, name: 'Sinossi' },
      { field: 'real_narrator', max: 100, name: 'Narratore' }
    ];

    for (const check of lengthChecks) {
      if (item[check.field]) {
        const validation = this.validateLength(item[check.field], 0, check.max, check.name);
        if (!validation.isValid) {
          errors.push({ field: check.field, message: validation.message });
        }
      }
    }

    // Specific validations
    if (item.real_published_year && !this.validateYear(item.real_published_year)) {
      errors.push({ field: 'real_published_year', message: 'Anno non valido' });
    }

    if (item.real_duration && !this.validateDuration(item.real_duration)) {
      errors.push({ field: 'real_duration', message: 'Durata non valida' });
    }

    if (item.youtube_url && !this.validateYouTubeUrl(item.youtube_url)) {
      errors.push({ field: 'youtube_url', message: 'URL YouTube non valido' });
    }

    if (item.real_genre) {
      const genreValidation = this.validateGenre(item.real_genre);
      if (!genreValidation.isValid) {
        errors.push({ field: 'real_genre', message: genreValidation.message });
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ValidationManager;
}
