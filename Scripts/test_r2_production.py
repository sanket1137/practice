"""
Test Cloudflare R2 Production Bucket (prod-ccms)
Run this after creating the bucket in Cloudflare Dashboard
"""
import boto3
from botocore.config import Config

# R2 credentials (same account, different bucket)
account_id = '4f22ea89a2e684c242ace359b5706b03'
access_key = 'aa934dbced6f083dcba7f9125590d20f'
secret_key = '71ed546e79b20506e19af06054f929da7946178ea7938862a8185a7b9b86405f'
bucket_name = 'prod-ccms'

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
