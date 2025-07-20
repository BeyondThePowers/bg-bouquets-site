/**
 * Schedule Lock Management
 * Allows admins to lock the schedule during updates and schedule future updates
 */

document.addEventListener('DOMContentLoaded', () => {
  // Only initialize if we're on the admin page
  if (document.getElementById('adminContent')) {
    initScheduleLockUI();
  }
});

async function initScheduleLockUI() {
  // Add the schedule lock UI to the schedule settings section
  const scheduleSection = document.querySelector('.admin-section h2')?.closest('.admin-section');
  
  if (!scheduleSection) {
    console.error('Schedule settings section not found');
    return;
  }
  
  // Create the schedule lock UI
  const lockUI = document.createElement('div');
  lockUI.className = 'schedule-lock-controls';
  lockUI.innerHTML = `
    <div class="lock-status-indicator">
      <div class="lock-status">
        <span class="status-text">Schedule is <span class="unlock-status">unlocked</span><span class="lock-status hidden">locked</span></span>
        <span class="status-indicator unlocked"></span>
      </div>
      <p class="status-description">Customers can currently make bookings. Lock the schedule to make changes.</p>
    </div>
    
    <div class="lock-action-buttons">
      <button id="lockScheduleBtn" class="btn btn-warning">
        <span class="btn-text">Lock Schedule for Updates</span>
        <span class="btn-spinner hidden">⟳</span>
      </button>
      <button id="scheduleUpdateBtn" class="btn btn-secondary">
        <span class="btn-text">Schedule Update for Later</span>
        <span class="btn-spinner hidden">⟳</span>
      </button>
      <button id="applyChangesBtn" class="btn btn-primary hidden">
        <span class="btn-text">Apply Changes & Unlock</span>
        <span class="btn-spinner hidden">⟳</span>
      </button>
    </div>
    
    <div id="scheduleLockMessage" class="hidden"></div>
    
    <div class="schedule-update-modal hidden" id="scheduleUpdateModal">
      <div class="modal-content">
        <h3>Schedule Update for Later</h3>
        <p>Choose when to apply schedule changes. Booking will not be disrupted until the update time.</p>
        
        <div class="form-group">
          <label for="updateDateTime">Update Date/Time:</label>
          <input type="datetime-local" id="updateDateTime" min="${getMinDateTimeString()}">
          <p class="help-text">Updates are applied in the America/Edmonton timezone.</p>
        </div>
        
        <div class="modal-actions">
          <button id="cancelScheduleUpdateBtn" class="btn btn-secondary">Cancel</button>
          <button id="confirmScheduleUpdateBtn" class="btn btn-primary">
            <span class="btn-text">Schedule Update</span>
            <span class="btn-spinner hidden">⟳</span>
          </button>
        </div>
      </div>
    </div>
  `;
  
  // Insert the UI before the Save button
  const saveButton = scheduleSection.querySelector('#saveSchedule');
  if (saveButton) {
    saveButton.parentElement?.insertBefore(lockUI, saveButton);
  } else {
    scheduleSection.appendChild(lockUI);
  }
  
  // Set up event handlers
  setupLockEventHandlers();
  
  // Check current lock status
  await checkLockStatus();
}

function setupLockEventHandlers() {
  // Lock Schedule button
  document.getElementById('lockScheduleBtn')?.addEventListener('click', lockSchedule);
  
  // Apply Changes button
  document.getElementById('applyChangesBtn')?.addEventListener('click', applyChangesAndUnlock);
  
  // Schedule Update button and modal
  document.getElementById('scheduleUpdateBtn')?.addEventListener('click', showScheduleUpdateModal);
  document.getElementById('cancelScheduleUpdateBtn')?.addEventListener('click', hideScheduleUpdateModal);
  document.getElementById('confirmScheduleUpdateBtn')?.addEventListener('click', scheduleUpdate);
  
  // Hide modal when clicking outside
  document.addEventListener('click', (e) => {
    const modal = document.getElementById('scheduleUpdateModal');
    if (modal && !modal.classList.contains('hidden') && !modal.contains(e.target as Node) && 
        (e.target as HTMLElement).id !== 'scheduleUpdateBtn') {
      hideScheduleUpdateModal();
    }
  });
}

async function checkLockStatus() {
  try {
    setButtonLoading('lockScheduleBtn', true);
    
    const response = await fetch('/api/admin/schedule-lock');
    const data = await response.json();
    
    updateLockStatusUI(data.isLocked, data.scheduledUpdate);
  } catch (error) {
    console.error('Error checking lock status:', error);
    showLockMessage('Could not check lock status', 'error');
  } finally {
    setButtonLoading('lockScheduleBtn', false);
  }
}

function updateLockStatusUI(isLocked: boolean, scheduledUpdate: string | null) {
  const lockStatusText = document.querySelector('.unlock-status');
  const lockingStatusText = document.querySelector('.lock-status');
  const statusIndicator = document.querySelector('.status-indicator');
  const statusDescription = document.querySelector('.status-description');
  const lockButton = document.getElementById('lockScheduleBtn');
  const applyButton = document.getElementById('applyChangesBtn');
  const scheduleButton = document.getElementById('scheduleUpdateBtn');
  
  // Update status text and indicator
  if (lockStatusText && lockingStatusText && statusIndicator && statusDescription) {
    if (isLocked) {
      lockStatusText.classList.add('hidden');
      lockingStatusText.classList.remove('hidden');
      statusIndicator.classList.remove('unlocked');
      statusIndicator.classList.add('locked');
      statusDescription.textContent = 'Schedule is locked. Customers cannot make new bookings until you apply changes.';
    } else {
      lockStatusText.classList.remove('hidden');
      lockingStatusText.classList.add('hidden');
      statusIndicator.classList.add('unlocked');
      statusIndicator.classList.remove('locked');
      
      if (scheduledUpdate) {
        const updateTime = new Date(scheduledUpdate).toLocaleString();
        statusDescription.textContent = `Schedule update is planned for ${updateTime}. Customers can continue booking until then.`;
      } else {
        statusDescription.textContent = 'Customers can currently make bookings. Lock the schedule to make changes.';
      }
    }
  }
  
  // Update buttons
  if (lockButton && applyButton && scheduleButton) {
    if (isLocked) {
      lockButton.classList.add('hidden');
      applyButton.classList.remove('hidden');
      scheduleButton.classList.add('hidden');
      
      // Disable all schedule form inputs to prevent editing without applying
      enableScheduleFormInputs(false);
    } else {
      lockButton.classList.remove('hidden');
      applyButton.classList.add('hidden');
      scheduleButton.classList.remove('hidden');
      
      // Enable form inputs
      enableScheduleFormInputs(true);
    }
  }
}

async function lockSchedule() {
  try {
    setButtonLoading('lockScheduleBtn', true);
    
    const response = await fetch('/api/admin/schedule-lock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'lock' })
    });
    
    const result = await response.json();
    
    if (result.success) {
      updateLockStatusUI(true, null);
      showLockMessage(result.message, 'success');
    } else {
      showLockMessage(result.error || 'Failed to lock schedule', 'error');
    }
  } catch (error) {
    console.error('Error locking schedule:', error);
    showLockMessage('Error locking schedule', 'error');
  } finally {
    setButtonLoading('lockScheduleBtn', false);
  }
}

async function applyChangesAndUnlock() {
  try {
    // Collect all schedule settings
    const settings = collectScheduleSettings();
    
    setButtonLoading('applyChangesBtn', true);
    
    const response = await fetch('/api/admin/schedule-lock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'unlock',
        settings
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      updateLockStatusUI(false, null);
      showLockMessage(result.message, 'success');
    } else {
      showLockMessage(result.error || 'Failed to apply changes', 'error');
    }
  } catch (error) {
    console.error('Error applying changes:', error);
    showLockMessage('Error applying changes', 'error');
  } finally {
    setButtonLoading('applyChangesBtn', false);
  }
}

function showScheduleUpdateModal() {
  const modal = document.getElementById('scheduleUpdateModal');
  if (modal) {
    modal.classList.remove('hidden');
  }
}

function hideScheduleUpdateModal() {
  const modal = document.getElementById('scheduleUpdateModal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

async function scheduleUpdate() {
  try {
    const dateTimeInput = document.getElementById('updateDateTime') as HTMLInputElement;
    if (!dateTimeInput || !dateTimeInput.value) {
      showLockMessage('Please select a date and time for the update', 'error');
      return;
    }
    
    // Convert to ISO string
    const scheduledTime = new Date(dateTimeInput.value).toISOString();
    
    // Collect all schedule settings
    const settings = collectScheduleSettings();
    
    setButtonLoading('confirmScheduleUpdateBtn', true);
    
    const response = await fetch('/api/admin/schedule-lock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'schedule',
        scheduledTime,
        settings
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      hideScheduleUpdateModal();
      updateLockStatusUI(false, scheduledTime);
      showLockMessage(result.message, 'success');
    } else {
      showLockMessage(result.error || 'Failed to schedule update', 'error');
    }
  } catch (error) {
    console.error('Error scheduling update:', error);
    showLockMessage('Error scheduling update', 'error');
  } finally {
    setButtonLoading('confirmScheduleUpdateBtn', false);
  }
}

function collectScheduleSettings() {
  // Collect all settings from the form
  const maxBookings = (document.getElementById('maxBookings') as HTMLInputElement)?.value;
  const maxVisitors = (document.getElementById('maxVisitors') as HTMLInputElement)?.value;
  const maxVisitorPasses = (document.getElementById('maxVisitorPassesPerBooking') as HTMLInputElement)?.value;
  
  // Get operating days
  const operatingDays: Record<string, boolean> = {};
  document.querySelectorAll('#operatingDays .toggle-chip').forEach((chip) => {
    const day = (chip as HTMLElement).dataset.day;
    if (day) {
      operatingDays[day] = chip.classList.contains('active');
    }
  });
  
  // Get time slots
  const timeSlots: string[] = [];
  document.querySelectorAll('#timeSlotsGrid .time-slot-checkbox:checked').forEach((checkbox) => {
    const time = (checkbox as HTMLInputElement).value;
    if (time) {
      timeSlots.push(time);
    }
  });
  
  // Get season range
  const seasonStartMonth = (document.getElementById('seasonStartMonth') as HTMLSelectElement)?.value;
  const seasonStartDay = (document.getElementById('seasonStartDay') as HTMLInputElement)?.value;
  const seasonEndMonth = (document.getElementById('seasonEndMonth') as HTMLSelectElement)?.value;
  const seasonEndDay = (document.getElementById('seasonEndDay') as HTMLInputElement)?.value;
  
  return [
    { key: 'max_bookings_per_slot', value: maxBookings },
    { key: 'max_bouquets_per_slot', value: maxVisitors },
    { key: 'max_visitor_passes_per_booking', value: maxVisitorPasses },
    { key: 'operating_days', value: JSON.stringify(operatingDays) },
    { key: 'time_slots', value: JSON.stringify(timeSlots) },
    { key: 'season_start_month', value: seasonStartMonth },
    { key: 'season_start_day', value: seasonStartDay },
    { key: 'season_end_month', value: seasonEndMonth },
    { key: 'season_end_day', value: seasonEndDay }
  ];
}

function enableScheduleFormInputs(enabled: boolean) {
  const inputs = [
    '#maxBookings',
    '#maxVisitors',
    '#maxVisitorPassesPerBooking',
    '#operatingDays .toggle-chip',
    '#timeSlotsGrid input',
    '#seasonStartMonth',
    '#seasonStartDay',
    '#seasonEndMonth',
    '#seasonEndDay'
  ];
  
  inputs.forEach(selector => {
    document.querySelectorAll(selector).forEach(el => {
      (el as HTMLInputElement).disabled = !enabled;
      if (!enabled) {
        el.classList.add('disabled');
      } else {
        el.classList.remove('disabled');
      }
    });
  });
}

function showLockMessage(message: string, type: 'success' | 'error') {
  const messageEl = document.getElementById('scheduleLockMessage');
  if (messageEl) {
    messageEl.textContent = message;
    messageEl.className = type === 'success' ? 'success-message' : 'error-message';
    messageEl.classList.remove('hidden');
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      messageEl.classList.add('hidden');
    }, 5000);
  }
}

function setButtonLoading(buttonId: string, isLoading: boolean) {
  const button = document.getElementById(buttonId);
  if (!button) return;
  
  const textSpan = button.querySelector('.btn-text');
  const spinnerSpan = button.querySelector('.btn-spinner');
  
  if (isLoading) {
    (button as HTMLButtonElement).disabled = true;
    if (textSpan) textSpan.classList.add('hidden');
    if (spinnerSpan) spinnerSpan.classList.remove('hidden');
  } else {
    (button as HTMLButtonElement).disabled = false;
    if (textSpan) textSpan.classList.remove('hidden');
    if (spinnerSpan) spinnerSpan.classList.add('hidden');
  }
}

function getMinDateTimeString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

// Add to global scope for use in HTML
(window as any).lockSchedule = lockSchedule;
(window as any).applyChangesAndUnlock = applyChangesAndUnlock;
(window as any).showScheduleUpdateModal = showScheduleUpdateModal;
(window as any).hideScheduleUpdateModal = hideScheduleUpdateModal;
(window as any).scheduleUpdate = scheduleUpdate;