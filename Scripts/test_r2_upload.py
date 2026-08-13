"""
Test script to verify Cloudflare R2 connectivity and upload.

USAGE: set environment variables before running:
  export R2_ACCOUNT_ID=your_account_id
  export R2_ACCESS_KEY_ID=your_access_key
  export R2_SECRET_ACCESS_KEY=your_secret_key
  export R2_BUCKET_NAME=dev-ccms
Then: python test_r2_upload.py
"""
import os

import boto3
from botocore.config import Config

account_id = os.environ.get('R2_ACCOUNT_ID')
access_key = os.environ.get('R2_ACCESS_KEY_ID')
secret_key = os.environ.get('R2_SECRET_ACCESS_KEY')
bucket_name = os.environ.get('R2_BUCKET_NAME', 'dev-ccms')

if not all([account_id, access_key, secret_key]):
    print('Missing R2 credentials. Set these environment variables:')
    print('   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY')
    raise SystemExit(1)

# Create S3 client for R2
r2_endpoint = f'https://{account_id}.r2.cloudflarestorage.com'
print(f'Connecting to R2 endpoint: {r2_endpoint}')

client = boto3.client(
    's3',
    endpoint_url=r2_endpoint,
    aws_access_key_id=access_key,
    aws_secret_access_key=secret_key,
    config=Config(signature_version='s3v4')
)

# Test upload
test_content = b'Hello from CCMS! This is a test file uploaded to Cloudflare R2.'
test_key = 'test/dummy-upload-test.txt'

print(f'Uploading test file to {bucket_name}/{test_key}...')
try:
    client.put_object(
        Bucket=bucket_name,
        Key=test_key,
        Body=test_content,
        ContentType='text/plain'
    )
    print('Upload SUCCESS!')

    # Verify by getting object info
    print('Verifying upload...')
    response = client.head_object(Bucket=bucket_name, Key=test_key)
    print(f'File exists! Size: {response["ContentLength"]} bytes')

    # List objects in test folder
    print('\nListing objects in bucket:')
    list_response = client.list_objects_v2(Bucket=bucket_name, MaxKeys=10)
    if 'Contents' in list_response:
        for obj in list_response['Contents']:
            print(f'  - {obj["Key"]} ({obj["Size"]} bytes)')
    else:
        print('  (bucket is empty or no permissions to list)')

    # Public URL (if public access enabled)
    url = f'https://pub-{account_id}.r2.dev/{test_key}'
    print(f'\nPublic URL (if enabled): {url}')

except Exception as e:
    print(f'Error: {e}')
