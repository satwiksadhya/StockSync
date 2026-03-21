import requests
from openai import OpenAI


def call_llm(provider, api_key, model_name, prompt):

    try:
        # ---------- OPENAI ----------
        if provider == "openai":
            client = OpenAI(api_key=api_key)

            res = client.chat.completions.create(
                model=model_name,
                messages=[
                    {"role": "system", "content": "You are a helpful business analytics assistant."},
                    {"role": "user", "content": prompt}
                ]
            )

            return res.choices[0].message.content

        # ---------- GROQ ----------
        elif provider == "groq":
            url = "https://api.groq.com/openai/v1/chat/completions"

            headers = {
                "Authorization": f"Bearer {api_key}",   # ✅ FIXED
                "Content-Type": "application/json"
            }

            res = requests.post(url, headers=headers, json={
                "model": model_name,
                "messages": [{"role": "user", "content": prompt}]
            })

            data = res.json()

            # Handle API errors safely
            if "error" in data:
                return f"Groq API Error: {data['error']}"

            return data["choices"][0]["message"]["content"]

        else:
            return "Unsupported provider"

    except Exception as e:
        return f"LLM Error: {str(e)}"
