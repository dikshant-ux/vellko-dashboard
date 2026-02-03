import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from jinja2 import Environment, FileSystemLoader
import os
from database import settings

# Setup Jinja2 environment for loading templates
TEMPLATE_DIR = os.path.join(os.path.dirname(__file__), "templates", "email")
env = Environment(loader=FileSystemLoader(TEMPLATE_DIR))

def send_email(to_email: str, subject: str, html_content: str):
    """
    Sends an email using the configured SMTP server.
    """
    try:
        # Create message container
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = settings.EMAILS_FROM_EMAIL
        msg["To"] = to_email

        # Attach HTML content
        part = MIMEText(html_content, "html")
        msg.attach(part)

        # Connect to SMTP server and send
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.EMAILS_FROM_EMAIL, to_email, msg.as_string())
            
        return True
    except Exception as e:
        print(f"Failed to send email to {to_email}: {str(e)}")
        return False

def send_reset_password_email(to_email: str, token: str):
    """
    Generates the reset password email content and sends it.
    """
    try:
        template = env.get_template("reset_password.html")
        
        # Construct reset link
        link = f"{settings.FRONTEND_URL}/reset-password?token={token}"
        
        html_content = template.render(
            link=link,
            validity_minutes=30 # Assuming 30 mins expiry based on token logic we'll add
        )
        
        return send_email(
            to_email=to_email,
            subject="Reset Your Password - Vellko",
            html_content=html_content
        )
    except Exception as e:
        print(f"Error preparing reset password email: {str(e)}")
        return False

def send_invitation_email(to_email: str, username: str, password: str, name: str, role: str):
    """
    Sends an invitation email to a new user with their credentials.
    """
    try:
        template = env.get_template("invitation.html")
        
        login_link = f"{settings.FRONTEND_URL}/login"
        
        html_content = template.render(
            name=name,
            username=username,
            password=password,
            role=role,
            link=login_link
        )
        
        return send_email(
            to_email=to_email,
            subject="Welcome to Vellko - Your Login Details",
            html_content=html_content
        )
    except Exception as e:
        print(f"Error preparing invitation email: {str(e)}")
        return False
