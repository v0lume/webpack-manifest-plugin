var path = require('path');

var MemoryFileSystem = require('memory-fs');
var webpack = require('webpack');
var _ = require('lodash');
var ExtractTextPlugin = require('extract-text-webpack-plugin');
var FakeCopyWebpackPlugin = require('./helpers/copy-plugin-mock');
var plugin = require('../index.js');

var OUTPUT_DIR = path.join(__dirname, './webpack-out');
var manifestPath = path.join(OUTPUT_DIR, 'manifest.json');

function webpackConfig (webpackOpts, opts) {
  return _.merge({
    output: {
      path: OUTPUT_DIR,
      filename: '[name].js'
    },
    plugins: [
      new plugin(opts.manifestOptions)
    ]
  }, webpackOpts);
}

function webpackCompile(webpackOpts, opts, cb) {
  var config;
  if (Array.isArray(webpackOpts)) {
    config = webpackOpts.map(function(x) {
      return webpackConfig(x, opts);
    });
  }
  else {
    config = webpackConfig(webpackOpts, opts);
  }

  var compiler = webpack(config);

  var fs = compiler.outputFileSystem = new MemoryFileSystem();

  compiler.run(function(err, stats){
    var manifestFile
    try {
      manifestFile = JSON.parse( fs.readFileSync(manifestPath).toString() );
    } catch (e) {
      manifestFile = null
    }


    expect(err).toBeFalsy();
    expect(stats.hasErrors()).toBe(false);

    cb(manifestFile, stats, fs);
  });
};

describe('ManifestPlugin', function() {

  it('exists', function() {
    expect(plugin).toBeDefined();
  });

  describe('basic behavior', function() {
    it('outputs a manifest of one file', function(done) {
      webpackCompile({
        context: __dirname,
        entry: './fixtures/file.js'
      }, {}, function(manifest) {
        expect(manifest).toBeDefined();
        expect(manifest).toEqual({
          'main.js': 'main.js'
        });

        done();
      });
    });

    it('outputs a manifest of multiple files', function(done) {
      webpackCompile({
        context: __dirname,
        entry: {
          one: './fixtures/file.js',
          two: './fixtures/file-two.js'
        }
      }, {}, function(manifest) {
        expect(manifest).toEqual({
          'one.js': 'one.js',
          'two.js': 'two.js'
        });

        done();
      });
    });

    it('works with hashes in the filename', function(done) {
      webpackCompile({
        context: __dirname,
        entry: {
          one: './fixtures/file.js',
        },
        output: {
          filename: '[name].[hash].js'
        }
      }, {}, function(manifest, stats) {
        expect(manifest).toEqual({
          'one.js': 'one.' + stats.hash + '.js'
        });

        done();
      });
    });

    it('works with source maps', function(done) {
      webpackCompile({
        context: __dirname,
        devtool: 'sourcemap',
        entry: {
          one: './fixtures/file.js',
        },
        output: {
          filename: '[name].js'
        }
      }, {}, function(manifest, stats) {
        expect(manifest).toEqual({
          'one.js': 'one.js',
          'one.js.map': 'one.js.map'
        });

        done();
      });
    });

    it('prefixes definitions with a base path', function(done) {
      webpackCompile({
        context: __dirname,
        entry: {
          one: './fixtures/file.js',
        },
        output: {
          filename: '[name].[hash].js'
        }
      }, {
        manifestOptions: {
          basePath: '/app/'
        }
      }, function(manifest, stats) {
        expect(manifest).toEqual({
          '/app/one.js': 'one.' + stats.hash + '.js'
        });

        done();
      });
    });

    it('prefixes paths with a public path', function(done) {
      webpackCompile({
        context: __dirname,
        entry: {
          one: './fixtures/file.js',
        },
        output: {
          filename: '[name].[hash].js',
          publicPath: '/app/'
        }
      }, {}, function(manifest, stats) {
        expect(manifest).toEqual({
          'one.js': '/app/one.' + stats.hash + '.js'
        });

        done();
      });
    });

    it('prefixes definitions with a base path when public path is also provided', function(done) {
      webpackCompile({
        context: __dirname,
        entry: {
          one: './fixtures/file.js',
        },
        output: {
          filename: '[name].[hash].js',
          publicPath: '/app/'
        }
      }, {
        manifestOptions: {
          basePath: '/app/'
        }
      }, function(manifest, stats) {
        expect(manifest).toEqual({
          '/app/one.js': '/app/one.' + stats.hash + '.js'
        });

        done();
      });
    });

    it('should keep full urls provided by basePath', function(done) {
      webpackCompile({
        context: __dirname,
        entry: {
          one: './fixtures/file.js',
        },
        output: {
          filename: '[name].js'
        }
      }, {
        manifestOptions: {
          basePath: 'https://www/example.com/',
        }
      }, function(manifest, stats) {
        expect(manifest).toEqual({
          'https://www/example.com/one.js': 'one.js'
        });

        done();
      });
    });

    it('should keep full urls provided by publicPath', function(done) {
      webpackCompile({
        context: __dirname,
        entry: {
          one: './fixtures/file.js',
        },
        output: {
          filename: '[name].js',
          publicPath: 'http://www/example.com/',
        }
      }, {}, function(manifest, stats) {
        expect(manifest).toEqual({
          'one.js': 'http://www/example.com/one.js'
        });

        done();
      });
    });

    it('adds seed object custom attributes when provided', function(done) {
      webpackCompile({
        context: __dirname,
        entry: {
          one: './fixtures/file.js',
        },
        output: {
          filename: '[name].js'
        }
      }, {
        manifestOptions: {
          seed: {
            test1: 'test2'
          }
        }
      }, function(manifest) {
        expect(manifest).toEqual({
          'one.js': 'one.js',
          'test1': 'test2'
        });

        done();
      });
    });

    it('does not prefix seed attributes with basePath', function(done) {
      webpackCompile({
        context: __dirname,
        entry: {
          one: './fixtures/file.js',
        },
        output: {
          filename: '[name].[hash].js',
          publicPath: '/app/'
        }
      }, {
        manifestOptions: {
          basePath: '/app/',
          seed: {
            test1: 'test2'
          }
        }
      }, function(manifest, stats) {
        expect(manifest).toEqual({
          '/app/one.js': '/app/one.' + stats.hash + '.js',
          'test1': 'test2'
        });

        done();
      });
    });

    it('combines manifests of multiple compilations', function(done) {
      webpackCompile([{
        context: __dirname,
        entry: {
          one: './fixtures/file.js'
        }
      }, {
        context: __dirname,
        entry: {
          two: './fixtures/file-two.js'
        }
      }], {
        manifestOptions: {
          seed: {}
        }
      }, function(manifest) {
        expect(manifest).toEqual({
          'one.js': 'one.js',
          'two.js': 'two.js'
        });

        done();
      });
    });

    it('outputs a manifest of no-js file', function(done) {
      webpackCompile({
        context: __dirname,
        entry: './fixtures/file.txt',
        module: {
          rules: [{
            test: /\.(txt)/,
            use: [{
              loader: 'file-loader',
              options: {
                name: '[name].[ext]'
              }
            }]
          }]
        }
      }, {}, function(manifest, stats) {
        expect(manifest).toBeDefined();
        expect(manifest).toEqual({
          'main.js': 'main.js',
          'file.txt': 'file.txt'
        });

        done();
      });
    });

    it('ensures the manifest is mapping paths to names', function(done) {
      webpackCompile({
        context: __dirname,
        entry: './fixtures/file.txt',
        module: {
          rules: [{
            test: /\.(txt)/,
            use: [{
              loader: 'file-loader',
              options: {
                name: 'outputfile.[ext]'
              }
            }]
          }]
        }
      }, {}, function(manifest, stats) {
        expect(manifest).toBeDefined();
        expect(manifest).toEqual({
          'main.js': 'main.js',
          'file.txt': 'outputfile.txt'
        });

        done();
      });
    });

    it('make manifest available to other webpack plugins', function(done) {
      webpackCompile({
        context: __dirname,
        entry: './fixtures/file.js'
      }, {}, function(manifest, stats) {
        expect(manifest).toEqual({
          'main.js': 'main.js'
        });

        expect(JSON.parse(stats.compilation.assets['manifest.json'].source())).toEqual({
          'main.js': 'main.js'
        });

        done();
      });
    });

    it('should output unix paths', function(done) {
      webpackCompile({
        context: __dirname,
        entry: {
          'dir\\main': './fixtures/file.js',
          'some\\dir\\main': './fixtures/file.js'
        }
      }, {}, function(manifest) {
        expect(manifest).toBeDefined();
        expect(manifest).toEqual({
          'dir/main.js': 'dir/main.js',
          'some/dir/main.js': 'some/dir/main.js'
        });

        done();
      });
    });
  });

  describe('with ExtractTextPlugin', function() {
    it('works when extracting css into a seperate file', function(done) {
      webpackCompile({
        context: __dirname,
        entry: {
          wStyles: [
            './fixtures/file.js',
            './fixtures/style.css'
          ]
        },
        output: {
          filename: '[name].js'
        },
        module: {
          rules: [{
            test: /\.css$/,
            loader: ExtractTextPlugin.extract({
              fallback: 'style-loader',
              use: 'css-loader'
            })
          }]
        },
        plugins: [
          new plugin(),
          new ExtractTextPlugin({
            filename: '[name].css',
            allChunks: true
          })
        ]
      }, {}, function(manifest, stats) {
        expect(manifest).toEqual({
          'wStyles.js': 'wStyles.js',
          'wStyles.css': 'wStyles.css'
        });

        done();
      });
    });
  });

  describe('nameless chunks', function() {
    it('add a literal mapping of files generated by nameless chunks.', function(done) {
      webpackCompile({
        context: __dirname,
        entry: {
          nameless: './fixtures/nameless.js'
        },
        output: {
          filename: '[name].[hash].js'
        }
      }, {}, function(manifest, stats) {
        expect(Object.keys(manifest).length).toEqual(2);
        expect(manifest['nameless.js']).toEqual('nameless.'+ stats.hash +'.js');

        done();
      });
    });
  });

  describe('set location of manifest', function() {
    describe('using relative path', function() {
      it('should use output to the correct location', function(done) {
        webpackCompile({
          context: __dirname,
          entry: './fixtures/file.js'
        }, {
          manifestOptions: {
            fileName: 'webpack.manifest.js',
          }
        }, function(manifest, stats, fs) {
          var OUTPUT_DIR = path.join(__dirname, './webpack-out');
          var manifestPath = path.join(OUTPUT_DIR, 'webpack.manifest.js');

          var manifest = JSON.parse(fs.readFileSync(manifestPath).toString());

          expect(manifest).toEqual({
            'main.js': 'main.js'
          });

          done();
        });
      });
    });

    describe('using absolute path', function() {
      it('should use output to the correct location', function(done) {
        webpackCompile({
          context: __dirname,
          entry: './fixtures/file.js'
        }, {
          manifestOptions: {
            fileName: path.join(__dirname, 'webpack.manifest.js')
          }
        }, function(manifest, stats, fs) {
          var manifestPath = path.join(__dirname, 'webpack.manifest.js');

          var manifest = JSON.parse(fs.readFileSync(manifestPath).toString());

          expect(manifest).toEqual({
            'main.js': 'main.js'
          });

          done();
        });
      });
    });
  });

  describe('filter', function() {
    it('should filter out non-initial chunks', function(done) {
      webpackCompile({
        context: __dirname,
        entry: {
          nameless: './fixtures/nameless.js'
        },
        output: {
          filename: '[name].[hash].js'
        }
      }, {
        manifestOptions: {
          filter: function(file) {
            return file.isInitial;
          }
        }
      }, function(manifest, stats) {
        expect(Object.keys(manifest).length).toEqual(1);
        expect(manifest['nameless.js']).toEqual('nameless.'+ stats.hash +'.js');

        done();
      });
    });
  });

  describe('map', function() {
    it('should allow modifying files defails', function(done) {
      webpackCompile({
        context: __dirname,
        entry: './fixtures/file.js',
        output: {
          filename: '[name].js'
        }
      }, {
        manifestOptions: {
          map: function(file, i) {
            file.name = i.toString();
            return file;
          }
        }
      }, function(manifest, stats) {
        expect(manifest).toEqual({
          '0': 'main.js'
        });

        done();
      });
    });

    it('should add subfolders', function(done) {
      webpackCompile({
        context: __dirname,
        entry: './fixtures/file.js',
        output: {
          filename: 'javascripts/main.js'
        }
      }, {
        manifestOptions: {
          map: function(file) {
            file.name = path.join(path.dirname(file.path), file.name);
            return file;
          }
        }
      }, function(manifest){
        expect(manifest).toEqual({
          'javascripts/main.js': 'javascripts/main.js'
        });

        done();
      });
    });
  });

  describe('sort', function() {
    it('should allow ordering of output', function(done) {
      webpackCompile({
        context: __dirname,
        entry: {
          one: './fixtures/file.js',
          two: './fixtures/file-two.js'
        },
        output: {
          filename: '[name].js'
        }
      }, {
        manifestOptions: {
          seed: [],
          sort: function(a, b) {
            // make sure one is the latest
            return a.name === 'one.js' ? 1 : -1;
          },
          generate: function (seed, files) {
            return files.map(file => file.name);
          }
        }
      }, function(manifest, stats) {
        expect(manifest).toEqual(['two.js', 'one.js']);

        done();
      });
    });
  });

  describe('generate', function() {
    it('should generate custom manifest', function(done) {
      webpackCompile({
        context: __dirname,
        entry: './fixtures/file.js',
        output: {
          filename: '[name].js'
        }
      }, {
        manifestOptions: {
          generate: function(seed, files) {
            return files.reduce(function(manifest, file) {
              manifest[file.name] = {
                file: file.path,
                hash: file.chunk.hash
              };
              return manifest;
            }, seed);
          }
        }
      }, function(manifest, stats) {
        expect(manifest).toEqual({
          'main.js': {
            file: 'main.js',
            hash: stats.compilation.chunks[0].hash
          }
        });

        done();
      });
    });

    it('should default to `seed`', function(done) {
      webpackCompile({
        context: __dirname,
        entry: './fixtures/file.js',
        output: {
          filename: '[name].js'
        }
      }, {
        manifestOptions: {
          seed: {
            key: 'value'
          },
          generate: function (seed) {
            expect(seed).toEqual({
              key: 'value'
            });
            return seed;
          }
        }
      }, function(manifest, stats) {
        expect(manifest).toEqual({
          key: 'value'
        });

        done();
      });
    });

    it('should output an array', function(done) {
      webpackCompile({
        context: __dirname,
        entry: './fixtures/file.js',
        output: {
          filename: '[name].js'
        }
      }, {
        manifestOptions: {
          seed: [],
          generate: function (seed, files) {
            return seed.concat(files.map(function(file) {
              return {
                name: file.name,
                file: file.path
              };
            }));
          }
        }
      }, function(manifest, stats) {
        expect(manifest).toEqual([
          {
            name: 'main.js',
            file: 'main.js'
          }
        ]);

        done();
      });
    });
  });

  describe('with CopyWebpackPlugin', function () {
    it('works when including copied assets', function (done) {
      webpackCompile({
        context: __dirname,
        entry: {
          one: './fixtures/file.js'
        },
        plugins: [
          new FakeCopyWebpackPlugin(),
          new plugin()
        ]
      }, {}, function (manifest, stats) {
        expect(manifest).toEqual({
          'one.js': 'one.js',
          'third.party.js': 'third.party.js'
        });

        done();
      });
    });

    it('doesn\'t add duplicates when prefixes definitions with a base path', function (done) {
      webpackCompile({
        context: __dirname,
        entry: {
          one: './fixtures/file.js',
        },
        output: {
          filename: '[name].[hash].js',
          publicPath: '/app/'
        },
        plugins: [
          new FakeCopyWebpackPlugin(),
          new plugin({
            basePath: '/app/'
          })
        ]
      }, {}, function (manifest, stats) {
        expect(manifest).toEqual({
          '/app/one.js': '/app/one.' + stats.hash + '.js',
          '/app/third.party.js': '/app/third.party.js'
        });

        done();
      });
    });

    it('doesn\'t add duplicates when used with hashes in the filename', function (done) {
      webpackCompile({
        context: __dirname,
        entry: {
          one: './fixtures/file.js',
        },
        output: {
          filename: '[name].[hash].js'
        },
        plugins: [
          new FakeCopyWebpackPlugin(),
          new plugin()
        ]
      }, {}, function(manifest, stats) {
        expect(manifest).toEqual({
          'one.js': 'one.' + stats.hash + '.js',
          'third.party.js': 'third.party.js'
        });

        done();
      });
    });

    it('supports custom serializer using serialize option', function(done) {
      webpackCompile({
        context: __dirname,
        entry: './fixtures/file.js'
      }, {
        manifestOptions: {
          fileName: 'webpack.manifest.yml',
          serialize: function(manifest) {
            var output = '';
            for (var key in manifest) {
              output += '- ' + key + ': "' + manifest[key] + '"\n';
            }
            return output;
          },
        }
      }, function(manifest, stats, fs) {
        var OUTPUT_DIR = path.join(__dirname, './webpack-out');
        var manifestPath = path.join(OUTPUT_DIR, 'webpack.manifest.yml');

        var manifest =fs.readFileSync(manifestPath).toString();

        expect(manifest).toEqual('- main.js: "main.js"\n');

        done();
      });
    });
  });
});
