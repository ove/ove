using System;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using OVE.Service.ImageTiles.DbContexts;
using OVE.Service.ImageTiles.Models;

namespace OVE.Service.ImageTiles.Domain {
    public class ASyncImageProcessor : IHostedService, IDisposable {
        private readonly ILogger _logger;
        private readonly IConfiguration _configuration;
        private readonly IServiceProvider _serviceProvider;
        private readonly ImageProcessor _processor;
        private Timer _timer;

        private readonly SemaphoreSlim _processing;
        private int maxConcurrent;

        public ASyncImageProcessor(ILogger<ASyncImageProcessor> logger, IConfiguration configuration,
            IServiceProvider serviceProvider, ImageProcessor processor) {
            _logger = logger;
            _configuration = configuration;
            _serviceProvider = serviceProvider;
            _processor = processor;
            maxConcurrent = _configuration.GetValue<int>("ImageProcessingConfig:MaxConcurrent");
            _processing = new SemaphoreSlim(maxConcurrent, maxConcurrent);
        }

        public Task StartAsync(CancellationToken cancellationToken) {
            _logger.LogInformation("Async Image Processor Service is starting.");

            _timer = new Timer(ProcessImage, null, TimeSpan.Zero,
                TimeSpan.FromSeconds(_configuration.GetValue<int>("ImageProcessingConfig:PollSeconds")));

            return Task.CompletedTask;
        }

        public Task StopAsync(CancellationToken cancellationToken) {
            _logger.LogInformation("Async Image Processor Service is stopping.");

            _timer?.Change(Timeout.Infinite, 0);

            return Task.CompletedTask;
        }

        public void Dispose() {
            _timer?.Dispose();
        }

        private async void ProcessImage(object state) {
            if (!_processing.Wait(10)) {
                _logger.LogInformation("Tried to fire Image Processing but too many threads already running");
                return;
            }

            using (var scope = _serviceProvider.CreateScope()) {

                using (var context = scope.ServiceProvider.GetRequiredService<ImageFileContext>()) {

                    ImageFileModel todo = null;
                    try {

                        todo = await context.ImageFiles.FirstOrDefaultAsync(i => i.ProcessingState == 0);

                        if (todo != null) {
                            todo.ProcessingState = 1;
                            todo.ProcessingErrors = "processing";

                            context.SaveChanges();// this may throw a DbUpdateConcurrencyException 
                        }

                        if (todo == null) {
                            _logger.LogInformation("no work for Image Processor, running Processors = "+(maxConcurrent-_processing.CurrentCount-1));
                        }
                        else {
                            // do some processing!

                            _logger.LogInformation("Starting processing of Image Model id=" + todo.Id);

                            //figure out where the image is 
                            var file = Path.Combine(ImageFileModel.GetImagesBasePath(_configuration, _logger),
                                todo.Project);
                            file = Path.Combine(file, todo.StorageLocation);

                            if (!File.Exists(file)) {
                                throw new Exception("Found an orphan image model - no corresponding file " + todo.Id);
                            }

                            // processing 
                            var output = _processor.ProcessFile(file);
                            if (!Directory.Exists(output)) {
                                throw new Exception("Image processor failed for " + todo.Id);
                            }

                            // say that we did it
                            todo.ProcessingState = 2;
                            todo.ProcessingErrors = "processed";
                            context.Update(todo);
                            await context.SaveChangesAsync();
                        }
                    } catch (DbUpdateConcurrencyException e) {
                        // do nothing this is intended to stop multiple 
                        _logger.LogDebug("stopped double processing"+e);
                    } catch (Exception e) {
                        _logger.LogError(e, "Exception in Image Processing");
                        if (todo != null) {
                            // log to db
                            todo.ProcessingState = -1;
                            todo.ProcessingErrors = e.ToString();
                            context.Update(todo);
                            await context.SaveChangesAsync();
                        }
                    }
                    finally {
                        _processing.Release();
                    }
                }
            }
        }
    }
}