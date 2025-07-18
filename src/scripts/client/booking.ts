// Booking functionality module
export class BookingManager {
  private currentPrice = 35.00; // Fallback price, loaded dynamically

  // Business timezone helper - Alberta, Canada (Mountain Time)
  private getBusinessToday(): string {
    return new Date().toLocaleDateString('en-CA', {
      timeZone: 'America/Edmonton'
    }); // Returns YYYY-MM-DD format
  }

  // Load dynamic pricing from API
  private async loadPricing(): Promise<void> {
    try {
      const response = await fetch('/api/settings/pricing');
      const data = await response.json();
      this.currentPrice = parseFloat(data.price_per_bouquet) || 35.00;

      console.log('BookingManager loaded dynamic pricing:', this.currentPrice);

      // Update price display if elements exist
      this.updateTotalPrice();
    } catch (error) {
      console.error('BookingManager failed to load pricing:', error);
      // Keep fallback price
      this.currentPrice = 35.00;
    }
  }
  private bookingForm: HTMLFormElement | null = null;
  private bookNowBtn: HTMLButtonElement | null = null;
  private bookingBtnText: HTMLElement | null = null;
  private bookingSpinner: HTMLElement | null = null;
  private visitDateInput: HTMLInputElement | null = null;
  private preferredTimeSelect: HTMLSelectElement | null = null;
  private bouquetsSelect: HTMLSelectElement | null = null;
  private phoneInput: HTMLInputElement | null = null;

  constructor() {
    this.initializeElements();
    this.setupEventListeners();
    this.loadAvailability();
    this.loadPricing();
  }

  private initializeElements(): void {
    this.bookingForm = document.getElementById('bookingForm') as HTMLFormElement;
    this.bookNowBtn = document.getElementById('bookNowBtn') as HTMLButtonElement;
    this.bookingBtnText = document.getElementById('bookingBtnText') as HTMLElement;
    this.bookingSpinner = document.getElementById('bookingSpinner') as HTMLElement;
    this.visitDateInput = document.getElementById('visitDate') as HTMLInputElement;
    this.preferredTimeSelect = document.getElementById('preferredTime') as HTMLSelectElement;
    this.bouquetsSelect = document.getElementById('numberOfBouquets') as HTMLSelectElement;
    this.phoneInput = document.getElementById('phone') as HTMLInputElement;
  }

  private setupEventListeners(): void {
    if (this.bookingForm) {
      this.bookingForm.addEventListener('submit', this.handleBookingSubmit.bind(this));
    }

    if (this.visitDateInput) {
      this.visitDateInput.addEventListener('change', this.handleDateChange.bind(this));
    }

    if (this.bouquetsSelect) {
      this.bouquetsSelect.addEventListener('change', this.updateTotalPrice.bind(this));
    }

    if (this.phoneInput) {
      this.phoneInput.addEventListener('input', this.formatPhoneNumber.bind(this));
    }
  }

  private async loadAvailability(): Promise<void> {
    try {
      const response = await fetch('/api/availability');
      const availability = await response.json();
      
      this.populateDateOptions(availability);
    } catch (error) {
      console.error('Failed to load availability:', error);
    }
  }

  private populateDateOptions(availability: Record<string, string[]>): void {
    if (!this.visitDateInput) return;

    // Clear existing options
    this.visitDateInput.innerHTML = '<option value="">Select a date</option>';

    // Add available dates
    Object.keys(availability).forEach(date => {
      const option = document.createElement('option');
      option.value = date;
      option.textContent = new Date(date).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      this.visitDateInput?.appendChild(option);
    });
  }

  private async handleDateChange(): Promise<void> {
    const selectedDate = this.visitDateInput?.value;
    if (!selectedDate) return;

    try {
      const response = await fetch('/api/availability');
      const availability = await response.json();
      
      this.populateTimeOptions(availability[selectedDate] || []);
    } catch (error) {
      console.error('Failed to load time slots:', error);
    }
  }

  private populateTimeOptions(timeSlots: string[]): void {
    if (!this.preferredTimeSelect) return;

    // Clear existing options
    this.preferredTimeSelect.innerHTML = '<option value="">Select a time</option>';

    // Add available time slots
    timeSlots.forEach(time => {
      const option = document.createElement('option');
      option.value = time;
      option.textContent = time;
      this.preferredTimeSelect?.appendChild(option);
    });
  }

  private updateTotalPrice(): void {
    const bouquetsElement = document.getElementById('numberOfBouquets') as HTMLSelectElement;
    const totalElement = document.getElementById('totalPrice');
    
    if (!bouquetsElement || !totalElement) return;

    const numberOfBouquets = parseInt(bouquetsElement.value) || 1;
    const total = numberOfBouquets * this.currentPrice;
    
    totalElement.textContent = `$${total.toFixed(2)} CAD`;
  }

  private formatPhoneNumber(event: Event): void {
    const input = event.target as HTMLInputElement;
    let value = input.value.replace(/\D/g, '');
    
    if (value.length >= 6) {
      value = value.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
    } else if (value.length >= 3) {
      value = value.replace(/(\d{3})(\d{0,3})/, '($1) $2');
    }
    
    input.value = value;
  }

  private async handleBookingSubmit(event: Event): Promise<void> {
    event.preventDefault();
    
    if (!this.bookingForm) return;

    // Show loading state
    this.setLoadingState(true);

    try {
      const formData = new FormData(this.bookingForm);
      const bookingData = Object.fromEntries(formData.entries());

      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bookingData),
      });

      const result = await response.json();

      if (result.success) {
        // Redirect to confirmation page
        window.location.href = `/booking-confirmation?booking_id=${result.bookingId}`;
      } else {
        throw new Error(result.error || 'Booking failed');
      }
    } catch (error) {
      console.error('Booking submission failed:', error);
      alert('Sorry, there was an error processing your booking. Please try again.');
    } finally {
      this.setLoadingState(false);
    }
  }

  private setLoadingState(loading: boolean): void {
    if (this.bookNowBtn) {
      this.bookNowBtn.disabled = loading;
    }
    
    if (this.bookingBtnText) {
      this.bookingBtnText.textContent = loading ? 'Processing...' : 'Book Now';
    }
    
    if (this.bookingSpinner) {
      this.bookingSpinner.style.display = loading ? 'inline-block' : 'none';
    }
  }
}

// Auto-initialize booking manager
if (typeof window !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    window.bookingManager = new BookingManager();
  });
}
