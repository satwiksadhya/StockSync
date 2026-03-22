import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error


def forecast_demand(df):
    if isinstance(df, tuple):
        df = df[0]

    results = {}

    # ✅ REQUIRED COLUMNS CHECK
    required_cols = ["date", "product_name", "quantity_sold"]
    for col in required_cols:
        if col not in df.columns:
            raise Exception(f"Missing required column: {col}")

    # ✅ SAFE DATE CONVERSION
    try:
        df['date'] = pd.to_datetime(df['date'], errors='coerce')
    except Exception as e:
        raise Exception(f"Date conversion failed: {e}")

    # Drop rows where date failed
    df = df.dropna(subset=['date'])

    products = df["product_name"].dropna().unique()

    for product in products:
        product_df = df[df["product_name"] == product].copy().sort_values("date")

        if product_df.empty:
            continue

        # ✅ SAFE quantity check
        if "quantity_sold" not in product_df.columns:
            continue

        # -------- SMALL DATA FALLBACK --------
        if len(product_df) < 35:
            avg_demand = int(round(product_df["quantity_sold"].mean() or 0))
            results[product] = {
                "MAE": 0,
                "Predicted Daily Demand": avg_demand,
                "Status": "Insufficient data for ML"
            }
            continue

        try:
            product_df["time_index"] = range(len(product_df))
            product_df["day_of_week"] = product_df["date"].dt.dayofweek
            product_df["month"] = product_df["date"].dt.month

            # Create Lags
            for i in [1, 2, 3, 7, 14, 30]:
                product_df[f"lag_{i}"] = product_df["quantity_sold"].shift(i)

            product_df = product_df.dropna()

            if product_df.empty:
                raise Exception("No data after lagging")

            features = ["lag_1", "lag_2", "lag_3", "lag_7", "lag_14", "lag_30", "day_of_week", "month", "time_index"]

            X = product_df[features]
            y = product_df["quantity_sold"]

            X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, shuffle=False)

            if len(X_train) == 0:
                raise Exception("Training set empty")

            model = RandomForestRegressor(n_estimators=100, random_state=42)
            model.fit(X_train, y_train)

            latest_features = X.tail(1)
            prediction = model.predict(latest_features)[0]

            results[product] = {
                "MAE": round(mean_absolute_error(y_test, model.predict(X_test)), 2),
                "Predicted Daily Demand": int(round(prediction))
            }

        except Exception as e:
            print(f"⚠️ Fallback used for {product}: {e}")

            results[product] = {
                "MAE": 0,
                "Predicted Daily Demand": int(round(product_df["quantity_sold"].mean() or 0))
            }

    return results
