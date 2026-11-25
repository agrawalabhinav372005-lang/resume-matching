"""Serve a single-user recruiting workspace on the local machine."""

import argparse
import json
import sqlite3
from functools import partial
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

APP = Path(__file__).resolve().parent
API = "/api/workspace"
MAX_REQUEST = 24 * 1024 * 1024


class WorkspaceHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, database, **kwargs):
        self.database = database
        super().__init__(*args, directory=str(APP / "dist"), **kwargs)

    def allowed_host(self):
        port = self.server.server_port
        return self.headers.get("Host") in (f"127.0.0.1:{port}", f"localhost:{port}")

    def send_json(self, status, value):
        body = json.dumps(value, separators=(",", ":"), ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def list_directory(self, path):
        self.send_error(HTTPStatus.NOT_FOUND)
        return None

    def do_HEAD(self):
        if not self.allowed_host():
            self.send_error(HTTPStatus.FORBIDDEN)
            return
        super().do_HEAD()

    def do_GET(self):
        if not self.allowed_host():
            self.send_error(HTTPStatus.FORBIDDEN)
            return
        if urlsplit(self.path).path != API:
            super().do_GET()
            return
        with sqlite3.connect(self.database) as db:
            revision, payload = db.execute("SELECT revision, payload FROM workspace WHERE id=1").fetchone()
        self.send_json(HTTPStatus.OK, {"revision": revision, "data": json.loads(payload)})

    def do_PUT(self):
        if urlsplit(self.path).path != API:
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        origin = self.headers.get("Origin")
        if not self.allowed_host() or (origin and origin != f"http://{self.headers['Host']}"):
            self.send_error(HTTPStatus.FORBIDDEN)
            return
        if self.headers.get_content_type() != "application/json":
            self.send_error(HTTPStatus.UNSUPPORTED_MEDIA_TYPE)
            return
        try:
            size = int(self.headers.get("Content-Length", "0"))
            if size <= 0 or size > MAX_REQUEST:
                self.send_error(HTTPStatus.REQUEST_ENTITY_TOO_LARGE)
                return
            value = json.loads(self.rfile.read(size))
            revision, data = value["revision"], value["data"]
            if type(revision) is not int or revision < 0 or revision >= 2**53 - 1:
                raise ValueError()
            if not isinstance(data, dict) or set(data) != {"profiles", "jobs", "reviews"}:
                raise ValueError()
            if not all(isinstance(data[key], list) for key in data):
                raise ValueError()
        except (ValueError, KeyError, TypeError, RecursionError):
            self.send_error(HTTPStatus.BAD_REQUEST)
            return
        try:
            with sqlite3.connect(self.database) as db:
                update = db.execute(
                    "UPDATE workspace SET revision=revision+1, payload=? WHERE id=1 AND revision=?",
                    (json.dumps(data, ensure_ascii=False), revision),
                )
        except sqlite3.Error:
            self.send_json(HTTPStatus.SERVICE_UNAVAILABLE, {"error": "Could not save workspace"})
            return
        if not update.rowcount:
            self.send_json(HTTPStatus.CONFLICT, {"error": "Workspace revision changed"})
            return
        self.send_json(HTTPStatus.OK, {"revision": revision + 1})


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--database", type=Path, default=APP / "workspace-data" / "workspace.sqlite3")
    args = parser.parse_args()
    args.database.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    args.database.touch(mode=0o600, exist_ok=True)
    with sqlite3.connect(args.database) as db:
        db.execute("CREATE TABLE IF NOT EXISTS workspace (id INTEGER PRIMARY KEY, revision INTEGER NOT NULL, payload TEXT NOT NULL)")
        db.execute("INSERT OR IGNORE INTO workspace VALUES (1, 0, 'null')")
    with ThreadingHTTPServer(("127.0.0.1", args.port), partial(WorkspaceHandler, database=args.database)) as server:
        print(f"RESUME MATCHING is available at http://127.0.0.1:{server.server_port}", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
