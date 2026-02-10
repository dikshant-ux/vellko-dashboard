import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from jinja2 import Environment, FileSystemLoader
import os
import asyncio
from database import settings, db
from models import SMTPConfig

# Setup Jinja2 environment for loading templates
TEMPLATE_DIR = os.path.join(os.path.dirname(__file__), "templates", "email")
env = Environment(loader=FileSystemLoader(TEMPLATE_DIR))

def _send_smtp_sync(config: dict, msg: MIMEMultipart, to_email: str):
    """
    Synchronous SMTP sending logic to be run in a thread.
    """
    try:
        with smtplib.SMTP(config["host"], config["port"]) as server:
            server.starttls()
            server.login(config["username"], config["password"])
            server.sendmail(config["from_email"], to_email, msg.as_string())
        return True
    except Exception as e:
        print(f"Failed to send email to {to_email} via {config['host']}: {str(e)}")
        return False

async def get_active_smtp_config():
    """
    Fetches the active SMTP configuration from the database.
    Falls back to environment variables if no active config is found.
    """
    config_data = await db.smtp_configs.find_one({"is_active": True})
    
    if config_data:
        return {
            "host": config_data["host"],
            "port": config_data["port"],
            "username": config_data["username"],
            "password": config_data["password"],
            "from_email": config_data["from_email"],
            "reply_to_email": config_data.get("reply_to_email")
        }
    
    # Fallback to Env
    if settings.SMTP_HOST:
        return {
            "host": settings.SMTP_HOST,
            "port": settings.SMTP_PORT,
            "username": settings.SMTP_USER,
            "password": settings.SMTP_PASSWORD,
            "from_email": settings.EMAILS_FROM_EMAIL,
            "reply_to_email": None
        }
        
    return None

async def send_email(to_email: str, subject: str, html_content: str):
    """
    Sends an email using the configured SMTP server (DB or Env).
    """
    config = await get_active_smtp_config()
    if not config:
        print("No SMTP configuration found.")
        return False

    try:
        # Create message container
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = config["from_email"]
        msg["To"] = to_email
        if config["reply_to_email"]:
            msg["Reply-To"] = config["reply_to_email"]

        # Attach HTML content
        part = MIMEText(html_content, "html")
        msg.attach(part)

        # Run synchronous SMTP sending in a separate thread to avoid blocking main loop
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, _send_smtp_sync, config, msg, to_email)

    except Exception as e:
        print(f"Failed to prepare email to {to_email}: {str(e)}")
        return False

async def send_reset_password_email(to_email: str, token: str):
    """
    Generates the reset password email content and sends it.
    """
    try:
        template = env.get_template("reset_password.html")
        
        # Construct reset link
        link = f"{settings.FRONTEND_URL}/reset-password?token={token}"
        
        html_content = template.render(
            link=link,
            validity_minutes=30 
        )
        
        return await send_email(
            to_email=to_email,
            subject="Reset Your Password - Vellko",
            html_content=html_content
        )
    except Exception as e:
        print(f"Error preparing reset password email: {str(e)}")
        return False

async def send_invitation_email(to_email: str, username: str, password: str, name: str, role: str):
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
        
        return await send_email(
            to_email=to_email,
            subject="Welcome to Vellko - Your Login Details",
            html_content=html_content
        )
    except Exception as e:
        print(f"Error preparing invitation email: {str(e)}")
        return False

async def send_signup_notification_email(to_emails: list[str], signup_data: dict, signup_id: str):
    """
    Sends a notification email to admins and referrer about a new signup.
    """
    if not to_emails:
        return False
        
    try:
        template = env.get_template("signup_notification.html")
        
        # Link to the signup detail page in dashboard
        link = f"{settings.FRONTEND_URL}/dashboard/signups/{signup_id}"
        
        company_name = signup_data.get("companyInfo", {}).get("companyName", "Unknown Company")
        contact_name = f"{signup_data.get('accountInfo', {}).get('firstName', '')} {signup_data.get('accountInfo', {}).get('lastName', '')}"
        contact_email = signup_data.get("accountInfo", {}).get("email", "")
        referral = signup_data.get("companyInfo", {}).get("referral", "None")
        
        html_content = template.render(
            company_name=company_name,
            contact_name=contact_name,
            contact_email=contact_email,
            referral=referral,
            link=link
        )
        
        # Send to each recipient
        success_count = 0
        for email in to_emails:
            if await send_email(to_email=email, subject=f"New Signup: {company_name}", html_content=html_content):
                success_count += 1
                
        return success_count > 0
    except Exception as e:
        print(f"Error preparing signup notification email: {str(e)}")
        return False
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

def send_signup_notification_email(to_emails: list[str], signup_data: dict, signup_id: str):
    """
    Sends a notification email to admins and referrer about a new signup.
    """
    if not to_emails:
        return False
        
    try:
        template = env.get_template("signup_notification.html")
        
        # Link to the signup detail page in dashboard
        link = f"{settings.FRONTEND_URL}/dashboard/signups/{signup_id}"
        
        company_name = signup_data.get("companyInfo", {}).get("companyName", "Unknown Company")
        contact_name = f"{signup_data.get('accountInfo', {}).get('firstName', '')} {signup_data.get('accountInfo', {}).get('lastName', '')}"
        contact_email = signup_data.get("accountInfo", {}).get("email", "")
        referral = signup_data.get("companyInfo", {}).get("referral", "None")
        
        html_content = template.render(
            company_name=company_name,
            contact_name=contact_name,
            contact_email=contact_email,
            referral=referral,
            link=link
        )
        
        # Send to each recipient
        # Note: In production, use BCC or separate emails to avoid exposing all admin emails to each other if that's a concern.
        # For now, looping to send individual emails is safer/cleaner.
        success_count = 0
        for email in to_emails:
            if send_email(to_email=email, subject=f"New Signup: {company_name}", html_content=html_content):
                success_count += 1
                
        return success_count > 0
    except Exception as e:
        print(f"Error preparing signup notification email: {str(e)}")
        return False

async def send_referral_assignment_email(to_email: str, signup_data: dict, signup_id: str, assigned_by: str):
    """
    Sends a notification email to the new referrer when a signup is assigned to them.
    """
    try:
        template = env.get_template("referral_assignment.html")
        
        # Link to the signup detail page in dashboard
        link = f"{settings.FRONTEND_URL}/dashboard/signups/{signup_id}"
        
        company_name = signup_data.get("companyInfo", {}).get("companyName", "Unknown Company")
        contact_name = f"{signup_data.get('accountInfo', {}).get('firstName', '')} {signup_data.get('accountInfo', {}).get('lastName', '')}"
        contact_email = signup_data.get("accountInfo", {}).get("email", "")
        
        html_content = template.render(
            company_name=company_name,
            contact_name=contact_name,
            contact_email=contact_email,
            assigned_by=assigned_by,
            link=link
        )
        
        return await send_email(
            to_email=to_email,
            subject=f"New Referral Assigned: {company_name}",
            html_content=html_content
        )
    except Exception as e:
        print(f"Error preparing referral assignment email: {str(e)}")
        return False
