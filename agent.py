import json
import re
import os
import subprocess
import urllib.request
import urllib.error
from typing import Dict, List, Any, Optional

from google.adk.agents.llm_agent import Agent

# Load reference question sets for context
def _load_questions():
    try:
        base_dir = os.path.dirname(os.path.abspath(__file__))
        q_path = os.path.join(base_dir, 'questions.js')
        if os.path.exists(q_path):
            with open(q_path, 'r', encoding='utf-8') as f:
                content = f.read()
            m = re.search(r'const\s+QUIZ_QUESTION_SETS\s*=\s*(\{[\s\S]*?\});', content)
            if m:
                return json.loads(m.group(1))
    except Exception as e:
        print("Error reading questions.js:", e)
    return {}

QUESTION_SETS = _load_questions()

def get_sample_question_sets() -> Dict[str, Any]:
    """Returns the available reference question sets:
    - Set 1 by Sahil Suri (30 Core Questions)
    - Set 2 by Tobi Kaymak (30 Scenario Questions)
    """
    summary = {}
    for key, data in QUESTION_SETS.items():
        summary[key] = {
            "title": data.get("title"),
            "description": data.get("description"),
            "question_count": len(data.get("questions", []))
        }
    return summary

def generate_quiz_questions(
    topic: str = "Mixed Architecture",
    difficulty: str = "Scenario-based",
    count: int = 5
) -> List[Dict[str, Any]]:
    """Generates new enterprise AI & agentic systems assessment questions using Gemini 3.8 Flash with reference context.

    Args:
        topic: Focus area e.g. "Multi-Agent & ADK Architecture", "Grounding, RAG & BigQuery NL2SQL", "MCP & Tool Calling", "Enterprise Security & VPC", "Mixed Architecture".
        difficulty: Question style e.g. "Scenario-based", "Standard Conceptual", "Challenging Deep Dive".
        count: Number of questions to generate (5, 10, or 15).
    """
    print(f"[ADK Agent Tool] Generating {count} AI questions for topic '{topic}' ({difficulty})...")
    
    # Extract context samples
    sample_text = []
    set1_qs = QUESTION_SETS.get('set1', {}).get('questions', [])
    set2_qs = QUESTION_SETS.get('set2', {}).get('questions', [])
    all_qs = set1_qs + set2_qs

    for i, q in enumerate(all_qs[:20]):
        sample_text.append(f"Q{i+1}: {q.get('question')} | Answer: {q.get('options', [])[q.get('correctIndex', 0)] if q.get('options') else ''}")

    context_prompt = "\n".join(sample_text)

    prompt = f"""You are a principal Google Cloud AI Architect creating technical certification questions on Gemini Enterprise, Agent Development Kit (ADK), Multi-Agent Topologies, MCP (Model Context Protocol), RAG, and Grounding.

Here are sample questions from the reference curriculum for style and topic context:
---
{context_prompt}
---

Generate exactly {count} NEW, high-quality, {difficulty} multiple-choice questions focusing on '{topic}'.
Each question MUST follow this exact JSON schema:
{{
  "id": number (e.g. 101, 102...),
  "question": string (clear, professional technical scenario or question),
  "options": array of 4 string options (e.g. ["A) ...", "B) ...", "C) ...", "D) ..."]),
  "correctIndex": integer (0 for A, 1 for B, 2 for C, 3 for D),
  "correctLetter": string ("A", "B", "C", or "D"),
  "module": string (e.g. "Gemini AI Generated • {topic}"),
  "explanation": string (detailed step-by-step technical explanation referencing Google Cloud architecture best practices)
}}

Return ONLY a valid JSON array containing the {count} question objects inside a markdown ```json ``` block. Ensure all strings use proper escaping.
"""

    try:
        token = subprocess.check_output(['gcloud', 'auth', 'print-access-token']).decode().strip()
    except Exception as e:
        print("[ADK Tool] Error getting gcloud token:", e)
        token = ""

    project = os.environ.get("GOOGLE_CLOUD_PROJECT", "sahil-agy")
    model_id = "gemini-3.8-flash"
    url = f"https://us-central1-aiplatform.googleapis.com/v1/projects/{project}/locations/us-central1/publishers/google/models/{model_id}:generateContent"

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    data = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.7, "topP": 0.95}
    }

    try:
        req = urllib.request.Request(url, data=json.dumps(data).encode('utf-8'), headers=headers)
        try:
            with urllib.request.urlopen(req) as resp:
                res_json = json.loads(resp.read().decode('utf-8'))
                text = res_json['candidates'][0]['content']['parts'][0]['text']
        except urllib.error.HTTPError as http_err:
            if http_err.code == 404:
                fallback_url = f"https://us-central1-aiplatform.googleapis.com/v1/projects/{project}/locations/us-central1/publishers/google/models/gemini-2.5-flash:generateContent"
                req = urllib.request.Request(fallback_url, data=json.dumps(data).encode('utf-8'), headers=headers)
                with urllib.request.urlopen(req) as resp:
                    res_json = json.loads(resp.read().decode('utf-8'))
                    text = res_json['candidates'][0]['content']['parts'][0]['text']
            else:
                raise http_err

        # Parse JSON output
        json_match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', text)
        raw_json = json_match.group(1) if json_match else text.strip()
        cleaned = re.sub(r',\s*([\]\}])', r'\1', raw_json)
        return json.loads(cleaned)
    except Exception as err:
        print("[ADK Tool] Question generation failed:", err)
        return []

def evaluate_quiz_answers(answers: Dict[str, int], set_name: str = "set2") -> Dict[str, Any]:
    """Evaluates candidate answers against a question bank and provides percentage score and detailed review.

    Args:
        answers: Map of question ID string to selected option index (0-3).
        set_name: Question bank used ("set1", "set2", or "combined").
    """
    if set_name == "set1":
        questions = QUESTION_SETS.get('set1', {}).get('questions', [])
    elif set_name == "set2":
        questions = QUESTION_SETS.get('set2', {}).get('questions', [])
    else:
        questions = QUESTION_SETS.get('set1', {}).get('questions', []) + QUESTION_SETS.get('set2', {}).get('questions', [])

    total = len(questions)
    correct = 0
    review = []

    for q in questions:
        q_id = str(q.get("id"))
        user_ans = answers.get(q_id)
        is_correct = (user_ans == q.get("correctIndex"))
        if is_correct:
            correct += 1
        
        review.append({
            "id": q.get("id"),
            "question": q.get("question"),
            "userAnswerIndex": user_ans,
            "correctIndex": q.get("correctIndex"),
            "isCorrect": is_correct,
            "explanation": q.get("explanation")
        })

    percentage = round((correct / total) * 100) if total > 0 else 0
    return {
        "score": correct,
        "total": total,
        "percentage": percentage,
        "masteryBadge": "Distinctive Master" if percentage >= 90 else "Merit Pass" if percentage >= 70 else "Needs Review",
        "review": review
    }

# ADK Root Agent Definition
root_agent = Agent(
    model='gemini-2.5-flash',
    name='cstone_quiz_agent',
    description='Google Cloud Enterprise AI & Agentic Systems Assessment Agent built with ADK.',
    instruction='''You are the Enterprise AI & Agentic Systems Assessment Agent.
Your mission is to administer certification quizzes, synthesize custom AI questions using Gemini, evaluate user responses, and explain complex multi-agent, ADK, MCP, and grounding architecture concepts.

You have access to the following tools:
1. `get_sample_question_sets`: Lists pre-provided sample question banks (Set 1 by Sahil Suri & Set 2 by Tobi Kaymak).
2. `generate_quiz_questions`: Generates new, tailored assessment questions using Gemini with reference context.
3. `evaluate_quiz_answers`: Scores candidate submissions and calculates percentage accuracy and feedback.
''',
    tools=[get_sample_question_sets, generate_quiz_questions, evaluate_quiz_answers]
)
