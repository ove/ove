using System;
using System.IO;
using System.Linq;
using System.Net;
using System.Threading;
using System.Threading.Tasks;
using Amazon.S3;
using Amazon.S3.Model;
using Amazon.S3.Transfer;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using OVE.Service.ImageTiles.DbContexts;
using OVE.Service.ImageTiles.Models;

namespace OVE.Service.ImageTiles.Domain {
    public class ASyncUploader : IHostedService, IDisposable {
        private readonly ILogger _logger;
        private readonly IConfiguration _configuration;
        private readonly IServiceProvider _serviceProvider;
        private readonly FileOperations _fileOperations;

        private Timer _timer;

        private readonly SemaphoreSlim _processing;
        private int maxConcurrent;

        public ASyncUploader(ILogger<ASyncUploader> logger, IConfiguration configuration,
            IServiceProvider serviceProvider,FileOperations fileOperations) {
            _logger = logger;
            _configuration = configuration;
            _serviceProvider = serviceProvider;
            _fileOperations = fileOperations;
            maxConcurrent = _configuration.GetValue<int>("ASyncUploader:MaxConcurrent");
            _processing = new SemaphoreSlim(maxConcurrent, maxConcurrent);
        }

        private static IAmazonS3 GetS3Client(IConfiguration configuration) {
            IAmazonS3 s3Client = new AmazonS3Client(
                configuration.GetValue<string>("ASyncUploader:AccessKey"),
                configuration.GetValue<string>("ASyncUploader:Secret"),
                new AmazonS3Config {
                    ServiceURL = configuration.GetValue<string>("ASyncUploader:ServiceURL"),
                    UseHttp = true, 
                    ForcePathStyle = true
                }
            );
            return s3Client;
        }

        public Task StartAsync(CancellationToken cancellationToken) {
            _logger.LogInformation("Async Uploader Processor Service is starting.");

            _timer = new Timer(ProcessImage, null, TimeSpan.Zero,
                TimeSpan.FromSeconds(_configuration.GetValue<int>("ASyncUploader:PollSeconds")));

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

        public static async void DeleteImageModel(ImageFileModel todo, IConfiguration configuration) {
            using (var s3Client = GetS3Client(configuration)) {
                // delete image
                await s3Client.DeleteObjectAsync(todo.Project, todo.StorageLocation);
                // delete dzi
                await s3Client.DeleteObjectAsync(todo.Project, Path.ChangeExtension(todo.StorageLocation, ".dzi"));
                // delete tiles 
                ListObjectsResponse files = null;
                while (files == null || files.S3Objects.Any()) {
                    if (files != null && files.S3Objects.Any()) {
                        foreach (var o in files.S3Objects) {
                            await s3Client.DeleteObjectAsync(todo.Project, o.Key);
                        }
                    }
                    // find more files
                    files = await s3Client.ListObjectsAsync(new ListObjectsRequest()
                        {BucketName = todo.Project, Prefix = Path.GetFileNameWithoutExtension(todo.StorageLocation)+"_files"});

                }

                // if the bucket is empty then delete it 
                var res = await s3Client.ListObjectsAsync(todo.Project);
                if (!res.S3Objects.Any()) {
                    await s3Client.DeleteBucketAsync(todo.Project);
                }
            }
        }

        private async void ProcessImage(object state) {
            if (!_processing.Wait(10)) {
                _logger.LogInformation("Tried to fire uploader processing but too many threads already running");
                return;
            }

            using (var scope = _serviceProvider.CreateScope()) {

                using (var context = scope.ServiceProvider.GetRequiredService<ImageFileContext>()) {

                    ImageFileModel todo = null;
                    try {

                        todo = await context.ImageFiles.FirstOrDefaultAsync(i => i.ProcessingState == 2);

                        if (todo != null) {
                            todo.ProcessingState = 3;
                            todo.ProcessingErrors = "uploading";

                            context.SaveChanges(); // this may throw a DbUpdateConcurrencyException 
                        }

                        if (todo == null) {
                            _logger.LogInformation("no work for Uploader Processor, running Processors = " +
                                                   (maxConcurrent - _processing.CurrentCount - 1));
                        }
                        else {
                            // do some processing!

                            _logger.LogInformation("Starting uploading of Image Model id=" + todo.Id);

                            //figure out where the image is 
                            var file = Path.Combine(ImageFileModel.GetImagesBasePath(_configuration, _logger),
                                todo.Project);
                            file = Path.Combine(file, todo.StorageLocation);

                            if (!File.Exists(file)) {
                                throw new Exception("Found an orphan image model - no corresponding file " + todo.Id);
                            }

                            // processing 

                            using (var s3Client = GetS3Client(_configuration)) {
                                // find or create the bucket
                                var buckets =await s3Client.ListBucketsAsync();
                                if (buckets.Buckets.FirstOrDefault(b => b.BucketName == todo.Project) == null) {
                                    var res = await s3Client.PutBucketAsync(todo.Project);
                                    if (res.HttpStatusCode != HttpStatusCode.OK) {
                                        throw new Exception("could not create bucket" + todo.Project);
                                    }

                                    var openBuckets =
                                        "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Principal\":{\"AWS\":[\"*\"]},\"Action\":[\"s3:GetBucketLocation\",\"s3:ListBucket\"],\"Resource\":[\"arn:aws:s3:::"+todo.Project+"\"]},{\"Effect\":\"Allow\",\"Principal\":{\"AWS\":[\"*\"]},\"Action\":[\"s3:GetObject\"],\"Resource\":[\"arn:aws:s3:::"+todo.Project+"/*\"]}]}";

                                    await s3Client.PutBucketPolicyAsync(todo.Project, openBuckets);
                                }
 
                                using (var fileTransferUtility = new TransferUtility(s3Client)) {
                                    // upload the image file
                                    await fileTransferUtility.UploadAsync(file,todo.Project);
                                    // upload the .dzi file
                                    var dzifile = Path.ChangeExtension(file,".dzi");
                                    await fileTransferUtility.UploadAsync(dzifile,todo.Project);
                                    // upload the tile files 
                                    var fileDirectory = dzifile.Replace(".dzi","_files");

                                    var keyPrefix =  new DirectoryInfo(fileDirectory).Name+"/"; // upload to the right folder
                                    TransferUtilityUploadDirectoryRequest request =
                                        new TransferUtilityUploadDirectoryRequest() {
                                            KeyPrefix = keyPrefix,
                                            Directory = fileDirectory,
                                            BucketName = todo.Project,
                                            SearchOption =  SearchOption.AllDirectories,
                                            SearchPattern = "*.*"
                                        };

                                    await fileTransferUtility.UploadDirectoryAsync(request);                            
                                }

                            }
                            // say that we did it
                            todo.ProcessingState = 4;
                            todo.ProcessingErrors = "uploaded";
                            context.Update(todo);
                            await context.SaveChangesAsync();

                            // delete local files 
                            _fileOperations.DeleteFile(todo);
                        }
                    }
                    catch (DbUpdateConcurrencyException e) {
                        // do nothing this is intended to stop multiple 
                        _logger.LogDebug("stopped double processing" + e);
                    }
                    catch (Exception e) {
                        _logger.LogError(e, "Exception in uploading ");
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