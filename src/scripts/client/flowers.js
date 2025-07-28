// Flower section functionality module
export class FlowerManager {
  constructor() {
    this.flowers = [];
    this.filteredFlowers = [];
    this.currentCardIndex = 0;
    this.currentView = 'carousel';
    
    this.initializeElements();
    this.loadFlowers();
    this.setupEventListeners();
  }

  initializeElements() {
    // Search elements
    this.searchInput = document.getElementById('flowerSearch');
    this.searchClear = document.getElementById('searchClear');
    this.searchSuggestions = document.getElementById('searchSuggestions');
    
    // Filter elements
    this.colorFilter = document.getElementById('colorFilter');
    this.occasionFilter = document.getElementById('occasionFilter');
    
    // View elements
    this.carouselView = document.getElementById('carouselView');
    this.listView = document.getElementById('listView');
    this.mobileCarousel = document.getElementById('mobileCarousel');
    this.mobileList = document.getElementById('mobileList');
    this.desktopGrid = document.getElementById('desktopGrid');
    
    // Navigation elements
    this.prevBtn = document.getElementById('prevBtn');
    this.nextBtn = document.getElementById('nextBtn');
    this.flowerNavBtn = document.getElementById('flowerNavBtn');
    this.flowerNavText = document.getElementById('flowerNavText');
    this.flowerNavDropdown = document.getElementById('flowerNavDropdown');
    this.flowerNavList = document.getElementById('flowerNavList');
    
    // Form elements
    this.flowerRequestForm = document.getElementById('flowerRequestForm');
    this.noResultsSection = document.getElementById('noResultsSection');
  }

  loadFlowers() {
    // Flower data - in production, this would come from an API
    this.flowers = [
      {
        name: "Roses",
        description: "Classic romantic blooms in various colors",
        colors: ["red", "pink", "white", "yellow"],
        occasions: ["wedding", "anniversary", "valentine"],
        season: "year-round",
        image: "/images/flowers/roses.jpg"
      },
      {
        name: "Peonies",
        description: "Lush, full blooms perfect for elegant arrangements",
        colors: ["pink", "white", "coral"],
        occasions: ["wedding", "mother's day"],
        season: "spring",
        image: "/images/flowers/peonies.jpg"
      },
      {
        name: "Sunflowers",
        description: "Bright, cheerful flowers that bring joy",
        colors: ["yellow", "orange"],
        occasions: ["birthday", "thank you"],
        season: "summer",
        image: "/images/flowers/sunflowers.jpg"
      },
      {
        name: "Lavender",
        description: "Fragrant purple blooms with calming properties",
        colors: ["purple", "blue"],
        occasions: ["relaxation", "aromatherapy"],
        season: "summer",
        image: "/images/flowers/lavender.jpg"
      },
      {
        name: "Tulips",
        description: "Elegant spring flowers in vibrant colors",
        colors: ["red", "pink", "yellow", "purple", "white"],
        occasions: ["spring celebration", "easter"],
        season: "spring",
        image: "/images/flowers/tulips.jpg"
      },
      {
        name: "Daisies",
        description: "Simple, cheerful flowers perfect for casual bouquets",
        colors: ["white", "yellow"],
        occasions: ["friendship", "get well"],
        season: "spring-summer",
        image: "/images/flowers/daisies.jpg"
      }
    ];

    this.filteredFlowers = [...this.flowers];
    this.renderFlowers();
  }

  setupEventListeners() {
    // Search functionality
    if (this.searchInput) {
      this.searchInput.addEventListener('input', this.handleSearch.bind(this));
      this.searchInput.addEventListener('focus', this.showSearchSuggestions.bind(this));
      this.searchInput.addEventListener('blur', () => {
        setTimeout(() => this.hideSearchSuggestions(), 200);
      });
    }

    if (this.searchClear) {
      this.searchClear.addEventListener('click', this.clearSearch.bind(this));
    }

    // Filter functionality
    if (this.colorFilter) {
      this.colorFilter.addEventListener('change', this.handleFilter.bind(this));
    }

    if (this.occasionFilter) {
      this.occasionFilter.addEventListener('change', this.handleFilter.bind(this));
    }

    // View toggle
    if (this.carouselView) {
      this.carouselView.addEventListener('click', () => this.switchView('carousel'));
    }

    if (this.listView) {
      this.listView.addEventListener('click', () => this.switchView('list'));
    }

    // Navigation
    if (this.prevBtn) {
      this.prevBtn.addEventListener('click', this.previousCard.bind(this));
    }

    if (this.nextBtn) {
      this.nextBtn.addEventListener('click', this.nextCard.bind(this));
    }

    // Mobile navigation dropdown
    if (this.flowerNavBtn) {
      this.flowerNavBtn.addEventListener('click', this.toggleNavDropdown.bind(this));
    }

    // Form submission
    if (this.flowerRequestForm) {
      this.flowerRequestForm.addEventListener('submit', this.handleFormSubmit.bind(this));
    }

    // Touch/swipe support for mobile
    this.setupTouchEvents();
  }

  handleSearch(event) {
    const query = event.target.value.toLowerCase().trim();
    
    if (query === '') {
      this.filteredFlowers = [...this.flowers];
    } else {
      this.filteredFlowers = this.flowers.filter(flower => 
        flower.name.toLowerCase().includes(query) ||
        flower.description.toLowerCase().includes(query) ||
        flower.colors.some(color => color.toLowerCase().includes(query)) ||
        flower.occasions.some(occasion => occasion.toLowerCase().includes(query))
      );
    }

    this.currentCardIndex = 0;
    this.renderFlowers();
    this.updateSearchClear(query);
  }

  showSearchSuggestions() {
    if (!this.searchSuggestions) return;

    const suggestions = [...new Set(this.flowers.flatMap(flower => [
      flower.name,
      ...flower.colors,
      ...flower.occasions
    ]))].slice(0, 8);

    this.searchSuggestions.innerHTML = suggestions
      .map(suggestion => `<div class="suggestion-item" data-suggestion="${suggestion}">${suggestion}</div>`)
      .join('');

    this.searchSuggestions.style.display = 'block';

    // Add click handlers to suggestions
    this.searchSuggestions.querySelectorAll('.suggestion-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (this.searchInput) {
          this.searchInput.value = e.target.dataset.suggestion;
          this.handleSearch({ target: this.searchInput });
        }
        this.hideSearchSuggestions();
      });
    });
  }

  hideSearchSuggestions() {
    if (this.searchSuggestions) {
      this.searchSuggestions.style.display = 'none';
    }
  }

  updateSearchClear(query) {
    if (this.searchClear) {
      this.searchClear.style.display = query ? 'block' : 'none';
    }
  }

  clearSearch() {
    if (this.searchInput) {
      this.searchInput.value = '';
      this.handleSearch({ target: this.searchInput });
    }
  }

  handleFilter() {
    const colorFilter = this.colorFilter?.value || '';
    const occasionFilter = this.occasionFilter?.value || '';

    this.filteredFlowers = this.flowers.filter(flower => {
      const matchesColor = !colorFilter || flower.colors.includes(colorFilter);
      const matchesOccasion = !occasionFilter || flower.occasions.includes(occasionFilter);
      return matchesColor && matchesOccasion;
    });

    this.currentCardIndex = 0;
    this.renderFlowers();
  }

  switchView(view) {
    this.currentView = view;
    
    // Update button states
    if (this.carouselView && this.listView) {
      this.carouselView.classList.toggle('active', view === 'carousel');
      this.listView.classList.toggle('active', view === 'list');
    }

    this.renderFlowers();
  }

  renderFlowers() {
    if (this.filteredFlowers.length === 0) {
      this.showNoResults();
      return;
    }

    this.hideNoResults();

    if (this.currentView === 'carousel') {
      this.renderCarousel();
    } else {
      this.renderList();
    }

    this.updateNavigation();
  }

  renderCarousel() {
    // Mobile carousel
    if (this.mobileCarousel) {
      this.mobileCarousel.innerHTML = this.filteredFlowers
        .map((flower, index) => this.createFlowerCard(flower, index))
        .join('');
      this.mobileCarousel.style.display = 'block';
    }

    if (this.mobileList) {
      this.mobileList.style.display = 'none';
    }

    // Desktop grid (shows multiple cards)
    if (this.desktopGrid) {
      this.desktopGrid.innerHTML = this.filteredFlowers
        .map((flower, index) => this.createFlowerCard(flower, index))
        .join('');
      this.desktopGrid.style.display = 'grid';
    }
  }

  renderList() {
    // Mobile list
    if (this.mobileList) {
      this.mobileList.innerHTML = this.filteredFlowers
        .map((flower, index) => this.createFlowerListItem(flower, index))
        .join('');
      this.mobileList.style.display = 'block';
    }

    if (this.mobileCarousel) {
      this.mobileCarousel.style.display = 'none';
    }

    // Desktop still shows grid but in list style
    if (this.desktopGrid) {
      this.desktopGrid.innerHTML = this.filteredFlowers
        .map((flower, index) => this.createFlowerListItem(flower, index))
        .join('');
      this.desktopGrid.style.display = 'block';
    }
  }

  createFlowerCard(flower, index) {
    return `
      <div class="flower-card ${index === this.currentCardIndex ? 'active' : ''}" data-index="${index}">
        <div class="flower-image">
          <img src="${flower.image}" alt="${flower.name}" loading="lazy">
        </div>
        <div class="flower-info">
          <h3>${flower.name}</h3>
          <p>${flower.description}</p>
          <div class="flower-colors">
            ${flower.colors.map(color => `<span class="color-dot color-${color}" title="${color}"></span>`).join('')}
          </div>
          <div class="flower-occasions">
            ${flower.occasions.map(occasion => `<span class="occasion-tag">${occasion}</span>`).join('')}
          </div>
        </div>
      </div>
    `;
  }

  createFlowerListItem(flower, index) {
    return `
      <div class="flower-list-item" data-index="${index}">
        <div class="flower-image-small">
          <img src="${flower.image}" alt="${flower.name}" loading="lazy">
        </div>
        <div class="flower-details">
          <h4>${flower.name}</h4>
          <p>${flower.description}</p>
          <div class="flower-meta">
            <span class="season">Season: ${flower.season}</span>
            <div class="colors">
              ${flower.colors.map(color => `<span class="color-dot-small color-${color}"></span>`).join('')}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  showNoResults() {
    if (this.noResultsSection) {
      this.noResultsSection.style.display = 'block';
    }
    
    // Hide other sections
    if (this.mobileCarousel) this.mobileCarousel.style.display = 'none';
    if (this.mobileList) this.mobileList.style.display = 'none';
    if (this.desktopGrid) this.desktopGrid.style.display = 'none';
  }

  hideNoResults() {
    if (this.noResultsSection) {
      this.noResultsSection.style.display = 'none';
    }
  }

  updateNavigation() {
    // Update navigation buttons
    if (this.prevBtn) {
      this.prevBtn.disabled = this.currentCardIndex === 0;
    }
    
    if (this.nextBtn) {
      this.nextBtn.disabled = this.currentCardIndex >= this.filteredFlowers.length - 1;
    }

    // Update dropdown navigation
    this.updateNavDropdown();
  }

  updateNavDropdown() {
    if (!this.flowerNavText || !this.flowerNavList) return;

    const currentFlower = this.filteredFlowers[this.currentCardIndex];
    if (currentFlower) {
      this.flowerNavText.textContent = currentFlower.name;
    }

    // Populate dropdown
    this.flowerNavList.innerHTML = this.filteredFlowers
      .map((flower, index) => `
        <li class="nav-item ${index === this.currentCardIndex ? 'active' : ''}" data-index="${index}">
          ${flower.name}
        </li>
      `).join('');

    // Add click handlers
    this.flowerNavList.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        this.currentCardIndex = parseInt(e.target.dataset.index);
        this.renderFlowers();
        this.toggleNavDropdown();
      });
    });
  }

  previousCard() {
    if (this.currentCardIndex > 0) {
      this.currentCardIndex--;
      this.renderFlowers();
    }
  }

  nextCard() {
    if (this.currentCardIndex < this.filteredFlowers.length - 1) {
      this.currentCardIndex++;
      this.renderFlowers();
    }
  }

  toggleNavDropdown() {
    if (this.flowerNavDropdown) {
      const isOpen = this.flowerNavDropdown.classList.contains('open');
      this.flowerNavDropdown.classList.toggle('open', !isOpen);
    }
  }

  setupTouchEvents() {
    let startX = 0;
    let startY = 0;
    let endX = 0;
    let endY = 0;

    const carousel = this.mobileCarousel;
    if (!carousel) return;

    carousel.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    });

    carousel.addEventListener('touchend', (e) => {
      endX = e.changedTouches[0].clientX;
      endY = e.changedTouches[0].clientY;
      this.handleSwipe();
    });
  }

  handleSwipe() {
    const deltaX = this.endX - this.startX;
    const deltaY = this.endY - this.startY;
    const minSwipeDistance = 50;

    // Only handle horizontal swipes
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > minSwipeDistance) {
      if (deltaX > 0) {
        this.previousCard();
      } else {
        this.nextCard();
      }
    }
  }

  async handleFormSubmit(event) {
    event.preventDefault();
    
    const formData = new FormData(this.flowerRequestForm);
    const requestData = Object.fromEntries(formData.entries());

    try {
      const response = await fetch('/api/flower-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      const result = await response.json();

      if (result.success) {
        alert('Thank you for your flower request! We\'ll get back to you soon.');
        this.flowerRequestForm.reset();
      } else {
        throw new Error(result.error || 'Request failed');
      }
    } catch (error) {
      console.error('Flower request failed:', error);
      alert('Sorry, there was an error sending your request. Please try again.');
    }
  }
}

// Auto-initialize flower manager - DISABLED
// This conflicts with the legacy implementation in index.astro
// which provides more complete functionality
/*
if (typeof window !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    window.flowerManager = new FlowerManager();
  });
}
*/
