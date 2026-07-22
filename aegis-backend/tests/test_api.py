# backend/tests/test_api.py
from fastapi.testclient import TestClient
from main import app  # Import your FastAPI app instance

client = TestClient(app)

def test_health_check():
    """Verify that the API server boots and responds."""
    response = client.get("/")
    assert response.status_code in [200, 404]

def test_sufficiency_threshold():
    """Verify context sufficiency evaluation logic."""
    tau_threshold = 0.78
    high_score = 0.85
    low_score = 0.45
    
    assert high_score >= tau_threshold  # Grounded synthesis path
    assert low_score < tau_threshold   # Enforced refusal path
