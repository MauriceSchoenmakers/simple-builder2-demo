var co = require('co');

var debug = require('debug')('remotes:npm');

var Remote = require('remotes').Remote;

module.exports = NPM;

Remote.extend(NPM);

function NPM(options) {
	if (!(this instanceof NPM)) return new NPM(options);
	
	options = options || {};
	
	Remote.call(this, options);
	
	// tarballs are requested / expected by downloader with .tar.gz, but npm uses .tgz
	// see tar url above created for  .archive
	/*this.request = function(f){ return function*(url){
		var args = Array.prototype.slice.call(arguments);
		// modify the first argument url
		args.shift();
		args.unshift(url.replace(/tar\.gz$/,'tgz'));
		return yield* f.apply(this,args);
	}; }(this.request);
	*/

}

NPM.prototype.name = 'npm';

/**
 * @param {String} repo
 * @return {Array} references
 * @api public
 */

NPM.prototype._versions = function* (repo) {
	var
		name        = npm_name(repo);
		json        = name ? yield this.description(name,'') : null,
		version_set = json ? json.versions: null,
		versions    = version_set ? Object.keys(version_set): null;
	return versions;
};


var npm_name = function (repo){
	var names = repo.split('/');
	return names.length===2  && names[0] === 'npm' ? names[1] : null;
};

/**
 * Get a component and references's component.json.
 * for npm modules we return an artificial one
 * @param {String} repo
 * @param {String} reference
 * @return {Object} component.json
 * @api public
 */

NPM.prototype._json = function* (repo, ref) {
	var
		name = npm_name(repo),
		version = ref==='master'?'latest':ref,
		json = name ? yield this.description(name,version):null;
	
	if(!json) return null;
	
	version = json ? json.version : null;
	
	return {
		name        : name,
		version     : version,
		description : json.description,
		repository  : 'npm/'+name,
		keywords    : json.keywords,
		files       : ['*'],    // to trigger archive
		scripts     : ['*.js'], // to trigger archive
		/*paths       : {
			"paths": ["npm", "./node_modules"]
		},*/
		main        : json.main,
		license     : json.license
	};
};

NPM.prototype.description = function* (name,version){
	version = version !== '' ? version || 'latest' :'';
	
	var uri    =  'http://registry.npmjs.org/'+name+'/'+version;
	var cache  = this.c_description = this.c_description  || {};
	var slug   = name+'@'+version;
	var cached = cache[slug];
	
	if(cached) return cached;
	
	try {
		res = yield this.request(uri, true);
	} catch (err) {
		debug('error when GETing "%s": "%s', uri, err.message);
		return;
	}
	if(res.statusCode !== 200) return;
	if(res.body){
		cache[slug]=res.body;
	}
	return res.body;
};

/**
 * Return URLs of download locations for archives.
 * The path must be UNIX style paths.
 * The file format can be any.
 *
 * @param {String} repo
 * @param {String} reference
 * @return {Object} urls
 * @api public
 */

NPM.prototype.archive = function (repo, ref) {
	var
		name    = npm_name(repo),
		version = ref==='master'?'latest':ref,
		slug    = name+'@'+version,
		cache  = this.c_description = this.c_description  || {},
		json    = name ? cache[slug] : null;
	
	version = json ? json.version : version;
	if(!version) return;
	
	var u = 'http://registry.npmjs.org/'+name+'/-/'+name+'-'+version+'.tgz';
	return {
		tar: [
			u
		]
	};
};

/*
NPM.prototype.request = function*(url){
	debugger;
	// see tar url above created for  .archive
	var args = [].prototype.slice.call(arguments);
	// modify the first argument url
	args.shift();
	args.unshift(url.replace(/tar\.gz$/,'tgz'));
	yield Remote.prototype.request.apply(this,arguments);
};
*/
