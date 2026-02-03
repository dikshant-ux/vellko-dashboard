import requests

def test_referrers():
    try:
        response = requests.get("http://localhost:8000/referrers")
        print(f"Status: {response.status_code}")
        print(f"Referrers: {response.json()}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_referrers()
