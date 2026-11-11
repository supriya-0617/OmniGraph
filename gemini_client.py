
"""Small standalone Gemini client using Google Application Default Credentials.

The website uses ``backend.app.ai.llm_client``; this module remains useful for
local scripts and deliberately has no hard-coded project or credential.
"""
import os
from functools import lru_cache

import google.auth
from google import genai


@lru_cache(maxsize=1)
def _client() -> genai.Client:
    _, adc_project = google.auth.default(
        scopes=["https://www.googleapis.com/auth/cloud-platform"]
    )
    project = os.getenv("VERTEX_PROJECT_ID") or adc_project
    if not project:
        raise RuntimeError(
            "Set VERTEX_PROJECT_ID or authenticate ADC with a project: "
            "gcloud auth application-default login"
        )
    return genai.Client(
        vertexai=True,
        project=project,
        location=os.getenv("VERTEX_LOCATION", "global"),
    )

def generate_response(prompt: str) -> str:
    response = _client().models.generate_content(
        model=os.getenv("LLM_MODEL", "gemini-2.5-flash"),
        contents=prompt
    )
    if not response.text:
        raise RuntimeError("Gemini returned an empty response.")
    return response.text
