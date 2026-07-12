from flask import Flask, jsonify
from flask_cors import CORS

from app.database import init_db
from app.routers import places

app = Flask(__name__)
CORS(app, origins=["http://localhost:5173", "http://127.0.0.1:5173"])

init_db()

app.register_blueprint(places.bp)


@app.get("/api/health")
def health():
    return jsonify({"status": "ok", "app": "paimon"})


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8000, debug=True)
