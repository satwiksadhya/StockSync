import os
import pandas as pd

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

from services.demand_forecast import forecast_demand
from services.inventory_service import calculate_inventory
from services.revenue_service import calculate_revenue
from services.expiry_service import detect_expiry
from rag.llm_client import call_llm


# ---------- PATH FIX ----------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_PATH = os.path.abspath(os.path.join(BASE_DIR, "..", "frontend"))

app = Flask(__name__, static_folder=FRONTEND_PATH, static_url_path="")
CORS(app)

analytics_data = None


# ---------- HOME ----------
@app.route("/")
def home():
    return send_from_directory(FRONTEND_PATH, "index.html")


# ---------- UPLOAD ----------
@app.route("/upload", methods=["POST"])
def upload():
    global analytics_data

    try:
        file = request.files.get("file")
        if not file:
            return jsonify({"error": "No file uploaded"}), 400

        df = pd.read_csv(file)

        # ✅ Normalize column names (VERY IMPORTANT)
        df.columns = df.columns.str.strip().str.lower().str.replace(" ", "_")

        print("DEBUG Columns after cleaning:", df.columns.tolist())

        # ---------- CORE PIPELINE ----------
        demand = forecast_demand(df)

        # ✅ FIX: pass forecast results
        inventory = calculate_inventory(df, demand)

        revenue = calculate_revenue(df,demand)
        expiry = detect_expiry(df,demand)

        # ---------- SAFE CALCULATIONS ----------
        total_revenue = 0
        for v in revenue.values():
            if isinstance(v, dict):
                total_revenue += v.get("Predicted Revenue", 0)
            elif isinstance(v, (int, float)):
                total_revenue += v

        reorder_count = sum(
            1 for v in inventory.values()
            if isinstance(v, dict) and v.get("Status") in ["REORDER", "Restock Needed"]
        )

        expiry_count = sum(
            1 for v in expiry.values()
            if isinstance(v, dict) and v.get("Status") in ["Expiry Risk", "High Risk"]
        )

        # ---------- STORE ----------
        analytics_data = {
            "demand_data": demand,
            "revenue_data": revenue,
            "inventory_data": inventory,
            "expiry_data": expiry,
            "total_revenue": total_revenue,
            "reorder_count": reorder_count,
            "expiry_count": expiry_count
        }

        return jsonify(analytics_data)

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# ---------- AI ----------
@app.route("/ask_ai", methods=["POST"])
def ask_ai():
    global analytics_data

    if not analytics_data:
        return jsonify({"error": "Upload CSV first"}), 400

    data = request.json

    prompt = f"""
Business Summary:
Total Revenue: {analytics_data['total_revenue']}
Reorders Needed: {analytics_data['reorder_count']}
Expiry Risks: {analytics_data['expiry_count']}

User Question:
{data.get('question')}
"""

    try:
        answer = call_llm(
            data.get("provider"),
            data.get("api_key"),
            data.get("model_name"),
            prompt
        )

        return jsonify({"answer": answer})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ---------- DEBUG ROUTE ----------
@app.route("/test")
def test():
    return "Flask is working!"


# ---------- RUN ----------
if __name__ == "__main__":
    print("Frontend path:", FRONTEND_PATH)
    app.run(debug=True, port=5000)
