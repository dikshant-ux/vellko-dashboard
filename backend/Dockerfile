# Use an official Python runtime as a parent image
FROM python:3.9-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Set the working directory in the container
WORKDIR /app

# Install system dependencies (if any needed for python packages)
RUN apt-get update && apt-get install -y --no-install-recommends gcc libpq-dev && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Copy the requirements file into the container at /app
COPY requirements.txt /app/

# Install any needed packages specified in requirements.txt
# Also install gunicorn for production deployment
RUN pip install --no-cache-dir -r requirements.txt gunicorn uvicorn

# Copy the rest of the application code
COPY . /app/

# Create directory for uploads if it doesn't exist
RUN mkdir -p uploads

# Expose port 8000
EXPOSE 8000

# Run the application using Gunicorn with Uvicorn workers
CMD ["gunicorn", "main:app", "--workers", "4", "--worker-class", "uvicorn.workers.UvicornWorker", "--bind", "0.0.0.0:8000"]
