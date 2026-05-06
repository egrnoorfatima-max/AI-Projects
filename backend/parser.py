import os
from dotenv import load_dotenv
import requests
import json
import PyPDF2
load_dotenv()

API_KEY = os.getenv("GEMINI_API_KEY")
URL = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key={API_KEY}"

def ask_gemini(prompt):
    
    #Send any prompt to Gemini and get back just the text response.
    #Think of this as your core function — everything else will use it.
 
    payload = {
        "contents": [{
            "parts": [{"text": prompt}]
        }]
    }

    response = requests.post(URL, json=payload)
    data = response.json()

    # Extract just the text from the nested response
    return data['candidates'][0]['content']['parts'][0]['text']


# Test it
result = ask_gemini("Say hello in one sentence")
print(result) 

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
extracted = extract_text_from_pdf("Noor.pdf")
print(extracted)


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
    
    # Get response from Gemini
    gemini_response = ask_gemini(prompt)
    
    # Try to parse the JSON response
    try:
        resume_data = json.loads(gemini_response)
        return resume_data
    except json.JSONDecodeError as e:
        print("ERROR: Gemini did not return valid JSON")
        print("Raw response from Gemini:")
        print(gemini_response)
        raise ValueError(
            f"Gemini returned invalid JSON. Could not parse response. Error: {str(e)}"
        )


# Test parse_resume with sample_resume.pdf
if __name__ == "__main__":
    try:
        parsed_data = parse_resume("Noor.pdf")
        print("Successfully parsed resume!")
        print(json.dumps(parsed_data, indent=2))
    except FileNotFoundError:
        print("Error: sample_resume.pdf not found. Please make sure the file exists in the backend folder.")
    except ValueError as e:
        print(f"Error: {e}")