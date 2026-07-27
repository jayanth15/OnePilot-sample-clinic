from datetime import datetime


def _fmt_date(date_str: str) -> str:
    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d")
        return dt.strftime("%d %b %Y")
    except ValueError:
        return date_str


def _fmt_time(t: str) -> str:
    try:
        h, m = map(int, t.split(":"))
        period = "AM" if h < 12 else "PM"
        h12 = h if h <= 12 else h - 12
        if h12 == 0:
            h12 = 12
        return f"{h12}:{m:02d} {period}"
    except (ValueError, AttributeError):
        return t


def appointment_booked_msg(appointment, patient, doctor, clinic) -> str:
    clinic_name = clinic.clinic_name if clinic else "OnePilot Clinic"
    return (
        f"*Appointment Booked!* \U0001f389\n\n"
        f"Appointment #: {appointment.appointment_number}\n"
        f"Patient: {patient.name}\n"
        f"Doctor: {doctor.name} ({doctor.speciality})\n"
        f"Date: {_fmt_date(appointment.appointment_date)}\n"
        f"Time: {_fmt_time(appointment.start_time)} - {_fmt_time(appointment.end_time)}\n"
        f"Clinic: {clinic_name}\n\n"
        f"Please arrive 10 minutes early. To reschedule or cancel, reply to this message."
    )


def appointment_confirmed_msg(appointment, patient, doctor, clinic) -> str:
    clinic_name = clinic.clinic_name if clinic else "OnePilot Clinic"
    return (
        f"*Appointment Confirmed!* \u2705\n\n"
        f"Appointment #: {appointment.appointment_number}\n"
        f"Patient: {patient.name}\n"
        f"Doctor: {doctor.name} ({doctor.speciality})\n"
        f"Date: {_fmt_date(appointment.appointment_date)}\n"
        f"Time: {_fmt_time(appointment.start_time)} - {_fmt_time(appointment.end_time)}\n"
        f"Clinic: {clinic_name}\n\n"
        f"Please arrive 10 minutes early. To reschedule or cancel, reply to this message."
    )


def appointment_cancelled_msg(appointment, doctor, clinic) -> str:
    clinic_name = clinic.clinic_name if clinic else "OnePilot Clinic"
    return (
        f"*Appointment Cancelled* \u274c\n\n"
        f"Appointment #: {appointment.appointment_number}\n"
        f"Doctor: {doctor.name} ({doctor.speciality})\n"
        f"Date: {_fmt_date(appointment.appointment_date)}\n"
        f"Time: {_fmt_time(appointment.start_time)} - {_fmt_time(appointment.end_time)}\n"
        f"Clinic: {clinic_name}\n\n"
        f"This appointment has been cancelled. To book a new one, reply to this message."
    )


def appointment_rescheduled_msg(appointment, doctor, clinic) -> str:
    clinic_name = clinic.clinic_name if clinic else "OnePilot Clinic"
    return (
        f"*Appointment Rescheduled* \U0001f504\n\n"
        f"Appointment #: {appointment.appointment_number}\n"
        f"Doctor: {doctor.name} ({doctor.speciality})\n"
        f"New Date: {_fmt_date(appointment.appointment_date)}\n"
        f"New Time: {_fmt_time(appointment.start_time)} - {_fmt_time(appointment.end_time)}\n"
        f"Clinic: {clinic_name}\n\n"
        f"Please update your calendar. To make further changes, reply to this message."
    )


def doctor_unavailable_msg(doctor_name: str, date_str: str) -> str:
    return (
        f"Dr. {doctor_name} is not available on {_fmt_date(date_str)}. "
        f"Please choose another date or doctor."
    )


def human_handoff_msg() -> str:
    return (
        "Connecting you to a human assistant. Please wait while we transfer your chat. \u23f3"
    )


def reminder_msg(appointment, doctor) -> str:
    return (
        f"*Appointment Reminder* \u23f0\n\n"
        f"Appointment #: {appointment.appointment_number}\n"
        f"Doctor: {doctor.name} ({doctor.speciality})\n"
        f"Date: {_fmt_date(appointment.appointment_date)}\n"
        f"Time: {_fmt_time(appointment.start_time)} - {_fmt_time(appointment.end_time)}\n\n"
        f"Please arrive 10 minutes early. Reply to this message if you need to reschedule or cancel."
    )
