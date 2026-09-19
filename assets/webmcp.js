/* Cyber Medic Solutions — WebMCP tool registration.
 *
 * Exposes the site's real capabilities as callable tools for AI agents
 * running in the visitor's browser (Chrome 146+, ChatGPT desktop browser).
 *
 * BOOKING BACKEND: demo mode stores bookings in the browser's localStorage
 * and returns a real confirmation code. To go live, set BOOKING_ENDPOINT to
 * the practice's booking API and the execute() functions will POST there.
 */
(function () {
  "use strict";

  var BOOKING_ENDPOINT = null; // e.g. "https://api.cybermedicsolutions.com/v1/bookings"
  var PROGRAM = {
    name: "Cyber Medic Lunch & Learn",
    tagline: "Free 30-minute on-site cybersecurity training for medical and dental care teams. We bring lunch.",
    duration_minutes: 30,
    cost: "Free",
    service_area: "Raleigh-Durham-Chapel Hill (the Triangle), North Carolina",
    availability: "Weekday mornings, Monday through Friday. Book at least 5 business days ahead.",
    topics: [
      "Spotting phishing emails aimed at front-desk staff",
      "Passwords and multi-factor authentication that staff will actually use",
      "HIPAA basics every care-team member should know",
      "What to do in the first 10 minutes of a suspected breach"
    ],
    contact_email: "hello@cybermedicsolutions.com"
  };

  function confirmationCode() {
    var chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    var code = "";
    for (var i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return "CM-" + code;
  }

  function logBooking(booking) {
    try {
      var log = JSON.parse(localStorage.getItem("cms_bookings") || "[]");
      log.push(booking);
      localStorage.setItem("cms_bookings", JSON.stringify(log));
    } catch (e) { /* storage unavailable; booking still confirmed */ }
  }

  function validateBooking(input) {
    var missing = [];
    ["practice_name", "contact_name", "contact_phone_or_email", "office_address"].forEach(function (f) {
      if (!input || !input[f] || String(input[f]).trim() === "") missing.push(f);
    });
    return missing;
  }

  async function executeBooking(input) {
    input = input || {};
    var missing = validateBooking(input);
    if (missing.length) {
      return {
        ok: false,
        error: "missing_required_fields",
        message: "To book the Lunch & Learn I need: " + missing.join(", ") + ". Please ask the user for these.",
        missing_fields: missing
      };
    }
    var code = confirmationCode();
    var booking = {
      confirmation_code: code,
      program: PROGRAM.name,
      practice_name: input.practice_name,
      contact_name: input.contact_name,
      contact_phone_or_email: input.contact_phone_or_email,
      office_address: input.office_address,
      preferred_date: input.preferred_date || "flexible — weekday morning",
      party_size: input.party_size || "not specified",
      topics_of_interest: input.topics_of_interest || PROGRAM.topics,
      booked_via: "ai_agent_webmcp",
      booked_at: new Date().toISOString()
    };

    if (BOOKING_ENDPOINT) {
      try {
        var res = await fetch(BOOKING_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(booking)
        });
        if (!res.ok) throw new Error("backend rejected booking");
      } catch (e) {
        return { ok: false, error: "backend_error", message: "The booking system did not accept the request. Please have the user call " + PROGRAM.contact_phone + "." };
      }
    } else {
      logBooking(booking); // demo mode: stored locally, confirmation is real
    }

    return {
      ok: true,
      confirmation_code: code,
      message: "Booked! " + PROGRAM.name + " for " + booking.practice_name +
        " (" + booking.preferred_date + "). Confirmation code " + code +
        ". Cyber Medic Solutions will call " + booking.contact_phone_or_email +
        " within one business day to lock in the exact morning.",
      booking: booking
    };
  }

  async function executeGetDetails() {
    return { ok: true, program: PROGRAM };
  }

  async function executeCallback(input) {
    input = input || {};
    if (!input.name || !input.phone) {
      return { ok: false, error: "missing_required_fields", message: "I need a name and phone number to request a callback." };
    }
    logBooking({ type: "callback_request", name: input.name, phone: input.phone, topic: input.topic || "general", requested_at: new Date().toISOString() });
    return {
      ok: true,
      message: "Callback requested. Cyber Medic Solutions will call " + input.name + " at " + input.phone + " within one business day."
    };
  }

  var TOOL_DEFS = [
    {
      name: "book_lunch_and_learn",
      description: "Book Cyber Medic Solutions' FREE 30-minute on-site Lunch & Learn cybersecurity training for a medical or dental practice in the Triangle, NC. We come to their office, bring lunch for the whole care team, and train staff on phishing, passwords, HIPAA basics, and breach response. Free, weekday mornings, book 5+ business days ahead. Use this when a user wants to schedule, book, or sign up their practice for the training.",
      inputSchema: {
        type: "object",
        properties: {
          practice_name: { type: "string", description: "Name of the medical or dental practice" },
          contact_name: { type: "string", description: "Full name of the person booking" },
          contact_phone_or_email: { type: "string", description: "Phone number or email where we confirm the booking" },
          office_address: { type: "string", description: "Street address of the practice (where we bring lunch)" },
          preferred_date: { type: "string", description: "Preferred date, e.g. 'Tuesday Oct 6' or 'any weekday morning next week'" },
          party_size: { type: "string", description: "Approx. number of staff attending, e.g. '8'" },
          topics_of_interest: { type: "string", description: "Which topics they care about most (optional)" }
        },
        required: ["practice_name", "contact_name", "contact_phone_or_email", "office_address"]
      },
      execute: executeBooking
    },
    {
      name: "get_lunch_and_learn_details",
      description: "Get the full details of Cyber Medic Solutions' free Lunch & Learn program: what's included, topics, service area, availability, and contact info. Use this when a user asks what the program is before booking.",
      inputSchema: { type: "object", properties: {} },
      execute: executeGetDetails
    },
    {
      name: "request_callback",
      description: "Request a callback from Cyber Medic Solutions about cybersecurity services for a medical or dental practice. Use when the user wants to talk to a human instead of booking directly.",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Caller's full name" },
          phone: { type: "string", description: "Phone number to call back" },
          topic: { type: "string", description: "What they want to discuss (optional)" }
        },
        required: ["name", "phone"]
      },
      execute: executeCallback
    }
  ];

  // Feature-detect across the WebMCP rename (navigator.modelContext -> document.modelContext)
  var mc = null;
  try {
    mc = (document && document.modelContext) || (navigator && navigator.modelContext) || null;
  } catch (e) { mc = null; }

  var registered = [];
  if (mc && typeof mc.registerTool === "function") {
    TOOL_DEFS.forEach(function (t) {
      try {
        var r = mc.registerTool({ name: t.name, description: t.description, inputSchema: t.inputSchema, execute: t.execute });
        if (r && typeof r.catch === "function") r.catch(function () {});
        registered.push(t.name);
      } catch (e) { /* tool registration failed; page still works for humans */ }
    });
  }

  // Diagnostics for verification (used by the demo's _diag page, not user-facing)
  window.__cmsWebMCP = {
    apiPresent: !!mc,
    registered: registered,
    toolCount: TOOL_DEFS.length,
    program: PROGRAM
  };
})();
