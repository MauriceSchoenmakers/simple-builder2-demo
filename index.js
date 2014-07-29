/**
 * Module dependencies
 */

var path = require('path');
var mkdir = require('mkdirp');
var Builder = require('component-builder2');
var resolve = require('component-resolver');

var EventEmitter = require('events').EventEmitter;


// install  the npm remote
var remote_npm = require('./remote-npm');
var npm = new remote_npm();
var Remotes = require('remotes');
var remotes = new Remotes({local:true});
//remotes.use(new Remotes.local);
remotes.use(npm);
remotes.use(new Remotes.github());

var myth = require('builder-myth');
var debug = require('debug')('simple-builder2:builder');

/**
 * Retuns Generator Function that handles building component
 *
 * `params` can accept following options
 *
 * - `out`: output directory
 * - `bundled`: if you want to build bundled component
 */
var build = new EventEmitter();
var building=false;

module.exports = function(params){
  
  params = params || {};
  params.out = params.out || 'build';

  var copy = params.copy;

  return function*(){
	if(!building){
		building = true;
		var tree = yield* resolve(process.cwd(), { install: true, remotes: remotes });
		var out = params.out;
		
		if(!params.bundled){
			debug('Building component to %s', out);
			yield buildBundle(resolve, tree, out);
		} else {
			for(var bundle in tree.locals){
				debug('Building a bundle: %s', bundle);
				out = path.resolve(params.out, bundle);
				yield buildBundle(resolver, tree.locals[bundle], out);
			}
		}
		build.emit('end');
		building=false;
	}else{
		// await build end
		yield (function(done){
			build.once('end',function(){
				done();
			});
		});
	}
  };

  function* buildBundle(resolve, tree, out){
    // mkdir -p
    mkdir.sync(out);

    var nodes = resolve.flatten(tree);

    /**
     * Builders
     */
    var script = new Builder.scripts(nodes);
    var style = new Builder.styles(nodes);
    var file = new Builder.files(nodes, {dest: out});

    /**
     * Script Plugin(s)
     */

    script.use('scripts', Builder.plugins.js());

    /**
     * Style Plugins
     *
     * - `myth`: Enables `myth`
     * - `urlRewriter`: Rewrite `url()` rules in css
     */

    style.use('styles', Builder.plugins.css());
    style.use('styles', myth({whitespace: false}));
    style.use('styles', Builder.plugins.urlRewriter());
    /**
     * File Plugins
     */

    file.use('images', Builder.plugins[copy ? 'copy' : 'symlink']());

    /**
     * Yield all :)
     */
    yield [
      script.toFile(path.resolve(out, 'build.js')),
      style.toFile(path.resolve(out, 'build.css')),
      file.end()
    ];
  }
};
