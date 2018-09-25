using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.IO;
using Microsoft.AspNetCore.Hosting;
using Microsoft.EntityFrameworkCore.Metadata.Conventions.Internal;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace OVE.Service.ImageTiles.Models {
    /// <summary>
    /// Image file model to represent the meta regarding uploaded images to the object store
    /// </summary>
    [Table("ImageFiles")]
    public class ImageFileModel {

        [ScaffoldColumn(false)]
        public string Id { get; set; }
        
        [Required(AllowEmptyStrings = false)]
        [MinLength(3)]
        [MaxLength(63)]
        [RegularExpression(@"^[-a-z0-9]+$", ErrorMessage = "Please keep Projects names to lowercase letters, numbers and underscores")]
        public string Project { get; set; }

        [Required(AllowEmptyStrings = false)]
        [RegularExpression(@"^[-a-zA-Z0-9_.]+$", ErrorMessage = "Please keep file names to letters, numbers, dashes and underscores")]
        [MaxLength(50, ErrorMessage = "Please keep file names short - 50 characters")]
        public string Name { get; set; }
        
        public string Description { get; set; }

        /// <summary>
        /// This is the actual location of the file on the filesystem (todo this will change to object store reference)
        /// </summary>
        [ScaffoldColumn(false)]
        public string StorageLocation { get; set; }

        /// <summary>
        /// This is whether the image has been processed into a TileSet or not 
        /// </summary>
        [ScaffoldColumn(false)]
        public string ProcessingErrors { get; set; } = "none";

        [ConcurrencyCheck]
        [ScaffoldColumn(false)]
        public int ProcessingState { get; set; } = 0;

        /// <summary>
        /// Return the system path to where the images are actually stored
        /// </summary>
        /// <param name="configuration"></param>
        /// <param name="logger"></param>
        /// <returns>full uri of image on file system</returns>
        public static string GetImagesBasePath(IConfiguration configuration, ILogger logger) {
            var rootDirectory = configuration.GetValue<string>(WebHostDefaults.ContentRootKey);
            var filepath = Path.Combine(rootDirectory,
                configuration.GetValue<string>("ImageStorageConfig:BasePath"));
            if (!Directory.Exists(filepath)) {
                logger.LogInformation("Creating directory for images " + filepath);
                Directory.CreateDirectory(filepath);
            }

            return filepath;
        }

    }
}
