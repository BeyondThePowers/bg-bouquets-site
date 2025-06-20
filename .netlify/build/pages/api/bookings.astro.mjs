import { s as supabase } from '../../chunks/supabase_wm5vZfj7.mjs';
export { renderers } from '../../renderers.mjs';

const POST = async ({ request }) => {
  try {
    console.log("Booking API called");
    console.log("Request headers:", Object.fromEntries(request.headers.entries()));
    console.log("Request method:", request.method);
    let body;
    try {
      const rawBody = await request.text();
      console.log("Raw request body:", rawBody);
      if (!rawBody || rawBody.trim() === "") {
        throw new Error("Empty request body");
      }
      body = JSON.parse(rawBody);
      console.log("Parsed request body:", body);
    } catch (parseError) {
      console.error("JSON parsing error:", parseError);
      return new Response(JSON.stringify({
        error: "Invalid JSON in request body",
        details: parseError instanceof Error ? parseError.message : "Unknown parsing error"
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    const {
      fullName,
      email,
      phone,
      visitDate,
      preferredTime,
      numberOfVisitors,
      totalAmount
    } = body;
    console.log("Extracted fields:", { fullName, email, phone, visitDate, preferredTime, numberOfVisitors, totalAmount });
    if (!fullName || !email || !phone || !visitDate || !preferredTime || !numberOfVisitors) {
      console.log("Validation failed - missing fields");
      return new Response(JSON.stringify({ error: "Missing required fields." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(JSON.stringify({ error: "Invalid email format." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    const visitDateObj = new Date(visitDate);
    const today = /* @__PURE__ */ new Date();
    today.setHours(0, 0, 0, 0);
    if (visitDateObj < today) {
      return new Response(JSON.stringify({ error: "Cannot book for past dates." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    if (numberOfVisitors < 1 || numberOfVisitors > 20) {
      return new Response(JSON.stringify({ error: "Number of visitors must be between 1 and 20." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    console.log("Checking time slot for:", { visitDate, preferredTime });
    const { data: slot, error: slotError } = await supabase.from("time_slots").select("max_capacity, max_bookings").eq("date", visitDate).eq("time", preferredTime).maybeSingle();
    console.log("Time slot query result:", { slot, slotError });
    if (slotError) {
      console.error("Time slot query error:", slotError);
      return new Response(JSON.stringify({ error: `Database error: ${slotError.message}` }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
    if (!slot) {
      console.log("No time slot found for:", { visitDate, preferredTime });
      return new Response(JSON.stringify({ error: "Selected time slot is not available." }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }
    console.log("Checking existing bookings for:", { visitDate, preferredTime });
    const { data: existingBookings, error: bookingError } = await supabase.from("bookings").select("id, number_of_visitors").eq("date", visitDate).eq("time", preferredTime);
    console.log("Existing bookings query result:", { existingBookings, bookingError });
    if (bookingError) {
      console.error("Booking query error:", bookingError);
      return new Response(JSON.stringify({ error: `Could not verify availability: ${bookingError.message}` }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
    const currentBookingCount = existingBookings.length;
    const currentVisitorCount = existingBookings.reduce((sum, booking) => sum + (booking.number_of_visitors || 1), 0);
    console.log("Current usage:", {
      currentBookingCount,
      currentVisitorCount,
      maxBookings: slot.max_bookings,
      maxCapacity: slot.max_capacity,
      requestedVisitors: numberOfVisitors
    });
    if (currentBookingCount >= slot.max_bookings) {
      return new Response(JSON.stringify({
        error: `Maximum bookings reached for this time slot. Only ${slot.max_bookings} bookings allowed per slot.`
      }), {
        status: 409,
        headers: { "Content-Type": "application/json" }
      });
    }
    if (currentVisitorCount + numberOfVisitors > slot.max_capacity) {
      const remainingCapacity = slot.max_capacity - currentVisitorCount;
      return new Response(JSON.stringify({
        error: `Not enough visitor capacity remaining. Only ${remainingCapacity} spots available, but you requested ${numberOfVisitors}.`
      }), {
        status: 409,
        headers: { "Content-Type": "application/json" }
      });
    }
    console.log("Inserting booking with data:", {
      full_name: fullName,
      email,
      phone,
      date: visitDate,
      time: preferredTime,
      number_of_visitors: numberOfVisitors,
      total_amount: totalAmount
    });
    const { error: insertError } = await supabase.from("bookings").insert({
      full_name: fullName,
      email,
      phone,
      date: visitDate,
      time: preferredTime,
      number_of_visitors: numberOfVisitors,
      total_amount: totalAmount
    });
    console.log("Insert result:", { insertError });
    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(JSON.stringify({ error: `Booking failed: ${insertError.message}` }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
    return new Response(JSON.stringify({
      success: true,
      message: "Booking confirmed! You will receive a confirmation email shortly."
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Booking API error:", error);
    return new Response(JSON.stringify({ error: "Internal server error. Please try again." }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  POST
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
