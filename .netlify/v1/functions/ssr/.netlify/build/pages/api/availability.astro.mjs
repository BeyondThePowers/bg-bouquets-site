import { s as supabase } from '../../chunks/supabase_wm5vZfj7.mjs';
export { renderers } from '../../renderers.mjs';

const GET = async () => {
  try {
    console.log("Availability API called");
    const { data: openDays, error: openError } = await supabase.from("open_days").select("date").eq("is_open", true).order("date", { ascending: true });
    console.log("Open days query result:", { openDays, openError });
    if (openError) {
      console.error("Open days error:", openError);
      return new Response(JSON.stringify({ error: openError.message }), { status: 500 });
    }
    if (!openDays || openDays.length === 0) {
      console.log("No open days found");
      return new Response(JSON.stringify({}), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    const { data: slots, error: slotError } = await supabase.from("time_slots").select("id, date, time, max_capacity, max_bookings").in("date", openDays.map((d) => d.date));
    if (slotError || !slots) {
      return new Response(JSON.stringify({ error: slotError?.message }), { status: 500 });
    }
    const { data: bookings, error: bookingError } = await supabase.from("bookings").select("id, date, time, number_of_visitors");
    if (bookingError || !bookings) {
      return new Response(JSON.stringify({ error: bookingError?.message }), { status: 500 });
    }
    const slotUsageMap = /* @__PURE__ */ new Map();
    for (const b of bookings) {
      const key = `${b.date}|${b.time}`;
      const current = slotUsageMap.get(key) || { bookingCount: 0, visitorCount: 0 };
      current.bookingCount += 1;
      current.visitorCount += b.number_of_visitors || 1;
      slotUsageMap.set(key, current);
    }
    console.log("Slot usage map:", Object.fromEntries(slotUsageMap));
    const availability = {};
    for (const day of openDays) {
      const availableTimes = slots.filter((slot) => slot.date === day.date).filter((slot) => {
        const key = `${slot.date}|${slot.time}`;
        const usage = slotUsageMap.get(key) || { bookingCount: 0, visitorCount: 0 };
        const bookingLimitReached = usage.bookingCount >= slot.max_bookings;
        const visitorLimitReached = usage.visitorCount >= slot.max_capacity;
        console.log(`Slot ${key}:`, {
          currentBookings: usage.bookingCount,
          maxBookings: slot.max_bookings,
          currentVisitors: usage.visitorCount,
          maxCapacity: slot.max_capacity,
          bookingLimitReached,
          visitorLimitReached,
          available: !bookingLimitReached && !visitorLimitReached
        });
        return !bookingLimitReached && !visitorLimitReached;
      }).map((slot) => slot.time);
      if (availableTimes.length > 0) {
        availability[day.date] = availableTimes;
      }
    }
    console.log("Final availability result:", availability);
    return new Response(JSON.stringify(availability), {
      status: 200,
      headers: {
        "Content-Type": "application/json"
      }
    });
  } catch (error) {
    console.error("Availability API error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  GET
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
