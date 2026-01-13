"""
Test script to verify Cloudflare R2 connectivity and upload
"""
import boto3
from botocore.config import Config

# R2 credentials from appsettings
account_id = '4f22ea89a2e684c242ace359b5706b03'
access_key = 'aa934dbced6f083dcba7f9125590d20f'
secret_key = '71ed546e79b20506e19af06054f929da7946178ea7938862a8185a7b9b86405f'
bucket_name = 'dev-ccms'

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
test_content = b'Hello from CCMS! This is a test file uploaded to Cloudflare R2 on 2026-01-10.'
test_key = 'test/dummy-upload-test.txt'

print(f'Uploading test file to {bucket_name}/{test_key}...')
try:
    client.put_object(
        Bucket=bucket_name,
        Key=test_key,
        Body=test_content,
        ContentType='text/plain'
    )
    print('✅ Upload SUCCESS!')

    # Verify by getting object info
    print('Verifying upload...')
    response = client.head_object(Bucket=bucket_name, Key=test_key)
    print(f'✅ File exists! Size: {response["ContentLength"]} bytes')

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
    print(f'❌ Error: {e}')
