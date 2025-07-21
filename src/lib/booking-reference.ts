/**
 * Booking Reference Generation System
 *
 * Generates human-readable booking reference codes in the format: BG-YYYYMMDD-XXXX
 * Example: BG-20250721-8391
 *
 * Features:
 * - Human-friendly: Easy to read, speak, and type (16 characters)
 * - Contextual: Date component reflects booking creation date (immutable)
 * - Compact: Short enough to be convenient but long enough to be unique
 * - Recognizable: "BG" prefix identifies the business
 * - Sortable: Natural chronological sorting by creation date
 * - Secure: Doesn't expose internal database IDs
 * - Collision-resistant: 4-digit random suffix provides 10,000 combinations per day
 * - Immutable: Reference never changes even if visit date is rescheduled
 */

import { supabase } from './supabase';

/**
 * Generate a booking reference code
 * @param date - Date string in YYYY-MM-DD format (should be booking creation date, not visit date)
 * @returns Booking reference in format BG-YYYYMMDD-XXXX
 */
export function generateBookingReference(date: string): string {
  // Convert date string (YYYY-MM-DD) to YYYYMMDD format
  const dateStr = date.replace(/-/g, '');
  
  // Generate random 4-digit suffix (0000-9999)
  const randomSuffix = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  
  // Return formatted reference
  return `BG-${dateStr}-${randomSuffix}`;
}

/**
 * Generate a unique booking reference with collision handling
 * @param date - Date string in YYYY-MM-DD format (should be booking creation date, not visit date)
 * @param maxAttempts - Maximum number of attempts to generate unique reference (default: 10)
 * @returns Promise<string> - Unique booking reference
 * @throws Error if unable to generate unique reference after maxAttempts
 */
export async function generateUniqueBookingReference(
  date: string, 
  maxAttempts: number = 10
): Promise<string> {
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    const reference = generateBookingReference(date);
    
    // Check if this reference already exists in the database
    const { data: existingBooking, error } = await supabase
      .from('bookings')
      .select('id')
      .eq('booking_reference', reference)
      .single();
    
    if (error && error.code === 'PGRST116') {
      // No rows returned - reference is unique
      return reference;
    } else if (error) {
      // Database error - throw it
      throw new Error(`Database error while checking reference uniqueness: ${error.message}`);
    } else if (existingBooking) {
      // Reference exists - try again
      attempts++;
      console.log(`Booking reference collision detected: ${reference} (attempt ${attempts}/${maxAttempts})`);
    }
  }
  
  throw new Error(`Failed to generate unique booking reference after ${maxAttempts} attempts for date ${date}`);
}

/**
 * Validate booking reference format
 * @param reference - Booking reference to validate
 * @returns boolean - True if reference matches expected format
 */
export function validateBookingReference(reference: string): boolean {
  // Expected format: BG-YYYYMMDD-XXXX
  const pattern = /^BG-\d{8}-\d{4}$/;
  return pattern.test(reference);
}

/**
 * Extract date from booking reference
 * @param reference - Booking reference in format BG-YYYYMMDD-XXXX
 * @returns string - Date in YYYY-MM-DD format, or null if invalid reference
 */
export function extractDateFromReference(reference: string): string | null {
  if (!validateBookingReference(reference)) {
    return null;
  }
  
  // Extract YYYYMMDD part and convert to YYYY-MM-DD
  const dateStr = reference.substring(3, 11); // Skip "BG-" and take 8 digits
  const year = dateStr.substring(0, 4);
  const month = dateStr.substring(4, 6);
  const day = dateStr.substring(6, 8);
  
  return `${year}-${month}-${day}`;
}

/**
 * Format booking reference for display (adds visual separation)
 * @param reference - Booking reference
 * @returns string - Formatted reference for display
 */
export function formatBookingReferenceForDisplay(reference: string): string {
  if (!validateBookingReference(reference)) {
    return reference; // Return as-is if invalid
  }
  
  // Already in the correct format BG-YYYYMMDD-XXXX
  return reference;
}

/**
 * Generate booking references for existing bookings (migration helper)
 * @param bookings - Array of booking objects with id and created_at date
 * @returns Promise<Array<{id: string, reference: string}>> - Generated references
 */
export async function generateReferencesForExistingBookings(
  bookings: Array<{ id: string; created_at: string }>
): Promise<Array<{ id: string; reference: string; success: boolean; error?: string }>> {
  const results: Array<{ id: string; reference: string; success: boolean; error?: string }> = [];

  for (const booking of bookings) {
    try {
      // Use creation date (created_at) instead of visit date for reference generation
      const creationDate = booking.created_at.split('T')[0]; // Extract YYYY-MM-DD from timestamp
      const reference = await generateUniqueBookingReference(creationDate);
      
      // Update the booking with the new reference
      const { error: updateError } = await supabase
        .from('bookings')
        .update({ booking_reference: reference })
        .eq('id', booking.id);
      
      if (updateError) {
        results.push({
          id: booking.id,
          reference: '',
          success: false,
          error: updateError.message
        });
      } else {
        results.push({
          id: booking.id,
          reference,
          success: true
        });
      }
    } catch (error) {
      results.push({
        id: booking.id,
        reference: '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
  
  return results;
}

/**
 * Find booking by reference
 * @param reference - Booking reference to search for
 * @returns Promise<any> - Booking data or null if not found
 */
export async function findBookingByReference(reference: string): Promise<any> {
  if (!validateBookingReference(reference)) {
    return null;
  }
  
  const { data: booking, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('booking_reference', reference)
    .single();
  
  if (error && error.code === 'PGRST116') {
    // No rows returned
    return null;
  } else if (error) {
    throw new Error(`Database error while finding booking: ${error.message}`);
  }
  
  return booking;
}
