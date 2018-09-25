using System;
using System.IO;
using System.Linq;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using OVE.Service.ImageTiles.Models;

namespace OVE.Service.ImageTiles.Domain {
    public interface IFileOperations {
        void MoveFile(ImageFileModel oldImage, ImageFileModel newImage);
        void DeleteFile(ImageFileModel imageFileModel);
        void SaveFile(ImageFileModel imageFileModel, IFormFile upload);
    }

    /// <summary>
    /// A class for interacting with image files on the file system
    /// </summary>
    public class FileOperations : IFileOperations {
        private readonly ILogger<FileOperations> _logger;
        private readonly IConfiguration _configuration;

        public FileOperations(ILogger<FileOperations> logger, IConfiguration configuration) {
            _logger = logger;
            _configuration = configuration;
        }

        public void MoveFile(ImageFileModel oldImage, ImageFileModel newImage) {
            if (oldImage.StorageLocation == null) return;
            var oldPath = Path.Combine(ImageFileModel.GetImagesBasePath(_configuration, _logger), oldImage.Project);
            var newPath = Path.Combine(ImageFileModel.GetImagesBasePath(_configuration, _logger), newImage.Project);

            var oldFile = Path.Combine(oldPath, oldImage.StorageLocation);
            var newFile = Path.Combine(newPath, newImage.StorageLocation);

            if (!Directory.Exists(newPath)) {
                Directory.CreateDirectory(newPath);
            }

            // move file
            File.Move(oldFile, newFile);
            
            // move DZI
            var dziFile = Path.ChangeExtension(oldFile, ".dzi");
            if (File.Exists(dziFile)) {
                File.Move(dziFile, Path.ChangeExtension(newFile,".dzi"));
            }

            // move files
            string dziFolder = Path.ChangeExtension(oldFile,"_files").Replace("._","_");
            if (Directory.Exists(dziFolder)) {
                string newDziFolder = Path.ChangeExtension(newFile,"_files").Replace("._","_");
                Directory.Move(dziFolder,newDziFolder);
            }

            // if the project is empty delete its folder
            if (!Directory.EnumerateFiles(oldPath).Any()) {
                Directory.Delete(oldPath);
            }
        }

        public void DeleteFile(ImageFileModel imageFileModel) {
            if (imageFileModel.StorageLocation == null) return;
            var path = Path.Combine(ImageFileModel.GetImagesBasePath(_configuration, _logger), imageFileModel.Project);
            var file = Path.Combine(path, imageFileModel.StorageLocation);

            if (File.Exists(file)) {
                File.Delete(file);
            }

            // delete DZI
            var dziFile = Path.ChangeExtension(file, ".dzi");
            if (File.Exists(dziFile)) {
                File.Delete(dziFile);
            }

            // delete files
            string dziFolder = Path.ChangeExtension(file,"_files").Replace("._","_");
            if (Directory.Exists(dziFolder)) {
                Directory.Delete(dziFolder,true);
            }

            // if the project is empty delete its folder
            if (!Directory.EnumerateFiles(path).Any()) {
                Directory.Delete(path);
            }

        }

        public void SaveFile(ImageFileModel imageFileModel, IFormFile upload) {
            imageFileModel.StorageLocation = Guid.NewGuid() + Path.GetExtension(upload.FileName);

            var path = Path.Combine(ImageFileModel.GetImagesBasePath(_configuration, _logger), imageFileModel.Project);

            if (!Directory.Exists(path)) {
                Directory.CreateDirectory(path);
            }

            path = Path.Combine(path, imageFileModel.StorageLocation);

            using (FileStream fileStream =
                new FileStream(
                    path,
                    FileMode.Create)) {
                upload.CopyTo(fileStream);
                fileStream.Close();
            }
            _logger.LogInformation("Saved File "+imageFileModel.Id);
            
        }
    }
}