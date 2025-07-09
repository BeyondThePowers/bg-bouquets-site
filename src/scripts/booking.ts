// Booking functionality module
export class BookingManager {
  private readonly PRICE_PER_BOUQUET = 35;

  // Business timezone helper - Alberta, Canada (Mountain Time)
  private getBusinessToday(): string {
    return new Date().toLocaleDateString('en-CA', {
      timeZone: 'America/Edmonton'
    }); // Returns YYYY-MM-DD format
  }
  private bookingForm: HTMLFormElement | null = null;
  private bookNowBtn: HTMLButtonElement | null = null;
  private bookingBtnText: HTMLElement | null = null;
  private bookingSpinner: HTMLElement | null = null;
  private visitDateInput: HTMLInputElement | null = null;
  private preferredTimeSelect: HTMLSelectElement | null = null;
  private visitorsSelect: HTMLSelectElement | null = null;
  private phoneInput: HTMLInputElement | null = null;

  constructor() {
    this.initializeElements();
    this.setupEventListeners();
    this.loadAvailability();
  }

  private initializeElements(): void {
    this.bookingForm = document.getElementById('bookingForm') as HTMLFormElement;
    this.bookNowBtn = document.getElementById('bookNowBtn') as HTMLButtonElement;
    this.bookingBtnText = document.getElementById('bookingBtnText') as HTMLElement;
    this.bookingSpinner = document.getElementById('bookingSpinner') as HTMLElement;
    this.visitDateInput = document.getElementById('visitDate') as HTMLInputElement;
    this.preferredTimeSelect = document.getElementById('preferredTime') as HTMLSelectElement;
    this.visitorsSelect = document.getElementById('numberOfVisitors') as HTMLSelectElement;
    this.phoneInput = document.getElementById('phone') as HTMLInputElement;
  }

  private setupEventListeners(): void {
    // Form submission
    this.bookingForm?.addEventListener('submit', (e: Event) => this.handleSubmit(e));
    
    // Visitor count change
    this.visitorsSelect?.addEventListener('change', () => this.updateTotalPrice());
    
    // Phone formatting
    this.phoneInput?.addEventListener('input', (e: Event) => this.formatPhone(e));
  }

  private async loadAvailability(): Promise<void> {
    try {
      const response = await fetch('/api/availability');
      if (!response.ok) throw new Error('Failed to load availability');
      
      const availability: Record<string, string[]> = await response.json();
      this.setupDateSelection(availability);
    } catch (error) {
      console.error('Error loading availability:', error);
    }
  }

  private setupDateSelection(availability: Record<string, string[]>): void {
    const validDates = Object.keys(availability);
    if (!this.visitDateInput || validDates.length === 0) return;

    this.visitDateInput.min = validDates[0] ?? this.getBusinessToday();
    this.visitDateInput.max = validDates.at(-1) ?? '';

    this.visitDateInput.addEventListener('change', (e: Event) => {
      const target = e.target as HTMLInputElement;
      const selected = target.value;
      this.populateTimes(availability[selected] || []);
    });

    // Set first available date (using business timezone)
    const businessToday = this.getBusinessToday();
    const firstValid = validDates.find((d: string) => d >= businessToday);
    if (firstValid) {
      this.visitDateInput.value = firstValid;
      this.populateTimes(availability[firstValid] || []);
    }
  }

  private populateTimes(times: string[]): void {
    if (!this.preferredTimeSelect) return;
    
    this.preferredTimeSelect.innerHTML = '<option value="">Select time</option>';
    times.forEach((time: string) => {
      const opt = document.createElement('option');
      opt.value = time;
      opt.textContent = time;
      this.preferredTimeSelect!.appendChild(opt);
    });
  }

  private updateTotalPrice(): void {
    const count = parseInt(this.visitorsSelect?.value || '1') || 1;
    const total = count * this.PRICE_PER_BOUQUET;
    // Update any total display elements if they exist
    const totalElement = document.getElementById('totalPrice');
    if (totalElement) {
      totalElement.textContent = `$${total}`;
    }
  }

  private formatPhone(e: Event): void {
    const input = e.target as HTMLInputElement;
    let v = input.value.replace(/\D/g, '');
    if (v.length > 6) v = v.replace(/(\d{3})(\d{3})(\d+)/, '($1) $2-$3');
    else if (v.length > 3) v = v.replace(/(\d{3})(\d+)/, '($1) $2');
    input.value = v;
  }

  private validateForm(): boolean {
    let valid = true;
    const requiredFields = ['fullName', 'email', 'phone', 'visitDate', 'preferredTime'];
    
    requiredFields.forEach((id: string) => {
      const el = document.getElementById(id) as HTMLInputElement | HTMLSelectElement;
      if (!el?.value?.trim()) {
        el?.classList.add('border-red-500');
        valid = false;
      } else {
        el?.classList.remove('border-red-500');
      }
    });
    
    return valid;
  }

  private async handleSubmit(e: Event): Promise<void> {
    e.preventDefault();
    if (!this.validateForm()) {
      alert('Please complete all required fields.');
      return;
    }

    if (!this.bookingForm) {
      console.error('Booking form not found');
      return;
    }

    const formData = new FormData(this.bookingForm);
    const numberOfVisitors = parseInt(formData.get('numberOfVisitors') as string) || 1;

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

    } catch (err: unknown) {
      console.error('Booking error:', err);
      alert('There was a network error. Please check your connection and try again.');
    } finally {
      if (this.bookNowBtn) this.bookNowBtn.disabled = false;
      this.bookingBtnText?.classList.remove('hidden');
      this.bookingSpinner?.classList.add('hidden');
    }
  }
}
