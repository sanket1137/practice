using Microsoft.OpenApi.Models;
using Swashbuckle.AspNetCore.SwaggerGen;
using System.Linq;

namespace CCMS.Api;

/// <summary>
/// Swagger operation filter to handle file upload endpoints with IFormFile
/// </summary>
public class FileUploadOperationFilter : IOperationFilter
{
    public void Apply(OpenApiOperation operation, OperationFilterContext context)
    {
        var fileParameters = context.ApiDescription.ParameterDescriptions
            .Where(p => p.Type == typeof(IFormFile))
            .ToList();

        if (!fileParameters.Any())
            return;

        // Clear existing parameters
        operation.Parameters?.Clear();

        // Set request body for multipart/form-data
        operation.RequestBody = new OpenApiRequestBody
        {
            Content = new Dictionary<string, OpenApiMediaType>
            {
                ["multipart/form-data"] = new OpenApiMediaType
                {
                    Schema = new OpenApiSchema
                    {
                        Type = "object",
                        Properties = context.ApiDescription.ParameterDescriptions
                            .ToDictionary(
                                p => p.Name,
                                p => p.Type == typeof(IFormFile)
                                    ? new OpenApiSchema { Type = "string", Format = "binary" }
                                    : new OpenApiSchema { Type = GetSchemaType(p.Type) }
                            ),
                        Required = context.ApiDescription.ParameterDescriptions
                            .Where(p => p.IsRequired || p.Type == typeof(IFormFile))
                            .Select(p => p.Name)
                            .ToHashSet()
                    }
                }
            }
        };
    }

    private static string GetSchemaType(Type type)
    {
        return type switch
        {
            Type t when t == typeof(int) || t == typeof(long) => "integer",
            Type t when t == typeof(Guid) => "string",
            Type t when t == typeof(bool) => "boolean",
            Type t when t == typeof(decimal) || t == typeof(double) || t == typeof(float) => "number",
            _ => "string"
        };
    }
}
