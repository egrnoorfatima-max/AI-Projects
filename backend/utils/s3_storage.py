import os
import boto3
from botocore.exceptions import ClientError
from botocore.config import Config
from dotenv import load_dotenv
load_dotenv()


_s3_client = None


def _get_client():
    global _s3_client
    
    if _s3_client is None:
        config = Config(signature_version='s3v4')
        region = os.getenv('AWS_REGION', 'eu-north-1')
        
        _s3_client = boto3.client(
            's3',
            aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
            aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
            region_name=region,
            endpoint_url=f'https://s3.{region}.amazonaws.com',
            config=config
        )
    
    return _s3_client



def upload_resume_to_s3(local_path: str, email: str, filename: str) -> str:
    """Upload a PDF to S3 under resumes/{email}/{timestamp}_{filename} and return the key."""
    from datetime import datetime
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    bucket = os.getenv('S3_BUCKET_NAME')
    key = f"resumes/{email}/{timestamp}_{filename}"
    _get_client().upload_file(
        local_path,
        bucket,
        key,
        ExtraArgs={"ContentType": "application/pdf"},
    )
    return key


def generate_presigned_url(s3_key: str, expiry_seconds: int = 3600) -> str:
    """Generate a time-limited presigned URL for downloading a resume."""
    bucket = os.getenv('S3_BUCKET_NAME')  # ← FIXED
    url = _get_client().generate_presigned_url(
        "get_object",
        Params={"Bucket": bucket, "Key": s3_key},
        ExpiresIn=expiry_seconds,
    )
    return url