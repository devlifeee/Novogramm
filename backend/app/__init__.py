import time
import uuid

from flask import Flask, g, jsonify, request
from flask_cors import CORS
from werkzeug.middleware.proxy_fix import ProxyFix

from .config import Config
from .database import PostgreSQL, database_ready, run_migrations


def create_app(config_overrides=None):
    app = Flask(__name__)
    app.config.from_object(Config)
    if config_overrides:
        app.config.update(config_overrides)
    Config.validate()

    CORS(app, origins=app.config["CORS_ORIGINS"], supports_credentials=False)
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_host=1, x_proto=1)
    PostgreSQL.init_app(app)
    run_migrations()

    @app.before_request
    def request_started():
        g.request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))[:128]
        g.request_started = time.monotonic()

    @app.after_request
    def secure_response(response):
        response.headers["X-Request-ID"] = g.get("request_id", "")
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"
        response.headers["Cache-Control"] = "no-store" if request.path.startswith(("/api/", "/login", "/register")) else "no-cache"
        app.logger.info("request", extra={"request_id": g.get("request_id"), "method": request.method, "path": request.path, "status": response.status_code, "duration_ms": round((time.monotonic()-g.get("request_started", time.monotonic()))*1000, 2)})
        return response

    @app.errorhandler(413)
    def too_large(_error):
        return jsonify({"success": False, "error": {"code": "payload_too_large", "message": "Запрос слишком большой"}}), 413

    @app.errorhandler(Exception)
    def unexpected(error):
        error_id = str(uuid.uuid4())
        app.logger.exception("unhandled_error id=%s request_id=%s", error_id, g.get("request_id"))
        return jsonify({"success": False, "error": {"code": "internal_error", "message": "Внутренняя ошибка", "id": error_id}}), 500

    @app.get("/health/live")
    @app.get("/health")
    def liveness():
        return jsonify({"status": "healthy"})

    @app.get("/health/ready")
    def readiness():
        ready = database_ready()
        return jsonify({"status": "ready" if ready else "not_ready"}), 200 if ready else 503

    from .auth.routes import auth_bp
    from .main.home import main
    app.register_blueprint(auth_bp)
    app.register_blueprint(main)
    return app
