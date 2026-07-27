# Indian Clinic/Hospital WhatsApp Agent — Implementation Brief

Implement these features in the existing OnePilot repository using only its current infrastructure:

- Next.js, React, Tailwind CSS, and shadcn/ui
- FastAPI, SQLModel, and SQLite
- Pydantic AI
- Gupshup WhatsApp
- Existing email/password and JWT authentication

Do not replace SQLite, Gupshup, FastAPI, SQLModel, Pydantic AI, or the frontend stack.

## Product goal

Convert the generic WhatsApp AI assistant into an Indian clinic/hospital appointment assistant.

Patients must be able to view clinic details, find doctors, check availability, book appointments, view upcoming appointments, reschedule, cancel, and request clinic staff. Staff must manage the same information from the web dashboard.

Use Indian Standard Time (`Asia/Kolkata`) for every displayed date and time.

## 1. SQLModel tables

Create these models under `backend/app/models/` and export them from `backend/app/models/__init__.py`. The existing `init_db()` must create their SQLite tables.

### Doctor

Fields: `id`, `name`, `speciality`, `qualification`, `registration_number`, `consultation_fee`, `consultation_duration_minutes` (default 20), `languages`, `is_active`, and `created_at`.

### DoctorAvailability

Fields: `id`, `doctor_id`, `day_of_week` (0–6), `start_time`, `end_time`, `slot_duration_minutes`, and `is_active`.

This table stores normal weekly schedules.

### DoctorLeave

Fields: `id`, `doctor_id`, `leave_date`, and `reason`. Leave dates must not produce slots.

### Patient

Fields: `id`, `name`, `phone`, `age`, `gender`, `preferred_language`, and `created_at`.

Normalize Indian numbers so `9876543210`, `919876543210`, and `+919876543210` resolve consistently.

Keep `Contact` as the WhatsApp identity. Do not treat it as the full patient record. Match or link a patient using normalized phone.

### Appointment

Fields: `id`, `appointment_number`, `patient_id`, `doctor_id`, `appointment_date`, `start_time`, `end_time`, `reason`, `status`, `booking_source`, `reminder_sent_at`, `created_at`, and `updated_at`.

Statuses: `booked`, `confirmed`, `checked_in`, `completed`, `cancelled`, and `no_show`.

Booking sources: `whatsapp` and `staff`.

Generate readable numbers such as `APT-20260726-0001`.

### ClinicSettings

Fields: `id`, `clinic_name`, `address`, `phone`, `whatsapp_number`, `opening_hours`, `appointment_reminder_hours` (default 24), and `timezone` (default `Asia/Kolkata`).

Only one settings record is needed for this sample.

## 2. Doctor APIs

Create `backend/app/api/routes/doctors.py` and register it in `backend/app/api/router.py`.

```text
GET    /api/v1/doctors
POST   /api/v1/doctors
GET    /api/v1/doctors/{doctor_id}
PATCH  /api/v1/doctors/{doctor_id}
GET    /api/v1/doctors/{doctor_id}/availability
PUT    /api/v1/doctors/{doctor_id}/availability
POST   /api/v1/doctors/{doctor_id}/leave
DELETE /api/v1/doctors/{doctor_id}/leave/{leave_id}
```

Doctor listing should support speciality and active-state filters.

## 3. Availability service

Create `backend/app/services/availability.py`.

Given a doctor and date, it must:

1. Read weekly availability for that weekday.
2. Return no slots if the doctor is inactive or on leave.
3. Divide working hours by `slot_duration_minutes`.
4. Remove slots used by non-cancelled appointments.
5. Exclude past slots when the selected date is today.
6. Return times in IST.

Add:

```text
GET /api/v1/doctors/{doctor_id}/slots?date=YYYY-MM-DD
```

Example:

```json
{
  "doctor_id": 1,
  "date": "2026-07-27",
  "timezone": "Asia/Kolkata",
  "slots": ["09:00", "09:20", "09:40", "10:00"]
}
```

Validate the slot again immediately before saving.

Prevent two active appointments for the same doctor, date, and start time using SQLite-compatible validation/constraints. Return HTTP `409` for conflicts. A cancelled appointment must release its slot.

## 4. Patient APIs

Create `backend/app/api/routes/patients.py`.

```text
GET   /api/v1/patients?query=...
POST  /api/v1/patients
GET   /api/v1/patients/{patient_id}
PATCH /api/v1/patients/{patient_id}
GET   /api/v1/patients/{patient_id}/appointments
```

Search by name or normalized phone. During WhatsApp booking, find the patient using the normalized sender phone. If no patient exists, collect and save the minimum fields.

## 5. Appointment APIs

Create `backend/app/api/routes/appointments.py` and register it in `backend/app/api/router.py`.

```text
GET  /api/v1/appointments
POST /api/v1/appointments
GET  /api/v1/appointments/{appointment_id}
POST /api/v1/appointments/{appointment_id}/confirm
POST /api/v1/appointments/{appointment_id}/reschedule
POST /api/v1/appointments/{appointment_id}/cancel
POST /api/v1/appointments/{appointment_id}/check-in
POST /api/v1/appointments/{appointment_id}/complete
POST /api/v1/appointments/{appointment_id}/no-show
```

Support date, doctor, patient, status, and booking-source filters.

Rules:

- Doctor and patient must exist.
- Doctor must be active.
- Date cannot be in the past.
- Time must be a calculated available slot.
- Doctor leave and non-cancelled appointments block the slot.
- Rescheduling validates the new slot before changing the appointment.
- Cancellation changes status to `cancelled`; never delete the record.
- Create, reschedule, and cancel actions send a WhatsApp message when the patient has a phone.

## 6. Clinic settings API

Create or extend:

```text
GET   /api/v1/clinic-settings
PATCH /api/v1/clinic-settings
```

The agent must use the configured clinic name, address, phone, opening hours, and WhatsApp number. Never expose Gupshup keys or secrets.

## 7. WhatsApp clinic agent

Replace the weather-focused behaviour in `backend/app/agents/weather.py`. It may be renamed to `backend/app/agents/clinic.py`; update all imports if renamed.

This is an administrative appointment assistant, not a doctor.

Agent rules:

- Keep replies short and WhatsApp-friendly.
- Support simple English first.
- Accept “tomorrow”, weekdays, and Indian `DD-MM-YYYY` dates.
- Mention IST when time is unclear.
- Show at most five slots per reply.
- Use numbered choices and ask one question at a time.
- Confirm before booking, rescheduling, or cancelling.
- Never invent doctors, fees, slots, appointments, or clinic details.
- Read clinic data through tools.
- For diagnosis, medicine, prescription, or emergency requests, state that the agent only handles appointments and hand off to staff.
- Remove the weather tool from the clinic flow.

Add Pydantic AI tools:

- `get_clinic_information`
- `list_doctors`
- `get_doctor_slots`
- `find_patient_by_phone`
- `create_patient`
- `book_appointment`
- `list_patient_appointments`
- `reschedule_appointment`
- `cancel_appointment`

Tools must call shared service functions. Do not repeat availability/booking rules in the prompt.

Keep the current activation/session mechanism and `start ai`. Also accept `hi`, `hello`, `namaste`, and `book appointment`.

Greeting:

```text
Namaste! Welcome to {clinic_name}.

I can help you:
1. Book an appointment
2. Check doctor availability
3. View your appointments
4. Reschedule or cancel
5. Talk to clinic staff

Please reply with a number.
```

Booking flow:

1. Ask for speciality or doctor.
2. Show matching active doctors.
3. Ask for the date.
4. Fetch and show available slots.
5. Ask the patient to select a slot.
6. Find the patient by WhatsApp sender phone.
7. For a new patient, ask name, age, and gender.
8. Ask for a short appointment reason.
9. Show a summary and request confirmation.
10. Create the appointment.
11. Return appointment number and clinic details.

Example confirmation:

```text
Appointment booked ✅

Appointment: APT-20260726-0001
Doctor: Dr. Anjali Rao
Speciality: General Medicine
Date: 27-07-2026
Time: 10:20 AM IST
Clinic: OnePilot Clinic

Please arrive 10 minutes early.
```

For rescheduling/cancellation:

- Find appointments only through the current sender phone.
- Show only upcoming, non-cancelled appointments.
- Show valid replacement slots.
- Confirm before changing data.
- Never expose appointments using a patient ID supplied in chat.

For human handoff, pause/end AI replies for the contact, tell the patient staff will respond, and keep the conversation visible in the existing chat screen.

## 8. WhatsApp templates

Create `backend/app/messaging/templates.py` with builders for appointment booked, rescheduled, cancelled, reminder, doctor unavailable, and human handoff messages.

Include only necessary appointment details. Do not include diagnoses or sensitive clinical content.

## 9. Reminders

Use the existing FastAPI lifespan and background-task style.

The reminder service must:

- Periodically find upcoming appointments.
- Use `appointment_reminder_hours`.
- Ignore cancelled/completed appointments.
- Set `reminder_sent_at` after sending to prevent duplicates.

Start and stop it from `backend/app/core/lifespan.py`.

```text
Reminder: You have an appointment with Dr. Anjali Rao tomorrow at 10:20 AM IST.

Reply RESCHEDULE or CANCEL if required.
```

## 10. Frontend

Keep the existing style.

### Dashboard

Update `frontend/app/dashboard/page.tsx` with today’s appointment totals, confirmed, checked-in, completed, cancelled, active doctors, and next five appointments.

### Appointments

Create `frontend/app/appointments/page.tsx` with date/doctor/status filters, appointment table, booking form, patient search/create, API-loaded slots, and confirm/reschedule/cancel/check-in/complete/no-show actions.

### Doctors

Create `frontend/app/doctors/page.tsx` with doctor list, add/edit, activate/deactivate, weekly availability editor, leave management, speciality, fee, languages, and today’s availability.

### Patients

Create `frontend/app/patients/page.tsx` with search, list, add/edit, and appointment history.

### Configure

Update `frontend/app/configure/page.tsx` to edit clinic name, address, phone, WhatsApp number, opening hours, and reminder hours.

### Chat

Keep `frontend/components/chat-interface.tsx`. Add upcoming appointments for the selected contact, AI/staff reply labels, and pause/resume AI if supported by the current session store.

### Sidebar

Update `frontend/components/app-sidebar.tsx` with Dashboard, Appointments, Doctors, Patients, Chat, Configure, and Settings.

## 11. Frontend API helper

Create `frontend/lib/api.ts` that:

- Reads `NEXT_PUBLIC_API_URL`.
- Defaults to `http://localhost:8000`.
- Attaches `Authorization: Bearer <token>` using the existing JWT.
- Handles JSON and useful errors.
- Redirects to login for HTTP 401.

Use the same base configuration for existing login, chat, and settings requests where practical.

## 12. Authentication

Use the existing JWT implementation. Add a backend dependency that decodes the bearer token, loads the active user, and rejects invalid/expired tokens.

Require staff JWT for doctor, availability-management, patient, appointment, and clinic-settings APIs.

The Gupshup webhook remains public. Internal WhatsApp agent calls may bypass staff JWT but must only perform the phone-linked patient operations above.

## 13. Seed data

Extend `backend/app/seed.py`. Keep the admin user and add:

- One clinic settings record
- General Medicine doctor
- Paediatrics doctor
- Gynaecology doctor
- Monday–Saturday availability using IST-friendly hours

Repeated seeding must not create duplicates.

## 14. Tests

Add backend tests for:

- Indian phone normalization
- Doctor creation/listing and weekly availability
- Doctor leave blocking slots
- Past slots excluded today
- Appointment booking and double-booking rejection
- Cancelled appointment releasing a slot
- Rescheduling validation
- WhatsApp phone-linked appointment access
- Reminder sent only once
- Staff APIs rejecting missing JWT
- Gupshup webhook working without staff JWT

Verify:

```bash
cd backend
uv run python -m unittest discover -s tests -v
```

```bash
cd frontend
npm run lint
npm run typecheck
npm run build
```

## 15. Implementation order

1. SQLModel tables and exports.
2. Indian phone normalization.
3. Doctor and patient APIs.
4. Availability service and slot API.
5. Appointment service and APIs.
6. Clinic settings API.
7. JWT protection for staff APIs.
8. Seed clinic and doctors.
9. WhatsApp tools and conversation.
10. Templates and reminders.
11. Frontend API helper.
12. Dashboard, appointments, doctors, patients, and configure pages.
13. Sidebar and chat improvements.
14. Tests, lint, typecheck, and build.

## 16. Completion checklist

- [ ] Staff can configure clinic details.
- [ ] Staff can manage doctors, schedules, leave, patients, and appointments.
- [ ] Dashboard shows today’s activity.
- [ ] WhatsApp patients can view doctors and slots.
- [ ] WhatsApp patients can book, view, reschedule, and cancel.
- [ ] WhatsApp patients can request staff.
- [ ] Slots cannot be double-booked.
- [ ] Dates and times use IST.
- [ ] Indian phone numbers normalize consistently.
- [ ] Messages use the existing Gupshup client.
- [ ] Reminders are not duplicated.
- [ ] Staff APIs use the existing JWT.
- [ ] Existing health, login, chat, and webhook features still work.
- [ ] SQLite remains the database.
- [ ] Backend tests pass.
- [ ] Frontend lint, typecheck, and build pass.

## 17. Detailed clinic UI requirements

Use the existing sidebar, shadcn/ui components, and visual style. Every page must include loading, error, empty, and success states. Refresh all affected views after create or update actions.

### Dashboard operations

Expand `frontend/app/dashboard/page.tsx` with summary cards for total appointments today, booked/confirmed, checked-in, completed, cancelled/no-show, and doctors working today.

Add a **Today’s Appointments** table with:

- Appointment number
- Time in IST
- Patient name and phone
- Doctor name and speciality
- Reason
- Status and booking source
- Valid quick actions: confirm, check in, complete, reschedule, or cancel

The patient name must link to `/patients/{patient_id}`. Add “View all” to open `/appointments` with today selected.

Add a **Doctor Availability Today** section. Each doctor card/row must show:

- Doctor name and speciality
- Working, unavailable, or on-leave state
- Working time intervals
- Next available time
- Remaining available slots
- Appointments booked today

Include a date selector. “View slots” shows every available time for the doctor/date. “Book” opens the appointment form with doctor, date, and time prefilled.

### Appointment UI details

The appointments page must support date, doctor, speciality, patient, status, and booking-source filters. Provide Today, Upcoming, Completed, Cancelled, and All shortcuts.

Show appointment number, appointment date/time in IST, booking-created date/time, patient name/phone, doctor/speciality, reason, source, status, and actions. Patient names must link to patient details.

The booking form must search/create a patient, select doctor/date, load only available slots, show speciality/fee, collect reason, show a review step, and refresh appointment/availability UI after success.

Use confirmation dialogs for reschedule and cancellation. Cancelled records remain visible.

### Doctor UI details

On `frontend/app/doctors/page.tsx`, show each doctor’s name, speciality, qualification, fee, languages, active state, selected date’s hours, next available slot, booked count, and available-slot count/list.

Provide add/edit, activate/deactivate, weekly availability, leave management, date selection, “View appointments”, and “Book appointment” actions.

### Dedicated patient list

Create `frontend/app/patients/page.tsx`.

It must:

- Show all patients.
- Search by patient name or Indian phone number.
- Allow staff to add a patient.
- Show name, phone, age, gender, preferred language, created/first-seen date, last appointment, next appointment, and total bookings.
- Make the entire row and patient name clickable.
- Open `/patients/{patient_id}` when clicked.
- Include loading, error, no-results, and no-patients states.

### Patient detail page

Create `frontend/app/patients/[patient_id]/page.tsx`.

The summary must show:

- Editable patient name
- Phone, age, gender, and preferred language
- Created/first-seen date
- Total appointment count
- Upcoming appointment count
- Last appointment date

Add **Edit Patient** for name, age, gender, and preferred language. Saving must call `PATCH /api/v1/patients/{patient_id}`, persist to SQLite, show success/error feedback, and immediately refresh the displayed patient.

Patient-name rules:

- When first created from WhatsApp, copy the sender/profile name into `Patient.name`.
- After staff edit `Patient.name`, the database value is authoritative.
- Never overwrite the edited name from later WhatsApp profile names.
- Continue matching the patient by normalized phone.

Add **Upcoming Appointments** and an **All Booking History** table with:

- Appointment number
- Booking-created date/time
- Appointment date/time in IST
- Doctor name and speciality
- Reason
- Booking source (`WhatsApp` or `Staff`)
- Status
- Valid actions for upcoming appointments

Sort newest appointment date first. Allow date/status filtering. Clicking an appointment must open or focus it. If there are no bookings, show an empty state and “Book appointment” with the patient preselected.

### Patient-detail API data

`GET /api/v1/patients/{patient_id}` must return patient fields plus total appointments, upcoming count, last appointment date, and next appointment data.

`GET /api/v1/patients/{patient_id}/appointments` must return appointment number, booking `created_at`, appointment date/time, doctor ID/name/speciality, reason, booking source, and status. Return joined display data so the UI does not request every appointment row separately.

The patient-list API must include or efficiently calculate each row’s last appointment, next appointment, and total booking count.

### Shared UI behaviour

- Use IST and Indian date formatting consistently.
- Refresh dashboard, appointments, patient history, and doctor slots after mutations.
- Disable actions while saving to prevent duplicate submissions.
- Clearly display HTTP `409` when another user takes a slot.
- Use clickable patient names consistently across dashboard, appointments, chat context, and patient search.

### Additional UI completion checks

- [ ] Dashboard lists today’s booked patients and doctor availability.
- [ ] Clinic staff can see each doctor’s available times for a selected date.
- [ ] Appointment list shows who booked, when they booked, appointment time, and doctor.
- [ ] Patient page lists all patients with appointment summaries.
- [ ] Clicking a patient opens the patient detail page.
- [ ] Patient detail shows all current and previous bookings.
- [ ] Staff can edit a WhatsApp-derived patient name and save it to SQLite.
- [ ] Later WhatsApp messages do not overwrite a staff-edited patient name.
