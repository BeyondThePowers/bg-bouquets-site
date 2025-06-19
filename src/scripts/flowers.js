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
        occasions: ["wedding", "anniversary", "everyday"],
        image: "/src/assets/images/flowers/roses.webp"
      },
      {
        name: "Sunflowers",
        description: "Bright, cheerful flowers that follow the sun",
        colors: ["yellow", "orange"],
        occasions: ["birthday", "everyday"],
        image: "/src/assets/images/flowers/sunflowers.webp"
      },
      {
        name: "Tulips",
        description: "Elegant spring flowers in vibrant colors",
        colors: ["red", "pink", "white", "yellow", "purple"],
        occasions: ["wedding", "birthday", "everyday"],
        image: "/src/assets/images/flowers/tulips.webp"
      },
      {
        name: "Daisies",
        description: "Simple, pure white flowers with yellow centers",
        colors: ["white", "yellow"],
        occasions: ["everyday", "sympathy"],
        image: "/src/assets/images/flowers/daisies.webp"
      },
      {
        name: "Lavender",
        description: "Fragrant purple flowers perfect for relaxation",
        colors: ["purple"],
        occasions: ["wedding", "everyday"],
        image: "/src/assets/images/flowers/lavender.webp"
      }
    ];
    
    this.filteredFlowers = [...this.flowers];
    this.updateDisplay();
  }

  setupEventListeners() {
    // Search functionality
    this.searchInput?.addEventListener('input', this.debounce(() => this.handleSearch(), 300));
    this.searchInput?.addEventListener('focus', () => this.showSuggestions());
    this.searchInput?.addEventListener('blur', this.debounce(() => this.hideSuggestions(), 200));
    this.searchClear?.addEventListener('click', () => this.clearSearch());

    // Filter functionality
    this.colorFilter?.addEventListener('change', () => this.applyFilters());
    this.occasionFilter?.addEventListener('change', () => this.applyFilters());

    // View toggle
    this.carouselView?.addEventListener('click', () => this.switchView('carousel'));
    this.listView?.addEventListener('click', () => this.switchView('list'));

    // Navigation
    this.prevBtn?.addEventListener('click', () => this.previousCard());
    this.nextBtn?.addEventListener('click', () => this.nextCard());
    this.flowerNavBtn?.addEventListener('click', () => this.toggleFlowerNavDropdown());

    // Form submission
    this.flowerRequestForm?.addEventListener('submit', (e) => this.handleFlowerRequest(e));

    // Window resize
    window.addEventListener('resize', this.debounce(() => this.updateDisplay(), 250));
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

  handleSearch() {
    const query = this.searchInput?.value.toLowerCase() || '';
    
    if (query.length > 0) {
      this.searchClear?.classList.remove('hidden');
    } else {
      this.searchClear?.classList.add('hidden');
    }
    
    this.applyFilters();
  }

  clearSearch() {
    if (this.searchInput) {
      this.searchInput.value = '';
    }
    this.searchClear?.classList.add('hidden');
    this.applyFilters();
  }

  applyFilters() {
    const query = this.searchInput?.value.toLowerCase() || '';
    const color = this.colorFilter?.value || '';
    const occasion = this.occasionFilter?.value || '';

    this.filteredFlowers = this.flowers.filter(flower => {
      const matchesSearch = !query || 
        flower.name.toLowerCase().includes(query) ||
        flower.description.toLowerCase().includes(query);
      
      const matchesColor = !color || flower.colors.includes(color);
      const matchesOccasion = !occasion || flower.occasions.includes(occasion);

      return matchesSearch && matchesColor && matchesOccasion;
    });

    this.currentCardIndex = 0;
    this.updateDisplay();
  }

  switchView(view) {
    this.currentView = view;
    
    if (view === 'carousel') {
      this.carouselView?.classList.add('active');
      this.listView?.classList.remove('active');
      this.mobileCarousel?.classList.remove('hidden');
      this.mobileList?.classList.add('hidden');
    } else {
      this.listView?.classList.add('active');
      this.carouselView?.classList.remove('active');
      this.mobileList?.classList.remove('hidden');
      this.mobileCarousel?.classList.add('hidden');
    }
    
    this.updateDisplay();
  }

  previousCard() {
    if (this.filteredFlowers.length === 0) return;
    this.currentCardIndex = (this.currentCardIndex - 1 + this.filteredFlowers.length) % this.filteredFlowers.length;
    this.updateDisplay();
  }

  nextCard() {
    if (this.filteredFlowers.length === 0) return;
    this.currentCardIndex = (this.currentCardIndex + 1) % this.filteredFlowers.length;
    this.updateDisplay();
  }

  toggleFlowerNavDropdown() {
    if (!this.flowerNavDropdown) return;
    
    if (this.flowerNavDropdown.classList.contains('hidden')) {
      this.showFlowerNavDropdown();
    } else {
      this.hideFlowerNavDropdown();
    }
  }

  showFlowerNavDropdown() {
    this.flowerNavDropdown?.classList.remove('hidden');
  }

  hideFlowerNavDropdown() {
    this.flowerNavDropdown?.classList.add('hidden');
  }

  showSuggestions() {
    const query = this.searchInput?.value.toLowerCase() || '';
    if (query.length < 2) {
      this.hideSuggestions();
      return;
    }

    const suggestions = this.flowers
      .filter(flower => flower.name.toLowerCase().includes(query))
      .map(flower => flower.name)
      .slice(0, 5);

    if (this.searchSuggestions && suggestions.length > 0) {
      this.searchSuggestions.innerHTML = suggestions.map(suggestion => `
        <div class="px-4 py-2 hover:bg-shabby-pink cursor-pointer font-roboto text-sm" 
             style="color: #333333;" 
             onclick="window.selectSuggestion('${suggestion}')">
          ${suggestion}
        </div>
      `).join('');
      this.searchSuggestions.classList.remove('hidden');
    }
  }

  hideSuggestions() {
    this.searchSuggestions?.classList.add('hidden');
  }

  updateDisplay() {
    const hasResults = this.filteredFlowers.length > 0;
    
    // Show/hide no results section
    if (this.noResultsSection) {
      if (hasResults) {
        this.noResultsSection.classList.add('hidden');
      } else {
        this.noResultsSection.classList.remove('hidden');
        // Pre-fill the search term in the request form
        const requestedFlowerInput = document.getElementById('requestedFlower');
        if (requestedFlowerInput && this.searchInput?.value) {
          requestedFlowerInput.value = this.searchInput.value;
        }
      }
    }

    if (hasResults) {
      this.updateCarousel();
      this.updateList();
      this.updateDesktopGrid();
      this.updateCarouselControls();
      this.updateFlowerNavigation();
    }
  }

  updateCarousel() {
    const carouselTrack = document.getElementById('carouselTrack');
    if (!carouselTrack) return;
    
    carouselTrack.innerHTML = this.filteredFlowers.map(flower => this.createFlowerCard(flower, false)).join('');
  }

  updateList() {
    const listContainer = document.getElementById('listContainer');
    if (!listContainer) return;
    
    listContainer.innerHTML = this.filteredFlowers.map(flower => this.createListItem(flower)).join('');
  }

  updateDesktopGrid() {
    if (!this.desktopGrid) return;
    this.desktopGrid.innerHTML = this.filteredFlowers.map(flower => this.createFlowerCard(flower, true)).join('');
  }

  updateCarouselControls() {
    const hasFlowers = this.filteredFlowers.length > 0;
    
    if (this.prevBtn) {
      this.prevBtn.disabled = !hasFlowers;
      this.prevBtn.style.opacity = hasFlowers ? '1' : '0.5';
    }
    
    if (this.nextBtn) {
      this.nextBtn.disabled = !hasFlowers;
      this.nextBtn.style.opacity = hasFlowers ? '1' : '0.5';
    }
  }

  updateFlowerNavigation() {
    if (!this.flowerNavText || !this.flowerNavList) return;
    
    const totalFlowers = this.filteredFlowers.length;
    const currentFlower = this.filteredFlowers[this.currentCardIndex];
    
    if (totalFlowers > 0 && currentFlower) {
      this.flowerNavText.textContent = `${currentFlower.name} (${this.currentCardIndex + 1} of ${totalFlowers})`;
    } else {
      this.flowerNavText.textContent = '0 of 0';
    }
    
    // Update dropdown list
    this.flowerNavList.innerHTML = '';
    this.filteredFlowers.forEach((flower, index) => {
      const item = document.createElement('button');
      item.className = `w-full text-left px-3 py-2 rounded font-roboto text-sm transition-colors duration-200 ${
        index === this.currentCardIndex ? 'font-semibold' : 'hover:bg-shabby-pink'
      }`;
      item.style.backgroundColor = index === this.currentCardIndex ? '#F8E7E8' : 'transparent';
      item.style.color = '#333333';
      item.textContent = `${index + 1}. ${flower.name}`;
      item.setAttribute('aria-label', `Go to ${flower.name}`);
      
      item.addEventListener('click', () => {
        this.currentCardIndex = index;
        this.hideFlowerNavDropdown();
        this.updateDisplay();
      });
      
      this.flowerNavList.appendChild(item);
    });
  }

  createFlowerCard(flower, isDesktop) {
    return `
      <div class="flower-card ${isDesktop ? 'desktop-card' : 'mobile-card'} bg-white rounded-lg shadow-md overflow-hidden">
        <img src="${flower.image}" alt="${flower.name}" class="w-full h-48 object-cover" loading="lazy" />
        <div class="p-4">
          <h3 class="text-lg font-playfair font-bold mb-2 text-charcoal">${flower.name}</h3>
          <p class="text-sm font-roboto mb-3 text-charcoal">${flower.description}</p>
          <div class="flex flex-wrap gap-1">
            ${flower.colors.map(color => `<span class="px-2 py-1 text-xs rounded bg-${color}-100 text-${color}-800">${color}</span>`).join('')}
          </div>
        </div>
      </div>
    `;
  }

  createListItem(flower) {
    return `
      <div class="flower-list-item flex items-center space-x-4 p-4 bg-white rounded-lg shadow-sm">
        <img src="${flower.image}" alt="${flower.name}" class="w-16 h-16 object-cover rounded" loading="lazy" />
        <div class="flex-1">
          <h3 class="text-lg font-playfair font-bold mb-1 text-charcoal">${flower.name}</h3>
          <p class="text-sm font-roboto mb-2 text-charcoal">${flower.description}</p>
          <div class="flex flex-wrap gap-1">
            ${flower.colors.map(color => `<span class="px-2 py-1 text-xs rounded bg-${color}-100 text-${color}-800">${color}</span>`).join('')}
          </div>
        </div>
      </div>
    `;
  }

  handleFlowerRequest(e) {
    e.preventDefault();
    
    const formData = new FormData(this.flowerRequestForm);
    const requestData = {
      flower: formData.get('requestedFlower'),
      email: formData.get('requesterEmail'),
      notes: formData.get('requestNotes')
    };
    
    // Simulate form submission
    alert(`Thank you for your flower request!\n\nFlower: ${requestData.flower}\nEmail: ${requestData.email}\n\nWe'll get back to you soon about availability.`);
    
    this.flowerRequestForm.reset();
  }
}

// Global function for suggestion selection
window.selectSuggestion = function(suggestion) {
  const searchInput = document.getElementById('flowerSearch');
  if (searchInput) {
    searchInput.value = suggestion;
    searchInput.dispatchEvent(new Event('input'));
  }
  
  const searchSuggestions = document.getElementById('searchSuggestions');
  searchSuggestions?.classList.add('hidden');
};
