// Booking functionality module
export class BookingManager {
  constructor() {
    this.PRICE_PER_BOUQUET = 35;
    this.initializeElements();
    this.setupEventListeners();
    this.loadAvailability();
  }

  initializeElements() {
    this.bookingForm = document.getElementById('bookingForm');
    this.bookNowBtn = document.getElementById('bookNowBtn');
    this.bookingBtnText = document.getElementById('bookingBtnText');
    this.bookingSpinner = document.getElementById('bookingSpinner');
    this.visitDateInput = document.getElementById('visitDate');
    this.preferredTimeSelect = document.getElementById('preferredTime');
    this.visitorsSelect = document.getElementById('numberOfVisitors');
    this.phoneInput = document.getElementById('phone');
  }

  setupEventListeners() {
    // Form submission
    this.bookingForm?.addEventListener('submit', (e) => this.handleSubmit(e));
    
    // Visitor count change
    this.visitorsSelect?.addEventListener('change', () => this.updateTotalPrice());
    
    // Phone formatting
    this.phoneInput?.addEventListener('input', (e) => this.formatPhone(e));
  }

  async loadAvailability() {
    try {
      const response = await fetch('/api/availability');
      if (!response.ok) throw new Error('Failed to load availability');
      
      const availability = await response.json();
      this.setupDateSelection(availability);
    } catch (error) {
      console.error('Error loading availability:', error);
    }
  }

  setupDateSelection(availability) {
    const validDates = Object.keys(availability);
    if (!this.visitDateInput || validDates.length === 0) return;

    this.visitDateInput.min = validDates[0] ?? new Date().toISOString().split('T')[0];
    this.visitDateInput.max = validDates.at(-1) ?? '';

    this.visitDateInput.addEventListener('change', (e) => {
      const selected = e.target.value;
      this.populateTimes(availability[selected] || []);
    });

    // Set first available date
    const today = new Date().toISOString().split('T')[0];
    const firstValid = validDates.find(d => d >= today);
    if (firstValid) {
      this.visitDateInput.value = firstValid;
      this.populateTimes(availability[firstValid] || []);
    }
  }

  populateTimes(times) {
    if (!this.preferredTimeSelect) return;
    
    this.preferredTimeSelect.innerHTML = '<option value="">Select time</option>';
    times.forEach(time => {
      const opt = document.createElement('option');
      opt.value = time;
      opt.textContent = time;
      this.preferredTimeSelect.appendChild(opt);
    });
  }

  updateTotalPrice() {
    const count = parseInt(this.visitorsSelect?.value) || 1;
    const total = count * this.PRICE_PER_BOUQUET;
    // Update any total display elements if they exist
    const totalElement = document.getElementById('totalPrice');
    if (totalElement) {
      totalElement.textContent = `$${total}`;
    }
  }

  formatPhone(e) {
    const input = e.target;
    let v = input.value.replace(/\D/g, '');
    if (v.length > 6) v = v.replace(/(\d{3})(\d{3})(\d+)/, '($1) $2-$3');
    else if (v.length > 3) v = v.replace(/(\d{3})(\d+)/, '($1) $2');
    input.value = v;
  }

  validateForm() {
    let valid = true;
    const requiredFields = ['fullName', 'email', 'phone', 'visitDate', 'preferredTime'];
    
    requiredFields.forEach(id => {
      const el = document.getElementById(id);
      if (!el?.value?.trim()) {
        el?.classList.add('border-red-500');
        valid = false;
      } else {
        el?.classList.remove('border-red-500');
      }
    });
    
    return valid;
  }

  async handleSubmit(e) {
    e.preventDefault();
    if (!this.validateForm()) {
      alert('Please complete all required fields.');
      return;
    }

    const formData = new FormData(this.bookingForm);
    const numberOfVisitors = parseInt(formData.get('numberOfVisitors')) || 1;

    const booking = {
      fullName: formData.get('fullName'),
      email: formData.get('email'),
      phone: formData.get('phone'),
      visitDate: formData.get('visitDate'),
      preferredTime: formData.get('preferredTime'),
      numberOfVisitors,
      totalAmount: numberOfVisitors * this.PRICE_PER_BOUQUET
    };

    // Loading state
    if (this.bookNowBtn) this.bookNowBtn.disabled = true;
    this.bookingBtnText?.classList.add('hidden');
    this.bookingSpinner?.classList.remove('hidden');

    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(booking)
      });
      
      const result = await res.json();
      
      if (!res.ok) {
        alert(result.error || 'There was an error with your booking. Please try again.');
        return;
      }

      // Success
      alert(result.message || 'Booking successful! You will receive a confirmation email.');
      this.bookingForm.reset();
      this.updateTotalPrice();
      await this.loadAvailability(); // Refresh times

    } catch (err) {
      console.error('Booking error:', err);
      alert('There was a network error. Please check your connection and try again.');
    } finally {
      if (this.bookNowBtn) this.bookNowBtn.disabled = false;
      this.bookingBtnText?.classList.remove('hidden');
      this.bookingSpinner?.classList.add('hidden');
    }
  }
}
