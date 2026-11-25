import json
import subprocess
import sys
import tempfile
import unittest
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class WorkspaceServerTest(unittest.TestCase):
    def start_server(self):
        self.server = subprocess.Popen(
            [sys.executable, str(ROOT / "server.py"), "--port", "0", "--database", str(self.database)],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        self.addCleanup(self.stop_server, self.server)
        self.url = self.server.stdout.readline().split()[-1]

    def stop_server(self, server):
        server.terminate()
        server.communicate(timeout=10)

    def request(self, data=None, origin=None):
        headers = {"Content-Type": "application/json"}
        if origin:
            headers["Origin"] = origin
        payload = json.dumps(data).encode() if data is not None else None
        method = "PUT" if payload is not None else "GET"
        request = urllib.request.Request(self.url + "/api/workspace", data=payload, headers=headers, method=method)
        with urllib.request.urlopen(request, timeout=10) as response:
            return json.load(response)

    def test_records_survive_restart_and_stale_writes_are_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            self.database = Path(directory) / "workspace.sqlite3"
            self.start_server()
            self.assertEqual(self.request(), {"revision": 0, "data": None})
            records = {
                "profiles": [{"id": "2", "name": "Test Candidate", "text": "Skills: SQL", "format": "Pasted text", "jobId": "1"}],
                "jobs": [{"id": "1", "title": "Analyst"}],
                "reviews": [["1/2", {"status": "reviewed", "note": "Checked SQL evidence"}]],
            }
            self.assertEqual(self.request({"revision": 0, "data": records}), {"revision": 1})
            with self.assertRaises(urllib.error.HTTPError) as error:
                self.request({"revision": 0, "data": {"profiles": [], "jobs": [], "reviews": []}})
            self.assertEqual(error.exception.code, 409)
            error.exception.close()
            with self.assertRaises(urllib.error.HTTPError) as error:
                self.request({"revision": 1, "data": records}, origin="https://example.invalid")
            self.assertEqual(error.exception.code, 403)
            error.exception.close()

            self.stop_server(self.server)
            self.start_server()
            self.assertEqual(self.request(), {"revision": 1, "data": records})


if __name__ == "__main__":
    unittest.main()
