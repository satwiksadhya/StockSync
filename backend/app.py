import os
import pandas as pd

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

from services.report_service import generate_report
from flask import send_file
from services.demand_forecast import forecast_demand
from services.inventory_service import calculate_inventory
from services.revenue_service import calculate_revenue
from services.expiry_service import detect_expiry
from rag.llm_client import call_llm
import requests


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

        inventory = calculate_inventory(df, demand)
        revenue = calculate_revenue(df, demand)
        expiry = detect_expiry(df, demand)

        # ---------- SAFE CALCULATIONS ----------
        total_revenue = 0
        for v in revenue.values():
            if isinstance(v, dict):
                total_revenue += v.get("Predicted Revenue", 0)
            elif isinstance(v, (int, float)):
                total_revenue += v

        reorder_count = sum(
            1 for v in inventory.values()
            if isinstance(v, dict) and v.get("Status") == "LOW_STOCK"
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


@app.route("/download_report", methods=["POST"])
def download_report():
    try:
        data = request.json

        print("DEBUG: Download request received")

        if not data:
            return jsonify({"error": "No data provided"}), 400

        file_path = generate_report(data)

        print("DEBUG: Report generated at:", file_path)

        return send_file(
            file_path,
            as_attachment=True,
            download_name="Business_Report.pdf"
        )

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500



@app.route("/ask_ai", methods=["POST"])
def ask_ai():
    global analytics_data

    if not analytics_data:
        return jsonify({"error": "Upload CSV first"}), 400

    data = request.json

    low_stock_products = {
        name: details for name, details in analytics_data["inventory_data"].items()
        if isinstance(details, dict) and details.get("Status") == "LOW_STOCK"
    }

    # ✅ ADD THIS
    revenue_products = analytics_data["revenue_data"]

    prompt = f"""
Business Summary:
Total Revenue: {analytics_data['total_revenue']}
Reorders Needed: {analytics_data['reorder_count']}
Expiry Risks: {analytics_data['expiry_count']}

Low Stock Products:
{low_stock_products}

Revenue by Product:
{revenue_products}

Full Inventory Data:
{analytics_data['inventory_data']}

User Question:
{data.get('question')}

Rules:
- Answer ONLY from given data
- If asked for top products → sort by revenue
- If asked for restocking → return PRODUCT NAMES
- Be precise
- Do NOT give generic answers
"""

    # ✅ UNCOMMENT THIS BLOCK
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

    

def call_llm(provider, api_key, model_name, prompt):

    if provider == "groq":
        url = "https://api.groq.com/openai/v1/chat/completions"

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }

        data = {
            "model": model_name,
            "messages": [
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.3
        }

        response = requests.post(url, headers=headers, json=data)

        print("Groq Status:", response.status_code)
        print("Groq Response:", response.text)

        if response.status_code != 200:
            raise Exception(response.text)

        return response.json()["choices"][0]["message"]["content"]

    else:
        raise Exception("Unsupported provider")


# ---------- DEBUG ROUTE ----------
@app.route("/test")
def test():
    return "Flask is working!"


# ---------- RUN ----------

import os

if __name__ == "__main__":
    port  = int(os.environ.get("PORT", 3000))
    app.run(host="0.0.0.0", port=port)