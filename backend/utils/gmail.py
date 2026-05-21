import base64
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from googleapiclient.discovery import build


def send_email(creds, to_email: str, subject: str, body_html: str) -> bool:
    """Send email using Gmail API with OAuth credentials."""
    try:
        service = build("gmail", "v1", credentials=creds)

        message = MIMEMultipart("alternative")
        message["Subject"] = subject
        message["To"] = to_email

        html_part = MIMEText(body_html, "html")
        message.attach(html_part)

        raw = base64.urlsafe_b64encode(message.as_bytes()).decode("utf-8")

        service.users().messages().send(
            userId="me",
            body={"raw": raw},
        ).execute()

        return True
    except Exception as e:
        print(f"Gmail send error: {str(e)}")
        return False
