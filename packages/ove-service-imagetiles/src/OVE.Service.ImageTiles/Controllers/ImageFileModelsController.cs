using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OVE.Service.ImageTiles.DbContexts;
using OVE.Service.ImageTiles.Models;

namespace OVE.Service.ImageTiles.Controllers
{
    public class ImageFileModelsController : Controller
    {
        private readonly ImageFileContext _context;

        public ImageFileModelsController(ImageFileContext context)
        {
            _context = context;
        }

        // GET: ImageFileModels
        public async Task<IActionResult> Index()
        {
            return View(await _context.ImageFiles.ToListAsync());
        }

        // GET: ImageFileModels/Details/5
        public async Task<IActionResult> Details(string id)
        {
            if (id == null)
            {
                return NotFound();
            }

            var imageFileModel = await _context.ImageFiles
                .FirstOrDefaultAsync(m => m.Id == id);
            if (imageFileModel == null)
            {
                return NotFound();
            }

            return View(imageFileModel);
        }

        // GET: ImageFileModels/Create
        public IActionResult Create()
        {
            return View();
        }

        // POST: ImageFileModels/Create
        // To protect from overposting attacks, please enable the specific properties you want to bind to, for 
        // more details see http://go.microsoft.com/fwlink/?LinkId=317598.
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Create([Bind("Project,Filename,Description")] ImageFileModel imageFileModel)
        {
            if (ModelState.IsValid)
            {
                _context.Add(imageFileModel);
                await _context.SaveChangesAsync();
                return RedirectToAction(nameof(Index));
            }
            return View(imageFileModel);
        }

        // GET: ImageFileModels/Edit/5
        public async Task<IActionResult> Edit(string id)
        {
            if (id == null)
            {
                return NotFound();
            }

            var imageFileModel = await _context.ImageFiles.FindAsync(id);
            if (imageFileModel == null)
            {
                return NotFound();
            }
            return View(imageFileModel);
        }

        // POST: ImageFileModels/Edit/5
        // To protect from overposting attacks, please enable the specific properties you want to bind to, for 
        // more details see http://go.microsoft.com/fwlink/?LinkId=317598.
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Edit(string id, [Bind("Project,Filename,Description,Id")] ImageFileModel imageFileModel)
        {
            if (id != imageFileModel.Id)
            {
                return NotFound();
            }

            if (ModelState.IsValid)
            {
                try
                {
                    _context.Update(imageFileModel);
                    await _context.SaveChangesAsync();
                }
                catch (DbUpdateConcurrencyException)
                {
                    if (!ImageFileModelExists(imageFileModel.Id))
                    {
                        return NotFound();
                    }
                    else
                    {
                        throw;
                    }
                }
                return RedirectToAction(nameof(Index));
            }
            return View(imageFileModel);
        }

        // GET: ImageFileModels/Delete/5
        public async Task<IActionResult> Delete(string id)
        {
            if (id == null)
            {
                return NotFound();
            }

            var imageFileModel = await _context.ImageFiles
                .FirstOrDefaultAsync(m => m.Id == id);
            if (imageFileModel == null)
            {
                return NotFound();
            }

            return View(imageFileModel);
        }

        // POST: ImageFileModels/Delete/5
        [HttpPost, ActionName("Delete")]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> DeleteConfirmed(string id)
        {
            var imageFileModel = await _context.ImageFiles.FindAsync(id);
            _context.ImageFiles.Remove(imageFileModel);
            await _context.SaveChangesAsync();
            return RedirectToAction(nameof(Index));
        }

        private bool ImageFileModelExists(string id)
        {
            return _context.ImageFiles.Any(e => e.Id == id);
        }
    }
}
