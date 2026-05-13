import os
from dotenv import load_dotenv
import requests
import json
import re
import PyPDF2
from groq import Groq

load_dotenv()

API_KEY = os.getenv("GROQ_API_KEY")

def ask_ai(prompt):
    # Send any prompt to Groq and get back just the text response
    client = Groq(api_key=API_KEY)
    
    completion = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}]
    )
    
    return completion.choices[0].message.content


# Test it
# result = ask_ai("Say hello in one sentence")
# print(result) 

def extract_text_from_pdf(pdf_path):
    """
    Opens a PDF file and extracts all text from every page.
    Returns one big string of all the text combined.
    """
    text = ""
    
    with open(pdf_path, "rb") as file:  # "rb" means read as binary
        reader = PyPDF2.PdfReader(file)
        
        for page in reader.pages:  # loop through every page
            text += page.extract_text()
    
    return text


# Test it — put any resume PDF in your backend folder and try

#extracted = extract_text_from_pdf("Noor.pdf")
#print(extracted)


def parse_resume(pdf_path):
    """
    Parses a resume PDF and extracts structured information.
    
    Args:
        pdf_path: Path to the resume PDF file
        
    Returns:
        Dictionary with extracted resume data containing:
        - name, email, phone, location
        - total_years_experience
        - current_role, current_company
        - skills (list of strings)
        - education (list of objects with degree, institution, year)
        - employment_history (list of objects with role, company, duration, type)
        - employment_gaps (list of strings)
        
    Raises:
        ValueError: If the AI does not return valid JSON

        ValueError: If Gemini does not return valid JSON
    """
    # Extract text from the PDF
    resume_text = extract_text_from_pdf(pdf_path)
    
    # Create a detailed prompt for Gemini
    prompt = f"""
    Extract structured information from this resume and return ONLY a valid JSON object.
    NO markdown, NO backticks, NO explanation - just the raw JSON object.
    
    Return the JSON with these exact fields:
    {{
        "name": "full name as string",
        "email": "email address as string",
        "phone": "phone number as string",
        "location": "city/state/country as string",
        "total_years_experience": "total years as number",
        "current_role": "current job title as string",
        "current_company": "current company as string",
        "skills": ["skill1", "skill2", ...],
        "education": [
            {{"degree": "degree type", "institution": "school name", "year": "graduation year"}},
            ...
        ],
        "employment_history": [
            {{"role": "job title", "company": "company name", "duration": "years or period", "type": "fulltime or contract"}},
            ...
        ],
        "employment_gaps": ["explanation of gap 1", "explanation of gap 2", ...]
    }}
    
    Resume text to parse:
    {resume_text}
    """
    

    # Get response from the AI
    ai_response = ask_ai(prompt)
    
    # Try to parse the JSON response
    try:
        resume_data = json.loads(ai_response)
        return resume_data
    except json.JSONDecodeError as e:
        print("ERROR: AI did not return valid JSON")
        print("Raw response from AI:")
        print(ai_response)
        raise ValueError(
            f"AI returned invalid JSON. Could not parse response. Error: {str(e)}"
        )


def match_jd(resume_data, jd_text):
    """
    Matches a parsed resume against a job description and returns a detailed analysis.
    
    Args:
        resume_data: Dictionary of parsed resume data
        jd_text: Plain text string of the job description
        
    Returns:
        Dictionary with detailed matching analysis containing:
        - overall_score: 0-100
        - score_breakdown: skills_match, experience_match, education_match, seniority_match
        - matching_skills, missing_skills, bonus_skills
        - experience_analysis with requirement comparison
        - strong_points and red_flags
        - scorecard with ratings
        - summary and hire_recommendation
        
    Raises:
        ValueError: If AI does not return valid JSON
    """
    # Convert resume data to JSON string
    resume_json = json.dumps(resume_data)
    
    # Build the detailed prompt
    prompt = f"""You are an expert technical recruiter and hiring specialist with 15 years of experience.

Deeply analyze the following resume against the job description below. Be strict and realistic in your scoring — do NOT be generous.

RESUME DATA:
{resume_json}

JOB DESCRIPTION:
{jd_text}

Return ONLY a valid JSON object with NO markdown, NO backticks, NO explanation whatsoever.

The JSON must have these exact fields:
{{
    "overall_score": <number 0-100>,
    "score_breakdown": {{
        "skills_match": <number 0-100>,
        "experience_match": <number 0-100>,
        "education_match": <number 0-100>,
        "seniority_match": <number 0-100>
    }},
    "matching_skills": [<list of skill strings found in both resume and JD>],
    "missing_skills": [<list of skill strings required in JD but missing from resume>],
    "bonus_skills": [<list of extra skills candidate has that add value but aren't in JD>],
    "experience_analysis": {{
        "required_years": <number from JD>,
        "candidate_years": <number from resume>,
        "meets_requirement": <boolean>,
        "comment": "<one sentence explanation>"
    }},
    "strong_points": [<at least 3 specific strings describing why candidate is strong, referencing actual resume details>],
    "red_flags": [<list of specific concerns about candidate for this role, or empty list if none>],
    "scorecard": {{
        "technical_skills": {{"rating": "<Strong/Good/Weak>", "reason": "<one sentence>"}},
        "experience_level": {{"rating": "<Strong/Good/Weak>", "reason": "<one sentence>"}},
        "education": {{"rating": "<Strong/Good/Weak>", "reason": "<one sentence>"}},
        "career_progression": {{"rating": "<Strong/Good/Weak>", "reason": "<one sentence>"}},
        "role_alignment": {{"rating": "<Strong/Good/Weak>", "reason": "<one sentence>"}}
    }},
    "summary": "<3 sentences max, written as if a senior recruiter is briefing a hiring manager>",
    "hire_recommendation": "<exactly one of: Strong Yes, Yes, Maybe, No>",
    "recommendation_reason": "<one paragraph explaining the hire recommendation decision in detail>"
}}"""
    
    # Get response from the AI
    ai_response = ask_ai(prompt)
    
    # Clean the response
    ai_response = ai_response.strip()
    # Remove markdown backticks
    ai_response = re.sub(r'^```(?:json)?\n?', '', ai_response)
    ai_response = re.sub(r'\n?```$', '', ai_response)
    
    # Fix common JSON errors
    ai_response = ai_response.replace('"role_alignment": {"rating"', '"role_alignment": {"rating"').replace('reason": "..."]', 'reason": "..."}')
    ai_response = re.sub(r'\]([\s]*\})', r'}\1', ai_response)
    
    # Try to parse the JSON response
    try:
        match_result = json.loads(ai_response)
        return match_result
    except json.JSONDecodeError as e:
        print("="*50)
        print("JSON DECODE ERROR")
        print("="*50)
        print(f"Error: {str(e)}")
        print(f"Error position: {e.pos}")
        print("\nCleaned AI Response:")
        print(ai_response)
        print("="*50)

        try:
            json_match = re.search(r'\{.*\}', ai_response, re.DOTALL)
            if json_match:
                json_str = json_match.group(0)
                print("\nExtracted JSON:")
                print(json_str)
                match_result = json.loads(json_str)
                return match_result
            else:
                raise ValueError("No JSON object found in AI response")
        except json.JSONDecodeError as e2:
            print(f"\nSecond parse attempt failed: {str(e2)}")
            raise ValueError(f"AI did not return valid JSON. Error: {str(e)}")
        except Exception as e3:
            print(f"\nUnexpected error: {str(e3)}")
            raise ValueError(f"Failed to parse AI response: {str(e3)}")

    
# Test parse_resume with sample_resume.pdf
if __name__ == "__main__":
    try:
        parsed_data = parse_resume("Noor.pdf")
        print("Resume parsed successfully")
        
        jd_text = """We are looking for a Senior Data Engineer with 5+ years of experience. Must have strong skills in Python, SQL, Apache Spark, Airflow, and cloud platforms like AWS or Azure. Experience with Power BI or any visualization tool is a plus. Should have experience building ETL pipelines and data warehouses."""
        
        match_result = match_jd(parsed_data, jd_text)
        print("JD Match Analysis:")
        print(json.dumps(match_result, indent=2))
    except FileNotFoundError:
        print("Error: Noor.pdf not found. Please make sure the file exists in the backend folder.")
    except ValueError as e:
        print(f"Error: {e}")