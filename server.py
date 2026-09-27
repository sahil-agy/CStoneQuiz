import http.server
import socketserver
import json
import os
import sys

# Ensure local directory is in PYTHONPATH for importing ADK agent
base_dir = os.path.dirname(os.path.abspath(__file__))
if base_dir not in sys.path:
    sys.path.insert(0, base_dir)

import agent

PORT = int(os.environ.get('PORT', 8080))

class QuizRequestHandler(http.server.SimpleHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')
        self.end_headers()

    def do_POST(self):
        if self.path == '/generate-ai-quiz':
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length).decode('utf-8') if content_length > 0 else '{}'
            
            try:
                req_data = json.loads(body)
            except Exception:
                req_data = {}

            count = req_data.get('count', 5)
            topic = req_data.get('topic', 'Mixed Architecture')
            difficulty = req_data.get('difficulty', 'Scenario-based')

            print(f"[ADK Server] Generating {count} AI questions for topic '{topic}' ({difficulty})...")

            try:
                # Invoke ADK agent question generator tool
                questions = agent.generate_quiz_questions(topic=topic, difficulty=difficulty, count=count)

                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
                self.send_header('Access-Control-Allow-Headers', 'Content-Type')
                self.end_headers()
                self.wfile.write(json.dumps({'success': True, 'questions': questions}).encode('utf-8'))
                return
            except Exception as e:
                print("[ADK Server] Question generation failed:", e)
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'error': str(e)}).encode('utf-8'))
                return
        else:
            super().do_GET()

if __name__ == '__main__':
    print(f"Starting ADK Agent Runtime & Web UI server on 0.0.0.0:{PORT}...")
    with socketserver.TCPServer(("0.0.0.0", PORT), QuizRequestHandler) as httpd:
        httpd.serve_forever()
