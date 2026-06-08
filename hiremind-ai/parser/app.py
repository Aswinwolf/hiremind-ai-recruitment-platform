"""Flask wrapper around resume parser. Runs on PORT 5001 by default."""
import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

from parser import parse_resume

load_dotenv()
app = Flask(__name__)
CORS(app)


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"ok": True, "service": "parser"})


@app.route("/parse", methods=["POST"])
def parse():
    data = request.get_json(silent=True) or {}
    file_path = data.get("filePath")
    if not file_path:
        return jsonify({"error": "filePath required"}), 400
    if not os.path.exists(file_path):
        return jsonify({"error": f"file not found: {file_path}"}), 400
    try:
        result = parse_resume(file_path)
        return jsonify(result)
    except Exception as exc:  # noqa: BLE001
        return jsonify({"error": str(exc)}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5001))
    app.run(host="0.0.0.0", port=port, debug=os.environ.get("FLASK_DEBUG") == "1")
