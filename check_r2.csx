#r "nuget: AWSSDK.S3, 3.7.0"
using Amazon.S3;
using Amazon.S3.Model;
using Amazon.Runtime;

var accountId = "4f22ea89a2e684c242ace359b5706b03";
var accessKeyId = "ae7110645957e505c8e2e8f0d7ce3ad2";
var secretAccessKey = "f00a6c7bc692660ebd15f4538b9c68df835a565089dc2cabfc838a5125d4b302";
var bucketName = "dev-ccms";

var endpoint = $"https://{accountId}.r2.cloudflarestorage.com";
Console.WriteLine($"Testing R2 connection to: {endpoint}");
Console.WriteLine($"Bucket: {bucketName}");
Console.WriteLine();

var credentials = new BasicAWSCredentials(accessKeyId, secretAccessKey);
var config = new AmazonS3Config
{
    ServiceURL = endpoint,
    ForcePathStyle = true  // Required for R2
};

var client = new AmazonS3Client(credentials, config);

try
{
    Console.WriteLine("=== Listing Bucket Contents ===");
    var request = new ListObjectsV2Request
    {
        BucketName = bucketName,
        MaxKeys = 20
    };
    
    var response = await client.ListObjectsV2Async(request);
    
    Console.WriteLine($"Total objects found: {response.KeyCount}");
    Console.WriteLine();
    
    foreach (var obj in response.S3Objects)
    {
        var sizeKB = obj.Size / 1024.0;
        Console.WriteLine($"  {obj.Key} ({sizeKB:F1} KB)");
    }
    
    // Check specific files
    Console.WriteLine("\n=== Checking Specific Files ===");
    var filesToCheck = new[] {
        "Pixel_Universal.mp4",
        "d747ce81-df91-4b24-a864-32484c9d817b.mp4",
        "918872c4-9393-4e41-91f9-f14854f90e58.mp4"
    };
    
    foreach (var file in filesToCheck)
    {
        try
        {
            var metadata = await client.GetObjectMetadataAsync(bucketName, file);
            Console.WriteLine($"  ✅ {file} EXISTS ({metadata.ContentLength / 1024.0:F1} KB)");
        }
        catch (Amazon.S3.AmazonS3Exception ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            Console.WriteLine($"  ❌ {file} NOT FOUND");
        }
    }
    
    Console.WriteLine("\nR2 credentials are working correctly!");
}
catch (Exception ex)
{
    Console.WriteLine($"ERROR: {ex.Message}");
    Console.WriteLine(ex.ToString());
}
