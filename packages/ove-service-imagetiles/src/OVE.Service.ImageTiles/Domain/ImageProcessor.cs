using System;
using System.IO;
using Microsoft.Extensions.Logging;
using NetVips;

namespace OVE.Service.ImageTiles.Domain {
    public class ImageProcessor {
        private readonly ILogger<ImageProcessor> _logger;

        public ImageProcessor(ILogger<ImageProcessor> logger) {
            _logger = logger;
            VipsStartup();
        }

        private void VipsStartup() {
            if (!ModuleInitializer.VipsInitialized) {
                _logger.LogCritical("failed to init vips");
            }
            else {
                _logger.LogInformation("Successfully started Libvips");
            }

            
            Log.SetLogHandler("VIPS",Enums.LogLevelFlags.All,(domain, level, message) => {
                switch (level) {
                    case Enums.LogLevelFlags.FlagRecursion:
                    case Enums.LogLevelFlags.FlagFatal:
                    case Enums.LogLevelFlags.Error:
                    case Enums.LogLevelFlags.Critical:
                        _logger.LogCritical(domain + Environment.NewLine + message);
                        break;
                    case Enums.LogLevelFlags.Warning:
                        _logger.LogWarning(domain + Environment.NewLine + message);
                        break;
                    case Enums.LogLevelFlags.Message:
                    case Enums.LogLevelFlags.Info:
                    case Enums.LogLevelFlags.Debug:
                    case Enums.LogLevelFlags.AllButFatal:
                    case Enums.LogLevelFlags.AllButRecursion:
                    case Enums.LogLevelFlags.All:
                    case Enums.LogLevelFlags.FlagMask:
                    case Enums.LogLevelFlags.LevelMask:
                        _logger.LogInformation(domain + Environment.NewLine + message);
                        break;
                }
            });
            // use memory checking
            Base.LeakSet(1);
        }

        public string ProcessFile(string file, string suffix = ".png", int tileSize = 256, int overlap = 1) {
            if (!File.Exists(file)) {
                _logger.LogError("file not found " + file);
                throw new ArgumentException("file not found ", nameof(file));
            }

            _logger.LogWarning("About to run DZI on " + file);
            try {
                var outputFolder =
                    Path.Combine(Path.GetDirectoryName(file), Path.GetFileNameWithoutExtension(file));

                using (var image = Image.NewFromFile(file, access: Enums.Access.Sequential)) {                    

                    image.Dzsave(outputFolder, suffix: suffix, tileSize: tileSize, overlap: overlap);
                    
                }
                _logger.LogWarning("Successfully created DZI for " + file);
                outputFolder = outputFolder + "_files";
                
                return outputFolder;
            }
            catch (Exception e) {
                _logger.LogCritical(e, "failed to run DZI " + file);
                throw;
            }

        }
    }
}