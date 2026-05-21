def interview_scheduled_email(
    candidate_name: str,
    position: str,
    date: str,
    time: str,
    duration: int,
    interview_type: str,
    meet_link: str = None,
    custom_message: str = None,
) -> dict:
    from datetime import datetime
    formatted_date = datetime.strptime(str(date), "%Y-%m-%d").strftime("%B %d, %Y")
    formatted_time = datetime.strptime(str(time)[:5], "%H:%M").strftime("%I:%M %p")

    meet_section = f"""
        <p style="margin:20px 0;">
            <a href="{meet_link}"
               style="background:#2563eb;color:white;padding:10px 20px;
                      border-radius:6px;text-decoration:none;font-weight:600;">
                Join Google Meet
            </a>
        </p>
    """ if meet_link else ""

    custom_section = f"""
        <p style="color:#374151;margin-top:16px;">{custom_message}</p>
    """ if custom_message else ""

    body = f"""
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#111827;">
        <h2 style="color:#111827;margin-bottom:8px;">Interview Scheduled</h2>
        <p>Dear {candidate_name},</p>
        <p>We are pleased to inform you that your interview has been scheduled
        for the <strong>{position}</strong> position.</p>

        {custom_section}

        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;
                    padding:16px;margin:20px 0;line-height:1.8;">
            <p><strong>Date:</strong> {formatted_date}</p>
            <p><strong>Time:</strong> {formatted_time}</p>
            <p><strong>Duration:</strong> {duration} minutes</p>
            <p><strong>Type:</strong> {interview_type.capitalize()}</p>
        </div>

        {meet_section}

        <p style="margin-top:24px;">Best regards,<br>Hiring Team</p>
    </div>
    """
    return {"subject": f"Interview Scheduled — {position}", "body": body}


def interview_rescheduled_email(
    candidate_name: str,
    position: str,
    new_date: str,
    new_time: str,
    duration: int,
    interview_type: str,
    meet_link: str = None,
) -> dict:
    from datetime import datetime
    formatted_date = datetime.strptime(str(new_date), "%Y-%m-%d").strftime("%B %d, %Y")
    formatted_time = datetime.strptime(str(new_time)[:5], "%H:%M").strftime("%I:%M %p")

    meet_section = f"""
        <p style="margin:20px 0;">
            <a href="{meet_link}"
               style="background:#2563eb;color:white;padding:10px 20px;
                      border-radius:6px;text-decoration:none;font-weight:600;">
                Join Google Meet
            </a>
        </p>
    """ if meet_link else ""

    body = f"""
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#111827;">
        <h2 style="color:#111827;margin-bottom:8px;">Interview Rescheduled</h2>
        <p>Dear {candidate_name},</p>
        <p>Your interview for the <strong>{position}</strong> position has been rescheduled.</p>

        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;
                    padding:16px;margin:20px 0;line-height:1.8;">
            <p><strong>New Date:</strong> {formatted_date}</p>
            <p><strong>New Time:</strong> {formatted_time}</p>
            <p><strong>Duration:</strong> {duration} minutes</p>
            <p><strong>Type:</strong> {interview_type.capitalize()}</p>
        </div>

        {meet_section}

        <p style="margin-top:24px;">Best regards,<br>Hiring Team</p>
    </div>
    """
    return {"subject": f"Interview Rescheduled — {position}", "body": body}


def interview_cancelled_email(
    candidate_name: str,
    position: str,
) -> dict:
    body = f"""
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#111827;">
        <h2 style="color:#111827;margin-bottom:8px;">Interview Cancelled</h2>
        <p>Dear {candidate_name},</p>
        <p>We regret to inform you that your scheduled interview for the
        <strong>{position}</strong> position has been cancelled.</p>
        <p>Our team will be in touch with you shortly regarding next steps.</p>
        <p style="margin-top:24px;">Best regards,<br>Hiring Team</p>
    </div>
    """
    return {"subject": f"Interview Cancelled — {position}", "body": body}


def rejection_email(
    candidate_name: str,
    position: str,
    custom_message: str = None,
) -> dict:
    custom_section = f"""
        <p style="color:#374151;margin-top:16px;">{custom_message}</p>
    """ if custom_message else ""

    body = f"""
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#111827;">
        <h2 style="color:#111827;margin-bottom:8px;">Application Update</h2>
        <p>Dear {candidate_name},</p>
        <p>Thank you for your interest in the <strong>{position}</strong> position
        and for taking the time to go through our hiring process.</p>
        <p>After careful consideration, we have decided to move forward with other
        candidates whose experience more closely matches our current requirements.</p>
        {custom_section}
        <p>We appreciate your interest in joining our team and wish you the best
        in your job search.</p>
        <p style="margin-top:24px;">Best regards,<br>Hiring Team</p>
    </div>
    """
    return {"subject": f"Application Update — {position}", "body": body}


def archived_email(
    candidate_name: str,
    position: str,
    custom_message: str = None,
) -> dict:
    custom_section = f"""
        <p style="color:#374151;margin-top:16px;">{custom_message}</p>
    """ if custom_message else ""

    body = f"""
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#111827;">
        <h2 style="color:#111827;margin-bottom:8px;">Application Status Update</h2>
        <p>Dear {candidate_name},</p>
        <p>Thank you for applying for the <strong>{position}</strong> position.</p>
        <p>We wanted to let you know that your application has been archived at this
        time. This may be due to the position being filled or placed on hold.</p>
        {custom_section}
        <p>We will keep your profile on file and may reach out if a suitable
        opportunity arises in the future.</p>
        <p style="margin-top:24px;">Best regards,<br>Hiring Team</p>
    </div>
    """
    return {"subject": f"Application Update — {position}", "body": body}
