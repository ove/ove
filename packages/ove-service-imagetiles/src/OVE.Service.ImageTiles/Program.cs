using System;
using Microsoft.AspNetCore;
using Microsoft.AspNetCore.Hosting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using OVE.Service.ImageTiles.DbContexts;

namespace OVE.Service.ImageTiles
{
    public class Program
    {
        public static void Main(string[] args) {
            var host = CreateWebHostBuilder(args).Build();
            ConfigureDatabase(host);

            host.Run();
        }

        public static IWebHostBuilder CreateWebHostBuilder(string[] args) =>
            WebHost.CreateDefaultBuilder(args)
                .UseStartup<Startup>()
                .ConfigureLogging((hostingContext, logging) => {
                    logging.AddConfiguration(hostingContext.Configuration.GetSection("Logging"));
                    logging.AddConsole();
                    logging.AddDebug();
                });

        /// <summary>
        /// Configure access to the database,
        /// Then issue any pending database migrations to update the database structure to match the model
        /// Then seed the database with sample data to be friendly
        /// </summary>
        /// <param name="host"></param>
        private static void ConfigureDatabase(IWebHost host) {
            using (var scope = host.Services.CreateScope()) {
                var services = scope.ServiceProvider;

                try {
                    var context = services.GetRequiredService<ImageFileContext>();
                    context.Database.Migrate();
                    ImageFileContext.Initialize(services);
                }
                catch (Exception ex) {
                    var logger = services.GetRequiredService<ILogger<Program>>();
                    logger.LogError(ex, "An error occurred seeding the DB.");
                }
            }

            host.Run();

        }


    }
}
