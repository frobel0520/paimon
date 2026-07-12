from flask import Flask, jsonify
from flask_cors import CORS

from app.database import Base, engine
from app.routers import diet, notes, places, users

app = Flask(__name__)
CORS(app, origins=["http://localhost:5173", "http://127.0.0.1:5173"])

Base.metadata.create_all(bind=engine)

for module in (users, notes, diet, places):
    app.register_blueprint(module.bp)


@app.get("/api/health")
def health():
    return jsonify({"status": "ok", "app": "paimon"})


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8000, debug=True)
