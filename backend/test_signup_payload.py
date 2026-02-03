import asyncio
from models import SignupCreate
import json

payload = {
    "companyInfo": {
        "companyName": "Test Company",
        "address": "123 Test St",
        "address2": "Suite 100",
        "city": "Test City",
        "state": "Test State",
        "zip": "12345",
        "country": "US",
        "corporateWebsite": "http://example.com",
        "referral": "Google"
    },
    "marketingInfo": {
        "paymentModel": "1",
        "primaryCategory": "1",
        "secondaryCategory": "1",
        "comments": "Test comments"
    },
    "accountInfo": {
        "firstName": "John",
        "lastName": "Doe",
        "title": "Mr",
        "workPhone": "1234567890",
        "cellPhone": "0987654321",
        "fax": "",
        "email": "test@example.com",
        "timezone": "UTC",
        "imService": "Skype",
        "imHandle": "johndoe"
    },
    "paymentInfo": {
        "payTo": "0",
        "currency": "1",
        "taxClass": "Corporation",
        "ssnTaxId": "12-3456789"
    },
    "agreed": True
}

import requests

def test_payload():
    try:
        # Validate against pydantic model locally (optional, leaving correctly)
        # signup = SignupCreate(**payload) 
        # print("Payload is VALID (Local)")

        # Send actual request
        response = requests.post("http://localhost:8000/signup", json=payload)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text}")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_payload()
