import requests

def test_login():
    url = "http://localhost:8000/token"
    # Credentials from create_admin.py
    data = {
        "username": "admin",
        "password": "password123"
    }
    
    try:
        response = requests.post(url, data=data)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            print("Login SUCCESS")
        else:
            print("Login FAILED")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    try:
        r = requests.get("http://localhost:8000/")
        print("Root Check:", r.status_code, r.text)
    except Exception as e:
        print("Root Check Failed:", e)
    
    test_login()
