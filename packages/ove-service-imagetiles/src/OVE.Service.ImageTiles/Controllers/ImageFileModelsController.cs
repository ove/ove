using System;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using OVE.Service.ImageTiles.DbContexts;
using OVE.Service.ImageTiles.Models;


namespace OVE.Service.ImageTiles.Controllers {
    public class ImageFileModelsController : Controller {
        private readonly ImageFileContext _context;
        private readonly ILogger<ImageFileModelsController> _logger;
        private readonly IConfiguration _configuration;

        public ImageFileModelsController(ImageFileContext context, ILogger<ImageFileModelsController> logger,
            IConfiguration configuration) {
            _context = context;
            _logger = logger;
            _configuration = configuration;
            _logger.LogInformation("started ImageFilModels Controller with the following path " +
                                   _configuration.GetValue<string>("ImageStorageConfig:BasePath"));
        }

        // GET: ImageFileModels
        public async Task<IActionResult> Index() {
            return View(await _context.ImageFiles.ToListAsync());
        }

        // GET: ImageFileModels/Details/5
        public async Task<IActionResult> Details(string id) {
            if (id == null) {
                return NotFound();
            }

            var imageFileModel = await _context.ImageFiles
                .FirstOrDefaultAsync(m => m.Id == id);
            if (imageFileModel == null) {
                return NotFound();
            }

            return View(imageFileModel);
        }

        // GET: ImageFileModels/Create
        public IActionResult Create() {
            return View();
        }

        // POST: ImageFileModels/Create
        // To protect from overposting attacks, please enable the specific properties you want to bind to, for 
        // more details see http://go.microsoft.com/fwlink/?LinkId=317598.
        [HttpPost]
        public async Task<IActionResult> Create([Bind("Project,Name,Description")] ImageFileModel imageFileModel,
            [FromForm] IFormFile upload) {

            // check if we have a file
            if (upload == null || upload.Length <= 0) {
                _logger.LogError("failed to upload a file");
                ModelState.AddModelError("Filename", "Failed to upload file");
            }
            else {
                // then try and save it
                try {
                    SaveFile(imageFileModel, upload);

                    _logger.LogInformation("received a file :) " + imageFileModel.StorageLocation);
                }
                catch (Exception e) {
                    _logger.LogError(e, "failed to upload a file and write it to " + imageFileModel.StorageLocation);
                    ModelState.AddModelError("Filename", "Failed to upload file");
                }
            }

            if (ModelState.IsValid) {
                _context.Add(imageFileModel);
                await _context.SaveChangesAsync();
                return RedirectToAction(nameof(Index));
            }

            return View(imageFileModel);
        }
        
        // GET: ImageFileModels/Edit/5
        public async Task<IActionResult> Edit(string id) {
            if (id == null) {
                return NotFound();
            }

            var imageFileModel = await _context.ImageFiles.FindAsync(id);
            if (imageFileModel == null) {
                return NotFound();
            }

            return View(imageFileModel);
        }

        // POST: ImageFileModels/Edit/5
        // To protect from overposting attacks, please enable the specific properties you want to bind to, for 
        // more details see http://go.microsoft.com/fwlink/?LinkId=317598.
        [HttpPost]
        public async Task<IActionResult> Edit(string id, [Bind("Project,Name,Description,Id,StorageLocation")]
            ImageFileModel imageFileModel,[FromForm] IFormFile upload) {
            if (id != imageFileModel.Id) {
                return NotFound();
            }

            var oldImageFileModel = await _context.ImageFiles.FirstOrDefaultAsync(m => m.Id == id);
            if (oldImageFileModel == null) {
                return NotFound();
            }

            if (ModelState.IsValid) {
                try {
                    if (oldImageFileModel.Project != imageFileModel.Project) {
                        MoveFile(oldImageFileModel, imageFileModel);
                    }
                    //stop EF from tracking the old version so that it will allow you to update the new version
                    _context.Entry(oldImageFileModel).State = EntityState.Detached;

                    if (upload != null && upload.Length > 0) {
                        DeleteFile(imageFileModel);
                        SaveFile(imageFileModel,upload);
                    }

                    _context.Update(imageFileModel);

                    await _context.SaveChangesAsync();

                }
                catch (DbUpdateConcurrencyException) {
                    if (!ImageFileModelExists(imageFileModel.Id)) {
                        return NotFound();
                    }
                    else {
                        throw;
                    }
                }

                return RedirectToAction(nameof(Index));
            }

            return View(imageFileModel);
        }

        // GET: ImageFileModels/RemovableView/5
        public async Task<IActionResult> GetRemovableView(string id) {
            if (id == null) {
                return NotFound();
            }

            var imageFileModel = await _context.ImageFiles
                .FirstOrDefaultAsync(m => m.Id == id);
            if (imageFileModel == null) {
                return NotFound();
            }

            return View(imageFileModel);
        }

        // POST: ImageFileModels/Remove/5
        [HttpPost]
        public async Task<IActionResult> Remove(string id) {
            var imageFileModel = await _context.ImageFiles.FindAsync(id);
            _context.ImageFiles.Remove(imageFileModel);
            await _context.SaveChangesAsync();

            DeleteFile(imageFileModel);

            return RedirectToAction(nameof(Index));
        }

        #region File Operations 

        private string GetImagesBasePath() {
			var rootDirectory = _configuration.GetValue<string>(WebHostDefaults.ContentRootKey);
            var filepath = Path.Combine(rootDirectory, 
                _configuration.GetValue<string>("ImageStorageConfig:BasePath"));
            if (!Directory.Exists(filepath)) {
                _logger.LogInformation("Creating directory for images " + filepath);
                Directory.CreateDirectory(filepath);
            }

            return filepath;
        }

        private void MoveFile(ImageFileModel oldImage, ImageFileModel newImage) {
            if (oldImage.StorageLocation == null) return;
            var oldPath = Path.Combine(GetImagesBasePath(),oldImage.Project);
            var newPath = Path.Combine(GetImagesBasePath(),newImage.Project);

            var oldFile = Path.Combine(oldPath, oldImage.StorageLocation);
            var newFile = Path.Combine(newPath, newImage.StorageLocation);

            if (!Directory.Exists(newPath)) {
                Directory.CreateDirectory(newPath);
            }

            System.IO.File.Move(oldFile,newFile);

            if (!Directory.EnumerateFiles(oldPath).Any()) {
                Directory.Delete(oldPath);
            }
        }

        private void DeleteFile(ImageFileModel imageFileModel) {
            if (imageFileModel.StorageLocation == null) return;
            var path = Path.Combine(GetImagesBasePath(),imageFileModel.Project);
            var file = Path.Combine(path, imageFileModel.StorageLocation);

            if (System.IO.File.Exists(file)) {
                System.IO.File.Delete(file);
            }

            if (!Directory.EnumerateFiles(path).Any()) {
                Directory.Delete(path);
            }

        }

        private void SaveFile(ImageFileModel imageFileModel, IFormFile upload) {
            imageFileModel.StorageLocation = Guid.NewGuid() + Path.GetExtension(upload.FileName);

            var path = Path.Combine(GetImagesBasePath(),imageFileModel.Project);

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
        }

        #endregion 

        private bool ImageFileModelExists(string id) {
            return _context.ImageFiles.Any(e => e.Id == id);
        }
    }
}