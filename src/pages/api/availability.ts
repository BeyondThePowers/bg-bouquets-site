import type { APIRoute } from 'astro';
import { supabase } from '../../lib/supabase';

// Business timezone helper - Alberta, Canada (Mountain Time)
function getBusinessToday(): string {
  return new Date().toLocaleDateString('en-CA', {
    timeZone: 'America/Edmonton'
  }); // Returns YYYY-MM-DD format
}

export const GET: APIRoute = async () => {
  try {
    console.log('Availability API called');

    // Step 1: Get schedule settings
    const { data: settings, error: settingsError } = await supabase
      .from('schedule_settings')
      .select('setting_key, setting_value')
      .in('setting_key', ['max_bookings_per_slot', 'max_bouquets_per_slot']);

    if (settingsError) {
      console.error('Settings error:', settingsError);
      return new Response(JSON.stringify({ error: settingsError.message }), { status: 500 });
    }

    // Parse settings
    const settingsMap = new Map(settings?.map(s => [s.setting_key, s.setting_value]) || []);
    const maxBookingsPerSlot = parseInt(settingsMap.get('max_bookings_per_slot') as string || '3');
    const maxBouquetsPerSlot = parseInt(settingsMap.get('max_bouquets_per_slot') as string || '10');

    console.log('Schedule settings:', { maxBookingsPerSlot, maxBouquetsPerSlot });

    // Step 2: Get open days (using business timezone for "today")
    const businessToday = getBusinessToday();
    console.log('Business today:', businessToday);

    const { data: openDays, error: openError } = await supabase
      .from('open_days')
      .select('date')
      .eq('is_open', true)
      .gte('date', businessToday) // Only future dates in business timezone
      .order('date', { ascending: true });

    console.log('Open days query result:', { openDays, openError });

    if (openError) {
      console.error('Open days error:', openError);
      return new Response(JSON.stringify({ error: openError.message }), { status: 500 });
    }

    if (!openDays || openDays.length === 0) {
      console.log('No open days found');
      return new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // Step 3: Get time slots for open days (exclude legacy slots from customer booking)
    const { data: slots, error: slotError } = await supabase
      .from('time_slots')
      .select('id, date, time, max_bouquets')
      .in('date', openDays.map(d => d.date))
      .eq('is_legacy', false); // Only show active slots to customers

    if (slotError || !slots) {
      return new Response(JSON.stringify({ error: slotError?.message }), { status: 500 });
    }

    // Step 4: Get bookings to count both booking count and bouquet count
    const { data: bookings, error: bookingError } = await supabase
      .from('bookings')
      .select('id, date, time, number_of_bouquets');

    if (bookingError || !bookings) {
      return new Response(JSON.stringify({ error: bookingError?.message }), { status: 500 });
    }

    // Step 5: Organize availability - count both bookings and bouquets per slot
    const slotUsageMap = new Map<string, { bookingCount: number; bouquetCount: number }>();

    for (const b of bookings) {
      const key = `${b.date}|${b.time}`;
      const current = slotUsageMap.get(key) || { bookingCount: 0, bouquetCount: 0 };

      current.bookingCount += 1;
      current.bouquetCount += (b.number_of_bouquets || 1);

      slotUsageMap.set(key, current);
    }

    console.log('Slot usage map:', Object.fromEntries(slotUsageMap));

    // Step 6: Convert to frontend expected format, checking both limits
    const availability: Record<string, string[]> = {};

    for (const day of openDays) {
      const availableTimes = slots
        .filter(slot => slot.date === day.date)
        .filter(slot => {
          const key = `${slot.date}|${slot.time}`;
          const usage = slotUsageMap.get(key) || { bookingCount: 0, bouquetCount: 0 };

          // Check both limits using settings
          const bookingLimitReached = usage.bookingCount >= maxBookingsPerSlot;
          const bouquetLimitReached = usage.bouquetCount >= maxBouquetsPerSlot;

          console.log(`Slot ${key}:`, {
            currentBookings: usage.bookingCount,
            maxBookings: maxBookingsPerSlot,
            currentBouquets: usage.bouquetCount,
            maxBouquets: maxBouquetsPerSlot,
            bookingLimitReached,
            bouquetLimitReached,
            available: !bookingLimitReached && !bouquetLimitReached
          });

          return !bookingLimitReached && !bouquetLimitReached;
        })
        .map(slot => slot.time);

      if (availableTimes.length > 0) {
        availability[day.date] = availableTimes;
      }
    }

    console.log('Final availability result:', availability);

    return new Response(JSON.stringify(availability), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });

  } catch (error) {
    console.error('Availability API error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
