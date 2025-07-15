# Prompt: Implement Modern Calendar-First Booking Form

## Context
Our current booking form uses a traditional form-first approach with separate date and time selection fields. We want to modernize it to follow best practices like Calendly and Hubspot booking forms, which have proven to increase conversion rates.

## Task
Implement a modern, calendar-first booking form that maintains all existing functionality while improving the user experience. The implementation should follow a step-by-step approach to ensure all current features are preserved.

## Requirements

### Core Functionality (Must Preserve)
- All existing form fields must be maintained (name, email, phone, date, time, number of bouquets)
- Payment method selection (pay on arrival vs pay online now)
- Form validation (client and server-side)
- Availability checking against the API
- Booking submission to the API endpoint
- Success/error handling
- All existing event handlers and callbacks

### UX Improvements
- Implement a calendar-first, multi-step booking flow:
  1. Step 1: Date and time selection with visual calendar
  2. Step 2: Personal details and bouquet selection
  3. Step 3: Payment method selection and confirmation
- Show available time slots as visual cards rather than dropdown
- Display clear progress indicators between steps
- Provide visual feedback for available/unavailable dates
- Ensure smooth transitions between steps

### Technical Requirements
- Mobile-first design approach
- Maintain compatibility with existing API endpoints
- Preserve all data validation
- Ensure accessibility compliance
- Maintain the shabby-chic aesthetic of the site
- Keep the same event tracking and analytics

## Implementation Approach
Please think through this implementation carefully, step by step:

1. First, analyze the existing code to understand all current functionality
2. Create a plan for migrating the form without breaking existing features
3. Implement the UI components for the multi-step process
4. Ensure the calendar and time slot selection works with the existing availability API
5. Verify that all form data is correctly collected across the steps
6. Test the submission process thoroughly
7. Ensure mobile responsiveness at each step

## Important Considerations
- The booking form is a critical conversion point - ensure it works flawlessly
- The form must handle edge cases like:
  - No available dates/times
  - Date selection in the past
  - Fully booked time slots
  - Payment method switching
  - Form validation errors
- The design should reduce friction and cognitive load
- The implementation should maintain or improve page load performance

## Technical Notes
- The current availability data is fetched from `/api/availability`
- Bookings are submitted to `/api/bookings`
- The current form uses client-side validation before submission
- The booking confirmation process must handle both payment methods correctly
- The form should integrate with the existing success/error handling

Think carefully about each step of the implementation to ensure you don't break any existing functionality. Ask clarifying questions if needed. Keep styles consistent and follow best practices for UI/UX design always. Discuss your implementation plan with me before proceeding if you haven't already. Always let me know if you need me to perform any actions in an external service, such as supabase SQL editor, etc. If you have no questions proceed with implementaion.