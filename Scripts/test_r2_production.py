"""
Test Cloudflare R2 Production Bucket (prod-ccms)
Run this after creating the bucket in Cloudflare Dashboard

USAGE:
  Set environment variables before running:
    export R2_ACCOUNT_ID=your_account_id
    export R2_ACCESS_KEY=your_access_key
    export R2_SECRET_KEY=your_secret_key
  Then: python test_r2_production.py
"""
import os
import boto3
from botocore.config import Config

# R2 credentials from environment variables (NEVER hardcode credentials)
account_id = os.environ.get('R2_ACCOUNT_ID')
access_key = os.environ.get('R2_ACCESS_KEY') or os.environ.get('R2_ACCESS_KEY_ID')
secret_key = os.environ.get('R2_SECRET_KEY') or os.environ.get('R2_SECRET_ACCESS_KEY')
bucket_name = 'prod-ccms'

if not all([account_id, access_key, secret_key]):
    print('❌ Missing R2 credentials. Set these environment variables:')
    print('   R2_ACCOUNT_ID, R2_ACCESS_KEY, R2_SECRET_KEY')
    exit(1)

r2_endpoint = f'https://{account_id}.r2.cloudflarestorage.com'
print(f'Testing R2 Production Bucket: {bucket_name}')
print(f'Endpoint: {r2_endpoint}')
print('=' * 50)

client = boto3.client(
    's3',
    endpoint_url=r2_endpoint,
    aws_access_key_id=access_key,
    aws_secret_access_key=secret_key,
    config=Config(signature_version='s3v4')
)

try:
    # Test upload
    test_content = b'Production bucket test - CCMS'
    test_key = 'test/prod-bucket-test.txt'
    
    print(f'Uploading test file to {bucket_name}/{test_key}...')
    client.put_object(
        Bucket=bucket_name,
        Key=test_key,
        Body=test_content,
        ContentType='text/plain'
    )
    print('✅ Upload SUCCESS!')
    
    # Verify
    response = client.head_object(Bucket=bucket_name, Key=test_key)
    print(f'✅ File verified! Size: {response["ContentLength"]} bytes')
    
    # List objects
    print('\nListing objects in production bucket:')
    list_response = client.list_objects_v2(Bucket=bucket_name, MaxKeys=10)
    if 'Contents' in list_response:
        for obj in list_response['Contents']:
            print(f'  - {obj["Key"]} ({obj["Size"]} bytes)')
    
    print('\n' + '=' * 50)
    print('✅ Production R2 bucket is ready!')
    print(f'   Bucket: {bucket_name}')
    print(f'   Public URL: https://pub-{account_id}.r2.dev/')
    print('=' * 50)
    
except Exception as e:
    print(f'❌ Error: {e}')
    print('\n⚠️  Make sure you have created the "prod-ccms" bucket in Cloudflare Dashboard!')
    print('   1. Go to dash.cloudflare.com')
    print('   2. Navigate to R2 > Create bucket')
    print('   3. Name it "prod-ccms"')
    print('   4. Run this script again')
