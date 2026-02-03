import requests
import json

BASE_URL = "http://localhost:8000"

def test_signup_upsert():
    payload = {
        "companyInfo": {
            "companyName": "Test Company",
            "address": "123 Test St",
            "address2": "Suite 100",
            "city": "Test City",
            "state": "CA",
            "zip": "12345",
            "country": "US",
            "corporateWebsite": "http://test.com",
            "referral": "System Admin"
        },
        "marketingInfo": {
            "paymentModel": "1",
            "primaryCategory": "1",
            "secondaryCategory": "",
            "comments": "Initial submission"
        },
        "accountInfo": {
            "firstName": "John",
            "lastName": "Doe",
            "title": "CEO",
            "workPhone": "1234567890",
            "cellPhone": "",
            "fax": "",
            "email": "upsert_test@example.com",
            "timezone": "Pacific Standard Time"
        },
        "paymentInfo": {
            "payTo": "0",
            "currency": "1",
            "taxClass": "Corporation",
            "ssnTaxId": "12-3456789"
        },
        "agreed": True
    }

    print("Submitting initial signup...")
    resp1 = requests.post(f"{BASE_URL}/signup", json=payload)
    print(f"Status: {resp1.status_code}, Response: {resp1.json()}")

    # Update payload
    payload["marketingInfo"]["comments"] = "Updated submission"
    payload["companyInfo"]["companyName"] = "Updated Company Name"

    print("\nSubmitting updated signup with same email...")
    resp2 = requests.post(f"{BASE_URL}/signup", json=payload)
    print(f"Status: {resp2.status_code}, Response: {resp2.json()}")

    if resp2.status_code == 200 and "updated" in resp2.json()["message"].lower():
        print("\nSUCCESS: Signup updated correctly.")
    else:
        print("\nFAILURE: Signup was not updated correctly.")

if __name__ == "__main__":
    test_signup_upsert()
