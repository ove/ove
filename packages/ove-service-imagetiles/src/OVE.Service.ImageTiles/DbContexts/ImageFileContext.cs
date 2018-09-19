using System;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Internal;
using Microsoft.Extensions.DependencyInjection;
using OVE.Service.ImageTiles.Models;

namespace OVE.Service.ImageTiles.DbContexts {
    public class ImageFileContext : DbContext {

        // enable configuration
        public ImageFileContext(DbContextOptions<ImageFileContext> options) : base(options) {
        }

        public DbSet<ImageFileModel> ImageFiles { get; set; }

        public static void Initialize(IServiceProvider serviceProvider) {
            using (var context =
                new ImageFileContext(serviceProvider.GetRequiredService<DbContextOptions<ImageFileContext>>())) {

                if (context.ImageFiles.Any()) {
                    return; // DB has been seeded
                }

                // otherwise add the sample image
                context.ImageFiles.AddRange(
                    new ImageFileModel {
                        Project = "Sample", Name = "Imperial", Description = "A photo of Imperial",
                        Height = 100, Width = 100
                    }
                );
                context.SaveChanges();
            }
        }

    }
}
