// The Module object: Our interface to the outside world. We import
// and export values on it, and do the work to get that through
// closure compiler if necessary. There are various ways Module can be used:
// 1. Not defined. We create it here
// 2. A function parameter, function(Module) { ..generated code.. }
// 3. pre-run appended it, var Module = {}; ..generated code..
// 4. External script tag defines var Module.
// We need to do an eval in order to handle the closure compiler
// case, where this code here is minified but Module was defined
// elsewhere (e.g. case 4 above). We also need to check if Module
// already exists (e.g. case 3 above).
// Note that if you want to run closure, and also to use Module
// after the generated code, you will need to define   var Module = {};
// before the code. Then that object will be used in the code, and you
// can continue to use Module afterwards as well.
var Module;
if (!Module) Module = (typeof Module !== 'undefined' ? Module : null) || {};

// Sometimes an existing Module object exists with properties
// meant to overwrite the default module functionality. Here
// we collect those properties and reapply _after_ we configure
// the current environment's defaults to avoid having to be so
// defensive during initialization.
var moduleOverrides = {};
for (var key in Module) {
  if (Module.hasOwnProperty(key)) {
    moduleOverrides[key] = Module[key];
  }
}

// The environment setup code below is customized to use Module.
// *** Environment setup code ***
var ENVIRONMENT_IS_WEB = false;
var ENVIRONMENT_IS_WORKER = false;
var ENVIRONMENT_IS_NODE = false;
var ENVIRONMENT_IS_SHELL = false;

// Three configurations we can be running in:
// 1) We could be the application main() thread running in the main JS UI thread. (ENVIRONMENT_IS_WORKER == false and ENVIRONMENT_IS_PTHREAD == false)
// 2) We could be the application main() thread proxied to worker. (with Emscripten -s PROXY_TO_WORKER=1) (ENVIRONMENT_IS_WORKER == true, ENVIRONMENT_IS_PTHREAD == false)
// 3) We could be an application pthread running in a worker. (ENVIRONMENT_IS_WORKER == true and ENVIRONMENT_IS_PTHREAD == true)

if (Module['ENVIRONMENT']) {
  if (Module['ENVIRONMENT'] === 'WEB') {
    ENVIRONMENT_IS_WEB = true;
  } else if (Module['ENVIRONMENT'] === 'WORKER') {
    ENVIRONMENT_IS_WORKER = true;
  } else if (Module['ENVIRONMENT'] === 'NODE') {
    ENVIRONMENT_IS_NODE = true;
  } else if (Module['ENVIRONMENT'] === 'SHELL') {
    ENVIRONMENT_IS_SHELL = true;
  } else {
    throw new Error('The provided Module[\'ENVIRONMENT\'] value is not valid. It must be one of: WEB|WORKER|NODE|SHELL.');
  }
} else {
  ENVIRONMENT_IS_WEB = typeof window === 'object';
  ENVIRONMENT_IS_WORKER = typeof importScripts === 'function';
  ENVIRONMENT_IS_NODE = typeof process === 'object' && typeof require === 'function' && !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_WORKER;
  ENVIRONMENT_IS_SHELL = !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;
}


if (ENVIRONMENT_IS_NODE) {
  // Expose functionality in the same simple way that the shells work
  // Note that we pollute the global namespace here, otherwise we break in node
  if (!Module['print']) Module['print'] = console.log;
  if (!Module['printErr']) Module['printErr'] = console.warn;

  var nodeFS;
  var nodePath;

  Module['read'] = function read(filename, binary) {
    if (!nodeFS) nodeFS = require('fs');
    if (!nodePath) nodePath = require('path');
    filename = nodePath['normalize'](filename);
    var ret = nodeFS['readFileSync'](filename);
    return binary ? ret : ret.toString();
  };

  Module['readBinary'] = function readBinary(filename) {
    var ret = Module['read'](filename, true);
    if (!ret.buffer) {
      ret = new Uint8Array(ret);
    }
    assert(ret.buffer);
    return ret;
  };

  Module['load'] = function load(f) {
    globalEval(read(f));
  };

  if (!Module['thisProgram']) {
    if (process['argv'].length > 1) {
      Module['thisProgram'] = process['argv'][1].replace(/\\/g, '/');
    } else {
      Module['thisProgram'] = 'unknown-program';
    }
  }

  Module['arguments'] = process['argv'].slice(2);

  if (typeof module !== 'undefined') {
    module['exports'] = Module;
  }

  process['on']('uncaughtException', function(ex) {
    // suppress ExitStatus exceptions from showing an error
    if (!(ex instanceof ExitStatus)) {
      throw ex;
    }
  });

  Module['inspect'] = function () { return '[Emscripten Module object]'; };
}
else if (ENVIRONMENT_IS_SHELL) {
  if (!Module['print']) Module['print'] = print;
  if (typeof printErr != 'undefined') Module['printErr'] = printErr; // not present in v8 or older sm

  if (typeof read != 'undefined') {
    Module['read'] = read;
  } else {
    Module['read'] = function read() { throw 'no read() available (jsc?)' };
  }

  Module['readBinary'] = function readBinary(f) {
    if (typeof readbuffer === 'function') {
      return new Uint8Array(readbuffer(f));
    }
    var data = read(f, 'binary');
    assert(typeof data === 'object');
    return data;
  };

  if (typeof scriptArgs != 'undefined') {
    Module['arguments'] = scriptArgs;
  } else if (typeof arguments != 'undefined') {
    Module['arguments'] = arguments;
  }

}
else if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
  Module['read'] = function read(url) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, false);
    xhr.send(null);
    return xhr.responseText;
  };

  Module['readAsync'] = function readAsync(url, onload, onerror) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'arraybuffer';
    xhr.onload = function xhr_onload() {
      if (xhr.status == 200 || (xhr.status == 0 && xhr.response)) { // file URLs can return 0
        onload(xhr.response);
      } else {
        onerror();
      }
    };
    xhr.onerror = onerror;
    xhr.send(null);
  };

  if (typeof arguments != 'undefined') {
    Module['arguments'] = arguments;
  }

  if (typeof console !== 'undefined') {
    if (!Module['print']) Module['print'] = function print(x) {
      console.log(x);
    };
    if (!Module['printErr']) Module['printErr'] = function printErr(x) {
      console.warn(x);
    };
  } else {
    // Probably a worker, and without console.log. We can do very little here...
    var TRY_USE_DUMP = false;
    if (!Module['print']) Module['print'] = (TRY_USE_DUMP && (typeof(dump) !== "undefined") ? (function(x) {
      dump(x);
    }) : (function(x) {
      // self.postMessage(x); // enable this if you want stdout to be sent as messages
    }));
  }

  if (ENVIRONMENT_IS_WORKER) {
    Module['load'] = importScripts;
  }

  if (typeof Module['setWindowTitle'] === 'undefined') {
    Module['setWindowTitle'] = function(title) { document.title = title };
  }
}
else {
  // Unreachable because SHELL is dependant on the others
  throw 'Unknown runtime environment. Where are we?';
}

function globalEval(x) {
  eval.call(null, x);
}
if (!Module['load'] && Module['read']) {
  Module['load'] = function load(f) {
    globalEval(Module['read'](f));
  };
}
if (!Module['print']) {
  Module['print'] = function(){};
}
if (!Module['printErr']) {
  Module['printErr'] = Module['print'];
}
if (!Module['arguments']) {
  Module['arguments'] = [];
}
if (!Module['thisProgram']) {
  Module['thisProgram'] = './this.program';
}

// *** Environment setup code ***

// Closure helpers
Module.print = Module['print'];
Module.printErr = Module['printErr'];

// Callbacks
Module['preRun'] = [];
Module['postRun'] = [];

// Merge back in the overrides
for (var key in moduleOverrides) {
  if (moduleOverrides.hasOwnProperty(key)) {
    Module[key] = moduleOverrides[key];
  }
}
// Free the object hierarchy contained in the overrides, this lets the GC
// reclaim data used e.g. in memoryInitializerRequest, which is a large typed array.
moduleOverrides = undefined;



// {{PREAMBLE_ADDITIONS}}

// === Preamble library stuff ===

// Documentation for the public APIs defined in this file must be updated in:
//    site/source/docs/api_reference/preamble.js.rst
// A prebuilt local version of the documentation is available at:
//    site/build/text/docs/api_reference/preamble.js.txt
// You can also build docs locally as HTML or other formats in site/
// An online HTML version (which may be of a different version of Emscripten)
//    is up at http://kripken.github.io/emscripten-site/docs/api_reference/preamble.js.html

//========================================
// Runtime code shared with compiler
//========================================

var Runtime = {
  setTempRet0: function (value) {
    tempRet0 = value;
  },
  getTempRet0: function () {
    return tempRet0;
  },
  stackSave: function () {
    return STACKTOP;
  },
  stackRestore: function (stackTop) {
    STACKTOP = stackTop;
  },
  getNativeTypeSize: function (type) {
    switch (type) {
      case 'i1': case 'i8': return 1;
      case 'i16': return 2;
      case 'i32': return 4;
      case 'i64': return 8;
      case 'float': return 4;
      case 'double': return 8;
      default: {
        if (type[type.length-1] === '*') {
          return Runtime.QUANTUM_SIZE; // A pointer
        } else if (type[0] === 'i') {
          var bits = parseInt(type.substr(1));
          assert(bits % 8 === 0);
          return bits/8;
        } else {
          return 0;
        }
      }
    }
  },
  getNativeFieldSize: function (type) {
    return Math.max(Runtime.getNativeTypeSize(type), Runtime.QUANTUM_SIZE);
  },
  STACK_ALIGN: 16,
  prepVararg: function (ptr, type) {
    if (type === 'double' || type === 'i64') {
      // move so the load is aligned
      if (ptr & 7) {
        assert((ptr & 7) === 4);
        ptr += 4;
      }
    } else {
      assert((ptr & 3) === 0);
    }
    return ptr;
  },
  getAlignSize: function (type, size, vararg) {
    // we align i64s and doubles on 64-bit boundaries, unlike x86
    if (!vararg && (type == 'i64' || type == 'double')) return 8;
    if (!type) return Math.min(size, 8); // align structures internally to 64 bits
    return Math.min(size || (type ? Runtime.getNativeFieldSize(type) : 0), Runtime.QUANTUM_SIZE);
  },
  dynCall: function (sig, ptr, args) {
    if (args && args.length) {
      return Module['dynCall_' + sig].apply(null, [ptr].concat(args));
    } else {
      return Module['dynCall_' + sig].call(null, ptr);
    }
  },
  functionPointers: [],
  addFunction: function (func) {
    for (var i = 0; i < Runtime.functionPointers.length; i++) {
      if (!Runtime.functionPointers[i]) {
        Runtime.functionPointers[i] = func;
        return 2*(1 + i);
      }
    }
    throw 'Finished up all reserved function pointers. Use a higher value for RESERVED_FUNCTION_POINTERS.';
  },
  removeFunction: function (index) {
    Runtime.functionPointers[(index-2)/2] = null;
  },
  warnOnce: function (text) {
    if (!Runtime.warnOnce.shown) Runtime.warnOnce.shown = {};
    if (!Runtime.warnOnce.shown[text]) {
      Runtime.warnOnce.shown[text] = 1;
      Module.printErr(text);
    }
  },
  funcWrappers: {},
  getFuncWrapper: function (func, sig) {
    assert(sig);
    if (!Runtime.funcWrappers[sig]) {
      Runtime.funcWrappers[sig] = {};
    }
    var sigCache = Runtime.funcWrappers[sig];
    if (!sigCache[func]) {
      // optimize away arguments usage in common cases
      if (sig.length === 1) {
        sigCache[func] = function dynCall_wrapper() {
          return Runtime.dynCall(sig, func);
        };
      } else if (sig.length === 2) {
        sigCache[func] = function dynCall_wrapper(arg) {
          return Runtime.dynCall(sig, func, [arg]);
        };
      } else {
        // general case
        sigCache[func] = function dynCall_wrapper() {
          return Runtime.dynCall(sig, func, Array.prototype.slice.call(arguments));
        };
      }
    }
    return sigCache[func];
  },
  getCompilerSetting: function (name) {
    throw 'You must build with -s RETAIN_COMPILER_SETTINGS=1 for Runtime.getCompilerSetting or emscripten_get_compiler_setting to work';
  },
  stackAlloc: function (size) { var ret = STACKTOP;STACKTOP = (STACKTOP + size)|0;STACKTOP = (((STACKTOP)+15)&-16); return ret; },
  staticAlloc: function (size) { var ret = STATICTOP;STATICTOP = (STATICTOP + size)|0;STATICTOP = (((STATICTOP)+15)&-16); return ret; },
  dynamicAlloc: function (size) { var ret = DYNAMICTOP;DYNAMICTOP = (DYNAMICTOP + size)|0;DYNAMICTOP = (((DYNAMICTOP)+15)&-16); if (DYNAMICTOP >= TOTAL_MEMORY) { var success = enlargeMemory(); if (!success) { DYNAMICTOP = ret;  return 0; } }; return ret; },
  alignMemory: function (size,quantum) { var ret = size = Math.ceil((size)/(quantum ? quantum : 16))*(quantum ? quantum : 16); return ret; },
  makeBigInt: function (low,high,unsigned) { var ret = (unsigned ? ((+((low>>>0)))+((+((high>>>0)))*(+4294967296))) : ((+((low>>>0)))+((+((high|0)))*(+4294967296)))); return ret; },
  GLOBAL_BASE: 8,
  QUANTUM_SIZE: 4,
  __dummy__: 0
}



Module["Runtime"] = Runtime;



//========================================
// Runtime essentials
//========================================

var ABORT = false; // whether we are quitting the application. no code should run after this. set in exit() and abort()
var EXITSTATUS = 0;

function assert(condition, text) {
  if (!condition) {
    abort('Assertion failed: ' + text);
  }
}

var globalScope = this;

// Returns the C function with a specified identifier (for C++, you need to do manual name mangling)
function getCFunc(ident) {
  var func = Module['_' + ident]; // closure exported function
  if (!func) {
    try { func = eval('_' + ident); } catch(e) {}
  }
  assert(func, 'Cannot call unknown function ' + ident + ' (perhaps LLVM optimizations or closure removed it?)');
  return func;
}

var cwrap, ccall;
(function(){
  var JSfuncs = {
    // Helpers for cwrap -- it can't refer to Runtime directly because it might
    // be renamed by closure, instead it calls JSfuncs['stackSave'].body to find
    // out what the minified function name is.
    'stackSave': function() {
      Runtime.stackSave()
    },
    'stackRestore': function() {
      Runtime.stackRestore()
    },
    // type conversion from js to c
    'arrayToC' : function(arr) {
      var ret = Runtime.stackAlloc(arr.length);
      writeArrayToMemory(arr, ret);
      return ret;
    },
    'stringToC' : function(str) {
      var ret = 0;
      if (str !== null && str !== undefined && str !== 0) { // null string
        // at most 4 bytes per UTF-8 code point, +1 for the trailing '\0'
        ret = Runtime.stackAlloc((str.length << 2) + 1);
        writeStringToMemory(str, ret);
      }
      return ret;
    }
  };
  // For fast lookup of conversion functions
  var toC = {'string' : JSfuncs['stringToC'], 'array' : JSfuncs['arrayToC']};

  // C calling interface.
  ccall = function ccallFunc(ident, returnType, argTypes, args, opts) {
    var func = getCFunc(ident);
    var cArgs = [];
    var stack = 0;
    if (args) {
      for (var i = 0; i < args.length; i++) {
        var converter = toC[argTypes[i]];
        if (converter) {
          if (stack === 0) stack = Runtime.stackSave();
          cArgs[i] = converter(args[i]);
        } else {
          cArgs[i] = args[i];
        }
      }
    }
    var ret = func.apply(null, cArgs);
    if (returnType === 'string') ret = Pointer_stringify(ret);
    if (stack !== 0) {
      if (opts && opts.async) {
        EmterpreterAsync.asyncFinalizers.push(function() {
          Runtime.stackRestore(stack);
        });
        return;
      }
      Runtime.stackRestore(stack);
    }
    return ret;
  }

  var sourceRegex = /^function\s*[a-zA-Z$_0-9]*\s*\(([^)]*)\)\s*{\s*([^*]*?)[\s;]*(?:return\s*(.*?)[;\s]*)?}$/;
  function parseJSFunc(jsfunc) {
    // Match the body and the return value of a javascript function source
    var parsed = jsfunc.toString().match(sourceRegex).slice(1);
    return {arguments : parsed[0], body : parsed[1], returnValue: parsed[2]}
  }

  // sources of useful functions. we create this lazily as it can trigger a source decompression on this entire file
  var JSsource = null;
  function ensureJSsource() {
    if (!JSsource) {
      JSsource = {};
      for (var fun in JSfuncs) {
        if (JSfuncs.hasOwnProperty(fun)) {
          // Elements of toCsource are arrays of three items:
          // the code, and the return value
          JSsource[fun] = parseJSFunc(JSfuncs[fun]);
        }
      }
    }
  }

  cwrap = function cwrap(ident, returnType, argTypes) {
    argTypes = argTypes || [];
    var cfunc = getCFunc(ident);
    // When the function takes numbers and returns a number, we can just return
    // the original function
    var numericArgs = argTypes.every(function(type){ return type === 'number'});
    var numericRet = (returnType !== 'string');
    if ( numericRet && numericArgs) {
      return cfunc;
    }
    // Creation of the arguments list (["$1","$2",...,"$nargs"])
    var argNames = argTypes.map(function(x,i){return '$'+i});
    var funcstr = "(function(" + argNames.join(',') + ") {";
    var nargs = argTypes.length;
    if (!numericArgs) {
      // Generate the code needed to convert the arguments from javascript
      // values to pointers
      ensureJSsource();
      funcstr += 'var stack = ' + JSsource['stackSave'].body + ';';
      for (var i = 0; i < nargs; i++) {
        var arg = argNames[i], type = argTypes[i];
        if (type === 'number') continue;
        var convertCode = JSsource[type + 'ToC']; // [code, return]
        funcstr += 'var ' + convertCode.arguments + ' = ' + arg + ';';
        funcstr += convertCode.body + ';';
        funcstr += arg + '=(' + convertCode.returnValue + ');';
      }
    }

    // When the code is compressed, the name of cfunc is not literally 'cfunc' anymore
    var cfuncname = parseJSFunc(function(){return cfunc}).returnValue;
    // Call the function
    funcstr += 'var ret = ' + cfuncname + '(' + argNames.join(',') + ');';
    if (!numericRet) { // Return type can only by 'string' or 'number'
      // Convert the result to a string
      var strgfy = parseJSFunc(function(){return Pointer_stringify}).returnValue;
      funcstr += 'ret = ' + strgfy + '(ret);';
    }
    if (!numericArgs) {
      // If we had a stack, restore it
      ensureJSsource();
      funcstr += JSsource['stackRestore'].body.replace('()', '(stack)') + ';';
    }
    funcstr += 'return ret})';
    return eval(funcstr);
  };
})();
Module["ccall"] = ccall;
Module["cwrap"] = cwrap;

function setValue(ptr, value, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length-1) === '*') type = 'i32'; // pointers are 32-bit
    switch(type) {
      case 'i1': HEAP8[((ptr)>>0)]=value; break;
      case 'i8': HEAP8[((ptr)>>0)]=value; break;
      case 'i16': HEAP16[((ptr)>>1)]=value; break;
      case 'i32': HEAP32[((ptr)>>2)]=value; break;
      case 'i64': (tempI64 = [value>>>0,(tempDouble=value,(+(Math_abs(tempDouble))) >= (+1) ? (tempDouble > (+0) ? ((Math_min((+(Math_floor((tempDouble)/(+4294967296)))), (+4294967295)))|0)>>>0 : (~~((+(Math_ceil((tempDouble - +(((~~(tempDouble)))>>>0))/(+4294967296))))))>>>0) : 0)],HEAP32[((ptr)>>2)]=tempI64[0],HEAP32[(((ptr)+(4))>>2)]=tempI64[1]); break;
      case 'float': HEAPF32[((ptr)>>2)]=value; break;
      case 'double': HEAPF64[((ptr)>>3)]=value; break;
      default: abort('invalid type for setValue: ' + type);
    }
}
Module["setValue"] = setValue;


function getValue(ptr, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length-1) === '*') type = 'i32'; // pointers are 32-bit
    switch(type) {
      case 'i1': return HEAP8[((ptr)>>0)];
      case 'i8': return HEAP8[((ptr)>>0)];
      case 'i16': return HEAP16[((ptr)>>1)];
      case 'i32': return HEAP32[((ptr)>>2)];
      case 'i64': return HEAP32[((ptr)>>2)];
      case 'float': return HEAPF32[((ptr)>>2)];
      case 'double': return HEAPF64[((ptr)>>3)];
      default: abort('invalid type for setValue: ' + type);
    }
  return null;
}
Module["getValue"] = getValue;

var ALLOC_NORMAL = 0; // Tries to use _malloc()
var ALLOC_STACK = 1; // Lives for the duration of the current function call
var ALLOC_STATIC = 2; // Cannot be freed
var ALLOC_DYNAMIC = 3; // Cannot be freed except through sbrk
var ALLOC_NONE = 4; // Do not allocate
Module["ALLOC_NORMAL"] = ALLOC_NORMAL;
Module["ALLOC_STACK"] = ALLOC_STACK;
Module["ALLOC_STATIC"] = ALLOC_STATIC;
Module["ALLOC_DYNAMIC"] = ALLOC_DYNAMIC;
Module["ALLOC_NONE"] = ALLOC_NONE;

// allocate(): This is for internal use. You can use it yourself as well, but the interface
//             is a little tricky (see docs right below). The reason is that it is optimized
//             for multiple syntaxes to save space in generated code. So you should
//             normally not use allocate(), and instead allocate memory using _malloc(),
//             initialize it with setValue(), and so forth.
// @slab: An array of data, or a number. If a number, then the size of the block to allocate,
//        in *bytes* (note that this is sometimes confusing: the next parameter does not
//        affect this!)
// @types: Either an array of types, one for each byte (or 0 if no type at that position),
//         or a single type which is used for the entire block. This only matters if there
//         is initial data - if @slab is a number, then this does not matter at all and is
//         ignored.
// @allocator: How to allocate memory, see ALLOC_*
function allocate(slab, types, allocator, ptr) {
  var zeroinit, size;
  if (typeof slab === 'number') {
    zeroinit = true;
    size = slab;
  } else {
    zeroinit = false;
    size = slab.length;
  }

  var singleType = typeof types === 'string' ? types : null;

  var ret;
  if (allocator == ALLOC_NONE) {
    ret = ptr;
  } else {
    ret = [typeof _malloc === 'function' ? _malloc : Runtime.staticAlloc, Runtime.stackAlloc, Runtime.staticAlloc, Runtime.dynamicAlloc][allocator === undefined ? ALLOC_STATIC : allocator](Math.max(size, singleType ? 1 : types.length));
  }

  if (zeroinit) {
    var ptr = ret, stop;
    assert((ret & 3) == 0);
    stop = ret + (size & ~3);
    for (; ptr < stop; ptr += 4) {
      HEAP32[((ptr)>>2)]=0;
    }
    stop = ret + size;
    while (ptr < stop) {
      HEAP8[((ptr++)>>0)]=0;
    }
    return ret;
  }

  if (singleType === 'i8') {
    if (slab.subarray || slab.slice) {
      HEAPU8.set(slab, ret);
    } else {
      HEAPU8.set(new Uint8Array(slab), ret);
    }
    return ret;
  }

  var i = 0, type, typeSize, previousType;
  while (i < size) {
    var curr = slab[i];

    if (typeof curr === 'function') {
      curr = Runtime.getFunctionIndex(curr);
    }

    type = singleType || types[i];
    if (type === 0) {
      i++;
      continue;
    }

    if (type == 'i64') type = 'i32'; // special case: we have one i32 here, and one i32 later

    setValue(ret+i, curr, type);

    // no need to look up size unless type changes, so cache it
    if (previousType !== type) {
      typeSize = Runtime.getNativeTypeSize(type);
      previousType = type;
    }
    i += typeSize;
  }

  return ret;
}
Module["allocate"] = allocate;

// Allocate memory during any stage of startup - static memory early on, dynamic memory later, malloc when ready
function getMemory(size) {
  if (!staticSealed) return Runtime.staticAlloc(size);
  if ((typeof _sbrk !== 'undefined' && !_sbrk.called) || !runtimeInitialized) return Runtime.dynamicAlloc(size);
  return _malloc(size);
}
Module["getMemory"] = getMemory;

function Pointer_stringify(ptr, /* optional */ length) {
  if (length === 0 || !ptr) return '';
  // TODO: use TextDecoder
  // Find the length, and check for UTF while doing so
  var hasUtf = 0;
  var t;
  var i = 0;
  while (1) {
    t = HEAPU8[(((ptr)+(i))>>0)];
    hasUtf |= t;
    if (t == 0 && !length) break;
    i++;
    if (length && i == length) break;
  }
  if (!length) length = i;

  var ret = '';

  if (hasUtf < 128) {
    var MAX_CHUNK = 1024; // split up into chunks, because .apply on a huge string can overflow the stack
    var curr;
    while (length > 0) {
      curr = String.fromCharCode.apply(String, HEAPU8.subarray(ptr, ptr + Math.min(length, MAX_CHUNK)));
      ret = ret ? ret + curr : curr;
      ptr += MAX_CHUNK;
      length -= MAX_CHUNK;
    }
    return ret;
  }
  return Module['UTF8ToString'](ptr);
}
Module["Pointer_stringify"] = Pointer_stringify;

// Given a pointer 'ptr' to a null-terminated ASCII-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

function AsciiToString(ptr) {
  var str = '';
  while (1) {
    var ch = HEAP8[((ptr++)>>0)];
    if (!ch) return str;
    str += String.fromCharCode(ch);
  }
}
Module["AsciiToString"] = AsciiToString;

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in ASCII form. The copy will require at most str.length+1 bytes of space in the HEAP.

function stringToAscii(str, outPtr) {
  return writeAsciiToMemory(str, outPtr, false);
}
Module["stringToAscii"] = stringToAscii;

// Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the given array that contains uint8 values, returns
// a copy of that string as a Javascript String object.

function UTF8ArrayToString(u8Array, idx) {
  var u0, u1, u2, u3, u4, u5;

  var str = '';
  while (1) {
    // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description and https://www.ietf.org/rfc/rfc2279.txt and https://tools.ietf.org/html/rfc3629
    u0 = u8Array[idx++];
    if (!u0) return str;
    if (!(u0 & 0x80)) { str += String.fromCharCode(u0); continue; }
    u1 = u8Array[idx++] & 63;
    if ((u0 & 0xE0) == 0xC0) { str += String.fromCharCode(((u0 & 31) << 6) | u1); continue; }
    u2 = u8Array[idx++] & 63;
    if ((u0 & 0xF0) == 0xE0) {
      u0 = ((u0 & 15) << 12) | (u1 << 6) | u2;
    } else {
      u3 = u8Array[idx++] & 63;
      if ((u0 & 0xF8) == 0xF0) {
        u0 = ((u0 & 7) << 18) | (u1 << 12) | (u2 << 6) | u3;
      } else {
        u4 = u8Array[idx++] & 63;
        if ((u0 & 0xFC) == 0xF8) {
          u0 = ((u0 & 3) << 24) | (u1 << 18) | (u2 << 12) | (u3 << 6) | u4;
        } else {
          u5 = u8Array[idx++] & 63;
          u0 = ((u0 & 1) << 30) | (u1 << 24) | (u2 << 18) | (u3 << 12) | (u4 << 6) | u5;
        }
      }
    }
    if (u0 < 0x10000) {
      str += String.fromCharCode(u0);
    } else {
      var ch = u0 - 0x10000;
      str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
    }
  }
}
Module["UTF8ArrayToString"] = UTF8ArrayToString;

// Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

function UTF8ToString(ptr) {
  return UTF8ArrayToString(HEAPU8,ptr);
}
Module["UTF8ToString"] = UTF8ToString;

// Copies the given Javascript String object 'str' to the given byte array at address 'outIdx',
// encoded in UTF8 form and null-terminated. The copy will require at most str.length*4+1 bytes of space in the HEAP.
// Use the function lengthBytesUTF8() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outU8Array: the array to copy to. Each index in this array is assumed to be one 8-byte element.
//   outIdx: The starting offset in the array to begin the copying.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=1, only the null terminator will be written and nothing else.
//                    maxBytesToWrite=0 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF8Array(str, outU8Array, outIdx, maxBytesToWrite) {
  if (!(maxBytesToWrite > 0)) // Parameter maxBytesToWrite is not optional. Negative values, 0, null, undefined and false each don't write out any bytes.
    return 0;

  var startIdx = outIdx;
  var endIdx = outIdx + maxBytesToWrite - 1; // -1 for string null terminator.
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! So decode UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description and https://www.ietf.org/rfc/rfc2279.txt and https://tools.ietf.org/html/rfc3629
    var u = str.charCodeAt(i); // possibly a lead surrogate
    if (u >= 0xD800 && u <= 0xDFFF) u = 0x10000 + ((u & 0x3FF) << 10) | (str.charCodeAt(++i) & 0x3FF);
    if (u <= 0x7F) {
      if (outIdx >= endIdx) break;
      outU8Array[outIdx++] = u;
    } else if (u <= 0x7FF) {
      if (outIdx + 1 >= endIdx) break;
      outU8Array[outIdx++] = 0xC0 | (u >> 6);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0xFFFF) {
      if (outIdx + 2 >= endIdx) break;
      outU8Array[outIdx++] = 0xE0 | (u >> 12);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0x1FFFFF) {
      if (outIdx + 3 >= endIdx) break;
      outU8Array[outIdx++] = 0xF0 | (u >> 18);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0x3FFFFFF) {
      if (outIdx + 4 >= endIdx) break;
      outU8Array[outIdx++] = 0xF8 | (u >> 24);
      outU8Array[outIdx++] = 0x80 | ((u >> 18) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else {
      if (outIdx + 5 >= endIdx) break;
      outU8Array[outIdx++] = 0xFC | (u >> 30);
      outU8Array[outIdx++] = 0x80 | ((u >> 24) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 18) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    }
  }
  // Null-terminate the pointer to the buffer.
  outU8Array[outIdx] = 0;
  return outIdx - startIdx;
}
Module["stringToUTF8Array"] = stringToUTF8Array;

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF8 form. The copy will require at most str.length*4+1 bytes of space in the HEAP.
// Use the function lengthBytesUTF8() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF8(str, outPtr, maxBytesToWrite) {
  return stringToUTF8Array(str, HEAPU8,outPtr, maxBytesToWrite);
}
Module["stringToUTF8"] = stringToUTF8;

// Returns the number of bytes the given Javascript string takes if encoded as a UTF8 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF8(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! So decode UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var u = str.charCodeAt(i); // possibly a lead surrogate
    if (u >= 0xD800 && u <= 0xDFFF) u = 0x10000 + ((u & 0x3FF) << 10) | (str.charCodeAt(++i) & 0x3FF);
    if (u <= 0x7F) {
      ++len;
    } else if (u <= 0x7FF) {
      len += 2;
    } else if (u <= 0xFFFF) {
      len += 3;
    } else if (u <= 0x1FFFFF) {
      len += 4;
    } else if (u <= 0x3FFFFFF) {
      len += 5;
    } else {
      len += 6;
    }
  }
  return len;
}
Module["lengthBytesUTF8"] = lengthBytesUTF8;

// Given a pointer 'ptr' to a null-terminated UTF16LE-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

function UTF16ToString(ptr) {
  var i = 0;

  var str = '';
  while (1) {
    var codeUnit = HEAP16[(((ptr)+(i*2))>>1)];
    if (codeUnit == 0)
      return str;
    ++i;
    // fromCharCode constructs a character from a UTF-16 code unit, so we can pass the UTF16 string right through.
    str += String.fromCharCode(codeUnit);
  }
}


// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF16 form. The copy will require at most str.length*4+2 bytes of space in the HEAP.
// Use the function lengthBytesUTF16() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outPtr: Byte address in Emscripten HEAP where to write the string to.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=2, only the null terminator will be written and nothing else.
//                    maxBytesToWrite<2 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF16(str, outPtr, maxBytesToWrite) {
  // Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 0x7FFFFFFF;
  }
  if (maxBytesToWrite < 2) return 0;
  maxBytesToWrite -= 2; // Null terminator.
  var startPtr = outPtr;
  var numCharsToWrite = (maxBytesToWrite < str.length*2) ? (maxBytesToWrite / 2) : str.length;
  for (var i = 0; i < numCharsToWrite; ++i) {
    // charCodeAt returns a UTF-16 encoded code unit, so it can be directly written to the HEAP.
    var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
    HEAP16[((outPtr)>>1)]=codeUnit;
    outPtr += 2;
  }
  // Null-terminate the pointer to the HEAP.
  HEAP16[((outPtr)>>1)]=0;
  return outPtr - startPtr;
}


// Returns the number of bytes the given Javascript string takes if encoded as a UTF16 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF16(str) {
  return str.length*2;
}


function UTF32ToString(ptr) {
  var i = 0;

  var str = '';
  while (1) {
    var utf32 = HEAP32[(((ptr)+(i*4))>>2)];
    if (utf32 == 0)
      return str;
    ++i;
    // Gotcha: fromCharCode constructs a character from a UTF-16 encoded code (pair), not from a Unicode code point! So encode the code point to UTF-16 for constructing.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    if (utf32 >= 0x10000) {
      var ch = utf32 - 0x10000;
      str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
    } else {
      str += String.fromCharCode(utf32);
    }
  }
}


// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF32 form. The copy will require at most str.length*4+4 bytes of space in the HEAP.
// Use the function lengthBytesUTF32() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outPtr: Byte address in Emscripten HEAP where to write the string to.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=4, only the null terminator will be written and nothing else.
//                    maxBytesToWrite<4 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF32(str, outPtr, maxBytesToWrite) {
  // Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 0x7FFFFFFF;
  }
  if (maxBytesToWrite < 4) return 0;
  var startPtr = outPtr;
  var endPtr = startPtr + maxBytesToWrite - 4;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! We must decode the string to UTF-32 to the heap.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
    if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) {
      var trailSurrogate = str.charCodeAt(++i);
      codeUnit = 0x10000 + ((codeUnit & 0x3FF) << 10) | (trailSurrogate & 0x3FF);
    }
    HEAP32[((outPtr)>>2)]=codeUnit;
    outPtr += 4;
    if (outPtr + 4 > endPtr) break;
  }
  // Null-terminate the pointer to the HEAP.
  HEAP32[((outPtr)>>2)]=0;
  return outPtr - startPtr;
}


// Returns the number of bytes the given Javascript string takes if encoded as a UTF16 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF32(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! We must decode the string to UTF-32 to the heap.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var codeUnit = str.charCodeAt(i);
    if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) ++i; // possibly a lead surrogate, so skip over the tail surrogate.
    len += 4;
  }

  return len;
}


function demangle(func) {
  var hasLibcxxabi = !!Module['___cxa_demangle'];
  if (hasLibcxxabi) {
    try {
      var buf = _malloc(func.length);
      writeStringToMemory(func.substr(1), buf);
      var status = _malloc(4);
      var ret = Module['___cxa_demangle'](buf, 0, 0, status);
      if (getValue(status, 'i32') === 0 && ret) {
        return Pointer_stringify(ret);
      }
      // otherwise, libcxxabi failed
    } catch(e) {
      // ignore problems here
    } finally {
      if (buf) _free(buf);
      if (status) _free(status);
      if (ret) _free(ret);
    }
    // failure when using libcxxabi, don't demangle
    return func;
  }
  Runtime.warnOnce('warning: build with  -s DEMANGLE_SUPPORT=1  to link in libcxxabi demangling');
  return func;
}

function demangleAll(text) {
  return text.replace(/__Z[\w\d_]+/g, function(x) { var y = demangle(x); return x === y ? x : (x + ' [' + y + ']') });
}

function jsStackTrace() {
  var err = new Error();
  if (!err.stack) {
    // IE10+ special cases: It does have callstack info, but it is only populated if an Error object is thrown,
    // so try that as a special-case.
    try {
      throw new Error(0);
    } catch(e) {
      err = e;
    }
    if (!err.stack) {
      return '(no stack trace available)';
    }
  }
  return err.stack.toString();
}

function stackTrace() {
  var js = jsStackTrace();
  if (Module['extraStackTrace']) js += '\n' + Module['extraStackTrace']();
  return demangleAll(js);
}
Module["stackTrace"] = stackTrace;

// Memory management

var PAGE_SIZE = 4096;

function alignMemoryPage(x) {
  if (x % 4096 > 0) {
    x += (4096 - (x % 4096));
  }
  return x;
}

var HEAP;
var buffer;
var HEAP8, HEAPU8, HEAP16, HEAPU16, HEAP32, HEAPU32, HEAPF32, HEAPF64;

function updateGlobalBuffer(buf) {
  Module['buffer'] = buffer = buf;
}

function updateGlobalBufferViews() {
  Module['HEAP8'] = HEAP8 = new Int8Array(buffer);
  Module['HEAP16'] = HEAP16 = new Int16Array(buffer);
  Module['HEAP32'] = HEAP32 = new Int32Array(buffer);
  Module['HEAPU8'] = HEAPU8 = new Uint8Array(buffer);
  Module['HEAPU16'] = HEAPU16 = new Uint16Array(buffer);
  Module['HEAPU32'] = HEAPU32 = new Uint32Array(buffer);
  Module['HEAPF32'] = HEAPF32 = new Float32Array(buffer);
  Module['HEAPF64'] = HEAPF64 = new Float64Array(buffer);
}

var STATIC_BASE = 0, STATICTOP = 0, staticSealed = false; // static area
var STACK_BASE = 0, STACKTOP = 0, STACK_MAX = 0; // stack area
var DYNAMIC_BASE = 0, DYNAMICTOP = 0; // dynamic area handled by sbrk



function abortOnCannotGrowMemory() {
  abort('Cannot enlarge memory arrays. Either (1) compile with  -s TOTAL_MEMORY=X  with X higher than the current value ' + TOTAL_MEMORY + ', (2) compile with  -s ALLOW_MEMORY_GROWTH=1  which adjusts the size at runtime but prevents some optimizations, (3) set Module.TOTAL_MEMORY to a higher value before the program runs, or if you want malloc to return NULL (0) instead of this abort, compile with  -s ABORTING_MALLOC=0 ');
}

function enlargeMemory() {
  abortOnCannotGrowMemory();
}


var TOTAL_STACK = Module['TOTAL_STACK'] || 5242880;
var TOTAL_MEMORY = Module['TOTAL_MEMORY'] || 16777216;

var totalMemory = 64*1024;
while (totalMemory < TOTAL_MEMORY || totalMemory < 2*TOTAL_STACK) {
  if (totalMemory < 16*1024*1024) {
    totalMemory *= 2;
  } else {
    totalMemory += 16*1024*1024
  }
}
if (totalMemory !== TOTAL_MEMORY) {
  TOTAL_MEMORY = totalMemory;
}

// Initialize the runtime's memory



// Use a provided buffer, if there is one, or else allocate a new one
if (Module['buffer']) {
  buffer = Module['buffer'];
} else {
  buffer = new ArrayBuffer(TOTAL_MEMORY);
}
updateGlobalBufferViews();


// Endianness check (note: assumes compiler arch was little-endian)
HEAP32[0] = 255;
if (HEAPU8[0] !== 255 || HEAPU8[3] !== 0) throw 'Typed arrays 2 must be run on a little-endian system';

Module['HEAP'] = HEAP;
Module['buffer'] = buffer;
Module['HEAP8'] = HEAP8;
Module['HEAP16'] = HEAP16;
Module['HEAP32'] = HEAP32;
Module['HEAPU8'] = HEAPU8;
Module['HEAPU16'] = HEAPU16;
Module['HEAPU32'] = HEAPU32;
Module['HEAPF32'] = HEAPF32;
Module['HEAPF64'] = HEAPF64;

function callRuntimeCallbacks(callbacks) {
  while(callbacks.length > 0) {
    var callback = callbacks.shift();
    if (typeof callback == 'function') {
      callback();
      continue;
    }
    var func = callback.func;
    if (typeof func === 'number') {
      if (callback.arg === undefined) {
        Runtime.dynCall('v', func);
      } else {
        Runtime.dynCall('vi', func, [callback.arg]);
      }
    } else {
      func(callback.arg === undefined ? null : callback.arg);
    }
  }
}

var __ATPRERUN__  = []; // functions called before the runtime is initialized
var __ATINIT__    = []; // functions called during startup
var __ATMAIN__    = []; // functions called when main() is to be run
var __ATEXIT__    = []; // functions called during shutdown
var __ATPOSTRUN__ = []; // functions called after the runtime has exited

var runtimeInitialized = false;
var runtimeExited = false;


function preRun() {
  // compatibility - merge in anything from Module['preRun'] at this time
  if (Module['preRun']) {
    if (typeof Module['preRun'] == 'function') Module['preRun'] = [Module['preRun']];
    while (Module['preRun'].length) {
      addOnPreRun(Module['preRun'].shift());
    }
  }
  callRuntimeCallbacks(__ATPRERUN__);
}

function ensureInitRuntime() {
  if (runtimeInitialized) return;
  runtimeInitialized = true;
  callRuntimeCallbacks(__ATINIT__);
}

function preMain() {
  callRuntimeCallbacks(__ATMAIN__);
}

function exitRuntime() {
  callRuntimeCallbacks(__ATEXIT__);
  runtimeExited = true;
}

function postRun() {
  // compatibility - merge in anything from Module['postRun'] at this time
  if (Module['postRun']) {
    if (typeof Module['postRun'] == 'function') Module['postRun'] = [Module['postRun']];
    while (Module['postRun'].length) {
      addOnPostRun(Module['postRun'].shift());
    }
  }
  callRuntimeCallbacks(__ATPOSTRUN__);
}

function addOnPreRun(cb) {
  __ATPRERUN__.unshift(cb);
}
Module["addOnPreRun"] = addOnPreRun;

function addOnInit(cb) {
  __ATINIT__.unshift(cb);
}
Module["addOnInit"] = addOnInit;

function addOnPreMain(cb) {
  __ATMAIN__.unshift(cb);
}
Module["addOnPreMain"] = addOnPreMain;

function addOnExit(cb) {
  __ATEXIT__.unshift(cb);
}
Module["addOnExit"] = addOnExit;

function addOnPostRun(cb) {
  __ATPOSTRUN__.unshift(cb);
}
Module["addOnPostRun"] = addOnPostRun;

// Tools


function intArrayFromString(stringy, dontAddNull, length /* optional */) {
  var len = length > 0 ? length : lengthBytesUTF8(stringy)+1;
  var u8array = new Array(len);
  var numBytesWritten = stringToUTF8Array(stringy, u8array, 0, u8array.length);
  if (dontAddNull) u8array.length = numBytesWritten;
  return u8array;
}
Module["intArrayFromString"] = intArrayFromString;

function intArrayToString(array) {
  var ret = [];
  for (var i = 0; i < array.length; i++) {
    var chr = array[i];
    if (chr > 0xFF) {
      chr &= 0xFF;
    }
    ret.push(String.fromCharCode(chr));
  }
  return ret.join('');
}
Module["intArrayToString"] = intArrayToString;

function writeStringToMemory(string, buffer, dontAddNull) {
  var array = intArrayFromString(string, dontAddNull);
  var i = 0;
  while (i < array.length) {
    var chr = array[i];
    HEAP8[(((buffer)+(i))>>0)]=chr;
    i = i + 1;
  }
}
Module["writeStringToMemory"] = writeStringToMemory;

function writeArrayToMemory(array, buffer) {
  for (var i = 0; i < array.length; i++) {
    HEAP8[((buffer++)>>0)]=array[i];
  }
}
Module["writeArrayToMemory"] = writeArrayToMemory;

function writeAsciiToMemory(str, buffer, dontAddNull) {
  for (var i = 0; i < str.length; ++i) {
    HEAP8[((buffer++)>>0)]=str.charCodeAt(i);
  }
  // Null-terminate the pointer to the HEAP.
  if (!dontAddNull) HEAP8[((buffer)>>0)]=0;
}
Module["writeAsciiToMemory"] = writeAsciiToMemory;

function unSign(value, bits, ignore) {
  if (value >= 0) {
    return value;
  }
  return bits <= 32 ? 2*Math.abs(1 << (bits-1)) + value // Need some trickery, since if bits == 32, we are right at the limit of the bits JS uses in bitshifts
                    : Math.pow(2, bits)         + value;
}
function reSign(value, bits, ignore) {
  if (value <= 0) {
    return value;
  }
  var half = bits <= 32 ? Math.abs(1 << (bits-1)) // abs is needed if bits == 32
                        : Math.pow(2, bits-1);
  if (value >= half && (bits <= 32 || value > half)) { // for huge values, we can hit the precision limit and always get true here. so don't do that
                                                       // but, in general there is no perfect solution here. With 64-bit ints, we get rounding and errors
                                                       // TODO: In i64 mode 1, resign the two parts separately and safely
    value = -2*half + value; // Cannot bitshift half, as it may be at the limit of the bits JS uses in bitshifts
  }
  return value;
}


// check for imul support, and also for correctness ( https://bugs.webkit.org/show_bug.cgi?id=126345 )
if (!Math['imul'] || Math['imul'](0xffffffff, 5) !== -5) Math['imul'] = function imul(a, b) {
  var ah  = a >>> 16;
  var al = a & 0xffff;
  var bh  = b >>> 16;
  var bl = b & 0xffff;
  return (al*bl + ((ah*bl + al*bh) << 16))|0;
};
Math.imul = Math['imul'];


if (!Math['clz32']) Math['clz32'] = function(x) {
  x = x >>> 0;
  for (var i = 0; i < 32; i++) {
    if (x & (1 << (31 - i))) return i;
  }
  return 32;
};
Math.clz32 = Math['clz32']

if (!Math['trunc']) Math['trunc'] = function(x) {
  return x < 0 ? Math.ceil(x) : Math.floor(x);
};
Math.trunc = Math['trunc'];

var Math_abs = Math.abs;
var Math_cos = Math.cos;
var Math_sin = Math.sin;
var Math_tan = Math.tan;
var Math_acos = Math.acos;
var Math_asin = Math.asin;
var Math_atan = Math.atan;
var Math_atan2 = Math.atan2;
var Math_exp = Math.exp;
var Math_log = Math.log;
var Math_sqrt = Math.sqrt;
var Math_ceil = Math.ceil;
var Math_floor = Math.floor;
var Math_pow = Math.pow;
var Math_imul = Math.imul;
var Math_fround = Math.fround;
var Math_min = Math.min;
var Math_clz32 = Math.clz32;
var Math_trunc = Math.trunc;

// A counter of dependencies for calling run(). If we need to
// do asynchronous work before running, increment this and
// decrement it. Incrementing must happen in a place like
// PRE_RUN_ADDITIONS (used by emcc to add file preloading).
// Note that you can add dependencies in preRun, even though
// it happens right before run - run will be postponed until
// the dependencies are met.
var runDependencies = 0;
var runDependencyWatcher = null;
var dependenciesFulfilled = null; // overridden to take different actions when all run dependencies are fulfilled

function getUniqueRunDependency(id) {
  return id;
}

function addRunDependency(id) {
  runDependencies++;
  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }
}
Module["addRunDependency"] = addRunDependency;

function removeRunDependency(id) {
  runDependencies--;
  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }
  if (runDependencies == 0) {
    if (runDependencyWatcher !== null) {
      clearInterval(runDependencyWatcher);
      runDependencyWatcher = null;
    }
    if (dependenciesFulfilled) {
      var callback = dependenciesFulfilled;
      dependenciesFulfilled = null;
      callback(); // can add another dependenciesFulfilled
    }
  }
}
Module["removeRunDependency"] = removeRunDependency;

Module["preloadedImages"] = {}; // maps url to image data
Module["preloadedAudios"] = {}; // maps url to audio data



var memoryInitializer = null;





// === Body ===

var ASM_CONSTS = [];




STATIC_BASE = 8;

STATICTOP = STATIC_BASE + 98080;
  /* global initializers */  __ATINIT__.push({ func: function() { __GLOBAL__I_000101() } }, { func: function() { __GLOBAL__sub_I_anims_cpp() } }, { func: function() { __GLOBAL__sub_I_menu_functions_cpp() } }, { func: function() { __GLOBAL__sub_I_noclip_cpp() } }, { func: function() { __GLOBAL__sub_I_paintmenu_cpp() } }, { func: function() { __GLOBAL__sub_I_script_cpp() } }, { func: function() { __GLOBAL__sub_I_skins_cpp() } }, { func: function() { __GLOBAL__sub_I_teleportation_cpp() } }, { func: function() { __GLOBAL__sub_I_vehicles_cpp() } }, { func: function() { __GLOBAL__sub_I_vehmodmenu_cpp() } }, { func: function() { __GLOBAL__sub_I_weapons_cpp() } }, { func: function() { __GLOBAL__sub_I_iostream_cpp() } });
  

memoryInitializer = "lambdamenu.html.mem";





/* no memory initializer */
var tempDoublePtr = STATICTOP; STATICTOP += 16;

function copyTempFloat(ptr) { // functions, because inlining this code increases code size too much

  HEAP8[tempDoublePtr] = HEAP8[ptr];

  HEAP8[tempDoublePtr+1] = HEAP8[ptr+1];

  HEAP8[tempDoublePtr+2] = HEAP8[ptr+2];

  HEAP8[tempDoublePtr+3] = HEAP8[ptr+3];

}

function copyTempDouble(ptr) {

  HEAP8[tempDoublePtr] = HEAP8[ptr];

  HEAP8[tempDoublePtr+1] = HEAP8[ptr+1];

  HEAP8[tempDoublePtr+2] = HEAP8[ptr+2];

  HEAP8[tempDoublePtr+3] = HEAP8[ptr+3];

  HEAP8[tempDoublePtr+4] = HEAP8[ptr+4];

  HEAP8[tempDoublePtr+5] = HEAP8[ptr+5];

  HEAP8[tempDoublePtr+6] = HEAP8[ptr+6];

  HEAP8[tempDoublePtr+7] = HEAP8[ptr+7];

}

// {{PRE_LIBRARY}}

var EMTSTACKTOP = getMemory(1048576);
var EMT_STACK_MAX = EMTSTACKTOP + 1048576;

var eb = getMemory(1228944);
//assert(eb % 8 === 0);
__ATPRERUN__.push(function() {

  var bytecodeFile = Module['emterpreterFile'];
  //assert(bytecodeFile instanceof ArrayBuffer, 'bad emterpreter file');
  var codeSize = 1228944;
  HEAPU8.set(new Uint8Array(bytecodeFile).subarray(0, codeSize), eb);
  //assert(HEAPU8[eb] === 140);
  //assert(HEAPU8[eb+1] === 0);
  //assert(HEAPU8[eb+2] === 106);
  //assert(HEAPU8[eb+3] === 3);
  var relocationsStart = (codeSize+3) >> 2;
  var relocations = (new Uint32Array(bytecodeFile)).subarray(relocationsStart);
  //assert(relocations.length === 19221);
  if (relocations.length > 0) //assert(relocations[0] === 11716);

  for (var i = 0; i < relocations.length; i++) {
    //assert(relocations[i] % 4 === 0);
    //assert(relocations[i] >= 0 && relocations[i] < eb + 1228944); // in range
    //assert(HEAPU32[eb + relocations[i] >> 2] + eb < (-1 >>> 0), [i, relocations[i]]); // no overflows
    HEAPU32[eb + relocations[i] >> 2] = HEAPU32[eb + relocations[i] >> 2] + eb;
  }
});



  
  var NATIVE={callNative:function ()
  		{
  			'use strict';
  
  			let args = [ nativeState.hash ];
  			let hadPointer = false;
  
  			let pointerTypes = [];
  
  			for (let arg of nativeState.arguments)
  			{
  				if (arg.type == 'ptr')
  				{
  					switch (arg.ptrType)
  					{
  						case 1:
  						case 2:
  							args.push(Citizen.pointerValueIntInitialized(getValue(arg.ptr, 'i32')));
  							pointerTypes.push(arg);
  							break;
  
  						case 3:
  							args.push(Citizen.pointerValueFloatInitialized(getValue(arg.ptr, 'float')));
  							pointerTypes.push(arg);
  							break;
  
  						case 4:
  							args.push(Citizen.pointerValueVector());
  							pointerTypes.push(arg);
  							break;
  					}
  
  					hadPointer = true;
  				}
  				else
  				{
  					args.push(arg.val);
  				}
  			}
  
  			for (let arg of arguments)
  			{
  				args.push(arg);
  			}
  
  			args.push(Citizen.returnResultAnyway());
  
  			let retval = Citizen.invokeNative.apply(this, args);
  
  			if (!hadPointer)
  			{
  				return retval;
  			}
  
  			let singleValue = retval.shift();
  
  			for (let i = 0; i < pointerTypes.length; i++)
  			{
  				let val = retval[i];
  				let pt = pointerTypes[i];
  
  				if (pt.ptrType == 4)
  				{
  					setValue(pt.ptr, val[0], 'float');
  					setValue(pt.ptr + 8, val[1], 'float');
  					setValue(pt.ptr + 16, val[2], 'float');
  				}
  				else if (pt.ptrType == 1 || pt.ptrType == 2)
  				{
  					setValue(pt.ptr, val, 'i32');
  				}
  				else if (pt.ptrType == 3)
  				{
  					setValue(pt.ptr, val, 'float');
  				}
  			}
  
  			return singleValue;
  		}};function _nativeCallInt()
  	{
  		return NATIVE.callNative(Citizen.resultAsInteger());
  	}

   
  Module["_i64Subtract"] = _i64Subtract;

  function ___assert_fail(condition, filename, line, func) {
      ABORT = true;
      throw 'Assertion failed: ' + Pointer_stringify(condition) + ', at: ' + [filename ? Pointer_stringify(filename) : 'unknown filename', line, func ? Pointer_stringify(func) : 'unknown function'] + ' at ' + stackTrace();
    }

  function _nativeCallString()
  	{
  		'use strict';
  
  		let str = NATIVE.callNative(Citizen.resultAsString());
  
  		if (str === null)
  		{
  			return null;
  		}
  
  		if (typeof window.stringPool === 'undefined')
  		{
  			window.stringPool = {};
  		}
  
  		if (!(str in window.stringPool))
  		{
  			let buffer = allocate(intArrayFromString(str), 'i8', ALLOC_NORMAL);
  
  			window.stringPool[str] = buffer;
  		}
  
  		return window.stringPool[str];
  	}

   
  Module["_memset"] = _memset;

  function _nativeInit(hashString)
  	{
  		hashString = Pointer_stringify(hashString);
  
  		nativeState = {
  			hash: hashString,
  			arguments: []
  		};
  	}

   
  Module["_pthread_mutex_lock"] = _pthread_mutex_lock;

  
  
  function __isLeapYear(year) {
        return year%4 === 0 && (year%100 !== 0 || year%400 === 0);
    }
  
  function __arraySum(array, index) {
      var sum = 0;
      for (var i = 0; i <= index; sum += array[i++]);
      return sum;
    }
  
  
  var __MONTH_DAYS_LEAP=[31,29,31,30,31,30,31,31,30,31,30,31];
  
  var __MONTH_DAYS_REGULAR=[31,28,31,30,31,30,31,31,30,31,30,31];function __addDays(date, days) {
      var newDate = new Date(date.getTime());
      while(days > 0) {
        var leap = __isLeapYear(newDate.getFullYear());
        var currentMonth = newDate.getMonth();
        var daysInCurrentMonth = (leap ? __MONTH_DAYS_LEAP : __MONTH_DAYS_REGULAR)[currentMonth];
  
        if (days > daysInCurrentMonth-newDate.getDate()) {
          // we spill over to next month
          days -= (daysInCurrentMonth-newDate.getDate()+1);
          newDate.setDate(1);
          if (currentMonth < 11) {
            newDate.setMonth(currentMonth+1)
          } else {
            newDate.setMonth(0);
            newDate.setFullYear(newDate.getFullYear()+1);
          }
        } else {
          // we stay in current month 
          newDate.setDate(newDate.getDate()+days);
          return newDate;
        }
      }
  
      return newDate;
    }function _strftime(s, maxsize, format, tm) {
      // size_t strftime(char *restrict s, size_t maxsize, const char *restrict format, const struct tm *restrict timeptr);
      // http://pubs.opengroup.org/onlinepubs/009695399/functions/strftime.html
  
      var tm_zone = HEAP32[(((tm)+(40))>>2)];
  
      var date = {
        tm_sec: HEAP32[((tm)>>2)],
        tm_min: HEAP32[(((tm)+(4))>>2)],
        tm_hour: HEAP32[(((tm)+(8))>>2)],
        tm_mday: HEAP32[(((tm)+(12))>>2)],
        tm_mon: HEAP32[(((tm)+(16))>>2)],
        tm_year: HEAP32[(((tm)+(20))>>2)],
        tm_wday: HEAP32[(((tm)+(24))>>2)],
        tm_yday: HEAP32[(((tm)+(28))>>2)],
        tm_isdst: HEAP32[(((tm)+(32))>>2)],
        tm_gmtoff: HEAP32[(((tm)+(36))>>2)],
        tm_zone: tm_zone ? Pointer_stringify(tm_zone) : ''
      };
  
      var pattern = Pointer_stringify(format);
  
      // expand format
      var EXPANSION_RULES_1 = {
        '%c': '%a %b %d %H:%M:%S %Y',     // Replaced by the locale's appropriate date and time representation - e.g., Mon Aug  3 14:02:01 2013
        '%D': '%m/%d/%y',                 // Equivalent to %m / %d / %y
        '%F': '%Y-%m-%d',                 // Equivalent to %Y - %m - %d
        '%h': '%b',                       // Equivalent to %b
        '%r': '%I:%M:%S %p',              // Replaced by the time in a.m. and p.m. notation
        '%R': '%H:%M',                    // Replaced by the time in 24-hour notation
        '%T': '%H:%M:%S',                 // Replaced by the time
        '%x': '%m/%d/%y',                 // Replaced by the locale's appropriate date representation
        '%X': '%H:%M:%S'                  // Replaced by the locale's appropriate date representation
      };
      for (var rule in EXPANSION_RULES_1) {
        pattern = pattern.replace(new RegExp(rule, 'g'), EXPANSION_RULES_1[rule]);
      }
  
      var WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  
      function leadingSomething(value, digits, character) {
        var str = typeof value === 'number' ? value.toString() : (value || '');
        while (str.length < digits) {
          str = character[0]+str;
        }
        return str;
      };
  
      function leadingNulls(value, digits) {
        return leadingSomething(value, digits, '0');
      };
  
      function compareByDay(date1, date2) {
        function sgn(value) {
          return value < 0 ? -1 : (value > 0 ? 1 : 0);
        };
  
        var compare;
        if ((compare = sgn(date1.getFullYear()-date2.getFullYear())) === 0) {
          if ((compare = sgn(date1.getMonth()-date2.getMonth())) === 0) {
            compare = sgn(date1.getDate()-date2.getDate());
          }
        }
        return compare;
      };
  
      function getFirstWeekStartDate(janFourth) {
          switch (janFourth.getDay()) {
            case 0: // Sunday
              return new Date(janFourth.getFullYear()-1, 11, 29);
            case 1: // Monday
              return janFourth;
            case 2: // Tuesday
              return new Date(janFourth.getFullYear(), 0, 3);
            case 3: // Wednesday
              return new Date(janFourth.getFullYear(), 0, 2);
            case 4: // Thursday
              return new Date(janFourth.getFullYear(), 0, 1);
            case 5: // Friday
              return new Date(janFourth.getFullYear()-1, 11, 31);
            case 6: // Saturday
              return new Date(janFourth.getFullYear()-1, 11, 30);
          }
      };
  
      function getWeekBasedYear(date) {
          var thisDate = __addDays(new Date(date.tm_year+1900, 0, 1), date.tm_yday);
  
          var janFourthThisYear = new Date(thisDate.getFullYear(), 0, 4);
          var janFourthNextYear = new Date(thisDate.getFullYear()+1, 0, 4);
  
          var firstWeekStartThisYear = getFirstWeekStartDate(janFourthThisYear);
          var firstWeekStartNextYear = getFirstWeekStartDate(janFourthNextYear);
  
          if (compareByDay(firstWeekStartThisYear, thisDate) <= 0) {
            // this date is after the start of the first week of this year
            if (compareByDay(firstWeekStartNextYear, thisDate) <= 0) {
              return thisDate.getFullYear()+1;
            } else {
              return thisDate.getFullYear();
            }
          } else { 
            return thisDate.getFullYear()-1;
          }
      };
  
      var EXPANSION_RULES_2 = {
        '%a': function(date) {
          return WEEKDAYS[date.tm_wday].substring(0,3);
        },
        '%A': function(date) {
          return WEEKDAYS[date.tm_wday];
        },
        '%b': function(date) {
          return MONTHS[date.tm_mon].substring(0,3);
        },
        '%B': function(date) {
          return MONTHS[date.tm_mon];
        },
        '%C': function(date) {
          var year = date.tm_year+1900;
          return leadingNulls((year/100)|0,2);
        },
        '%d': function(date) {
          return leadingNulls(date.tm_mday, 2);
        },
        '%e': function(date) {
          return leadingSomething(date.tm_mday, 2, ' ');
        },
        '%g': function(date) {
          // %g, %G, and %V give values according to the ISO 8601:2000 standard week-based year. 
          // In this system, weeks begin on a Monday and week 1 of the year is the week that includes 
          // January 4th, which is also the week that includes the first Thursday of the year, and 
          // is also the first week that contains at least four days in the year. 
          // If the first Monday of January is the 2nd, 3rd, or 4th, the preceding days are part of 
          // the last week of the preceding year; thus, for Saturday 2nd January 1999, 
          // %G is replaced by 1998 and %V is replaced by 53. If December 29th, 30th, 
          // or 31st is a Monday, it and any following days are part of week 1 of the following year. 
          // Thus, for Tuesday 30th December 1997, %G is replaced by 1998 and %V is replaced by 01.
          
          return getWeekBasedYear(date).toString().substring(2);
        },
        '%G': function(date) {
          return getWeekBasedYear(date);
        },
        '%H': function(date) {
          return leadingNulls(date.tm_hour, 2);
        },
        '%I': function(date) {
          var twelveHour = date.tm_hour;
          if (twelveHour == 0) twelveHour = 12;
          else if (twelveHour > 12) twelveHour -= 12;
          return leadingNulls(twelveHour, 2);
        },
        '%j': function(date) {
          // Day of the year (001-366)
          return leadingNulls(date.tm_mday+__arraySum(__isLeapYear(date.tm_year+1900) ? __MONTH_DAYS_LEAP : __MONTH_DAYS_REGULAR, date.tm_mon-1), 3);
        },
        '%m': function(date) {
          return leadingNulls(date.tm_mon+1, 2);
        },
        '%M': function(date) {
          return leadingNulls(date.tm_min, 2);
        },
        '%n': function() {
          return '\n';
        },
        '%p': function(date) {
          if (date.tm_hour >= 0 && date.tm_hour < 12) {
            return 'AM';
          } else {
            return 'PM';
          }
        },
        '%S': function(date) {
          return leadingNulls(date.tm_sec, 2);
        },
        '%t': function() {
          return '\t';
        },
        '%u': function(date) {
          var day = new Date(date.tm_year+1900, date.tm_mon+1, date.tm_mday, 0, 0, 0, 0);
          return day.getDay() || 7;
        },
        '%U': function(date) {
          // Replaced by the week number of the year as a decimal number [00,53]. 
          // The first Sunday of January is the first day of week 1; 
          // days in the new year before this are in week 0. [ tm_year, tm_wday, tm_yday]
          var janFirst = new Date(date.tm_year+1900, 0, 1);
          var firstSunday = janFirst.getDay() === 0 ? janFirst : __addDays(janFirst, 7-janFirst.getDay());
          var endDate = new Date(date.tm_year+1900, date.tm_mon, date.tm_mday);
          
          // is target date after the first Sunday?
          if (compareByDay(firstSunday, endDate) < 0) {
            // calculate difference in days between first Sunday and endDate
            var februaryFirstUntilEndMonth = __arraySum(__isLeapYear(endDate.getFullYear()) ? __MONTH_DAYS_LEAP : __MONTH_DAYS_REGULAR, endDate.getMonth()-1)-31;
            var firstSundayUntilEndJanuary = 31-firstSunday.getDate();
            var days = firstSundayUntilEndJanuary+februaryFirstUntilEndMonth+endDate.getDate();
            return leadingNulls(Math.ceil(days/7), 2);
          }
  
          return compareByDay(firstSunday, janFirst) === 0 ? '01': '00';
        },
        '%V': function(date) {
          // Replaced by the week number of the year (Monday as the first day of the week) 
          // as a decimal number [01,53]. If the week containing 1 January has four 
          // or more days in the new year, then it is considered week 1. 
          // Otherwise, it is the last week of the previous year, and the next week is week 1. 
          // Both January 4th and the first Thursday of January are always in week 1. [ tm_year, tm_wday, tm_yday]
          var janFourthThisYear = new Date(date.tm_year+1900, 0, 4);
          var janFourthNextYear = new Date(date.tm_year+1901, 0, 4);
  
          var firstWeekStartThisYear = getFirstWeekStartDate(janFourthThisYear);
          var firstWeekStartNextYear = getFirstWeekStartDate(janFourthNextYear);
  
          var endDate = __addDays(new Date(date.tm_year+1900, 0, 1), date.tm_yday);
  
          if (compareByDay(endDate, firstWeekStartThisYear) < 0) {
            // if given date is before this years first week, then it belongs to the 53rd week of last year
            return '53';
          } 
  
          if (compareByDay(firstWeekStartNextYear, endDate) <= 0) {
            // if given date is after next years first week, then it belongs to the 01th week of next year
            return '01';
          }
  
          // given date is in between CW 01..53 of this calendar year
          var daysDifference;
          if (firstWeekStartThisYear.getFullYear() < date.tm_year+1900) {
            // first CW of this year starts last year
            daysDifference = date.tm_yday+32-firstWeekStartThisYear.getDate()
          } else {
            // first CW of this year starts this year
            daysDifference = date.tm_yday+1-firstWeekStartThisYear.getDate();
          }
          return leadingNulls(Math.ceil(daysDifference/7), 2);
        },
        '%w': function(date) {
          var day = new Date(date.tm_year+1900, date.tm_mon+1, date.tm_mday, 0, 0, 0, 0);
          return day.getDay();
        },
        '%W': function(date) {
          // Replaced by the week number of the year as a decimal number [00,53]. 
          // The first Monday of January is the first day of week 1; 
          // days in the new year before this are in week 0. [ tm_year, tm_wday, tm_yday]
          var janFirst = new Date(date.tm_year, 0, 1);
          var firstMonday = janFirst.getDay() === 1 ? janFirst : __addDays(janFirst, janFirst.getDay() === 0 ? 1 : 7-janFirst.getDay()+1);
          var endDate = new Date(date.tm_year+1900, date.tm_mon, date.tm_mday);
  
          // is target date after the first Monday?
          if (compareByDay(firstMonday, endDate) < 0) {
            var februaryFirstUntilEndMonth = __arraySum(__isLeapYear(endDate.getFullYear()) ? __MONTH_DAYS_LEAP : __MONTH_DAYS_REGULAR, endDate.getMonth()-1)-31;
            var firstMondayUntilEndJanuary = 31-firstMonday.getDate();
            var days = firstMondayUntilEndJanuary+februaryFirstUntilEndMonth+endDate.getDate();
            return leadingNulls(Math.ceil(days/7), 2);
          }
          return compareByDay(firstMonday, janFirst) === 0 ? '01': '00';
        },
        '%y': function(date) {
          // Replaced by the last two digits of the year as a decimal number [00,99]. [ tm_year]
          return (date.tm_year+1900).toString().substring(2);
        },
        '%Y': function(date) {
          // Replaced by the year as a decimal number (for example, 1997). [ tm_year]
          return date.tm_year+1900;
        },
        '%z': function(date) {
          // Replaced by the offset from UTC in the ISO 8601:2000 standard format ( +hhmm or -hhmm ).
          // For example, "-0430" means 4 hours 30 minutes behind UTC (west of Greenwich).
          var off = date.tm_gmtoff;
          var ahead = off >= 0;
          off = Math.abs(off) / 60;
          // convert from minutes into hhmm format (which means 60 minutes = 100 units)
          off = (off / 60)*100 + (off % 60);
          return (ahead ? '+' : '-') + String("0000" + off).slice(-4);
        },
        '%Z': function(date) {
          return date.tm_zone;
        },
        '%%': function() {
          return '%';
        }
      };
      for (var rule in EXPANSION_RULES_2) {
        if (pattern.indexOf(rule) >= 0) {
          pattern = pattern.replace(new RegExp(rule, 'g'), EXPANSION_RULES_2[rule](date));
        }
      }
  
      var bytes = intArrayFromString(pattern, false);
      if (bytes.length > maxsize) {
        return 0;
      } 
  
      writeArrayToMemory(bytes, s);
      return bytes.length-1;
    }function _strftime_l(s, maxsize, format, tm) {
      return _strftime(s, maxsize, format, tm); // no locale support yet
    }

  function _abort() {
      Module['abort']();
    }

  
  
  
  
  function _emscripten_set_main_loop_timing(mode, value) {
      Browser.mainLoop.timingMode = mode;
      Browser.mainLoop.timingValue = value;
  
      if (!Browser.mainLoop.func) {
        return 1; // Return non-zero on failure, can't set timing mode when there is no main loop.
      }
  
      if (mode == 0 /*EM_TIMING_SETTIMEOUT*/) {
        Browser.mainLoop.scheduler = function Browser_mainLoop_scheduler_setTimeout() {
          var timeUntilNextTick = Math.max(0, Browser.mainLoop.tickStartTime + value - _emscripten_get_now())|0;
          setTimeout(Browser.mainLoop.runner, timeUntilNextTick); // doing this each time means that on exception, we stop
        };
        Browser.mainLoop.method = 'timeout';
      } else if (mode == 1 /*EM_TIMING_RAF*/) {
        Browser.mainLoop.scheduler = function Browser_mainLoop_scheduler_rAF() {
          Browser.requestAnimationFrame(Browser.mainLoop.runner);
        };
        Browser.mainLoop.method = 'rAF';
      } else if (mode == 2 /*EM_TIMING_SETIMMEDIATE*/) {
        if (!window['setImmediate']) {
          // Emulate setImmediate. (note: not a complete polyfill, we don't emulate clearImmediate() to keep code size to minimum, since not needed)
          var setImmediates = [];
          var emscriptenMainLoopMessageId = '__emcc';
          function Browser_setImmediate_messageHandler(event) {
            if (event.source === window && event.data === emscriptenMainLoopMessageId) {
              event.stopPropagation();
              setImmediates.shift()();
            }
          }
          window.addEventListener("message", Browser_setImmediate_messageHandler, true);
          window['setImmediate'] = function Browser_emulated_setImmediate(func) {
            setImmediates.push(func);
            window.postMessage(emscriptenMainLoopMessageId, "*");
          }
        }
        Browser.mainLoop.scheduler = function Browser_mainLoop_scheduler_setImmediate() {
          window['setImmediate'](Browser.mainLoop.runner);
        };
        Browser.mainLoop.method = 'immediate';
      }
      return 0;
    }
  
  function _emscripten_get_now() { abort() }function _emscripten_set_main_loop(func, fps, simulateInfiniteLoop, arg, noSetTiming) {
      Module['noExitRuntime'] = true;
  
      assert(!Browser.mainLoop.func, 'emscripten_set_main_loop: there can only be one main loop function at once: call emscripten_cancel_main_loop to cancel the previous one before setting a new one with different parameters.');
  
      Browser.mainLoop.func = func;
      Browser.mainLoop.arg = arg;
  
      var browserIterationFunc;
      if (typeof arg !== 'undefined') {
        var argArray = [arg];
        browserIterationFunc = function() {
          Runtime.dynCall('vi', func, argArray);
        };
      } else {
        browserIterationFunc = function() {
          Runtime.dynCall('v', func);
        };
      }
  
      var thisMainLoopId = Browser.mainLoop.currentlyRunningMainloop;
  
      Browser.mainLoop.runner = function Browser_mainLoop_runner() {
        if (ABORT) return;
        if (Browser.mainLoop.queue.length > 0) {
          var start = Date.now();
          var blocker = Browser.mainLoop.queue.shift();
          blocker.func(blocker.arg);
          if (Browser.mainLoop.remainingBlockers) {
            var remaining = Browser.mainLoop.remainingBlockers;
            var next = remaining%1 == 0 ? remaining-1 : Math.floor(remaining);
            if (blocker.counted) {
              Browser.mainLoop.remainingBlockers = next;
            } else {
              // not counted, but move the progress along a tiny bit
              next = next + 0.5; // do not steal all the next one's progress
              Browser.mainLoop.remainingBlockers = (8*remaining + next)/9;
            }
          }
          console.log('main loop blocker "' + blocker.name + '" took ' + (Date.now() - start) + ' ms'); //, left: ' + Browser.mainLoop.remainingBlockers);
          Browser.mainLoop.updateStatus();
          
          // catches pause/resume main loop from blocker execution
          if (thisMainLoopId < Browser.mainLoop.currentlyRunningMainloop) return;
          
          setTimeout(Browser.mainLoop.runner, 0);
          return;
        }
  
        // catch pauses from non-main loop sources
        if (thisMainLoopId < Browser.mainLoop.currentlyRunningMainloop) return;
  
        // Implement very basic swap interval control
        Browser.mainLoop.currentFrameNumber = Browser.mainLoop.currentFrameNumber + 1 | 0;
        if (Browser.mainLoop.timingMode == 1/*EM_TIMING_RAF*/ && Browser.mainLoop.timingValue > 1 && Browser.mainLoop.currentFrameNumber % Browser.mainLoop.timingValue != 0) {
          // Not the scheduled time to render this frame - skip.
          Browser.mainLoop.scheduler();
          return;
        } else if (Browser.mainLoop.timingMode == 0/*EM_TIMING_SETTIMEOUT*/) {
          Browser.mainLoop.tickStartTime = _emscripten_get_now();
        }
  
        // Signal GL rendering layer that processing of a new frame is about to start. This helps it optimize
        // VBO double-buffering and reduce GPU stalls.
  
        if (Browser.mainLoop.method === 'timeout' && Module.ctx) {
          Module.printErr('Looks like you are rendering without using requestAnimationFrame for the main loop. You should use 0 for the frame rate in emscripten_set_main_loop in order to use requestAnimationFrame, as that can greatly improve your frame rates!');
          Browser.mainLoop.method = ''; // just warn once per call to set main loop
        }
  
        Browser.mainLoop.runIter(browserIterationFunc);
  
  
        // catch pauses from the main loop itself
        if (thisMainLoopId < Browser.mainLoop.currentlyRunningMainloop) return;
  
        // Queue new audio data. This is important to be right after the main loop invocation, so that we will immediately be able
        // to queue the newest produced audio samples.
        // TODO: Consider adding pre- and post- rAF callbacks so that GL.newRenderingFrameStarted() and SDL.audio.queueNewAudioData()
        //       do not need to be hardcoded into this function, but can be more generic.
        if (typeof SDL === 'object' && SDL.audio && SDL.audio.queueNewAudioData) SDL.audio.queueNewAudioData();
  
        Browser.mainLoop.scheduler();
      }
  
      if (!noSetTiming) {
        if (fps && fps > 0) _emscripten_set_main_loop_timing(0/*EM_TIMING_SETTIMEOUT*/, 1000.0 / fps);
        else _emscripten_set_main_loop_timing(1/*EM_TIMING_RAF*/, 1); // Do rAF by rendering each frame (no decimating)
  
        Browser.mainLoop.scheduler();
      }
  
      if (simulateInfiniteLoop) {
        throw 'SimulateInfiniteLoop';
      }
    }var Browser={mainLoop:{scheduler:null,method:"",currentlyRunningMainloop:0,func:null,arg:0,timingMode:0,timingValue:0,currentFrameNumber:0,queue:[],pause:function () {
          Browser.mainLoop.scheduler = null;
          Browser.mainLoop.currentlyRunningMainloop++; // Incrementing this signals the previous main loop that it's now become old, and it must return.
        },resume:function () {
          Browser.mainLoop.currentlyRunningMainloop++;
          var timingMode = Browser.mainLoop.timingMode;
          var timingValue = Browser.mainLoop.timingValue;
          var func = Browser.mainLoop.func;
          Browser.mainLoop.func = null;
          _emscripten_set_main_loop(func, 0, false, Browser.mainLoop.arg, true /* do not set timing and call scheduler, we will do it on the next lines */);
          _emscripten_set_main_loop_timing(timingMode, timingValue);
          Browser.mainLoop.scheduler();
        },updateStatus:function () {
          if (Module['setStatus']) {
            var message = Module['statusMessage'] || 'Please wait...';
            var remaining = Browser.mainLoop.remainingBlockers;
            var expected = Browser.mainLoop.expectedBlockers;
            if (remaining) {
              if (remaining < expected) {
                Module['setStatus'](message + ' (' + (expected - remaining) + '/' + expected + ')');
              } else {
                Module['setStatus'](message);
              }
            } else {
              Module['setStatus']('');
            }
          }
        },runIter:function (func) {
          if (ABORT) return;
          if (Module['preMainLoop']) {
            var preRet = Module['preMainLoop']();
            if (preRet === false) {
              return; // |return false| skips a frame
            }
          }
          try {
            func();
          } catch (e) {
            if (e instanceof ExitStatus) {
              return;
            } else {
              if (e && typeof e === 'object' && e.stack) Module.printErr('exception thrown: ' + [e, e.stack]);
              throw e;
            }
          }
          if (Module['postMainLoop']) Module['postMainLoop']();
        }},isFullscreen:false,pointerLock:false,moduleContextCreatedCallbacks:[],workers:[],init:function () {
        if (!Module["preloadPlugins"]) Module["preloadPlugins"] = []; // needs to exist even in workers
  
        if (Browser.initted) return;
        Browser.initted = true;
  
        try {
          new Blob();
          Browser.hasBlobConstructor = true;
        } catch(e) {
          Browser.hasBlobConstructor = false;
          console.log("warning: no blob constructor, cannot create blobs with mimetypes");
        }
        Browser.BlobBuilder = typeof MozBlobBuilder != "undefined" ? MozBlobBuilder : (typeof WebKitBlobBuilder != "undefined" ? WebKitBlobBuilder : (!Browser.hasBlobConstructor ? console.log("warning: no BlobBuilder") : null));
        Browser.URLObject = typeof window != "undefined" ? (window.URL ? window.URL : window.webkitURL) : undefined;
        if (!Module.noImageDecoding && typeof Browser.URLObject === 'undefined') {
          console.log("warning: Browser does not support creating object URLs. Built-in browser image decoding will not be available.");
          Module.noImageDecoding = true;
        }
  
        // Support for plugins that can process preloaded files. You can add more of these to
        // your app by creating and appending to Module.preloadPlugins.
        //
        // Each plugin is asked if it can handle a file based on the file's name. If it can,
        // it is given the file's raw data. When it is done, it calls a callback with the file's
        // (possibly modified) data. For example, a plugin might decompress a file, or it
        // might create some side data structure for use later (like an Image element, etc.).
  
        var imagePlugin = {};
        imagePlugin['canHandle'] = function imagePlugin_canHandle(name) {
          return !Module.noImageDecoding && /\.(jpg|jpeg|png|bmp)$/i.test(name);
        };
        imagePlugin['handle'] = function imagePlugin_handle(byteArray, name, onload, onerror) {
          var b = null;
          if (Browser.hasBlobConstructor) {
            try {
              b = new Blob([byteArray], { type: Browser.getMimetype(name) });
              if (b.size !== byteArray.length) { // Safari bug #118630
                // Safari's Blob can only take an ArrayBuffer
                b = new Blob([(new Uint8Array(byteArray)).buffer], { type: Browser.getMimetype(name) });
              }
            } catch(e) {
              Runtime.warnOnce('Blob constructor present but fails: ' + e + '; falling back to blob builder');
            }
          }
          if (!b) {
            var bb = new Browser.BlobBuilder();
            bb.append((new Uint8Array(byteArray)).buffer); // we need to pass a buffer, and must copy the array to get the right data range
            b = bb.getBlob();
          }
          var url = Browser.URLObject.createObjectURL(b);
          var img = new Image();
          img.onload = function img_onload() {
            assert(img.complete, 'Image ' + name + ' could not be decoded');
            var canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            var ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            Module["preloadedImages"][name] = canvas;
            Browser.URLObject.revokeObjectURL(url);
            if (onload) onload(byteArray);
          };
          img.onerror = function img_onerror(event) {
            console.log('Image ' + url + ' could not be decoded');
            if (onerror) onerror();
          };
          img.src = url;
        };
        Module['preloadPlugins'].push(imagePlugin);
  
        var audioPlugin = {};
        audioPlugin['canHandle'] = function audioPlugin_canHandle(name) {
          return !Module.noAudioDecoding && name.substr(-4) in { '.ogg': 1, '.wav': 1, '.mp3': 1 };
        };
        audioPlugin['handle'] = function audioPlugin_handle(byteArray, name, onload, onerror) {
          var done = false;
          function finish(audio) {
            if (done) return;
            done = true;
            Module["preloadedAudios"][name] = audio;
            if (onload) onload(byteArray);
          }
          function fail() {
            if (done) return;
            done = true;
            Module["preloadedAudios"][name] = new Audio(); // empty shim
            if (onerror) onerror();
          }
          if (Browser.hasBlobConstructor) {
            try {
              var b = new Blob([byteArray], { type: Browser.getMimetype(name) });
            } catch(e) {
              return fail();
            }
            var url = Browser.URLObject.createObjectURL(b); // XXX we never revoke this!
            var audio = new Audio();
            audio.addEventListener('canplaythrough', function() { finish(audio) }, false); // use addEventListener due to chromium bug 124926
            audio.onerror = function audio_onerror(event) {
              if (done) return;
              console.log('warning: browser could not fully decode audio ' + name + ', trying slower base64 approach');
              function encode64(data) {
                var BASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
                var PAD = '=';
                var ret = '';
                var leftchar = 0;
                var leftbits = 0;
                for (var i = 0; i < data.length; i++) {
                  leftchar = (leftchar << 8) | data[i];
                  leftbits += 8;
                  while (leftbits >= 6) {
                    var curr = (leftchar >> (leftbits-6)) & 0x3f;
                    leftbits -= 6;
                    ret += BASE[curr];
                  }
                }
                if (leftbits == 2) {
                  ret += BASE[(leftchar&3) << 4];
                  ret += PAD + PAD;
                } else if (leftbits == 4) {
                  ret += BASE[(leftchar&0xf) << 2];
                  ret += PAD;
                }
                return ret;
              }
              audio.src = 'data:audio/x-' + name.substr(-3) + ';base64,' + encode64(byteArray);
              finish(audio); // we don't wait for confirmation this worked - but it's worth trying
            };
            audio.src = url;
            // workaround for chrome bug 124926 - we do not always get oncanplaythrough or onerror
            Browser.safeSetTimeout(function() {
              finish(audio); // try to use it even though it is not necessarily ready to play
            }, 10000);
          } else {
            return fail();
          }
        };
        Module['preloadPlugins'].push(audioPlugin);
  
        // Canvas event setup
  
        var canvas = Module['canvas'];
        function pointerLockChange() {
          Browser.pointerLock = document['pointerLockElement'] === canvas ||
                                document['mozPointerLockElement'] === canvas ||
                                document['webkitPointerLockElement'] === canvas ||
                                document['msPointerLockElement'] === canvas;
        }
        if (canvas) {
          // forced aspect ratio can be enabled by defining 'forcedAspectRatio' on Module
          // Module['forcedAspectRatio'] = 4 / 3;
          
          canvas.requestPointerLock = canvas['requestPointerLock'] ||
                                      canvas['mozRequestPointerLock'] ||
                                      canvas['webkitRequestPointerLock'] ||
                                      canvas['msRequestPointerLock'] ||
                                      function(){};
          canvas.exitPointerLock = document['exitPointerLock'] ||
                                   document['mozExitPointerLock'] ||
                                   document['webkitExitPointerLock'] ||
                                   document['msExitPointerLock'] ||
                                   function(){}; // no-op if function does not exist
          canvas.exitPointerLock = canvas.exitPointerLock.bind(document);
  
  
          document.addEventListener('pointerlockchange', pointerLockChange, false);
          document.addEventListener('mozpointerlockchange', pointerLockChange, false);
          document.addEventListener('webkitpointerlockchange', pointerLockChange, false);
          document.addEventListener('mspointerlockchange', pointerLockChange, false);
  
          if (Module['elementPointerLock']) {
            canvas.addEventListener("click", function(ev) {
              if (!Browser.pointerLock && canvas.requestPointerLock) {
                canvas.requestPointerLock();
                ev.preventDefault();
              }
            }, false);
          }
        }
      },createContext:function (canvas, useWebGL, setInModule, webGLContextAttributes) {
        if (useWebGL && Module.ctx && canvas == Module.canvas) return Module.ctx; // no need to recreate GL context if it's already been created for this canvas.
  
        var ctx;
        var contextHandle;
        if (useWebGL) {
          // For GLES2/desktop GL compatibility, adjust a few defaults to be different to WebGL defaults, so that they align better with the desktop defaults.
          var contextAttributes = {
            antialias: false,
            alpha: false
          };
  
          if (webGLContextAttributes) {
            for (var attribute in webGLContextAttributes) {
              contextAttributes[attribute] = webGLContextAttributes[attribute];
            }
          }
  
          contextHandle = GL.createContext(canvas, contextAttributes);
          if (contextHandle) {
            ctx = GL.getContext(contextHandle).GLctx;
          }
        } else {
          ctx = canvas.getContext('2d');
        }
  
        if (!ctx) return null;
  
        if (setInModule) {
          if (!useWebGL) assert(typeof GLctx === 'undefined', 'cannot set in module if GLctx is used, but we are a non-GL context that would replace it');
  
          Module.ctx = ctx;
          if (useWebGL) GL.makeContextCurrent(contextHandle);
          Module.useWebGL = useWebGL;
          Browser.moduleContextCreatedCallbacks.forEach(function(callback) { callback() });
          Browser.init();
        }
        return ctx;
      },destroyContext:function (canvas, useWebGL, setInModule) {},fullscreenHandlersInstalled:false,lockPointer:undefined,resizeCanvas:undefined,requestFullscreen:function (lockPointer, resizeCanvas, vrDevice) {
        Browser.lockPointer = lockPointer;
        Browser.resizeCanvas = resizeCanvas;
        Browser.vrDevice = vrDevice;
        if (typeof Browser.lockPointer === 'undefined') Browser.lockPointer = true;
        if (typeof Browser.resizeCanvas === 'undefined') Browser.resizeCanvas = false;
        if (typeof Browser.vrDevice === 'undefined') Browser.vrDevice = null;
  
        var canvas = Module['canvas'];
        function fullscreenChange() {
          Browser.isFullscreen = false;
          var canvasContainer = canvas.parentNode;
          if ((document['fullscreenElement'] || document['mozFullScreenElement'] ||
               document['msFullscreenElement'] || document['webkitFullscreenElement'] ||
               document['webkitCurrentFullScreenElement']) === canvasContainer) {
            canvas.exitFullscreen = document['exitFullscreen'] ||
                                    document['cancelFullScreen'] ||
                                    document['mozCancelFullScreen'] ||
                                    document['msExitFullscreen'] ||
                                    document['webkitCancelFullScreen'] ||
                                    function() {};
            canvas.exitFullscreen = canvas.exitFullscreen.bind(document);
            if (Browser.lockPointer) canvas.requestPointerLock();
            Browser.isFullscreen = true;
            if (Browser.resizeCanvas) Browser.setFullscreenCanvasSize();
          } else {
            
            // remove the full screen specific parent of the canvas again to restore the HTML structure from before going full screen
            canvasContainer.parentNode.insertBefore(canvas, canvasContainer);
            canvasContainer.parentNode.removeChild(canvasContainer);
            
            if (Browser.resizeCanvas) Browser.setWindowedCanvasSize();
          }
          if (Module['onFullScreen']) Module['onFullScreen'](Browser.isFullscreen);
          if (Module['onFullscreen']) Module['onFullscreen'](Browser.isFullscreen);
          Browser.updateCanvasDimensions(canvas);
        }
  
        if (!Browser.fullscreenHandlersInstalled) {
          Browser.fullscreenHandlersInstalled = true;
          document.addEventListener('fullscreenchange', fullscreenChange, false);
          document.addEventListener('mozfullscreenchange', fullscreenChange, false);
          document.addEventListener('webkitfullscreenchange', fullscreenChange, false);
          document.addEventListener('MSFullscreenChange', fullscreenChange, false);
        }
  
        // create a new parent to ensure the canvas has no siblings. this allows browsers to optimize full screen performance when its parent is the full screen root
        var canvasContainer = document.createElement("div");
        canvas.parentNode.insertBefore(canvasContainer, canvas);
        canvasContainer.appendChild(canvas);
  
        // use parent of canvas as full screen root to allow aspect ratio correction (Firefox stretches the root to screen size)
        canvasContainer.requestFullscreen = canvasContainer['requestFullscreen'] ||
                                            canvasContainer['mozRequestFullScreen'] ||
                                            canvasContainer['msRequestFullscreen'] ||
                                           (canvasContainer['webkitRequestFullscreen'] ? function() { canvasContainer['webkitRequestFullscreen'](Element['ALLOW_KEYBOARD_INPUT']) } : null) ||
                                           (canvasContainer['webkitRequestFullScreen'] ? function() { canvasContainer['webkitRequestFullScreen'](Element['ALLOW_KEYBOARD_INPUT']) } : null);
  
        if (vrDevice) {
          canvasContainer.requestFullscreen({ vrDisplay: vrDevice });
        } else {
          canvasContainer.requestFullscreen();
        }
      },requestFullScreen:function (lockPointer, resizeCanvas, vrDevice) {
          Module.printErr('Browser.requestFullScreen() is deprecated. Please call Browser.requestFullscreen instead.');
          Browser.requestFullScreen = function(lockPointer, resizeCanvas, vrDevice) {
            return Browser.requestFullscreen(lockPointer, resizeCanvas, vrDevice);
          }
          return Browser.requestFullscreen(lockPointer, resizeCanvas, vrDevice);
      },nextRAF:0,fakeRequestAnimationFrame:function (func) {
        // try to keep 60fps between calls to here
        var now = Date.now();
        if (Browser.nextRAF === 0) {
          Browser.nextRAF = now + 1000/60;
        } else {
          while (now + 2 >= Browser.nextRAF) { // fudge a little, to avoid timer jitter causing us to do lots of delay:0
            Browser.nextRAF += 1000/60;
          }
        }
        var delay = Math.max(Browser.nextRAF - now, 0);
        setTimeout(func, delay);
      },requestAnimationFrame:function requestAnimationFrame(func) {
        if (typeof window === 'undefined') { // Provide fallback to setTimeout if window is undefined (e.g. in Node.js)
          Browser.fakeRequestAnimationFrame(func);
        } else {
          if (!window.requestAnimationFrame) {
            window.requestAnimationFrame = window['requestAnimationFrame'] ||
                                           window['mozRequestAnimationFrame'] ||
                                           window['webkitRequestAnimationFrame'] ||
                                           window['msRequestAnimationFrame'] ||
                                           window['oRequestAnimationFrame'] ||
                                           Browser.fakeRequestAnimationFrame;
          }
          window.requestAnimationFrame(func);
        }
      },safeCallback:function (func) {
        return function() {
          if (!ABORT) return func.apply(null, arguments);
        };
      },allowAsyncCallbacks:true,queuedAsyncCallbacks:[],pauseAsyncCallbacks:function () {
        Browser.allowAsyncCallbacks = false;
      },resumeAsyncCallbacks:function () { // marks future callbacks as ok to execute, and synchronously runs any remaining ones right now
        Browser.allowAsyncCallbacks = true;
        if (Browser.queuedAsyncCallbacks.length > 0) {
          var callbacks = Browser.queuedAsyncCallbacks;
          Browser.queuedAsyncCallbacks = [];
          callbacks.forEach(function(func) {
            func();
          });
        }
      },safeRequestAnimationFrame:function (func) {
        return Browser.requestAnimationFrame(function() {
          if (ABORT) return;
          if (Browser.allowAsyncCallbacks) {
            func();
          } else {
            Browser.queuedAsyncCallbacks.push(func);
          }
        });
      },safeSetTimeout:function (func, timeout) {
        Module['noExitRuntime'] = true;
        return setTimeout(function() {
          if (ABORT) return;
          if (Browser.allowAsyncCallbacks) {
            func();
          } else {
            Browser.queuedAsyncCallbacks.push(func);
          }
        }, timeout);
      },safeSetInterval:function (func, timeout) {
        Module['noExitRuntime'] = true;
        return setInterval(function() {
          if (ABORT) return;
          if (Browser.allowAsyncCallbacks) {
            func();
          } // drop it on the floor otherwise, next interval will kick in
        }, timeout);
      },getMimetype:function (name) {
        return {
          'jpg': 'image/jpeg',
          'jpeg': 'image/jpeg',
          'png': 'image/png',
          'bmp': 'image/bmp',
          'ogg': 'audio/ogg',
          'wav': 'audio/wav',
          'mp3': 'audio/mpeg'
        }[name.substr(name.lastIndexOf('.')+1)];
      },getUserMedia:function (func) {
        if(!window.getUserMedia) {
          window.getUserMedia = navigator['getUserMedia'] ||
                                navigator['mozGetUserMedia'];
        }
        window.getUserMedia(func);
      },getMovementX:function (event) {
        return event['movementX'] ||
               event['mozMovementX'] ||
               event['webkitMovementX'] ||
               0;
      },getMovementY:function (event) {
        return event['movementY'] ||
               event['mozMovementY'] ||
               event['webkitMovementY'] ||
               0;
      },getMouseWheelDelta:function (event) {
        var delta = 0;
        switch (event.type) {
          case 'DOMMouseScroll': 
            delta = event.detail;
            break;
          case 'mousewheel': 
            delta = event.wheelDelta;
            break;
          case 'wheel': 
            delta = event['deltaY'];
            break;
          default:
            throw 'unrecognized mouse wheel event: ' + event.type;
        }
        return delta;
      },mouseX:0,mouseY:0,mouseMovementX:0,mouseMovementY:0,touches:{},lastTouches:{},calculateMouseEvent:function (event) { // event should be mousemove, mousedown or mouseup
        if (Browser.pointerLock) {
          // When the pointer is locked, calculate the coordinates
          // based on the movement of the mouse.
          // Workaround for Firefox bug 764498
          if (event.type != 'mousemove' &&
              ('mozMovementX' in event)) {
            Browser.mouseMovementX = Browser.mouseMovementY = 0;
          } else {
            Browser.mouseMovementX = Browser.getMovementX(event);
            Browser.mouseMovementY = Browser.getMovementY(event);
          }
          
          // check if SDL is available
          if (typeof SDL != "undefined") {
          	Browser.mouseX = SDL.mouseX + Browser.mouseMovementX;
          	Browser.mouseY = SDL.mouseY + Browser.mouseMovementY;
          } else {
          	// just add the mouse delta to the current absolut mouse position
          	// FIXME: ideally this should be clamped against the canvas size and zero
          	Browser.mouseX += Browser.mouseMovementX;
          	Browser.mouseY += Browser.mouseMovementY;
          }        
        } else {
          // Otherwise, calculate the movement based on the changes
          // in the coordinates.
          var rect = Module["canvas"].getBoundingClientRect();
          var cw = Module["canvas"].width;
          var ch = Module["canvas"].height;
  
          // Neither .scrollX or .pageXOffset are defined in a spec, but
          // we prefer .scrollX because it is currently in a spec draft.
          // (see: http://www.w3.org/TR/2013/WD-cssom-view-20131217/)
          var scrollX = ((typeof window.scrollX !== 'undefined') ? window.scrollX : window.pageXOffset);
          var scrollY = ((typeof window.scrollY !== 'undefined') ? window.scrollY : window.pageYOffset);
  
          if (event.type === 'touchstart' || event.type === 'touchend' || event.type === 'touchmove') {
            var touch = event.touch;
            if (touch === undefined) {
              return; // the "touch" property is only defined in SDL
  
            }
            var adjustedX = touch.pageX - (scrollX + rect.left);
            var adjustedY = touch.pageY - (scrollY + rect.top);
  
            adjustedX = adjustedX * (cw / rect.width);
            adjustedY = adjustedY * (ch / rect.height);
  
            var coords = { x: adjustedX, y: adjustedY };
            
            if (event.type === 'touchstart') {
              Browser.lastTouches[touch.identifier] = coords;
              Browser.touches[touch.identifier] = coords;
            } else if (event.type === 'touchend' || event.type === 'touchmove') {
              var last = Browser.touches[touch.identifier];
              if (!last) last = coords;
              Browser.lastTouches[touch.identifier] = last;
              Browser.touches[touch.identifier] = coords;
            } 
            return;
          }
  
          var x = event.pageX - (scrollX + rect.left);
          var y = event.pageY - (scrollY + rect.top);
  
          // the canvas might be CSS-scaled compared to its backbuffer;
          // SDL-using content will want mouse coordinates in terms
          // of backbuffer units.
          x = x * (cw / rect.width);
          y = y * (ch / rect.height);
  
          Browser.mouseMovementX = x - Browser.mouseX;
          Browser.mouseMovementY = y - Browser.mouseY;
          Browser.mouseX = x;
          Browser.mouseY = y;
        }
      },asyncLoad:function (url, onload, onerror, noRunDep) {
        Module['readAsync'](url, function(arrayBuffer) {
          assert(arrayBuffer, 'Loading data file "' + url + '" failed (no arrayBuffer).');
          onload(new Uint8Array(arrayBuffer));
          if (!noRunDep) removeRunDependency('al ' + url);
        }, function(event) {
          if (onerror) {
            onerror();
          } else {
            throw 'Loading data file "' + url + '" failed.';
          }
        });
        if (!noRunDep) addRunDependency('al ' + url);
      },resizeListeners:[],updateResizeListeners:function () {
        var canvas = Module['canvas'];
        Browser.resizeListeners.forEach(function(listener) {
          listener(canvas.width, canvas.height);
        });
      },setCanvasSize:function (width, height, noUpdates) {
        var canvas = Module['canvas'];
        Browser.updateCanvasDimensions(canvas, width, height);
        if (!noUpdates) Browser.updateResizeListeners();
      },windowedWidth:0,windowedHeight:0,setFullscreenCanvasSize:function () {
        // check if SDL is available   
        if (typeof SDL != "undefined") {
        	var flags = HEAPU32[((SDL.screen+Runtime.QUANTUM_SIZE*0)>>2)];
        	flags = flags | 0x00800000; // set SDL_FULLSCREEN flag
        	HEAP32[((SDL.screen+Runtime.QUANTUM_SIZE*0)>>2)]=flags
        }
        Browser.updateResizeListeners();
      },setWindowedCanvasSize:function () {
        // check if SDL is available       
        if (typeof SDL != "undefined") {
        	var flags = HEAPU32[((SDL.screen+Runtime.QUANTUM_SIZE*0)>>2)];
        	flags = flags & ~0x00800000; // clear SDL_FULLSCREEN flag
        	HEAP32[((SDL.screen+Runtime.QUANTUM_SIZE*0)>>2)]=flags
        }
        Browser.updateResizeListeners();
      },updateCanvasDimensions:function (canvas, wNative, hNative) {
        if (wNative && hNative) {
          canvas.widthNative = wNative;
          canvas.heightNative = hNative;
        } else {
          wNative = canvas.widthNative;
          hNative = canvas.heightNative;
        }
        var w = wNative;
        var h = hNative;
        if (Module['forcedAspectRatio'] && Module['forcedAspectRatio'] > 0) {
          if (w/h < Module['forcedAspectRatio']) {
            w = Math.round(h * Module['forcedAspectRatio']);
          } else {
            h = Math.round(w / Module['forcedAspectRatio']);
          }
        }
        if (((document['fullscreenElement'] || document['mozFullScreenElement'] ||
             document['msFullscreenElement'] || document['webkitFullscreenElement'] ||
             document['webkitCurrentFullScreenElement']) === canvas.parentNode) && (typeof screen != 'undefined')) {
           var factor = Math.min(screen.width / w, screen.height / h);
           w = Math.round(w * factor);
           h = Math.round(h * factor);
        }
        if (Browser.resizeCanvas) {
          if (canvas.width  != w) canvas.width  = w;
          if (canvas.height != h) canvas.height = h;
          if (typeof canvas.style != 'undefined') {
            canvas.style.removeProperty( "width");
            canvas.style.removeProperty("height");
          }
        } else {
          if (canvas.width  != wNative) canvas.width  = wNative;
          if (canvas.height != hNative) canvas.height = hNative;
          if (typeof canvas.style != 'undefined') {
            if (w != wNative || h != hNative) {
              canvas.style.setProperty( "width", w + "px", "important");
              canvas.style.setProperty("height", h + "px", "important");
            } else {
              canvas.style.removeProperty( "width");
              canvas.style.removeProperty("height");
            }
          }
        }
      },wgetRequests:{},nextWgetRequestHandle:0,getNextWgetRequestHandle:function () {
        var handle = Browser.nextWgetRequestHandle;
        Browser.nextWgetRequestHandle++;
        return handle;
      }};var EmterpreterAsync={initted:false,state:0,saveStack:"",yieldCallbacks:[],postAsync:null,asyncFinalizers:[],ensureInit:function () {
        if (this.initted) return;
        this.initted = true;
      },setState:function (s) {
        this.ensureInit();
        this.state = s;
        asm.setAsyncState(s);
      },handle:function (doAsyncOp, yieldDuring) {
        Module['noExitRuntime'] = true;
        if (EmterpreterAsync.state === 0) {
          // save the stack we want to resume. this lets other code run in between
          // XXX this assumes that this stack top never ever leak! exceptions might violate that
          var stack = new Int32Array(HEAP32.subarray(EMTSTACKTOP>>2, asm.emtStackSave()>>2));
          var stacktop = asm.stackSave();
  
          var resumedCallbacksForYield = false;
          function resumeCallbacksForYield() {
            if (resumedCallbacksForYield) return;
            resumedCallbacksForYield = true;
            // allow async callbacks, and also make sure to call the specified yield callbacks. we must
            // do this when nothing is on the stack, i.e. after it unwound
            EmterpreterAsync.yieldCallbacks.forEach(function(func) {
              func();
            });
            Browser.resumeAsyncCallbacks(); // if we were paused (e.g. we are after a sleep), then since we are now yielding, it is safe to call callbacks
          }
  
          var callingDoAsyncOp = 1; // if resume is called synchronously - during the doAsyncOp - we must make it truly async, for consistency
  
          doAsyncOp(function resume(post) {
            if (callingDoAsyncOp) {
              assert(callingDoAsyncOp === 1); // avoid infinite recursion
              callingDoAsyncOp++;
              setTimeout(function() {
                resume(post);
              }, 0);
              return;
            }
  
            assert(EmterpreterAsync.state === 1 || EmterpreterAsync.state === 3);
            EmterpreterAsync.setState(3);
            if (yieldDuring) {
              resumeCallbacksForYield();
            }
            // copy the stack back in and resume
            HEAP32.set(stack, EMTSTACKTOP>>2);
            EmterpreterAsync.setState(2);
            // Resume the main loop
            if (Browser.mainLoop.func) {
              Browser.mainLoop.resume();
            }
            assert(!EmterpreterAsync.postAsync);
            EmterpreterAsync.postAsync = post || null;
            asm.emterpret(stack[0]); // pc of the first function, from which we can reconstruct the rest, is at position 0 on the stack
            if (!yieldDuring && EmterpreterAsync.state === 0) {
              // if we did *not* do another async operation, then we know that nothing is conceptually on the stack now, and we can re-allow async callbacks as well as run the queued ones right now
              Browser.resumeAsyncCallbacks();
            }
            if (EmterpreterAsync.state === 0) {
              EmterpreterAsync.asyncFinalizers.forEach(function(func) {
                func();
              });
              EmterpreterAsync.asyncFinalizers.length = 0;
            }
          });
  
          callingDoAsyncOp = 0;
  
          EmterpreterAsync.setState(1);
          // Pause the main loop, until we resume
          if (Browser.mainLoop.func) {
            Browser.mainLoop.pause();
          }
          if (yieldDuring) {
            // do this when we are not on the stack, i.e., the stack unwound. we might be too late, in which case we do it in resume()
            setTimeout(function() {
              resumeCallbacksForYield();
            }, 0);
          } else {
            Browser.pauseAsyncCallbacks();
          }
        } else {
          // nothing to do here, the stack was just recreated. reset the state.
          assert(EmterpreterAsync.state === 2);
          EmterpreterAsync.setState(0);
  
          if (EmterpreterAsync.postAsync) {
            var ret = EmterpreterAsync.postAsync();
            EmterpreterAsync.postAsync = null;
            return ret;
          }
        }
      }};function _emscripten_sleep(ms) {
      EmterpreterAsync.handle(function(resume) {
        setTimeout(function() {
          if (ABORT) return; // do this manually; we can't call into Browser.safeSetTimeout, because that is paused/resumed!
          resume();
        }, ms);
      });
    }

  function _pthread_once(ptr, func) {
      if (!_pthread_once.seen) _pthread_once.seen = {};
      if (ptr in _pthread_once.seen) return;
      Runtime.dynCall('v', func);
      _pthread_once.seen[ptr] = 1;
    }

  function ___lock() {}

  function ___unlock() {}

  
  var PTHREAD_SPECIFIC={};function _pthread_getspecific(key) {
      return PTHREAD_SPECIFIC[key] || 0;
    }

  var _llvm_fabs_f64=Math_abs;

   
  Module["_i64Add"] = _i64Add;

  
  var PTHREAD_SPECIFIC_NEXT_KEY=1;
  
  var ERRNO_CODES={EPERM:1,ENOENT:2,ESRCH:3,EINTR:4,EIO:5,ENXIO:6,E2BIG:7,ENOEXEC:8,EBADF:9,ECHILD:10,EAGAIN:11,EWOULDBLOCK:11,ENOMEM:12,EACCES:13,EFAULT:14,ENOTBLK:15,EBUSY:16,EEXIST:17,EXDEV:18,ENODEV:19,ENOTDIR:20,EISDIR:21,EINVAL:22,ENFILE:23,EMFILE:24,ENOTTY:25,ETXTBSY:26,EFBIG:27,ENOSPC:28,ESPIPE:29,EROFS:30,EMLINK:31,EPIPE:32,EDOM:33,ERANGE:34,ENOMSG:42,EIDRM:43,ECHRNG:44,EL2NSYNC:45,EL3HLT:46,EL3RST:47,ELNRNG:48,EUNATCH:49,ENOCSI:50,EL2HLT:51,EDEADLK:35,ENOLCK:37,EBADE:52,EBADR:53,EXFULL:54,ENOANO:55,EBADRQC:56,EBADSLT:57,EDEADLOCK:35,EBFONT:59,ENOSTR:60,ENODATA:61,ETIME:62,ENOSR:63,ENONET:64,ENOPKG:65,EREMOTE:66,ENOLINK:67,EADV:68,ESRMNT:69,ECOMM:70,EPROTO:71,EMULTIHOP:72,EDOTDOT:73,EBADMSG:74,ENOTUNIQ:76,EBADFD:77,EREMCHG:78,ELIBACC:79,ELIBBAD:80,ELIBSCN:81,ELIBMAX:82,ELIBEXEC:83,ENOSYS:38,ENOTEMPTY:39,ENAMETOOLONG:36,ELOOP:40,EOPNOTSUPP:95,EPFNOSUPPORT:96,ECONNRESET:104,ENOBUFS:105,EAFNOSUPPORT:97,EPROTOTYPE:91,ENOTSOCK:88,ENOPROTOOPT:92,ESHUTDOWN:108,ECONNREFUSED:111,EADDRINUSE:98,ECONNABORTED:103,ENETUNREACH:101,ENETDOWN:100,ETIMEDOUT:110,EHOSTDOWN:112,EHOSTUNREACH:113,EINPROGRESS:115,EALREADY:114,EDESTADDRREQ:89,EMSGSIZE:90,EPROTONOSUPPORT:93,ESOCKTNOSUPPORT:94,EADDRNOTAVAIL:99,ENETRESET:102,EISCONN:106,ENOTCONN:107,ETOOMANYREFS:109,EUSERS:87,EDQUOT:122,ESTALE:116,ENOTSUP:95,ENOMEDIUM:123,EILSEQ:84,EOVERFLOW:75,ECANCELED:125,ENOTRECOVERABLE:131,EOWNERDEAD:130,ESTRPIPE:86};function _pthread_key_create(key, destructor) {
      if (key == 0) {
        return ERRNO_CODES.EINVAL;
      }
      HEAP32[((key)>>2)]=PTHREAD_SPECIFIC_NEXT_KEY;
      // values start at 0
      PTHREAD_SPECIFIC[PTHREAD_SPECIFIC_NEXT_KEY] = 0;
      PTHREAD_SPECIFIC_NEXT_KEY++;
      return 0;
    }

  
  function ___setErrNo(value) {
      if (Module['___errno_location']) HEAP32[((Module['___errno_location']())>>2)]=value;
      return value;
    }function _system(command) {
      // int system(const char *command);
      // http://pubs.opengroup.org/onlinepubs/000095399/functions/system.html
      // Can't call external programs.
      ___setErrNo(ERRNO_CODES.EAGAIN);
      return -1;
    }

  function _nativeCallFloat()
  	{
  		return NATIVE.callNative(Citizen.resultAsFloat());
  	}

  function _nativePushPtr(type, ptr)
  	{
  		nativeState.arguments.push(
  		{
  			type: 'ptr',
  			ptrType: type,
  			ptr: ptr
  		});
  	}

  function _pthread_setspecific(key, value) {
      if (!(key in PTHREAD_SPECIFIC)) {
        return ERRNO_CODES.EINVAL;
      }
      PTHREAD_SPECIFIC[key] = value;
      return 0;
    }

  
  function _malloc(bytes) {
      /* Over-allocate to make sure it is byte-aligned by 8.
       * This will leak memory, but this is only the dummy
       * implementation (replaced by dlmalloc normally) so
       * not an issue.
       */
      var ptr = Runtime.dynamicAlloc(bytes + 8);
      return (ptr+8) & 0xFFFFFFF8;
    }
  Module["_malloc"] = _malloc;function ___cxa_allocate_exception(size) {
      return _malloc(size);
    }

  
  function __ZSt18uncaught_exceptionv() { // std::uncaught_exception()
      return !!__ZSt18uncaught_exceptionv.uncaught_exception;
    }
  
  
  
  var EXCEPTIONS={last:0,caught:[],infos:{},deAdjust:function (adjusted) {
        if (!adjusted || EXCEPTIONS.infos[adjusted]) return adjusted;
        for (var ptr in EXCEPTIONS.infos) {
          var info = EXCEPTIONS.infos[ptr];
          if (info.adjusted === adjusted) {
            return ptr;
          }
        }
        return adjusted;
      },addRef:function (ptr) {
        if (!ptr) return;
        var info = EXCEPTIONS.infos[ptr];
        info.refcount++;
      },decRef:function (ptr) {
        if (!ptr) return;
        var info = EXCEPTIONS.infos[ptr];
        assert(info.refcount > 0);
        info.refcount--;
        if (info.refcount === 0) {
          if (info.destructor) {
            Runtime.dynCall('vi', info.destructor, [ptr]);
          }
          delete EXCEPTIONS.infos[ptr];
          ___cxa_free_exception(ptr);
        }
      },clearRef:function (ptr) {
        if (!ptr) return;
        var info = EXCEPTIONS.infos[ptr];
        info.refcount = 0;
      }};
  function ___resumeException(ptr) {
      if (!EXCEPTIONS.last) { EXCEPTIONS.last = ptr; }
      EXCEPTIONS.clearRef(EXCEPTIONS.deAdjust(ptr)); // exception refcount should be cleared, but don't free it
      throw ptr + " - Exception catching is disabled, this exception cannot be caught. Compile with -s DISABLE_EXCEPTION_CATCHING=0 or DISABLE_EXCEPTION_CATCHING=2 to catch.";
    }function ___cxa_find_matching_catch() {
      var thrown = EXCEPTIONS.last;
      if (!thrown) {
        // just pass through the null ptr
        return ((asm["setTempRet0"](0),0)|0);
      }
      var info = EXCEPTIONS.infos[thrown];
      var throwntype = info.type;
      if (!throwntype) {
        // just pass through the thrown ptr
        return ((asm["setTempRet0"](0),thrown)|0);
      }
      var typeArray = Array.prototype.slice.call(arguments);
  
      var pointer = Module['___cxa_is_pointer_type'](throwntype);
      // can_catch receives a **, add indirection
      if (!___cxa_find_matching_catch.buffer) ___cxa_find_matching_catch.buffer = _malloc(4);
      HEAP32[((___cxa_find_matching_catch.buffer)>>2)]=thrown;
      thrown = ___cxa_find_matching_catch.buffer;
      // The different catch blocks are denoted by different types.
      // Due to inheritance, those types may not precisely match the
      // type of the thrown object. Find one which matches, and
      // return the type of the catch block which should be called.
      for (var i = 0; i < typeArray.length; i++) {
        if (typeArray[i] && Module['___cxa_can_catch'](typeArray[i], throwntype, thrown)) {
          thrown = HEAP32[((thrown)>>2)]; // undo indirection
          info.adjusted = thrown;
          return ((asm["setTempRet0"](typeArray[i]),thrown)|0);
        }
      }
      // Shouldn't happen unless we have bogus data in typeArray
      // or encounter a type for which emscripten doesn't have suitable
      // typeinfo defined. Best-efforts match just in case.
      thrown = HEAP32[((thrown)>>2)]; // undo indirection
      return ((asm["setTempRet0"](throwntype),thrown)|0);
    }function ___cxa_throw(ptr, type, destructor) {
      EXCEPTIONS.infos[ptr] = {
        ptr: ptr,
        adjusted: ptr,
        type: type,
        destructor: destructor,
        refcount: 0
      };
      EXCEPTIONS.last = ptr;
      if (!("uncaught_exception" in __ZSt18uncaught_exceptionv)) {
        __ZSt18uncaught_exceptionv.uncaught_exception = 1;
      } else {
        __ZSt18uncaught_exceptionv.uncaught_exception++;
      }
      throw ptr + " - Exception catching is disabled, this exception cannot be caught. Compile with -s DISABLE_EXCEPTION_CATCHING=0 or DISABLE_EXCEPTION_CATCHING=2 to catch.";
    }

   
  Module["_bitshift64Lshr"] = _bitshift64Lshr;

  
  
  var cttz_i8 = allocate([8,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,5,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,6,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,5,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,7,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,5,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,6,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,5,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0], "i8", ALLOC_STATIC); 
  Module["_llvm_cttz_i32"] = _llvm_cttz_i32; 
  Module["___udivmoddi4"] = ___udivmoddi4; 
  Module["___udivdi3"] = ___udivdi3;

  function _pthread_cleanup_push(routine, arg) {
      __ATEXIT__.push(function() { Runtime.dynCall('vi', routine, [arg]) })
      _pthread_cleanup_push.level = __ATEXIT__.length;
    }

  
  
  
  var ERRNO_MESSAGES={0:"Success",1:"Not super-user",2:"No such file or directory",3:"No such process",4:"Interrupted system call",5:"I/O error",6:"No such device or address",7:"Arg list too long",8:"Exec format error",9:"Bad file number",10:"No children",11:"No more processes",12:"Not enough core",13:"Permission denied",14:"Bad address",15:"Block device required",16:"Mount device busy",17:"File exists",18:"Cross-device link",19:"No such device",20:"Not a directory",21:"Is a directory",22:"Invalid argument",23:"Too many open files in system",24:"Too many open files",25:"Not a typewriter",26:"Text file busy",27:"File too large",28:"No space left on device",29:"Illegal seek",30:"Read only file system",31:"Too many links",32:"Broken pipe",33:"Math arg out of domain of func",34:"Math result not representable",35:"File locking deadlock error",36:"File or path name too long",37:"No record locks available",38:"Function not implemented",39:"Directory not empty",40:"Too many symbolic links",42:"No message of desired type",43:"Identifier removed",44:"Channel number out of range",45:"Level 2 not synchronized",46:"Level 3 halted",47:"Level 3 reset",48:"Link number out of range",49:"Protocol driver not attached",50:"No CSI structure available",51:"Level 2 halted",52:"Invalid exchange",53:"Invalid request descriptor",54:"Exchange full",55:"No anode",56:"Invalid request code",57:"Invalid slot",59:"Bad font file fmt",60:"Device not a stream",61:"No data (for no delay io)",62:"Timer expired",63:"Out of streams resources",64:"Machine is not on the network",65:"Package not installed",66:"The object is remote",67:"The link has been severed",68:"Advertise error",69:"Srmount error",70:"Communication error on send",71:"Protocol error",72:"Multihop attempted",73:"Cross mount point (not really error)",74:"Trying to read unreadable message",75:"Value too large for defined data type",76:"Given log. name not unique",77:"f.d. invalid for this operation",78:"Remote address changed",79:"Can   access a needed shared lib",80:"Accessing a corrupted shared lib",81:".lib section in a.out corrupted",82:"Attempting to link in too many libs",83:"Attempting to exec a shared library",84:"Illegal byte sequence",86:"Streams pipe error",87:"Too many users",88:"Socket operation on non-socket",89:"Destination address required",90:"Message too long",91:"Protocol wrong type for socket",92:"Protocol not available",93:"Unknown protocol",94:"Socket type not supported",95:"Not supported",96:"Protocol family not supported",97:"Address family not supported by protocol family",98:"Address already in use",99:"Address not available",100:"Network interface is not configured",101:"Network is unreachable",102:"Connection reset by network",103:"Connection aborted",104:"Connection reset by peer",105:"No buffer space available",106:"Socket is already connected",107:"Socket is not connected",108:"Can't send after socket shutdown",109:"Too many references",110:"Connection timed out",111:"Connection refused",112:"Host is down",113:"Host is unreachable",114:"Socket already connected",115:"Connection already in progress",116:"Stale file handle",122:"Quota exceeded",123:"No medium (in tape drive)",125:"Operation canceled",130:"Previous owner died",131:"State not recoverable"};
  
  var PATH={splitPath:function (filename) {
        var splitPathRe = /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
        return splitPathRe.exec(filename).slice(1);
      },normalizeArray:function (parts, allowAboveRoot) {
        // if the path tries to go above the root, `up` ends up > 0
        var up = 0;
        for (var i = parts.length - 1; i >= 0; i--) {
          var last = parts[i];
          if (last === '.') {
            parts.splice(i, 1);
          } else if (last === '..') {
            parts.splice(i, 1);
            up++;
          } else if (up) {
            parts.splice(i, 1);
            up--;
          }
        }
        // if the path is allowed to go above the root, restore leading ..s
        if (allowAboveRoot) {
          for (; up--; up) {
            parts.unshift('..');
          }
        }
        return parts;
      },normalize:function (path) {
        var isAbsolute = path.charAt(0) === '/',
            trailingSlash = path.substr(-1) === '/';
        // Normalize the path
        path = PATH.normalizeArray(path.split('/').filter(function(p) {
          return !!p;
        }), !isAbsolute).join('/');
        if (!path && !isAbsolute) {
          path = '.';
        }
        if (path && trailingSlash) {
          path += '/';
        }
        return (isAbsolute ? '/' : '') + path;
      },dirname:function (path) {
        var result = PATH.splitPath(path),
            root = result[0],
            dir = result[1];
        if (!root && !dir) {
          // No dirname whatsoever
          return '.';
        }
        if (dir) {
          // It has a dirname, strip trailing slash
          dir = dir.substr(0, dir.length - 1);
        }
        return root + dir;
      },basename:function (path) {
        // EMSCRIPTEN return '/'' for '/', not an empty string
        if (path === '/') return '/';
        var lastSlash = path.lastIndexOf('/');
        if (lastSlash === -1) return path;
        return path.substr(lastSlash+1);
      },extname:function (path) {
        return PATH.splitPath(path)[3];
      },join:function () {
        var paths = Array.prototype.slice.call(arguments, 0);
        return PATH.normalize(paths.join('/'));
      },join2:function (l, r) {
        return PATH.normalize(l + '/' + r);
      },resolve:function () {
        var resolvedPath = '',
          resolvedAbsolute = false;
        for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
          var path = (i >= 0) ? arguments[i] : FS.cwd();
          // Skip empty and invalid entries
          if (typeof path !== 'string') {
            throw new TypeError('Arguments to path.resolve must be strings');
          } else if (!path) {
            return ''; // an invalid portion invalidates the whole thing
          }
          resolvedPath = path + '/' + resolvedPath;
          resolvedAbsolute = path.charAt(0) === '/';
        }
        // At this point the path should be resolved to a full absolute path, but
        // handle relative paths to be safe (might happen when process.cwd() fails)
        resolvedPath = PATH.normalizeArray(resolvedPath.split('/').filter(function(p) {
          return !!p;
        }), !resolvedAbsolute).join('/');
        return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
      },relative:function (from, to) {
        from = PATH.resolve(from).substr(1);
        to = PATH.resolve(to).substr(1);
        function trim(arr) {
          var start = 0;
          for (; start < arr.length; start++) {
            if (arr[start] !== '') break;
          }
          var end = arr.length - 1;
          for (; end >= 0; end--) {
            if (arr[end] !== '') break;
          }
          if (start > end) return [];
          return arr.slice(start, end - start + 1);
        }
        var fromParts = trim(from.split('/'));
        var toParts = trim(to.split('/'));
        var length = Math.min(fromParts.length, toParts.length);
        var samePartsLength = length;
        for (var i = 0; i < length; i++) {
          if (fromParts[i] !== toParts[i]) {
            samePartsLength = i;
            break;
          }
        }
        var outputParts = [];
        for (var i = samePartsLength; i < fromParts.length; i++) {
          outputParts.push('..');
        }
        outputParts = outputParts.concat(toParts.slice(samePartsLength));
        return outputParts.join('/');
      }};
  
  var TTY={ttys:[],init:function () {
        // https://github.com/kripken/emscripten/pull/1555
        // if (ENVIRONMENT_IS_NODE) {
        //   // currently, FS.init does not distinguish if process.stdin is a file or TTY
        //   // device, it always assumes it's a TTY device. because of this, we're forcing
        //   // process.stdin to UTF8 encoding to at least make stdin reading compatible
        //   // with text files until FS.init can be refactored.
        //   process['stdin']['setEncoding']('utf8');
        // }
      },shutdown:function () {
        // https://github.com/kripken/emscripten/pull/1555
        // if (ENVIRONMENT_IS_NODE) {
        //   // inolen: any idea as to why node -e 'process.stdin.read()' wouldn't exit immediately (with process.stdin being a tty)?
        //   // isaacs: because now it's reading from the stream, you've expressed interest in it, so that read() kicks off a _read() which creates a ReadReq operation
        //   // inolen: I thought read() in that case was a synchronous operation that just grabbed some amount of buffered data if it exists?
        //   // isaacs: it is. but it also triggers a _read() call, which calls readStart() on the handle
        //   // isaacs: do process.stdin.pause() and i'd think it'd probably close the pending call
        //   process['stdin']['pause']();
        // }
      },register:function (dev, ops) {
        TTY.ttys[dev] = { input: [], output: [], ops: ops };
        FS.registerDevice(dev, TTY.stream_ops);
      },stream_ops:{open:function (stream) {
          var tty = TTY.ttys[stream.node.rdev];
          if (!tty) {
            throw new FS.ErrnoError(ERRNO_CODES.ENODEV);
          }
          stream.tty = tty;
          stream.seekable = false;
        },close:function (stream) {
          // flush any pending line data
          stream.tty.ops.flush(stream.tty);
        },flush:function (stream) {
          stream.tty.ops.flush(stream.tty);
        },read:function (stream, buffer, offset, length, pos /* ignored */) {
          if (!stream.tty || !stream.tty.ops.get_char) {
            throw new FS.ErrnoError(ERRNO_CODES.ENXIO);
          }
          var bytesRead = 0;
          for (var i = 0; i < length; i++) {
            var result;
            try {
              result = stream.tty.ops.get_char(stream.tty);
            } catch (e) {
              throw new FS.ErrnoError(ERRNO_CODES.EIO);
            }
            if (result === undefined && bytesRead === 0) {
              throw new FS.ErrnoError(ERRNO_CODES.EAGAIN);
            }
            if (result === null || result === undefined) break;
            bytesRead++;
            buffer[offset+i] = result;
          }
          if (bytesRead) {
            stream.node.timestamp = Date.now();
          }
          return bytesRead;
        },write:function (stream, buffer, offset, length, pos) {
          if (!stream.tty || !stream.tty.ops.put_char) {
            throw new FS.ErrnoError(ERRNO_CODES.ENXIO);
          }
          for (var i = 0; i < length; i++) {
            try {
              stream.tty.ops.put_char(stream.tty, buffer[offset+i]);
            } catch (e) {
              throw new FS.ErrnoError(ERRNO_CODES.EIO);
            }
          }
          if (length) {
            stream.node.timestamp = Date.now();
          }
          return i;
        }},default_tty_ops:{get_char:function (tty) {
          if (!tty.input.length) {
            var result = null;
            if (ENVIRONMENT_IS_NODE) {
              // we will read data by chunks of BUFSIZE
              var BUFSIZE = 256;
              var buf = new Buffer(BUFSIZE);
              var bytesRead = 0;
  
              var fd = process.stdin.fd;
              // Linux and Mac cannot use process.stdin.fd (which isn't set up as sync)
              var usingDevice = false;
              try {
                fd = fs.openSync('/dev/stdin', 'r');
                usingDevice = true;
              } catch (e) {}
  
              bytesRead = fs.readSync(fd, buf, 0, BUFSIZE, null);
  
              if (usingDevice) { fs.closeSync(fd); }
              if (bytesRead > 0) {
                result = buf.slice(0, bytesRead).toString('utf-8');
              } else {
                result = null;
              }
  
            } else if (typeof window != 'undefined' &&
              typeof window.prompt == 'function') {
              // Browser.
              result = window.prompt('Input: ');  // returns null on cancel
              if (result !== null) {
                result += '\n';
              }
            } else if (typeof readline == 'function') {
              // Command line.
              result = readline();
              if (result !== null) {
                result += '\n';
              }
            }
            if (!result) {
              return null;
            }
            tty.input = intArrayFromString(result, true);
          }
          return tty.input.shift();
        },put_char:function (tty, val) {
          if (val === null || val === 10) {
            Module['print'](UTF8ArrayToString(tty.output, 0));
            tty.output = [];
          } else {
            if (val != 0) tty.output.push(val); // val == 0 would cut text output off in the middle.
          }
        },flush:function (tty) {
          if (tty.output && tty.output.length > 0) {
            Module['print'](UTF8ArrayToString(tty.output, 0));
            tty.output = [];
          }
        }},default_tty1_ops:{put_char:function (tty, val) {
          if (val === null || val === 10) {
            Module['printErr'](UTF8ArrayToString(tty.output, 0));
            tty.output = [];
          } else {
            if (val != 0) tty.output.push(val);
          }
        },flush:function (tty) {
          if (tty.output && tty.output.length > 0) {
            Module['printErr'](UTF8ArrayToString(tty.output, 0));
            tty.output = [];
          }
        }}};
  
  var MEMFS={ops_table:null,mount:function (mount) {
        return MEMFS.createNode(null, '/', 16384 | 511 /* 0777 */, 0);
      },createNode:function (parent, name, mode, dev) {
        if (FS.isBlkdev(mode) || FS.isFIFO(mode)) {
          // no supported
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        }
        if (!MEMFS.ops_table) {
          MEMFS.ops_table = {
            dir: {
              node: {
                getattr: MEMFS.node_ops.getattr,
                setattr: MEMFS.node_ops.setattr,
                lookup: MEMFS.node_ops.lookup,
                mknod: MEMFS.node_ops.mknod,
                rename: MEMFS.node_ops.rename,
                unlink: MEMFS.node_ops.unlink,
                rmdir: MEMFS.node_ops.rmdir,
                readdir: MEMFS.node_ops.readdir,
                symlink: MEMFS.node_ops.symlink
              },
              stream: {
                llseek: MEMFS.stream_ops.llseek
              }
            },
            file: {
              node: {
                getattr: MEMFS.node_ops.getattr,
                setattr: MEMFS.node_ops.setattr
              },
              stream: {
                llseek: MEMFS.stream_ops.llseek,
                read: MEMFS.stream_ops.read,
                write: MEMFS.stream_ops.write,
                allocate: MEMFS.stream_ops.allocate,
                mmap: MEMFS.stream_ops.mmap,
                msync: MEMFS.stream_ops.msync
              }
            },
            link: {
              node: {
                getattr: MEMFS.node_ops.getattr,
                setattr: MEMFS.node_ops.setattr,
                readlink: MEMFS.node_ops.readlink
              },
              stream: {}
            },
            chrdev: {
              node: {
                getattr: MEMFS.node_ops.getattr,
                setattr: MEMFS.node_ops.setattr
              },
              stream: FS.chrdev_stream_ops
            }
          };
        }
        var node = FS.createNode(parent, name, mode, dev);
        if (FS.isDir(node.mode)) {
          node.node_ops = MEMFS.ops_table.dir.node;
          node.stream_ops = MEMFS.ops_table.dir.stream;
          node.contents = {};
        } else if (FS.isFile(node.mode)) {
          node.node_ops = MEMFS.ops_table.file.node;
          node.stream_ops = MEMFS.ops_table.file.stream;
          node.usedBytes = 0; // The actual number of bytes used in the typed array, as opposed to contents.buffer.byteLength which gives the whole capacity.
          // When the byte data of the file is populated, this will point to either a typed array, or a normal JS array. Typed arrays are preferred
          // for performance, and used by default. However, typed arrays are not resizable like normal JS arrays are, so there is a small disk size
          // penalty involved for appending file writes that continuously grow a file similar to std::vector capacity vs used -scheme.
          node.contents = null; 
        } else if (FS.isLink(node.mode)) {
          node.node_ops = MEMFS.ops_table.link.node;
          node.stream_ops = MEMFS.ops_table.link.stream;
        } else if (FS.isChrdev(node.mode)) {
          node.node_ops = MEMFS.ops_table.chrdev.node;
          node.stream_ops = MEMFS.ops_table.chrdev.stream;
        }
        node.timestamp = Date.now();
        // add the new node to the parent
        if (parent) {
          parent.contents[name] = node;
        }
        return node;
      },getFileDataAsRegularArray:function (node) {
        if (node.contents && node.contents.subarray) {
          var arr = [];
          for (var i = 0; i < node.usedBytes; ++i) arr.push(node.contents[i]);
          return arr; // Returns a copy of the original data.
        }
        return node.contents; // No-op, the file contents are already in a JS array. Return as-is.
      },getFileDataAsTypedArray:function (node) {
        if (!node.contents) return new Uint8Array;
        if (node.contents.subarray) return node.contents.subarray(0, node.usedBytes); // Make sure to not return excess unused bytes.
        return new Uint8Array(node.contents);
      },expandFileStorage:function (node, newCapacity) {
        // If we are asked to expand the size of a file that already exists, revert to using a standard JS array to store the file
        // instead of a typed array. This makes resizing the array more flexible because we can just .push() elements at the back to
        // increase the size.
        if (node.contents && node.contents.subarray && newCapacity > node.contents.length) {
          node.contents = MEMFS.getFileDataAsRegularArray(node);
          node.usedBytes = node.contents.length; // We might be writing to a lazy-loaded file which had overridden this property, so force-reset it.
        }
  
        if (!node.contents || node.contents.subarray) { // Keep using a typed array if creating a new storage, or if old one was a typed array as well.
          var prevCapacity = node.contents ? node.contents.buffer.byteLength : 0;
          if (prevCapacity >= newCapacity) return; // No need to expand, the storage was already large enough.
          // Don't expand strictly to the given requested limit if it's only a very small increase, but instead geometrically grow capacity.
          // For small filesizes (<1MB), perform size*2 geometric increase, but for large sizes, do a much more conservative size*1.125 increase to
          // avoid overshooting the allocation cap by a very large margin.
          var CAPACITY_DOUBLING_MAX = 1024 * 1024;
          newCapacity = Math.max(newCapacity, (prevCapacity * (prevCapacity < CAPACITY_DOUBLING_MAX ? 2.0 : 1.125)) | 0);
          if (prevCapacity != 0) newCapacity = Math.max(newCapacity, 256); // At minimum allocate 256b for each file when expanding.
          var oldContents = node.contents;
          node.contents = new Uint8Array(newCapacity); // Allocate new storage.
          if (node.usedBytes > 0) node.contents.set(oldContents.subarray(0, node.usedBytes), 0); // Copy old data over to the new storage.
          return;
        }
        // Not using a typed array to back the file storage. Use a standard JS array instead.
        if (!node.contents && newCapacity > 0) node.contents = [];
        while (node.contents.length < newCapacity) node.contents.push(0);
      },resizeFileStorage:function (node, newSize) {
        if (node.usedBytes == newSize) return;
        if (newSize == 0) {
          node.contents = null; // Fully decommit when requesting a resize to zero.
          node.usedBytes = 0;
          return;
        }
        if (!node.contents || node.contents.subarray) { // Resize a typed array if that is being used as the backing store.
          var oldContents = node.contents;
          node.contents = new Uint8Array(new ArrayBuffer(newSize)); // Allocate new storage.
          if (oldContents) {
            node.contents.set(oldContents.subarray(0, Math.min(newSize, node.usedBytes))); // Copy old data over to the new storage.
          }
          node.usedBytes = newSize;
          return;
        }
        // Backing with a JS array.
        if (!node.contents) node.contents = [];
        if (node.contents.length > newSize) node.contents.length = newSize;
        else while (node.contents.length < newSize) node.contents.push(0);
        node.usedBytes = newSize;
      },node_ops:{getattr:function (node) {
          var attr = {};
          // device numbers reuse inode numbers.
          attr.dev = FS.isChrdev(node.mode) ? node.id : 1;
          attr.ino = node.id;
          attr.mode = node.mode;
          attr.nlink = 1;
          attr.uid = 0;
          attr.gid = 0;
          attr.rdev = node.rdev;
          if (FS.isDir(node.mode)) {
            attr.size = 4096;
          } else if (FS.isFile(node.mode)) {
            attr.size = node.usedBytes;
          } else if (FS.isLink(node.mode)) {
            attr.size = node.link.length;
          } else {
            attr.size = 0;
          }
          attr.atime = new Date(node.timestamp);
          attr.mtime = new Date(node.timestamp);
          attr.ctime = new Date(node.timestamp);
          // NOTE: In our implementation, st_blocks = Math.ceil(st_size/st_blksize),
          //       but this is not required by the standard.
          attr.blksize = 4096;
          attr.blocks = Math.ceil(attr.size / attr.blksize);
          return attr;
        },setattr:function (node, attr) {
          if (attr.mode !== undefined) {
            node.mode = attr.mode;
          }
          if (attr.timestamp !== undefined) {
            node.timestamp = attr.timestamp;
          }
          if (attr.size !== undefined) {
            MEMFS.resizeFileStorage(node, attr.size);
          }
        },lookup:function (parent, name) {
          throw FS.genericErrors[ERRNO_CODES.ENOENT];
        },mknod:function (parent, name, mode, dev) {
          return MEMFS.createNode(parent, name, mode, dev);
        },rename:function (old_node, new_dir, new_name) {
          // if we're overwriting a directory at new_name, make sure it's empty.
          if (FS.isDir(old_node.mode)) {
            var new_node;
            try {
              new_node = FS.lookupNode(new_dir, new_name);
            } catch (e) {
            }
            if (new_node) {
              for (var i in new_node.contents) {
                throw new FS.ErrnoError(ERRNO_CODES.ENOTEMPTY);
              }
            }
          }
          // do the internal rewiring
          delete old_node.parent.contents[old_node.name];
          old_node.name = new_name;
          new_dir.contents[new_name] = old_node;
          old_node.parent = new_dir;
        },unlink:function (parent, name) {
          delete parent.contents[name];
        },rmdir:function (parent, name) {
          var node = FS.lookupNode(parent, name);
          for (var i in node.contents) {
            throw new FS.ErrnoError(ERRNO_CODES.ENOTEMPTY);
          }
          delete parent.contents[name];
        },readdir:function (node) {
          var entries = ['.', '..']
          for (var key in node.contents) {
            if (!node.contents.hasOwnProperty(key)) {
              continue;
            }
            entries.push(key);
          }
          return entries;
        },symlink:function (parent, newname, oldpath) {
          var node = MEMFS.createNode(parent, newname, 511 /* 0777 */ | 40960, 0);
          node.link = oldpath;
          return node;
        },readlink:function (node) {
          if (!FS.isLink(node.mode)) {
            throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
          }
          return node.link;
        }},stream_ops:{read:function (stream, buffer, offset, length, position) {
          var contents = stream.node.contents;
          if (position >= stream.node.usedBytes) return 0;
          var size = Math.min(stream.node.usedBytes - position, length);
          assert(size >= 0);
          if (size > 8 && contents.subarray) { // non-trivial, and typed array
            buffer.set(contents.subarray(position, position + size), offset);
          } else {
            for (var i = 0; i < size; i++) buffer[offset + i] = contents[position + i];
          }
          return size;
        },write:function (stream, buffer, offset, length, position, canOwn) {
          if (!length) return 0;
          var node = stream.node;
          node.timestamp = Date.now();
  
          if (buffer.subarray && (!node.contents || node.contents.subarray)) { // This write is from a typed array to a typed array?
            if (canOwn) { // Can we just reuse the buffer we are given?
              node.contents = buffer.subarray(offset, offset + length);
              node.usedBytes = length;
              return length;
            } else if (node.usedBytes === 0 && position === 0) { // If this is a simple first write to an empty file, do a fast set since we don't need to care about old data.
              node.contents = new Uint8Array(buffer.subarray(offset, offset + length));
              node.usedBytes = length;
              return length;
            } else if (position + length <= node.usedBytes) { // Writing to an already allocated and used subrange of the file?
              node.contents.set(buffer.subarray(offset, offset + length), position);
              return length;
            }
          }
  
          // Appending to an existing file and we need to reallocate, or source data did not come as a typed array.
          MEMFS.expandFileStorage(node, position+length);
          if (node.contents.subarray && buffer.subarray) node.contents.set(buffer.subarray(offset, offset + length), position); // Use typed array write if available.
          else {
            for (var i = 0; i < length; i++) {
             node.contents[position + i] = buffer[offset + i]; // Or fall back to manual write if not.
            }
          }
          node.usedBytes = Math.max(node.usedBytes, position+length);
          return length;
        },llseek:function (stream, offset, whence) {
          var position = offset;
          if (whence === 1) {  // SEEK_CUR.
            position += stream.position;
          } else if (whence === 2) {  // SEEK_END.
            if (FS.isFile(stream.node.mode)) {
              position += stream.node.usedBytes;
            }
          }
          if (position < 0) {
            throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
          }
          return position;
        },allocate:function (stream, offset, length) {
          MEMFS.expandFileStorage(stream.node, offset + length);
          stream.node.usedBytes = Math.max(stream.node.usedBytes, offset + length);
        },mmap:function (stream, buffer, offset, length, position, prot, flags) {
          if (!FS.isFile(stream.node.mode)) {
            throw new FS.ErrnoError(ERRNO_CODES.ENODEV);
          }
          var ptr;
          var allocated;
          var contents = stream.node.contents;
          // Only make a new copy when MAP_PRIVATE is specified.
          if ( !(flags & 2) &&
                (contents.buffer === buffer || contents.buffer === buffer.buffer) ) {
            // We can't emulate MAP_SHARED when the file is not backed by the buffer
            // we're mapping to (e.g. the HEAP buffer).
            allocated = false;
            ptr = contents.byteOffset;
          } else {
            // Try to avoid unnecessary slices.
            if (position > 0 || position + length < stream.node.usedBytes) {
              if (contents.subarray) {
                contents = contents.subarray(position, position + length);
              } else {
                contents = Array.prototype.slice.call(contents, position, position + length);
              }
            }
            allocated = true;
            ptr = _malloc(length);
            if (!ptr) {
              throw new FS.ErrnoError(ERRNO_CODES.ENOMEM);
            }
            buffer.set(contents, ptr);
          }
          return { ptr: ptr, allocated: allocated };
        },msync:function (stream, buffer, offset, length, mmapFlags) {
          if (!FS.isFile(stream.node.mode)) {
            throw new FS.ErrnoError(ERRNO_CODES.ENODEV);
          }
          if (mmapFlags & 2) {
            // MAP_PRIVATE calls need not to be synced back to underlying fs
            return 0;
          }
  
          var bytesWritten = MEMFS.stream_ops.write(stream, buffer, 0, length, offset, false);
          // should we check if bytesWritten and length are the same?
          return 0;
        }}};
  
  var IDBFS={dbs:{},indexedDB:function () {
        if (typeof indexedDB !== 'undefined') return indexedDB;
        var ret = null;
        if (typeof window === 'object') ret = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
        assert(ret, 'IDBFS used, but indexedDB not supported');
        return ret;
      },DB_VERSION:21,DB_STORE_NAME:"FILE_DATA",mount:function (mount) {
        // reuse all of the core MEMFS functionality
        return MEMFS.mount.apply(null, arguments);
      },syncfs:function (mount, populate, callback) {
        IDBFS.getLocalSet(mount, function(err, local) {
          if (err) return callback(err);
  
          IDBFS.getRemoteSet(mount, function(err, remote) {
            if (err) return callback(err);
  
            var src = populate ? remote : local;
            var dst = populate ? local : remote;
  
            IDBFS.reconcile(src, dst, callback);
          });
        });
      },getDB:function (name, callback) {
        // check the cache first
        var db = IDBFS.dbs[name];
        if (db) {
          return callback(null, db);
        }
  
        var req;
        try {
          req = IDBFS.indexedDB().open(name, IDBFS.DB_VERSION);
        } catch (e) {
          return callback(e);
        }
        if (!req) {
          return callback("Unable to connect to IndexedDB");
        }
        req.onupgradeneeded = function(e) {
          var db = e.target.result;
          var transaction = e.target.transaction;
  
          var fileStore;
  
          if (db.objectStoreNames.contains(IDBFS.DB_STORE_NAME)) {
            fileStore = transaction.objectStore(IDBFS.DB_STORE_NAME);
          } else {
            fileStore = db.createObjectStore(IDBFS.DB_STORE_NAME);
          }
  
          if (!fileStore.indexNames.contains('timestamp')) {
            fileStore.createIndex('timestamp', 'timestamp', { unique: false });
          }
        };
        req.onsuccess = function() {
          db = req.result;
  
          // add to the cache
          IDBFS.dbs[name] = db;
          callback(null, db);
        };
        req.onerror = function(e) {
          callback(this.error);
          e.preventDefault();
        };
      },getLocalSet:function (mount, callback) {
        var entries = {};
  
        function isRealDir(p) {
          return p !== '.' && p !== '..';
        };
        function toAbsolute(root) {
          return function(p) {
            return PATH.join2(root, p);
          }
        };
  
        var check = FS.readdir(mount.mountpoint).filter(isRealDir).map(toAbsolute(mount.mountpoint));
  
        while (check.length) {
          var path = check.pop();
          var stat;
  
          try {
            stat = FS.stat(path);
          } catch (e) {
            return callback(e);
          }
  
          if (FS.isDir(stat.mode)) {
            check.push.apply(check, FS.readdir(path).filter(isRealDir).map(toAbsolute(path)));
          }
  
          entries[path] = { timestamp: stat.mtime };
        }
  
        return callback(null, { type: 'local', entries: entries });
      },getRemoteSet:function (mount, callback) {
        var entries = {};
  
        IDBFS.getDB(mount.mountpoint, function(err, db) {
          if (err) return callback(err);
  
          var transaction = db.transaction([IDBFS.DB_STORE_NAME], 'readonly');
          transaction.onerror = function(e) {
            callback(this.error);
            e.preventDefault();
          };
  
          var store = transaction.objectStore(IDBFS.DB_STORE_NAME);
          var index = store.index('timestamp');
  
          index.openKeyCursor().onsuccess = function(event) {
            var cursor = event.target.result;
  
            if (!cursor) {
              return callback(null, { type: 'remote', db: db, entries: entries });
            }
  
            entries[cursor.primaryKey] = { timestamp: cursor.key };
  
            cursor.continue();
          };
        });
      },loadLocalEntry:function (path, callback) {
        var stat, node;
  
        try {
          var lookup = FS.lookupPath(path);
          node = lookup.node;
          stat = FS.stat(path);
        } catch (e) {
          return callback(e);
        }
  
        if (FS.isDir(stat.mode)) {
          return callback(null, { timestamp: stat.mtime, mode: stat.mode });
        } else if (FS.isFile(stat.mode)) {
          // Performance consideration: storing a normal JavaScript array to a IndexedDB is much slower than storing a typed array.
          // Therefore always convert the file contents to a typed array first before writing the data to IndexedDB.
          node.contents = MEMFS.getFileDataAsTypedArray(node);
          return callback(null, { timestamp: stat.mtime, mode: stat.mode, contents: node.contents });
        } else {
          return callback(new Error('node type not supported'));
        }
      },storeLocalEntry:function (path, entry, callback) {
        try {
          if (FS.isDir(entry.mode)) {
            FS.mkdir(path, entry.mode);
          } else if (FS.isFile(entry.mode)) {
            FS.writeFile(path, entry.contents, { encoding: 'binary', canOwn: true });
          } else {
            return callback(new Error('node type not supported'));
          }
  
          FS.chmod(path, entry.mode);
          FS.utime(path, entry.timestamp, entry.timestamp);
        } catch (e) {
          return callback(e);
        }
  
        callback(null);
      },removeLocalEntry:function (path, callback) {
        try {
          var lookup = FS.lookupPath(path);
          var stat = FS.stat(path);
  
          if (FS.isDir(stat.mode)) {
            FS.rmdir(path);
          } else if (FS.isFile(stat.mode)) {
            FS.unlink(path);
          }
        } catch (e) {
          return callback(e);
        }
  
        callback(null);
      },loadRemoteEntry:function (store, path, callback) {
        var req = store.get(path);
        req.onsuccess = function(event) { callback(null, event.target.result); };
        req.onerror = function(e) {
          callback(this.error);
          e.preventDefault();
        };
      },storeRemoteEntry:function (store, path, entry, callback) {
        var req = store.put(entry, path);
        req.onsuccess = function() { callback(null); };
        req.onerror = function(e) {
          callback(this.error);
          e.preventDefault();
        };
      },removeRemoteEntry:function (store, path, callback) {
        var req = store.delete(path);
        req.onsuccess = function() { callback(null); };
        req.onerror = function(e) {
          callback(this.error);
          e.preventDefault();
        };
      },reconcile:function (src, dst, callback) {
        var total = 0;
  
        var create = [];
        Object.keys(src.entries).forEach(function (key) {
          var e = src.entries[key];
          var e2 = dst.entries[key];
          if (!e2 || e.timestamp > e2.timestamp) {
            create.push(key);
            total++;
          }
        });
  
        var remove = [];
        Object.keys(dst.entries).forEach(function (key) {
          var e = dst.entries[key];
          var e2 = src.entries[key];
          if (!e2) {
            remove.push(key);
            total++;
          }
        });
  
        if (!total) {
          return callback(null);
        }
  
        var errored = false;
        var completed = 0;
        var db = src.type === 'remote' ? src.db : dst.db;
        var transaction = db.transaction([IDBFS.DB_STORE_NAME], 'readwrite');
        var store = transaction.objectStore(IDBFS.DB_STORE_NAME);
  
        function done(err) {
          if (err) {
            if (!done.errored) {
              done.errored = true;
              return callback(err);
            }
            return;
          }
          if (++completed >= total) {
            return callback(null);
          }
        };
  
        transaction.onerror = function(e) {
          done(this.error);
          e.preventDefault();
        };
  
        // sort paths in ascending order so directory entries are created
        // before the files inside them
        create.sort().forEach(function (path) {
          if (dst.type === 'local') {
            IDBFS.loadRemoteEntry(store, path, function (err, entry) {
              if (err) return done(err);
              IDBFS.storeLocalEntry(path, entry, done);
            });
          } else {
            IDBFS.loadLocalEntry(path, function (err, entry) {
              if (err) return done(err);
              IDBFS.storeRemoteEntry(store, path, entry, done);
            });
          }
        });
  
        // sort paths in descending order so files are deleted before their
        // parent directories
        remove.sort().reverse().forEach(function(path) {
          if (dst.type === 'local') {
            IDBFS.removeLocalEntry(path, done);
          } else {
            IDBFS.removeRemoteEntry(store, path, done);
          }
        });
      }};
  
  var NODEFS={isWindows:false,staticInit:function () {
        NODEFS.isWindows = !!process.platform.match(/^win/);
      },mount:function (mount) {
        assert(ENVIRONMENT_IS_NODE);
        return NODEFS.createNode(null, '/', NODEFS.getMode(mount.opts.root), 0);
      },createNode:function (parent, name, mode, dev) {
        if (!FS.isDir(mode) && !FS.isFile(mode) && !FS.isLink(mode)) {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
        var node = FS.createNode(parent, name, mode);
        node.node_ops = NODEFS.node_ops;
        node.stream_ops = NODEFS.stream_ops;
        return node;
      },getMode:function (path) {
        var stat;
        try {
          stat = fs.lstatSync(path);
          if (NODEFS.isWindows) {
            // On Windows, directories return permission bits 'rw-rw-rw-', even though they have 'rwxrwxrwx', so
            // propagate write bits to execute bits.
            stat.mode = stat.mode | ((stat.mode & 146) >> 1);
          }
        } catch (e) {
          if (!e.code) throw e;
          throw new FS.ErrnoError(ERRNO_CODES[e.code]);
        }
        return stat.mode;
      },realPath:function (node) {
        var parts = [];
        while (node.parent !== node) {
          parts.push(node.name);
          node = node.parent;
        }
        parts.push(node.mount.opts.root);
        parts.reverse();
        return PATH.join.apply(null, parts);
      },flagsToPermissionStringMap:{0:"r",1:"r+",2:"r+",64:"r",65:"r+",66:"r+",129:"rx+",193:"rx+",514:"w+",577:"w",578:"w+",705:"wx",706:"wx+",1024:"a",1025:"a",1026:"a+",1089:"a",1090:"a+",1153:"ax",1154:"ax+",1217:"ax",1218:"ax+",4096:"rs",4098:"rs+"},flagsToPermissionString:function (flags) {
        flags &= ~0100000 /*O_LARGEFILE*/; // Ignore this flag from musl, otherwise node.js fails to open the file.
        flags &= ~02000000 /*O_CLOEXEC*/; // Some applications may pass it; it makes no sense for a single process.
        if (flags in NODEFS.flagsToPermissionStringMap) {
          return NODEFS.flagsToPermissionStringMap[flags];
        } else {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
      },node_ops:{getattr:function (node) {
          var path = NODEFS.realPath(node);
          var stat;
          try {
            stat = fs.lstatSync(path);
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
          // node.js v0.10.20 doesn't report blksize and blocks on Windows. Fake them with default blksize of 4096.
          // See http://support.microsoft.com/kb/140365
          if (NODEFS.isWindows && !stat.blksize) {
            stat.blksize = 4096;
          }
          if (NODEFS.isWindows && !stat.blocks) {
            stat.blocks = (stat.size+stat.blksize-1)/stat.blksize|0;
          }
          return {
            dev: stat.dev,
            ino: stat.ino,
            mode: stat.mode,
            nlink: stat.nlink,
            uid: stat.uid,
            gid: stat.gid,
            rdev: stat.rdev,
            size: stat.size,
            atime: stat.atime,
            mtime: stat.mtime,
            ctime: stat.ctime,
            blksize: stat.blksize,
            blocks: stat.blocks
          };
        },setattr:function (node, attr) {
          var path = NODEFS.realPath(node);
          try {
            if (attr.mode !== undefined) {
              fs.chmodSync(path, attr.mode);
              // update the common node structure mode as well
              node.mode = attr.mode;
            }
            if (attr.timestamp !== undefined) {
              var date = new Date(attr.timestamp);
              fs.utimesSync(path, date, date);
            }
            if (attr.size !== undefined) {
              fs.truncateSync(path, attr.size);
            }
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
        },lookup:function (parent, name) {
          var path = PATH.join2(NODEFS.realPath(parent), name);
          var mode = NODEFS.getMode(path);
          return NODEFS.createNode(parent, name, mode);
        },mknod:function (parent, name, mode, dev) {
          var node = NODEFS.createNode(parent, name, mode, dev);
          // create the backing node for this in the fs root as well
          var path = NODEFS.realPath(node);
          try {
            if (FS.isDir(node.mode)) {
              fs.mkdirSync(path, node.mode);
            } else {
              fs.writeFileSync(path, '', { mode: node.mode });
            }
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
          return node;
        },rename:function (oldNode, newDir, newName) {
          var oldPath = NODEFS.realPath(oldNode);
          var newPath = PATH.join2(NODEFS.realPath(newDir), newName);
          try {
            fs.renameSync(oldPath, newPath);
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
        },unlink:function (parent, name) {
          var path = PATH.join2(NODEFS.realPath(parent), name);
          try {
            fs.unlinkSync(path);
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
        },rmdir:function (parent, name) {
          var path = PATH.join2(NODEFS.realPath(parent), name);
          try {
            fs.rmdirSync(path);
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
        },readdir:function (node) {
          var path = NODEFS.realPath(node);
          try {
            return fs.readdirSync(path);
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
        },symlink:function (parent, newName, oldPath) {
          var newPath = PATH.join2(NODEFS.realPath(parent), newName);
          try {
            fs.symlinkSync(oldPath, newPath);
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
        },readlink:function (node) {
          var path = NODEFS.realPath(node);
          try {
            path = fs.readlinkSync(path);
            path = NODEJS_PATH.relative(NODEJS_PATH.resolve(node.mount.opts.root), path);
            return path;
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
        }},stream_ops:{open:function (stream) {
          var path = NODEFS.realPath(stream.node);
          try {
            if (FS.isFile(stream.node.mode)) {
              stream.nfd = fs.openSync(path, NODEFS.flagsToPermissionString(stream.flags));
            }
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
        },close:function (stream) {
          try {
            if (FS.isFile(stream.node.mode) && stream.nfd) {
              fs.closeSync(stream.nfd);
            }
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
        },read:function (stream, buffer, offset, length, position) {
          if (length === 0) return 0; // node errors on 0 length reads
          // FIXME this is terrible.
          var nbuffer = new Buffer(length);
          var res;
          try {
            res = fs.readSync(stream.nfd, nbuffer, 0, length, position);
          } catch (e) {
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
          if (res > 0) {
            for (var i = 0; i < res; i++) {
              buffer[offset + i] = nbuffer[i];
            }
          }
          return res;
        },write:function (stream, buffer, offset, length, position) {
          // FIXME this is terrible.
          var nbuffer = new Buffer(buffer.subarray(offset, offset + length));
          var res;
          try {
            res = fs.writeSync(stream.nfd, nbuffer, 0, length, position);
          } catch (e) {
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
          return res;
        },llseek:function (stream, offset, whence) {
          var position = offset;
          if (whence === 1) {  // SEEK_CUR.
            position += stream.position;
          } else if (whence === 2) {  // SEEK_END.
            if (FS.isFile(stream.node.mode)) {
              try {
                var stat = fs.fstatSync(stream.nfd);
                position += stat.size;
              } catch (e) {
                throw new FS.ErrnoError(ERRNO_CODES[e.code]);
              }
            }
          }
  
          if (position < 0) {
            throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
          }
  
          return position;
        }}};
  
  var WORKERFS={DIR_MODE:16895,FILE_MODE:33279,reader:null,mount:function (mount) {
        assert(ENVIRONMENT_IS_WORKER);
        if (!WORKERFS.reader) WORKERFS.reader = new FileReaderSync();
        var root = WORKERFS.createNode(null, '/', WORKERFS.DIR_MODE, 0);
        var createdParents = {};
        function ensureParent(path) {
          // return the parent node, creating subdirs as necessary
          var parts = path.split('/');
          var parent = root;
          for (var i = 0; i < parts.length-1; i++) {
            var curr = parts.slice(0, i+1).join('/');
            // Issue 4254: Using curr as a node name will prevent the node
            // from being found in FS.nameTable when FS.open is called on
            // a path which holds a child of this node,
            // given that all FS functions assume node names
            // are just their corresponding parts within their given path,
            // rather than incremental aggregates which include their parent's
            // directories.
            if (!createdParents[curr]) {
              createdParents[curr] = WORKERFS.createNode(parent, parts[i], WORKERFS.DIR_MODE, 0);
            }
            parent = createdParents[curr];
          }
          return parent;
        }
        function base(path) {
          var parts = path.split('/');
          return parts[parts.length-1];
        }
        // We also accept FileList here, by using Array.prototype
        Array.prototype.forEach.call(mount.opts["files"] || [], function(file) {
          WORKERFS.createNode(ensureParent(file.name), base(file.name), WORKERFS.FILE_MODE, 0, file, file.lastModifiedDate);
        });
        (mount.opts["blobs"] || []).forEach(function(obj) {
          WORKERFS.createNode(ensureParent(obj["name"]), base(obj["name"]), WORKERFS.FILE_MODE, 0, obj["data"]);
        });
        (mount.opts["packages"] || []).forEach(function(pack) {
          pack['metadata'].files.forEach(function(file) {
            var name = file.filename.substr(1); // remove initial slash
            WORKERFS.createNode(ensureParent(name), base(name), WORKERFS.FILE_MODE, 0, pack['blob'].slice(file.start, file.end));
          });
        });
        return root;
      },createNode:function (parent, name, mode, dev, contents, mtime) {
        var node = FS.createNode(parent, name, mode);
        node.mode = mode;
        node.node_ops = WORKERFS.node_ops;
        node.stream_ops = WORKERFS.stream_ops;
        node.timestamp = (mtime || new Date).getTime();
        assert(WORKERFS.FILE_MODE !== WORKERFS.DIR_MODE);
        if (mode === WORKERFS.FILE_MODE) {
          node.size = contents.size;
          node.contents = contents;
        } else {
          node.size = 4096;
          node.contents = {};
        }
        if (parent) {
          parent.contents[name] = node;
        }
        return node;
      },node_ops:{getattr:function (node) {
          return {
            dev: 1,
            ino: undefined,
            mode: node.mode,
            nlink: 1,
            uid: 0,
            gid: 0,
            rdev: undefined,
            size: node.size,
            atime: new Date(node.timestamp),
            mtime: new Date(node.timestamp),
            ctime: new Date(node.timestamp),
            blksize: 4096,
            blocks: Math.ceil(node.size / 4096),
          };
        },setattr:function (node, attr) {
          if (attr.mode !== undefined) {
            node.mode = attr.mode;
          }
          if (attr.timestamp !== undefined) {
            node.timestamp = attr.timestamp;
          }
        },lookup:function (parent, name) {
          throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
        },mknod:function (parent, name, mode, dev) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        },rename:function (oldNode, newDir, newName) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        },unlink:function (parent, name) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        },rmdir:function (parent, name) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        },readdir:function (node) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        },symlink:function (parent, newName, oldPath) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        },readlink:function (node) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        }},stream_ops:{read:function (stream, buffer, offset, length, position) {
          if (position >= stream.node.size) return 0;
          var chunk = stream.node.contents.slice(position, position + length);
          var ab = WORKERFS.reader.readAsArrayBuffer(chunk);
          buffer.set(new Uint8Array(ab), offset);
          return chunk.size;
        },write:function (stream, buffer, offset, length, position) {
          throw new FS.ErrnoError(ERRNO_CODES.EIO);
        },llseek:function (stream, offset, whence) {
          var position = offset;
          if (whence === 1) {  // SEEK_CUR.
            position += stream.position;
          } else if (whence === 2) {  // SEEK_END.
            if (FS.isFile(stream.node.mode)) {
              position += stream.node.size;
            }
          }
          if (position < 0) {
            throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
          }
          return position;
        }}};
  
  var _stdin=STATICTOP; STATICTOP += 16;;
  
  var _stdout=STATICTOP; STATICTOP += 16;;
  
  var _stderr=STATICTOP; STATICTOP += 16;;var FS={root:null,mounts:[],devices:[null],streams:[],nextInode:1,nameTable:null,currentPath:"/",initialized:false,ignorePermissions:true,trackingDelegate:{},tracking:{openFlags:{READ:1,WRITE:2}},ErrnoError:null,genericErrors:{},filesystems:null,syncFSRequests:0,handleFSError:function (e) {
        if (!(e instanceof FS.ErrnoError)) throw e + ' : ' + stackTrace();
        return ___setErrNo(e.errno);
      },lookupPath:function (path, opts) {
        path = PATH.resolve(FS.cwd(), path);
        opts = opts || {};
  
        if (!path) return { path: '', node: null };
  
        var defaults = {
          follow_mount: true,
          recurse_count: 0
        };
        for (var key in defaults) {
          if (opts[key] === undefined) {
            opts[key] = defaults[key];
          }
        }
  
        if (opts.recurse_count > 8) {  // max recursive lookup of 8
          throw new FS.ErrnoError(ERRNO_CODES.ELOOP);
        }
  
        // split the path
        var parts = PATH.normalizeArray(path.split('/').filter(function(p) {
          return !!p;
        }), false);
  
        // start at the root
        var current = FS.root;
        var current_path = '/';
  
        for (var i = 0; i < parts.length; i++) {
          var islast = (i === parts.length-1);
          if (islast && opts.parent) {
            // stop resolving
            break;
          }
  
          current = FS.lookupNode(current, parts[i]);
          current_path = PATH.join2(current_path, parts[i]);
  
          // jump to the mount's root node if this is a mountpoint
          if (FS.isMountpoint(current)) {
            if (!islast || (islast && opts.follow_mount)) {
              current = current.mounted.root;
            }
          }
  
          // by default, lookupPath will not follow a symlink if it is the final path component.
          // setting opts.follow = true will override this behavior.
          if (!islast || opts.follow) {
            var count = 0;
            while (FS.isLink(current.mode)) {
              var link = FS.readlink(current_path);
              current_path = PATH.resolve(PATH.dirname(current_path), link);
  
              var lookup = FS.lookupPath(current_path, { recurse_count: opts.recurse_count });
              current = lookup.node;
  
              if (count++ > 40) {  // limit max consecutive symlinks to 40 (SYMLOOP_MAX).
                throw new FS.ErrnoError(ERRNO_CODES.ELOOP);
              }
            }
          }
        }
  
        return { path: current_path, node: current };
      },getPath:function (node) {
        var path;
        while (true) {
          if (FS.isRoot(node)) {
            var mount = node.mount.mountpoint;
            if (!path) return mount;
            return mount[mount.length-1] !== '/' ? mount + '/' + path : mount + path;
          }
          path = path ? node.name + '/' + path : node.name;
          node = node.parent;
        }
      },hashName:function (parentid, name) {
        var hash = 0;
  
  
        for (var i = 0; i < name.length; i++) {
          hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
        }
        return ((parentid + hash) >>> 0) % FS.nameTable.length;
      },hashAddNode:function (node) {
        var hash = FS.hashName(node.parent.id, node.name);
        node.name_next = FS.nameTable[hash];
        FS.nameTable[hash] = node;
      },hashRemoveNode:function (node) {
        var hash = FS.hashName(node.parent.id, node.name);
        if (FS.nameTable[hash] === node) {
          FS.nameTable[hash] = node.name_next;
        } else {
          var current = FS.nameTable[hash];
          while (current) {
            if (current.name_next === node) {
              current.name_next = node.name_next;
              break;
            }
            current = current.name_next;
          }
        }
      },lookupNode:function (parent, name) {
        var err = FS.mayLookup(parent);
        if (err) {
          throw new FS.ErrnoError(err, parent);
        }
        var hash = FS.hashName(parent.id, name);
        for (var node = FS.nameTable[hash]; node; node = node.name_next) {
          var nodeName = node.name;
          if (node.parent.id === parent.id && nodeName === name) {
            return node;
          }
        }
        // if we failed to find it in the cache, call into the VFS
        return FS.lookup(parent, name);
      },createNode:function (parent, name, mode, rdev) {
        if (!FS.FSNode) {
          FS.FSNode = function(parent, name, mode, rdev) {
            if (!parent) {
              parent = this;  // root node sets parent to itself
            }
            this.parent = parent;
            this.mount = parent.mount;
            this.mounted = null;
            this.id = FS.nextInode++;
            this.name = name;
            this.mode = mode;
            this.node_ops = {};
            this.stream_ops = {};
            this.rdev = rdev;
          };
  
          FS.FSNode.prototype = {};
  
          // compatibility
          var readMode = 292 | 73;
          var writeMode = 146;
  
          // NOTE we must use Object.defineProperties instead of individual calls to
          // Object.defineProperty in order to make closure compiler happy
          Object.defineProperties(FS.FSNode.prototype, {
            read: {
              get: function() { return (this.mode & readMode) === readMode; },
              set: function(val) { val ? this.mode |= readMode : this.mode &= ~readMode; }
            },
            write: {
              get: function() { return (this.mode & writeMode) === writeMode; },
              set: function(val) { val ? this.mode |= writeMode : this.mode &= ~writeMode; }
            },
            isFolder: {
              get: function() { return FS.isDir(this.mode); }
            },
            isDevice: {
              get: function() { return FS.isChrdev(this.mode); }
            }
          });
        }
  
        var node = new FS.FSNode(parent, name, mode, rdev);
  
        FS.hashAddNode(node);
  
        return node;
      },destroyNode:function (node) {
        FS.hashRemoveNode(node);
      },isRoot:function (node) {
        return node === node.parent;
      },isMountpoint:function (node) {
        return !!node.mounted;
      },isFile:function (mode) {
        return (mode & 61440) === 32768;
      },isDir:function (mode) {
        return (mode & 61440) === 16384;
      },isLink:function (mode) {
        return (mode & 61440) === 40960;
      },isChrdev:function (mode) {
        return (mode & 61440) === 8192;
      },isBlkdev:function (mode) {
        return (mode & 61440) === 24576;
      },isFIFO:function (mode) {
        return (mode & 61440) === 4096;
      },isSocket:function (mode) {
        return (mode & 49152) === 49152;
      },flagModes:{"r":0,"rs":1052672,"r+":2,"w":577,"wx":705,"xw":705,"w+":578,"wx+":706,"xw+":706,"a":1089,"ax":1217,"xa":1217,"a+":1090,"ax+":1218,"xa+":1218},modeStringToFlags:function (str) {
        var flags = FS.flagModes[str];
        if (typeof flags === 'undefined') {
          throw new Error('Unknown file open mode: ' + str);
        }
        return flags;
      },flagsToPermissionString:function (flag) {
        var perms = ['r', 'w', 'rw'][flag & 3];
        if ((flag & 512)) {
          perms += 'w';
        }
        return perms;
      },nodePermissions:function (node, perms) {
        if (FS.ignorePermissions) {
          return 0;
        }
        // return 0 if any user, group or owner bits are set.
        if (perms.indexOf('r') !== -1 && !(node.mode & 292)) {
          return ERRNO_CODES.EACCES;
        } else if (perms.indexOf('w') !== -1 && !(node.mode & 146)) {
          return ERRNO_CODES.EACCES;
        } else if (perms.indexOf('x') !== -1 && !(node.mode & 73)) {
          return ERRNO_CODES.EACCES;
        }
        return 0;
      },mayLookup:function (dir) {
        var err = FS.nodePermissions(dir, 'x');
        if (err) return err;
        if (!dir.node_ops.lookup) return ERRNO_CODES.EACCES;
        return 0;
      },mayCreate:function (dir, name) {
        try {
          var node = FS.lookupNode(dir, name);
          return ERRNO_CODES.EEXIST;
        } catch (e) {
        }
        return FS.nodePermissions(dir, 'wx');
      },mayDelete:function (dir, name, isdir) {
        var node;
        try {
          node = FS.lookupNode(dir, name);
        } catch (e) {
          return e.errno;
        }
        var err = FS.nodePermissions(dir, 'wx');
        if (err) {
          return err;
        }
        if (isdir) {
          if (!FS.isDir(node.mode)) {
            return ERRNO_CODES.ENOTDIR;
          }
          if (FS.isRoot(node) || FS.getPath(node) === FS.cwd()) {
            return ERRNO_CODES.EBUSY;
          }
        } else {
          if (FS.isDir(node.mode)) {
            return ERRNO_CODES.EISDIR;
          }
        }
        return 0;
      },mayOpen:function (node, flags) {
        if (!node) {
          return ERRNO_CODES.ENOENT;
        }
        if (FS.isLink(node.mode)) {
          return ERRNO_CODES.ELOOP;
        } else if (FS.isDir(node.mode)) {
          if (FS.flagsToPermissionString(flags) !== 'r' || // opening for write
              (flags & 512)) { // TODO: check for O_SEARCH? (== search for dir only)
            return ERRNO_CODES.EISDIR;
          }
        }
        return FS.nodePermissions(node, FS.flagsToPermissionString(flags));
      },MAX_OPEN_FDS:4096,nextfd:function (fd_start, fd_end) {
        fd_start = fd_start || 0;
        fd_end = fd_end || FS.MAX_OPEN_FDS;
        for (var fd = fd_start; fd <= fd_end; fd++) {
          if (!FS.streams[fd]) {
            return fd;
          }
        }
        throw new FS.ErrnoError(ERRNO_CODES.EMFILE);
      },getStream:function (fd) {
        return FS.streams[fd];
      },createStream:function (stream, fd_start, fd_end) {
        if (!FS.FSStream) {
          FS.FSStream = function(){};
          FS.FSStream.prototype = {};
          // compatibility
          Object.defineProperties(FS.FSStream.prototype, {
            object: {
              get: function() { return this.node; },
              set: function(val) { this.node = val; }
            },
            isRead: {
              get: function() { return (this.flags & 2097155) !== 1; }
            },
            isWrite: {
              get: function() { return (this.flags & 2097155) !== 0; }
            },
            isAppend: {
              get: function() { return (this.flags & 1024); }
            }
          });
        }
        // clone it, so we can return an instance of FSStream
        var newStream = new FS.FSStream();
        for (var p in stream) {
          newStream[p] = stream[p];
        }
        stream = newStream;
        var fd = FS.nextfd(fd_start, fd_end);
        stream.fd = fd;
        FS.streams[fd] = stream;
        return stream;
      },closeStream:function (fd) {
        FS.streams[fd] = null;
      },chrdev_stream_ops:{open:function (stream) {
          var device = FS.getDevice(stream.node.rdev);
          // override node's stream ops with the device's
          stream.stream_ops = device.stream_ops;
          // forward the open call
          if (stream.stream_ops.open) {
            stream.stream_ops.open(stream);
          }
        },llseek:function () {
          throw new FS.ErrnoError(ERRNO_CODES.ESPIPE);
        }},major:function (dev) {
        return ((dev) >> 8);
      },minor:function (dev) {
        return ((dev) & 0xff);
      },makedev:function (ma, mi) {
        return ((ma) << 8 | (mi));
      },registerDevice:function (dev, ops) {
        FS.devices[dev] = { stream_ops: ops };
      },getDevice:function (dev) {
        return FS.devices[dev];
      },getMounts:function (mount) {
        var mounts = [];
        var check = [mount];
  
        while (check.length) {
          var m = check.pop();
  
          mounts.push(m);
  
          check.push.apply(check, m.mounts);
        }
  
        return mounts;
      },syncfs:function (populate, callback) {
        if (typeof(populate) === 'function') {
          callback = populate;
          populate = false;
        }
  
        FS.syncFSRequests++;
  
        if (FS.syncFSRequests > 1) {
          console.log('warning: ' + FS.syncFSRequests + ' FS.syncfs operations in flight at once, probably just doing extra work');
        }
  
        var mounts = FS.getMounts(FS.root.mount);
        var completed = 0;
  
        function doCallback(err) {
          assert(FS.syncFSRequests > 0);
          FS.syncFSRequests--;
          return callback(err);
        }
  
        function done(err) {
          if (err) {
            if (!done.errored) {
              done.errored = true;
              return doCallback(err);
            }
            return;
          }
          if (++completed >= mounts.length) {
            doCallback(null);
          }
        };
  
        // sync all mounts
        mounts.forEach(function (mount) {
          if (!mount.type.syncfs) {
            return done(null);
          }
          mount.type.syncfs(mount, populate, done);
        });
      },mount:function (type, opts, mountpoint) {
        var root = mountpoint === '/';
        var pseudo = !mountpoint;
        var node;
  
        if (root && FS.root) {
          throw new FS.ErrnoError(ERRNO_CODES.EBUSY);
        } else if (!root && !pseudo) {
          var lookup = FS.lookupPath(mountpoint, { follow_mount: false });
  
          mountpoint = lookup.path;  // use the absolute path
          node = lookup.node;
  
          if (FS.isMountpoint(node)) {
            throw new FS.ErrnoError(ERRNO_CODES.EBUSY);
          }
  
          if (!FS.isDir(node.mode)) {
            throw new FS.ErrnoError(ERRNO_CODES.ENOTDIR);
          }
        }
  
        var mount = {
          type: type,
          opts: opts,
          mountpoint: mountpoint,
          mounts: []
        };
  
        // create a root node for the fs
        var mountRoot = type.mount(mount);
        mountRoot.mount = mount;
        mount.root = mountRoot;
  
        if (root) {
          FS.root = mountRoot;
        } else if (node) {
          // set as a mountpoint
          node.mounted = mount;
  
          // add the new mount to the current mount's children
          if (node.mount) {
            node.mount.mounts.push(mount);
          }
        }
  
        return mountRoot;
      },unmount:function (mountpoint) {
        var lookup = FS.lookupPath(mountpoint, { follow_mount: false });
  
        if (!FS.isMountpoint(lookup.node)) {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
  
        // destroy the nodes for this mount, and all its child mounts
        var node = lookup.node;
        var mount = node.mounted;
        var mounts = FS.getMounts(mount);
  
        Object.keys(FS.nameTable).forEach(function (hash) {
          var current = FS.nameTable[hash];
  
          while (current) {
            var next = current.name_next;
  
            if (mounts.indexOf(current.mount) !== -1) {
              FS.destroyNode(current);
            }
  
            current = next;
          }
        });
  
        // no longer a mountpoint
        node.mounted = null;
  
        // remove this mount from the child mounts
        var idx = node.mount.mounts.indexOf(mount);
        assert(idx !== -1);
        node.mount.mounts.splice(idx, 1);
      },lookup:function (parent, name) {
        return parent.node_ops.lookup(parent, name);
      },mknod:function (path, mode, dev) {
        var lookup = FS.lookupPath(path, { parent: true });
        var parent = lookup.node;
        var name = PATH.basename(path);
        if (!name || name === '.' || name === '..') {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
        var err = FS.mayCreate(parent, name);
        if (err) {
          throw new FS.ErrnoError(err);
        }
        if (!parent.node_ops.mknod) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        }
        return parent.node_ops.mknod(parent, name, mode, dev);
      },create:function (path, mode) {
        mode = mode !== undefined ? mode : 438 /* 0666 */;
        mode &= 4095;
        mode |= 32768;
        return FS.mknod(path, mode, 0);
      },mkdir:function (path, mode) {
        mode = mode !== undefined ? mode : 511 /* 0777 */;
        mode &= 511 | 512;
        mode |= 16384;
        return FS.mknod(path, mode, 0);
      },mkdev:function (path, mode, dev) {
        if (typeof(dev) === 'undefined') {
          dev = mode;
          mode = 438 /* 0666 */;
        }
        mode |= 8192;
        return FS.mknod(path, mode, dev);
      },symlink:function (oldpath, newpath) {
        if (!PATH.resolve(oldpath)) {
          throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
        }
        var lookup = FS.lookupPath(newpath, { parent: true });
        var parent = lookup.node;
        if (!parent) {
          throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
        }
        var newname = PATH.basename(newpath);
        var err = FS.mayCreate(parent, newname);
        if (err) {
          throw new FS.ErrnoError(err);
        }
        if (!parent.node_ops.symlink) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        }
        return parent.node_ops.symlink(parent, newname, oldpath);
      },rename:function (old_path, new_path) {
        var old_dirname = PATH.dirname(old_path);
        var new_dirname = PATH.dirname(new_path);
        var old_name = PATH.basename(old_path);
        var new_name = PATH.basename(new_path);
        // parents must exist
        var lookup, old_dir, new_dir;
        try {
          lookup = FS.lookupPath(old_path, { parent: true });
          old_dir = lookup.node;
          lookup = FS.lookupPath(new_path, { parent: true });
          new_dir = lookup.node;
        } catch (e) {
          throw new FS.ErrnoError(ERRNO_CODES.EBUSY);
        }
        if (!old_dir || !new_dir) throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
        // need to be part of the same mount
        if (old_dir.mount !== new_dir.mount) {
          throw new FS.ErrnoError(ERRNO_CODES.EXDEV);
        }
        // source must exist
        var old_node = FS.lookupNode(old_dir, old_name);
        // old path should not be an ancestor of the new path
        var relative = PATH.relative(old_path, new_dirname);
        if (relative.charAt(0) !== '.') {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
        // new path should not be an ancestor of the old path
        relative = PATH.relative(new_path, old_dirname);
        if (relative.charAt(0) !== '.') {
          throw new FS.ErrnoError(ERRNO_CODES.ENOTEMPTY);
        }
        // see if the new path already exists
        var new_node;
        try {
          new_node = FS.lookupNode(new_dir, new_name);
        } catch (e) {
          // not fatal
        }
        // early out if nothing needs to change
        if (old_node === new_node) {
          return;
        }
        // we'll need to delete the old entry
        var isdir = FS.isDir(old_node.mode);
        var err = FS.mayDelete(old_dir, old_name, isdir);
        if (err) {
          throw new FS.ErrnoError(err);
        }
        // need delete permissions if we'll be overwriting.
        // need create permissions if new doesn't already exist.
        err = new_node ?
          FS.mayDelete(new_dir, new_name, isdir) :
          FS.mayCreate(new_dir, new_name);
        if (err) {
          throw new FS.ErrnoError(err);
        }
        if (!old_dir.node_ops.rename) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        }
        if (FS.isMountpoint(old_node) || (new_node && FS.isMountpoint(new_node))) {
          throw new FS.ErrnoError(ERRNO_CODES.EBUSY);
        }
        // if we are going to change the parent, check write permissions
        if (new_dir !== old_dir) {
          err = FS.nodePermissions(old_dir, 'w');
          if (err) {
            throw new FS.ErrnoError(err);
          }
        }
        try {
          if (FS.trackingDelegate['willMovePath']) {
            FS.trackingDelegate['willMovePath'](old_path, new_path);
          }
        } catch(e) {
          console.log("FS.trackingDelegate['willMovePath']('"+old_path+"', '"+new_path+"') threw an exception: " + e.message);
        }
        // remove the node from the lookup hash
        FS.hashRemoveNode(old_node);
        // do the underlying fs rename
        try {
          old_dir.node_ops.rename(old_node, new_dir, new_name);
        } catch (e) {
          throw e;
        } finally {
          // add the node back to the hash (in case node_ops.rename
          // changed its name)
          FS.hashAddNode(old_node);
        }
        try {
          if (FS.trackingDelegate['onMovePath']) FS.trackingDelegate['onMovePath'](old_path, new_path);
        } catch(e) {
          console.log("FS.trackingDelegate['onMovePath']('"+old_path+"', '"+new_path+"') threw an exception: " + e.message);
        }
      },rmdir:function (path) {
        var lookup = FS.lookupPath(path, { parent: true });
        var parent = lookup.node;
        var name = PATH.basename(path);
        var node = FS.lookupNode(parent, name);
        var err = FS.mayDelete(parent, name, true);
        if (err) {
          throw new FS.ErrnoError(err);
        }
        if (!parent.node_ops.rmdir) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        }
        if (FS.isMountpoint(node)) {
          throw new FS.ErrnoError(ERRNO_CODES.EBUSY);
        }
        try {
          if (FS.trackingDelegate['willDeletePath']) {
            FS.trackingDelegate['willDeletePath'](path);
          }
        } catch(e) {
          console.log("FS.trackingDelegate['willDeletePath']('"+path+"') threw an exception: " + e.message);
        }
        parent.node_ops.rmdir(parent, name);
        FS.destroyNode(node);
        try {
          if (FS.trackingDelegate['onDeletePath']) FS.trackingDelegate['onDeletePath'](path);
        } catch(e) {
          console.log("FS.trackingDelegate['onDeletePath']('"+path+"') threw an exception: " + e.message);
        }
      },readdir:function (path) {
        var lookup = FS.lookupPath(path, { follow: true });
        var node = lookup.node;
        if (!node.node_ops.readdir) {
          throw new FS.ErrnoError(ERRNO_CODES.ENOTDIR);
        }
        return node.node_ops.readdir(node);
      },unlink:function (path) {
        var lookup = FS.lookupPath(path, { parent: true });
        var parent = lookup.node;
        var name = PATH.basename(path);
        var node = FS.lookupNode(parent, name);
        var err = FS.mayDelete(parent, name, false);
        if (err) {
          // POSIX says unlink should set EPERM, not EISDIR
          if (err === ERRNO_CODES.EISDIR) err = ERRNO_CODES.EPERM;
          throw new FS.ErrnoError(err);
        }
        if (!parent.node_ops.unlink) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        }
        if (FS.isMountpoint(node)) {
          throw new FS.ErrnoError(ERRNO_CODES.EBUSY);
        }
        try {
          if (FS.trackingDelegate['willDeletePath']) {
            FS.trackingDelegate['willDeletePath'](path);
          }
        } catch(e) {
          console.log("FS.trackingDelegate['willDeletePath']('"+path+"') threw an exception: " + e.message);
        }
        parent.node_ops.unlink(parent, name);
        FS.destroyNode(node);
        try {
          if (FS.trackingDelegate['onDeletePath']) FS.trackingDelegate['onDeletePath'](path);
        } catch(e) {
          console.log("FS.trackingDelegate['onDeletePath']('"+path+"') threw an exception: " + e.message);
        }
      },readlink:function (path) {
        var lookup = FS.lookupPath(path);
        var link = lookup.node;
        if (!link) {
          throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
        }
        if (!link.node_ops.readlink) {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
        return PATH.resolve(FS.getPath(link.parent), link.node_ops.readlink(link));
      },stat:function (path, dontFollow) {
        var lookup = FS.lookupPath(path, { follow: !dontFollow });
        var node = lookup.node;
        if (!node) {
          throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
        }
        if (!node.node_ops.getattr) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        }
        return node.node_ops.getattr(node);
      },lstat:function (path) {
        return FS.stat(path, true);
      },chmod:function (path, mode, dontFollow) {
        var node;
        if (typeof path === 'string') {
          var lookup = FS.lookupPath(path, { follow: !dontFollow });
          node = lookup.node;
        } else {
          node = path;
        }
        if (!node.node_ops.setattr) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        }
        node.node_ops.setattr(node, {
          mode: (mode & 4095) | (node.mode & ~4095),
          timestamp: Date.now()
        });
      },lchmod:function (path, mode) {
        FS.chmod(path, mode, true);
      },fchmod:function (fd, mode) {
        var stream = FS.getStream(fd);
        if (!stream) {
          throw new FS.ErrnoError(ERRNO_CODES.EBADF);
        }
        FS.chmod(stream.node, mode);
      },chown:function (path, uid, gid, dontFollow) {
        var node;
        if (typeof path === 'string') {
          var lookup = FS.lookupPath(path, { follow: !dontFollow });
          node = lookup.node;
        } else {
          node = path;
        }
        if (!node.node_ops.setattr) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        }
        node.node_ops.setattr(node, {
          timestamp: Date.now()
          // we ignore the uid / gid for now
        });
      },lchown:function (path, uid, gid) {
        FS.chown(path, uid, gid, true);
      },fchown:function (fd, uid, gid) {
        var stream = FS.getStream(fd);
        if (!stream) {
          throw new FS.ErrnoError(ERRNO_CODES.EBADF);
        }
        FS.chown(stream.node, uid, gid);
      },truncate:function (path, len) {
        if (len < 0) {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
        var node;
        if (typeof path === 'string') {
          var lookup = FS.lookupPath(path, { follow: true });
          node = lookup.node;
        } else {
          node = path;
        }
        if (!node.node_ops.setattr) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        }
        if (FS.isDir(node.mode)) {
          throw new FS.ErrnoError(ERRNO_CODES.EISDIR);
        }
        if (!FS.isFile(node.mode)) {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
        var err = FS.nodePermissions(node, 'w');
        if (err) {
          throw new FS.ErrnoError(err);
        }
        node.node_ops.setattr(node, {
          size: len,
          timestamp: Date.now()
        });
      },ftruncate:function (fd, len) {
        var stream = FS.getStream(fd);
        if (!stream) {
          throw new FS.ErrnoError(ERRNO_CODES.EBADF);
        }
        if ((stream.flags & 2097155) === 0) {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
        FS.truncate(stream.node, len);
      },utime:function (path, atime, mtime) {
        var lookup = FS.lookupPath(path, { follow: true });
        var node = lookup.node;
        node.node_ops.setattr(node, {
          timestamp: Math.max(atime, mtime)
        });
      },open:function (path, flags, mode, fd_start, fd_end) {
        if (path === "") {
          throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
        }
        flags = typeof flags === 'string' ? FS.modeStringToFlags(flags) : flags;
        mode = typeof mode === 'undefined' ? 438 /* 0666 */ : mode;
        if ((flags & 64)) {
          mode = (mode & 4095) | 32768;
        } else {
          mode = 0;
        }
        var node;
        if (typeof path === 'object') {
          node = path;
        } else {
          path = PATH.normalize(path);
          try {
            var lookup = FS.lookupPath(path, {
              follow: !(flags & 131072)
            });
            node = lookup.node;
          } catch (e) {
            // ignore
          }
        }
        // perhaps we need to create the node
        var created = false;
        if ((flags & 64)) {
          if (node) {
            // if O_CREAT and O_EXCL are set, error out if the node already exists
            if ((flags & 128)) {
              throw new FS.ErrnoError(ERRNO_CODES.EEXIST);
            }
          } else {
            // node doesn't exist, try to create it
            node = FS.mknod(path, mode, 0);
            created = true;
          }
        }
        if (!node) {
          throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
        }
        // can't truncate a device
        if (FS.isChrdev(node.mode)) {
          flags &= ~512;
        }
        // if asked only for a directory, then this must be one
        if ((flags & 65536) && !FS.isDir(node.mode)) {
          throw new FS.ErrnoError(ERRNO_CODES.ENOTDIR);
        }
        // check permissions, if this is not a file we just created now (it is ok to
        // create and write to a file with read-only permissions; it is read-only
        // for later use)
        if (!created) {
          var err = FS.mayOpen(node, flags);
          if (err) {
            throw new FS.ErrnoError(err);
          }
        }
        // do truncation if necessary
        if ((flags & 512)) {
          FS.truncate(node, 0);
        }
        // we've already handled these, don't pass down to the underlying vfs
        flags &= ~(128 | 512);
  
        // register the stream with the filesystem
        var stream = FS.createStream({
          node: node,
          path: FS.getPath(node),  // we want the absolute path to the node
          flags: flags,
          seekable: true,
          position: 0,
          stream_ops: node.stream_ops,
          // used by the file family libc calls (fopen, fwrite, ferror, etc.)
          ungotten: [],
          error: false
        }, fd_start, fd_end);
        // call the new stream's open function
        if (stream.stream_ops.open) {
          stream.stream_ops.open(stream);
        }
        if (Module['logReadFiles'] && !(flags & 1)) {
          if (!FS.readFiles) FS.readFiles = {};
          if (!(path in FS.readFiles)) {
            FS.readFiles[path] = 1;
            Module['printErr']('read file: ' + path);
          }
        }
        try {
          if (FS.trackingDelegate['onOpenFile']) {
            var trackingFlags = 0;
            if ((flags & 2097155) !== 1) {
              trackingFlags |= FS.tracking.openFlags.READ;
            }
            if ((flags & 2097155) !== 0) {
              trackingFlags |= FS.tracking.openFlags.WRITE;
            }
            FS.trackingDelegate['onOpenFile'](path, trackingFlags);
          }
        } catch(e) {
          console.log("FS.trackingDelegate['onOpenFile']('"+path+"', flags) threw an exception: " + e.message);
        }
        return stream;
      },close:function (stream) {
        if (stream.getdents) stream.getdents = null; // free readdir state
        try {
          if (stream.stream_ops.close) {
            stream.stream_ops.close(stream);
          }
        } catch (e) {
          throw e;
        } finally {
          FS.closeStream(stream.fd);
        }
      },llseek:function (stream, offset, whence) {
        if (!stream.seekable || !stream.stream_ops.llseek) {
          throw new FS.ErrnoError(ERRNO_CODES.ESPIPE);
        }
        stream.position = stream.stream_ops.llseek(stream, offset, whence);
        stream.ungotten = [];
        return stream.position;
      },read:function (stream, buffer, offset, length, position) {
        if (length < 0 || position < 0) {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
        if ((stream.flags & 2097155) === 1) {
          throw new FS.ErrnoError(ERRNO_CODES.EBADF);
        }
        if (FS.isDir(stream.node.mode)) {
          throw new FS.ErrnoError(ERRNO_CODES.EISDIR);
        }
        if (!stream.stream_ops.read) {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
        var seeking = true;
        if (typeof position === 'undefined') {
          position = stream.position;
          seeking = false;
        } else if (!stream.seekable) {
          throw new FS.ErrnoError(ERRNO_CODES.ESPIPE);
        }
        var bytesRead = stream.stream_ops.read(stream, buffer, offset, length, position);
        if (!seeking) stream.position += bytesRead;
        return bytesRead;
      },write:function (stream, buffer, offset, length, position, canOwn) {
        if (length < 0 || position < 0) {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
        if ((stream.flags & 2097155) === 0) {
          throw new FS.ErrnoError(ERRNO_CODES.EBADF);
        }
        if (FS.isDir(stream.node.mode)) {
          throw new FS.ErrnoError(ERRNO_CODES.EISDIR);
        }
        if (!stream.stream_ops.write) {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
        if (stream.flags & 1024) {
          // seek to the end before writing in append mode
          FS.llseek(stream, 0, 2);
        }
        var seeking = true;
        if (typeof position === 'undefined') {
          position = stream.position;
          seeking = false;
        } else if (!stream.seekable) {
          throw new FS.ErrnoError(ERRNO_CODES.ESPIPE);
        }
        var bytesWritten = stream.stream_ops.write(stream, buffer, offset, length, position, canOwn);
        if (!seeking) stream.position += bytesWritten;
        try {
          if (stream.path && FS.trackingDelegate['onWriteToFile']) FS.trackingDelegate['onWriteToFile'](stream.path);
        } catch(e) {
          console.log("FS.trackingDelegate['onWriteToFile']('"+path+"') threw an exception: " + e.message);
        }
        return bytesWritten;
      },allocate:function (stream, offset, length) {
        if (offset < 0 || length <= 0) {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
        if ((stream.flags & 2097155) === 0) {
          throw new FS.ErrnoError(ERRNO_CODES.EBADF);
        }
        if (!FS.isFile(stream.node.mode) && !FS.isDir(node.mode)) {
          throw new FS.ErrnoError(ERRNO_CODES.ENODEV);
        }
        if (!stream.stream_ops.allocate) {
          throw new FS.ErrnoError(ERRNO_CODES.EOPNOTSUPP);
        }
        stream.stream_ops.allocate(stream, offset, length);
      },mmap:function (stream, buffer, offset, length, position, prot, flags) {
        // TODO if PROT is PROT_WRITE, make sure we have write access
        if ((stream.flags & 2097155) === 1) {
          throw new FS.ErrnoError(ERRNO_CODES.EACCES);
        }
        if (!stream.stream_ops.mmap) {
          throw new FS.ErrnoError(ERRNO_CODES.ENODEV);
        }
        return stream.stream_ops.mmap(stream, buffer, offset, length, position, prot, flags);
      },msync:function (stream, buffer, offset, length, mmapFlags) {
        if (!stream || !stream.stream_ops.msync) {
          return 0;
        }
        return stream.stream_ops.msync(stream, buffer, offset, length, mmapFlags);
      },munmap:function (stream) {
        return 0;
      },ioctl:function (stream, cmd, arg) {
        if (!stream.stream_ops.ioctl) {
          throw new FS.ErrnoError(ERRNO_CODES.ENOTTY);
        }
        return stream.stream_ops.ioctl(stream, cmd, arg);
      },readFile:function (path, opts) {
        opts = opts || {};
        opts.flags = opts.flags || 'r';
        opts.encoding = opts.encoding || 'binary';
        if (opts.encoding !== 'utf8' && opts.encoding !== 'binary') {
          throw new Error('Invalid encoding type "' + opts.encoding + '"');
        }
        var ret;
        var stream = FS.open(path, opts.flags);
        var stat = FS.stat(path);
        var length = stat.size;
        var buf = new Uint8Array(length);
        FS.read(stream, buf, 0, length, 0);
        if (opts.encoding === 'utf8') {
          ret = UTF8ArrayToString(buf, 0);
        } else if (opts.encoding === 'binary') {
          ret = buf;
        }
        FS.close(stream);
        return ret;
      },writeFile:function (path, data, opts) {
        opts = opts || {};
        opts.flags = opts.flags || 'w';
        opts.encoding = opts.encoding || 'utf8';
        if (opts.encoding !== 'utf8' && opts.encoding !== 'binary') {
          throw new Error('Invalid encoding type "' + opts.encoding + '"');
        }
        var stream = FS.open(path, opts.flags, opts.mode);
        if (opts.encoding === 'utf8') {
          var buf = new Uint8Array(lengthBytesUTF8(data)+1);
          var actualNumBytes = stringToUTF8Array(data, buf, 0, buf.length);
          FS.write(stream, buf, 0, actualNumBytes, 0, opts.canOwn);
        } else if (opts.encoding === 'binary') {
          FS.write(stream, data, 0, data.length, 0, opts.canOwn);
        }
        FS.close(stream);
      },cwd:function () {
        return FS.currentPath;
      },chdir:function (path) {
        var lookup = FS.lookupPath(path, { follow: true });
        if (!FS.isDir(lookup.node.mode)) {
          throw new FS.ErrnoError(ERRNO_CODES.ENOTDIR);
        }
        var err = FS.nodePermissions(lookup.node, 'x');
        if (err) {
          throw new FS.ErrnoError(err);
        }
        FS.currentPath = lookup.path;
      },createDefaultDirectories:function () {
        FS.mkdir('/tmp');
        FS.mkdir('/home');
        FS.mkdir('/home/web_user');
      },createDefaultDevices:function () {
        // create /dev
        FS.mkdir('/dev');
        // setup /dev/null
        FS.registerDevice(FS.makedev(1, 3), {
          read: function() { return 0; },
          write: function(stream, buffer, offset, length, pos) { return length; }
        });
        FS.mkdev('/dev/null', FS.makedev(1, 3));
        // setup /dev/tty and /dev/tty1
        // stderr needs to print output using Module['printErr']
        // so we register a second tty just for it.
        TTY.register(FS.makedev(5, 0), TTY.default_tty_ops);
        TTY.register(FS.makedev(6, 0), TTY.default_tty1_ops);
        FS.mkdev('/dev/tty', FS.makedev(5, 0));
        FS.mkdev('/dev/tty1', FS.makedev(6, 0));
        // setup /dev/[u]random
        var random_device;
        if (typeof crypto !== 'undefined') {
          // for modern web browsers
          var randomBuffer = new Uint8Array(1);
          random_device = function() { crypto.getRandomValues(randomBuffer); return randomBuffer[0]; };
        } else if (ENVIRONMENT_IS_NODE) {
          // for nodejs
          random_device = function() { return require('crypto').randomBytes(1)[0]; };
        } else {
          // default for ES5 platforms
          random_device = function() { return (Math.random()*256)|0; };
        }
        FS.createDevice('/dev', 'random', random_device);
        FS.createDevice('/dev', 'urandom', random_device);
        // we're not going to emulate the actual shm device,
        // just create the tmp dirs that reside in it commonly
        FS.mkdir('/dev/shm');
        FS.mkdir('/dev/shm/tmp');
      },createSpecialDirectories:function () {
        // create /proc/self/fd which allows /proc/self/fd/6 => readlink gives the name of the stream for fd 6 (see test_unistd_ttyname)
        FS.mkdir('/proc');
        FS.mkdir('/proc/self');
        FS.mkdir('/proc/self/fd');
        FS.mount({
          mount: function() {
            var node = FS.createNode('/proc/self', 'fd', 16384 | 0777, 73);
            node.node_ops = {
              lookup: function(parent, name) {
                var fd = +name;
                var stream = FS.getStream(fd);
                if (!stream) throw new FS.ErrnoError(ERRNO_CODES.EBADF);
                var ret = {
                  parent: null,
                  mount: { mountpoint: 'fake' },
                  node_ops: { readlink: function() { return stream.path } }
                };
                ret.parent = ret; // make it look like a simple root node
                return ret;
              }
            };
            return node;
          }
        }, {}, '/proc/self/fd');
      },createStandardStreams:function () {
        // TODO deprecate the old functionality of a single
        // input / output callback and that utilizes FS.createDevice
        // and instead require a unique set of stream ops
  
        // by default, we symlink the standard streams to the
        // default tty devices. however, if the standard streams
        // have been overwritten we create a unique device for
        // them instead.
        if (Module['stdin']) {
          FS.createDevice('/dev', 'stdin', Module['stdin']);
        } else {
          FS.symlink('/dev/tty', '/dev/stdin');
        }
        if (Module['stdout']) {
          FS.createDevice('/dev', 'stdout', null, Module['stdout']);
        } else {
          FS.symlink('/dev/tty', '/dev/stdout');
        }
        if (Module['stderr']) {
          FS.createDevice('/dev', 'stderr', null, Module['stderr']);
        } else {
          FS.symlink('/dev/tty1', '/dev/stderr');
        }
  
        // open default streams for the stdin, stdout and stderr devices
        var stdin = FS.open('/dev/stdin', 'r');
        assert(stdin.fd === 0, 'invalid handle for stdin (' + stdin.fd + ')');
  
        var stdout = FS.open('/dev/stdout', 'w');
        assert(stdout.fd === 1, 'invalid handle for stdout (' + stdout.fd + ')');
  
        var stderr = FS.open('/dev/stderr', 'w');
        assert(stderr.fd === 2, 'invalid handle for stderr (' + stderr.fd + ')');
      },ensureErrnoError:function () {
        if (FS.ErrnoError) return;
        FS.ErrnoError = function ErrnoError(errno, node) {
          //Module.printErr(stackTrace()); // useful for debugging
          this.node = node;
          this.setErrno = function(errno) {
            this.errno = errno;
            for (var key in ERRNO_CODES) {
              if (ERRNO_CODES[key] === errno) {
                this.code = key;
                break;
              }
            }
          };
          this.setErrno(errno);
          this.message = ERRNO_MESSAGES[errno];
        };
        FS.ErrnoError.prototype = new Error();
        FS.ErrnoError.prototype.constructor = FS.ErrnoError;
        // Some errors may happen quite a bit, to avoid overhead we reuse them (and suffer a lack of stack info)
        [ERRNO_CODES.ENOENT].forEach(function(code) {
          FS.genericErrors[code] = new FS.ErrnoError(code);
          FS.genericErrors[code].stack = '<generic error, no stack>';
        });
      },staticInit:function () {
        FS.ensureErrnoError();
  
        FS.nameTable = new Array(4096);
  
        FS.mount(MEMFS, {}, '/');
  
        FS.createDefaultDirectories();
        FS.createDefaultDevices();
        FS.createSpecialDirectories();
  
        FS.filesystems = {
          'MEMFS': MEMFS,
          'IDBFS': IDBFS,
          'NODEFS': NODEFS,
          'WORKERFS': WORKERFS,
        };
      },init:function (input, output, error) {
        assert(!FS.init.initialized, 'FS.init was previously called. If you want to initialize later with custom parameters, remove any earlier calls (note that one is automatically added to the generated code)');
        FS.init.initialized = true;
  
        FS.ensureErrnoError();
  
        // Allow Module.stdin etc. to provide defaults, if none explicitly passed to us here
        Module['stdin'] = input || Module['stdin'];
        Module['stdout'] = output || Module['stdout'];
        Module['stderr'] = error || Module['stderr'];
  
        FS.createStandardStreams();
      },quit:function () {
        FS.init.initialized = false;
        // force-flush all streams, so we get musl std streams printed out
        var fflush = Module['_fflush'];
        if (fflush) fflush(0);
        // close all of our streams
        for (var i = 0; i < FS.streams.length; i++) {
          var stream = FS.streams[i];
          if (!stream) {
            continue;
          }
          FS.close(stream);
        }
      },getMode:function (canRead, canWrite) {
        var mode = 0;
        if (canRead) mode |= 292 | 73;
        if (canWrite) mode |= 146;
        return mode;
      },joinPath:function (parts, forceRelative) {
        var path = PATH.join.apply(null, parts);
        if (forceRelative && path[0] == '/') path = path.substr(1);
        return path;
      },absolutePath:function (relative, base) {
        return PATH.resolve(base, relative);
      },standardizePath:function (path) {
        return PATH.normalize(path);
      },findObject:function (path, dontResolveLastLink) {
        var ret = FS.analyzePath(path, dontResolveLastLink);
        if (ret.exists) {
          return ret.object;
        } else {
          ___setErrNo(ret.error);
          return null;
        }
      },analyzePath:function (path, dontResolveLastLink) {
        // operate from within the context of the symlink's target
        try {
          var lookup = FS.lookupPath(path, { follow: !dontResolveLastLink });
          path = lookup.path;
        } catch (e) {
        }
        var ret = {
          isRoot: false, exists: false, error: 0, name: null, path: null, object: null,
          parentExists: false, parentPath: null, parentObject: null
        };
        try {
          var lookup = FS.lookupPath(path, { parent: true });
          ret.parentExists = true;
          ret.parentPath = lookup.path;
          ret.parentObject = lookup.node;
          ret.name = PATH.basename(path);
          lookup = FS.lookupPath(path, { follow: !dontResolveLastLink });
          ret.exists = true;
          ret.path = lookup.path;
          ret.object = lookup.node;
          ret.name = lookup.node.name;
          ret.isRoot = lookup.path === '/';
        } catch (e) {
          ret.error = e.errno;
        };
        return ret;
      },createFolder:function (parent, name, canRead, canWrite) {
        var path = PATH.join2(typeof parent === 'string' ? parent : FS.getPath(parent), name);
        var mode = FS.getMode(canRead, canWrite);
        return FS.mkdir(path, mode);
      },createPath:function (parent, path, canRead, canWrite) {
        parent = typeof parent === 'string' ? parent : FS.getPath(parent);
        var parts = path.split('/').reverse();
        while (parts.length) {
          var part = parts.pop();
          if (!part) continue;
          var current = PATH.join2(parent, part);
          try {
            FS.mkdir(current);
          } catch (e) {
            // ignore EEXIST
          }
          parent = current;
        }
        return current;
      },createFile:function (parent, name, properties, canRead, canWrite) {
        var path = PATH.join2(typeof parent === 'string' ? parent : FS.getPath(parent), name);
        var mode = FS.getMode(canRead, canWrite);
        return FS.create(path, mode);
      },createDataFile:function (parent, name, data, canRead, canWrite, canOwn) {
        var path = name ? PATH.join2(typeof parent === 'string' ? parent : FS.getPath(parent), name) : parent;
        var mode = FS.getMode(canRead, canWrite);
        var node = FS.create(path, mode);
        if (data) {
          if (typeof data === 'string') {
            var arr = new Array(data.length);
            for (var i = 0, len = data.length; i < len; ++i) arr[i] = data.charCodeAt(i);
            data = arr;
          }
          // make sure we can write to the file
          FS.chmod(node, mode | 146);
          var stream = FS.open(node, 'w');
          FS.write(stream, data, 0, data.length, 0, canOwn);
          FS.close(stream);
          FS.chmod(node, mode);
        }
        return node;
      },createDevice:function (parent, name, input, output) {
        var path = PATH.join2(typeof parent === 'string' ? parent : FS.getPath(parent), name);
        var mode = FS.getMode(!!input, !!output);
        if (!FS.createDevice.major) FS.createDevice.major = 64;
        var dev = FS.makedev(FS.createDevice.major++, 0);
        // Create a fake device that a set of stream ops to emulate
        // the old behavior.
        FS.registerDevice(dev, {
          open: function(stream) {
            stream.seekable = false;
          },
          close: function(stream) {
            // flush any pending line data
            if (output && output.buffer && output.buffer.length) {
              output(10);
            }
          },
          read: function(stream, buffer, offset, length, pos /* ignored */) {
            var bytesRead = 0;
            for (var i = 0; i < length; i++) {
              var result;
              try {
                result = input();
              } catch (e) {
                throw new FS.ErrnoError(ERRNO_CODES.EIO);
              }
              if (result === undefined && bytesRead === 0) {
                throw new FS.ErrnoError(ERRNO_CODES.EAGAIN);
              }
              if (result === null || result === undefined) break;
              bytesRead++;
              buffer[offset+i] = result;
            }
            if (bytesRead) {
              stream.node.timestamp = Date.now();
            }
            return bytesRead;
          },
          write: function(stream, buffer, offset, length, pos) {
            for (var i = 0; i < length; i++) {
              try {
                output(buffer[offset+i]);
              } catch (e) {
                throw new FS.ErrnoError(ERRNO_CODES.EIO);
              }
            }
            if (length) {
              stream.node.timestamp = Date.now();
            }
            return i;
          }
        });
        return FS.mkdev(path, mode, dev);
      },createLink:function (parent, name, target, canRead, canWrite) {
        var path = PATH.join2(typeof parent === 'string' ? parent : FS.getPath(parent), name);
        return FS.symlink(target, path);
      },forceLoadFile:function (obj) {
        if (obj.isDevice || obj.isFolder || obj.link || obj.contents) return true;
        var success = true;
        if (typeof XMLHttpRequest !== 'undefined') {
          throw new Error("Lazy loading should have been performed (contents set) in createLazyFile, but it was not. Lazy loading only works in web workers. Use --embed-file or --preload-file in emcc on the main thread.");
        } else if (Module['read']) {
          // Command-line.
          try {
            // WARNING: Can't read binary files in V8's d8 or tracemonkey's js, as
            //          read() will try to parse UTF8.
            obj.contents = intArrayFromString(Module['read'](obj.url), true);
            obj.usedBytes = obj.contents.length;
          } catch (e) {
            success = false;
          }
        } else {
          throw new Error('Cannot load without read() or XMLHttpRequest.');
        }
        if (!success) ___setErrNo(ERRNO_CODES.EIO);
        return success;
      },createLazyFile:function (parent, name, url, canRead, canWrite) {
        // Lazy chunked Uint8Array (implements get and length from Uint8Array). Actual getting is abstracted away for eventual reuse.
        function LazyUint8Array() {
          this.lengthKnown = false;
          this.chunks = []; // Loaded chunks. Index is the chunk number
        }
        LazyUint8Array.prototype.get = function LazyUint8Array_get(idx) {
          if (idx > this.length-1 || idx < 0) {
            return undefined;
          }
          var chunkOffset = idx % this.chunkSize;
          var chunkNum = (idx / this.chunkSize)|0;
          return this.getter(chunkNum)[chunkOffset];
        }
        LazyUint8Array.prototype.setDataGetter = function LazyUint8Array_setDataGetter(getter) {
          this.getter = getter;
        }
        LazyUint8Array.prototype.cacheLength = function LazyUint8Array_cacheLength() {
          // Find length
          var xhr = new XMLHttpRequest();
          xhr.open('HEAD', url, false);
          xhr.send(null);
          if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304)) throw new Error("Couldn't load " + url + ". Status: " + xhr.status);
          var datalength = Number(xhr.getResponseHeader("Content-length"));
          var header;
          var hasByteServing = (header = xhr.getResponseHeader("Accept-Ranges")) && header === "bytes";
          var usesGzip = (header = xhr.getResponseHeader("Content-Encoding")) && header === "gzip";
  
          var chunkSize = 1024*1024; // Chunk size in bytes
  
          if (!hasByteServing) chunkSize = datalength;
  
          // Function to get a range from the remote URL.
          var doXHR = (function(from, to) {
            if (from > to) throw new Error("invalid range (" + from + ", " + to + ") or no bytes requested!");
            if (to > datalength-1) throw new Error("only " + datalength + " bytes available! programmer error!");
  
            // TODO: Use mozResponseArrayBuffer, responseStream, etc. if available.
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url, false);
            if (datalength !== chunkSize) xhr.setRequestHeader("Range", "bytes=" + from + "-" + to);
  
            // Some hints to the browser that we want binary data.
            if (typeof Uint8Array != 'undefined') xhr.responseType = 'arraybuffer';
            if (xhr.overrideMimeType) {
              xhr.overrideMimeType('text/plain; charset=x-user-defined');
            }
  
            xhr.send(null);
            if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304)) throw new Error("Couldn't load " + url + ". Status: " + xhr.status);
            if (xhr.response !== undefined) {
              return new Uint8Array(xhr.response || []);
            } else {
              return intArrayFromString(xhr.responseText || '', true);
            }
          });
          var lazyArray = this;
          lazyArray.setDataGetter(function(chunkNum) {
            var start = chunkNum * chunkSize;
            var end = (chunkNum+1) * chunkSize - 1; // including this byte
            end = Math.min(end, datalength-1); // if datalength-1 is selected, this is the last block
            if (typeof(lazyArray.chunks[chunkNum]) === "undefined") {
              lazyArray.chunks[chunkNum] = doXHR(start, end);
            }
            if (typeof(lazyArray.chunks[chunkNum]) === "undefined") throw new Error("doXHR failed!");
            return lazyArray.chunks[chunkNum];
          });
  
          if (usesGzip || !datalength) {
            // if the server uses gzip or doesn't supply the length, we have to download the whole file to get the (uncompressed) length
            chunkSize = datalength = 1; // this will force getter(0)/doXHR do download the whole file
            datalength = this.getter(0).length;
            chunkSize = datalength;
            console.log("LazyFiles on gzip forces download of the whole file when length is accessed");
          }
  
          this._length = datalength;
          this._chunkSize = chunkSize;
          this.lengthKnown = true;
        }
        if (typeof XMLHttpRequest !== 'undefined') {
          if (!ENVIRONMENT_IS_WORKER) throw 'Cannot do synchronous binary XHRs outside webworkers in modern browsers. Use --embed-file or --preload-file in emcc';
          var lazyArray = new LazyUint8Array();
          Object.defineProperties(lazyArray, {
            length: {
              get: function() {
                if(!this.lengthKnown) {
                  this.cacheLength();
                }
                return this._length;
              }
            },
            chunkSize: {
              get: function() {
                if(!this.lengthKnown) {
                  this.cacheLength();
                }
                return this._chunkSize;
              }
            }
          });
  
          var properties = { isDevice: false, contents: lazyArray };
        } else {
          var properties = { isDevice: false, url: url };
        }
  
        var node = FS.createFile(parent, name, properties, canRead, canWrite);
        // This is a total hack, but I want to get this lazy file code out of the
        // core of MEMFS. If we want to keep this lazy file concept I feel it should
        // be its own thin LAZYFS proxying calls to MEMFS.
        if (properties.contents) {
          node.contents = properties.contents;
        } else if (properties.url) {
          node.contents = null;
          node.url = properties.url;
        }
        // Add a function that defers querying the file size until it is asked the first time.
        Object.defineProperties(node, {
          usedBytes: {
            get: function() { return this.contents.length; }
          }
        });
        // override each stream op with one that tries to force load the lazy file first
        var stream_ops = {};
        var keys = Object.keys(node.stream_ops);
        keys.forEach(function(key) {
          var fn = node.stream_ops[key];
          stream_ops[key] = function forceLoadLazyFile() {
            if (!FS.forceLoadFile(node)) {
              throw new FS.ErrnoError(ERRNO_CODES.EIO);
            }
            return fn.apply(null, arguments);
          };
        });
        // use a custom read function
        stream_ops.read = function stream_ops_read(stream, buffer, offset, length, position) {
          if (!FS.forceLoadFile(node)) {
            throw new FS.ErrnoError(ERRNO_CODES.EIO);
          }
          var contents = stream.node.contents;
          if (position >= contents.length)
            return 0;
          var size = Math.min(contents.length - position, length);
          assert(size >= 0);
          if (contents.slice) { // normal array
            for (var i = 0; i < size; i++) {
              buffer[offset + i] = contents[position + i];
            }
          } else {
            for (var i = 0; i < size; i++) { // LazyUint8Array from sync binary XHR
              buffer[offset + i] = contents.get(position + i);
            }
          }
          return size;
        };
        node.stream_ops = stream_ops;
        return node;
      },createPreloadedFile:function (parent, name, url, canRead, canWrite, onload, onerror, dontCreateFile, canOwn, preFinish) {
        Browser.init(); // XXX perhaps this method should move onto Browser?
        // TODO we should allow people to just pass in a complete filename instead
        // of parent and name being that we just join them anyways
        var fullname = name ? PATH.resolve(PATH.join2(parent, name)) : parent;
        var dep = getUniqueRunDependency('cp ' + fullname); // might have several active requests for the same fullname
        function processData(byteArray) {
          function finish(byteArray) {
            if (preFinish) preFinish();
            if (!dontCreateFile) {
              FS.createDataFile(parent, name, byteArray, canRead, canWrite, canOwn);
            }
            if (onload) onload();
            removeRunDependency(dep);
          }
          var handled = false;
          Module['preloadPlugins'].forEach(function(plugin) {
            if (handled) return;
            if (plugin['canHandle'](fullname)) {
              plugin['handle'](byteArray, fullname, finish, function() {
                if (onerror) onerror();
                removeRunDependency(dep);
              });
              handled = true;
            }
          });
          if (!handled) finish(byteArray);
        }
        addRunDependency(dep);
        if (typeof url == 'string') {
          Browser.asyncLoad(url, function(byteArray) {
            processData(byteArray);
          }, onerror);
        } else {
          processData(url);
        }
      },indexedDB:function () {
        return window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
      },DB_NAME:function () {
        return 'EM_FS_' + window.location.pathname;
      },DB_VERSION:20,DB_STORE_NAME:"FILE_DATA",saveFilesToDB:function (paths, onload, onerror) {
        onload = onload || function(){};
        onerror = onerror || function(){};
        var indexedDB = FS.indexedDB();
        try {
          var openRequest = indexedDB.open(FS.DB_NAME(), FS.DB_VERSION);
        } catch (e) {
          return onerror(e);
        }
        openRequest.onupgradeneeded = function openRequest_onupgradeneeded() {
          console.log('creating db');
          var db = openRequest.result;
          db.createObjectStore(FS.DB_STORE_NAME);
        };
        openRequest.onsuccess = function openRequest_onsuccess() {
          var db = openRequest.result;
          var transaction = db.transaction([FS.DB_STORE_NAME], 'readwrite');
          var files = transaction.objectStore(FS.DB_STORE_NAME);
          var ok = 0, fail = 0, total = paths.length;
          function finish() {
            if (fail == 0) onload(); else onerror();
          }
          paths.forEach(function(path) {
            var putRequest = files.put(FS.analyzePath(path).object.contents, path);
            putRequest.onsuccess = function putRequest_onsuccess() { ok++; if (ok + fail == total) finish() };
            putRequest.onerror = function putRequest_onerror() { fail++; if (ok + fail == total) finish() };
          });
          transaction.onerror = onerror;
        };
        openRequest.onerror = onerror;
      },loadFilesFromDB:function (paths, onload, onerror) {
        onload = onload || function(){};
        onerror = onerror || function(){};
        var indexedDB = FS.indexedDB();
        try {
          var openRequest = indexedDB.open(FS.DB_NAME(), FS.DB_VERSION);
        } catch (e) {
          return onerror(e);
        }
        openRequest.onupgradeneeded = onerror; // no database to load from
        openRequest.onsuccess = function openRequest_onsuccess() {
          var db = openRequest.result;
          try {
            var transaction = db.transaction([FS.DB_STORE_NAME], 'readonly');
          } catch(e) {
            onerror(e);
            return;
          }
          var files = transaction.objectStore(FS.DB_STORE_NAME);
          var ok = 0, fail = 0, total = paths.length;
          function finish() {
            if (fail == 0) onload(); else onerror();
          }
          paths.forEach(function(path) {
            var getRequest = files.get(path);
            getRequest.onsuccess = function getRequest_onsuccess() {
              if (FS.analyzePath(path).exists) {
                FS.unlink(path);
              }
              FS.createDataFile(PATH.dirname(path), PATH.basename(path), getRequest.result, true, true, true);
              ok++;
              if (ok + fail == total) finish();
            };
            getRequest.onerror = function getRequest_onerror() { fail++; if (ok + fail == total) finish() };
          });
          transaction.onerror = onerror;
        };
        openRequest.onerror = onerror;
      }};var SYSCALLS={DEFAULT_POLLMASK:5,mappings:{},umask:511,calculateAt:function (dirfd, path) {
        if (path[0] !== '/') {
          // relative path
          var dir;
          if (dirfd === -100) {
            dir = FS.cwd();
          } else {
            var dirstream = FS.getStream(dirfd);
            if (!dirstream) throw new FS.ErrnoError(ERRNO_CODES.EBADF);
            dir = dirstream.path;
          }
          path = PATH.join2(dir, path);
        }
        return path;
      },doStat:function (func, path, buf) {
        try {
          var stat = func(path);
        } catch (e) {
          if (e && e.node && PATH.normalize(path) !== PATH.normalize(FS.getPath(e.node))) {
            // an error occurred while trying to look up the path; we should just report ENOTDIR
            return -ERRNO_CODES.ENOTDIR;
          }
          throw e;
        }
        HEAP32[((buf)>>2)]=stat.dev;
        HEAP32[(((buf)+(4))>>2)]=0;
        HEAP32[(((buf)+(8))>>2)]=stat.ino;
        HEAP32[(((buf)+(12))>>2)]=stat.mode;
        HEAP32[(((buf)+(16))>>2)]=stat.nlink;
        HEAP32[(((buf)+(20))>>2)]=stat.uid;
        HEAP32[(((buf)+(24))>>2)]=stat.gid;
        HEAP32[(((buf)+(28))>>2)]=stat.rdev;
        HEAP32[(((buf)+(32))>>2)]=0;
        HEAP32[(((buf)+(36))>>2)]=stat.size;
        HEAP32[(((buf)+(40))>>2)]=4096;
        HEAP32[(((buf)+(44))>>2)]=stat.blocks;
        HEAP32[(((buf)+(48))>>2)]=(stat.atime.getTime() / 1000)|0;
        HEAP32[(((buf)+(52))>>2)]=0;
        HEAP32[(((buf)+(56))>>2)]=(stat.mtime.getTime() / 1000)|0;
        HEAP32[(((buf)+(60))>>2)]=0;
        HEAP32[(((buf)+(64))>>2)]=(stat.ctime.getTime() / 1000)|0;
        HEAP32[(((buf)+(68))>>2)]=0;
        HEAP32[(((buf)+(72))>>2)]=stat.ino;
        return 0;
      },doMsync:function (addr, stream, len, flags) {
        var buffer = new Uint8Array(HEAPU8.subarray(addr, addr + len));
        FS.msync(stream, buffer, 0, len, flags);
      },doMkdir:function (path, mode) {
        // remove a trailing slash, if one - /a/b/ has basename of '', but
        // we want to create b in the context of this function
        path = PATH.normalize(path);
        if (path[path.length-1] === '/') path = path.substr(0, path.length-1);
        FS.mkdir(path, mode, 0);
        return 0;
      },doMknod:function (path, mode, dev) {
        // we don't want this in the JS API as it uses mknod to create all nodes.
        switch (mode & 61440) {
          case 32768:
          case 8192:
          case 24576:
          case 4096:
          case 49152:
            break;
          default: return -ERRNO_CODES.EINVAL;
        }
        FS.mknod(path, mode, dev);
        return 0;
      },doReadlink:function (path, buf, bufsize) {
        if (bufsize <= 0) return -ERRNO_CODES.EINVAL;
        var ret = FS.readlink(path);
        ret = ret.slice(0, Math.max(0, bufsize));
        writeStringToMemory(ret, buf, true);
        return ret.length;
      },doAccess:function (path, amode) {
        if (amode & ~7) {
          // need a valid mode
          return -ERRNO_CODES.EINVAL;
        }
        var node;
        var lookup = FS.lookupPath(path, { follow: true });
        node = lookup.node;
        var perms = '';
        if (amode & 4) perms += 'r';
        if (amode & 2) perms += 'w';
        if (amode & 1) perms += 'x';
        if (perms /* otherwise, they've just passed F_OK */ && FS.nodePermissions(node, perms)) {
          return -ERRNO_CODES.EACCES;
        }
        return 0;
      },doDup:function (path, flags, suggestFD) {
        var suggest = FS.getStream(suggestFD);
        if (suggest) FS.close(suggest);
        return FS.open(path, flags, 0, suggestFD, suggestFD).fd;
      },doReadv:function (stream, iov, iovcnt, offset) {
        var ret = 0;
        for (var i = 0; i < iovcnt; i++) {
          var ptr = HEAP32[(((iov)+(i*8))>>2)];
          var len = HEAP32[(((iov)+(i*8 + 4))>>2)];
          var curr = FS.read(stream, HEAP8,ptr, len, offset);
          if (curr < 0) return -1;
          ret += curr;
          if (curr < len) break; // nothing more to read
        }
        return ret;
      },doWritev:function (stream, iov, iovcnt, offset) {
        var ret = 0;
        for (var i = 0; i < iovcnt; i++) {
          var ptr = HEAP32[(((iov)+(i*8))>>2)];
          var len = HEAP32[(((iov)+(i*8 + 4))>>2)];
          var curr = FS.write(stream, HEAP8,ptr, len, offset);
          if (curr < 0) return -1;
          ret += curr;
        }
        return ret;
      },varargs:0,get:function (varargs) {
        SYSCALLS.varargs += 4;
        var ret = HEAP32[(((SYSCALLS.varargs)-(4))>>2)];
        return ret;
      },getStr:function () {
        var ret = Pointer_stringify(SYSCALLS.get());
        return ret;
      },getStreamFromFD:function () {
        var stream = FS.getStream(SYSCALLS.get());
        if (!stream) throw new FS.ErrnoError(ERRNO_CODES.EBADF);
        return stream;
      },getSocketFromFD:function () {
        var socket = SOCKFS.getSocket(SYSCALLS.get());
        if (!socket) throw new FS.ErrnoError(ERRNO_CODES.EBADF);
        return socket;
      },getSocketAddress:function (allowNull) {
        var addrp = SYSCALLS.get(), addrlen = SYSCALLS.get();
        if (allowNull && addrp === 0) return null;
        var info = __read_sockaddr(addrp, addrlen);
        if (info.errno) throw new FS.ErrnoError(info.errno);
        info.addr = DNS.lookup_addr(info.addr) || info.addr;
        return info;
      },get64:function () {
        var low = SYSCALLS.get(), high = SYSCALLS.get();
        if (low >= 0) assert(high === 0);
        else assert(high === -1);
        return low;
      },getZero:function () {
        assert(SYSCALLS.get() === 0);
      }};function ___syscall10(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // unlink
      var path = SYSCALLS.getStr();
      FS.unlink(path);
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

   
  Module["_pthread_cond_broadcast"] = _pthread_cond_broadcast;

  function _pthread_cleanup_pop() {
      assert(_pthread_cleanup_push.level == __ATEXIT__.length, 'cannot pop if something else added meanwhile!');
      __ATEXIT__.pop();
      _pthread_cleanup_push.level = __ATEXIT__.length;
    }

  function ___cxa_begin_catch(ptr) {
      __ZSt18uncaught_exceptionv.uncaught_exception--;
      EXCEPTIONS.caught.push(ptr);
      EXCEPTIONS.addRef(EXCEPTIONS.deAdjust(ptr));
      return ptr;
    }

  
  function _emscripten_memcpy_big(dest, src, num) {
      HEAPU8.set(HEAPU8.subarray(src, src+num), dest);
      return dest;
    } 
  Module["_memcpy"] = _memcpy;

  function _nativePushString(string)
  	{
  		nativeState.arguments.push({
  			type: 'string',
  			val: Pointer_stringify(string)
  		});
  	}

  function ___syscall6(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // close
      var stream = SYSCALLS.getStreamFromFD();
      FS.close(stream);
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }


  
   
  Module["___muldsi3"] = ___muldsi3; 
  Module["___muldi3"] = ___muldi3;

  function _sbrk(bytes) {
      // Implement a Linux-like 'memory area' for our 'process'.
      // Changes the size of the memory area by |bytes|; returns the
      // address of the previous top ('break') of the memory area
      // We control the "dynamic" memory - DYNAMIC_BASE to DYNAMICTOP
      var self = _sbrk;
      if (!self.called) {
        DYNAMICTOP = alignMemoryPage(DYNAMICTOP); // make sure we start out aligned
        self.called = true;
        assert(Runtime.dynamicAlloc);
        self.alloc = Runtime.dynamicAlloc;
        Runtime.dynamicAlloc = function() { abort('cannot dynamically allocate, sbrk now has control') };
      }
      var ret = DYNAMICTOP;
      if (bytes != 0) {
        var success = self.alloc(bytes);
        if (!success) return -1 >>> 0; // sbrk failure code
      }
      return ret;  // Previous break location.
    }

   
  Module["_bitshift64Shl"] = _bitshift64Shl;

  function _nativeCallVector3(pX, pY, pZ)
  	{
  		'use strict';
  
  		let vector = NATIVE.callNative(Citizen.resultAsVector());
  
  		setValue(pX, vector[0], 'float');
  		setValue(pY, vector[1], 'float');
  		setValue(pZ, vector[2], 'float');
  	}

   
  Module["_memmove"] = _memmove;

  function ___gxx_personality_v0() {
    }

   
  Module["___uremdi3"] = ___uremdi3;

  function ___syscall54(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // ioctl
      var stream = SYSCALLS.getStreamFromFD(), op = SYSCALLS.get();
      switch (op) {
        case 21505: {
          if (!stream.tty) return -ERRNO_CODES.ENOTTY;
          return 0;
        }
        case 21506: {
          if (!stream.tty) return -ERRNO_CODES.ENOTTY;
          return 0; // no-op, not actually adjusting terminal settings
        }
        case 21519: {
          if (!stream.tty) return -ERRNO_CODES.ENOTTY;
          var argp = SYSCALLS.get();
          HEAP32[((argp)>>2)]=0;
          return 0;
        }
        case 21520: {
          if (!stream.tty) return -ERRNO_CODES.ENOTTY;
          return -ERRNO_CODES.EINVAL; // not supported
        }
        case 21531: {
          var argp = SYSCALLS.get();
          return FS.ioctl(stream, op, argp);
        }
        default: abort('bad ioctl syscall ' + op);
      }
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function _pthread_cond_wait() { return 0; }

  function _nativePushInt(val)
  	{
  		nativeState.arguments.push({
  			type: 'int',
  			val: val
  		});
  	}

   
  Module["_pthread_mutex_unlock"] = _pthread_mutex_unlock;

  function _nativePushFloat(val)
  	{
  		nativeState.arguments.push({
  			type: 'float',
  			val: (val === 0) ? val : val + 0.00001
  		});
  	}

   
  Module["_pthread_self"] = _pthread_self;

  function ___syscall140(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // llseek
      var stream = SYSCALLS.getStreamFromFD(), offset_high = SYSCALLS.get(), offset_low = SYSCALLS.get(), result = SYSCALLS.get(), whence = SYSCALLS.get();
      var offset = offset_low;
      assert(offset_high === 0);
      FS.llseek(stream, offset, whence);
      HEAP32[((result)>>2)]=stream.position;
      if (stream.getdents && offset === 0 && whence === 0) stream.getdents = null; // reset readdir state
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___syscall146(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // writev
      var stream = SYSCALLS.getStreamFromFD(), iov = SYSCALLS.get(), iovcnt = SYSCALLS.get();
      return SYSCALLS.doWritev(stream, iov, iovcnt);
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___syscall40(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // rmdir
      var path = SYSCALLS.getStr();
      FS.rmdir(path);
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___syscall145(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // readv
      var stream = SYSCALLS.getStreamFromFD(), iov = SYSCALLS.get(), iovcnt = SYSCALLS.get();
      return SYSCALLS.doReadv(stream, iov, iovcnt);
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }
Module["requestFullScreen"] = function Module_requestFullScreen(lockPointer, resizeCanvas, vrDevice) { Module.printErr("Module.requestFullScreen is deprecated. Please call Module.requestFullscreen instead."); Module["requestFullScreen"] = Module["requestFullscreen"]; Browser.requestFullScreen(lockPointer, resizeCanvas, vrDevice) };
  Module["requestFullscreen"] = function Module_requestFullscreen(lockPointer, resizeCanvas, vrDevice) { Browser.requestFullscreen(lockPointer, resizeCanvas, vrDevice) };
  Module["requestAnimationFrame"] = function Module_requestAnimationFrame(func) { Browser.requestAnimationFrame(func) };
  Module["setCanvasSize"] = function Module_setCanvasSize(width, height, noUpdates) { Browser.setCanvasSize(width, height, noUpdates) };
  Module["pauseMainLoop"] = function Module_pauseMainLoop() { Browser.mainLoop.pause() };
  Module["resumeMainLoop"] = function Module_resumeMainLoop() { Browser.mainLoop.resume() };
  Module["getUserMedia"] = function Module_getUserMedia() { Browser.getUserMedia() }
  Module["createContext"] = function Module_createContext(canvas, useWebGL, setInModule, webGLContextAttributes) { return Browser.createContext(canvas, useWebGL, setInModule, webGLContextAttributes) };
if (ENVIRONMENT_IS_NODE) {
    _emscripten_get_now = function _emscripten_get_now_actual() {
      var t = process['hrtime']();
      return t[0] * 1e3 + t[1] / 1e6;
    };
  } else if (typeof dateNow !== 'undefined') {
    _emscripten_get_now = dateNow;
  } else if (typeof self === 'object' && self['performance'] && typeof self['performance']['now'] === 'function') {
    _emscripten_get_now = function() { return self['performance']['now'](); };
  } else if (typeof performance === 'object' && typeof performance['now'] === 'function') {
    _emscripten_get_now = function() { return performance['now'](); };
  } else {
    _emscripten_get_now = Date.now;
  };
FS.staticInit();__ATINIT__.unshift(function() { if (!Module["noFSInit"] && !FS.init.initialized) FS.init() });__ATMAIN__.push(function() { FS.ignorePermissions = false });__ATEXIT__.push(function() { FS.quit() });Module["FS_createFolder"] = FS.createFolder;Module["FS_createPath"] = FS.createPath;Module["FS_createDataFile"] = FS.createDataFile;Module["FS_createPreloadedFile"] = FS.createPreloadedFile;Module["FS_createLazyFile"] = FS.createLazyFile;Module["FS_createLink"] = FS.createLink;Module["FS_createDevice"] = FS.createDevice;Module["FS_unlink"] = FS.unlink;;
__ATINIT__.unshift(function() { TTY.init() });__ATEXIT__.push(function() { TTY.shutdown() });;
if (ENVIRONMENT_IS_NODE) { var fs = require("fs"); var NODEJS_PATH = require("path"); NODEFS.staticInit(); };
STACK_BASE = STACKTOP = Runtime.alignMemory(STATICTOP);

staticSealed = true; // seal the static portion of memory

STACK_MAX = STACK_BASE + TOTAL_STACK;

DYNAMIC_BASE = DYNAMICTOP = Runtime.alignMemory(STACK_MAX);



function invoke_iiiiiiii(index,a1,a2,a3,a4,a5,a6,a7) {
  try {
    return Module["dynCall_iiiiiiii"](index,a1,a2,a3,a4,a5,a6,a7);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}

function invoke_iiii(index,a1,a2,a3) {
  try {
    return Module["dynCall_iiii"](index,a1,a2,a3);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}

function invoke_viiiiii(index,a1,a2,a3,a4,a5,a6) {
  try {
    Module["dynCall_viiiiii"](index,a1,a2,a3,a4,a5,a6);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}

function invoke_viiiii(index,a1,a2,a3,a4,a5) {
  try {
    Module["dynCall_viiiii"](index,a1,a2,a3,a4,a5);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}

function invoke_iiiiiid(index,a1,a2,a3,a4,a5,a6) {
  try {
    return Module["dynCall_iiiiiid"](index,a1,a2,a3,a4,a5,a6);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}

function invoke_i(index) {
  try {
    return Module["dynCall_i"](index);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}

function invoke_vi(index,a1) {
  try {
    Module["dynCall_vi"](index,a1);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}

function invoke_vii(index,a1,a2) {
  try {
    Module["dynCall_vii"](index,a1,a2);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}

function invoke_iiiiiii(index,a1,a2,a3,a4,a5,a6) {
  try {
    return Module["dynCall_iiiiiii"](index,a1,a2,a3,a4,a5,a6);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}

function invoke_ii(index,a1) {
  try {
    return Module["dynCall_ii"](index,a1);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}

function invoke_viii(index,a1,a2,a3) {
  try {
    Module["dynCall_viii"](index,a1,a2,a3);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}

function invoke_v(index) {
  try {
    Module["dynCall_v"](index);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}

function invoke_iiiiiiiii(index,a1,a2,a3,a4,a5,a6,a7,a8) {
  try {
    return Module["dynCall_iiiiiiiii"](index,a1,a2,a3,a4,a5,a6,a7,a8);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}

function invoke_iiiii(index,a1,a2,a3,a4) {
  try {
    return Module["dynCall_iiiii"](index,a1,a2,a3,a4);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}

function invoke_viiii(index,a1,a2,a3,a4) {
  try {
    Module["dynCall_viiii"](index,a1,a2,a3,a4);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}

function invoke_iii(index,a1,a2) {
  try {
    return Module["dynCall_iii"](index,a1,a2);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}

function invoke_iiiiid(index,a1,a2,a3,a4,a5) {
  try {
    return Module["dynCall_iiiiid"](index,a1,a2,a3,a4,a5);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}

function invoke_iiiiii(index,a1,a2,a3,a4,a5) {
  try {
    return Module["dynCall_iiiiii"](index,a1,a2,a3,a4,a5);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}

Module.asmGlobalArg = { "Math": Math, "Int8Array": Int8Array, "Int16Array": Int16Array, "Int32Array": Int32Array, "Uint8Array": Uint8Array, "Uint16Array": Uint16Array, "Uint32Array": Uint32Array, "Float32Array": Float32Array, "Float64Array": Float64Array, "NaN": NaN, "Infinity": Infinity };

Module.asmLibraryArg = { "abort": abort, "assert": assert, "invoke_iiiiiiii": invoke_iiiiiiii, "invoke_iiii": invoke_iiii, "invoke_viiiiii": invoke_viiiiii, "invoke_viiiii": invoke_viiiii, "invoke_iiiiiid": invoke_iiiiiid, "invoke_i": invoke_i, "invoke_vi": invoke_vi, "invoke_vii": invoke_vii, "invoke_iiiiiii": invoke_iiiiiii, "invoke_ii": invoke_ii, "invoke_viii": invoke_viii, "invoke_v": invoke_v, "invoke_iiiiiiiii": invoke_iiiiiiiii, "invoke_iiiii": invoke_iiiii, "invoke_viiii": invoke_viiii, "invoke_iii": invoke_iii, "invoke_iiiiid": invoke_iiiiid, "invoke_iiiiii": invoke_iiiiii, "_pthread_cleanup_pop": _pthread_cleanup_pop, "_strftime": _strftime, "_pthread_cond_wait": _pthread_cond_wait, "_nativeCallFloat": _nativeCallFloat, "_pthread_key_create": _pthread_key_create, "_abort": _abort, "___syscall40": ___syscall40, "_llvm_fabs_f64": _llvm_fabs_f64, "_emscripten_set_main_loop_timing": _emscripten_set_main_loop_timing, "___gxx_personality_v0": ___gxx_personality_v0, "_nativePushPtr": _nativePushPtr, "_system": _system, "___assert_fail": ___assert_fail, "___cxa_allocate_exception": ___cxa_allocate_exception, "__ZSt18uncaught_exceptionv": __ZSt18uncaught_exceptionv, "__addDays": __addDays, "_strftime_l": _strftime_l, "___setErrNo": ___setErrNo, "_sbrk": _sbrk, "_nativeCallInt": _nativeCallInt, "___cxa_begin_catch": ___cxa_begin_catch, "_emscripten_memcpy_big": _emscripten_memcpy_big, "___resumeException": ___resumeException, "___cxa_find_matching_catch": ___cxa_find_matching_catch, "_pthread_getspecific": _pthread_getspecific, "__arraySum": __arraySum, "_pthread_once": _pthread_once, "_nativePushString": _nativePushString, "___syscall54": ___syscall54, "___unlock": ___unlock, "_emscripten_sleep": _emscripten_sleep, "__isLeapYear": __isLeapYear, "_emscripten_set_main_loop": _emscripten_set_main_loop, "_emscripten_get_now": _emscripten_get_now, "___syscall10": ___syscall10, "_nativePushFloat": _nativePushFloat, "_nativeInit": _nativeInit, "_pthread_setspecific": _pthread_setspecific, "___cxa_throw": ___cxa_throw, "___lock": ___lock, "_nativeCallString": _nativeCallString, "___syscall6": ___syscall6, "_pthread_cleanup_push": _pthread_cleanup_push, "_nativePushInt": _nativePushInt, "___syscall140": ___syscall140, "_nativeCallVector3": _nativeCallVector3, "___syscall145": ___syscall145, "___syscall146": ___syscall146, "STACKTOP": STACKTOP, "STACK_MAX": STACK_MAX, "tempDoublePtr": tempDoublePtr, "ABORT": ABORT, "cttz_i8": cttz_i8 };
Module.asmLibraryArg['EMTSTACKTOP'] = EMTSTACKTOP; Module.asmLibraryArg['EMT_STACK_MAX'] = EMT_STACK_MAX; Module.asmLibraryArg['eb'] = eb;
// EMSCRIPTEN_START_ASM
var asm = (function(global, env, buffer) {
  'use asm';
  
  
  var HEAP8 = new global.Int8Array(buffer);
  var HEAP16 = new global.Int16Array(buffer);
  var HEAP32 = new global.Int32Array(buffer);
  var HEAPU8 = new global.Uint8Array(buffer);
  var HEAPU16 = new global.Uint16Array(buffer);
  var HEAPU32 = new global.Uint32Array(buffer);
  var HEAPF32 = new global.Float32Array(buffer);
  var HEAPF64 = new global.Float64Array(buffer);


  var STACKTOP=env.STACKTOP|0;
  var STACK_MAX=env.STACK_MAX|0;
  var tempDoublePtr=env.tempDoublePtr|0;
  var ABORT=env.ABORT|0;
  var cttz_i8=env.cttz_i8|0;

  var __THREW__ = 0;
  var threwValue = 0;
  var setjmpId = 0;
  var undef = 0;
  var nan = global.NaN, inf = global.Infinity;
  var tempInt = 0, tempBigInt = 0, tempBigIntP = 0, tempBigIntS = 0, tempBigIntR = 0.0, tempBigIntI = 0, tempBigIntD = 0, tempValue = 0, tempDouble = 0.0;
  var tempRet0 = 0;

  var Math_floor=global.Math.floor;
  var Math_abs=global.Math.abs;
  var Math_sqrt=global.Math.sqrt;
  var Math_pow=global.Math.pow;
  var Math_cos=global.Math.cos;
  var Math_sin=global.Math.sin;
  var Math_tan=global.Math.tan;
  var Math_acos=global.Math.acos;
  var Math_asin=global.Math.asin;
  var Math_atan=global.Math.atan;
  var Math_atan2=global.Math.atan2;
  var Math_exp=global.Math.exp;
  var Math_log=global.Math.log;
  var Math_ceil=global.Math.ceil;
  var Math_imul=global.Math.imul;
  var Math_min=global.Math.min;
  var Math_clz32=global.Math.clz32;
  var abort=env.abort;
  var assert=env.assert;
  var invoke_iiiiiiii=env.invoke_iiiiiiii;
  var invoke_iiii=env.invoke_iiii;
  var invoke_viiiiii=env.invoke_viiiiii;
  var invoke_viiiii=env.invoke_viiiii;
  var invoke_iiiiiid=env.invoke_iiiiiid;
  var invoke_i=env.invoke_i;
  var invoke_vi=env.invoke_vi;
  var invoke_vii=env.invoke_vii;
  var invoke_iiiiiii=env.invoke_iiiiiii;
  var invoke_ii=env.invoke_ii;
  var invoke_viii=env.invoke_viii;
  var invoke_v=env.invoke_v;
  var invoke_iiiiiiiii=env.invoke_iiiiiiiii;
  var invoke_iiiii=env.invoke_iiiii;
  var invoke_viiii=env.invoke_viiii;
  var invoke_iii=env.invoke_iii;
  var invoke_iiiiid=env.invoke_iiiiid;
  var invoke_iiiiii=env.invoke_iiiiii;
  var _pthread_cleanup_pop=env._pthread_cleanup_pop;
  var _strftime=env._strftime;
  var _pthread_cond_wait=env._pthread_cond_wait;
  var _nativeCallFloat=env._nativeCallFloat;
  var _pthread_key_create=env._pthread_key_create;
  var _abort=env._abort;
  var ___syscall40=env.___syscall40;
  var _llvm_fabs_f64=env._llvm_fabs_f64;
  var _emscripten_set_main_loop_timing=env._emscripten_set_main_loop_timing;
  var ___gxx_personality_v0=env.___gxx_personality_v0;
  var _nativePushPtr=env._nativePushPtr;
  var _system=env._system;
  var ___assert_fail=env.___assert_fail;
  var ___cxa_allocate_exception=env.___cxa_allocate_exception;
  var __ZSt18uncaught_exceptionv=env.__ZSt18uncaught_exceptionv;
  var __addDays=env.__addDays;
  var _strftime_l=env._strftime_l;
  var ___setErrNo=env.___setErrNo;
  var _sbrk=env._sbrk;
  var _nativeCallInt=env._nativeCallInt;
  var ___cxa_begin_catch=env.___cxa_begin_catch;
  var _emscripten_memcpy_big=env._emscripten_memcpy_big;
  var ___resumeException=env.___resumeException;
  var ___cxa_find_matching_catch=env.___cxa_find_matching_catch;
  var _pthread_getspecific=env._pthread_getspecific;
  var __arraySum=env.__arraySum;
  var _pthread_once=env._pthread_once;
  var _nativePushString=env._nativePushString;
  var ___syscall54=env.___syscall54;
  var ___unlock=env.___unlock;
  var _emscripten_sleep=env._emscripten_sleep;
  var __isLeapYear=env.__isLeapYear;
  var _emscripten_set_main_loop=env._emscripten_set_main_loop;
  var _emscripten_get_now=env._emscripten_get_now;
  var ___syscall10=env.___syscall10;
  var _nativePushFloat=env._nativePushFloat;
  var _nativeInit=env._nativeInit;
  var _pthread_setspecific=env._pthread_setspecific;
  var ___cxa_throw=env.___cxa_throw;
  var ___lock=env.___lock;
  var _nativeCallString=env._nativeCallString;
  var ___syscall6=env.___syscall6;
  var _pthread_cleanup_push=env._pthread_cleanup_push;
  var _nativePushInt=env._nativePushInt;
  var ___syscall140=env.___syscall140;
  var _nativeCallVector3=env._nativeCallVector3;
  var ___syscall145=env.___syscall145;
  var ___syscall146=env.___syscall146;
  var tempFloat = 0.0;
  var asyncState = 0;

var EMTSTACKTOP = env.EMTSTACKTOP|0;
var EMT_STACK_MAX = env.EMT_STACK_MAX|0;
var eb = env.eb|0;
// EMSCRIPTEN_START_FUNCS
function emterpret(pc) {
 pc = pc | 0;
 var sp = 0, inst = 0, lx = 0, ly = 0, lz = 0;
 var ld = 0.0;
 HEAP32[EMTSTACKTOP >> 2] = pc;
 sp = EMTSTACKTOP + 8 | 0;
 lx = HEAPU16[pc + 2 >> 1] | 0;
 EMTSTACKTOP = EMTSTACKTOP + (lx + 1 << 3) | 0;
 if ((asyncState | 0) != 2) {} else {
  pc = (HEAP32[sp - 4 >> 2] | 0) - 8 | 0;
 }
 pc = pc + 4 | 0;
 while (1) {
  pc = pc + 4 | 0;
  inst = HEAP32[pc >> 2] | 0;
  lx = inst >> 8 & 255;
  ly = inst >> 16 & 255;
  lz = inst >>> 24;
  switch (inst & 255) {
  case 0:
   HEAP32[sp + (lx << 3) >> 2] = HEAP32[sp + (ly << 3) >> 2] | 0;
   break;
  case 1:
   HEAP32[sp + (lx << 3) >> 2] = inst >> 16;
   break;
  case 2:
   pc = pc + 4 | 0;
   HEAP32[sp + (lx << 3) >> 2] = HEAP32[pc >> 2] | 0;
   break;
  case 3:
   HEAP32[sp + (lx << 3) >> 2] = (HEAP32[sp + (ly << 3) >> 2] | 0) + (HEAP32[sp + (lz << 3) >> 2] | 0) | 0;
   break;
  case 4:
   HEAP32[sp + (lx << 3) >> 2] = (HEAP32[sp + (ly << 3) >> 2] | 0) - (HEAP32[sp + (lz << 3) >> 2] | 0) | 0;
   break;
  case 5:
   HEAP32[sp + (lx << 3) >> 2] = Math_imul(HEAP32[sp + (ly << 3) >> 2] | 0, HEAP32[sp + (lz << 3) >> 2] | 0) | 0;
   break;
  case 6:
   HEAP32[sp + (lx << 3) >> 2] = (HEAP32[sp + (ly << 3) >> 2] | 0) / (HEAP32[sp + (lz << 3) >> 2] | 0) | 0;
   break;
  case 7:
   HEAP32[sp + (lx << 3) >> 2] = (HEAP32[sp + (ly << 3) >> 2] >>> 0) / (HEAP32[sp + (lz << 3) >> 2] >>> 0) >>> 0;
   break;
  case 8:
   HEAP32[sp + (lx << 3) >> 2] = (HEAP32[sp + (ly << 3) >> 2] | 0) % (HEAP32[sp + (lz << 3) >> 2] | 0) | 0;
   break;
  case 9:
   HEAP32[sp + (lx << 3) >> 2] = (HEAP32[sp + (ly << 3) >> 2] >>> 0) % (HEAP32[sp + (lz << 3) >> 2] >>> 0) >>> 0;
   break;
  case 11:
   HEAP32[sp + (lx << 3) >> 2] = ~(HEAP32[sp + (ly << 3) >> 2] | 0);
   break;
  case 12:
   HEAP32[sp + (lx << 3) >> 2] = !(HEAP32[sp + (ly << 3) >> 2] | 0);
   break;
  case 13:
   HEAP32[sp + (lx << 3) >> 2] = (HEAP32[sp + (ly << 3) >> 2] | 0) == (HEAP32[sp + (lz << 3) >> 2] | 0) | 0;
   break;
  case 14:
   HEAP32[sp + (lx << 3) >> 2] = (HEAP32[sp + (ly << 3) >> 2] | 0) != (HEAP32[sp + (lz << 3) >> 2] | 0) | 0;
   break;
  case 15:
   HEAP32[sp + (lx << 3) >> 2] = (HEAP32[sp + (ly << 3) >> 2] | 0) < (HEAP32[sp + (lz << 3) >> 2] | 0) | 0;
   break;
  case 16:
   HEAP32[sp + (lx << 3) >> 2] = HEAP32[sp + (ly << 3) >> 2] >>> 0 < HEAP32[sp + (lz << 3) >> 2] >>> 0 | 0;
   break;
  case 17:
   HEAP32[sp + (lx << 3) >> 2] = (HEAP32[sp + (ly << 3) >> 2] | 0) <= (HEAP32[sp + (lz << 3) >> 2] | 0) | 0;
   break;
  case 18:
   HEAP32[sp + (lx << 3) >> 2] = HEAP32[sp + (ly << 3) >> 2] >>> 0 <= HEAP32[sp + (lz << 3) >> 2] >>> 0 | 0;
   break;
  case 19:
   HEAP32[sp + (lx << 3) >> 2] = (HEAP32[sp + (ly << 3) >> 2] | 0) & (HEAP32[sp + (lz << 3) >> 2] | 0);
   break;
  case 20:
   HEAP32[sp + (lx << 3) >> 2] = HEAP32[sp + (ly << 3) >> 2] | 0 | (HEAP32[sp + (lz << 3) >> 2] | 0);
   break;
  case 21:
   HEAP32[sp + (lx << 3) >> 2] = (HEAP32[sp + (ly << 3) >> 2] | 0) ^ (HEAP32[sp + (lz << 3) >> 2] | 0);
   break;
  case 22:
   HEAP32[sp + (lx << 3) >> 2] = (HEAP32[sp + (ly << 3) >> 2] | 0) << (HEAP32[sp + (lz << 3) >> 2] | 0);
   break;
  case 24:
   HEAP32[sp + (lx << 3) >> 2] = (HEAP32[sp + (ly << 3) >> 2] | 0) >>> (HEAP32[sp + (lz << 3) >> 2] | 0);
   break;
  case 25:
   HEAP32[sp + (lx << 3) >> 2] = (HEAP32[sp + (ly << 3) >> 2] | 0) + (inst >> 24) | 0;
   break;
  case 26:
   HEAP32[sp + (lx << 3) >> 2] = (HEAP32[sp + (ly << 3) >> 2] | 0) - (inst >> 24) | 0;
   break;
  case 27:
   HEAP32[sp + (lx << 3) >> 2] = Math_imul(HEAP32[sp + (ly << 3) >> 2] | 0, inst >> 24) | 0;
   break;
  case 28:
   HEAP32[sp + (lx << 3) >> 2] = (HEAP32[sp + (ly << 3) >> 2] | 0) / (inst >> 24) | 0;
   break;
  case 29:
   HEAP32[sp + (lx << 3) >> 2] = (HEAP32[sp + (ly << 3) >> 2] >>> 0) / (lz >>> 0) >>> 0;
   break;
  case 30:
   HEAP32[sp + (lx << 3) >> 2] = (HEAP32[sp + (ly << 3) >> 2] | 0) % (inst >> 24) | 0;
   break;
  case 31:
   HEAP32[sp + (lx << 3) >> 2] = (HEAP32[sp + (ly << 3) >> 2] >>> 0) % (lz >>> 0) >>> 0;
   break;
  case 32:
   HEAP32[sp + (lx << 3) >> 2] = (HEAP32[sp + (ly << 3) >> 2] | 0) == inst >> 24 | 0;
   break;
  case 33:
   HEAP32[sp + (lx << 3) >> 2] = (HEAP32[sp + (ly << 3) >> 2] | 0) != inst >> 24 | 0;
   break;
  case 34:
   HEAP32[sp + (lx << 3) >> 2] = (HEAP32[sp + (ly << 3) >> 2] | 0) < inst >> 24 | 0;
   break;
  case 35:
   HEAP32[sp + (lx << 3) >> 2] = HEAP32[sp + (ly << 3) >> 2] >>> 0 < lz >>> 0 | 0;
   break;
  case 36:
   HEAP32[sp + (lx << 3) >> 2] = (HEAP32[sp + (ly << 3) >> 2] | 0) <= inst >> 24 | 0;
   break;
  case 37:
   HEAP32[sp + (lx << 3) >> 2] = HEAP32[sp + (ly << 3) >> 2] >>> 0 <= lz >>> 0 | 0;
   break;
  case 38:
   HEAP32[sp + (lx << 3) >> 2] = (HEAP32[sp + (ly << 3) >> 2] | 0) & inst >> 24;
   break;
  case 39:
   HEAP32[sp + (lx << 3) >> 2] = HEAP32[sp + (ly << 3) >> 2] | 0 | inst >> 24;
   break;
  case 40:
   HEAP32[sp + (lx << 3) >> 2] = (HEAP32[sp + (ly << 3) >> 2] | 0) ^ inst >> 24;
   break;
  case 41:
   HEAP32[sp + (lx << 3) >> 2] = (HEAP32[sp + (ly << 3) >> 2] | 0) << lz;
   break;
  case 42:
   HEAP32[sp + (lx << 3) >> 2] = (HEAP32[sp + (ly << 3) >> 2] | 0) >> lz;
   break;
  case 43:
   HEAP32[sp + (lx << 3) >> 2] = (HEAP32[sp + (ly << 3) >> 2] | 0) >>> lz;
   break;
  case 45:
   if ((HEAP32[sp + (ly << 3) >> 2] | 0) == (HEAP32[sp + (lz << 3) >> 2] | 0)) {
    pc = pc + 4 | 0;
   } else {
    pc = HEAP32[pc + 4 >> 2] | 0;
    pc = pc - 4 | 0;
    continue;
   }
   break;
  case 46:
   if ((HEAP32[sp + (ly << 3) >> 2] | 0) != (HEAP32[sp + (lz << 3) >> 2] | 0)) {
    pc = pc + 4 | 0;
   } else {
    pc = HEAP32[pc + 4 >> 2] | 0;
    pc = pc - 4 | 0;
    continue;
   }
   break;
  case 47:
   if ((HEAP32[sp + (ly << 3) >> 2] | 0) < (HEAP32[sp + (lz << 3) >> 2] | 0)) {
    pc = pc + 4 | 0;
   } else {
    pc = HEAP32[pc + 4 >> 2] | 0;
    pc = pc - 4 | 0;
    continue;
   }
   break;
  case 48:
   if (HEAP32[sp + (ly << 3) >> 2] >>> 0 < HEAP32[sp + (lz << 3) >> 2] >>> 0) {
    pc = pc + 4 | 0;
   } else {
    pc = HEAP32[pc + 4 >> 2] | 0;
    pc = pc - 4 | 0;
    continue;
   }
   break;
  case 49:
   if ((HEAP32[sp + (ly << 3) >> 2] | 0) <= (HEAP32[sp + (lz << 3) >> 2] | 0)) {
    pc = pc + 4 | 0;
   } else {
    pc = HEAP32[pc + 4 >> 2] | 0;
    pc = pc - 4 | 0;
    continue;
   }
   break;
  case 50:
   if (HEAP32[sp + (ly << 3) >> 2] >>> 0 <= HEAP32[sp + (lz << 3) >> 2] >>> 0) {
    pc = pc + 4 | 0;
   } else {
    pc = HEAP32[pc + 4 >> 2] | 0;
    pc = pc - 4 | 0;
    continue;
   }
   break;
  case 52:
   if ((HEAP32[sp + (ly << 3) >> 2] | 0) == (HEAP32[sp + (lz << 3) >> 2] | 0)) {
    pc = HEAP32[pc + 4 >> 2] | 0;
    pc = pc - 4 | 0;
    continue;
   } else {
    pc = pc + 4 | 0;
   }
   break;
  case 53:
   if ((HEAP32[sp + (ly << 3) >> 2] | 0) != (HEAP32[sp + (lz << 3) >> 2] | 0)) {
    pc = HEAP32[pc + 4 >> 2] | 0;
    pc = pc - 4 | 0;
    continue;
   } else {
    pc = pc + 4 | 0;
   }
   break;
  case 54:
   if ((HEAP32[sp + (ly << 3) >> 2] | 0) < (HEAP32[sp + (lz << 3) >> 2] | 0)) {
    pc = HEAP32[pc + 4 >> 2] | 0;
    pc = pc - 4 | 0;
    continue;
   } else {
    pc = pc + 4 | 0;
   }
   break;
  case 55:
   if (HEAP32[sp + (ly << 3) >> 2] >>> 0 < HEAP32[sp + (lz << 3) >> 2] >>> 0) {
    pc = HEAP32[pc + 4 >> 2] | 0;
    pc = pc - 4 | 0;
    continue;
   } else {
    pc = pc + 4 | 0;
   }
   break;
  case 56:
   if ((HEAP32[sp + (ly << 3) >> 2] | 0) <= (HEAP32[sp + (lz << 3) >> 2] | 0)) {
    pc = HEAP32[pc + 4 >> 2] | 0;
    pc = pc - 4 | 0;
    continue;
   } else {
    pc = pc + 4 | 0;
   }
   break;
  case 57:
   if (HEAP32[sp + (ly << 3) >> 2] >>> 0 <= HEAP32[sp + (lz << 3) >> 2] >>> 0) {
    pc = HEAP32[pc + 4 >> 2] | 0;
    pc = pc - 4 | 0;
    continue;
   } else {
    pc = pc + 4 | 0;
   }
   break;
  case 58:
   HEAPF64[sp + (lx << 3) >> 3] = +HEAPF64[sp + (ly << 3) >> 3];
   break;
  case 59:
   HEAPF64[sp + (lx << 3) >> 3] = +(inst >> 16);
   break;
  case 60:
   pc = pc + 4 | 0;
   HEAPF64[sp + (lx << 3) >> 3] = +(HEAP32[pc >> 2] | 0);
   break;
  case 61:
   pc = pc + 4 | 0;
   HEAPF64[sp + (lx << 3) >> 3] = +HEAPF32[pc >> 2];
   break;
  case 62:
   HEAP32[tempDoublePtr >> 2] = HEAP32[pc + 4 >> 2];
   HEAP32[tempDoublePtr + 4 >> 2] = HEAP32[pc + 8 >> 2];
   pc = pc + 8 | 0;
   HEAPF64[sp + (lx << 3) >> 3] = +HEAPF64[tempDoublePtr >> 3];
   break;
  case 63:
   HEAPF64[sp + (lx << 3) >> 3] = +HEAPF64[sp + (ly << 3) >> 3] + +HEAPF64[sp + (lz << 3) >> 3];
   break;
  case 64:
   HEAPF64[sp + (lx << 3) >> 3] = +HEAPF64[sp + (ly << 3) >> 3] - +HEAPF64[sp + (lz << 3) >> 3];
   break;
  case 65:
   HEAPF64[sp + (lx << 3) >> 3] = +HEAPF64[sp + (ly << 3) >> 3] * +HEAPF64[sp + (lz << 3) >> 3];
   break;
  case 66:
   HEAPF64[sp + (lx << 3) >> 3] = +HEAPF64[sp + (ly << 3) >> 3] / +HEAPF64[sp + (lz << 3) >> 3];
   break;
  case 68:
   HEAPF64[sp + (lx << 3) >> 3] = -+HEAPF64[sp + (ly << 3) >> 3];
   break;
  case 69:
   HEAP32[sp + (lx << 3) >> 2] = +HEAPF64[sp + (ly << 3) >> 3] == +HEAPF64[sp + (lz << 3) >> 3] | 0;
   break;
  case 70:
   HEAP32[sp + (lx << 3) >> 2] = +HEAPF64[sp + (ly << 3) >> 3] != +HEAPF64[sp + (lz << 3) >> 3] | 0;
   break;
  case 71:
   HEAP32[sp + (lx << 3) >> 2] = +HEAPF64[sp + (ly << 3) >> 3] < +HEAPF64[sp + (lz << 3) >> 3] | 0;
   break;
  case 74:
   HEAP32[sp + (lx << 3) >> 2] = +HEAPF64[sp + (ly << 3) >> 3] >= +HEAPF64[sp + (lz << 3) >> 3] | 0;
   break;
  case 75:
   HEAP32[sp + (lx << 3) >> 2] = ~~+HEAPF64[sp + (ly << 3) >> 3];
   break;
  case 76:
   HEAPF64[sp + (lx << 3) >> 3] = +(HEAP32[sp + (ly << 3) >> 2] | 0);
   break;
  case 77:
   HEAPF64[sp + (lx << 3) >> 3] = +(HEAP32[sp + (ly << 3) >> 2] >>> 0);
   break;
  case 78:
   HEAP32[sp + (lx << 3) >> 2] = HEAP8[HEAP32[sp + (ly << 3) >> 2] >> 0];
   break;
  case 79:
   HEAP32[sp + (lx << 3) >> 2] = HEAPU8[HEAP32[sp + (ly << 3) >> 2] >> 0];
   break;
  case 80:
   HEAP32[sp + (lx << 3) >> 2] = HEAP16[HEAP32[sp + (ly << 3) >> 2] >> 1];
   break;
  case 82:
   HEAP32[sp + (lx << 3) >> 2] = HEAP32[HEAP32[sp + (ly << 3) >> 2] >> 2];
   break;
  case 83:
   HEAP8[HEAP32[sp + (lx << 3) >> 2] >> 0] = HEAP32[sp + (ly << 3) >> 2] | 0;
   break;
  case 84:
   HEAP16[HEAP32[sp + (lx << 3) >> 2] >> 1] = HEAP32[sp + (ly << 3) >> 2] | 0;
   break;
  case 85:
   HEAP32[HEAP32[sp + (lx << 3) >> 2] >> 2] = HEAP32[sp + (ly << 3) >> 2] | 0;
   break;
  case 86:
   HEAPF64[sp + (lx << 3) >> 3] = +HEAPF64[HEAP32[sp + (ly << 3) >> 2] >> 3];
   break;
  case 87:
   HEAPF64[HEAP32[sp + (lx << 3) >> 2] >> 3] = +HEAPF64[sp + (ly << 3) >> 3];
   break;
  case 88:
   HEAPF64[sp + (lx << 3) >> 3] = +HEAPF32[HEAP32[sp + (ly << 3) >> 2] >> 2];
   break;
  case 89:
   HEAPF32[HEAP32[sp + (lx << 3) >> 2] >> 2] = +HEAPF64[sp + (ly << 3) >> 3];
   break;
  case 90:
   HEAP32[sp + (lx << 3) >> 2] = HEAP8[(HEAP32[sp + (ly << 3) >> 2] | 0) + (HEAP32[sp + (lz << 3) >> 2] | 0) >> 0];
   break;
  case 91:
   HEAP32[sp + (lx << 3) >> 2] = HEAPU8[(HEAP32[sp + (ly << 3) >> 2] | 0) + (HEAP32[sp + (lz << 3) >> 2] | 0) >> 0];
   break;
  case 92:
   HEAP32[sp + (lx << 3) >> 2] = HEAP16[(HEAP32[sp + (ly << 3) >> 2] | 0) + (HEAP32[sp + (lz << 3) >> 2] | 0) >> 1];
   break;
  case 94:
   HEAP32[sp + (lx << 3) >> 2] = HEAP32[(HEAP32[sp + (ly << 3) >> 2] | 0) + (HEAP32[sp + (lz << 3) >> 2] | 0) >> 2];
   break;
  case 95:
   HEAP8[(HEAP32[sp + (lx << 3) >> 2] | 0) + (HEAP32[sp + (ly << 3) >> 2] | 0) >> 0] = HEAP32[sp + (lz << 3) >> 2] | 0;
   break;
  case 97:
   HEAP32[(HEAP32[sp + (lx << 3) >> 2] | 0) + (HEAP32[sp + (ly << 3) >> 2] | 0) >> 2] = HEAP32[sp + (lz << 3) >> 2] | 0;
   break;
  case 99:
   HEAPF64[(HEAP32[sp + (lx << 3) >> 2] | 0) + (HEAP32[sp + (ly << 3) >> 2] | 0) >> 3] = +HEAPF64[sp + (lz << 3) >> 3];
   break;
  case 100:
   HEAPF64[sp + (lx << 3) >> 3] = +HEAPF32[(HEAP32[sp + (ly << 3) >> 2] | 0) + (HEAP32[sp + (lz << 3) >> 2] | 0) >> 2];
   break;
  case 101:
   HEAPF32[(HEAP32[sp + (lx << 3) >> 2] | 0) + (HEAP32[sp + (ly << 3) >> 2] | 0) >> 2] = +HEAPF64[sp + (lz << 3) >> 3];
   break;
  case 102:
   HEAP32[sp + (lx << 3) >> 2] = HEAP8[(HEAP32[sp + (ly << 3) >> 2] | 0) + (inst >> 24) >> 0];
   break;
  case 103:
   HEAP32[sp + (lx << 3) >> 2] = HEAPU8[(HEAP32[sp + (ly << 3) >> 2] | 0) + (inst >> 24) >> 0];
   break;
  case 106:
   HEAP32[sp + (lx << 3) >> 2] = HEAP32[(HEAP32[sp + (ly << 3) >> 2] | 0) + (inst >> 24) >> 2];
   break;
  case 107:
   HEAP8[(HEAP32[sp + (lx << 3) >> 2] | 0) + (ly << 24 >> 24) >> 0] = HEAP32[sp + (lz << 3) >> 2] | 0;
   break;
  case 108:
   HEAP16[(HEAP32[sp + (lx << 3) >> 2] | 0) + (ly << 24 >> 24) >> 1] = HEAP32[sp + (lz << 3) >> 2] | 0;
   break;
  case 109:
   HEAP32[(HEAP32[sp + (lx << 3) >> 2] | 0) + (ly << 24 >> 24) >> 2] = HEAP32[sp + (lz << 3) >> 2] | 0;
   break;
  case 110:
   HEAPF64[sp + (lx << 3) >> 3] = +HEAPF64[(HEAP32[sp + (ly << 3) >> 2] | 0) + (inst >> 24) >> 3];
   break;
  case 111:
   HEAPF64[(HEAP32[sp + (lx << 3) >> 2] | 0) + (ly << 24 >> 24) >> 3] = +HEAPF64[sp + (lz << 3) >> 3];
   break;
  case 112:
   HEAPF64[sp + (lx << 3) >> 3] = +HEAPF32[(HEAP32[sp + (ly << 3) >> 2] | 0) + (inst >> 24) >> 2];
   break;
  case 113:
   HEAPF32[(HEAP32[sp + (lx << 3) >> 2] | 0) + (ly << 24 >> 24) >> 2] = +HEAPF64[sp + (lz << 3) >> 3];
   break;
  case 114:
   HEAP8[HEAP32[sp + (lx << 3) >> 2] >> 0] = HEAP8[HEAP32[sp + (ly << 3) >> 2] >> 0] | 0;
   break;
  case 116:
   HEAP32[HEAP32[sp + (lx << 3) >> 2] >> 2] = HEAP32[HEAP32[sp + (ly << 3) >> 2] >> 2] | 0;
   break;
  case 119:
   pc = pc + (inst >> 16 << 2) | 0;
   pc = pc - 4 | 0;
   continue;
   break;
  case 120:
   if (HEAP32[sp + (lx << 3) >> 2] | 0) {
    pc = pc + (inst >> 16 << 2) | 0;
    pc = pc - 4 | 0;
    continue;
   }
   break;
  case 121:
   if (!(HEAP32[sp + (lx << 3) >> 2] | 0)) {
    pc = pc + (inst >> 16 << 2) | 0;
    pc = pc - 4 | 0;
    continue;
   }
   break;
  case 125:
   pc = pc + 4 | 0;
   HEAP32[sp + (lx << 3) >> 2] = HEAP32[sp + (ly << 3) >> 2] | 0 ? HEAP32[sp + (lz << 3) >> 2] | 0 : HEAP32[sp + ((HEAPU8[pc >> 0] | 0) << 3) >> 2] | 0;
   break;
  case 127:
   HEAP32[sp + (lx << 3) >> 2] = tempDoublePtr;
   break;
  case 128:
   HEAP32[sp + (lx << 3) >> 2] = tempRet0;
   break;
  case 129:
   tempRet0 = HEAP32[sp + (lx << 3) >> 2] | 0;
   break;
  case 134:
   lz = HEAPU8[(HEAP32[pc + 4 >> 2] | 0) + 1 | 0] | 0;
   ly = 0;
   if ((asyncState | 0) != 2) {
    while ((ly | 0) < (lz | 0)) {
     HEAP32[EMTSTACKTOP + (ly << 3) + 8 >> 2] = HEAP32[sp + (HEAPU8[pc + 8 + ly >> 0] << 3) >> 2] | 0;
     HEAP32[EMTSTACKTOP + (ly << 3) + 12 >> 2] = HEAP32[sp + (HEAPU8[pc + 8 + ly >> 0] << 3) + 4 >> 2] | 0;
     ly = ly + 1 | 0;
    }
   }
   HEAP32[sp - 4 >> 2] = pc;
   emterpret(HEAP32[pc + 4 >> 2] | 0);
   if ((asyncState | 0) == 1) {
    EMTSTACKTOP = sp - 8 | 0;
    return;
   }
   HEAP32[sp + (lx << 3) >> 2] = HEAP32[EMTSTACKTOP >> 2] | 0;
   HEAP32[sp + (lx << 3) + 4 >> 2] = HEAP32[EMTSTACKTOP + 4 >> 2] | 0;
   pc = pc + (4 + lz + 3 >> 2 << 2) | 0;
   break;
  case 135:
   switch (inst >>> 16 | 0) {
   case 0:
    {
     HEAP32[sp - 4 >> 2] = pc;
     __ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEED2Ev(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0);
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     };
     pc = pc + 4 | 0;
     continue;
    }
   case 1:
    {
     HEAP32[sp - 4 >> 2] = pc;
     _nativeInit(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0);
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     };
     pc = pc + 4 | 0;
     continue;
    }
   case 2:
    {
     HEAP32[sp - 4 >> 2] = pc;
     _nativePushFloat(+HEAPF64[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 3]);
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     };
     pc = pc + 4 | 0;
     continue;
    }
   case 3:
    {
     HEAP32[sp - 4 >> 2] = pc;
     lz = _nativeCallInt() | 0;
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAP32[sp + (lx << 3) >> 2] = lz;
     continue;
    }
   case 4:
    {
     HEAP32[sp - 4 >> 2] = pc;
     _nativePushInt(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0);
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     };
     pc = pc + 4 | 0;
     continue;
    }
   case 5:
    {
     HEAP32[sp - 4 >> 2] = pc;
     ld = +_nativeCallFloat();
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAPF64[sp + (lx << 3) >> 3] = ld;
     continue;
    }
   case 6:
    {
     HEAP32[sp - 4 >> 2] = pc;
     lz = _rand() | 0;
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAP32[sp + (lx << 3) >> 2] = lz;
     continue;
    }
   case 7:
    {
     HEAP32[sp - 4 >> 2] = pc;
     _nativePushString(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0);
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     };
     pc = pc + 4 | 0;
     continue;
    }
   case 8:
    {
     HEAP32[sp - 4 >> 2] = pc;
     _nativePushPtr(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 5 >> 0] << 3) >> 2] | 0);
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     };
     pc = pc + 4 | 0;
     continue;
    }
   case 9:
    {
     HEAP32[sp - 4 >> 2] = pc;
     __Z16set_menu_showingb(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0);
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     };
     pc = pc + 4 | 0;
     continue;
    }
   case 10:
    {
     HEAP32[sp - 4 >> 2] = pc;
     lz = __ZNKSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE7compareEjjPKcj(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 5 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 6 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 7 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 8 >> 0] << 3) >> 2] | 0) | 0;
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAP32[sp + (lx << 3) >> 2] = lz;
     pc = pc + 8 | 0;
     continue;
    }
   case 11:
    {
     HEAP32[sp - 4 >> 2] = pc;
     lz = _strlen(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0) | 0;
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAP32[sp + (lx << 3) >> 2] = lz;
     pc = pc + 4 | 0;
     continue;
    }
   case 12:
    {
     HEAP32[sp - 4 >> 2] = pc;
     lz = _nativeCallString() | 0;
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAP32[sp + (lx << 3) >> 2] = lz;
     continue;
    }
   case 13:
    {
     HEAP32[sp - 4 >> 2] = pc;
     lz = _memcmp(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 5 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 6 >> 0] << 3) >> 2] | 0) | 0;
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAP32[sp + (lx << 3) >> 2] = lz;
     pc = pc + 4 | 0;
     continue;
    }
   case 14:
    {
     HEAP32[sp - 4 >> 2] = pc;
     _emscripten_sleep(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0);
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     };
     pc = pc + 4 | 0;
     continue;
    }
   case 15:
    {
     HEAP32[sp - 4 >> 2] = pc;
     __ZdlPv(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0);
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     };
     pc = pc + 4 | 0;
     continue;
    }
   case 16:
    {
     HEAP32[sp - 4 >> 2] = pc;
     _nativeCallVector3(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 5 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 6 >> 0] << 3) >> 2] | 0);
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     };
     pc = pc + 4 | 0;
     continue;
    }
   case 17:
    {
     HEAP32[sp - 4 >> 2] = pc;
     lz = __ZN8nlohmann10basic_jsonINSt3__23mapENS1_6vectorENS1_12basic_stringIcNS1_11char_traitsIcEENS1_9allocatorIcEEEEbxydS7_NS_14adl_serializerEEaSESB_(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 5 >> 0] << 3) >> 2] | 0) | 0;
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAP32[sp + (lx << 3) >> 2] = lz;
     pc = pc + 4 | 0;
     continue;
    }
   case 18:
    {
     HEAP32[sp - 4 >> 2] = pc;
     __ZN8nlohmann10basic_jsonINSt3__23mapENS1_6vectorENS1_12basic_stringIcNS1_11char_traitsIcEENS1_9allocatorIcEEEEbxydS7_NS_14adl_serializerEED2Ev(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0);
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     };
     pc = pc + 4 | 0;
     continue;
    }
   case 19:
    {
     HEAP32[sp - 4 >> 2] = pc;
     lz = _isspace(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0) | 0;
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAP32[sp + (lx << 3) >> 2] = lz;
     pc = pc + 4 | 0;
     continue;
    }
   case 20:
    {
     HEAP32[sp - 4 >> 2] = pc;
     lz = ___errno_location() | 0;
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAP32[sp + (lx << 3) >> 2] = lz;
     continue;
    }
   case 21:
    {
     HEAP32[sp - 4 >> 2] = pc;
     ___shlim(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 5 >> 0] << 3) >> 2] | 0);
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     };
     pc = pc + 4 | 0;
     continue;
    }
   case 22:
    {
     HEAP32[sp - 4 >> 2] = pc;
     lz = _i64Add(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 5 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 6 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 7 >> 0] << 3) >> 2] | 0) | 0;
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAP32[sp + (lx << 3) >> 2] = lz;
     pc = pc + 4 | 0;
     continue;
    }
   case 23:
    {
     HEAP32[sp - 4 >> 2] = pc;
     lz = _bitshift64Shl(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 5 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 6 >> 0] << 3) >> 2] | 0) | 0;
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAP32[sp + (lx << 3) >> 2] = lz;
     pc = pc + 4 | 0;
     continue;
    }
   case 24:
    {
     HEAP32[sp - 4 >> 2] = pc;
     lz = _i64Subtract(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 5 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 6 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 7 >> 0] << 3) >> 2] | 0) | 0;
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAP32[sp + (lx << 3) >> 2] = lz;
     pc = pc + 4 | 0;
     continue;
    }
   case 25:
    {
     HEAP32[sp - 4 >> 2] = pc;
     ld = +_scalbn(+HEAPF64[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 3], HEAP32[sp + (HEAPU8[pc + 5 >> 0] << 3) >> 2] | 0);
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAPF64[sp + (lx << 3) >> 3] = ld;
     pc = pc + 4 | 0;
     continue;
    }
   case 26:
    {
     HEAP32[sp - 4 >> 2] = pc;
     ld = +_copysignl(+HEAPF64[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 3], +HEAPF64[sp + (HEAPU8[pc + 5 >> 0] << 3) >> 3]);
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAPF64[sp + (lx << 3) >> 3] = ld;
     pc = pc + 4 | 0;
     continue;
    }
   case 27:
    {
     HEAP32[sp - 4 >> 2] = pc;
     ld = +_scalbnl(+HEAPF64[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 3], HEAP32[sp + (HEAPU8[pc + 5 >> 0] << 3) >> 2] | 0);
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAPF64[sp + (lx << 3) >> 3] = ld;
     pc = pc + 4 | 0;
     continue;
    }
   case 28:
    {
     HEAP32[sp - 4 >> 2] = pc;
     lz = ___udivdi3(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 5 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 6 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 7 >> 0] << 3) >> 2] | 0) | 0;
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAP32[sp + (lx << 3) >> 2] = lz;
     pc = pc + 4 | 0;
     continue;
    }
   case 29:
    {
     HEAP32[sp - 4 >> 2] = pc;
     lz = ___uremdi3(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 5 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 6 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 7 >> 0] << 3) >> 2] | 0) | 0;
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAP32[sp + (lx << 3) >> 2] = lz;
     pc = pc + 4 | 0;
     continue;
    }
   case 30:
    {
     HEAP32[sp - 4 >> 2] = pc;
     ld = +_fmodl(+HEAPF64[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 3], +HEAPF64[sp + (HEAPU8[pc + 5 >> 0] << 3) >> 3]);
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAPF64[sp + (lx << 3) >> 3] = ld;
     pc = pc + 4 | 0;
     continue;
    }
   case 31:
    {
     HEAP32[sp - 4 >> 2] = pc;
     ld = +Math_abs(+HEAPF64[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 3]);
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAPF64[sp + (lx << 3) >> 3] = ld;
     pc = pc + 4 | 0;
     continue;
    }
   case 32:
    {
     HEAP32[sp - 4 >> 2] = pc;
     __ZNSt3__28ios_base5clearEj(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 5 >> 0] << 3) >> 2] | 0);
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     };
     pc = pc + 4 | 0;
     continue;
    }
   case 33:
    {
     HEAP32[sp - 4 >> 2] = pc;
     _pop_arg(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 5 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 6 >> 0] << 3) >> 2] | 0);
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     };
     pc = pc + 4 | 0;
     continue;
    }
   case 34:
    {
     HEAP32[sp - 4 >> 2] = pc;
     ld = +_frexpl(+HEAPF64[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 3], HEAP32[sp + (HEAPU8[pc + 5 >> 0] << 3) >> 2] | 0);
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAPF64[sp + (lx << 3) >> 3] = ld;
     pc = pc + 4 | 0;
     continue;
    }
   case 35:
    {
     HEAP32[sp - 4 >> 2] = pc;
     lz = _fmt_u(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 5 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 6 >> 0] << 3) >> 2] | 0) | 0;
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAP32[sp + (lx << 3) >> 2] = lz;
     pc = pc + 4 | 0;
     continue;
    }
   case 36:
    {
     HEAP32[sp - 4 >> 2] = pc;
     lz = _memset(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 5 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 6 >> 0] << 3) >> 2] | 0) | 0;
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAP32[sp + (lx << 3) >> 2] = lz;
     pc = pc + 4 | 0;
     continue;
    }
   case 37:
    {
     HEAP32[sp - 4 >> 2] = pc;
     lz = _strerror(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0) | 0;
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAP32[sp + (lx << 3) >> 2] = lz;
     pc = pc + 4 | 0;
     continue;
    }
   case 38:
    {
     HEAP32[sp - 4 >> 2] = pc;
     lz = _bitshift64Lshr(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 5 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 6 >> 0] << 3) >> 2] | 0) | 0;
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAP32[sp + (lx << 3) >> 2] = lz;
     pc = pc + 4 | 0;
     continue;
    }
   case 39:
    {
     HEAP32[sp - 4 >> 2] = pc;
     lz = _memchr(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 5 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 6 >> 0] << 3) >> 2] | 0) | 0;
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAP32[sp + (lx << 3) >> 2] = lz;
     pc = pc + 4 | 0;
     continue;
    }
   case 40:
    {
     HEAP32[sp - 4 >> 2] = pc;
     lz = _wctomb(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 5 >> 0] << 3) >> 2] | 0) | 0;
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAP32[sp + (lx << 3) >> 2] = lz;
     pc = pc + 4 | 0;
     continue;
    }
   case 41:
    {
     HEAP32[sp - 4 >> 2] = pc;
     lz = FUNCTION_TABLE_ii[HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] & 255](HEAP32[sp + (HEAPU8[pc + 5 >> 0] << 3) >> 2] | 0) | 0;
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAP32[sp + (lx << 3) >> 2] = lz;
     pc = pc + 4 | 0;
     continue;
    }
   case 42:
    {
     HEAP32[sp - 4 >> 2] = pc;
     lz = FUNCTION_TABLE_iiii[HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] & 31](HEAP32[sp + (HEAPU8[pc + 5 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 6 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 7 >> 0] << 3) >> 2] | 0) | 0;
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAP32[sp + (lx << 3) >> 2] = lz;
     pc = pc + 4 | 0;
     continue;
    }
   case 43:
    {
     HEAP32[sp - 4 >> 2] = pc;
     __ZNSt3__216__check_groupingERKNS_12basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEEPjS8_Rj(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 5 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 6 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 7 >> 0] << 3) >> 2] | 0);
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     };
     pc = pc + 4 | 0;
     continue;
    }
   case 44:
    {
     HEAP32[sp - 4 >> 2] = pc;
     __ZNSt3__212basic_stringIwNS_11char_traitsIwEENS_9allocatorIwEEED2Ev(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0);
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     };
     pc = pc + 4 | 0;
     continue;
    }
   case 45:
    {
     HEAP32[sp - 4 >> 2] = pc;
     FUNCTION_TABLE_vi[HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] & 255](HEAP32[sp + (HEAPU8[pc + 5 >> 0] << 3) >> 2] | 0);
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     };
     pc = pc + 4 | 0;
     continue;
    }
   case 46:
    {
     HEAP32[sp - 4 >> 2] = pc;
     lz = ___lockfile(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0) | 0;
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAP32[sp + (lx << 3) >> 2] = lz;
     pc = pc + 4 | 0;
     continue;
    }
   case 47:
    {
     HEAP32[sp - 4 >> 2] = pc;
     lz = _malloc(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0) | 0;
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAP32[sp + (lx << 3) >> 2] = lz;
     pc = pc + 4 | 0;
     continue;
    }
   case 48:
    {
     HEAP32[sp - 4 >> 2] = pc;
     lz = _mbrtowc(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 5 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 6 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 7 >> 0] << 3) >> 2] | 0) | 0;
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAP32[sp + (lx << 3) >> 2] = lz;
     pc = pc + 4 | 0;
     continue;
    }
   case 49:
    {
     HEAP32[sp - 4 >> 2] = pc;
     lz = _realloc(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 5 >> 0] << 3) >> 2] | 0) | 0;
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAP32[sp + (lx << 3) >> 2] = lz;
     pc = pc + 4 | 0;
     continue;
    }
   case 50:
    {
     HEAP32[sp - 4 >> 2] = pc;
     lz = _mbsinit(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0) | 0;
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAP32[sp + (lx << 3) >> 2] = lz;
     pc = pc + 4 | 0;
     continue;
    }
   case 51:
    {
     HEAP32[sp - 4 >> 2] = pc;
     _free(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0);
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     };
     pc = pc + 4 | 0;
     continue;
    }
   case 52:
    {
     HEAP32[sp - 4 >> 2] = pc;
     ___unlockfile(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0);
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     };
     pc = pc + 4 | 0;
     continue;
    }
   case 53:
    {
     HEAP32[sp - 4 >> 2] = pc;
     __ZNKSt3__220__vector_base_commonILb1EE20__throw_out_of_rangeEv(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0);
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     };
     pc = pc + 4 | 0;
     continue;
    }
   case 54:
    {
     HEAP32[sp - 4 >> 2] = pc;
     lz = __ZNKSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE7compareEPKc(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 5 >> 0] << 3) >> 2] | 0) | 0;
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAP32[sp + (lx << 3) >> 2] = lz;
     pc = pc + 4 | 0;
     continue;
    }
   case 55:
    {
     HEAP32[sp - 4 >> 2] = pc;
     ___assert_fail(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 5 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 6 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 7 >> 0] << 3) >> 2] | 0);
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     };
     pc = pc + 4 | 0;
     continue;
    }
   case 56:
    {
     HEAP32[sp - 4 >> 2] = pc;
     lz = __Z12get_databasev() | 0;
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAP32[sp + (lx << 3) >> 2] = lz;
     continue;
    }
   case 57:
    {
     HEAP32[sp - 4 >> 2] = pc;
     FUNCTION_TABLE_viii[HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] & 7](HEAP32[sp + (HEAPU8[pc + 5 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 6 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 7 >> 0] << 3) >> 2] | 0);
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     };
     pc = pc + 4 | 0;
     continue;
    }
   case 58:
    {
     HEAP32[sp - 4 >> 2] = pc;
     FUNCTION_TABLE_vii[HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] & 63](HEAP32[sp + (HEAPU8[pc + 5 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 6 >> 0] << 3) >> 2] | 0);
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     };
     pc = pc + 4 | 0;
     continue;
    }
   case 59:
    {
     HEAP32[sp - 4 >> 2] = pc;
     __ZN17SavedVehicleDBRowD2Ev(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0);
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     };
     pc = pc + 4 | 0;
     continue;
    }
   case 60:
    {
     HEAP32[sp - 4 >> 2] = pc;
     lz = FUNCTION_TABLE_iiiii[HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] & 7](HEAP32[sp + (HEAPU8[pc + 5 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 6 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 7 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 8 >> 0] << 3) >> 2] | 0) | 0;
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAP32[sp + (lx << 3) >> 2] = lz;
     pc = pc + 8 | 0;
     continue;
    }
   case 61:
    {
     HEAP32[sp - 4 >> 2] = pc;
     __ZN8nlohmann10basic_jsonINSt3__23mapENS1_6vectorENS1_12basic_stringIcNS1_11char_traitsIcEENS1_9allocatorIcEEEEbxydS7_NS_14adl_serializerEEC2EOSB_(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 5 >> 0] << 3) >> 2] | 0);
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     };
     pc = pc + 4 | 0;
     continue;
    }
   case 62:
    {
     HEAP32[sp - 4 >> 2] = pc;
     lz = ___cxa_allocate_exception(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0) | 0;
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAP32[sp + (lx << 3) >> 2] = lz;
     pc = pc + 4 | 0;
     continue;
    }
   case 63:
    {
     HEAP32[sp - 4 >> 2] = pc;
     ___cxa_throw(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 5 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 6 >> 0] << 3) >> 2] | 0);
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     };
     pc = pc + 4 | 0;
     continue;
    }
   case 64:
    {
     HEAP32[sp - 4 >> 2] = pc;
     ld = +Math_ceil(+HEAPF64[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 3]);
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAPF64[sp + (lx << 3) >> 3] = ld;
     pc = pc + 4 | 0;
     continue;
    }
   case 65:
    {
     HEAP32[sp - 4 >> 2] = pc;
     lz = __Z21noclip_switch_pressedv() | 0;
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAP32[sp + (lx << 3) >> 2] = lz;
     continue;
    }
   case 66:
    {
     HEAP32[sp - 4 >> 2] = pc;
     FUNCTION_TABLE_v[HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] & 3]();
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     };
     pc = pc + 4 | 0;
     continue;
    }
   case 67:
    {
     HEAP32[sp - 4 >> 2] = pc;
     lz = FUNCTION_TABLE_i[HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] & 7]() | 0;
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAP32[sp + (lx << 3) >> 2] = lz;
     pc = pc + 4 | 0;
     continue;
    }
   case 68:
    {
     HEAP32[sp - 4 >> 2] = pc;
     ld = +Math_floor(+HEAPF64[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 3]);
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAPF64[sp + (lx << 3) >> 3] = ld;
     pc = pc + 4 | 0;
     continue;
    }
   case 69:
    {
     HEAP32[sp - 4 >> 2] = pc;
     lz = __Z15is_menu_showingv() | 0;
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAP32[sp + (lx << 3) >> 2] = lz;
     continue;
    }
   case 70:
    {
     HEAP32[sp - 4 >> 2] = pc;
     lz = ___muldi3(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 5 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 6 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 7 >> 0] << 3) >> 2] | 0) | 0;
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAP32[sp + (lx << 3) >> 2] = lz;
     pc = pc + 4 | 0;
     continue;
    }
   case 71:
    {
     HEAP32[sp - 4 >> 2] = pc;
     lz = __ZNKSt3__28ios_base6getlocEv(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0) | 0;
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAP32[sp + (lx << 3) >> 2] = lz;
     pc = pc + 4 | 0;
     continue;
    }
   case 72:
    {
     HEAP32[sp - 4 >> 2] = pc;
     lz = FUNCTION_TABLE_iiiiiii[HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] & 63](HEAP32[sp + (HEAPU8[pc + 5 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 6 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 7 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 8 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 9 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 10 >> 0] << 3) >> 2] | 0) | 0;
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAP32[sp + (lx << 3) >> 2] = lz;
     pc = pc + 8 | 0;
     continue;
    }
   case 73:
    {
     HEAP32[sp - 4 >> 2] = pc;
     lz = FUNCTION_TABLE_iii[HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] & 31](HEAP32[sp + (HEAPU8[pc + 5 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 6 >> 0] << 3) >> 2] | 0) | 0;
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAP32[sp + (lx << 3) >> 2] = lz;
     pc = pc + 4 | 0;
     continue;
    }
   case 74:
    {
     HEAP32[sp - 4 >> 2] = pc;
     lz = FUNCTION_TABLE_iiiiiiiii[HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] & 15](HEAP32[sp + (HEAPU8[pc + 5 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 6 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 7 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 8 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 9 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 10 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 11 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 12 >> 0] << 3) >> 2] | 0) | 0;
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAP32[sp + (lx << 3) >> 2] = lz;
     pc = pc + 12 | 0;
     continue;
    }
   case 75:
    {
     HEAP32[sp - 4 >> 2] = pc;
     lz = __ZNSt3__26__treeINS_12__value_typeINS_12basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEEbEENS_19__map_value_compareIS7_S8_NS_4lessIS7_EELb1EEENS5_IS8_EEE4findIS7_EENS_15__tree_iteratorIS8_PNS_11__tree_nodeIS8_PvEEiEERKT_(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 5 >> 0] << 3) >> 2] | 0) | 0;
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAP32[sp + (lx << 3) >> 2] = lz;
     pc = pc + 4 | 0;
     continue;
    }
   case 76:
    {
     HEAP32[sp - 4 >> 2] = pc;
     lz = __ZNSt3__26__treeINS_12__value_typeINS_12basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEEbEENS_19__map_value_compareIS7_S8_NS_4lessIS7_EELb1EEENS5_IS8_EEE12__find_equalIS7_EERPNS_16__tree_node_baseIPvEESK_RKT_(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 5 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 6 >> 0] << 3) >> 2] | 0) | 0;
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAP32[sp + (lx << 3) >> 2] = lz;
     pc = pc + 4 | 0;
     continue;
    }
   case 77:
    {
     HEAP32[sp - 4 >> 2] = pc;
     __ZNSt3__227__tree_balance_after_insertIPNS_16__tree_node_baseIPvEEEEvT_S5_(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 5 >> 0] << 3) >> 2] | 0);
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     };
     pc = pc + 4 | 0;
     continue;
    }
   case 78:
    {
     HEAP32[sp - 4 >> 2] = pc;
     lz = __ZNKSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE4findEcj(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 5 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 6 >> 0] << 3) >> 2] | 0) | 0;
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAP32[sp + (lx << 3) >> 2] = lz;
     pc = pc + 4 | 0;
     continue;
    }
   case 79:
    {
     HEAP32[sp - 4 >> 2] = pc;
     lz = __ZN8TreeNode18findChildWithValueENSt3__212basic_stringIcNS0_11char_traitsIcEENS0_9allocatorIcEEEE(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 5 >> 0] << 3) >> 2] | 0) | 0;
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAP32[sp + (lx << 3) >> 2] = lz;
     pc = pc + 4 | 0;
     continue;
    }
   case 80:
    {
     HEAP32[sp - 4 >> 2] = pc;
     __ZNKSt3__220__vector_base_commonILb1EE20__throw_length_errorEv(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0);
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     };
     pc = pc + 4 | 0;
     continue;
    }
   case 81:
    {
     HEAP32[sp - 4 >> 2] = pc;
     __ZNSt9bad_allocC2Ev(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0);
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     };
     pc = pc + 4 | 0;
     continue;
    }
   case 82:
    {
     HEAP32[sp - 4 >> 2] = pc;
     lz = __ZNSt3__29__num_getIwE19__stage2_float_loopEwRbRcPcRS4_wwRKNS_12basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEEPjRSE_RjPw(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 5 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 6 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 7 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 8 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 9 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 10 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 11 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 12 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 13 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 14 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 15 >> 0] << 3) >> 2] | 0) | 0;
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAP32[sp + (lx << 3) >> 2] = lz;
     pc = pc + 12 | 0;
     continue;
    }
   case 83:
    {
     HEAP32[sp - 4 >> 2] = pc;
     lz = __ZNSt3__29__num_getIwE17__stage2_int_loopEwiPcRS2_RjwRKNS_12basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEEPjRSD_Pw(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 5 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 6 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 7 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 8 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 9 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 10 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 11 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 12 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 13 >> 0] << 3) >> 2] | 0) | 0;
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAP32[sp + (lx << 3) >> 2] = lz;
     pc = pc + 12 | 0;
     continue;
    }
   case 84:
    {
     HEAP32[sp - 4 >> 2] = pc;
     lz = __ZNSt3__26__treeINS_12__value_typeINS_12basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEES7_EENS_19__map_value_compareIS7_S8_NS_4lessIS7_EELb1EEENS5_IS8_EEE4findIS7_EENS_15__tree_iteratorIS8_PNS_11__tree_nodeIS8_PvEEiEERKT_(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 5 >> 0] << 3) >> 2] | 0) | 0;
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAP32[sp + (lx << 3) >> 2] = lz;
     pc = pc + 4 | 0;
     continue;
    }
   case 85:
    {
     HEAP32[sp - 4 >> 2] = pc;
     lz = __ZNSt3__26__clocEv() | 0;
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAP32[sp + (lx << 3) >> 2] = lz;
     continue;
    }
   case 86:
    {
     HEAP32[sp - 4 >> 2] = pc;
     lz = __ZNSt3__29__num_getIcE19__stage2_float_loopEcRbRcPcRS4_ccRKNS_12basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEEPjRSE_RjS4_(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 5 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 6 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 7 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 8 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 9 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 10 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 11 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 12 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 13 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 14 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 15 >> 0] << 3) >> 2] | 0) | 0;
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAP32[sp + (lx << 3) >> 2] = lz;
     pc = pc + 12 | 0;
     continue;
    }
   case 87:
    {
     HEAP32[sp - 4 >> 2] = pc;
     lz = __ZNSt3__29__num_getIcE17__stage2_int_loopEciPcRS2_RjcRKNS_12basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEEPjRSD_S2_(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 5 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 6 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 7 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 8 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 9 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 10 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 11 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 12 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 13 >> 0] << 3) >> 2] | 0) | 0;
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAP32[sp + (lx << 3) >> 2] = lz;
     pc = pc + 12 | 0;
     continue;
    }
   case 88:
    {
     HEAP32[sp - 4 >> 2] = pc;
     lz = _isxdigit_l(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 5 >> 0] << 3) >> 2] | 0) | 0;
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAP32[sp + (lx << 3) >> 2] = lz;
     pc = pc + 4 | 0;
     continue;
    }
   case 89:
    {
     HEAP32[sp - 4 >> 2] = pc;
     lz = _isdigit_l(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 5 >> 0] << 3) >> 2] | 0) | 0;
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAP32[sp + (lx << 3) >> 2] = lz;
     pc = pc + 4 | 0;
     continue;
    }
   case 90:
    {
     HEAP32[sp - 4 >> 2] = pc;
     lz = _memmove(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 5 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 6 >> 0] << 3) >> 2] | 0) | 0;
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAP32[sp + (lx << 3) >> 2] = lz;
     pc = pc + 4 | 0;
     continue;
    }
   case 91:
    {
     HEAP32[sp - 4 >> 2] = pc;
     lz = _memcpy(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 5 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 6 >> 0] << 3) >> 2] | 0) | 0;
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAP32[sp + (lx << 3) >> 2] = lz;
     pc = pc + 4 | 0;
     continue;
    }
   case 92:
    {
     HEAP32[sp - 4 >> 2] = pc;
     lz = __ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE5eraseEjj(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 5 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 6 >> 0] << 3) >> 2] | 0) | 0;
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAP32[sp + (lx << 3) >> 2] = lz;
     pc = pc + 4 | 0;
     continue;
    }
   case 93:
    {
     HEAP32[sp - 4 >> 2] = pc;
     __ZNSt3__25ctypeIcEC2EPKtbj(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 5 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 6 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 7 >> 0] << 3) >> 2] | 0);
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     };
     pc = pc + 4 | 0;
     continue;
    }
   case 94:
    {
     HEAP32[sp - 4 >> 2] = pc;
     __ZNSt3__28numpunctIcEC2Ej(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 5 >> 0] << 3) >> 2] | 0);
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     };
     pc = pc + 4 | 0;
     continue;
    }
   case 95:
    {
     HEAP32[sp - 4 >> 2] = pc;
     __ZNSt3__28numpunctIwEC2Ej(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 5 >> 0] << 3) >> 2] | 0);
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     };
     pc = pc + 4 | 0;
     continue;
    }
   case 96:
    {
     HEAP32[sp - 4 >> 2] = pc;
     __ZN14SavedSkinDBRowD2Ev(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0);
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     };
     pc = pc + 4 | 0;
     continue;
    }
   case 97:
    {
     HEAP32[sp - 4 >> 2] = pc;
     lz = __ZNSt3__214__num_put_base14__format_floatEPcPKcj(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 5 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 6 >> 0] << 3) >> 2] | 0) | 0;
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAP32[sp + (lx << 3) >> 2] = lz;
     pc = pc + 4 | 0;
     continue;
    }
   case 98:
    {
     HEAP32[sp - 4 >> 2] = pc;
     lz = __ZNSt3__214__num_put_base18__identify_paddingEPcS1_RKNS_8ios_baseE(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 5 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 6 >> 0] << 3) >> 2] | 0) | 0;
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAP32[sp + (lx << 3) >> 2] = lz;
     pc = pc + 4 | 0;
     continue;
    }
   case 99:
    {
     HEAP32[sp - 4 >> 2] = pc;
     __ZNSt3__26localeC2ERKS0_(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 5 >> 0] << 3) >> 2] | 0);
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     };
     pc = pc + 4 | 0;
     continue;
    }
   case 100:
    {
     HEAP32[sp - 4 >> 2] = pc;
     lz = _catgets(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 5 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 6 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 7 >> 0] << 3) >> 2] | 0) | 0;
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAP32[sp + (lx << 3) >> 2] = lz;
     pc = pc + 4 | 0;
     continue;
    }
   case 101:
    {
     HEAP32[sp - 4 >> 2] = pc;
     lz = __ZNSt3__26__treeINS_12__value_typeINS_12basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEEN8nlohmann10basic_jsonINS_3mapENS_6vectorES7_bxydS5_NS8_14adl_serializerEEEEENS_19__map_value_compareIS7_SE_NS_4lessIS7_EELb1EEENS5_ISE_EEE12__find_equalIS7_EERPNS_16__tree_node_baseIPvEESQ_RKT_(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 5 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 6 >> 0] << 3) >> 2] | 0) | 0;
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAP32[sp + (lx << 3) >> 2] = lz;
     pc = pc + 4 | 0;
     continue;
    }
   case 102:
    {
     HEAP32[sp - 4 >> 2] = pc;
     lz = ___cxa_guard_acquire(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0) | 0;
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAP32[sp + (lx << 3) >> 2] = lz;
     pc = pc + 4 | 0;
     continue;
    }
   case 103:
    {
     HEAP32[sp - 4 >> 2] = pc;
     __Z14clear_log_filev();
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     };
     continue;
    }
   case 104:
    {
     HEAP32[sp - 4 >> 2] = pc;
     _srand(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0);
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     };
     pc = pc + 4 | 0;
     continue;
    }
   case 105:
    {
     HEAP32[sp - 4 >> 2] = pc;
     __Z25set_periodic_feature_callPFvvE(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0);
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     };
     pc = pc + 4 | 0;
     continue;
    }
   case 106:
    {
     HEAP32[sp - 4 >> 2] = pc;
     __ZNKSt3__221__basic_string_commonILb1EE20__throw_length_errorEv(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0);
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     };
     pc = pc + 4 | 0;
     continue;
    }
   case 107:
    {
     HEAP32[sp - 4 >> 2] = pc;
     lz = FUNCTION_TABLE_iiiiii[HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] & 31](HEAP32[sp + (HEAPU8[pc + 5 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 6 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 7 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 8 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 9 >> 0] << 3) >> 2] | 0) | 0;
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAP32[sp + (lx << 3) >> 2] = lz;
     pc = pc + 8 | 0;
     continue;
    }
   case 108:
    {
     HEAP32[sp - 4 >> 2] = pc;
     FUNCTION_TABLE_viiiii[HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] & 3](HEAP32[sp + (HEAPU8[pc + 5 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 6 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 7 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 8 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 9 >> 0] << 3) >> 2] | 0);
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     };
     pc = pc + 8 | 0;
     continue;
    }
   case 109:
    {
     HEAP32[sp - 4 >> 2] = pc;
     FUNCTION_TABLE_viiiiii[HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] & 15](HEAP32[sp + (HEAPU8[pc + 5 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 6 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 7 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 8 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 9 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 10 >> 0] << 3) >> 2] | 0);
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     };
     pc = pc + 8 | 0;
     continue;
    }
   case 110:
    {
     HEAP32[sp - 4 >> 2] = pc;
     __Z21reset_vehicle_globalsv();
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     };
     continue;
    }
   case 111:
    {
     HEAP32[sp - 4 >> 2] = pc;
     __Z24reset_teleporter_globalsv();
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     };
     continue;
    }
   case 112:
    {
     HEAP32[sp - 4 >> 2] = pc;
     __Z20reset_weapon_globalsv();
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     };
     continue;
    }
   case 113:
    {
     HEAP32[sp - 4 >> 2] = pc;
     lz = __ZNSt3__26__treeINS_12__value_typeINS_12basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEEN8nlohmann10basic_jsonINS_3mapENS_6vectorES7_bxydS5_NS8_14adl_serializerEEEEENS_19__map_value_compareIS7_SE_NS_4lessIS7_EELb1EEENS5_ISE_EEE12__find_equalIS7_EERPNS_16__tree_node_baseIPvEENS_21__tree_const_iteratorISE_PNS_11__tree_nodeISE_SN_EEiEESQ_RKT_(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 5 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 6 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 7 >> 0] << 3) >> 2] | 0) | 0;
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAP32[sp + (lx << 3) >> 2] = lz;
     pc = pc + 4 | 0;
     continue;
    }
   case 114:
    {
     HEAP32[sp - 4 >> 2] = pc;
     lz = __ZNSt3__211char_traitsIwE4copyEPwPKwj(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 5 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 6 >> 0] << 3) >> 2] | 0) | 0;
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAP32[sp + (lx << 3) >> 2] = lz;
     pc = pc + 4 | 0;
     continue;
    }
   case 115:
    {
     HEAP32[sp - 4 >> 2] = pc;
     __ZNSt3__26vectorIPNS_6locale5facetENS_15__sso_allocatorIS3_Lj28EEEE10deallocateEv(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0);
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     };
     pc = pc + 4 | 0;
     continue;
    }
   case 116:
    {
     HEAP32[sp - 4 >> 2] = pc;
     lz = __ZNSt3__26__treeINS_12__value_typeINS_12basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEES7_EENS_19__map_value_compareIS7_S8_NS_4lessIS7_EELb1EEENS5_IS8_EEE12__find_equalIS7_EERPNS_16__tree_node_baseIPvEESK_RKT_(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 5 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 6 >> 0] << 3) >> 2] | 0) | 0;
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAP32[sp + (lx << 3) >> 2] = lz;
     pc = pc + 4 | 0;
     continue;
    }
   case 117:
    {
     HEAP32[sp - 4 >> 2] = pc;
     __ZNSt3__214__num_put_base12__format_intEPcPKcbj(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 5 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 6 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 7 >> 0] << 3) >> 2] | 0);
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     };
     pc = pc + 4 | 0;
     continue;
    }
   case 118:
    {
     HEAP32[sp - 4 >> 2] = pc;
     __ZNK10__cxxabiv117__class_type_info29process_static_type_above_dstEPNS_19__dynamic_cast_infoEPKvS4_i(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 5 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 6 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 7 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 8 >> 0] << 3) >> 2] | 0);
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     };
     pc = pc + 8 | 0;
     continue;
    }
   case 119:
    {
     HEAP32[sp - 4 >> 2] = pc;
     lz = FUNCTION_TABLE_iiiiid[HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] & 7](HEAP32[sp + (HEAPU8[pc + 5 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 6 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 7 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 8 >> 0] << 3) >> 2] | 0, +HEAPF64[sp + (HEAPU8[pc + 9 >> 0] << 3) >> 3]) | 0;
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAP32[sp + (lx << 3) >> 2] = lz;
     pc = pc + 8 | 0;
     continue;
    }
   case 120:
    {
     HEAP32[sp - 4 >> 2] = pc;
     __ZNSt3__26vectorIPNS_6locale5facetENS_15__sso_allocatorIS3_Lj28EEEE26__swap_out_circular_bufferERNS_14__split_bufferIS3_RS5_EE(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 5 >> 0] << 3) >> 2] | 0);
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     };
     pc = pc + 4 | 0;
     continue;
    }
   case 121:
    {
     HEAP32[sp - 4 >> 2] = pc;
     __ZNSt3__214__split_bufferIPNS_6locale5facetERNS_15__sso_allocatorIS3_Lj28EEEED2Ev(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0);
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     };
     pc = pc + 4 | 0;
     continue;
    }
   case 122:
    {
     HEAP32[sp - 4 >> 2] = pc;
     __ZNKSt3__210__time_put8__do_putEPcRS1_PK2tmcc(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 5 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 6 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 7 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 8 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 9 >> 0] << 3) >> 2] | 0);
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     };
     pc = pc + 8 | 0;
     continue;
    }
   case 123:
    {
     HEAP32[sp - 4 >> 2] = pc;
     __ZNSt3__214__shared_count12__add_sharedEv(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0);
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     };
     pc = pc + 4 | 0;
     continue;
    }
   case 124:
    {
     HEAP32[sp - 4 >> 2] = pc;
     lz = ___towrite(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0) | 0;
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAP32[sp + (lx << 3) >> 2] = lz;
     pc = pc + 4 | 0;
     continue;
    }
   case 125:
    {
     HEAP32[sp - 4 >> 2] = pc;
     __ZNKSt3__210__time_put8__do_putEPwRS1_PK2tmcc(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 5 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 6 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 7 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 8 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 9 >> 0] << 3) >> 2] | 0);
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     };
     pc = pc + 8 | 0;
     continue;
    }
   case 126:
    {
     HEAP32[sp - 4 >> 2] = pc;
     __ZNKSt3__221__basic_string_commonILb1EE20__throw_out_of_rangeEv(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0);
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     };
     pc = pc + 4 | 0;
     continue;
    }
   case 127:
    {
     HEAP32[sp - 4 >> 2] = pc;
     ___lock(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0);
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     };
     pc = pc + 4 | 0;
     continue;
    }
   case 128:
    {
     HEAP32[sp - 4 >> 2] = pc;
     ___unlock(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0);
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     };
     pc = pc + 4 | 0;
     continue;
    }
   case 129:
    {
     HEAP32[sp - 4 >> 2] = pc;
     FUNCTION_TABLE_viiii[HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] & 15](HEAP32[sp + (HEAPU8[pc + 5 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 6 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 7 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 8 >> 0] << 3) >> 2] | 0);
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     };
     pc = pc + 8 | 0;
     continue;
    }
   case 130:
    {
     HEAP32[sp - 4 >> 2] = pc;
     __ZNK10__cxxabiv117__class_type_info24process_found_base_classEPNS_19__dynamic_cast_infoEPvi(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 5 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 6 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 7 >> 0] << 3) >> 2] | 0);
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     };
     pc = pc + 4 | 0;
     continue;
    }
   case 131:
    {
     HEAP32[sp - 4 >> 2] = pc;
     lz = __ZNSt3__211char_traitsIwE4moveEPwPKwj(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 5 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 6 >> 0] << 3) >> 2] | 0) | 0;
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAP32[sp + (lx << 3) >> 2] = lz;
     pc = pc + 4 | 0;
     continue;
    }
   case 132:
    {
     HEAP32[sp - 4 >> 2] = pc;
     lz = __ZSt18uncaught_exceptionv() | 0;
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAP32[sp + (lx << 3) >> 2] = lz;
     continue;
    }
   case 133:
    {
     HEAP32[sp - 4 >> 2] = pc;
     lz = __ZNSt3__211char_traitsIwE6assignEPwjw(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 5 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 6 >> 0] << 3) >> 2] | 0) | 0;
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAP32[sp + (lx << 3) >> 2] = lz;
     pc = pc + 4 | 0;
     continue;
    }
   case 134:
    {
     HEAP32[sp - 4 >> 2] = pc;
     __ZNSt3__213__vector_baseIPNS_6locale5facetENS_15__sso_allocatorIS3_Lj28EEEED2Ev(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0);
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     };
     pc = pc + 4 | 0;
     continue;
    }
   case 135:
    {
     HEAP32[sp - 4 >> 2] = pc;
     lz = _pthread_mutex_lock(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0) | 0;
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAP32[sp + (lx << 3) >> 2] = lz;
     pc = pc + 4 | 0;
     continue;
    }
   case 136:
    {
     HEAP32[sp - 4 >> 2] = pc;
     lz = _pthread_cond_wait(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 5 >> 0] << 3) >> 2] | 0) | 0;
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAP32[sp + (lx << 3) >> 2] = lz;
     pc = pc + 4 | 0;
     continue;
    }
   case 137:
    {
     HEAP32[sp - 4 >> 2] = pc;
     lz = _pthread_mutex_unlock(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0) | 0;
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAP32[sp + (lx << 3) >> 2] = lz;
     pc = pc + 4 | 0;
     continue;
    }
   case 138:
    {
     HEAP32[sp - 4 >> 2] = pc;
     lz = _pthread_cond_broadcast(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0) | 0;
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAP32[sp + (lx << 3) >> 2] = lz;
     pc = pc + 4 | 0;
     continue;
    }
   case 139:
    {
     HEAP32[sp - 4 >> 2] = pc;
     lz = _uselocale(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0) | 0;
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAP32[sp + (lx << 3) >> 2] = lz;
     pc = pc + 4 | 0;
     continue;
    }
   case 140:
    {
     HEAP32[sp - 4 >> 2] = pc;
     lz = __ZSt15get_new_handlerv() | 0;
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAP32[sp + (lx << 3) >> 2] = lz;
     continue;
    }
   case 141:
    {
     HEAP32[sp - 4 >> 2] = pc;
     lz = _wcslen(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0) | 0;
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAP32[sp + (lx << 3) >> 2] = lz;
     pc = pc + 4 | 0;
     continue;
    }
   case 142:
    {
     HEAP32[sp - 4 >> 2] = pc;
     _abort();
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     };
     continue;
    }
   case 143:
    {
     HEAP32[sp - 4 >> 2] = pc;
     lz = _pthread_once(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 5 >> 0] << 3) >> 2] | 0) | 0;
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAP32[sp + (lx << 3) >> 2] = lz;
     pc = pc + 4 | 0;
     continue;
    }
   case 144:
    {
     HEAP32[sp - 4 >> 2] = pc;
     lz = _pthread_getspecific(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0) | 0;
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAP32[sp + (lx << 3) >> 2] = lz;
     pc = pc + 4 | 0;
     continue;
    }
   case 145:
    {
     HEAP32[sp - 4 >> 2] = pc;
     lz = _pthread_setspecific(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 5 >> 0] << 3) >> 2] | 0) | 0;
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAP32[sp + (lx << 3) >> 2] = lz;
     pc = pc + 4 | 0;
     continue;
    }
   case 146:
    {
     HEAP32[sp - 4 >> 2] = pc;
     lz = _pthread_key_create(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0, HEAP32[sp + (HEAPU8[pc + 5 >> 0] << 3) >> 2] | 0) | 0;
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAP32[sp + (lx << 3) >> 2] = lz;
     pc = pc + 4 | 0;
     continue;
    }
   case 147:
    {
     HEAP32[sp - 4 >> 2] = pc;
     lz = ___cxa_begin_catch(HEAP32[sp + (HEAPU8[pc + 4 >> 0] << 3) >> 2] | 0) | 0;
     if ((asyncState | 0) == 1) {
      EMTSTACKTOP = sp - 8 | 0;
      return;
     } else HEAP32[sp + (lx << 3) >> 2] = lz;
     pc = pc + 4 | 0;
     continue;
    }
   default:
   }
   break;
  case 136:
   HEAP32[sp + (lx << 3) >> 2] = STACKTOP;
   break;
  case 137:
   STACKTOP = HEAP32[sp + (lx << 3) >> 2] | 0;
   break;
  case 138:
   lz = HEAP32[sp + (lz << 3) >> 2] | 0;
   lx = (HEAP32[sp + (lx << 3) >> 2] | 0) - (HEAP32[sp + (ly << 3) >> 2] | 0) >>> 0;
   if (lx >>> 0 >= lz >>> 0) {
    pc = pc + (lz << 2) | 0;
    continue;
   }
   pc = HEAP32[pc + 4 + (lx << 2) >> 2] | 0;
   pc = pc - 4 | 0;
   continue;
   break;
  case 139:
   EMTSTACKTOP = sp - 8 | 0;
   HEAP32[EMTSTACKTOP >> 2] = HEAP32[sp + (lx << 3) >> 2] | 0;
   HEAP32[EMTSTACKTOP + 4 >> 2] = HEAP32[sp + (lx << 3) + 4 >> 2] | 0;
   return;
   break;
  case 141:
   HEAP32[sp + (lx << 3) >> 2] = HEAP32[sp + (inst >>> 16 << 3) >> 2] | 0;
   break;
  case 142:
   HEAPF64[sp + (lx << 3) >> 3] = +HEAPF64[sp + (inst >>> 16 << 3) >> 3];
   break;
  case 143:
   HEAP32[sp + (inst >>> 16 << 3) >> 2] = HEAP32[sp + (lx << 3) >> 2] | 0;
   break;
  case 144:
   HEAPF64[sp + (inst >>> 16 << 3) >> 3] = +HEAPF64[sp + (lx << 3) >> 3];
   break;
  default:
  }
 }
}

function _malloc($bytes) {
 $bytes = $bytes | 0;
 var $$0 = 0, $$lcssa = 0, $$lcssa141 = 0, $$lcssa142 = 0, $$lcssa144 = 0, $$lcssa147 = 0, $$lcssa149 = 0, $$lcssa151 = 0, $$lcssa153 = 0, $$lcssa155 = 0, $$lcssa157 = 0, $$pre$phi$i$iZ2D = 0, $$pre$phi$i14Z2D = 0, $$pre$phi$i17$iZ2D = 0, $$pre$phi$iZ2D = 0, $$pre$phi10$i$iZ2D = 0, $$pre$phiZ2D = 0, $$rsize$4$i = 0, $100 = 0, $1002 = 0, $1008 = 0, $101 = 0, $1011 = 0, $1012 = 0, $1030 = 0, $1032 = 0, $1039 = 0, $1040 = 0, $1041 = 0, $1049 = 0, $1051 = 0, $1052 = 0, $1053 = 0, $107 = 0, $111 = 0, $113 = 0, $114 = 0, $116 = 0, $118 = 0, $12 = 0, $120 = 0, $122 = 0, $124 = 0, $126 = 0, $128 = 0, $133 = 0, $139 = 0, $14 = 0, $142 = 0, $145 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $152 = 0, $155 = 0, $157 = 0, $16 = 0, $160 = 0, $162 = 0, $165 = 0, $168 = 0, $169 = 0, $17 = 0, $171 = 0, $172 = 0, $174 = 0, $175 = 0, $177 = 0, $178 = 0, $18 = 0, $183 = 0, $184 = 0, $193 = 0, $198 = 0, $202 = 0, $208 = 0, $215 = 0, $219 = 0, $227 = 0, $229 = 0, $230 = 0, $232 = 0, $233 = 0, $234 = 0, $238 = 0, $239 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $251 = 0, $252 = 0, $257 = 0, $258 = 0, $261 = 0, $263 = 0, $266 = 0, $271 = 0, $278 = 0, $28 = 0, $287 = 0, $288 = 0, $292 = 0, $298 = 0, $303 = 0, $306 = 0, $310 = 0, $312 = 0, $313 = 0, $315 = 0, $317 = 0, $319 = 0, $32 = 0, $321 = 0, $323 = 0, $325 = 0, $327 = 0, $337 = 0, $338 = 0, $340 = 0, $349 = 0, $35 = 0, $351 = 0, $354 = 0, $356 = 0, $359 = 0, $361 = 0, $364 = 0, $367 = 0, $368 = 0, $370 = 0, $371 = 0, $373 = 0, $374 = 0, $376 = 0, $377 = 0, $382 = 0, $383 = 0, $39 = 0, $392 = 0, $397 = 0, $4 = 0, $401 = 0, $407 = 0, $414 = 0, $418 = 0, $42 = 0, $426 = 0, $429 = 0, $430 = 0, $431 = 0, $435 = 0, $436 = 0, $442 = 0, $447 = 0, $448 = 0, $45 = 0, $451 = 0, $453 = 0, $456 = 0, $461 = 0, $467 = 0, $469 = 0, $47 = 0, $471 = 0, $472 = 0, $48 = 0, $490 = 0, $492 = 0, $499 = 0, $5 = 0, $50 = 0, $500 = 0, $501 = 0, $509 = 0, $511 = 0, $512 = 0, $514 = 0, $52 = 0, $523 = 0, $527 = 0, $529 = 0, $530 = 0, $531 = 0, $54 = 0, $541 = 0, $542 = 0, $543 = 0, $544 = 0, $545 = 0, $546 = 0, $547 = 0, $549 = 0, $551 = 0, $552 = 0, $558 = 0, $56 = 0, $560 = 0, $562 = 0, $569 = 0, $571 = 0, $572 = 0, $573 = 0, $58 = 0, $581 = 0, $582 = 0, $585 = 0, $589 = 0, $593 = 0, $595 = 0, $6 = 0, $60 = 0, $601 = 0, $605 = 0, $609 = 0, $618 = 0, $619 = 0, $62 = 0, $625 = 0, $628 = 0, $631 = 0, $633 = 0, $638 = 0, $644 = 0, $649 = 0, $65 = 0, $650 = 0, $651 = 0, $657 = 0, $658 = 0, $659 = 0, $67 = 0, $674 = 0, $679 = 0, $68 = 0, $680 = 0, $682 = 0, $688 = 0, $69 = 0, $690 = 0, $7 = 0, $70 = 0, $700 = 0, $704 = 0, $71 = 0, $710 = 0, $712 = 0, $718 = 0, $722 = 0, $723 = 0, $728 = 0, $734 = 0, $739 = 0, $742 = 0, $743 = 0, $746 = 0, $748 = 0, $750 = 0, $753 = 0, $764 = 0, $769 = 0, $771 = 0, $774 = 0, $776 = 0, $779 = 0, $78 = 0, $782 = 0, $783 = 0, $784 = 0, $786 = 0, $788 = 0, $789 = 0, $791 = 0, $792 = 0, $797 = 0, $798 = 0, $807 = 0, $812 = 0, $815 = 0, $816 = 0, $82 = 0, $822 = 0, $830 = 0, $836 = 0, $839 = 0, $840 = 0, $841 = 0, $845 = 0, $846 = 0, $85 = 0, $852 = 0, $857 = 0, $858 = 0, $861 = 0, $863 = 0, $866 = 0, $871 = 0, $877 = 0, $879 = 0, $881 = 0, $882 = 0, $89 = 0, $900 = 0, $902 = 0, $909 = 0, $91 = 0, $910 = 0, $911 = 0, $918 = 0, $92 = 0, $922 = 0, $926 = 0, $928 = 0, $934 = 0, $935 = 0, $937 = 0, $938 = 0, $94 = 0, $942 = 0, $947 = 0, $948 = 0, $949 = 0, $95 = 0, $955 = 0, $96 = 0, $962 = 0, $967 = 0, $970 = 0, $971 = 0, $972 = 0, $976 = 0, $977 = 0, $983 = 0, $988 = 0, $989 = 0, $992 = 0, $994 = 0, $997 = 0, $F$0$i$i = 0, $F1$0$i = 0, $F4$0 = 0, $F4$0$i$i = 0, $F5$0$i = 0, $I1$0$i$i = 0, $I7$0$i = 0, $I7$0$i$i = 0, $K12$0$i = 0, $K2$0$i$i = 0, $K8$0$i$i = 0, $R$1$i = 0, $R$1$i$i = 0, $R$1$i$i$lcssa = 0, $R$1$i$lcssa = 0, $R$1$i9 = 0, $R$1$i9$lcssa = 0, $R$3$i = 0, $R$3$i$i = 0, $R$3$i11 = 0, $RP$1$i = 0, $RP$1$i$i = 0, $RP$1$i$i$lcssa = 0, $RP$1$i$lcssa = 0, $RP$1$i8 = 0, $RP$1$i8$lcssa = 0, $T$0$i = 0, $T$0$i$i = 0, $T$0$i$i$lcssa = 0, $T$0$i$i$lcssa140 = 0, $T$0$i$lcssa = 0, $T$0$i$lcssa156 = 0, $T$0$i18$i = 0, $T$0$i18$i$lcssa = 0, $T$0$i18$i$lcssa139 = 0, $br$2$ph$i = 0, $i$01$i$i = 0, $idx$0$i = 0, $magic$i$i = 0, $nb$0 = 0, $oldfirst$0$i$i = 0, $p$0$i$i = 0, $qsize$0$i$i = 0, $rsize$0$i = 0, $rsize$0$i$lcssa = 0, $rsize$0$i5 = 0, $rsize$1$i = 0, $rsize$3$i = 0, $rsize$4$lcssa$i = 0, $rsize$412$i = 0, $rst$0$i = 0, $rst$1$i = 0, $sizebits$0$i = 0, $sp$0$i$i = 0, $sp$0$i$i$i = 0, $sp$068$i = 0, $sp$068$i$lcssa = 0, $sp$167$i = 0, $sp$167$i$lcssa = 0, $ssize$0$i = 0, $ssize$2$ph$i = 0, $ssize$5$i = 0, $t$0$i = 0, $t$0$i4 = 0, $t$2$i = 0, $t$4$ph$i = 0, $t$4$v$4$i = 0, $t$411$i = 0, $tbase$746$i = 0, $tsize$745$i = 0, $v$0$i = 0, $v$0$i$lcssa = 0, $v$0$i6 = 0, $v$1$i = 0, $v$3$i = 0, $v$4$lcssa$i = 0, $v$413$i = 0, label = 0, sp = 0;
 label = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16 | 0;
 $magic$i$i = sp;
 do if ($bytes >>> 0 < 245) {
  $4 = $bytes >>> 0 < 11 ? 16 : $bytes + 11 & -8;
  $5 = $4 >>> 3;
  $6 = HEAP32[22840] | 0;
  $7 = $6 >>> $5;
  if ($7 & 3 | 0) {
   $12 = ($7 & 1 ^ 1) + $5 | 0;
   $14 = 91400 + ($12 << 1 << 2) | 0;
   $15 = $14 + 8 | 0;
   $16 = HEAP32[$15 >> 2] | 0;
   $17 = $16 + 8 | 0;
   $18 = HEAP32[$17 >> 2] | 0;
   do if (($14 | 0) == ($18 | 0)) HEAP32[22840] = $6 & ~(1 << $12); else {
    if ($18 >>> 0 < (HEAP32[22844] | 0) >>> 0) _abort();
    $25 = $18 + 12 | 0;
    if ((HEAP32[$25 >> 2] | 0) == ($16 | 0)) {
     HEAP32[$25 >> 2] = $14;
     HEAP32[$15 >> 2] = $18;
     break;
    } else _abort();
   } while (0);
   $28 = $12 << 3;
   HEAP32[$16 + 4 >> 2] = $28 | 3;
   $32 = $16 + $28 + 4 | 0;
   HEAP32[$32 >> 2] = HEAP32[$32 >> 2] | 1;
   $$0 = $17;
   STACKTOP = sp;
   return $$0 | 0;
  }
  $35 = HEAP32[22842] | 0;
  if ($4 >>> 0 > $35 >>> 0) {
   if ($7 | 0) {
    $39 = 2 << $5;
    $42 = $7 << $5 & ($39 | 0 - $39);
    $45 = ($42 & 0 - $42) + -1 | 0;
    $47 = $45 >>> 12 & 16;
    $48 = $45 >>> $47;
    $50 = $48 >>> 5 & 8;
    $52 = $48 >>> $50;
    $54 = $52 >>> 2 & 4;
    $56 = $52 >>> $54;
    $58 = $56 >>> 1 & 2;
    $60 = $56 >>> $58;
    $62 = $60 >>> 1 & 1;
    $65 = ($50 | $47 | $54 | $58 | $62) + ($60 >>> $62) | 0;
    $67 = 91400 + ($65 << 1 << 2) | 0;
    $68 = $67 + 8 | 0;
    $69 = HEAP32[$68 >> 2] | 0;
    $70 = $69 + 8 | 0;
    $71 = HEAP32[$70 >> 2] | 0;
    do if (($67 | 0) == ($71 | 0)) {
     HEAP32[22840] = $6 & ~(1 << $65);
     $89 = $35;
    } else {
     if ($71 >>> 0 < (HEAP32[22844] | 0) >>> 0) _abort();
     $78 = $71 + 12 | 0;
     if ((HEAP32[$78 >> 2] | 0) == ($69 | 0)) {
      HEAP32[$78 >> 2] = $67;
      HEAP32[$68 >> 2] = $71;
      $89 = HEAP32[22842] | 0;
      break;
     } else _abort();
    } while (0);
    $82 = ($65 << 3) - $4 | 0;
    HEAP32[$69 + 4 >> 2] = $4 | 3;
    $85 = $69 + $4 | 0;
    HEAP32[$85 + 4 >> 2] = $82 | 1;
    HEAP32[$85 + $82 >> 2] = $82;
    if ($89 | 0) {
     $91 = HEAP32[22845] | 0;
     $92 = $89 >>> 3;
     $94 = 91400 + ($92 << 1 << 2) | 0;
     $95 = HEAP32[22840] | 0;
     $96 = 1 << $92;
     if (!($95 & $96)) {
      HEAP32[22840] = $95 | $96;
      $$pre$phiZ2D = $94 + 8 | 0;
      $F4$0 = $94;
     } else {
      $100 = $94 + 8 | 0;
      $101 = HEAP32[$100 >> 2] | 0;
      if ($101 >>> 0 < (HEAP32[22844] | 0) >>> 0) _abort(); else {
       $$pre$phiZ2D = $100;
       $F4$0 = $101;
      }
     }
     HEAP32[$$pre$phiZ2D >> 2] = $91;
     HEAP32[$F4$0 + 12 >> 2] = $91;
     HEAP32[$91 + 8 >> 2] = $F4$0;
     HEAP32[$91 + 12 >> 2] = $94;
    }
    HEAP32[22842] = $82;
    HEAP32[22845] = $85;
    $$0 = $70;
    STACKTOP = sp;
    return $$0 | 0;
   }
   $107 = HEAP32[22841] | 0;
   if (!$107) $nb$0 = $4; else {
    $111 = ($107 & 0 - $107) + -1 | 0;
    $113 = $111 >>> 12 & 16;
    $114 = $111 >>> $113;
    $116 = $114 >>> 5 & 8;
    $118 = $114 >>> $116;
    $120 = $118 >>> 2 & 4;
    $122 = $118 >>> $120;
    $124 = $122 >>> 1 & 2;
    $126 = $122 >>> $124;
    $128 = $126 >>> 1 & 1;
    $133 = HEAP32[91664 + (($116 | $113 | $120 | $124 | $128) + ($126 >>> $128) << 2) >> 2] | 0;
    $rsize$0$i = (HEAP32[$133 + 4 >> 2] & -8) - $4 | 0;
    $t$0$i = $133;
    $v$0$i = $133;
    while (1) {
     $139 = HEAP32[$t$0$i + 16 >> 2] | 0;
     if (!$139) {
      $142 = HEAP32[$t$0$i + 20 >> 2] | 0;
      if (!$142) {
       $rsize$0$i$lcssa = $rsize$0$i;
       $v$0$i$lcssa = $v$0$i;
       break;
      } else $145 = $142;
     } else $145 = $139;
     $148 = (HEAP32[$145 + 4 >> 2] & -8) - $4 | 0;
     $149 = $148 >>> 0 < $rsize$0$i >>> 0;
     $rsize$0$i = $149 ? $148 : $rsize$0$i;
     $t$0$i = $145;
     $v$0$i = $149 ? $145 : $v$0$i;
    }
    $150 = HEAP32[22844] | 0;
    if ($v$0$i$lcssa >>> 0 < $150 >>> 0) _abort();
    $152 = $v$0$i$lcssa + $4 | 0;
    if ($v$0$i$lcssa >>> 0 >= $152 >>> 0) _abort();
    $155 = HEAP32[$v$0$i$lcssa + 24 >> 2] | 0;
    $157 = HEAP32[$v$0$i$lcssa + 12 >> 2] | 0;
    do if (($157 | 0) == ($v$0$i$lcssa | 0)) {
     $168 = $v$0$i$lcssa + 20 | 0;
     $169 = HEAP32[$168 >> 2] | 0;
     if (!$169) {
      $171 = $v$0$i$lcssa + 16 | 0;
      $172 = HEAP32[$171 >> 2] | 0;
      if (!$172) {
       $R$3$i = 0;
       break;
      } else {
       $R$1$i = $172;
       $RP$1$i = $171;
      }
     } else {
      $R$1$i = $169;
      $RP$1$i = $168;
     }
     while (1) {
      $174 = $R$1$i + 20 | 0;
      $175 = HEAP32[$174 >> 2] | 0;
      if ($175 | 0) {
       $R$1$i = $175;
       $RP$1$i = $174;
       continue;
      }
      $177 = $R$1$i + 16 | 0;
      $178 = HEAP32[$177 >> 2] | 0;
      if (!$178) {
       $R$1$i$lcssa = $R$1$i;
       $RP$1$i$lcssa = $RP$1$i;
       break;
      } else {
       $R$1$i = $178;
       $RP$1$i = $177;
      }
     }
     if ($RP$1$i$lcssa >>> 0 < $150 >>> 0) _abort(); else {
      HEAP32[$RP$1$i$lcssa >> 2] = 0;
      $R$3$i = $R$1$i$lcssa;
      break;
     }
    } else {
     $160 = HEAP32[$v$0$i$lcssa + 8 >> 2] | 0;
     if ($160 >>> 0 < $150 >>> 0) _abort();
     $162 = $160 + 12 | 0;
     if ((HEAP32[$162 >> 2] | 0) != ($v$0$i$lcssa | 0)) _abort();
     $165 = $157 + 8 | 0;
     if ((HEAP32[$165 >> 2] | 0) == ($v$0$i$lcssa | 0)) {
      HEAP32[$162 >> 2] = $157;
      HEAP32[$165 >> 2] = $160;
      $R$3$i = $157;
      break;
     } else _abort();
    } while (0);
    do if ($155 | 0) {
     $183 = HEAP32[$v$0$i$lcssa + 28 >> 2] | 0;
     $184 = 91664 + ($183 << 2) | 0;
     if (($v$0$i$lcssa | 0) == (HEAP32[$184 >> 2] | 0)) {
      HEAP32[$184 >> 2] = $R$3$i;
      if (!$R$3$i) {
       HEAP32[22841] = HEAP32[22841] & ~(1 << $183);
       break;
      }
     } else {
      if ($155 >>> 0 < (HEAP32[22844] | 0) >>> 0) _abort();
      $193 = $155 + 16 | 0;
      if ((HEAP32[$193 >> 2] | 0) == ($v$0$i$lcssa | 0)) HEAP32[$193 >> 2] = $R$3$i; else HEAP32[$155 + 20 >> 2] = $R$3$i;
      if (!$R$3$i) break;
     }
     $198 = HEAP32[22844] | 0;
     if ($R$3$i >>> 0 < $198 >>> 0) _abort();
     HEAP32[$R$3$i + 24 >> 2] = $155;
     $202 = HEAP32[$v$0$i$lcssa + 16 >> 2] | 0;
     do if ($202 | 0) if ($202 >>> 0 < $198 >>> 0) _abort(); else {
      HEAP32[$R$3$i + 16 >> 2] = $202;
      HEAP32[$202 + 24 >> 2] = $R$3$i;
      break;
     } while (0);
     $208 = HEAP32[$v$0$i$lcssa + 20 >> 2] | 0;
     if ($208 | 0) if ($208 >>> 0 < (HEAP32[22844] | 0) >>> 0) _abort(); else {
      HEAP32[$R$3$i + 20 >> 2] = $208;
      HEAP32[$208 + 24 >> 2] = $R$3$i;
      break;
     }
    } while (0);
    if ($rsize$0$i$lcssa >>> 0 < 16) {
     $215 = $rsize$0$i$lcssa + $4 | 0;
     HEAP32[$v$0$i$lcssa + 4 >> 2] = $215 | 3;
     $219 = $v$0$i$lcssa + $215 + 4 | 0;
     HEAP32[$219 >> 2] = HEAP32[$219 >> 2] | 1;
    } else {
     HEAP32[$v$0$i$lcssa + 4 >> 2] = $4 | 3;
     HEAP32[$152 + 4 >> 2] = $rsize$0$i$lcssa | 1;
     HEAP32[$152 + $rsize$0$i$lcssa >> 2] = $rsize$0$i$lcssa;
     $227 = HEAP32[22842] | 0;
     if ($227 | 0) {
      $229 = HEAP32[22845] | 0;
      $230 = $227 >>> 3;
      $232 = 91400 + ($230 << 1 << 2) | 0;
      $233 = HEAP32[22840] | 0;
      $234 = 1 << $230;
      if (!($233 & $234)) {
       HEAP32[22840] = $233 | $234;
       $$pre$phi$iZ2D = $232 + 8 | 0;
       $F1$0$i = $232;
      } else {
       $238 = $232 + 8 | 0;
       $239 = HEAP32[$238 >> 2] | 0;
       if ($239 >>> 0 < (HEAP32[22844] | 0) >>> 0) _abort(); else {
        $$pre$phi$iZ2D = $238;
        $F1$0$i = $239;
       }
      }
      HEAP32[$$pre$phi$iZ2D >> 2] = $229;
      HEAP32[$F1$0$i + 12 >> 2] = $229;
      HEAP32[$229 + 8 >> 2] = $F1$0$i;
      HEAP32[$229 + 12 >> 2] = $232;
     }
     HEAP32[22842] = $rsize$0$i$lcssa;
     HEAP32[22845] = $152;
    }
    $$0 = $v$0$i$lcssa + 8 | 0;
    STACKTOP = sp;
    return $$0 | 0;
   }
  } else $nb$0 = $4;
 } else if ($bytes >>> 0 > 4294967231) $nb$0 = -1; else {
  $247 = $bytes + 11 | 0;
  $248 = $247 & -8;
  $249 = HEAP32[22841] | 0;
  if (!$249) $nb$0 = $248; else {
   $251 = 0 - $248 | 0;
   $252 = $247 >>> 8;
   if (!$252) $idx$0$i = 0; else if ($248 >>> 0 > 16777215) $idx$0$i = 31; else {
    $257 = ($252 + 1048320 | 0) >>> 16 & 8;
    $258 = $252 << $257;
    $261 = ($258 + 520192 | 0) >>> 16 & 4;
    $263 = $258 << $261;
    $266 = ($263 + 245760 | 0) >>> 16 & 2;
    $271 = 14 - ($261 | $257 | $266) + ($263 << $266 >>> 15) | 0;
    $idx$0$i = $248 >>> ($271 + 7 | 0) & 1 | $271 << 1;
   }
   $278 = HEAP32[91664 + ($idx$0$i << 2) >> 2] | 0;
   L123 : do if (!$278) {
    $rsize$3$i = $251;
    $t$2$i = 0;
    $v$3$i = 0;
    label = 86;
   } else {
    $rsize$0$i5 = $251;
    $rst$0$i = 0;
    $sizebits$0$i = $248 << (($idx$0$i | 0) == 31 ? 0 : 25 - ($idx$0$i >>> 1) | 0);
    $t$0$i4 = $278;
    $v$0$i6 = 0;
    while (1) {
     $287 = HEAP32[$t$0$i4 + 4 >> 2] & -8;
     $288 = $287 - $248 | 0;
     if ($288 >>> 0 < $rsize$0$i5 >>> 0) if (($287 | 0) == ($248 | 0)) {
      $rsize$412$i = $288;
      $t$411$i = $t$0$i4;
      $v$413$i = $t$0$i4;
      label = 90;
      break L123;
     } else {
      $rsize$1$i = $288;
      $v$1$i = $t$0$i4;
     } else {
      $rsize$1$i = $rsize$0$i5;
      $v$1$i = $v$0$i6;
     }
     $292 = HEAP32[$t$0$i4 + 20 >> 2] | 0;
     $t$0$i4 = HEAP32[$t$0$i4 + 16 + ($sizebits$0$i >>> 31 << 2) >> 2] | 0;
     $rst$1$i = ($292 | 0) == 0 | ($292 | 0) == ($t$0$i4 | 0) ? $rst$0$i : $292;
     $298 = ($t$0$i4 | 0) == 0;
     if ($298) {
      $rsize$3$i = $rsize$1$i;
      $t$2$i = $rst$1$i;
      $v$3$i = $v$1$i;
      label = 86;
      break;
     } else {
      $rsize$0$i5 = $rsize$1$i;
      $rst$0$i = $rst$1$i;
      $sizebits$0$i = $sizebits$0$i << ($298 & 1 ^ 1);
      $v$0$i6 = $v$1$i;
     }
    }
   } while (0);
   if ((label | 0) == 86) {
    if (($t$2$i | 0) == 0 & ($v$3$i | 0) == 0) {
     $303 = 2 << $idx$0$i;
     $306 = $249 & ($303 | 0 - $303);
     if (!$306) {
      $nb$0 = $248;
      break;
     }
     $310 = ($306 & 0 - $306) + -1 | 0;
     $312 = $310 >>> 12 & 16;
     $313 = $310 >>> $312;
     $315 = $313 >>> 5 & 8;
     $317 = $313 >>> $315;
     $319 = $317 >>> 2 & 4;
     $321 = $317 >>> $319;
     $323 = $321 >>> 1 & 2;
     $325 = $321 >>> $323;
     $327 = $325 >>> 1 & 1;
     $t$4$ph$i = HEAP32[91664 + (($315 | $312 | $319 | $323 | $327) + ($325 >>> $327) << 2) >> 2] | 0;
    } else $t$4$ph$i = $t$2$i;
    if (!$t$4$ph$i) {
     $rsize$4$lcssa$i = $rsize$3$i;
     $v$4$lcssa$i = $v$3$i;
    } else {
     $rsize$412$i = $rsize$3$i;
     $t$411$i = $t$4$ph$i;
     $v$413$i = $v$3$i;
     label = 90;
    }
   }
   if ((label | 0) == 90) while (1) {
    label = 0;
    $337 = (HEAP32[$t$411$i + 4 >> 2] & -8) - $248 | 0;
    $338 = $337 >>> 0 < $rsize$412$i >>> 0;
    $$rsize$4$i = $338 ? $337 : $rsize$412$i;
    $t$4$v$4$i = $338 ? $t$411$i : $v$413$i;
    $340 = HEAP32[$t$411$i + 16 >> 2] | 0;
    if ($340 | 0) {
     $rsize$412$i = $$rsize$4$i;
     $t$411$i = $340;
     $v$413$i = $t$4$v$4$i;
     label = 90;
     continue;
    }
    $t$411$i = HEAP32[$t$411$i + 20 >> 2] | 0;
    if (!$t$411$i) {
     $rsize$4$lcssa$i = $$rsize$4$i;
     $v$4$lcssa$i = $t$4$v$4$i;
     break;
    } else {
     $rsize$412$i = $$rsize$4$i;
     $v$413$i = $t$4$v$4$i;
     label = 90;
    }
   }
   if (!$v$4$lcssa$i) $nb$0 = $248; else if ($rsize$4$lcssa$i >>> 0 < ((HEAP32[22842] | 0) - $248 | 0) >>> 0) {
    $349 = HEAP32[22844] | 0;
    if ($v$4$lcssa$i >>> 0 < $349 >>> 0) _abort();
    $351 = $v$4$lcssa$i + $248 | 0;
    if ($v$4$lcssa$i >>> 0 >= $351 >>> 0) _abort();
    $354 = HEAP32[$v$4$lcssa$i + 24 >> 2] | 0;
    $356 = HEAP32[$v$4$lcssa$i + 12 >> 2] | 0;
    do if (($356 | 0) == ($v$4$lcssa$i | 0)) {
     $367 = $v$4$lcssa$i + 20 | 0;
     $368 = HEAP32[$367 >> 2] | 0;
     if (!$368) {
      $370 = $v$4$lcssa$i + 16 | 0;
      $371 = HEAP32[$370 >> 2] | 0;
      if (!$371) {
       $R$3$i11 = 0;
       break;
      } else {
       $R$1$i9 = $371;
       $RP$1$i8 = $370;
      }
     } else {
      $R$1$i9 = $368;
      $RP$1$i8 = $367;
     }
     while (1) {
      $373 = $R$1$i9 + 20 | 0;
      $374 = HEAP32[$373 >> 2] | 0;
      if ($374 | 0) {
       $R$1$i9 = $374;
       $RP$1$i8 = $373;
       continue;
      }
      $376 = $R$1$i9 + 16 | 0;
      $377 = HEAP32[$376 >> 2] | 0;
      if (!$377) {
       $R$1$i9$lcssa = $R$1$i9;
       $RP$1$i8$lcssa = $RP$1$i8;
       break;
      } else {
       $R$1$i9 = $377;
       $RP$1$i8 = $376;
      }
     }
     if ($RP$1$i8$lcssa >>> 0 < $349 >>> 0) _abort(); else {
      HEAP32[$RP$1$i8$lcssa >> 2] = 0;
      $R$3$i11 = $R$1$i9$lcssa;
      break;
     }
    } else {
     $359 = HEAP32[$v$4$lcssa$i + 8 >> 2] | 0;
     if ($359 >>> 0 < $349 >>> 0) _abort();
     $361 = $359 + 12 | 0;
     if ((HEAP32[$361 >> 2] | 0) != ($v$4$lcssa$i | 0)) _abort();
     $364 = $356 + 8 | 0;
     if ((HEAP32[$364 >> 2] | 0) == ($v$4$lcssa$i | 0)) {
      HEAP32[$361 >> 2] = $356;
      HEAP32[$364 >> 2] = $359;
      $R$3$i11 = $356;
      break;
     } else _abort();
    } while (0);
    do if ($354 | 0) {
     $382 = HEAP32[$v$4$lcssa$i + 28 >> 2] | 0;
     $383 = 91664 + ($382 << 2) | 0;
     if (($v$4$lcssa$i | 0) == (HEAP32[$383 >> 2] | 0)) {
      HEAP32[$383 >> 2] = $R$3$i11;
      if (!$R$3$i11) {
       HEAP32[22841] = HEAP32[22841] & ~(1 << $382);
       break;
      }
     } else {
      if ($354 >>> 0 < (HEAP32[22844] | 0) >>> 0) _abort();
      $392 = $354 + 16 | 0;
      if ((HEAP32[$392 >> 2] | 0) == ($v$4$lcssa$i | 0)) HEAP32[$392 >> 2] = $R$3$i11; else HEAP32[$354 + 20 >> 2] = $R$3$i11;
      if (!$R$3$i11) break;
     }
     $397 = HEAP32[22844] | 0;
     if ($R$3$i11 >>> 0 < $397 >>> 0) _abort();
     HEAP32[$R$3$i11 + 24 >> 2] = $354;
     $401 = HEAP32[$v$4$lcssa$i + 16 >> 2] | 0;
     do if ($401 | 0) if ($401 >>> 0 < $397 >>> 0) _abort(); else {
      HEAP32[$R$3$i11 + 16 >> 2] = $401;
      HEAP32[$401 + 24 >> 2] = $R$3$i11;
      break;
     } while (0);
     $407 = HEAP32[$v$4$lcssa$i + 20 >> 2] | 0;
     if ($407 | 0) if ($407 >>> 0 < (HEAP32[22844] | 0) >>> 0) _abort(); else {
      HEAP32[$R$3$i11 + 20 >> 2] = $407;
      HEAP32[$407 + 24 >> 2] = $R$3$i11;
      break;
     }
    } while (0);
    do if ($rsize$4$lcssa$i >>> 0 < 16) {
     $414 = $rsize$4$lcssa$i + $248 | 0;
     HEAP32[$v$4$lcssa$i + 4 >> 2] = $414 | 3;
     $418 = $v$4$lcssa$i + $414 + 4 | 0;
     HEAP32[$418 >> 2] = HEAP32[$418 >> 2] | 1;
    } else {
     HEAP32[$v$4$lcssa$i + 4 >> 2] = $248 | 3;
     HEAP32[$351 + 4 >> 2] = $rsize$4$lcssa$i | 1;
     HEAP32[$351 + $rsize$4$lcssa$i >> 2] = $rsize$4$lcssa$i;
     $426 = $rsize$4$lcssa$i >>> 3;
     if ($rsize$4$lcssa$i >>> 0 < 256) {
      $429 = 91400 + ($426 << 1 << 2) | 0;
      $430 = HEAP32[22840] | 0;
      $431 = 1 << $426;
      if (!($430 & $431)) {
       HEAP32[22840] = $430 | $431;
       $$pre$phi$i14Z2D = $429 + 8 | 0;
       $F5$0$i = $429;
      } else {
       $435 = $429 + 8 | 0;
       $436 = HEAP32[$435 >> 2] | 0;
       if ($436 >>> 0 < (HEAP32[22844] | 0) >>> 0) _abort(); else {
        $$pre$phi$i14Z2D = $435;
        $F5$0$i = $436;
       }
      }
      HEAP32[$$pre$phi$i14Z2D >> 2] = $351;
      HEAP32[$F5$0$i + 12 >> 2] = $351;
      HEAP32[$351 + 8 >> 2] = $F5$0$i;
      HEAP32[$351 + 12 >> 2] = $429;
      break;
     }
     $442 = $rsize$4$lcssa$i >>> 8;
     if (!$442) $I7$0$i = 0; else if ($rsize$4$lcssa$i >>> 0 > 16777215) $I7$0$i = 31; else {
      $447 = ($442 + 1048320 | 0) >>> 16 & 8;
      $448 = $442 << $447;
      $451 = ($448 + 520192 | 0) >>> 16 & 4;
      $453 = $448 << $451;
      $456 = ($453 + 245760 | 0) >>> 16 & 2;
      $461 = 14 - ($451 | $447 | $456) + ($453 << $456 >>> 15) | 0;
      $I7$0$i = $rsize$4$lcssa$i >>> ($461 + 7 | 0) & 1 | $461 << 1;
     }
     $467 = 91664 + ($I7$0$i << 2) | 0;
     HEAP32[$351 + 28 >> 2] = $I7$0$i;
     $469 = $351 + 16 | 0;
     HEAP32[$469 + 4 >> 2] = 0;
     HEAP32[$469 >> 2] = 0;
     $471 = HEAP32[22841] | 0;
     $472 = 1 << $I7$0$i;
     if (!($471 & $472)) {
      HEAP32[22841] = $471 | $472;
      HEAP32[$467 >> 2] = $351;
      HEAP32[$351 + 24 >> 2] = $467;
      HEAP32[$351 + 12 >> 2] = $351;
      HEAP32[$351 + 8 >> 2] = $351;
      break;
     }
     $K12$0$i = $rsize$4$lcssa$i << (($I7$0$i | 0) == 31 ? 0 : 25 - ($I7$0$i >>> 1) | 0);
     $T$0$i = HEAP32[$467 >> 2] | 0;
     while (1) {
      if ((HEAP32[$T$0$i + 4 >> 2] & -8 | 0) == ($rsize$4$lcssa$i | 0)) {
       $T$0$i$lcssa = $T$0$i;
       label = 148;
       break;
      }
      $490 = $T$0$i + 16 + ($K12$0$i >>> 31 << 2) | 0;
      $492 = HEAP32[$490 >> 2] | 0;
      if (!$492) {
       $$lcssa157 = $490;
       $T$0$i$lcssa156 = $T$0$i;
       label = 145;
       break;
      } else {
       $K12$0$i = $K12$0$i << 1;
       $T$0$i = $492;
      }
     }
     if ((label | 0) == 145) if ($$lcssa157 >>> 0 < (HEAP32[22844] | 0) >>> 0) _abort(); else {
      HEAP32[$$lcssa157 >> 2] = $351;
      HEAP32[$351 + 24 >> 2] = $T$0$i$lcssa156;
      HEAP32[$351 + 12 >> 2] = $351;
      HEAP32[$351 + 8 >> 2] = $351;
      break;
     } else if ((label | 0) == 148) {
      $499 = $T$0$i$lcssa + 8 | 0;
      $500 = HEAP32[$499 >> 2] | 0;
      $501 = HEAP32[22844] | 0;
      if ($500 >>> 0 >= $501 >>> 0 & $T$0$i$lcssa >>> 0 >= $501 >>> 0) {
       HEAP32[$500 + 12 >> 2] = $351;
       HEAP32[$499 >> 2] = $351;
       HEAP32[$351 + 8 >> 2] = $500;
       HEAP32[$351 + 12 >> 2] = $T$0$i$lcssa;
       HEAP32[$351 + 24 >> 2] = 0;
       break;
      } else _abort();
     }
    } while (0);
    $$0 = $v$4$lcssa$i + 8 | 0;
    STACKTOP = sp;
    return $$0 | 0;
   } else $nb$0 = $248;
  }
 } while (0);
 $509 = HEAP32[22842] | 0;
 if ($509 >>> 0 >= $nb$0 >>> 0) {
  $511 = $509 - $nb$0 | 0;
  $512 = HEAP32[22845] | 0;
  if ($511 >>> 0 > 15) {
   $514 = $512 + $nb$0 | 0;
   HEAP32[22845] = $514;
   HEAP32[22842] = $511;
   HEAP32[$514 + 4 >> 2] = $511 | 1;
   HEAP32[$514 + $511 >> 2] = $511;
   HEAP32[$512 + 4 >> 2] = $nb$0 | 3;
  } else {
   HEAP32[22842] = 0;
   HEAP32[22845] = 0;
   HEAP32[$512 + 4 >> 2] = $509 | 3;
   $523 = $512 + $509 + 4 | 0;
   HEAP32[$523 >> 2] = HEAP32[$523 >> 2] | 1;
  }
  $$0 = $512 + 8 | 0;
  STACKTOP = sp;
  return $$0 | 0;
 }
 $527 = HEAP32[22843] | 0;
 if ($527 >>> 0 > $nb$0 >>> 0) {
  $529 = $527 - $nb$0 | 0;
  HEAP32[22843] = $529;
  $530 = HEAP32[22846] | 0;
  $531 = $530 + $nb$0 | 0;
  HEAP32[22846] = $531;
  HEAP32[$531 + 4 >> 2] = $529 | 1;
  HEAP32[$530 + 4 >> 2] = $nb$0 | 3;
  $$0 = $530 + 8 | 0;
  STACKTOP = sp;
  return $$0 | 0;
 }
 if (!(HEAP32[22958] | 0)) {
  HEAP32[22960] = 4096;
  HEAP32[22959] = 4096;
  HEAP32[22961] = -1;
  HEAP32[22962] = -1;
  HEAP32[22963] = 0;
  HEAP32[22951] = 0;
  $541 = $magic$i$i & -16 ^ 1431655768;
  HEAP32[$magic$i$i >> 2] = $541;
  HEAP32[22958] = $541;
 }
 $542 = $nb$0 + 48 | 0;
 $543 = HEAP32[22960] | 0;
 $544 = $nb$0 + 47 | 0;
 $545 = $543 + $544 | 0;
 $546 = 0 - $543 | 0;
 $547 = $545 & $546;
 if ($547 >>> 0 <= $nb$0 >>> 0) {
  $$0 = 0;
  STACKTOP = sp;
  return $$0 | 0;
 }
 $549 = HEAP32[22950] | 0;
 if ($549 | 0) {
  $551 = HEAP32[22948] | 0;
  $552 = $551 + $547 | 0;
  if ($552 >>> 0 <= $551 >>> 0 | $552 >>> 0 > $549 >>> 0) {
   $$0 = 0;
   STACKTOP = sp;
   return $$0 | 0;
  }
 }
 L254 : do if (!(HEAP32[22951] & 4)) {
  $558 = HEAP32[22846] | 0;
  L256 : do if (!$558) label = 171; else {
   $sp$0$i$i = 91808;
   while (1) {
    $560 = HEAP32[$sp$0$i$i >> 2] | 0;
    if ($560 >>> 0 <= $558 >>> 0) {
     $562 = $sp$0$i$i + 4 | 0;
     if (($560 + (HEAP32[$562 >> 2] | 0) | 0) >>> 0 > $558 >>> 0) {
      $$lcssa153 = $sp$0$i$i;
      $$lcssa155 = $562;
      break;
     }
    }
    $sp$0$i$i = HEAP32[$sp$0$i$i + 8 >> 2] | 0;
    if (!$sp$0$i$i) {
     label = 171;
     break L256;
    }
   }
   $593 = $545 - (HEAP32[22843] | 0) & $546;
   if ($593 >>> 0 < 2147483647) {
    $595 = _sbrk($593 | 0) | 0;
    if (($595 | 0) == ((HEAP32[$$lcssa153 >> 2] | 0) + (HEAP32[$$lcssa155 >> 2] | 0) | 0)) {
     if (($595 | 0) != (-1 | 0)) {
      $tbase$746$i = $595;
      $tsize$745$i = $593;
      label = 191;
      break L254;
     }
    } else {
     $br$2$ph$i = $595;
     $ssize$2$ph$i = $593;
     label = 181;
    }
   }
  } while (0);
  do if ((label | 0) == 171) {
   $569 = _sbrk(0) | 0;
   if (($569 | 0) != (-1 | 0)) {
    $571 = $569;
    $572 = HEAP32[22959] | 0;
    $573 = $572 + -1 | 0;
    if (!($573 & $571)) $ssize$0$i = $547; else $ssize$0$i = $547 - $571 + ($573 + $571 & 0 - $572) | 0;
    $581 = HEAP32[22948] | 0;
    $582 = $581 + $ssize$0$i | 0;
    if ($ssize$0$i >>> 0 > $nb$0 >>> 0 & $ssize$0$i >>> 0 < 2147483647) {
     $585 = HEAP32[22950] | 0;
     if ($585 | 0) if ($582 >>> 0 <= $581 >>> 0 | $582 >>> 0 > $585 >>> 0) break;
     $589 = _sbrk($ssize$0$i | 0) | 0;
     if (($589 | 0) == ($569 | 0)) {
      $tbase$746$i = $569;
      $tsize$745$i = $ssize$0$i;
      label = 191;
      break L254;
     } else {
      $br$2$ph$i = $589;
      $ssize$2$ph$i = $ssize$0$i;
      label = 181;
     }
    }
   }
  } while (0);
  L276 : do if ((label | 0) == 181) {
   $601 = 0 - $ssize$2$ph$i | 0;
   do if ($542 >>> 0 > $ssize$2$ph$i >>> 0 & ($ssize$2$ph$i >>> 0 < 2147483647 & ($br$2$ph$i | 0) != (-1 | 0))) {
    $605 = HEAP32[22960] | 0;
    $609 = $544 - $ssize$2$ph$i + $605 & 0 - $605;
    if ($609 >>> 0 < 2147483647) if ((_sbrk($609 | 0) | 0) == (-1 | 0)) {
     _sbrk($601 | 0) | 0;
     break L276;
    } else {
     $ssize$5$i = $609 + $ssize$2$ph$i | 0;
     break;
    } else $ssize$5$i = $ssize$2$ph$i;
   } else $ssize$5$i = $ssize$2$ph$i; while (0);
   if (($br$2$ph$i | 0) != (-1 | 0)) {
    $tbase$746$i = $br$2$ph$i;
    $tsize$745$i = $ssize$5$i;
    label = 191;
    break L254;
   }
  } while (0);
  HEAP32[22951] = HEAP32[22951] | 4;
  label = 188;
 } else label = 188; while (0);
 if ((label | 0) == 188) if ($547 >>> 0 < 2147483647) {
  $618 = _sbrk($547 | 0) | 0;
  $619 = _sbrk(0) | 0;
  if ($618 >>> 0 < $619 >>> 0 & (($618 | 0) != (-1 | 0) & ($619 | 0) != (-1 | 0))) {
   $625 = $619 - $618 | 0;
   if ($625 >>> 0 > ($nb$0 + 40 | 0) >>> 0) {
    $tbase$746$i = $618;
    $tsize$745$i = $625;
    label = 191;
   }
  }
 }
 if ((label | 0) == 191) {
  $628 = (HEAP32[22948] | 0) + $tsize$745$i | 0;
  HEAP32[22948] = $628;
  if ($628 >>> 0 > (HEAP32[22949] | 0) >>> 0) HEAP32[22949] = $628;
  $631 = HEAP32[22846] | 0;
  do if (!$631) {
   $633 = HEAP32[22844] | 0;
   if (($633 | 0) == 0 | $tbase$746$i >>> 0 < $633 >>> 0) HEAP32[22844] = $tbase$746$i;
   HEAP32[22952] = $tbase$746$i;
   HEAP32[22953] = $tsize$745$i;
   HEAP32[22955] = 0;
   HEAP32[22849] = HEAP32[22958];
   HEAP32[22848] = -1;
   $i$01$i$i = 0;
   do {
    $638 = 91400 + ($i$01$i$i << 1 << 2) | 0;
    HEAP32[$638 + 12 >> 2] = $638;
    HEAP32[$638 + 8 >> 2] = $638;
    $i$01$i$i = $i$01$i$i + 1 | 0;
   } while (($i$01$i$i | 0) != 32);
   $644 = $tbase$746$i + 8 | 0;
   $649 = ($644 & 7 | 0) == 0 ? 0 : 0 - $644 & 7;
   $650 = $tbase$746$i + $649 | 0;
   $651 = $tsize$745$i + -40 - $649 | 0;
   HEAP32[22846] = $650;
   HEAP32[22843] = $651;
   HEAP32[$650 + 4 >> 2] = $651 | 1;
   HEAP32[$650 + $651 + 4 >> 2] = 40;
   HEAP32[22847] = HEAP32[22962];
  } else {
   $sp$068$i = 91808;
   do {
    $657 = HEAP32[$sp$068$i >> 2] | 0;
    $658 = $sp$068$i + 4 | 0;
    $659 = HEAP32[$658 >> 2] | 0;
    if (($tbase$746$i | 0) == ($657 + $659 | 0)) {
     $$lcssa147 = $657;
     $$lcssa149 = $658;
     $$lcssa151 = $659;
     $sp$068$i$lcssa = $sp$068$i;
     label = 201;
     break;
    }
    $sp$068$i = HEAP32[$sp$068$i + 8 >> 2] | 0;
   } while (($sp$068$i | 0) != 0);
   if ((label | 0) == 201) if (!(HEAP32[$sp$068$i$lcssa + 12 >> 2] & 8)) if ($631 >>> 0 < $tbase$746$i >>> 0 & $631 >>> 0 >= $$lcssa147 >>> 0) {
    HEAP32[$$lcssa149 >> 2] = $$lcssa151 + $tsize$745$i;
    $674 = $631 + 8 | 0;
    $679 = ($674 & 7 | 0) == 0 ? 0 : 0 - $674 & 7;
    $680 = $631 + $679 | 0;
    $682 = $tsize$745$i - $679 + (HEAP32[22843] | 0) | 0;
    HEAP32[22846] = $680;
    HEAP32[22843] = $682;
    HEAP32[$680 + 4 >> 2] = $682 | 1;
    HEAP32[$680 + $682 + 4 >> 2] = 40;
    HEAP32[22847] = HEAP32[22962];
    break;
   }
   $688 = HEAP32[22844] | 0;
   if ($tbase$746$i >>> 0 < $688 >>> 0) {
    HEAP32[22844] = $tbase$746$i;
    $753 = $tbase$746$i;
   } else $753 = $688;
   $690 = $tbase$746$i + $tsize$745$i | 0;
   $sp$167$i = 91808;
   while (1) {
    if ((HEAP32[$sp$167$i >> 2] | 0) == ($690 | 0)) {
     $$lcssa144 = $sp$167$i;
     $sp$167$i$lcssa = $sp$167$i;
     label = 209;
     break;
    }
    $sp$167$i = HEAP32[$sp$167$i + 8 >> 2] | 0;
    if (!$sp$167$i) {
     $sp$0$i$i$i = 91808;
     break;
    }
   }
   if ((label | 0) == 209) if (!(HEAP32[$sp$167$i$lcssa + 12 >> 2] & 8)) {
    HEAP32[$$lcssa144 >> 2] = $tbase$746$i;
    $700 = $sp$167$i$lcssa + 4 | 0;
    HEAP32[$700 >> 2] = (HEAP32[$700 >> 2] | 0) + $tsize$745$i;
    $704 = $tbase$746$i + 8 | 0;
    $710 = $tbase$746$i + (($704 & 7 | 0) == 0 ? 0 : 0 - $704 & 7) | 0;
    $712 = $690 + 8 | 0;
    $718 = $690 + (($712 & 7 | 0) == 0 ? 0 : 0 - $712 & 7) | 0;
    $722 = $710 + $nb$0 | 0;
    $723 = $718 - $710 - $nb$0 | 0;
    HEAP32[$710 + 4 >> 2] = $nb$0 | 3;
    do if (($718 | 0) == ($631 | 0)) {
     $728 = (HEAP32[22843] | 0) + $723 | 0;
     HEAP32[22843] = $728;
     HEAP32[22846] = $722;
     HEAP32[$722 + 4 >> 2] = $728 | 1;
    } else {
     if (($718 | 0) == (HEAP32[22845] | 0)) {
      $734 = (HEAP32[22842] | 0) + $723 | 0;
      HEAP32[22842] = $734;
      HEAP32[22845] = $722;
      HEAP32[$722 + 4 >> 2] = $734 | 1;
      HEAP32[$722 + $734 >> 2] = $734;
      break;
     }
     $739 = HEAP32[$718 + 4 >> 2] | 0;
     if (($739 & 3 | 0) == 1) {
      $742 = $739 & -8;
      $743 = $739 >>> 3;
      L328 : do if ($739 >>> 0 < 256) {
       $746 = HEAP32[$718 + 8 >> 2] | 0;
       $748 = HEAP32[$718 + 12 >> 2] | 0;
       $750 = 91400 + ($743 << 1 << 2) | 0;
       do if (($746 | 0) != ($750 | 0)) {
        if ($746 >>> 0 < $753 >>> 0) _abort();
        if ((HEAP32[$746 + 12 >> 2] | 0) == ($718 | 0)) break;
        _abort();
       } while (0);
       if (($748 | 0) == ($746 | 0)) {
        HEAP32[22840] = HEAP32[22840] & ~(1 << $743);
        break;
       }
       do if (($748 | 0) == ($750 | 0)) $$pre$phi10$i$iZ2D = $748 + 8 | 0; else {
        if ($748 >>> 0 < $753 >>> 0) _abort();
        $764 = $748 + 8 | 0;
        if ((HEAP32[$764 >> 2] | 0) == ($718 | 0)) {
         $$pre$phi10$i$iZ2D = $764;
         break;
        }
        _abort();
       } while (0);
       HEAP32[$746 + 12 >> 2] = $748;
       HEAP32[$$pre$phi10$i$iZ2D >> 2] = $746;
      } else {
       $769 = HEAP32[$718 + 24 >> 2] | 0;
       $771 = HEAP32[$718 + 12 >> 2] | 0;
       do if (($771 | 0) == ($718 | 0)) {
        $782 = $718 + 16 | 0;
        $783 = $782 + 4 | 0;
        $784 = HEAP32[$783 >> 2] | 0;
        if (!$784) {
         $786 = HEAP32[$782 >> 2] | 0;
         if (!$786) {
          $R$3$i$i = 0;
          break;
         } else {
          $R$1$i$i = $786;
          $RP$1$i$i = $782;
         }
        } else {
         $R$1$i$i = $784;
         $RP$1$i$i = $783;
        }
        while (1) {
         $788 = $R$1$i$i + 20 | 0;
         $789 = HEAP32[$788 >> 2] | 0;
         if ($789 | 0) {
          $R$1$i$i = $789;
          $RP$1$i$i = $788;
          continue;
         }
         $791 = $R$1$i$i + 16 | 0;
         $792 = HEAP32[$791 >> 2] | 0;
         if (!$792) {
          $R$1$i$i$lcssa = $R$1$i$i;
          $RP$1$i$i$lcssa = $RP$1$i$i;
          break;
         } else {
          $R$1$i$i = $792;
          $RP$1$i$i = $791;
         }
        }
        if ($RP$1$i$i$lcssa >>> 0 < $753 >>> 0) _abort(); else {
         HEAP32[$RP$1$i$i$lcssa >> 2] = 0;
         $R$3$i$i = $R$1$i$i$lcssa;
         break;
        }
       } else {
        $774 = HEAP32[$718 + 8 >> 2] | 0;
        if ($774 >>> 0 < $753 >>> 0) _abort();
        $776 = $774 + 12 | 0;
        if ((HEAP32[$776 >> 2] | 0) != ($718 | 0)) _abort();
        $779 = $771 + 8 | 0;
        if ((HEAP32[$779 >> 2] | 0) == ($718 | 0)) {
         HEAP32[$776 >> 2] = $771;
         HEAP32[$779 >> 2] = $774;
         $R$3$i$i = $771;
         break;
        } else _abort();
       } while (0);
       if (!$769) break;
       $797 = HEAP32[$718 + 28 >> 2] | 0;
       $798 = 91664 + ($797 << 2) | 0;
       do if (($718 | 0) == (HEAP32[$798 >> 2] | 0)) {
        HEAP32[$798 >> 2] = $R$3$i$i;
        if ($R$3$i$i | 0) break;
        HEAP32[22841] = HEAP32[22841] & ~(1 << $797);
        break L328;
       } else {
        if ($769 >>> 0 < (HEAP32[22844] | 0) >>> 0) _abort();
        $807 = $769 + 16 | 0;
        if ((HEAP32[$807 >> 2] | 0) == ($718 | 0)) HEAP32[$807 >> 2] = $R$3$i$i; else HEAP32[$769 + 20 >> 2] = $R$3$i$i;
        if (!$R$3$i$i) break L328;
       } while (0);
       $812 = HEAP32[22844] | 0;
       if ($R$3$i$i >>> 0 < $812 >>> 0) _abort();
       HEAP32[$R$3$i$i + 24 >> 2] = $769;
       $815 = $718 + 16 | 0;
       $816 = HEAP32[$815 >> 2] | 0;
       do if ($816 | 0) if ($816 >>> 0 < $812 >>> 0) _abort(); else {
        HEAP32[$R$3$i$i + 16 >> 2] = $816;
        HEAP32[$816 + 24 >> 2] = $R$3$i$i;
        break;
       } while (0);
       $822 = HEAP32[$815 + 4 >> 2] | 0;
       if (!$822) break;
       if ($822 >>> 0 < (HEAP32[22844] | 0) >>> 0) _abort(); else {
        HEAP32[$R$3$i$i + 20 >> 2] = $822;
        HEAP32[$822 + 24 >> 2] = $R$3$i$i;
        break;
       }
      } while (0);
      $oldfirst$0$i$i = $718 + $742 | 0;
      $qsize$0$i$i = $742 + $723 | 0;
     } else {
      $oldfirst$0$i$i = $718;
      $qsize$0$i$i = $723;
     }
     $830 = $oldfirst$0$i$i + 4 | 0;
     HEAP32[$830 >> 2] = HEAP32[$830 >> 2] & -2;
     HEAP32[$722 + 4 >> 2] = $qsize$0$i$i | 1;
     HEAP32[$722 + $qsize$0$i$i >> 2] = $qsize$0$i$i;
     $836 = $qsize$0$i$i >>> 3;
     if ($qsize$0$i$i >>> 0 < 256) {
      $839 = 91400 + ($836 << 1 << 2) | 0;
      $840 = HEAP32[22840] | 0;
      $841 = 1 << $836;
      do if (!($840 & $841)) {
       HEAP32[22840] = $840 | $841;
       $$pre$phi$i17$iZ2D = $839 + 8 | 0;
       $F4$0$i$i = $839;
      } else {
       $845 = $839 + 8 | 0;
       $846 = HEAP32[$845 >> 2] | 0;
       if ($846 >>> 0 >= (HEAP32[22844] | 0) >>> 0) {
        $$pre$phi$i17$iZ2D = $845;
        $F4$0$i$i = $846;
        break;
       }
       _abort();
      } while (0);
      HEAP32[$$pre$phi$i17$iZ2D >> 2] = $722;
      HEAP32[$F4$0$i$i + 12 >> 2] = $722;
      HEAP32[$722 + 8 >> 2] = $F4$0$i$i;
      HEAP32[$722 + 12 >> 2] = $839;
      break;
     }
     $852 = $qsize$0$i$i >>> 8;
     do if (!$852) $I7$0$i$i = 0; else {
      if ($qsize$0$i$i >>> 0 > 16777215) {
       $I7$0$i$i = 31;
       break;
      }
      $857 = ($852 + 1048320 | 0) >>> 16 & 8;
      $858 = $852 << $857;
      $861 = ($858 + 520192 | 0) >>> 16 & 4;
      $863 = $858 << $861;
      $866 = ($863 + 245760 | 0) >>> 16 & 2;
      $871 = 14 - ($861 | $857 | $866) + ($863 << $866 >>> 15) | 0;
      $I7$0$i$i = $qsize$0$i$i >>> ($871 + 7 | 0) & 1 | $871 << 1;
     } while (0);
     $877 = 91664 + ($I7$0$i$i << 2) | 0;
     HEAP32[$722 + 28 >> 2] = $I7$0$i$i;
     $879 = $722 + 16 | 0;
     HEAP32[$879 + 4 >> 2] = 0;
     HEAP32[$879 >> 2] = 0;
     $881 = HEAP32[22841] | 0;
     $882 = 1 << $I7$0$i$i;
     if (!($881 & $882)) {
      HEAP32[22841] = $881 | $882;
      HEAP32[$877 >> 2] = $722;
      HEAP32[$722 + 24 >> 2] = $877;
      HEAP32[$722 + 12 >> 2] = $722;
      HEAP32[$722 + 8 >> 2] = $722;
      break;
     }
     $K8$0$i$i = $qsize$0$i$i << (($I7$0$i$i | 0) == 31 ? 0 : 25 - ($I7$0$i$i >>> 1) | 0);
     $T$0$i18$i = HEAP32[$877 >> 2] | 0;
     while (1) {
      if ((HEAP32[$T$0$i18$i + 4 >> 2] & -8 | 0) == ($qsize$0$i$i | 0)) {
       $T$0$i18$i$lcssa = $T$0$i18$i;
       label = 279;
       break;
      }
      $900 = $T$0$i18$i + 16 + ($K8$0$i$i >>> 31 << 2) | 0;
      $902 = HEAP32[$900 >> 2] | 0;
      if (!$902) {
       $$lcssa = $900;
       $T$0$i18$i$lcssa139 = $T$0$i18$i;
       label = 276;
       break;
      } else {
       $K8$0$i$i = $K8$0$i$i << 1;
       $T$0$i18$i = $902;
      }
     }
     if ((label | 0) == 276) if ($$lcssa >>> 0 < (HEAP32[22844] | 0) >>> 0) _abort(); else {
      HEAP32[$$lcssa >> 2] = $722;
      HEAP32[$722 + 24 >> 2] = $T$0$i18$i$lcssa139;
      HEAP32[$722 + 12 >> 2] = $722;
      HEAP32[$722 + 8 >> 2] = $722;
      break;
     } else if ((label | 0) == 279) {
      $909 = $T$0$i18$i$lcssa + 8 | 0;
      $910 = HEAP32[$909 >> 2] | 0;
      $911 = HEAP32[22844] | 0;
      if ($910 >>> 0 >= $911 >>> 0 & $T$0$i18$i$lcssa >>> 0 >= $911 >>> 0) {
       HEAP32[$910 + 12 >> 2] = $722;
       HEAP32[$909 >> 2] = $722;
       HEAP32[$722 + 8 >> 2] = $910;
       HEAP32[$722 + 12 >> 2] = $T$0$i18$i$lcssa;
       HEAP32[$722 + 24 >> 2] = 0;
       break;
      } else _abort();
     }
    } while (0);
    $$0 = $710 + 8 | 0;
    STACKTOP = sp;
    return $$0 | 0;
   } else $sp$0$i$i$i = 91808;
   while (1) {
    $918 = HEAP32[$sp$0$i$i$i >> 2] | 0;
    if ($918 >>> 0 <= $631 >>> 0) {
     $922 = $918 + (HEAP32[$sp$0$i$i$i + 4 >> 2] | 0) | 0;
     if ($922 >>> 0 > $631 >>> 0) {
      $$lcssa142 = $922;
      break;
     }
    }
    $sp$0$i$i$i = HEAP32[$sp$0$i$i$i + 8 >> 2] | 0;
   }
   $926 = $$lcssa142 + -47 | 0;
   $928 = $926 + 8 | 0;
   $934 = $926 + (($928 & 7 | 0) == 0 ? 0 : 0 - $928 & 7) | 0;
   $935 = $631 + 16 | 0;
   $937 = $934 >>> 0 < $935 >>> 0 ? $631 : $934;
   $938 = $937 + 8 | 0;
   $942 = $tbase$746$i + 8 | 0;
   $947 = ($942 & 7 | 0) == 0 ? 0 : 0 - $942 & 7;
   $948 = $tbase$746$i + $947 | 0;
   $949 = $tsize$745$i + -40 - $947 | 0;
   HEAP32[22846] = $948;
   HEAP32[22843] = $949;
   HEAP32[$948 + 4 >> 2] = $949 | 1;
   HEAP32[$948 + $949 + 4 >> 2] = 40;
   HEAP32[22847] = HEAP32[22962];
   $955 = $937 + 4 | 0;
   HEAP32[$955 >> 2] = 27;
   HEAP32[$938 >> 2] = HEAP32[22952];
   HEAP32[$938 + 4 >> 2] = HEAP32[22953];
   HEAP32[$938 + 8 >> 2] = HEAP32[22954];
   HEAP32[$938 + 12 >> 2] = HEAP32[22955];
   HEAP32[22952] = $tbase$746$i;
   HEAP32[22953] = $tsize$745$i;
   HEAP32[22955] = 0;
   HEAP32[22954] = $938;
   $p$0$i$i = $937 + 24 | 0;
   do {
    $p$0$i$i = $p$0$i$i + 4 | 0;
    HEAP32[$p$0$i$i >> 2] = 7;
   } while (($p$0$i$i + 4 | 0) >>> 0 < $$lcssa142 >>> 0);
   if (($937 | 0) != ($631 | 0)) {
    $962 = $937 - $631 | 0;
    HEAP32[$955 >> 2] = HEAP32[$955 >> 2] & -2;
    HEAP32[$631 + 4 >> 2] = $962 | 1;
    HEAP32[$937 >> 2] = $962;
    $967 = $962 >>> 3;
    if ($962 >>> 0 < 256) {
     $970 = 91400 + ($967 << 1 << 2) | 0;
     $971 = HEAP32[22840] | 0;
     $972 = 1 << $967;
     if (!($971 & $972)) {
      HEAP32[22840] = $971 | $972;
      $$pre$phi$i$iZ2D = $970 + 8 | 0;
      $F$0$i$i = $970;
     } else {
      $976 = $970 + 8 | 0;
      $977 = HEAP32[$976 >> 2] | 0;
      if ($977 >>> 0 < (HEAP32[22844] | 0) >>> 0) _abort(); else {
       $$pre$phi$i$iZ2D = $976;
       $F$0$i$i = $977;
      }
     }
     HEAP32[$$pre$phi$i$iZ2D >> 2] = $631;
     HEAP32[$F$0$i$i + 12 >> 2] = $631;
     HEAP32[$631 + 8 >> 2] = $F$0$i$i;
     HEAP32[$631 + 12 >> 2] = $970;
     break;
    }
    $983 = $962 >>> 8;
    if (!$983) $I1$0$i$i = 0; else if ($962 >>> 0 > 16777215) $I1$0$i$i = 31; else {
     $988 = ($983 + 1048320 | 0) >>> 16 & 8;
     $989 = $983 << $988;
     $992 = ($989 + 520192 | 0) >>> 16 & 4;
     $994 = $989 << $992;
     $997 = ($994 + 245760 | 0) >>> 16 & 2;
     $1002 = 14 - ($992 | $988 | $997) + ($994 << $997 >>> 15) | 0;
     $I1$0$i$i = $962 >>> ($1002 + 7 | 0) & 1 | $1002 << 1;
    }
    $1008 = 91664 + ($I1$0$i$i << 2) | 0;
    HEAP32[$631 + 28 >> 2] = $I1$0$i$i;
    HEAP32[$631 + 20 >> 2] = 0;
    HEAP32[$935 >> 2] = 0;
    $1011 = HEAP32[22841] | 0;
    $1012 = 1 << $I1$0$i$i;
    if (!($1011 & $1012)) {
     HEAP32[22841] = $1011 | $1012;
     HEAP32[$1008 >> 2] = $631;
     HEAP32[$631 + 24 >> 2] = $1008;
     HEAP32[$631 + 12 >> 2] = $631;
     HEAP32[$631 + 8 >> 2] = $631;
     break;
    }
    $K2$0$i$i = $962 << (($I1$0$i$i | 0) == 31 ? 0 : 25 - ($I1$0$i$i >>> 1) | 0);
    $T$0$i$i = HEAP32[$1008 >> 2] | 0;
    while (1) {
     if ((HEAP32[$T$0$i$i + 4 >> 2] & -8 | 0) == ($962 | 0)) {
      $T$0$i$i$lcssa = $T$0$i$i;
      label = 305;
      break;
     }
     $1030 = $T$0$i$i + 16 + ($K2$0$i$i >>> 31 << 2) | 0;
     $1032 = HEAP32[$1030 >> 2] | 0;
     if (!$1032) {
      $$lcssa141 = $1030;
      $T$0$i$i$lcssa140 = $T$0$i$i;
      label = 302;
      break;
     } else {
      $K2$0$i$i = $K2$0$i$i << 1;
      $T$0$i$i = $1032;
     }
    }
    if ((label | 0) == 302) if ($$lcssa141 >>> 0 < (HEAP32[22844] | 0) >>> 0) _abort(); else {
     HEAP32[$$lcssa141 >> 2] = $631;
     HEAP32[$631 + 24 >> 2] = $T$0$i$i$lcssa140;
     HEAP32[$631 + 12 >> 2] = $631;
     HEAP32[$631 + 8 >> 2] = $631;
     break;
    } else if ((label | 0) == 305) {
     $1039 = $T$0$i$i$lcssa + 8 | 0;
     $1040 = HEAP32[$1039 >> 2] | 0;
     $1041 = HEAP32[22844] | 0;
     if ($1040 >>> 0 >= $1041 >>> 0 & $T$0$i$i$lcssa >>> 0 >= $1041 >>> 0) {
      HEAP32[$1040 + 12 >> 2] = $631;
      HEAP32[$1039 >> 2] = $631;
      HEAP32[$631 + 8 >> 2] = $1040;
      HEAP32[$631 + 12 >> 2] = $T$0$i$i$lcssa;
      HEAP32[$631 + 24 >> 2] = 0;
      break;
     } else _abort();
    }
   }
  } while (0);
  $1049 = HEAP32[22843] | 0;
  if ($1049 >>> 0 > $nb$0 >>> 0) {
   $1051 = $1049 - $nb$0 | 0;
   HEAP32[22843] = $1051;
   $1052 = HEAP32[22846] | 0;
   $1053 = $1052 + $nb$0 | 0;
   HEAP32[22846] = $1053;
   HEAP32[$1053 + 4 >> 2] = $1051 | 1;
   HEAP32[$1052 + 4 >> 2] = $nb$0 | 3;
   $$0 = $1052 + 8 | 0;
   STACKTOP = sp;
   return $$0 | 0;
  }
 }
 HEAP32[(___errno_location() | 0) >> 2] = 12;
 $$0 = 0;
 STACKTOP = sp;
 return $$0 | 0;
}

function _free($mem) {
 $mem = $mem | 0;
 var $$lcssa = 0, $$pre$phi41Z2D = 0, $$pre$phi43Z2D = 0, $$pre$phiZ2D = 0, $1 = 0, $104 = 0, $105 = 0, $113 = 0, $114 = 0, $12 = 0, $122 = 0, $130 = 0, $135 = 0, $136 = 0, $139 = 0, $141 = 0, $143 = 0, $15 = 0, $158 = 0, $16 = 0, $163 = 0, $165 = 0, $168 = 0, $171 = 0, $174 = 0, $177 = 0, $178 = 0, $179 = 0, $181 = 0, $183 = 0, $184 = 0, $186 = 0, $187 = 0, $193 = 0, $194 = 0, $2 = 0, $20 = 0, $203 = 0, $208 = 0, $211 = 0, $212 = 0, $218 = 0, $23 = 0, $233 = 0, $236 = 0, $237 = 0, $238 = 0, $242 = 0, $243 = 0, $249 = 0, $25 = 0, $254 = 0, $255 = 0, $258 = 0, $260 = 0, $263 = 0, $268 = 0, $27 = 0, $274 = 0, $278 = 0, $279 = 0, $297 = 0, $299 = 0, $306 = 0, $307 = 0, $308 = 0, $316 = 0, $40 = 0, $45 = 0, $47 = 0, $5 = 0, $50 = 0, $52 = 0, $55 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $62 = 0, $64 = 0, $65 = 0, $67 = 0, $68 = 0, $73 = 0, $74 = 0, $8 = 0, $83 = 0, $88 = 0, $9 = 0, $91 = 0, $92 = 0, $98 = 0, $F18$0 = 0, $I20$0 = 0, $K21$0 = 0, $R$1 = 0, $R$1$lcssa = 0, $R$3 = 0, $R8$1 = 0, $R8$1$lcssa = 0, $R8$3 = 0, $RP$1 = 0, $RP$1$lcssa = 0, $RP10$1 = 0, $RP10$1$lcssa = 0, $T$0 = 0, $T$0$lcssa = 0, $T$0$lcssa48 = 0, $p$1 = 0, $psize$1 = 0, $psize$2 = 0, $sp$0$i = 0, $sp$0$in$i = 0, label = 0;
 label = 0;
 if (!$mem) return;
 $1 = $mem + -8 | 0;
 $2 = HEAP32[22844] | 0;
 if ($1 >>> 0 < $2 >>> 0) _abort();
 $5 = HEAP32[$mem + -4 >> 2] | 0;
 $6 = $5 & 3;
 if (($6 | 0) == 1) _abort();
 $8 = $5 & -8;
 $9 = $1 + $8 | 0;
 do if (!($5 & 1)) {
  $12 = HEAP32[$1 >> 2] | 0;
  if (!$6) return;
  $15 = $1 + (0 - $12) | 0;
  $16 = $12 + $8 | 0;
  if ($15 >>> 0 < $2 >>> 0) _abort();
  if (($15 | 0) == (HEAP32[22845] | 0)) {
   $104 = $9 + 4 | 0;
   $105 = HEAP32[$104 >> 2] | 0;
   if (($105 & 3 | 0) != 3) {
    $p$1 = $15;
    $psize$1 = $16;
    break;
   }
   HEAP32[22842] = $16;
   HEAP32[$104 >> 2] = $105 & -2;
   HEAP32[$15 + 4 >> 2] = $16 | 1;
   HEAP32[$15 + $16 >> 2] = $16;
   return;
  }
  $20 = $12 >>> 3;
  if ($12 >>> 0 < 256) {
   $23 = HEAP32[$15 + 8 >> 2] | 0;
   $25 = HEAP32[$15 + 12 >> 2] | 0;
   $27 = 91400 + ($20 << 1 << 2) | 0;
   if (($23 | 0) != ($27 | 0)) {
    if ($23 >>> 0 < $2 >>> 0) _abort();
    if ((HEAP32[$23 + 12 >> 2] | 0) != ($15 | 0)) _abort();
   }
   if (($25 | 0) == ($23 | 0)) {
    HEAP32[22840] = HEAP32[22840] & ~(1 << $20);
    $p$1 = $15;
    $psize$1 = $16;
    break;
   }
   if (($25 | 0) == ($27 | 0)) $$pre$phi43Z2D = $25 + 8 | 0; else {
    if ($25 >>> 0 < $2 >>> 0) _abort();
    $40 = $25 + 8 | 0;
    if ((HEAP32[$40 >> 2] | 0) == ($15 | 0)) $$pre$phi43Z2D = $40; else _abort();
   }
   HEAP32[$23 + 12 >> 2] = $25;
   HEAP32[$$pre$phi43Z2D >> 2] = $23;
   $p$1 = $15;
   $psize$1 = $16;
   break;
  }
  $45 = HEAP32[$15 + 24 >> 2] | 0;
  $47 = HEAP32[$15 + 12 >> 2] | 0;
  do if (($47 | 0) == ($15 | 0)) {
   $58 = $15 + 16 | 0;
   $59 = $58 + 4 | 0;
   $60 = HEAP32[$59 >> 2] | 0;
   if (!$60) {
    $62 = HEAP32[$58 >> 2] | 0;
    if (!$62) {
     $R$3 = 0;
     break;
    } else {
     $R$1 = $62;
     $RP$1 = $58;
    }
   } else {
    $R$1 = $60;
    $RP$1 = $59;
   }
   while (1) {
    $64 = $R$1 + 20 | 0;
    $65 = HEAP32[$64 >> 2] | 0;
    if ($65 | 0) {
     $R$1 = $65;
     $RP$1 = $64;
     continue;
    }
    $67 = $R$1 + 16 | 0;
    $68 = HEAP32[$67 >> 2] | 0;
    if (!$68) {
     $R$1$lcssa = $R$1;
     $RP$1$lcssa = $RP$1;
     break;
    } else {
     $R$1 = $68;
     $RP$1 = $67;
    }
   }
   if ($RP$1$lcssa >>> 0 < $2 >>> 0) _abort(); else {
    HEAP32[$RP$1$lcssa >> 2] = 0;
    $R$3 = $R$1$lcssa;
    break;
   }
  } else {
   $50 = HEAP32[$15 + 8 >> 2] | 0;
   if ($50 >>> 0 < $2 >>> 0) _abort();
   $52 = $50 + 12 | 0;
   if ((HEAP32[$52 >> 2] | 0) != ($15 | 0)) _abort();
   $55 = $47 + 8 | 0;
   if ((HEAP32[$55 >> 2] | 0) == ($15 | 0)) {
    HEAP32[$52 >> 2] = $47;
    HEAP32[$55 >> 2] = $50;
    $R$3 = $47;
    break;
   } else _abort();
  } while (0);
  if (!$45) {
   $p$1 = $15;
   $psize$1 = $16;
  } else {
   $73 = HEAP32[$15 + 28 >> 2] | 0;
   $74 = 91664 + ($73 << 2) | 0;
   if (($15 | 0) == (HEAP32[$74 >> 2] | 0)) {
    HEAP32[$74 >> 2] = $R$3;
    if (!$R$3) {
     HEAP32[22841] = HEAP32[22841] & ~(1 << $73);
     $p$1 = $15;
     $psize$1 = $16;
     break;
    }
   } else {
    if ($45 >>> 0 < (HEAP32[22844] | 0) >>> 0) _abort();
    $83 = $45 + 16 | 0;
    if ((HEAP32[$83 >> 2] | 0) == ($15 | 0)) HEAP32[$83 >> 2] = $R$3; else HEAP32[$45 + 20 >> 2] = $R$3;
    if (!$R$3) {
     $p$1 = $15;
     $psize$1 = $16;
     break;
    }
   }
   $88 = HEAP32[22844] | 0;
   if ($R$3 >>> 0 < $88 >>> 0) _abort();
   HEAP32[$R$3 + 24 >> 2] = $45;
   $91 = $15 + 16 | 0;
   $92 = HEAP32[$91 >> 2] | 0;
   do if ($92 | 0) if ($92 >>> 0 < $88 >>> 0) _abort(); else {
    HEAP32[$R$3 + 16 >> 2] = $92;
    HEAP32[$92 + 24 >> 2] = $R$3;
    break;
   } while (0);
   $98 = HEAP32[$91 + 4 >> 2] | 0;
   if (!$98) {
    $p$1 = $15;
    $psize$1 = $16;
   } else if ($98 >>> 0 < (HEAP32[22844] | 0) >>> 0) _abort(); else {
    HEAP32[$R$3 + 20 >> 2] = $98;
    HEAP32[$98 + 24 >> 2] = $R$3;
    $p$1 = $15;
    $psize$1 = $16;
    break;
   }
  }
 } else {
  $p$1 = $1;
  $psize$1 = $8;
 } while (0);
 if ($p$1 >>> 0 >= $9 >>> 0) _abort();
 $113 = $9 + 4 | 0;
 $114 = HEAP32[$113 >> 2] | 0;
 if (!($114 & 1)) _abort();
 if (!($114 & 2)) {
  if (($9 | 0) == (HEAP32[22846] | 0)) {
   $122 = (HEAP32[22843] | 0) + $psize$1 | 0;
   HEAP32[22843] = $122;
   HEAP32[22846] = $p$1;
   HEAP32[$p$1 + 4 >> 2] = $122 | 1;
   if (($p$1 | 0) != (HEAP32[22845] | 0)) return;
   HEAP32[22845] = 0;
   HEAP32[22842] = 0;
   return;
  }
  if (($9 | 0) == (HEAP32[22845] | 0)) {
   $130 = (HEAP32[22842] | 0) + $psize$1 | 0;
   HEAP32[22842] = $130;
   HEAP32[22845] = $p$1;
   HEAP32[$p$1 + 4 >> 2] = $130 | 1;
   HEAP32[$p$1 + $130 >> 2] = $130;
   return;
  }
  $135 = ($114 & -8) + $psize$1 | 0;
  $136 = $114 >>> 3;
  do if ($114 >>> 0 < 256) {
   $139 = HEAP32[$9 + 8 >> 2] | 0;
   $141 = HEAP32[$9 + 12 >> 2] | 0;
   $143 = 91400 + ($136 << 1 << 2) | 0;
   if (($139 | 0) != ($143 | 0)) {
    if ($139 >>> 0 < (HEAP32[22844] | 0) >>> 0) _abort();
    if ((HEAP32[$139 + 12 >> 2] | 0) != ($9 | 0)) _abort();
   }
   if (($141 | 0) == ($139 | 0)) {
    HEAP32[22840] = HEAP32[22840] & ~(1 << $136);
    break;
   }
   if (($141 | 0) == ($143 | 0)) $$pre$phi41Z2D = $141 + 8 | 0; else {
    if ($141 >>> 0 < (HEAP32[22844] | 0) >>> 0) _abort();
    $158 = $141 + 8 | 0;
    if ((HEAP32[$158 >> 2] | 0) == ($9 | 0)) $$pre$phi41Z2D = $158; else _abort();
   }
   HEAP32[$139 + 12 >> 2] = $141;
   HEAP32[$$pre$phi41Z2D >> 2] = $139;
  } else {
   $163 = HEAP32[$9 + 24 >> 2] | 0;
   $165 = HEAP32[$9 + 12 >> 2] | 0;
   do if (($165 | 0) == ($9 | 0)) {
    $177 = $9 + 16 | 0;
    $178 = $177 + 4 | 0;
    $179 = HEAP32[$178 >> 2] | 0;
    if (!$179) {
     $181 = HEAP32[$177 >> 2] | 0;
     if (!$181) {
      $R8$3 = 0;
      break;
     } else {
      $R8$1 = $181;
      $RP10$1 = $177;
     }
    } else {
     $R8$1 = $179;
     $RP10$1 = $178;
    }
    while (1) {
     $183 = $R8$1 + 20 | 0;
     $184 = HEAP32[$183 >> 2] | 0;
     if ($184 | 0) {
      $R8$1 = $184;
      $RP10$1 = $183;
      continue;
     }
     $186 = $R8$1 + 16 | 0;
     $187 = HEAP32[$186 >> 2] | 0;
     if (!$187) {
      $R8$1$lcssa = $R8$1;
      $RP10$1$lcssa = $RP10$1;
      break;
     } else {
      $R8$1 = $187;
      $RP10$1 = $186;
     }
    }
    if ($RP10$1$lcssa >>> 0 < (HEAP32[22844] | 0) >>> 0) _abort(); else {
     HEAP32[$RP10$1$lcssa >> 2] = 0;
     $R8$3 = $R8$1$lcssa;
     break;
    }
   } else {
    $168 = HEAP32[$9 + 8 >> 2] | 0;
    if ($168 >>> 0 < (HEAP32[22844] | 0) >>> 0) _abort();
    $171 = $168 + 12 | 0;
    if ((HEAP32[$171 >> 2] | 0) != ($9 | 0)) _abort();
    $174 = $165 + 8 | 0;
    if ((HEAP32[$174 >> 2] | 0) == ($9 | 0)) {
     HEAP32[$171 >> 2] = $165;
     HEAP32[$174 >> 2] = $168;
     $R8$3 = $165;
     break;
    } else _abort();
   } while (0);
   if ($163 | 0) {
    $193 = HEAP32[$9 + 28 >> 2] | 0;
    $194 = 91664 + ($193 << 2) | 0;
    if (($9 | 0) == (HEAP32[$194 >> 2] | 0)) {
     HEAP32[$194 >> 2] = $R8$3;
     if (!$R8$3) {
      HEAP32[22841] = HEAP32[22841] & ~(1 << $193);
      break;
     }
    } else {
     if ($163 >>> 0 < (HEAP32[22844] | 0) >>> 0) _abort();
     $203 = $163 + 16 | 0;
     if ((HEAP32[$203 >> 2] | 0) == ($9 | 0)) HEAP32[$203 >> 2] = $R8$3; else HEAP32[$163 + 20 >> 2] = $R8$3;
     if (!$R8$3) break;
    }
    $208 = HEAP32[22844] | 0;
    if ($R8$3 >>> 0 < $208 >>> 0) _abort();
    HEAP32[$R8$3 + 24 >> 2] = $163;
    $211 = $9 + 16 | 0;
    $212 = HEAP32[$211 >> 2] | 0;
    do if ($212 | 0) if ($212 >>> 0 < $208 >>> 0) _abort(); else {
     HEAP32[$R8$3 + 16 >> 2] = $212;
     HEAP32[$212 + 24 >> 2] = $R8$3;
     break;
    } while (0);
    $218 = HEAP32[$211 + 4 >> 2] | 0;
    if ($218 | 0) if ($218 >>> 0 < (HEAP32[22844] | 0) >>> 0) _abort(); else {
     HEAP32[$R8$3 + 20 >> 2] = $218;
     HEAP32[$218 + 24 >> 2] = $R8$3;
     break;
    }
   }
  } while (0);
  HEAP32[$p$1 + 4 >> 2] = $135 | 1;
  HEAP32[$p$1 + $135 >> 2] = $135;
  if (($p$1 | 0) == (HEAP32[22845] | 0)) {
   HEAP32[22842] = $135;
   return;
  } else $psize$2 = $135;
 } else {
  HEAP32[$113 >> 2] = $114 & -2;
  HEAP32[$p$1 + 4 >> 2] = $psize$1 | 1;
  HEAP32[$p$1 + $psize$1 >> 2] = $psize$1;
  $psize$2 = $psize$1;
 }
 $233 = $psize$2 >>> 3;
 if ($psize$2 >>> 0 < 256) {
  $236 = 91400 + ($233 << 1 << 2) | 0;
  $237 = HEAP32[22840] | 0;
  $238 = 1 << $233;
  if (!($237 & $238)) {
   HEAP32[22840] = $237 | $238;
   $$pre$phiZ2D = $236 + 8 | 0;
   $F18$0 = $236;
  } else {
   $242 = $236 + 8 | 0;
   $243 = HEAP32[$242 >> 2] | 0;
   if ($243 >>> 0 < (HEAP32[22844] | 0) >>> 0) _abort(); else {
    $$pre$phiZ2D = $242;
    $F18$0 = $243;
   }
  }
  HEAP32[$$pre$phiZ2D >> 2] = $p$1;
  HEAP32[$F18$0 + 12 >> 2] = $p$1;
  HEAP32[$p$1 + 8 >> 2] = $F18$0;
  HEAP32[$p$1 + 12 >> 2] = $236;
  return;
 }
 $249 = $psize$2 >>> 8;
 if (!$249) $I20$0 = 0; else if ($psize$2 >>> 0 > 16777215) $I20$0 = 31; else {
  $254 = ($249 + 1048320 | 0) >>> 16 & 8;
  $255 = $249 << $254;
  $258 = ($255 + 520192 | 0) >>> 16 & 4;
  $260 = $255 << $258;
  $263 = ($260 + 245760 | 0) >>> 16 & 2;
  $268 = 14 - ($258 | $254 | $263) + ($260 << $263 >>> 15) | 0;
  $I20$0 = $psize$2 >>> ($268 + 7 | 0) & 1 | $268 << 1;
 }
 $274 = 91664 + ($I20$0 << 2) | 0;
 HEAP32[$p$1 + 28 >> 2] = $I20$0;
 HEAP32[$p$1 + 20 >> 2] = 0;
 HEAP32[$p$1 + 16 >> 2] = 0;
 $278 = HEAP32[22841] | 0;
 $279 = 1 << $I20$0;
 do if (!($278 & $279)) {
  HEAP32[22841] = $278 | $279;
  HEAP32[$274 >> 2] = $p$1;
  HEAP32[$p$1 + 24 >> 2] = $274;
  HEAP32[$p$1 + 12 >> 2] = $p$1;
  HEAP32[$p$1 + 8 >> 2] = $p$1;
 } else {
  $K21$0 = $psize$2 << (($I20$0 | 0) == 31 ? 0 : 25 - ($I20$0 >>> 1) | 0);
  $T$0 = HEAP32[$274 >> 2] | 0;
  while (1) {
   if ((HEAP32[$T$0 + 4 >> 2] & -8 | 0) == ($psize$2 | 0)) {
    $T$0$lcssa = $T$0;
    label = 130;
    break;
   }
   $297 = $T$0 + 16 + ($K21$0 >>> 31 << 2) | 0;
   $299 = HEAP32[$297 >> 2] | 0;
   if (!$299) {
    $$lcssa = $297;
    $T$0$lcssa48 = $T$0;
    label = 127;
    break;
   } else {
    $K21$0 = $K21$0 << 1;
    $T$0 = $299;
   }
  }
  if ((label | 0) == 127) if ($$lcssa >>> 0 < (HEAP32[22844] | 0) >>> 0) _abort(); else {
   HEAP32[$$lcssa >> 2] = $p$1;
   HEAP32[$p$1 + 24 >> 2] = $T$0$lcssa48;
   HEAP32[$p$1 + 12 >> 2] = $p$1;
   HEAP32[$p$1 + 8 >> 2] = $p$1;
   break;
  } else if ((label | 0) == 130) {
   $306 = $T$0$lcssa + 8 | 0;
   $307 = HEAP32[$306 >> 2] | 0;
   $308 = HEAP32[22844] | 0;
   if ($307 >>> 0 >= $308 >>> 0 & $T$0$lcssa >>> 0 >= $308 >>> 0) {
    HEAP32[$307 + 12 >> 2] = $p$1;
    HEAP32[$306 >> 2] = $p$1;
    HEAP32[$p$1 + 8 >> 2] = $307;
    HEAP32[$p$1 + 12 >> 2] = $T$0$lcssa;
    HEAP32[$p$1 + 24 >> 2] = 0;
    break;
   } else _abort();
  }
 } while (0);
 $316 = (HEAP32[22848] | 0) + -1 | 0;
 HEAP32[22848] = $316;
 if (!$316) $sp$0$in$i = 91816; else return;
 while (1) {
  $sp$0$i = HEAP32[$sp$0$in$i >> 2] | 0;
  if (!$sp$0$i) break; else $sp$0$in$i = $sp$0$i + 8 | 0;
 }
 HEAP32[22848] = -1;
 return;
}

function _dispose_chunk($p, $psize) {
 $p = $p | 0;
 $psize = $psize | 0;
 var $$1 = 0, $$14 = 0, $$2 = 0, $$lcssa = 0, $$pre$phi22Z2D = 0, $$pre$phi24Z2D = 0, $$pre$phiZ2D = 0, $0 = 0, $10 = 0, $100 = 0, $107 = 0, $109 = 0, $11 = 0, $110 = 0, $116 = 0, $124 = 0, $129 = 0, $130 = 0, $133 = 0, $135 = 0, $137 = 0, $15 = 0, $150 = 0, $155 = 0, $157 = 0, $160 = 0, $162 = 0, $165 = 0, $168 = 0, $169 = 0, $170 = 0, $172 = 0, $174 = 0, $175 = 0, $177 = 0, $178 = 0, $18 = 0, $183 = 0, $184 = 0, $193 = 0, $198 = 0, $2 = 0, $20 = 0, $201 = 0, $202 = 0, $208 = 0, $22 = 0, $223 = 0, $226 = 0, $227 = 0, $228 = 0, $232 = 0, $233 = 0, $239 = 0, $244 = 0, $245 = 0, $248 = 0, $250 = 0, $253 = 0, $258 = 0, $264 = 0, $268 = 0, $269 = 0, $287 = 0, $289 = 0, $296 = 0, $297 = 0, $298 = 0, $35 = 0, $40 = 0, $42 = 0, $45 = 0, $47 = 0, $5 = 0, $50 = 0, $53 = 0, $54 = 0, $55 = 0, $57 = 0, $59 = 0, $60 = 0, $62 = 0, $63 = 0, $68 = 0, $69 = 0, $78 = 0, $83 = 0, $86 = 0, $87 = 0, $9 = 0, $93 = 0, $99 = 0, $F17$0 = 0, $I20$0 = 0, $K21$0 = 0, $R$1 = 0, $R$1$lcssa = 0, $R$3 = 0, $R7$1 = 0, $R7$1$lcssa = 0, $R7$3 = 0, $RP$1 = 0, $RP$1$lcssa = 0, $RP9$1 = 0, $RP9$1$lcssa = 0, $T$0 = 0, $T$0$lcssa = 0, $T$0$lcssa30 = 0, label = 0;
 label = 0;
 $0 = $p + $psize | 0;
 $2 = HEAP32[$p + 4 >> 2] | 0;
 do if (!($2 & 1)) {
  $5 = HEAP32[$p >> 2] | 0;
  if (!($2 & 3)) return;
  $9 = $p + (0 - $5) | 0;
  $10 = $5 + $psize | 0;
  $11 = HEAP32[22844] | 0;
  if ($9 >>> 0 < $11 >>> 0) _abort();
  if (($9 | 0) == (HEAP32[22845] | 0)) {
   $99 = $0 + 4 | 0;
   $100 = HEAP32[$99 >> 2] | 0;
   if (($100 & 3 | 0) != 3) {
    $$1 = $9;
    $$14 = $10;
    break;
   }
   HEAP32[22842] = $10;
   HEAP32[$99 >> 2] = $100 & -2;
   HEAP32[$9 + 4 >> 2] = $10 | 1;
   HEAP32[$9 + $10 >> 2] = $10;
   return;
  }
  $15 = $5 >>> 3;
  if ($5 >>> 0 < 256) {
   $18 = HEAP32[$9 + 8 >> 2] | 0;
   $20 = HEAP32[$9 + 12 >> 2] | 0;
   $22 = 91400 + ($15 << 1 << 2) | 0;
   if (($18 | 0) != ($22 | 0)) {
    if ($18 >>> 0 < $11 >>> 0) _abort();
    if ((HEAP32[$18 + 12 >> 2] | 0) != ($9 | 0)) _abort();
   }
   if (($20 | 0) == ($18 | 0)) {
    HEAP32[22840] = HEAP32[22840] & ~(1 << $15);
    $$1 = $9;
    $$14 = $10;
    break;
   }
   if (($20 | 0) == ($22 | 0)) $$pre$phi24Z2D = $20 + 8 | 0; else {
    if ($20 >>> 0 < $11 >>> 0) _abort();
    $35 = $20 + 8 | 0;
    if ((HEAP32[$35 >> 2] | 0) == ($9 | 0)) $$pre$phi24Z2D = $35; else _abort();
   }
   HEAP32[$18 + 12 >> 2] = $20;
   HEAP32[$$pre$phi24Z2D >> 2] = $18;
   $$1 = $9;
   $$14 = $10;
   break;
  }
  $40 = HEAP32[$9 + 24 >> 2] | 0;
  $42 = HEAP32[$9 + 12 >> 2] | 0;
  do if (($42 | 0) == ($9 | 0)) {
   $53 = $9 + 16 | 0;
   $54 = $53 + 4 | 0;
   $55 = HEAP32[$54 >> 2] | 0;
   if (!$55) {
    $57 = HEAP32[$53 >> 2] | 0;
    if (!$57) {
     $R$3 = 0;
     break;
    } else {
     $R$1 = $57;
     $RP$1 = $53;
    }
   } else {
    $R$1 = $55;
    $RP$1 = $54;
   }
   while (1) {
    $59 = $R$1 + 20 | 0;
    $60 = HEAP32[$59 >> 2] | 0;
    if ($60 | 0) {
     $R$1 = $60;
     $RP$1 = $59;
     continue;
    }
    $62 = $R$1 + 16 | 0;
    $63 = HEAP32[$62 >> 2] | 0;
    if (!$63) {
     $R$1$lcssa = $R$1;
     $RP$1$lcssa = $RP$1;
     break;
    } else {
     $R$1 = $63;
     $RP$1 = $62;
    }
   }
   if ($RP$1$lcssa >>> 0 < $11 >>> 0) _abort(); else {
    HEAP32[$RP$1$lcssa >> 2] = 0;
    $R$3 = $R$1$lcssa;
    break;
   }
  } else {
   $45 = HEAP32[$9 + 8 >> 2] | 0;
   if ($45 >>> 0 < $11 >>> 0) _abort();
   $47 = $45 + 12 | 0;
   if ((HEAP32[$47 >> 2] | 0) != ($9 | 0)) _abort();
   $50 = $42 + 8 | 0;
   if ((HEAP32[$50 >> 2] | 0) == ($9 | 0)) {
    HEAP32[$47 >> 2] = $42;
    HEAP32[$50 >> 2] = $45;
    $R$3 = $42;
    break;
   } else _abort();
  } while (0);
  if (!$40) {
   $$1 = $9;
   $$14 = $10;
  } else {
   $68 = HEAP32[$9 + 28 >> 2] | 0;
   $69 = 91664 + ($68 << 2) | 0;
   if (($9 | 0) == (HEAP32[$69 >> 2] | 0)) {
    HEAP32[$69 >> 2] = $R$3;
    if (!$R$3) {
     HEAP32[22841] = HEAP32[22841] & ~(1 << $68);
     $$1 = $9;
     $$14 = $10;
     break;
    }
   } else {
    if ($40 >>> 0 < (HEAP32[22844] | 0) >>> 0) _abort();
    $78 = $40 + 16 | 0;
    if ((HEAP32[$78 >> 2] | 0) == ($9 | 0)) HEAP32[$78 >> 2] = $R$3; else HEAP32[$40 + 20 >> 2] = $R$3;
    if (!$R$3) {
     $$1 = $9;
     $$14 = $10;
     break;
    }
   }
   $83 = HEAP32[22844] | 0;
   if ($R$3 >>> 0 < $83 >>> 0) _abort();
   HEAP32[$R$3 + 24 >> 2] = $40;
   $86 = $9 + 16 | 0;
   $87 = HEAP32[$86 >> 2] | 0;
   do if ($87 | 0) if ($87 >>> 0 < $83 >>> 0) _abort(); else {
    HEAP32[$R$3 + 16 >> 2] = $87;
    HEAP32[$87 + 24 >> 2] = $R$3;
    break;
   } while (0);
   $93 = HEAP32[$86 + 4 >> 2] | 0;
   if (!$93) {
    $$1 = $9;
    $$14 = $10;
   } else if ($93 >>> 0 < (HEAP32[22844] | 0) >>> 0) _abort(); else {
    HEAP32[$R$3 + 20 >> 2] = $93;
    HEAP32[$93 + 24 >> 2] = $R$3;
    $$1 = $9;
    $$14 = $10;
    break;
   }
  }
 } else {
  $$1 = $p;
  $$14 = $psize;
 } while (0);
 $107 = HEAP32[22844] | 0;
 if ($0 >>> 0 < $107 >>> 0) _abort();
 $109 = $0 + 4 | 0;
 $110 = HEAP32[$109 >> 2] | 0;
 if (!($110 & 2)) {
  if (($0 | 0) == (HEAP32[22846] | 0)) {
   $116 = (HEAP32[22843] | 0) + $$14 | 0;
   HEAP32[22843] = $116;
   HEAP32[22846] = $$1;
   HEAP32[$$1 + 4 >> 2] = $116 | 1;
   if (($$1 | 0) != (HEAP32[22845] | 0)) return;
   HEAP32[22845] = 0;
   HEAP32[22842] = 0;
   return;
  }
  if (($0 | 0) == (HEAP32[22845] | 0)) {
   $124 = (HEAP32[22842] | 0) + $$14 | 0;
   HEAP32[22842] = $124;
   HEAP32[22845] = $$1;
   HEAP32[$$1 + 4 >> 2] = $124 | 1;
   HEAP32[$$1 + $124 >> 2] = $124;
   return;
  }
  $129 = ($110 & -8) + $$14 | 0;
  $130 = $110 >>> 3;
  do if ($110 >>> 0 < 256) {
   $133 = HEAP32[$0 + 8 >> 2] | 0;
   $135 = HEAP32[$0 + 12 >> 2] | 0;
   $137 = 91400 + ($130 << 1 << 2) | 0;
   if (($133 | 0) != ($137 | 0)) {
    if ($133 >>> 0 < $107 >>> 0) _abort();
    if ((HEAP32[$133 + 12 >> 2] | 0) != ($0 | 0)) _abort();
   }
   if (($135 | 0) == ($133 | 0)) {
    HEAP32[22840] = HEAP32[22840] & ~(1 << $130);
    break;
   }
   if (($135 | 0) == ($137 | 0)) $$pre$phi22Z2D = $135 + 8 | 0; else {
    if ($135 >>> 0 < $107 >>> 0) _abort();
    $150 = $135 + 8 | 0;
    if ((HEAP32[$150 >> 2] | 0) == ($0 | 0)) $$pre$phi22Z2D = $150; else _abort();
   }
   HEAP32[$133 + 12 >> 2] = $135;
   HEAP32[$$pre$phi22Z2D >> 2] = $133;
  } else {
   $155 = HEAP32[$0 + 24 >> 2] | 0;
   $157 = HEAP32[$0 + 12 >> 2] | 0;
   do if (($157 | 0) == ($0 | 0)) {
    $168 = $0 + 16 | 0;
    $169 = $168 + 4 | 0;
    $170 = HEAP32[$169 >> 2] | 0;
    if (!$170) {
     $172 = HEAP32[$168 >> 2] | 0;
     if (!$172) {
      $R7$3 = 0;
      break;
     } else {
      $R7$1 = $172;
      $RP9$1 = $168;
     }
    } else {
     $R7$1 = $170;
     $RP9$1 = $169;
    }
    while (1) {
     $174 = $R7$1 + 20 | 0;
     $175 = HEAP32[$174 >> 2] | 0;
     if ($175 | 0) {
      $R7$1 = $175;
      $RP9$1 = $174;
      continue;
     }
     $177 = $R7$1 + 16 | 0;
     $178 = HEAP32[$177 >> 2] | 0;
     if (!$178) {
      $R7$1$lcssa = $R7$1;
      $RP9$1$lcssa = $RP9$1;
      break;
     } else {
      $R7$1 = $178;
      $RP9$1 = $177;
     }
    }
    if ($RP9$1$lcssa >>> 0 < $107 >>> 0) _abort(); else {
     HEAP32[$RP9$1$lcssa >> 2] = 0;
     $R7$3 = $R7$1$lcssa;
     break;
    }
   } else {
    $160 = HEAP32[$0 + 8 >> 2] | 0;
    if ($160 >>> 0 < $107 >>> 0) _abort();
    $162 = $160 + 12 | 0;
    if ((HEAP32[$162 >> 2] | 0) != ($0 | 0)) _abort();
    $165 = $157 + 8 | 0;
    if ((HEAP32[$165 >> 2] | 0) == ($0 | 0)) {
     HEAP32[$162 >> 2] = $157;
     HEAP32[$165 >> 2] = $160;
     $R7$3 = $157;
     break;
    } else _abort();
   } while (0);
   if ($155 | 0) {
    $183 = HEAP32[$0 + 28 >> 2] | 0;
    $184 = 91664 + ($183 << 2) | 0;
    if (($0 | 0) == (HEAP32[$184 >> 2] | 0)) {
     HEAP32[$184 >> 2] = $R7$3;
     if (!$R7$3) {
      HEAP32[22841] = HEAP32[22841] & ~(1 << $183);
      break;
     }
    } else {
     if ($155 >>> 0 < (HEAP32[22844] | 0) >>> 0) _abort();
     $193 = $155 + 16 | 0;
     if ((HEAP32[$193 >> 2] | 0) == ($0 | 0)) HEAP32[$193 >> 2] = $R7$3; else HEAP32[$155 + 20 >> 2] = $R7$3;
     if (!$R7$3) break;
    }
    $198 = HEAP32[22844] | 0;
    if ($R7$3 >>> 0 < $198 >>> 0) _abort();
    HEAP32[$R7$3 + 24 >> 2] = $155;
    $201 = $0 + 16 | 0;
    $202 = HEAP32[$201 >> 2] | 0;
    do if ($202 | 0) if ($202 >>> 0 < $198 >>> 0) _abort(); else {
     HEAP32[$R7$3 + 16 >> 2] = $202;
     HEAP32[$202 + 24 >> 2] = $R7$3;
     break;
    } while (0);
    $208 = HEAP32[$201 + 4 >> 2] | 0;
    if ($208 | 0) if ($208 >>> 0 < (HEAP32[22844] | 0) >>> 0) _abort(); else {
     HEAP32[$R7$3 + 20 >> 2] = $208;
     HEAP32[$208 + 24 >> 2] = $R7$3;
     break;
    }
   }
  } while (0);
  HEAP32[$$1 + 4 >> 2] = $129 | 1;
  HEAP32[$$1 + $129 >> 2] = $129;
  if (($$1 | 0) == (HEAP32[22845] | 0)) {
   HEAP32[22842] = $129;
   return;
  } else $$2 = $129;
 } else {
  HEAP32[$109 >> 2] = $110 & -2;
  HEAP32[$$1 + 4 >> 2] = $$14 | 1;
  HEAP32[$$1 + $$14 >> 2] = $$14;
  $$2 = $$14;
 }
 $223 = $$2 >>> 3;
 if ($$2 >>> 0 < 256) {
  $226 = 91400 + ($223 << 1 << 2) | 0;
  $227 = HEAP32[22840] | 0;
  $228 = 1 << $223;
  if (!($227 & $228)) {
   HEAP32[22840] = $227 | $228;
   $$pre$phiZ2D = $226 + 8 | 0;
   $F17$0 = $226;
  } else {
   $232 = $226 + 8 | 0;
   $233 = HEAP32[$232 >> 2] | 0;
   if ($233 >>> 0 < (HEAP32[22844] | 0) >>> 0) _abort(); else {
    $$pre$phiZ2D = $232;
    $F17$0 = $233;
   }
  }
  HEAP32[$$pre$phiZ2D >> 2] = $$1;
  HEAP32[$F17$0 + 12 >> 2] = $$1;
  HEAP32[$$1 + 8 >> 2] = $F17$0;
  HEAP32[$$1 + 12 >> 2] = $226;
  return;
 }
 $239 = $$2 >>> 8;
 if (!$239) $I20$0 = 0; else if ($$2 >>> 0 > 16777215) $I20$0 = 31; else {
  $244 = ($239 + 1048320 | 0) >>> 16 & 8;
  $245 = $239 << $244;
  $248 = ($245 + 520192 | 0) >>> 16 & 4;
  $250 = $245 << $248;
  $253 = ($250 + 245760 | 0) >>> 16 & 2;
  $258 = 14 - ($248 | $244 | $253) + ($250 << $253 >>> 15) | 0;
  $I20$0 = $$2 >>> ($258 + 7 | 0) & 1 | $258 << 1;
 }
 $264 = 91664 + ($I20$0 << 2) | 0;
 HEAP32[$$1 + 28 >> 2] = $I20$0;
 HEAP32[$$1 + 20 >> 2] = 0;
 HEAP32[$$1 + 16 >> 2] = 0;
 $268 = HEAP32[22841] | 0;
 $269 = 1 << $I20$0;
 if (!($268 & $269)) {
  HEAP32[22841] = $268 | $269;
  HEAP32[$264 >> 2] = $$1;
  HEAP32[$$1 + 24 >> 2] = $264;
  HEAP32[$$1 + 12 >> 2] = $$1;
  HEAP32[$$1 + 8 >> 2] = $$1;
  return;
 }
 $K21$0 = $$2 << (($I20$0 | 0) == 31 ? 0 : 25 - ($I20$0 >>> 1) | 0);
 $T$0 = HEAP32[$264 >> 2] | 0;
 while (1) {
  if ((HEAP32[$T$0 + 4 >> 2] & -8 | 0) == ($$2 | 0)) {
   $T$0$lcssa = $T$0;
   label = 127;
   break;
  }
  $287 = $T$0 + 16 + ($K21$0 >>> 31 << 2) | 0;
  $289 = HEAP32[$287 >> 2] | 0;
  if (!$289) {
   $$lcssa = $287;
   $T$0$lcssa30 = $T$0;
   label = 124;
   break;
  } else {
   $K21$0 = $K21$0 << 1;
   $T$0 = $289;
  }
 }
 if ((label | 0) == 124) {
  if ($$lcssa >>> 0 < (HEAP32[22844] | 0) >>> 0) _abort();
  HEAP32[$$lcssa >> 2] = $$1;
  HEAP32[$$1 + 24 >> 2] = $T$0$lcssa30;
  HEAP32[$$1 + 12 >> 2] = $$1;
  HEAP32[$$1 + 8 >> 2] = $$1;
  return;
 } else if ((label | 0) == 127) {
  $296 = $T$0$lcssa + 8 | 0;
  $297 = HEAP32[$296 >> 2] | 0;
  $298 = HEAP32[22844] | 0;
  if (!($297 >>> 0 >= $298 >>> 0 & $T$0$lcssa >>> 0 >= $298 >>> 0)) _abort();
  HEAP32[$297 + 12 >> 2] = $$1;
  HEAP32[$296 >> 2] = $$1;
  HEAP32[$$1 + 8 >> 2] = $297;
  HEAP32[$$1 + 12 >> 2] = $T$0$lcssa;
  HEAP32[$$1 + 24 >> 2] = 0;
  return;
 }
}

function ___udivmoddi4($a$0, $a$1, $b$0, $b$1, $rem) {
 $a$0 = $a$0 | 0;
 $a$1 = $a$1 | 0;
 $b$0 = $b$0 | 0;
 $b$1 = $b$1 | 0;
 $rem = $rem | 0;
 var $n_sroa_0_0_extract_trunc = 0, $n_sroa_1_4_extract_shift$0 = 0, $n_sroa_1_4_extract_trunc = 0, $d_sroa_0_0_extract_trunc = 0, $d_sroa_1_4_extract_shift$0 = 0, $d_sroa_1_4_extract_trunc = 0, $4 = 0, $17 = 0, $37 = 0, $51 = 0, $57 = 0, $58 = 0, $66 = 0, $78 = 0, $88 = 0, $89 = 0, $91 = 0, $92 = 0, $95 = 0, $105 = 0, $119 = 0, $125 = 0, $126 = 0, $130 = 0, $q_sroa_1_1_ph = 0, $q_sroa_0_1_ph = 0, $r_sroa_1_1_ph = 0, $r_sroa_0_1_ph = 0, $sr_1_ph = 0, $d_sroa_0_0_insert_insert99$0 = 0, $d_sroa_0_0_insert_insert99$1 = 0, $137$0 = 0, $137$1 = 0, $carry_0203 = 0, $sr_1202 = 0, $r_sroa_0_1201 = 0, $r_sroa_1_1200 = 0, $q_sroa_0_1199 = 0, $q_sroa_1_1198 = 0, $r_sroa_0_0_insert_insert42$0 = 0, $r_sroa_0_0_insert_insert42$1 = 0, $150$1 = 0, $151$0 = 0, $carry_0_lcssa$0 = 0, $carry_0_lcssa$1 = 0, $r_sroa_0_1_lcssa = 0, $r_sroa_1_1_lcssa = 0, $q_sroa_0_1_lcssa = 0, $q_sroa_1_1_lcssa = 0, $q_sroa_0_0_insert_ext75$0 = 0, $q_sroa_0_0_insert_ext75$1 = 0, $_0$0 = 0, $_0$1 = 0, $q_sroa_1_1198$looptemp = 0, CSE$0 = 0;
 $n_sroa_0_0_extract_trunc = $a$0;
 $n_sroa_1_4_extract_shift$0 = $a$1;
 $n_sroa_1_4_extract_trunc = $n_sroa_1_4_extract_shift$0;
 $d_sroa_0_0_extract_trunc = $b$0;
 $d_sroa_1_4_extract_shift$0 = $b$1;
 $d_sroa_1_4_extract_trunc = $d_sroa_1_4_extract_shift$0;
 if (!$n_sroa_1_4_extract_trunc) {
  $4 = ($rem | 0) != 0;
  if (!$d_sroa_1_4_extract_trunc) {
   if ($4) {
    HEAP32[$rem >> 2] = ($n_sroa_0_0_extract_trunc >>> 0) % ($d_sroa_0_0_extract_trunc >>> 0);
    HEAP32[$rem + 4 >> 2] = 0;
   }
   $_0$1 = 0;
   $_0$0 = ($n_sroa_0_0_extract_trunc >>> 0) / ($d_sroa_0_0_extract_trunc >>> 0) >>> 0;
   return (tempRet0 = $_0$1, $_0$0) | 0;
  } else {
   if (!$4) {
    $_0$1 = 0;
    $_0$0 = 0;
    return (tempRet0 = $_0$1, $_0$0) | 0;
   }
   HEAP32[$rem >> 2] = $a$0 | 0;
   HEAP32[$rem + 4 >> 2] = $a$1 & 0;
   $_0$1 = 0;
   $_0$0 = 0;
   return (tempRet0 = $_0$1, $_0$0) | 0;
  }
 }
 $17 = ($d_sroa_1_4_extract_trunc | 0) == 0;
 do if (!$d_sroa_0_0_extract_trunc) {
  if ($17) {
   if ($rem | 0) {
    HEAP32[$rem >> 2] = ($n_sroa_1_4_extract_trunc >>> 0) % ($d_sroa_0_0_extract_trunc >>> 0);
    HEAP32[$rem + 4 >> 2] = 0;
   }
   $_0$1 = 0;
   $_0$0 = ($n_sroa_1_4_extract_trunc >>> 0) / ($d_sroa_0_0_extract_trunc >>> 0) >>> 0;
   return (tempRet0 = $_0$1, $_0$0) | 0;
  }
  if (!$n_sroa_0_0_extract_trunc) {
   if ($rem | 0) {
    HEAP32[$rem >> 2] = 0;
    HEAP32[$rem + 4 >> 2] = ($n_sroa_1_4_extract_trunc >>> 0) % ($d_sroa_1_4_extract_trunc >>> 0);
   }
   $_0$1 = 0;
   $_0$0 = ($n_sroa_1_4_extract_trunc >>> 0) / ($d_sroa_1_4_extract_trunc >>> 0) >>> 0;
   return (tempRet0 = $_0$1, $_0$0) | 0;
  }
  $37 = $d_sroa_1_4_extract_trunc - 1 | 0;
  if (!($37 & $d_sroa_1_4_extract_trunc)) {
   if ($rem | 0) {
    HEAP32[$rem >> 2] = $a$0 | 0;
    HEAP32[$rem + 4 >> 2] = $37 & $n_sroa_1_4_extract_trunc | $a$1 & 0;
   }
   $_0$1 = 0;
   $_0$0 = $n_sroa_1_4_extract_trunc >>> ((_llvm_cttz_i32($d_sroa_1_4_extract_trunc | 0) | 0) >>> 0);
   return (tempRet0 = $_0$1, $_0$0) | 0;
  }
  $51 = (Math_clz32($d_sroa_1_4_extract_trunc | 0) | 0) - (Math_clz32($n_sroa_1_4_extract_trunc | 0) | 0) | 0;
  if ($51 >>> 0 <= 30) {
   $57 = $51 + 1 | 0;
   $58 = 31 - $51 | 0;
   $sr_1_ph = $57;
   $r_sroa_0_1_ph = $n_sroa_1_4_extract_trunc << $58 | $n_sroa_0_0_extract_trunc >>> ($57 >>> 0);
   $r_sroa_1_1_ph = $n_sroa_1_4_extract_trunc >>> ($57 >>> 0);
   $q_sroa_0_1_ph = 0;
   $q_sroa_1_1_ph = $n_sroa_0_0_extract_trunc << $58;
   break;
  }
  if (!$rem) {
   $_0$1 = 0;
   $_0$0 = 0;
   return (tempRet0 = $_0$1, $_0$0) | 0;
  }
  HEAP32[$rem >> 2] = $a$0 | 0;
  HEAP32[$rem + 4 >> 2] = $n_sroa_1_4_extract_shift$0 | $a$1 & 0;
  $_0$1 = 0;
  $_0$0 = 0;
  return (tempRet0 = $_0$1, $_0$0) | 0;
 } else {
  if (!$17) {
   $119 = (Math_clz32($d_sroa_1_4_extract_trunc | 0) | 0) - (Math_clz32($n_sroa_1_4_extract_trunc | 0) | 0) | 0;
   if ($119 >>> 0 <= 31) {
    $125 = $119 + 1 | 0;
    $126 = 31 - $119 | 0;
    $130 = $119 - 31 >> 31;
    $sr_1_ph = $125;
    $r_sroa_0_1_ph = $n_sroa_0_0_extract_trunc >>> ($125 >>> 0) & $130 | $n_sroa_1_4_extract_trunc << $126;
    $r_sroa_1_1_ph = $n_sroa_1_4_extract_trunc >>> ($125 >>> 0) & $130;
    $q_sroa_0_1_ph = 0;
    $q_sroa_1_1_ph = $n_sroa_0_0_extract_trunc << $126;
    break;
   }
   if (!$rem) {
    $_0$1 = 0;
    $_0$0 = 0;
    return (tempRet0 = $_0$1, $_0$0) | 0;
   }
   HEAP32[$rem >> 2] = $a$0 | 0;
   HEAP32[$rem + 4 >> 2] = $n_sroa_1_4_extract_shift$0 | $a$1 & 0;
   $_0$1 = 0;
   $_0$0 = 0;
   return (tempRet0 = $_0$1, $_0$0) | 0;
  }
  $66 = $d_sroa_0_0_extract_trunc - 1 | 0;
  if ($66 & $d_sroa_0_0_extract_trunc | 0) {
   $88 = (Math_clz32($d_sroa_0_0_extract_trunc | 0) | 0) + 33 - (Math_clz32($n_sroa_1_4_extract_trunc | 0) | 0) | 0;
   $89 = 64 - $88 | 0;
   $91 = 32 - $88 | 0;
   $92 = $91 >> 31;
   $95 = $88 - 32 | 0;
   $105 = $95 >> 31;
   $sr_1_ph = $88;
   $r_sroa_0_1_ph = $91 - 1 >> 31 & $n_sroa_1_4_extract_trunc >>> ($95 >>> 0) | ($n_sroa_1_4_extract_trunc << $91 | $n_sroa_0_0_extract_trunc >>> ($88 >>> 0)) & $105;
   $r_sroa_1_1_ph = $105 & $n_sroa_1_4_extract_trunc >>> ($88 >>> 0);
   $q_sroa_0_1_ph = $n_sroa_0_0_extract_trunc << $89 & $92;
   $q_sroa_1_1_ph = ($n_sroa_1_4_extract_trunc << $89 | $n_sroa_0_0_extract_trunc >>> ($95 >>> 0)) & $92 | $n_sroa_0_0_extract_trunc << $91 & $88 - 33 >> 31;
   break;
  }
  if ($rem | 0) {
   HEAP32[$rem >> 2] = $66 & $n_sroa_0_0_extract_trunc;
   HEAP32[$rem + 4 >> 2] = 0;
  }
  if (($d_sroa_0_0_extract_trunc | 0) == 1) {
   $_0$1 = $n_sroa_1_4_extract_shift$0 | $a$1 & 0;
   $_0$0 = $a$0 | 0 | 0;
   return (tempRet0 = $_0$1, $_0$0) | 0;
  } else {
   $78 = _llvm_cttz_i32($d_sroa_0_0_extract_trunc | 0) | 0;
   $_0$1 = $n_sroa_1_4_extract_trunc >>> ($78 >>> 0) | 0;
   $_0$0 = $n_sroa_1_4_extract_trunc << 32 - $78 | $n_sroa_0_0_extract_trunc >>> ($78 >>> 0) | 0;
   return (tempRet0 = $_0$1, $_0$0) | 0;
  }
 } while (0);
 if (!$sr_1_ph) {
  $q_sroa_1_1_lcssa = $q_sroa_1_1_ph;
  $q_sroa_0_1_lcssa = $q_sroa_0_1_ph;
  $r_sroa_1_1_lcssa = $r_sroa_1_1_ph;
  $r_sroa_0_1_lcssa = $r_sroa_0_1_ph;
  $carry_0_lcssa$1 = 0;
  $carry_0_lcssa$0 = 0;
 } else {
  $d_sroa_0_0_insert_insert99$0 = $b$0 | 0 | 0;
  $d_sroa_0_0_insert_insert99$1 = $d_sroa_1_4_extract_shift$0 | $b$1 & 0;
  $137$0 = _i64Add($d_sroa_0_0_insert_insert99$0 | 0, $d_sroa_0_0_insert_insert99$1 | 0, -1, -1) | 0;
  $137$1 = tempRet0;
  $q_sroa_1_1198 = $q_sroa_1_1_ph;
  $q_sroa_0_1199 = $q_sroa_0_1_ph;
  $r_sroa_1_1200 = $r_sroa_1_1_ph;
  $r_sroa_0_1201 = $r_sroa_0_1_ph;
  $sr_1202 = $sr_1_ph;
  $carry_0203 = 0;
  do {
   $q_sroa_1_1198$looptemp = $q_sroa_1_1198;
   $q_sroa_1_1198 = $q_sroa_0_1199 >>> 31 | $q_sroa_1_1198 << 1;
   $q_sroa_0_1199 = $carry_0203 | $q_sroa_0_1199 << 1;
   $r_sroa_0_0_insert_insert42$0 = $r_sroa_0_1201 << 1 | $q_sroa_1_1198$looptemp >>> 31 | 0;
   $r_sroa_0_0_insert_insert42$1 = $r_sroa_0_1201 >>> 31 | $r_sroa_1_1200 << 1 | 0;
   _i64Subtract($137$0 | 0, $137$1 | 0, $r_sroa_0_0_insert_insert42$0 | 0, $r_sroa_0_0_insert_insert42$1 | 0) | 0;
   $150$1 = tempRet0;
   CSE$0 = (($150$1 | 0) < 0 ? -1 : 0) << 1 | 0;
   $151$0 = $150$1 >> 31 | CSE$0;
   $carry_0203 = $151$0 & 1;
   $r_sroa_0_1201 = _i64Subtract($r_sroa_0_0_insert_insert42$0 | 0, $r_sroa_0_0_insert_insert42$1 | 0, $151$0 & $d_sroa_0_0_insert_insert99$0 | 0, ((($150$1 | 0) < 0 ? -1 : 0) >> 31 | CSE$0) & $d_sroa_0_0_insert_insert99$1 | 0) | 0;
   $r_sroa_1_1200 = tempRet0;
   $sr_1202 = $sr_1202 - 1 | 0;
  } while (($sr_1202 | 0) != 0);
  $q_sroa_1_1_lcssa = $q_sroa_1_1198;
  $q_sroa_0_1_lcssa = $q_sroa_0_1199;
  $r_sroa_1_1_lcssa = $r_sroa_1_1200;
  $r_sroa_0_1_lcssa = $r_sroa_0_1201;
  $carry_0_lcssa$1 = 0;
  $carry_0_lcssa$0 = $carry_0203;
 }
 $q_sroa_0_0_insert_ext75$0 = $q_sroa_0_1_lcssa;
 $q_sroa_0_0_insert_ext75$1 = 0;
 if ($rem | 0) {
  HEAP32[$rem >> 2] = $r_sroa_0_1_lcssa;
  HEAP32[$rem + 4 >> 2] = $r_sroa_1_1_lcssa;
 }
 $_0$1 = ($q_sroa_0_0_insert_ext75$0 | 0) >>> 31 | ($q_sroa_1_1_lcssa | $q_sroa_0_0_insert_ext75$1) << 1 | ($q_sroa_0_0_insert_ext75$1 << 1 | $q_sroa_0_0_insert_ext75$0 >>> 31) & 0 | $carry_0_lcssa$1;
 $_0$0 = ($q_sroa_0_0_insert_ext75$0 << 1 | 0 >>> 31) & -2 | $carry_0_lcssa$0;
 return (tempRet0 = $_0$1, $_0$0) | 0;
}

function _mbsrtowcs($ws, $src, $wn, $st) {
 $ws = $ws | 0;
 $src = $src | 0;
 $wn = $wn | 0;
 $st = $st | 0;
 var $$0 = 0, $$02$ph = 0, $$0219 = 0, $$03 = 0, $$1 = 0, $$1$lcssa = 0, $$1415 = 0, $$2 = 0, $$2$lcssa = 0, $$25 = 0, $$25$lcssa = 0, $$3 = 0, $$36 = 0, $$4 = 0, $$434 = 0, $$47$ph = 0, $$4718 = 0, $$48 = 0, $$5 = 0, $$5$lcssa = 0, $$6 = 0, $$6$lcssa = 0, $$7 = 0, $$8 = 0, $$833 = 0, $$lcssa = 0, $$lcssa102 = 0, $$lcssa88 = 0, $$lcssa89 = 0, $$lcssa90 = 0, $$lcssa94 = 0, $$lcssa96 = 0, $$lcssa97 = 0, $$lcssa98 = 0, $0 = 0, $102 = 0, $108 = 0, $109 = 0, $117 = 0, $119 = 0, $122 = 0, $127 = 0, $129 = 0, $132 = 0, $14 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $28 = 0, $29 = 0, $34 = 0, $41 = 0, $48 = 0, $55 = 0, $64 = 0, $7 = 0, $72 = 0, $88 = 0, $91 = 0, $92 = 0, $94 = 0, $95 = 0, $98 = 0, $c$2 = 0, $c$4 = 0, $c$5 = 0, $c$6 = 0, $s$0 = 0, $s$10 = 0, $s$1035 = 0, $s$109 = 0, $s$116 = 0, $s$2 = 0, $s$2$lcssa = 0, $s$3 = 0, $s$4 = 0, $s$5$lcssa = 0, $s$5$ph = 0, $s$520 = 0, $s$6 = 0, $s$6$lcssa = 0, $s$7 = 0, $s$7$lcssa = 0, $s$8 = 0, $s$9 = 0, label = 0;
 label = 0;
 $0 = HEAP32[$src >> 2] | 0;
 if (!$st) label = 5; else {
  $2 = HEAP32[$st >> 2] | 0;
  if (!$2) label = 5; else if (!$ws) {
   $$36 = $wn;
   $c$2 = $2;
   $s$3 = $0;
   label = 16;
  } else {
   HEAP32[$st >> 2] = 0;
   $$3 = $ws;
   $$7 = $wn;
   $c$4 = $2;
   $s$8 = $0;
   label = 37;
  }
 }
 if ((label | 0) == 5) if (!$ws) {
  $$03 = $wn;
  $s$0 = $0;
  label = 7;
 } else {
  $$02$ph = $ws;
  $$47$ph = $wn;
  $s$5$ph = $0;
  label = 6;
 }
 L7 : while (1) if ((label | 0) == 6) {
  label = 0;
  if (!$$47$ph) {
   $s$5$lcssa = $s$5$ph;
   label = 26;
   break;
  } else {
   $$0219 = $$02$ph;
   $$4718 = $$47$ph;
   $s$520 = $s$5$ph;
  }
  while (1) {
   $64 = HEAP8[$s$520 >> 0] | 0;
   do if ((($64 & 255) + -1 | 0) >>> 0 < 127) if ($$4718 >>> 0 > 4 & ($s$520 & 3 | 0) == 0) {
    $$1 = $$0219;
    $$5 = $$4718;
    $s$6 = $s$520;
    while (1) {
     $72 = HEAP32[$s$6 >> 2] | 0;
     if (($72 + -16843009 | $72) & -2139062144 | 0) {
      $$1$lcssa = $$1;
      $$5$lcssa = $$5;
      $$lcssa94 = $72;
      $s$6$lcssa = $s$6;
      label = 32;
      break;
     }
     HEAP32[$$1 >> 2] = $72 & 255;
     HEAP32[$$1 + 4 >> 2] = HEAPU8[$s$6 + 1 >> 0];
     HEAP32[$$1 + 8 >> 2] = HEAPU8[$s$6 + 2 >> 0];
     $88 = $s$6 + 4 | 0;
     $91 = $$1 + 16 | 0;
     HEAP32[$$1 + 12 >> 2] = HEAPU8[$s$6 + 3 >> 0];
     $92 = $$5 + -4 | 0;
     if ($92 >>> 0 > 4) {
      $$1 = $91;
      $$5 = $92;
      $s$6 = $88;
     } else {
      $$lcssa96 = $88;
      $$lcssa97 = $91;
      $$lcssa98 = $92;
      label = 31;
      break;
     }
    }
    if ((label | 0) == 31) {
     label = 0;
     $$2 = $$lcssa97;
     $$6 = $$lcssa98;
     $95 = HEAP8[$$lcssa96 >> 0] | 0;
     $s$7 = $$lcssa96;
     break;
    } else if ((label | 0) == 32) {
     label = 0;
     $$2 = $$1$lcssa;
     $$6 = $$5$lcssa;
     $95 = $$lcssa94 & 255;
     $s$7 = $s$6$lcssa;
     break;
    }
   } else {
    $$2 = $$0219;
    $$6 = $$4718;
    $95 = $64;
    $s$7 = $s$520;
   } else {
    $$2 = $$0219;
    $$6 = $$4718;
    $95 = $64;
    $s$7 = $s$520;
   } while (0);
   $94 = $95 & 255;
   if (($94 + -1 | 0) >>> 0 >= 127) {
    $$2$lcssa = $$2;
    $$6$lcssa = $$6;
    $$lcssa102 = $94;
    $s$7$lcssa = $s$7;
    break;
   }
   $98 = $s$7 + 1 | 0;
   HEAP32[$$2 >> 2] = $94;
   $$4718 = $$6 + -1 | 0;
   if (!$$4718) {
    $s$5$lcssa = $98;
    label = 26;
    break L7;
   } else {
    $$0219 = $$2 + 4 | 0;
    $s$520 = $98;
   }
  }
  $102 = $$lcssa102 + -194 | 0;
  if ($102 >>> 0 > 50) {
   $$434 = $$2$lcssa;
   $$833 = $$6$lcssa;
   $s$1035 = $s$7$lcssa;
   label = 48;
   break;
  }
  $$3 = $$2$lcssa;
  $$7 = $$6$lcssa;
  $c$4 = HEAP32[3268 + ($102 << 2) >> 2] | 0;
  $s$8 = $s$7$lcssa + 1 | 0;
  label = 37;
  continue;
 } else if ((label | 0) == 7) {
  label = 0;
  $7 = HEAP8[$s$0 >> 0] | 0;
  if ((($7 & 255) + -1 | 0) >>> 0 < 127) if (!($s$0 & 3)) {
   $14 = HEAP32[$s$0 >> 2] | 0;
   $19 = $14 & 255;
   if (!(($14 + -16843009 | $14) & -2139062144)) {
    $$1415 = $$03;
    $s$116 = $s$0;
    while (1) {
     $20 = $s$116 + 4 | 0;
     $21 = $$1415 + -4 | 0;
     $22 = HEAP32[$20 >> 2] | 0;
     if (!(($22 + -16843009 | $22) & -2139062144)) {
      $$1415 = $21;
      $s$116 = $20;
     } else {
      $$lcssa = $20;
      $$lcssa88 = $21;
      $$lcssa89 = $22;
      break;
     }
    }
    $$25 = $$lcssa88;
    $29 = $$lcssa89 & 255;
    $s$2 = $$lcssa;
   } else {
    $$25 = $$03;
    $29 = $19;
    $s$2 = $s$0;
   }
  } else {
   $$25 = $$03;
   $29 = $7;
   $s$2 = $s$0;
  } else {
   $$25 = $$03;
   $29 = $7;
   $s$2 = $s$0;
  }
  $28 = $29 & 255;
  if (($28 + -1 | 0) >>> 0 < 127) {
   $$03 = $$25 + -1 | 0;
   $s$0 = $s$2 + 1 | 0;
   label = 7;
   continue;
  } else {
   $$25$lcssa = $$25;
   $$lcssa90 = $28;
   $s$2$lcssa = $s$2;
  }
  $34 = $$lcssa90 + -194 | 0;
  if ($34 >>> 0 > 50) {
   $$434 = $ws;
   $$833 = $$25$lcssa;
   $s$1035 = $s$2$lcssa;
   label = 48;
   break;
  }
  $$36 = $$25$lcssa;
  $c$2 = HEAP32[3268 + ($34 << 2) >> 2] | 0;
  $s$3 = $s$2$lcssa + 1 | 0;
  label = 16;
  continue;
 } else if ((label | 0) == 16) {
  label = 0;
  $41 = (HEAPU8[$s$3 >> 0] | 0) >>> 3;
  if (($41 + -16 | $41 + ($c$2 >> 26)) >>> 0 > 7) {
   label = 17;
   break;
  }
  $48 = $s$3 + 1 | 0;
  if (!($c$2 & 33554432)) $s$4 = $48; else {
   if ((HEAP8[$48 >> 0] & -64) << 24 >> 24 != -128) {
    label = 20;
    break;
   }
   $55 = $s$3 + 2 | 0;
   if (!($c$2 & 524288)) $s$4 = $55; else {
    if ((HEAP8[$55 >> 0] & -64) << 24 >> 24 != -128) {
     label = 23;
     break;
    }
    $s$4 = $s$3 + 3 | 0;
   }
  }
  $$03 = $$36 + -1 | 0;
  $s$0 = $s$4;
  label = 7;
  continue;
 } else if ((label | 0) == 37) {
  label = 0;
  $108 = HEAPU8[$s$8 >> 0] | 0;
  $109 = $108 >>> 3;
  if (($109 + -16 | $109 + ($c$4 >> 26)) >>> 0 > 7) {
   label = 38;
   break;
  }
  $117 = $s$8 + 1 | 0;
  $119 = $108 + -128 | $c$4 << 6;
  if (($119 | 0) < 0) {
   $122 = HEAPU8[$117 >> 0] | 0;
   if (($122 & 192 | 0) != 128) {
    label = 41;
    break;
   }
   $127 = $s$8 + 2 | 0;
   $129 = $122 + -128 | $119 << 6;
   if (($129 | 0) < 0) {
    $132 = HEAPU8[$127 >> 0] | 0;
    if (($132 & 192 | 0) != 128) {
     label = 44;
     break;
    }
    $c$5 = $132 + -128 | $129 << 6;
    $s$9 = $s$8 + 3 | 0;
   } else {
    $c$5 = $129;
    $s$9 = $127;
   }
  } else {
   $c$5 = $119;
   $s$9 = $117;
  }
  HEAP32[$$3 >> 2] = $c$5;
  $$02$ph = $$3 + 4 | 0;
  $$47$ph = $$7 + -1 | 0;
  $s$5$ph = $s$9;
  label = 6;
  continue;
 }
 if ((label | 0) == 17) {
  $$4 = $ws;
  $$8 = $$36;
  $c$6 = $c$2;
  $s$10 = $s$3 + -1 | 0;
  label = 47;
 } else if ((label | 0) == 20) {
  $$4 = $ws;
  $$8 = $$36;
  $c$6 = $c$2;
  $s$10 = $s$3 + -1 | 0;
  label = 47;
 } else if ((label | 0) == 23) {
  $$4 = $ws;
  $$8 = $$36;
  $c$6 = $c$2;
  $s$10 = $s$3 + -1 | 0;
  label = 47;
 } else if ((label | 0) == 26) {
  HEAP32[$src >> 2] = $s$5$lcssa;
  $$0 = $wn;
 } else if ((label | 0) == 38) {
  $$4 = $$3;
  $$8 = $$7;
  $c$6 = $c$4;
  $s$10 = $s$8 + -1 | 0;
  label = 47;
 } else if ((label | 0) == 41) {
  $$48 = $$3;
  $s$109 = $s$8 + -1 | 0;
  label = 52;
 } else if ((label | 0) == 44) {
  $$48 = $$3;
  $s$109 = $s$8 + -1 | 0;
  label = 52;
 }
 if ((label | 0) == 47) if (!$c$6) {
  $$434 = $$4;
  $$833 = $$8;
  $s$1035 = $s$10;
  label = 48;
 } else {
  $$48 = $$4;
  $s$109 = $s$10;
  label = 52;
 }
 if ((label | 0) == 48) if (!(HEAP8[$s$1035 >> 0] | 0)) {
  if ($$434 | 0) {
   HEAP32[$$434 >> 2] = 0;
   HEAP32[$src >> 2] = 0;
  }
  $$0 = $wn - $$833 | 0;
 } else {
  $$48 = $$434;
  $s$109 = $s$1035;
  label = 52;
 }
 if ((label | 0) == 52) {
  HEAP32[(___errno_location() | 0) >> 2] = 84;
  if (!$$48) $$0 = -1; else {
   HEAP32[$src >> 2] = $s$109;
   $$0 = -1;
  }
 }
 return $$0 | 0;
}

function _try_realloc_chunk($p, $nb) {
 $p = $p | 0;
 $nb = $nb | 0;
 var $$pre$phiZ2D = 0, $0 = 0, $1 = 0, $101 = 0, $104 = 0, $106 = 0, $109 = 0, $112 = 0, $113 = 0, $114 = 0, $116 = 0, $118 = 0, $119 = 0, $121 = 0, $122 = 0, $127 = 0, $128 = 0, $137 = 0, $142 = 0, $145 = 0, $146 = 0, $152 = 0, $163 = 0, $166 = 0, $173 = 0, $2 = 0, $20 = 0, $22 = 0, $29 = 0, $3 = 0, $35 = 0, $37 = 0, $38 = 0, $4 = 0, $47 = 0, $49 = 0, $5 = 0, $51 = 0, $52 = 0, $58 = 0, $65 = 0, $71 = 0, $73 = 0, $74 = 0, $77 = 0, $79 = 0, $8 = 0, $81 = 0, $94 = 0, $99 = 0, $R$1 = 0, $R$1$lcssa = 0, $R$3 = 0, $RP$1 = 0, $RP$1$lcssa = 0, $newp$2 = 0, $storemerge = 0, $storemerge1 = 0;
 $0 = $p + 4 | 0;
 $1 = HEAP32[$0 >> 2] | 0;
 $2 = $1 & -8;
 $3 = $p + $2 | 0;
 $4 = HEAP32[22844] | 0;
 $5 = $1 & 3;
 if (!(($5 | 0) != 1 & $p >>> 0 >= $4 >>> 0 & $p >>> 0 < $3 >>> 0)) _abort();
 $8 = HEAP32[$3 + 4 >> 2] | 0;
 if (!($8 & 1)) _abort();
 if (!$5) {
  if ($nb >>> 0 < 256) {
   $newp$2 = 0;
   return $newp$2 | 0;
  }
  if ($2 >>> 0 >= ($nb + 4 | 0) >>> 0) if (($2 - $nb | 0) >>> 0 <= HEAP32[22960] << 1 >>> 0) {
   $newp$2 = $p;
   return $newp$2 | 0;
  }
  $newp$2 = 0;
  return $newp$2 | 0;
 }
 if ($2 >>> 0 >= $nb >>> 0) {
  $20 = $2 - $nb | 0;
  if ($20 >>> 0 <= 15) {
   $newp$2 = $p;
   return $newp$2 | 0;
  }
  $22 = $p + $nb | 0;
  HEAP32[$0 >> 2] = $1 & 1 | $nb | 2;
  HEAP32[$22 + 4 >> 2] = $20 | 3;
  $29 = $22 + $20 + 4 | 0;
  HEAP32[$29 >> 2] = HEAP32[$29 >> 2] | 1;
  _dispose_chunk($22, $20);
  $newp$2 = $p;
  return $newp$2 | 0;
 }
 if (($3 | 0) == (HEAP32[22846] | 0)) {
  $35 = (HEAP32[22843] | 0) + $2 | 0;
  if ($35 >>> 0 <= $nb >>> 0) {
   $newp$2 = 0;
   return $newp$2 | 0;
  }
  $37 = $35 - $nb | 0;
  $38 = $p + $nb | 0;
  HEAP32[$0 >> 2] = $1 & 1 | $nb | 2;
  HEAP32[$38 + 4 >> 2] = $37 | 1;
  HEAP32[22846] = $38;
  HEAP32[22843] = $37;
  $newp$2 = $p;
  return $newp$2 | 0;
 }
 if (($3 | 0) == (HEAP32[22845] | 0)) {
  $47 = (HEAP32[22842] | 0) + $2 | 0;
  if ($47 >>> 0 < $nb >>> 0) {
   $newp$2 = 0;
   return $newp$2 | 0;
  }
  $49 = $47 - $nb | 0;
  if ($49 >>> 0 > 15) {
   $51 = $p + $nb | 0;
   $52 = $51 + $49 | 0;
   HEAP32[$0 >> 2] = $1 & 1 | $nb | 2;
   HEAP32[$51 + 4 >> 2] = $49 | 1;
   HEAP32[$52 >> 2] = $49;
   $58 = $52 + 4 | 0;
   HEAP32[$58 >> 2] = HEAP32[$58 >> 2] & -2;
   $storemerge = $51;
   $storemerge1 = $49;
  } else {
   HEAP32[$0 >> 2] = $1 & 1 | $47 | 2;
   $65 = $p + $47 + 4 | 0;
   HEAP32[$65 >> 2] = HEAP32[$65 >> 2] | 1;
   $storemerge = 0;
   $storemerge1 = 0;
  }
  HEAP32[22842] = $storemerge1;
  HEAP32[22845] = $storemerge;
  $newp$2 = $p;
  return $newp$2 | 0;
 }
 if ($8 & 2 | 0) {
  $newp$2 = 0;
  return $newp$2 | 0;
 }
 $71 = ($8 & -8) + $2 | 0;
 if ($71 >>> 0 < $nb >>> 0) {
  $newp$2 = 0;
  return $newp$2 | 0;
 }
 $73 = $71 - $nb | 0;
 $74 = $8 >>> 3;
 do if ($8 >>> 0 < 256) {
  $77 = HEAP32[$3 + 8 >> 2] | 0;
  $79 = HEAP32[$3 + 12 >> 2] | 0;
  $81 = 91400 + ($74 << 1 << 2) | 0;
  if (($77 | 0) != ($81 | 0)) {
   if ($77 >>> 0 < $4 >>> 0) _abort();
   if ((HEAP32[$77 + 12 >> 2] | 0) != ($3 | 0)) _abort();
  }
  if (($79 | 0) == ($77 | 0)) {
   HEAP32[22840] = HEAP32[22840] & ~(1 << $74);
   break;
  }
  if (($79 | 0) == ($81 | 0)) $$pre$phiZ2D = $79 + 8 | 0; else {
   if ($79 >>> 0 < $4 >>> 0) _abort();
   $94 = $79 + 8 | 0;
   if ((HEAP32[$94 >> 2] | 0) == ($3 | 0)) $$pre$phiZ2D = $94; else _abort();
  }
  HEAP32[$77 + 12 >> 2] = $79;
  HEAP32[$$pre$phiZ2D >> 2] = $77;
 } else {
  $99 = HEAP32[$3 + 24 >> 2] | 0;
  $101 = HEAP32[$3 + 12 >> 2] | 0;
  do if (($101 | 0) == ($3 | 0)) {
   $112 = $3 + 16 | 0;
   $113 = $112 + 4 | 0;
   $114 = HEAP32[$113 >> 2] | 0;
   if (!$114) {
    $116 = HEAP32[$112 >> 2] | 0;
    if (!$116) {
     $R$3 = 0;
     break;
    } else {
     $R$1 = $116;
     $RP$1 = $112;
    }
   } else {
    $R$1 = $114;
    $RP$1 = $113;
   }
   while (1) {
    $118 = $R$1 + 20 | 0;
    $119 = HEAP32[$118 >> 2] | 0;
    if ($119 | 0) {
     $R$1 = $119;
     $RP$1 = $118;
     continue;
    }
    $121 = $R$1 + 16 | 0;
    $122 = HEAP32[$121 >> 2] | 0;
    if (!$122) {
     $R$1$lcssa = $R$1;
     $RP$1$lcssa = $RP$1;
     break;
    } else {
     $R$1 = $122;
     $RP$1 = $121;
    }
   }
   if ($RP$1$lcssa >>> 0 < $4 >>> 0) _abort(); else {
    HEAP32[$RP$1$lcssa >> 2] = 0;
    $R$3 = $R$1$lcssa;
    break;
   }
  } else {
   $104 = HEAP32[$3 + 8 >> 2] | 0;
   if ($104 >>> 0 < $4 >>> 0) _abort();
   $106 = $104 + 12 | 0;
   if ((HEAP32[$106 >> 2] | 0) != ($3 | 0)) _abort();
   $109 = $101 + 8 | 0;
   if ((HEAP32[$109 >> 2] | 0) == ($3 | 0)) {
    HEAP32[$106 >> 2] = $101;
    HEAP32[$109 >> 2] = $104;
    $R$3 = $101;
    break;
   } else _abort();
  } while (0);
  if ($99 | 0) {
   $127 = HEAP32[$3 + 28 >> 2] | 0;
   $128 = 91664 + ($127 << 2) | 0;
   if (($3 | 0) == (HEAP32[$128 >> 2] | 0)) {
    HEAP32[$128 >> 2] = $R$3;
    if (!$R$3) {
     HEAP32[22841] = HEAP32[22841] & ~(1 << $127);
     break;
    }
   } else {
    if ($99 >>> 0 < (HEAP32[22844] | 0) >>> 0) _abort();
    $137 = $99 + 16 | 0;
    if ((HEAP32[$137 >> 2] | 0) == ($3 | 0)) HEAP32[$137 >> 2] = $R$3; else HEAP32[$99 + 20 >> 2] = $R$3;
    if (!$R$3) break;
   }
   $142 = HEAP32[22844] | 0;
   if ($R$3 >>> 0 < $142 >>> 0) _abort();
   HEAP32[$R$3 + 24 >> 2] = $99;
   $145 = $3 + 16 | 0;
   $146 = HEAP32[$145 >> 2] | 0;
   do if ($146 | 0) if ($146 >>> 0 < $142 >>> 0) _abort(); else {
    HEAP32[$R$3 + 16 >> 2] = $146;
    HEAP32[$146 + 24 >> 2] = $R$3;
    break;
   } while (0);
   $152 = HEAP32[$145 + 4 >> 2] | 0;
   if ($152 | 0) if ($152 >>> 0 < (HEAP32[22844] | 0) >>> 0) _abort(); else {
    HEAP32[$R$3 + 20 >> 2] = $152;
    HEAP32[$152 + 24 >> 2] = $R$3;
    break;
   }
  }
 } while (0);
 if ($73 >>> 0 < 16) {
  HEAP32[$0 >> 2] = $71 | $1 & 1 | 2;
  $163 = $p + $71 + 4 | 0;
  HEAP32[$163 >> 2] = HEAP32[$163 >> 2] | 1;
  $newp$2 = $p;
  return $newp$2 | 0;
 } else {
  $166 = $p + $nb | 0;
  HEAP32[$0 >> 2] = $1 & 1 | $nb | 2;
  HEAP32[$166 + 4 >> 2] = $73 | 3;
  $173 = $166 + $73 + 4 | 0;
  HEAP32[$173 >> 2] = HEAP32[$173 >> 2] | 1;
  _dispose_chunk($166, $73);
  $newp$2 = $p;
  return $newp$2 | 0;
 }
 return 0;
}

function _fmod($x, $y) {
 $x = +$x;
 $y = +$y;
 var $$0 = 0.0, $$lcssa7 = 0, $0 = 0, $1 = 0, $10 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $107 = 0, $108 = 0, $11 = 0, $113 = 0, $114 = 0, $116 = 0, $119 = 0, $12 = 0, $121 = 0, $127 = 0, $128 = 0, $129 = 0, $130 = 0, $131 = 0, $138 = 0, $139 = 0, $140 = 0, $141 = 0, $142 = 0, $147 = 0, $150 = 0, $151 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $17 = 0, $2 = 0, $24 = 0.0, $26 = 0, $27 = 0, $3 = 0, $38 = 0, $39 = 0, $4 = 0, $45 = 0, $46 = 0, $47 = 0, $56 = 0, $6 = 0, $61 = 0, $62 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $79 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $94 = 0, $95 = 0, $97 = 0, $ex$0$lcssa = 0, $ex$026 = 0, $ex$1 = 0, $ex$2$lcssa = 0, $ex$212 = 0, $ex$3$lcssa = 0, $ex$39 = 0, $ey$0$lcssa = 0, $ey$020 = 0, $ey$1$ph = 0, $fabs = 0.0, label = 0;
 label = 0;
 HEAPF64[tempDoublePtr >> 3] = $x;
 $0 = HEAP32[tempDoublePtr >> 2] | 0;
 $1 = HEAP32[tempDoublePtr + 4 >> 2] | 0;
 HEAPF64[tempDoublePtr >> 3] = $y;
 $2 = HEAP32[tempDoublePtr >> 2] | 0;
 $3 = HEAP32[tempDoublePtr + 4 >> 2] | 0;
 $4 = _bitshift64Lshr($0 | 0, $1 | 0, 52) | 0;
 $6 = $4 & 2047;
 $7 = _bitshift64Lshr($2 | 0, $3 | 0, 52) | 0;
 $9 = $7 & 2047;
 $10 = $1 & -2147483648;
 $11 = _bitshift64Shl($2 | 0, $3 | 0, 1) | 0;
 $12 = tempRet0;
 L1 : do if (($11 | 0) == 0 & ($12 | 0) == 0) label = 3; else {
  $fabs = +Math_abs(+$y);
  HEAPF64[tempDoublePtr >> 3] = $fabs;
  $17 = HEAP32[tempDoublePtr + 4 >> 2] | 0;
  if ($17 >>> 0 > 2146435072 | ($17 | 0) == 2146435072 & (HEAP32[tempDoublePtr >> 2] | 0) >>> 0 > 0 | ($6 | 0) == 2047) label = 3; else {
   $26 = _bitshift64Shl($0 | 0, $1 | 0, 1) | 0;
   $27 = tempRet0;
   if (!($27 >>> 0 > $12 >>> 0 | ($27 | 0) == ($12 | 0) & $26 >>> 0 > $11 >>> 0)) return +(($26 | 0) == ($11 | 0) & ($27 | 0) == ($12 | 0) ? $x * 0.0 : $x);
   if (!$6) {
    $38 = _bitshift64Shl($0 | 0, $1 | 0, 12) | 0;
    $39 = tempRet0;
    if (($39 | 0) > -1 | ($39 | 0) == -1 & $38 >>> 0 > 4294967295) {
     $46 = $38;
     $47 = $39;
     $ex$026 = 0;
     while (1) {
      $45 = $ex$026 + -1 | 0;
      $46 = _bitshift64Shl($46 | 0, $47 | 0, 1) | 0;
      $47 = tempRet0;
      if (!(($47 | 0) > -1 | ($47 | 0) == -1 & $46 >>> 0 > 4294967295)) {
       $ex$0$lcssa = $45;
       break;
      } else $ex$026 = $45;
     }
    } else $ex$0$lcssa = 0;
    $56 = _bitshift64Shl($0 | 0, $1 | 0, 1 - $ex$0$lcssa | 0) | 0;
    $84 = $56;
    $85 = tempRet0;
    $ex$1 = $ex$0$lcssa;
   } else {
    $84 = $0;
    $85 = $1 & 1048575 | 1048576;
    $ex$1 = $6;
   }
   if (!$9) {
    $61 = _bitshift64Shl($2 | 0, $3 | 0, 12) | 0;
    $62 = tempRet0;
    if (($62 | 0) > -1 | ($62 | 0) == -1 & $61 >>> 0 > 4294967295) {
     $69 = $61;
     $70 = $62;
     $ey$020 = 0;
     while (1) {
      $68 = $ey$020 + -1 | 0;
      $69 = _bitshift64Shl($69 | 0, $70 | 0, 1) | 0;
      $70 = tempRet0;
      if (!(($70 | 0) > -1 | ($70 | 0) == -1 & $69 >>> 0 > 4294967295)) {
       $ey$0$lcssa = $68;
       break;
      } else $ey$020 = $68;
     }
    } else $ey$0$lcssa = 0;
    $79 = _bitshift64Shl($2 | 0, $3 | 0, 1 - $ey$0$lcssa | 0) | 0;
    $86 = $79;
    $87 = tempRet0;
    $ey$1$ph = $ey$0$lcssa;
   } else {
    $86 = $2;
    $87 = $3 & 1048575 | 1048576;
    $ey$1$ph = $9;
   }
   $88 = _i64Subtract($84 | 0, $85 | 0, $86 | 0, $87 | 0) | 0;
   $89 = tempRet0;
   $94 = ($89 | 0) > -1 | ($89 | 0) == -1 & $88 >>> 0 > 4294967295;
   L23 : do if (($ex$1 | 0) > ($ey$1$ph | 0)) {
    $153 = $94;
    $154 = $88;
    $155 = $89;
    $95 = $84;
    $97 = $85;
    $ex$212 = $ex$1;
    while (1) {
     if ($153) if (($95 | 0) == ($86 | 0) & ($97 | 0) == ($87 | 0)) break; else {
      $101 = $154;
      $102 = $155;
     } else {
      $101 = $95;
      $102 = $97;
     }
     $103 = _bitshift64Shl($101 | 0, $102 | 0, 1) | 0;
     $104 = tempRet0;
     $105 = $ex$212 + -1 | 0;
     $107 = _i64Subtract($103 | 0, $104 | 0, $86 | 0, $87 | 0) | 0;
     $108 = tempRet0;
     $113 = ($108 | 0) > -1 | ($108 | 0) == -1 & $107 >>> 0 > 4294967295;
     if (($105 | 0) > ($ey$1$ph | 0)) {
      $153 = $113;
      $154 = $107;
      $155 = $108;
      $95 = $103;
      $97 = $104;
      $ex$212 = $105;
     } else {
      $$lcssa7 = $113;
      $114 = $103;
      $116 = $104;
      $156 = $107;
      $157 = $108;
      $ex$2$lcssa = $105;
      break L23;
     }
    }
    $$0 = $x * 0.0;
    break L1;
   } else {
    $$lcssa7 = $94;
    $114 = $84;
    $116 = $85;
    $156 = $88;
    $157 = $89;
    $ex$2$lcssa = $ex$1;
   } while (0);
   if ($$lcssa7) if (($114 | 0) == ($86 | 0) & ($116 | 0) == ($87 | 0)) {
    $$0 = $x * 0.0;
    break;
   } else {
    $119 = $157;
    $121 = $156;
   } else {
    $119 = $116;
    $121 = $114;
   }
   if ($119 >>> 0 < 1048576 | ($119 | 0) == 1048576 & $121 >>> 0 < 0) {
    $127 = $121;
    $128 = $119;
    $ex$39 = $ex$2$lcssa;
    while (1) {
     $129 = _bitshift64Shl($127 | 0, $128 | 0, 1) | 0;
     $130 = tempRet0;
     $131 = $ex$39 + -1 | 0;
     if ($130 >>> 0 < 1048576 | ($130 | 0) == 1048576 & $129 >>> 0 < 0) {
      $127 = $129;
      $128 = $130;
      $ex$39 = $131;
     } else {
      $138 = $129;
      $139 = $130;
      $ex$3$lcssa = $131;
      break;
     }
    }
   } else {
    $138 = $121;
    $139 = $119;
    $ex$3$lcssa = $ex$2$lcssa;
   }
   if (($ex$3$lcssa | 0) > 0) {
    $140 = _i64Add($138 | 0, $139 | 0, 0, -1048576) | 0;
    $141 = tempRet0;
    $142 = _bitshift64Shl($ex$3$lcssa | 0, 0, 52) | 0;
    $150 = $141 | tempRet0;
    $151 = $140 | $142;
   } else {
    $147 = _bitshift64Lshr($138 | 0, $139 | 0, 1 - $ex$3$lcssa | 0) | 0;
    $150 = tempRet0;
    $151 = $147;
   }
   HEAP32[tempDoublePtr >> 2] = $151;
   HEAP32[tempDoublePtr + 4 >> 2] = $150 | $10;
   $$0 = +HEAPF64[tempDoublePtr >> 3];
  }
 } while (0);
 if ((label | 0) == 3) {
  $24 = $x * $y;
  $$0 = $24 / $24;
 }
 return +$$0;
}

function __ZNSt3__26__treeINS_12__value_typeINS_12basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEEN8nlohmann10basic_jsonINS_3mapENS_6vectorES7_bxydS5_NS8_14adl_serializerEEEEENS_19__map_value_compareIS7_SE_NS_4lessIS7_EELb1EEENS5_ISE_EEE12__find_equalIS7_EERPNS_16__tree_node_baseIPvEENS_21__tree_const_iteratorISE_PNS_11__tree_nodeISE_SN_EEiEESQ_RKT_($this, $__hint, $__parent, $__v) {
 $this = $this | 0;
 $__hint = $__hint | 0;
 $__parent = $__parent | 0;
 $__v = $__v | 0;
 var $$0$i$i = 0, $$0$i$i$i = 0, $$0$i$i$i$i$i = 0, $$0$i$i$i$i$i$i = 0, $$01$i$i = 0, $$01$i$i$i$i$i = 0, $$2 = 0, $0 = 0, $1 = 0, $100 = 0, $102 = 0, $108 = 0, $11 = 0, $13 = 0, $14 = 0, $18 = 0, $19 = 0, $20 = 0, $26 = 0, $3 = 0, $32 = 0, $35 = 0, $38 = 0, $4 = 0, $41 = 0, $42 = 0, $44 = 0, $45 = 0, $49 = 0, $51 = 0, $52 = 0, $56 = 0, $58 = 0, $6 = 0, $64 = 0, $7 = 0, $70 = 0, $74 = 0, $80 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $89 = 0, $93 = 0, $95 = 0, $96 = 0, $__prior$sroa$0$0 = 0, label = 0;
 label = 0;
 $0 = $this + 4 | 0;
 $1 = HEAP32[$__hint >> 2] | 0;
 $3 = $1;
 do if (($1 | 0) != ($0 | 0)) {
  $4 = $1 + 16 | 0;
  $6 = HEAP8[$__v + 11 >> 0] | 0;
  $7 = $6 << 24 >> 24 < 0;
  $11 = $7 ? HEAP32[$__v + 4 >> 2] | 0 : $6 & 255;
  $13 = HEAP8[$4 + 11 >> 0] | 0;
  $14 = $13 << 24 >> 24 < 0;
  $18 = $14 ? HEAP32[$1 + 20 >> 2] | 0 : $13 & 255;
  $19 = $18 >>> 0 < $11 >>> 0;
  $20 = $19 ? $18 : $11;
  if (!$20) label = 4; else {
   $26 = _memcmp($7 ? HEAP32[$__v >> 2] | 0 : $__v, $14 ? HEAP32[$4 >> 2] | 0 : $4, $20) | 0;
   if (!$26) label = 4; else if (($26 | 0) < 0) break;
  }
  if ((label | 0) == 4) if ($11 >>> 0 < $18 >>> 0) break;
  $74 = $11 >>> 0 < $18 >>> 0 ? $11 : $18;
  if (!$74) label = 20; else {
   $80 = _memcmp($14 ? HEAP32[$4 >> 2] | 0 : $4, $7 ? HEAP32[$__v >> 2] | 0 : $__v, $74) | 0;
   if (!$80) label = 20; else if (($80 | 0) >= 0) label = 34;
  }
  if ((label | 0) == 20) if (!$19) label = 34;
  if ((label | 0) == 34) {
   HEAP32[$__parent >> 2] = $3;
   $$2 = $__parent;
   return $$2 | 0;
  }
  $83 = $1 + 4 | 0;
  $84 = HEAP32[$83 >> 2] | 0;
  $85 = ($84 | 0) == 0;
  if ($85) {
   $$0$i$i$i$i$i = $1;
   while (1) {
    $89 = HEAP32[$$0$i$i$i$i$i + 8 >> 2] | 0;
    if ((HEAP32[$89 >> 2] | 0) == ($$0$i$i$i$i$i | 0)) {
     $$01$i$i$i$i$i = $89;
     break;
    } else $$0$i$i$i$i$i = $89;
   }
  } else {
   $$0$i$i$i$i$i$i = $84;
   while (1) {
    $86 = HEAP32[$$0$i$i$i$i$i$i >> 2] | 0;
    if (!$86) {
     $$01$i$i$i$i$i = $$0$i$i$i$i$i$i;
     break;
    } else $$0$i$i$i$i$i$i = $86;
   }
  }
  do if (($$01$i$i$i$i$i | 0) != ($0 | 0)) {
   $93 = $$01$i$i$i$i$i + 16 | 0;
   $95 = HEAP8[$93 + 11 >> 0] | 0;
   $96 = $95 << 24 >> 24 < 0;
   $100 = $96 ? HEAP32[$$01$i$i$i$i$i + 20 >> 2] | 0 : $95 & 255;
   $102 = $100 >>> 0 < $11 >>> 0 ? $100 : $11;
   if (!$102) label = 28; else {
    $108 = _memcmp($7 ? HEAP32[$__v >> 2] | 0 : $__v, $96 ? HEAP32[$93 >> 2] | 0 : $93, $102) | 0;
    if (!$108) label = 28; else if (($108 | 0) < 0) break;
   }
   if ((label | 0) == 28) if ($11 >>> 0 < $100 >>> 0) break;
   $$2 = __ZNSt3__26__treeINS_12__value_typeINS_12basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEEN8nlohmann10basic_jsonINS_3mapENS_6vectorES7_bxydS5_NS8_14adl_serializerEEEEENS_19__map_value_compareIS7_SE_NS_4lessIS7_EELb1EEENS5_ISE_EEE12__find_equalIS7_EERPNS_16__tree_node_baseIPvEESQ_RKT_($this, $__parent, $__v) | 0;
   return $$2 | 0;
  } while (0);
  if ($85) {
   HEAP32[$__parent >> 2] = $1;
   $$2 = $83;
   return $$2 | 0;
  } else {
   HEAP32[$__parent >> 2] = $$01$i$i$i$i$i;
   $$2 = $$01$i$i$i$i$i;
   return $$2 | 0;
  }
 } while (0);
 do if (($1 | 0) == (HEAP32[$this >> 2] | 0)) $__prior$sroa$0$0 = $3; else {
  $32 = HEAP32[$1 >> 2] | 0;
  if (!$32) {
   $$0$i$i = $1;
   while (1) {
    $38 = HEAP32[$$0$i$i + 8 >> 2] | 0;
    if ((HEAP32[$38 >> 2] | 0) == ($$0$i$i | 0)) $$0$i$i = $38; else {
     $$01$i$i = $38;
     break;
    }
   }
  } else {
   $$0$i$i$i = $32;
   while (1) {
    $35 = HEAP32[$$0$i$i$i + 4 >> 2] | 0;
    if (!$35) {
     $$01$i$i = $$0$i$i$i;
     break;
    } else $$0$i$i$i = $35;
   }
  }
  $41 = $$01$i$i;
  $42 = $$01$i$i + 16 | 0;
  $44 = HEAP8[$42 + 11 >> 0] | 0;
  $45 = $44 << 24 >> 24 < 0;
  $49 = $45 ? HEAP32[$$01$i$i + 20 >> 2] | 0 : $44 & 255;
  $51 = HEAP8[$__v + 11 >> 0] | 0;
  $52 = $51 << 24 >> 24 < 0;
  $56 = $52 ? HEAP32[$__v + 4 >> 2] | 0 : $51 & 255;
  $58 = $56 >>> 0 < $49 >>> 0 ? $56 : $49;
  if (!$58) label = 12; else {
   $64 = _memcmp($45 ? HEAP32[$42 >> 2] | 0 : $42, $52 ? HEAP32[$__v >> 2] | 0 : $__v, $58) | 0;
   if (!$64) label = 12; else if (($64 | 0) < 0) {
    $__prior$sroa$0$0 = $41;
    break;
   }
  }
  if ((label | 0) == 12) if ($49 >>> 0 < $56 >>> 0) {
   $__prior$sroa$0$0 = $41;
   break;
  }
  $$2 = __ZNSt3__26__treeINS_12__value_typeINS_12basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEEN8nlohmann10basic_jsonINS_3mapENS_6vectorES7_bxydS5_NS8_14adl_serializerEEEEENS_19__map_value_compareIS7_SE_NS_4lessIS7_EELb1EEENS5_ISE_EEE12__find_equalIS7_EERPNS_16__tree_node_baseIPvEESQ_RKT_($this, $__parent, $__v) | 0;
  return $$2 | 0;
 } while (0);
 if (!(HEAP32[$1 >> 2] | 0)) {
  HEAP32[$__parent >> 2] = $1;
  $$2 = $1;
  return $$2 | 0;
 } else {
  $70 = $__prior$sroa$0$0;
  HEAP32[$__parent >> 2] = $70;
  $$2 = $70 + 4 | 0;
  return $$2 | 0;
 }
 return 0;
}

function __ZNSt3__2L20utf8_to_utf16_lengthEPKhS1_jmNS_12codecvt_modeE($frm, $frm_end, $mx, $Maxcode, $mode) {
 $frm = $frm | 0;
 $frm_end = $frm_end | 0;
 $mx = $mx | 0;
 $Maxcode = $Maxcode | 0;
 $mode = $mode | 0;
 var $$lcssa = 0, $$lcssa83 = 0, $$lcssa84 = 0, $$lcssa85 = 0, $$lcssa86 = 0, $$lcssa87 = 0, $$pre42 = 0, $116 = 0, $16 = 0, $17 = 0, $28 = 0, $38 = 0, $42 = 0, $44 = 0, $57 = 0, $71 = 0, $77 = 0, $79 = 0, $81 = 0, $93 = 0, $96 = 0, $frm_nxt$1 = 0, $frm_nxt$1$lcssa = 0, $frm_nxt$5 = 0, $nchar16_t$0 = 0, $nchar16_t$2 = 0, label = 0;
 label = 0;
 $$pre42 = $frm_end;
 if (!($mode & 4)) {
  $frm_nxt$1 = $frm;
  $nchar16_t$0 = 0;
 } else if (($$pre42 - $frm | 0) > 2) if ((HEAP8[$frm >> 0] | 0) == -17) if ((HEAP8[$frm + 1 >> 0] | 0) == -69) {
  $frm_nxt$1 = (HEAP8[$frm + 2 >> 0] | 0) == -65 ? $frm + 3 | 0 : $frm;
  $nchar16_t$0 = 0;
 } else {
  $frm_nxt$1 = $frm;
  $nchar16_t$0 = 0;
 } else {
  $frm_nxt$1 = $frm;
  $nchar16_t$0 = 0;
 } else {
  $frm_nxt$1 = $frm;
  $nchar16_t$0 = 0;
 }
 L6 : while (1) {
  if (!($nchar16_t$0 >>> 0 < $mx >>> 0 & $frm_nxt$1 >>> 0 < $frm_end >>> 0)) {
   $frm_nxt$1$lcssa = $frm_nxt$1;
   label = 40;
   break;
  }
  $16 = HEAP8[$frm_nxt$1 >> 0] | 0;
  $17 = $16 & 255;
  if ($17 >>> 0 > $Maxcode >>> 0) {
   $frm_nxt$1$lcssa = $frm_nxt$1;
   label = 40;
   break;
  }
  do if ($16 << 24 >> 24 > -1) {
   $frm_nxt$5 = $frm_nxt$1 + 1 | 0;
   $nchar16_t$2 = $nchar16_t$0;
  } else {
   if (($16 & 255) < 194) {
    $frm_nxt$1$lcssa = $frm_nxt$1;
    label = 40;
    break L6;
   }
   if (($16 & 255) < 224) {
    if (($$pre42 - $frm_nxt$1 | 0) < 2) {
     $frm_nxt$1$lcssa = $frm_nxt$1;
     label = 40;
     break L6;
    }
    $28 = HEAPU8[$frm_nxt$1 + 1 >> 0] | 0;
    if (($28 & 192 | 0) != 128) {
     $frm_nxt$1$lcssa = $frm_nxt$1;
     label = 40;
     break L6;
    }
    if (($28 & 63 | $17 << 6 & 1984) >>> 0 > $Maxcode >>> 0) {
     $frm_nxt$1$lcssa = $frm_nxt$1;
     label = 40;
     break L6;
    } else {
     $frm_nxt$5 = $frm_nxt$1 + 2 | 0;
     $nchar16_t$2 = $nchar16_t$0;
     break;
    }
   }
   if (($16 & 255) < 240) {
    $38 = $frm_nxt$1;
    if (($$pre42 - $38 | 0) < 3) {
     $frm_nxt$1$lcssa = $frm_nxt$1;
     label = 40;
     break L6;
    }
    $42 = HEAP8[$frm_nxt$1 + 1 >> 0] | 0;
    $44 = HEAP8[$frm_nxt$1 + 2 >> 0] | 0;
    switch ($17 | 0) {
    case 224:
     {
      if (($42 & -32) << 24 >> 24 != -96) {
       $$lcssa86 = $38;
       label = 19;
       break L6;
      }
      break;
     }
    case 237:
     {
      if (($42 & -32) << 24 >> 24 != -128) {
       $$lcssa85 = $38;
       label = 21;
       break L6;
      }
      break;
     }
    default:
     if (($42 & -64) << 24 >> 24 != -128) {
      $$lcssa87 = $38;
      label = 23;
      break L6;
     }
    }
    $57 = $44 & 255;
    if (($57 & 192 | 0) != 128) {
     $frm_nxt$1$lcssa = $frm_nxt$1;
     label = 40;
     break L6;
    }
    if ((($42 & 255) << 6 & 4032 | $17 << 12 & 61440 | $57 & 63) >>> 0 > $Maxcode >>> 0) {
     $frm_nxt$1$lcssa = $frm_nxt$1;
     label = 40;
     break L6;
    } else {
     $frm_nxt$5 = $frm_nxt$1 + 3 | 0;
     $nchar16_t$2 = $nchar16_t$0;
     break;
    }
   }
   if (($16 & 255) >= 245) {
    $frm_nxt$1$lcssa = $frm_nxt$1;
    label = 40;
    break L6;
   }
   $71 = $frm_nxt$1;
   if (($mx - $nchar16_t$0 | 0) >>> 0 < 2 | ($$pre42 - $71 | 0) < 4) {
    $frm_nxt$1$lcssa = $frm_nxt$1;
    label = 40;
    break L6;
   }
   $77 = HEAP8[$frm_nxt$1 + 1 >> 0] | 0;
   $79 = HEAP8[$frm_nxt$1 + 2 >> 0] | 0;
   $81 = HEAP8[$frm_nxt$1 + 3 >> 0] | 0;
   switch ($17 | 0) {
   case 240:
    {
     if (($77 + 112 & 255) >= 48) {
      $$lcssa83 = $71;
      label = 30;
      break L6;
     }
     break;
    }
   case 244:
    {
     if (($77 & -16) << 24 >> 24 != -128) {
      $$lcssa = $71;
      label = 32;
      break L6;
     }
     break;
    }
   default:
    if (($77 & -64) << 24 >> 24 != -128) {
     $$lcssa84 = $71;
     label = 34;
     break L6;
    }
   }
   $93 = $79 & 255;
   if (($93 & 192 | 0) != 128) {
    $frm_nxt$1$lcssa = $frm_nxt$1;
    label = 40;
    break L6;
   }
   $96 = $81 & 255;
   if (($96 & 192 | 0) != 128) {
    $frm_nxt$1$lcssa = $frm_nxt$1;
    label = 40;
    break L6;
   }
   if ((($77 & 255) << 12 & 258048 | $17 << 18 & 1835008 | $93 << 6 & 4032 | $96 & 63) >>> 0 > $Maxcode >>> 0) {
    $frm_nxt$1$lcssa = $frm_nxt$1;
    label = 40;
    break L6;
   }
   $frm_nxt$5 = $frm_nxt$1 + 4 | 0;
   $nchar16_t$2 = $nchar16_t$0 + 1 | 0;
  } while (0);
  $frm_nxt$1 = $frm_nxt$5;
  $nchar16_t$0 = $nchar16_t$2 + 1 | 0;
 }
 if ((label | 0) == 19) $116 = $$lcssa86 - $frm | 0; else if ((label | 0) == 21) $116 = $$lcssa85 - $frm | 0; else if ((label | 0) == 23) $116 = $$lcssa87 - $frm | 0; else if ((label | 0) == 30) $116 = $$lcssa83 - $frm | 0; else if ((label | 0) == 32) $116 = $$lcssa - $frm | 0; else if ((label | 0) == 34) $116 = $$lcssa84 - $frm | 0; else if ((label | 0) == 40) $116 = $frm_nxt$1$lcssa - $frm | 0;
 return $116 | 0;
}

function __ZNSt3__2L19utf8_to_ucs4_lengthEPKhS1_jmNS_12codecvt_modeE($frm, $frm_end, $mx, $Maxcode, $mode) {
 $frm = $frm | 0;
 $frm_end = $frm_end | 0;
 $mx = $mx | 0;
 $Maxcode = $Maxcode | 0;
 $mode = $mode | 0;
 var $$37 = 0, $$lcssa = 0, $$lcssa88 = 0, $$lcssa89 = 0, $$lcssa90 = 0, $$lcssa91 = 0, $$lcssa92 = 0, $$pre47 = 0, $16 = 0, $17 = 0, $28 = 0, $38 = 0, $42 = 0, $44 = 0, $57 = 0, $71 = 0, $75 = 0, $77 = 0, $79 = 0, $91 = 0, $94 = 0, $frm_nxt$1 = 0, $frm_nxt$1$lcssa = 0, $frm_nxt$5 = 0, $nchar32_t$0 = 0, label = 0;
 label = 0;
 $$pre47 = $frm_end;
 if (!($mode & 4)) {
  $frm_nxt$1 = $frm;
  $nchar32_t$0 = 0;
 } else if (($$pre47 - $frm | 0) > 2) if ((HEAP8[$frm >> 0] | 0) == -17) if ((HEAP8[$frm + 1 >> 0] | 0) == -69) {
  $frm_nxt$1 = (HEAP8[$frm + 2 >> 0] | 0) == -65 ? $frm + 3 | 0 : $frm;
  $nchar32_t$0 = 0;
 } else {
  $frm_nxt$1 = $frm;
  $nchar32_t$0 = 0;
 } else {
  $frm_nxt$1 = $frm;
  $nchar32_t$0 = 0;
 } else {
  $frm_nxt$1 = $frm;
  $nchar32_t$0 = 0;
 }
 L6 : while (1) {
  if (!($nchar32_t$0 >>> 0 < $mx >>> 0 & $frm_nxt$1 >>> 0 < $frm_end >>> 0)) {
   $frm_nxt$1$lcssa = $frm_nxt$1;
   label = 40;
   break;
  }
  $16 = HEAP8[$frm_nxt$1 >> 0] | 0;
  $17 = $16 & 255;
  do if ($16 << 24 >> 24 > -1) {
   if ($17 >>> 0 > $Maxcode >>> 0) {
    $frm_nxt$1$lcssa = $frm_nxt$1;
    label = 40;
    break L6;
   }
   $frm_nxt$5 = $frm_nxt$1 + 1 | 0;
  } else {
   if (($16 & 255) < 194) {
    $frm_nxt$1$lcssa = $frm_nxt$1;
    label = 40;
    break L6;
   }
   if (($16 & 255) < 224) {
    if (($$pre47 - $frm_nxt$1 | 0) < 2) {
     $frm_nxt$1$lcssa = $frm_nxt$1;
     label = 40;
     break L6;
    }
    $28 = HEAPU8[$frm_nxt$1 + 1 >> 0] | 0;
    if (($28 & 192 | 0) != 128) {
     $frm_nxt$1$lcssa = $frm_nxt$1;
     label = 40;
     break L6;
    }
    if (($28 & 63 | $17 << 6 & 1984) >>> 0 > $Maxcode >>> 0) {
     $frm_nxt$1$lcssa = $frm_nxt$1;
     label = 40;
     break L6;
    }
    $frm_nxt$5 = $frm_nxt$1 + 2 | 0;
    break;
   }
   if (($16 & 255) < 240) {
    $38 = $frm_nxt$1;
    if (($$pre47 - $38 | 0) < 3) {
     $frm_nxt$1$lcssa = $frm_nxt$1;
     label = 40;
     break L6;
    }
    $42 = HEAP8[$frm_nxt$1 + 1 >> 0] | 0;
    $44 = HEAP8[$frm_nxt$1 + 2 >> 0] | 0;
    switch ($17 | 0) {
    case 224:
     {
      if (($42 & -32) << 24 >> 24 != -96) {
       $$lcssa91 = $38;
       label = 20;
       break L6;
      }
      break;
     }
    case 237:
     {
      if (($42 & -32) << 24 >> 24 != -128) {
       $$lcssa90 = $38;
       label = 22;
       break L6;
      }
      break;
     }
    default:
     if (($42 & -64) << 24 >> 24 != -128) {
      $$lcssa92 = $38;
      label = 24;
      break L6;
     }
    }
    $57 = $44 & 255;
    if (($57 & 192 | 0) != 128) {
     $frm_nxt$1$lcssa = $frm_nxt$1;
     label = 40;
     break L6;
    }
    if ((($42 & 255) << 6 & 4032 | $17 << 12 & 61440 | $57 & 63) >>> 0 > $Maxcode >>> 0) {
     $frm_nxt$1$lcssa = $frm_nxt$1;
     label = 40;
     break L6;
    } else {
     $frm_nxt$5 = $frm_nxt$1 + 3 | 0;
     break;
    }
   }
   if (($16 & 255) >= 245) {
    $frm_nxt$1$lcssa = $frm_nxt$1;
    label = 40;
    break L6;
   }
   $71 = $frm_nxt$1;
   if (($$pre47 - $71 | 0) < 4) {
    $frm_nxt$1$lcssa = $frm_nxt$1;
    label = 40;
    break L6;
   }
   $75 = HEAP8[$frm_nxt$1 + 1 >> 0] | 0;
   $77 = HEAP8[$frm_nxt$1 + 2 >> 0] | 0;
   $79 = HEAP8[$frm_nxt$1 + 3 >> 0] | 0;
   switch ($17 | 0) {
   case 240:
    {
     if (($75 + 112 & 255) >= 48) {
      $$lcssa88 = $71;
      label = 31;
      break L6;
     }
     break;
    }
   case 244:
    {
     if (($75 & -16) << 24 >> 24 != -128) {
      $$lcssa = $71;
      label = 33;
      break L6;
     }
     break;
    }
   default:
    if (($75 & -64) << 24 >> 24 != -128) {
     $$lcssa89 = $71;
     label = 35;
     break L6;
    }
   }
   $91 = $77 & 255;
   if (($91 & 192 | 0) != 128) {
    $frm_nxt$1$lcssa = $frm_nxt$1;
    label = 40;
    break L6;
   }
   $94 = $79 & 255;
   if (($94 & 192 | 0) != 128) {
    $frm_nxt$1$lcssa = $frm_nxt$1;
    label = 40;
    break L6;
   }
   if ((($75 & 255) << 12 & 258048 | $17 << 18 & 1835008 | $91 << 6 & 4032 | $94 & 63) >>> 0 > $Maxcode >>> 0) {
    $frm_nxt$1$lcssa = $frm_nxt$1;
    label = 40;
    break L6;
   } else $frm_nxt$5 = $frm_nxt$1 + 4 | 0;
  } while (0);
  $frm_nxt$1 = $frm_nxt$5;
  $nchar32_t$0 = $nchar32_t$0 + 1 | 0;
 }
 if ((label | 0) == 20) $$37 = $$lcssa91 - $frm | 0; else if ((label | 0) == 22) $$37 = $$lcssa90 - $frm | 0; else if ((label | 0) == 24) $$37 = $$lcssa92 - $frm | 0; else if ((label | 0) == 31) $$37 = $$lcssa88 - $frm | 0; else if ((label | 0) == 33) $$37 = $$lcssa - $frm | 0; else if ((label | 0) == 35) $$37 = $$lcssa89 - $frm | 0; else if ((label | 0) == 40) $$37 = $frm_nxt$1$lcssa - $frm | 0;
 return $$37 | 0;
}

function __ZNSt3__227__tree_balance_after_insertIPNS_16__tree_node_baseIPvEEEEvT_S5_($__root, $__x) {
 $__root = $__root | 0;
 $__x = $__x | 0;
 var $$010 = 0, $$010$lcssa59 = 0, $$010$lcssa60 = 0, $$lcssa = 0, $$lcssa61 = 0, $$lcssa62 = 0, $$lcssa63 = 0, $$lcssa64 = 0, $$lcssa65 = 0, $$lcssa66 = 0, $$lcssa67 = 0, $$lcssa68 = 0, $$lcssa69 = 0, $0 = 0, $10 = 0, $13 = 0, $15 = 0, $25 = 0, $26 = 0, $27 = 0, $30 = 0, $31 = 0, $32 = 0, $37 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $45 = 0, $48 = 0, $5 = 0, $53 = 0, $62 = 0, $63 = 0, $64 = 0, $67 = 0, $68 = 0, $69 = 0, $74 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $82 = 0, $85 = 0, label = 0, $$010$looptemp = 0;
 label = 0;
 $0 = ($__x | 0) == ($__root | 0);
 HEAP8[$__x + 12 >> 0] = $0 & 1;
 if ($0) return; else $$010 = $__x;
 while (1) {
  $4 = HEAP32[$$010 + 8 >> 2] | 0;
  $5 = $4 + 12 | 0;
  if (HEAP8[$5 >> 0] | 0) {
   label = 37;
   break;
  }
  $8 = $4 + 8 | 0;
  $$010$looptemp = $$010;
  $$010 = HEAP32[$8 >> 2] | 0;
  $10 = HEAP32[$$010 >> 2] | 0;
  if (($10 | 0) == ($4 | 0)) {
   $13 = HEAP32[$$010 + 4 >> 2] | 0;
   if (!$13) {
    $$010$lcssa60 = $$010$looptemp;
    $$lcssa62 = $4;
    $$lcssa63 = $8;
    $$lcssa65 = $8;
    $$lcssa67 = $$010;
    $$lcssa69 = $$010;
    label = 8;
    break;
   }
   $15 = $13 + 12 | 0;
   if (HEAP8[$15 >> 0] | 0) {
    $$010$lcssa60 = $$010$looptemp;
    $$lcssa62 = $4;
    $$lcssa63 = $8;
    $$lcssa65 = $8;
    $$lcssa67 = $$010;
    $$lcssa69 = $$010;
    label = 8;
    break;
   }
   HEAP8[$5 >> 0] = 1;
   HEAP8[$$010 + 12 >> 0] = ($$010 | 0) == ($__root | 0) & 1;
   HEAP8[$15 >> 0] = 1;
  } else {
   if (!$10) {
    $$010$lcssa59 = $$010$looptemp;
    $$lcssa = $8;
    $$lcssa61 = $4;
    $$lcssa64 = $8;
    $$lcssa66 = $$010;
    $$lcssa68 = $$010;
    label = 24;
    break;
   }
   $53 = $10 + 12 | 0;
   if (HEAP8[$53 >> 0] | 0) {
    $$010$lcssa59 = $$010$looptemp;
    $$lcssa = $8;
    $$lcssa61 = $4;
    $$lcssa64 = $8;
    $$lcssa66 = $$010;
    $$lcssa68 = $$010;
    label = 24;
    break;
   }
   HEAP8[$5 >> 0] = 1;
   HEAP8[$$010 + 12 >> 0] = ($$010 | 0) == ($__root | 0) & 1;
   HEAP8[$53 >> 0] = 1;
  }
  if (($$010 | 0) == ($__root | 0)) {
   label = 37;
   break;
  }
 }
 if ((label | 0) == 8) {
  if ((HEAP32[$$lcssa62 >> 2] | 0) == ($$010$lcssa60 | 0)) {
   $37 = $$lcssa62;
   $39 = $$lcssa69;
  } else {
   $25 = $$lcssa62 + 4 | 0;
   $26 = HEAP32[$25 >> 2] | 0;
   $27 = HEAP32[$26 >> 2] | 0;
   HEAP32[$25 >> 2] = $27;
   if (!$27) $31 = $$lcssa67; else {
    HEAP32[$27 + 8 >> 2] = $$lcssa62;
    $31 = HEAP32[$$lcssa63 >> 2] | 0;
   }
   $30 = $26 + 8 | 0;
   HEAP32[$30 >> 2] = $31;
   $32 = HEAP32[$$lcssa65 >> 2] | 0;
   if ((HEAP32[$32 >> 2] | 0) == ($$lcssa62 | 0)) HEAP32[$32 >> 2] = $26; else HEAP32[$32 + 4 >> 2] = $26;
   HEAP32[$26 >> 2] = $$lcssa62;
   HEAP32[$$lcssa63 >> 2] = $26;
   $37 = $26;
   $39 = HEAP32[$30 >> 2] | 0;
  }
  HEAP8[$37 + 12 >> 0] = 1;
  HEAP8[$39 + 12 >> 0] = 0;
  $40 = HEAP32[$39 >> 2] | 0;
  $41 = $40 + 4 | 0;
  $42 = HEAP32[$41 >> 2] | 0;
  HEAP32[$39 >> 2] = $42;
  if ($42 | 0) HEAP32[$42 + 8 >> 2] = $39;
  $45 = $39 + 8 | 0;
  HEAP32[$40 + 8 >> 2] = HEAP32[$45 >> 2];
  $48 = HEAP32[$45 >> 2] | 0;
  if ((HEAP32[$48 >> 2] | 0) == ($39 | 0)) HEAP32[$48 >> 2] = $40; else HEAP32[$48 + 4 >> 2] = $40;
  HEAP32[$41 >> 2] = $39;
  HEAP32[$45 >> 2] = $40;
  return;
 } else if ((label | 0) == 24) {
  if ((HEAP32[$$lcssa61 >> 2] | 0) == ($$010$lcssa59 | 0)) {
   $62 = HEAP32[$$lcssa61 >> 2] | 0;
   $63 = $62 + 4 | 0;
   $64 = HEAP32[$63 >> 2] | 0;
   HEAP32[$$lcssa61 >> 2] = $64;
   if (!$64) $68 = $$lcssa66; else {
    HEAP32[$64 + 8 >> 2] = $$lcssa61;
    $68 = HEAP32[$$lcssa >> 2] | 0;
   }
   $67 = $62 + 8 | 0;
   HEAP32[$67 >> 2] = $68;
   $69 = HEAP32[$$lcssa64 >> 2] | 0;
   if ((HEAP32[$69 >> 2] | 0) == ($$lcssa61 | 0)) HEAP32[$69 >> 2] = $62; else HEAP32[$69 + 4 >> 2] = $62;
   HEAP32[$63 >> 2] = $$lcssa61;
   HEAP32[$$lcssa >> 2] = $62;
   $74 = $62;
   $76 = HEAP32[$67 >> 2] | 0;
  } else {
   $74 = $$lcssa61;
   $76 = $$lcssa68;
  }
  HEAP8[$74 + 12 >> 0] = 1;
  HEAP8[$76 + 12 >> 0] = 0;
  $77 = $76 + 4 | 0;
  $78 = HEAP32[$77 >> 2] | 0;
  $79 = HEAP32[$78 >> 2] | 0;
  HEAP32[$77 >> 2] = $79;
  if ($79 | 0) HEAP32[$79 + 8 >> 2] = $76;
  $82 = $76 + 8 | 0;
  HEAP32[$78 + 8 >> 2] = HEAP32[$82 >> 2];
  $85 = HEAP32[$82 >> 2] | 0;
  if ((HEAP32[$85 >> 2] | 0) == ($76 | 0)) HEAP32[$85 >> 2] = $78; else HEAP32[$85 + 4 >> 2] = $78;
  HEAP32[$78 >> 2] = $76;
  HEAP32[$82 >> 2] = $78;
  return;
 } else if ((label | 0) == 37) return;
}

function __ZNSt3__2L13utf8_to_utf16EPKhS1_RS1_PtS3_RS3_mNS_12codecvt_modeE($frm, $frm_end, $frm_nxt, $to, $to_end, $to_nxt, $Maxcode, $mode) {
 $frm = $frm | 0;
 $frm_end = $frm_end | 0;
 $frm_nxt = $frm_nxt | 0;
 $to = $to | 0;
 $to_end = $to_end | 0;
 $to_nxt = $to_nxt | 0;
 $Maxcode = $Maxcode | 0;
 $mode = $mode | 0;
 var $$8 = 0, $$lcssa = 0, $$pre$phiZ2D = 0, $102 = 0, $105 = 0, $126 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $21 = 0, $22 = 0, $3 = 0, $34 = 0, $40 = 0, $49 = 0, $51 = 0, $58 = 0, $67 = 0, $77 = 0, $79 = 0, $81 = 0, $87 = 0, $90 = 0, $96 = 0, $98 = 0, label = 0;
 label = 0;
 HEAP32[$frm_nxt >> 2] = $frm;
 HEAP32[$to_nxt >> 2] = $to;
 if (!($mode & 4)) $$pre$phiZ2D = $frm_end; else {
  $2 = HEAP32[$frm_nxt >> 2] | 0;
  $3 = $frm_end;
  if (($3 - $2 | 0) > 2) if ((HEAP8[$2 >> 0] | 0) == -17) if ((HEAP8[$2 + 1 >> 0] | 0) == -69) if ((HEAP8[$2 + 2 >> 0] | 0) == -65) {
   HEAP32[$frm_nxt >> 2] = $2 + 3;
   $$pre$phiZ2D = $3;
  } else $$pre$phiZ2D = $3; else $$pre$phiZ2D = $3; else $$pre$phiZ2D = $3; else $$pre$phiZ2D = $3;
 }
 $16 = $to_end;
 L9 : while (1) {
  $17 = HEAP32[$frm_nxt >> 2] | 0;
  $18 = $17 >>> 0 < $frm_end >>> 0;
  if (!$18) {
   $$lcssa = $18;
   label = 41;
   break;
  }
  $19 = HEAP32[$to_nxt >> 2] | 0;
  if ($19 >>> 0 >= $to_end >>> 0) {
   $$lcssa = $18;
   label = 41;
   break;
  }
  $21 = HEAP8[$17 >> 0] | 0;
  $22 = $21 & 255;
  if ($22 >>> 0 > $Maxcode >>> 0) {
   $$8 = 2;
   break;
  }
  do if ($21 << 24 >> 24 > -1) {
   HEAP16[$19 >> 1] = $21 & 255;
   HEAP32[$frm_nxt >> 2] = $17 + 1;
  } else {
   if (($21 & 255) < 194) {
    $$8 = 2;
    break L9;
   }
   if (($21 & 255) < 224) {
    if (($$pre$phiZ2D - $17 | 0) < 2) {
     $$8 = 1;
     break L9;
    }
    $34 = HEAPU8[$17 + 1 >> 0] | 0;
    if (($34 & 192 | 0) != 128) {
     $$8 = 2;
     break L9;
    }
    $40 = $34 & 63 | $22 << 6 & 1984;
    if ($40 >>> 0 > $Maxcode >>> 0) {
     $$8 = 2;
     break L9;
    }
    HEAP16[$19 >> 1] = $40;
    HEAP32[$frm_nxt >> 2] = $17 + 2;
    break;
   }
   if (($21 & 255) < 240) {
    if (($$pre$phiZ2D - $17 | 0) < 3) {
     $$8 = 1;
     break L9;
    }
    $49 = HEAP8[$17 + 1 >> 0] | 0;
    $51 = HEAP8[$17 + 2 >> 0] | 0;
    switch ($22 | 0) {
    case 224:
     {
      if (($49 & -32) << 24 >> 24 != -96) {
       $$8 = 2;
       break L9;
      }
      break;
     }
    case 237:
     {
      if (($49 & -32) << 24 >> 24 != -128) {
       $$8 = 2;
       break L9;
      }
      break;
     }
    default:
     if (($49 & -64) << 24 >> 24 != -128) {
      $$8 = 2;
      break L9;
     }
    }
    $58 = $51 & 255;
    if (($58 & 192 | 0) != 128) {
     $$8 = 2;
     break L9;
    }
    $67 = ($49 & 255) << 6 & 4032 | $22 << 12 | $58 & 63;
    if (($67 & 65535) >>> 0 > $Maxcode >>> 0) {
     $$8 = 2;
     break L9;
    }
    HEAP16[$19 >> 1] = $67;
    HEAP32[$frm_nxt >> 2] = $17 + 3;
    break;
   }
   if (($21 & 255) >= 245) {
    $$8 = 2;
    break L9;
   }
   if (($$pre$phiZ2D - $17 | 0) < 4) {
    $$8 = 1;
    break L9;
   }
   $77 = HEAP8[$17 + 1 >> 0] | 0;
   $79 = HEAP8[$17 + 2 >> 0] | 0;
   $81 = HEAP8[$17 + 3 >> 0] | 0;
   switch ($22 | 0) {
   case 240:
    {
     if (($77 + 112 & 255) >= 48) {
      $$8 = 2;
      break L9;
     }
     break;
    }
   case 244:
    {
     if (($77 & -16) << 24 >> 24 != -128) {
      $$8 = 2;
      break L9;
     }
     break;
    }
   default:
    if (($77 & -64) << 24 >> 24 != -128) {
     $$8 = 2;
     break L9;
    }
   }
   $87 = $79 & 255;
   if (($87 & 192 | 0) != 128) {
    $$8 = 2;
    break L9;
   }
   $90 = $81 & 255;
   if (($90 & 192 | 0) != 128) {
    $$8 = 2;
    break L9;
   }
   if (($16 - $19 | 0) < 4) {
    $$8 = 1;
    break L9;
   }
   $96 = $22 & 7;
   $98 = $77 & 255;
   $102 = $87 << 6;
   $105 = $90 & 63;
   if (($98 << 12 & 258048 | $96 << 18 | $102 & 4032 | $105) >>> 0 > $Maxcode >>> 0) {
    $$8 = 2;
    break L9;
   }
   HEAP16[$19 >> 1] = $98 << 2 & 60 | $87 >>> 4 & 3 | (($98 >>> 4 & 3 | $96 << 2) << 6) + 16320 | 55296;
   $126 = $19 + 2 | 0;
   HEAP32[$to_nxt >> 2] = $126;
   HEAP16[$126 >> 1] = $105 | $102 & 960 | 56320;
   HEAP32[$frm_nxt >> 2] = (HEAP32[$frm_nxt >> 2] | 0) + 4;
  } while (0);
  HEAP32[$to_nxt >> 2] = (HEAP32[$to_nxt >> 2] | 0) + 2;
 }
 if ((label | 0) == 41) $$8 = $$lcssa & 1;
 return $$8 | 0;
}

function __ZNKSt3__27codecvtIwc11__mbstate_tE5do_inERS1_PKcS5_RS5_PwS7_RS7_($this, $st, $frm, $frm_end, $frm_nxt, $to, $to_end, $to_nxt) {
 $this = $this | 0;
 $st = $st | 0;
 $frm = $frm | 0;
 $frm_end = $frm_end | 0;
 $frm_nxt = $frm_nxt | 0;
 $to = $to | 0;
 $to_end = $to_end | 0;
 $to_nxt = $to_nxt | 0;
 var $$02 = 0, $$02$lcssa75 = 0, $$05 = 0, $$05$lcssa72 = 0, $$1$ph = 0, $$13 = 0, $$13$lcssa = 0, $$13$lcssa70 = 0, $$13$lcssa71 = 0, $$2 = 0, $$24 = 0, $$lcssa = 0, $$pre = 0, $13 = 0, $14 = 0, $18 = 0, $25 = 0, $26 = 0, $34 = 0, $35 = 0, $4 = 0, $43 = 0, $47 = 0, $48 = 0, $5 = 0, $54 = 0, $59 = 0, $61 = 0, $62 = 0, $8 = 0, $fend$0 = 0, $fend$0$lcssa = 0, $fend$1 = 0, $fend$2 = 0, $fend$2$lcssa = 0, $fend$4$ph = 0, $save_state = 0, $storemerge = 0, label = 0, sp = 0;
 label = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16 | 0;
 $save_state = sp;
 $fend$0 = $frm;
 while (1) {
  if (($fend$0 | 0) == ($frm_end | 0)) {
   $fend$0$lcssa = $frm_end;
   break;
  }
  if (!(HEAP8[$fend$0 >> 0] | 0)) {
   $fend$0$lcssa = $fend$0;
   break;
  }
  $fend$0 = $fend$0 + 1 | 0;
 }
 HEAP32[$to_nxt >> 2] = $to;
 HEAP32[$frm_nxt >> 2] = $frm;
 $4 = $to_end;
 $5 = $this + 8 | 0;
 $$02 = $frm;
 $$05 = $to;
 $fend$1 = $fend$0$lcssa;
 while (1) {
  if (($$05 | 0) == ($to_end | 0) | ($$02 | 0) == ($frm_end | 0)) {
   $59 = $$02;
   label = 34;
   break;
  }
  $8 = $st;
  $13 = HEAP32[$8 + 4 >> 2] | 0;
  $14 = $save_state;
  HEAP32[$14 >> 2] = HEAP32[$8 >> 2];
  HEAP32[$14 + 4 >> 2] = $13;
  $18 = $fend$1;
  $25 = _uselocale(HEAP32[$5 >> 2] | 0) | 0;
  $26 = _mbsnrtowcs($$05, $frm_nxt, $18 - $$02 | 0, $4 - $$05 >> 2, $st) | 0;
  if ($25 | 0) _uselocale($25) | 0;
  if (($26 | 0) == -1) {
   $$02$lcssa75 = $$02;
   $$05$lcssa72 = $$05;
   $$lcssa = $18;
   label = 10;
   break;
  }
  $43 = (HEAP32[$to_nxt >> 2] | 0) + ($26 << 2) | 0;
  HEAP32[$to_nxt >> 2] = $43;
  if (($43 | 0) == ($to_end | 0)) {
   label = 31;
   break;
  }
  $$pre = HEAP32[$frm_nxt >> 2] | 0;
  if (($fend$1 | 0) == ($frm_end | 0)) {
   $61 = $43;
   $62 = $$pre;
   $fend$4$ph = $frm_end;
  } else {
   $47 = _uselocale(HEAP32[$5 >> 2] | 0) | 0;
   $48 = _mbrtowc($43, $$pre, 1, $st) | 0;
   if ($47 | 0) _uselocale($47) | 0;
   if ($48 | 0) {
    $$1$ph = 2;
    label = 30;
    break;
   }
   HEAP32[$to_nxt >> 2] = (HEAP32[$to_nxt >> 2] | 0) + 4;
   $54 = (HEAP32[$frm_nxt >> 2] | 0) + 1 | 0;
   HEAP32[$frm_nxt >> 2] = $54;
   $fend$2 = $54;
   while (1) {
    if (($fend$2 | 0) == ($frm_end | 0)) {
     $fend$2$lcssa = $frm_end;
     break;
    }
    if (!(HEAP8[$fend$2 >> 0] | 0)) {
     $fend$2$lcssa = $fend$2;
     break;
    }
    $fend$2 = $fend$2 + 1 | 0;
   }
   $61 = HEAP32[$to_nxt >> 2] | 0;
   $62 = $54;
   $fend$4$ph = $fend$2$lcssa;
  }
  $$02 = $62;
  $$05 = $61;
  $fend$1 = $fend$4$ph;
 }
 do if ((label | 0) == 10) {
  $$13 = $$02$lcssa75;
  $storemerge = $$05$lcssa72;
  L29 : while (1) {
   HEAP32[$to_nxt >> 2] = $storemerge;
   if (($$13 | 0) == (HEAP32[$frm_nxt >> 2] | 0)) {
    $$13$lcssa = $$13;
    label = 20;
    break;
   }
   $34 = _uselocale(HEAP32[$5 >> 2] | 0) | 0;
   $35 = _mbrtowc($storemerge, $$13, $$lcssa - $$13 | 0, $save_state) | 0;
   if ($34 | 0) _uselocale($34) | 0;
   switch ($35 | 0) {
   case -1:
    {
     $$13$lcssa70 = $$13;
     label = 16;
     break L29;
     break;
    }
   case -2:
    {
     $$13$lcssa71 = $$13;
     label = 17;
     break L29;
     break;
    }
   case 0:
    {
     $$24 = $$13 + 1 | 0;
     break;
    }
   default:
    $$24 = $$13 + $35 | 0;
   }
   $$13 = $$24;
   $storemerge = (HEAP32[$to_nxt >> 2] | 0) + 4 | 0;
  }
  if ((label | 0) == 16) {
   HEAP32[$frm_nxt >> 2] = $$13$lcssa70;
   $$1$ph = 2;
   label = 30;
   break;
  } else if ((label | 0) == 17) {
   HEAP32[$frm_nxt >> 2] = $$13$lcssa71;
   $$1$ph = 1;
   label = 30;
   break;
  } else if ((label | 0) == 20) {
   HEAP32[$frm_nxt >> 2] = $$13$lcssa;
   $$1$ph = ($$13$lcssa | 0) != ($frm_end | 0) & 1;
   label = 30;
   break;
  }
 } else if ((label | 0) == 31) {
  $59 = HEAP32[$frm_nxt >> 2] | 0;
  label = 34;
 } while (0);
 if ((label | 0) == 30) $$2 = $$1$ph; else if ((label | 0) == 34) $$2 = ($59 | 0) != ($frm_end | 0) & 1;
 STACKTOP = sp;
 return $$2 | 0;
}

function __ZNKSt3__27codecvtIwc11__mbstate_tE6do_outERS1_PKwS5_RS5_PcS7_RS7_($this, $st, $frm, $frm_end, $frm_nxt, $to, $to_end, $to_nxt) {
 $this = $this | 0;
 $st = $st | 0;
 $frm = $frm | 0;
 $frm_end = $frm_end | 0;
 $frm_nxt = $frm_nxt | 0;
 $to = $to | 0;
 $to_end = $to_end | 0;
 $to_nxt = $to_nxt | 0;
 var $$03 = 0, $$03$lcssa69 = 0, $$05 = 0, $$05$lcssa65 = 0, $$12 = 0, $$14 = 0, $$14$lcssa = 0, $$3$ph = 0, $$4 = 0, $13 = 0, $14 = 0, $25 = 0, $26 = 0, $30 = 0, $32 = 0, $33 = 0, $34 = 0, $38 = 0, $4 = 0, $41 = 0, $45 = 0, $46 = 0, $5 = 0, $54 = 0, $56 = 0, $57 = 0, $64 = 0, $66 = 0, $67 = 0, $8 = 0, $fend$0 = 0, $fend$0$lcssa = 0, $fend$1 = 0, $fend$2 = 0, $fend$2$lcssa = 0, $fend$5$ph11 = 0, $n$0 = 0, $p$0 = 0, $save_state = 0, $tmp = 0, label = 0, sp = 0;
 label = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16 | 0;
 $save_state = sp;
 $tmp = sp + 8 | 0;
 $fend$0 = $frm;
 while (1) {
  if (($fend$0 | 0) == ($frm_end | 0)) {
   $fend$0$lcssa = $frm_end;
   break;
  }
  if (!(HEAP32[$fend$0 >> 2] | 0)) {
   $fend$0$lcssa = $fend$0;
   break;
  }
  $fend$0 = $fend$0 + 4 | 0;
 }
 HEAP32[$to_nxt >> 2] = $to;
 HEAP32[$frm_nxt >> 2] = $frm;
 $4 = $to_end;
 $5 = $this + 8 | 0;
 $$03 = $frm;
 $$05 = $to;
 $fend$1 = $fend$0$lcssa;
 L6 : while (1) {
  if (($$05 | 0) == ($to_end | 0) | ($$03 | 0) == ($frm_end | 0)) {
   $64 = $$03;
   label = 35;
   break;
  }
  $8 = $st;
  $13 = HEAP32[$8 + 4 >> 2] | 0;
  $14 = $save_state;
  HEAP32[$14 >> 2] = HEAP32[$8 >> 2];
  HEAP32[$14 + 4 >> 2] = $13;
  $25 = _uselocale(HEAP32[$5 >> 2] | 0) | 0;
  $26 = _wcsnrtombs($$05, $frm_nxt, $fend$1 - $$03 >> 2, $4 - $$05 | 0, $st) | 0;
  if ($25 | 0) _uselocale($25) | 0;
  switch ($26 | 0) {
  case -1:
   {
    $$03$lcssa69 = $$03;
    $$05$lcssa65 = $$05;
    label = 10;
    break L6;
    break;
   }
  case 0:
   {
    $$3$ph = 1;
    label = 32;
    break L6;
    break;
   }
  default:
   {}
  }
  $41 = (HEAP32[$to_nxt >> 2] | 0) + $26 | 0;
  HEAP32[$to_nxt >> 2] = $41;
  if (($41 | 0) == ($to_end | 0)) {
   label = 33;
   break;
  }
  if (($fend$1 | 0) == ($frm_end | 0)) {
   $66 = $41;
   $67 = HEAP32[$frm_nxt >> 2] | 0;
   $fend$5$ph11 = $frm_end;
  } else {
   $45 = _uselocale(HEAP32[$5 >> 2] | 0) | 0;
   $46 = _wcrtomb($tmp, 0, $st) | 0;
   if ($45 | 0) _uselocale($45) | 0;
   if (($46 | 0) == -1) {
    $$12 = 2;
    label = 31;
    break;
   }
   if ($46 >>> 0 > ($4 - (HEAP32[$to_nxt >> 2] | 0) | 0) >>> 0) {
    $$12 = 1;
    label = 31;
    break;
   } else {
    $n$0 = $46;
    $p$0 = $tmp;
   }
   while (1) {
    if (!$n$0) break;
    $56 = HEAP8[$p$0 >> 0] | 0;
    $57 = HEAP32[$to_nxt >> 2] | 0;
    HEAP32[$to_nxt >> 2] = $57 + 1;
    HEAP8[$57 >> 0] = $56;
    $n$0 = $n$0 + -1 | 0;
    $p$0 = $p$0 + 1 | 0;
   }
   $54 = (HEAP32[$frm_nxt >> 2] | 0) + 4 | 0;
   HEAP32[$frm_nxt >> 2] = $54;
   $fend$2 = $54;
   while (1) {
    if (($fend$2 | 0) == ($frm_end | 0)) {
     $fend$2$lcssa = $frm_end;
     break;
    }
    if (!(HEAP32[$fend$2 >> 2] | 0)) {
     $fend$2$lcssa = $fend$2;
     break;
    }
    $fend$2 = $fend$2 + 4 | 0;
   }
   $66 = HEAP32[$to_nxt >> 2] | 0;
   $67 = $54;
   $fend$5$ph11 = $fend$2$lcssa;
  }
  $$03 = $67;
  $$05 = $66;
  $fend$1 = $fend$5$ph11;
 }
 if ((label | 0) == 10) {
  HEAP32[$to_nxt >> 2] = $$05$lcssa65;
  $$14 = $$03$lcssa69;
  $33 = $$05$lcssa65;
  while (1) {
   if (($$14 | 0) == (HEAP32[$frm_nxt >> 2] | 0)) {
    $$14$lcssa = $$14;
    break;
   }
   $30 = HEAP32[$$14 >> 2] | 0;
   $32 = _uselocale(HEAP32[$5 >> 2] | 0) | 0;
   $34 = _wcrtomb($33, $30, $save_state) | 0;
   if ($32 | 0) _uselocale($32) | 0;
   if (($34 | 0) == -1) {
    $$14$lcssa = $$14;
    break;
   }
   $38 = (HEAP32[$to_nxt >> 2] | 0) + $34 | 0;
   HEAP32[$to_nxt >> 2] = $38;
   $$14 = $$14 + 4 | 0;
   $33 = $38;
  }
  HEAP32[$frm_nxt >> 2] = $$14$lcssa;
  $$3$ph = 2;
  label = 32;
 } else if ((label | 0) == 31) {
  $$3$ph = $$12;
  label = 32;
 } else if ((label | 0) == 33) {
  $64 = HEAP32[$frm_nxt >> 2] | 0;
  label = 35;
 }
 if ((label | 0) == 32) $$4 = $$3$ph; else if ((label | 0) == 35) $$4 = ($64 | 0) != ($frm_end | 0) & 1;
 STACKTOP = sp;
 return $$4 | 0;
}

function __ZNSt3__2L13utf16_to_utf8EPKtS1_RS1_PhS3_RS3_mNS_12codecvt_modeE($frm, $frm_end, $frm_nxt, $to, $to_end, $to_nxt, $Maxcode, $mode) {
 $frm = $frm | 0;
 $frm_end = $frm_end | 0;
 $frm_nxt = $frm_nxt | 0;
 $to = $to | 0;
 $to_end = $to_end | 0;
 $to_nxt = $to_nxt | 0;
 $Maxcode = $Maxcode | 0;
 $mode = $mode | 0;
 var $$4 = 0, $$pre7 = 0, $10 = 0, $101 = 0, $106 = 0, $109 = 0, $11 = 0, $121 = 0, $126 = 0, $129 = 0, $13 = 0, $14 = 0, $17 = 0, $24 = 0, $35 = 0, $38 = 0, $50 = 0, $55 = 0, $6 = 0, $61 = 0, $63 = 0, $69 = 0, $79 = 0, $8 = 0, $83 = 0, $92 = 0, label = 0;
 label = 0;
 HEAP32[$frm_nxt >> 2] = $frm;
 HEAP32[$to_nxt >> 2] = $to;
 $$pre7 = $to_end;
 if (!($mode & 2)) label = 4; else if (($$pre7 - $to | 0) < 3) $$4 = 1; else {
  HEAP32[$to_nxt >> 2] = $to + 1;
  HEAP8[$to >> 0] = -17;
  $6 = HEAP32[$to_nxt >> 2] | 0;
  HEAP32[$to_nxt >> 2] = $6 + 1;
  HEAP8[$6 >> 0] = -69;
  $8 = HEAP32[$to_nxt >> 2] | 0;
  HEAP32[$to_nxt >> 2] = $8 + 1;
  HEAP8[$8 >> 0] = -65;
  label = 4;
 }
 L4 : do if ((label | 0) == 4) {
  $10 = $frm_end;
  $11 = HEAP32[$frm_nxt >> 2] | 0;
  while (1) {
   if ($11 >>> 0 >= $frm_end >>> 0) {
    $$4 = 0;
    break L4;
   }
   $13 = HEAP16[$11 >> 1] | 0;
   $14 = $13 & 65535;
   if ($14 >>> 0 > $Maxcode >>> 0) {
    $$4 = 2;
    break L4;
   }
   do if (($13 & 65535) < 128) {
    $17 = HEAP32[$to_nxt >> 2] | 0;
    if (($$pre7 - $17 | 0) < 1) {
     $$4 = 1;
     break L4;
    }
    HEAP32[$to_nxt >> 2] = $17 + 1;
    HEAP8[$17 >> 0] = $13;
   } else {
    if (($13 & 65535) < 2048) {
     $24 = HEAP32[$to_nxt >> 2] | 0;
     if (($$pre7 - $24 | 0) < 2) {
      $$4 = 1;
      break L4;
     }
     HEAP32[$to_nxt >> 2] = $24 + 1;
     HEAP8[$24 >> 0] = $14 >>> 6 | 192;
     $35 = HEAP32[$to_nxt >> 2] | 0;
     HEAP32[$to_nxt >> 2] = $35 + 1;
     HEAP8[$35 >> 0] = $14 & 63 | 128;
     break;
    }
    if (($13 & 65535) < 55296) {
     $38 = HEAP32[$to_nxt >> 2] | 0;
     if (($$pre7 - $38 | 0) < 3) {
      $$4 = 1;
      break L4;
     }
     HEAP32[$to_nxt >> 2] = $38 + 1;
     HEAP8[$38 >> 0] = $14 >>> 12 | 224;
     $50 = HEAP32[$to_nxt >> 2] | 0;
     HEAP32[$to_nxt >> 2] = $50 + 1;
     HEAP8[$50 >> 0] = $14 >>> 6 & 63 | 128;
     $55 = HEAP32[$to_nxt >> 2] | 0;
     HEAP32[$to_nxt >> 2] = $55 + 1;
     HEAP8[$55 >> 0] = $14 & 63 | 128;
     break;
    }
    if (($13 & 65535) >= 56320) {
     if (($13 & 65535) < 57344) {
      $$4 = 2;
      break L4;
     }
     $109 = HEAP32[$to_nxt >> 2] | 0;
     if (($$pre7 - $109 | 0) < 3) {
      $$4 = 1;
      break L4;
     }
     HEAP32[$to_nxt >> 2] = $109 + 1;
     HEAP8[$109 >> 0] = $14 >>> 12 | 224;
     $121 = HEAP32[$to_nxt >> 2] | 0;
     HEAP32[$to_nxt >> 2] = $121 + 1;
     HEAP8[$121 >> 0] = $14 >>> 6 & 63 | 128;
     $126 = HEAP32[$to_nxt >> 2] | 0;
     HEAP32[$to_nxt >> 2] = $126 + 1;
     HEAP8[$126 >> 0] = $14 & 63 | 128;
     break;
    }
    if (($10 - $11 | 0) < 4) {
     $$4 = 1;
     break L4;
    }
    $61 = $11 + 2 | 0;
    $63 = HEAPU16[$61 >> 1] | 0;
    if (($63 & 64512 | 0) != 56320) {
     $$4 = 2;
     break L4;
    }
    if (($$pre7 - (HEAP32[$to_nxt >> 2] | 0) | 0) < 4) {
     $$4 = 1;
     break L4;
    }
    $69 = $14 & 960;
    if ((($69 << 10) + 65536 | $14 << 10 & 64512 | $63 & 1023) >>> 0 > $Maxcode >>> 0) {
     $$4 = 2;
     break L4;
    }
    HEAP32[$frm_nxt >> 2] = $61;
    $79 = ($69 >>> 6) + 1 | 0;
    $83 = HEAP32[$to_nxt >> 2] | 0;
    HEAP32[$to_nxt >> 2] = $83 + 1;
    HEAP8[$83 >> 0] = $79 >>> 2 | 240;
    $92 = HEAP32[$to_nxt >> 2] | 0;
    HEAP32[$to_nxt >> 2] = $92 + 1;
    HEAP8[$92 >> 0] = $14 >>> 2 & 15 | $79 << 4 & 48 | 128;
    $101 = HEAP32[$to_nxt >> 2] | 0;
    HEAP32[$to_nxt >> 2] = $101 + 1;
    HEAP8[$101 >> 0] = $14 << 4 & 48 | $63 >>> 6 & 15 | 128;
    $106 = HEAP32[$to_nxt >> 2] | 0;
    HEAP32[$to_nxt >> 2] = $106 + 1;
    HEAP8[$106 >> 0] = $63 & 63 | 128;
   } while (0);
   $129 = (HEAP32[$frm_nxt >> 2] | 0) + 2 | 0;
   HEAP32[$frm_nxt >> 2] = $129;
   $11 = $129;
  }
 } while (0);
 return $$4 | 0;
}

function __ZNSt3__2L12utf8_to_ucs4EPKhS1_RS1_PjS3_RS3_mNS_12codecvt_modeE($frm, $frm_end, $frm_nxt, $to, $to_end, $to_nxt, $Maxcode, $mode) {
 $frm = $frm | 0;
 $frm_end = $frm_end | 0;
 $frm_nxt = $frm_nxt | 0;
 $to = $to | 0;
 $to_end = $to_end | 0;
 $to_nxt = $to_nxt | 0;
 $Maxcode = $Maxcode | 0;
 $mode = $mode | 0;
 var $$9 = 0, $$lcssa = 0, $$pre$phiZ2D = 0, $16 = 0, $17 = 0, $18 = 0, $2 = 0, $20 = 0, $21 = 0, $3 = 0, $32 = 0, $38 = 0, $46 = 0, $48 = 0, $55 = 0, $65 = 0, $73 = 0, $75 = 0, $77 = 0, $83 = 0, $86 = 0, $99 = 0, label = 0;
 label = 0;
 HEAP32[$frm_nxt >> 2] = $frm;
 HEAP32[$to_nxt >> 2] = $to;
 if (!($mode & 4)) $$pre$phiZ2D = $frm_end; else {
  $2 = HEAP32[$frm_nxt >> 2] | 0;
  $3 = $frm_end;
  if (($3 - $2 | 0) > 2) if ((HEAP8[$2 >> 0] | 0) == -17) if ((HEAP8[$2 + 1 >> 0] | 0) == -69) if ((HEAP8[$2 + 2 >> 0] | 0) == -65) {
   HEAP32[$frm_nxt >> 2] = $2 + 3;
   $$pre$phiZ2D = $3;
  } else $$pre$phiZ2D = $3; else $$pre$phiZ2D = $3; else $$pre$phiZ2D = $3; else $$pre$phiZ2D = $3;
 }
 L9 : while (1) {
  $16 = HEAP32[$frm_nxt >> 2] | 0;
  $17 = $16 >>> 0 < $frm_end >>> 0;
  if (!$17) {
   $$lcssa = $17;
   label = 40;
   break;
  }
  $18 = HEAP32[$to_nxt >> 2] | 0;
  if ($18 >>> 0 >= $to_end >>> 0) {
   $$lcssa = $17;
   label = 40;
   break;
  }
  $20 = HEAP8[$16 >> 0] | 0;
  $21 = $20 & 255;
  do if ($20 << 24 >> 24 > -1) {
   if ($21 >>> 0 > $Maxcode >>> 0) {
    $$9 = 2;
    break L9;
   }
   HEAP32[$18 >> 2] = $21;
   HEAP32[$frm_nxt >> 2] = $16 + 1;
  } else {
   if (($20 & 255) < 194) {
    $$9 = 2;
    break L9;
   }
   if (($20 & 255) < 224) {
    if (($$pre$phiZ2D - $16 | 0) < 2) {
     $$9 = 1;
     break L9;
    }
    $32 = HEAPU8[$16 + 1 >> 0] | 0;
    if (($32 & 192 | 0) != 128) {
     $$9 = 2;
     break L9;
    }
    $38 = $32 & 63 | $21 << 6 & 1984;
    if ($38 >>> 0 > $Maxcode >>> 0) {
     $$9 = 2;
     break L9;
    }
    HEAP32[$18 >> 2] = $38;
    HEAP32[$frm_nxt >> 2] = $16 + 2;
    break;
   }
   if (($20 & 255) < 240) {
    if (($$pre$phiZ2D - $16 | 0) < 3) {
     $$9 = 1;
     break L9;
    }
    $46 = HEAP8[$16 + 1 >> 0] | 0;
    $48 = HEAP8[$16 + 2 >> 0] | 0;
    switch ($21 | 0) {
    case 224:
     {
      if (($46 & -32) << 24 >> 24 != -96) {
       $$9 = 2;
       break L9;
      }
      break;
     }
    case 237:
     {
      if (($46 & -32) << 24 >> 24 != -128) {
       $$9 = 2;
       break L9;
      }
      break;
     }
    default:
     if (($46 & -64) << 24 >> 24 != -128) {
      $$9 = 2;
      break L9;
     }
    }
    $55 = $48 & 255;
    if (($55 & 192 | 0) != 128) {
     $$9 = 2;
     break L9;
    }
    $65 = ($46 & 255) << 6 & 4032 | $21 << 12 & 61440 | $55 & 63;
    if ($65 >>> 0 > $Maxcode >>> 0) {
     $$9 = 2;
     break L9;
    }
    HEAP32[$18 >> 2] = $65;
    HEAP32[$frm_nxt >> 2] = $16 + 3;
    break;
   }
   if (($20 & 255) >= 245) {
    $$9 = 2;
    break L9;
   }
   if (($$pre$phiZ2D - $16 | 0) < 4) {
    $$9 = 1;
    break L9;
   }
   $73 = HEAP8[$16 + 1 >> 0] | 0;
   $75 = HEAP8[$16 + 2 >> 0] | 0;
   $77 = HEAP8[$16 + 3 >> 0] | 0;
   switch ($21 | 0) {
   case 240:
    {
     if (($73 + 112 & 255) >= 48) {
      $$9 = 2;
      break L9;
     }
     break;
    }
   case 244:
    {
     if (($73 & -16) << 24 >> 24 != -128) {
      $$9 = 2;
      break L9;
     }
     break;
    }
   default:
    if (($73 & -64) << 24 >> 24 != -128) {
     $$9 = 2;
     break L9;
    }
   }
   $83 = $75 & 255;
   if (($83 & 192 | 0) != 128) {
    $$9 = 2;
    break L9;
   }
   $86 = $77 & 255;
   if (($86 & 192 | 0) != 128) {
    $$9 = 2;
    break L9;
   }
   $99 = ($73 & 255) << 12 & 258048 | $21 << 18 & 1835008 | $83 << 6 & 4032 | $86 & 63;
   if ($99 >>> 0 > $Maxcode >>> 0) {
    $$9 = 2;
    break L9;
   }
   HEAP32[$18 >> 2] = $99;
   HEAP32[$frm_nxt >> 2] = $16 + 4;
  } while (0);
  HEAP32[$to_nxt >> 2] = (HEAP32[$to_nxt >> 2] | 0) + 4;
 }
 if ((label | 0) == 40) $$9 = $$lcssa & 1;
 return $$9 | 0;
}

function __ZNSt3__29__num_getIcE19__stage2_float_loopEcRbRcPcRS4_ccRKNS_12basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEEPjRSE_RjS4_($__ct, $__in_units, $__exp, $__a, $__a_end, $__decimal_point, $__thousands_sep, $__grouping, $__g, $__g_end, $__dc, $__atoms) {
 $__ct = $__ct | 0;
 $__in_units = $__in_units | 0;
 $__exp = $__exp | 0;
 $__a = $__a | 0;
 $__a_end = $__a_end | 0;
 $__decimal_point = $__decimal_point | 0;
 $__thousands_sep = $__thousands_sep | 0;
 $__grouping = $__grouping | 0;
 $__g = $__g | 0;
 $__g_end = $__g_end | 0;
 $__dc = $__dc | 0;
 $__atoms = $__atoms | 0;
 var $$0$i = 0, $$0$lcssa$i = 0, $$2 = 0, $13 = 0, $18 = 0, $22 = 0, $3 = 0, $31 = 0, $36 = 0, $38 = 0, $45 = 0, $48 = 0, $49 = 0, $6 = 0, $60 = 0, $63 = 0, $72 = 0, $79 = 0, $84 = 0, $86 = 0;
 L1 : do if ($__ct << 24 >> 24 == $__decimal_point << 24 >> 24) if (!(HEAP8[$__in_units >> 0] | 0)) $$2 = -1; else {
  HEAP8[$__in_units >> 0] = 0;
  $3 = HEAP32[$__a_end >> 2] | 0;
  HEAP32[$__a_end >> 2] = $3 + 1;
  HEAP8[$3 >> 0] = 46;
  $6 = HEAP8[$__grouping + 11 >> 0] | 0;
  if (!(($6 << 24 >> 24 < 0 ? HEAP32[$__grouping + 4 >> 2] | 0 : $6 & 255) | 0)) $$2 = 0; else {
   $13 = HEAP32[$__g_end >> 2] | 0;
   if (($13 - $__g | 0) < 160) {
    $18 = HEAP32[$__dc >> 2] | 0;
    HEAP32[$__g_end >> 2] = $13 + 4;
    HEAP32[$13 >> 2] = $18;
    $$2 = 0;
   } else $$2 = 0;
  }
 } else {
  if ($__ct << 24 >> 24 == $__thousands_sep << 24 >> 24) {
   $22 = HEAP8[$__grouping + 11 >> 0] | 0;
   if (($22 << 24 >> 24 < 0 ? HEAP32[$__grouping + 4 >> 2] | 0 : $22 & 255) | 0) {
    if (!(HEAP8[$__in_units >> 0] | 0)) {
     $$2 = -1;
     break;
    }
    $31 = HEAP32[$__g_end >> 2] | 0;
    if (($31 - $__g | 0) >= 160) {
     $$2 = 0;
     break;
    }
    $36 = HEAP32[$__dc >> 2] | 0;
    HEAP32[$__g_end >> 2] = $31 + 4;
    HEAP32[$31 >> 2] = $36;
    HEAP32[$__dc >> 2] = 0;
    $$2 = 0;
    break;
   }
  }
  $38 = $__atoms + 32 | 0;
  $$0$i = $__atoms;
  while (1) {
   if (($$0$i | 0) == ($38 | 0)) {
    $$0$lcssa$i = $38;
    break;
   }
   if ((HEAP8[$$0$i >> 0] | 0) == $__ct << 24 >> 24) {
    $$0$lcssa$i = $$0$i;
    break;
   }
   $$0$i = $$0$i + 1 | 0;
  }
  $45 = $$0$lcssa$i - $__atoms | 0;
  if (($45 | 0) > 31) $$2 = -1; else {
   $48 = HEAP8[80874 + $45 >> 0] | 0;
   switch ($45 | 0) {
   case 24:
   case 25:
    {
     $49 = HEAP32[$__a_end >> 2] | 0;
     if (($49 | 0) != ($__a | 0)) if ((HEAPU8[$49 + -1 >> 0] & 95 | 0) != (HEAPU8[$__exp >> 0] & 127 | 0)) {
      $$2 = -1;
      break L1;
     }
     HEAP32[$__a_end >> 2] = $49 + 1;
     HEAP8[$49 >> 0] = $48;
     $$2 = 0;
     break L1;
     break;
    }
   case 23:
   case 22:
    {
     HEAP8[$__exp >> 0] = 80;
     $60 = HEAP32[$__a_end >> 2] | 0;
     HEAP32[$__a_end >> 2] = $60 + 1;
     HEAP8[$60 >> 0] = $48;
     $$2 = 0;
     break L1;
     break;
    }
   default:
    {
     $63 = $48 & 95;
     if (($63 | 0) == (HEAP8[$__exp >> 0] | 0)) {
      HEAP8[$__exp >> 0] = $63 | 128;
      if (HEAP8[$__in_units >> 0] | 0) {
       HEAP8[$__in_units >> 0] = 0;
       $72 = HEAP8[$__grouping + 11 >> 0] | 0;
       if (($72 << 24 >> 24 < 0 ? HEAP32[$__grouping + 4 >> 2] | 0 : $72 & 255) | 0) {
        $79 = HEAP32[$__g_end >> 2] | 0;
        if (($79 - $__g | 0) < 160) {
         $84 = HEAP32[$__dc >> 2] | 0;
         HEAP32[$__g_end >> 2] = $79 + 4;
         HEAP32[$79 >> 2] = $84;
        }
       }
      }
     }
     $86 = HEAP32[$__a_end >> 2] | 0;
     HEAP32[$__a_end >> 2] = $86 + 1;
     HEAP8[$86 >> 0] = $48;
     if (($45 | 0) > 21) {
      $$2 = 0;
      break L1;
     }
     HEAP32[$__dc >> 2] = (HEAP32[$__dc >> 2] | 0) + 1;
     $$2 = 0;
     break L1;
    }
   }
  }
 } while (0);
 return $$2 | 0;
}

function __ZNSt3__29__num_getIwE19__stage2_float_loopEwRbRcPcRS4_wwRKNS_12basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEEPjRSE_RjPw($__ct, $__in_units, $__exp, $__a, $__a_end, $__decimal_point, $__thousands_sep, $__grouping, $__g, $__g_end, $__dc, $__atoms) {
 $__ct = $__ct | 0;
 $__in_units = $__in_units | 0;
 $__exp = $__exp | 0;
 $__a = $__a | 0;
 $__a_end = $__a_end | 0;
 $__decimal_point = $__decimal_point | 0;
 $__thousands_sep = $__thousands_sep | 0;
 $__grouping = $__grouping | 0;
 $__g = $__g | 0;
 $__g_end = $__g_end | 0;
 $__dc = $__dc | 0;
 $__atoms = $__atoms | 0;
 var $$0$i = 0, $$0$lcssa$i = 0, $$2 = 0, $13 = 0, $18 = 0, $22 = 0, $3 = 0, $31 = 0, $36 = 0, $38 = 0, $45 = 0, $46 = 0, $49 = 0, $50 = 0, $6 = 0, $62 = 0, $71 = 0, $78 = 0, $83 = 0, $85 = 0;
 L1 : do if (($__ct | 0) == ($__decimal_point | 0)) if (!(HEAP8[$__in_units >> 0] | 0)) $$2 = -1; else {
  HEAP8[$__in_units >> 0] = 0;
  $3 = HEAP32[$__a_end >> 2] | 0;
  HEAP32[$__a_end >> 2] = $3 + 1;
  HEAP8[$3 >> 0] = 46;
  $6 = HEAP8[$__grouping + 11 >> 0] | 0;
  if (!(($6 << 24 >> 24 < 0 ? HEAP32[$__grouping + 4 >> 2] | 0 : $6 & 255) | 0)) $$2 = 0; else {
   $13 = HEAP32[$__g_end >> 2] | 0;
   if (($13 - $__g | 0) < 160) {
    $18 = HEAP32[$__dc >> 2] | 0;
    HEAP32[$__g_end >> 2] = $13 + 4;
    HEAP32[$13 >> 2] = $18;
    $$2 = 0;
   } else $$2 = 0;
  }
 } else {
  if (($__ct | 0) == ($__thousands_sep | 0)) {
   $22 = HEAP8[$__grouping + 11 >> 0] | 0;
   if (($22 << 24 >> 24 < 0 ? HEAP32[$__grouping + 4 >> 2] | 0 : $22 & 255) | 0) {
    if (!(HEAP8[$__in_units >> 0] | 0)) {
     $$2 = -1;
     break;
    }
    $31 = HEAP32[$__g_end >> 2] | 0;
    if (($31 - $__g | 0) >= 160) {
     $$2 = 0;
     break;
    }
    $36 = HEAP32[$__dc >> 2] | 0;
    HEAP32[$__g_end >> 2] = $31 + 4;
    HEAP32[$31 >> 2] = $36;
    HEAP32[$__dc >> 2] = 0;
    $$2 = 0;
    break;
   }
  }
  $38 = $__atoms + 128 | 0;
  $$0$i = $__atoms;
  while (1) {
   if (($$0$i | 0) == ($38 | 0)) {
    $$0$lcssa$i = $38;
    break;
   }
   if ((HEAP32[$$0$i >> 2] | 0) == ($__ct | 0)) {
    $$0$lcssa$i = $$0$i;
    break;
   }
   $$0$i = $$0$i + 4 | 0;
  }
  $45 = $$0$lcssa$i - $__atoms | 0;
  $46 = $45 >> 2;
  if (($45 | 0) > 124) $$2 = -1; else {
   $49 = HEAP8[80874 + $46 >> 0] | 0;
   switch ($46 | 0) {
   case 24:
   case 25:
    {
     $50 = HEAP32[$__a_end >> 2] | 0;
     if (($50 | 0) != ($__a | 0)) if ((HEAPU8[$50 + -1 >> 0] & 95 | 0) != (HEAPU8[$__exp >> 0] & 127 | 0)) {
      $$2 = -1;
      break L1;
     }
     HEAP32[$__a_end >> 2] = $50 + 1;
     HEAP8[$50 >> 0] = $49;
     $$2 = 0;
     break L1;
     break;
    }
   case 23:
   case 22:
    {
     HEAP8[$__exp >> 0] = 80;
     break;
    }
   default:
    {
     $62 = $49 & 95;
     if (($62 | 0) == (HEAP8[$__exp >> 0] | 0)) {
      HEAP8[$__exp >> 0] = $62 | 128;
      if (HEAP8[$__in_units >> 0] | 0) {
       HEAP8[$__in_units >> 0] = 0;
       $71 = HEAP8[$__grouping + 11 >> 0] | 0;
       if (($71 << 24 >> 24 < 0 ? HEAP32[$__grouping + 4 >> 2] | 0 : $71 & 255) | 0) {
        $78 = HEAP32[$__g_end >> 2] | 0;
        if (($78 - $__g | 0) < 160) {
         $83 = HEAP32[$__dc >> 2] | 0;
         HEAP32[$__g_end >> 2] = $78 + 4;
         HEAP32[$78 >> 2] = $83;
        }
       }
      }
     }
    }
   }
   $85 = HEAP32[$__a_end >> 2] | 0;
   HEAP32[$__a_end >> 2] = $85 + 1;
   HEAP8[$85 >> 0] = $49;
   if (($45 | 0) > 84) $$2 = 0; else {
    HEAP32[$__dc >> 2] = (HEAP32[$__dc >> 2] | 0) + 1;
    $$2 = 0;
   }
  }
 } while (0);
 return $$2 | 0;
}

function __ZNSt3__215basic_stringbufIcNS_11char_traitsIcEENS_9allocatorIcEEE7seekoffExNS_8ios_base7seekdirEj($agg$result, $this, $0, $1, $__way, $__wch) {
 $agg$result = $agg$result | 0;
 $this = $this | 0;
 $0 = $0 | 0;
 $1 = $1 | 0;
 $__way = $__way | 0;
 $__wch = $__wch | 0;
 var $$pre = 0, $101 = 0, $106 = 0, $11 = 0, $113 = 0, $118 = 0, $133 = 0, $138 = 0, $16 = 0, $2 = 0, $22 = 0, $27 = 0, $3 = 0, $37 = 0, $4 = 0, $42 = 0, $45 = 0, $5 = 0, $50 = 0, $52 = 0, $53 = 0, $56 = 0, $61 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $70 = 0, $75 = 0, $77 = 0, $79 = 0, $8 = 0, $85 = 0, $9 = 0, $90 = 0;
 $2 = $this + 44 | 0;
 $3 = HEAP32[$2 >> 2] | 0;
 $4 = $this + 24 | 0;
 $5 = HEAP32[$4 >> 2] | 0;
 $8 = $5;
 if ($3 >>> 0 < $5 >>> 0) {
  HEAP32[$2 >> 2] = $5;
  $53 = $8;
 } else $53 = $3;
 $9 = $__wch & 24;
 if (!$9) {
  $11 = $agg$result;
  HEAP32[$11 >> 2] = 0;
  HEAP32[$11 + 4 >> 2] = 0;
  $16 = $agg$result + 8 | 0;
  HEAP32[$16 >> 2] = -1;
  HEAP32[$16 + 4 >> 2] = -1;
  return;
 }
 if (($__way | 0) == 1 & ($9 | 0) == 24) {
  $22 = $agg$result;
  HEAP32[$22 >> 2] = 0;
  HEAP32[$22 + 4 >> 2] = 0;
  $27 = $agg$result + 8 | 0;
  HEAP32[$27 >> 2] = -1;
  HEAP32[$27 + 4 >> 2] = -1;
  return;
 }
 L12 : do switch ($__way | 0) {
 case 0:
  {
   $65 = 0;
   $66 = 0;
   break;
  }
 case 1:
  {
   if (!($__wch & 8)) {
    $42 = $8 - (HEAP32[$this + 20 >> 2] | 0) | 0;
    $65 = $42;
    $66 = (($42 | 0) < 0) << 31 >> 31;
    break L12;
   } else {
    $37 = (HEAP32[$this + 12 >> 2] | 0) - (HEAP32[$this + 8 >> 2] | 0) | 0;
    $65 = $37;
    $66 = (($37 | 0) < 0) << 31 >> 31;
    break L12;
   }
   break;
  }
 case 2:
  {
   $45 = $this + 32 | 0;
   if ((HEAP8[$45 + 11 >> 0] | 0) < 0) $50 = HEAP32[$45 >> 2] | 0; else $50 = $45;
   $52 = $53 - $50 | 0;
   $65 = $52;
   $66 = (($52 | 0) < 0) << 31 >> 31;
   break;
  }
 default:
  {
   $56 = $agg$result;
   HEAP32[$56 >> 2] = 0;
   HEAP32[$56 + 4 >> 2] = 0;
   $61 = $agg$result + 8 | 0;
   HEAP32[$61 >> 2] = -1;
   HEAP32[$61 + 4 >> 2] = -1;
   return;
  }
 } while (0);
 $67 = _i64Add($65 | 0, $66 | 0, $0 | 0, $1 | 0) | 0;
 $68 = tempRet0;
 if (($68 | 0) >= 0) {
  $70 = $this + 32 | 0;
  if ((HEAP8[$70 + 11 >> 0] | 0) < 0) $75 = HEAP32[$70 >> 2] | 0; else $75 = $70;
  $77 = $53 - $75 | 0;
  $79 = (($77 | 0) < 0) << 31 >> 31;
  if (!(($79 | 0) < ($68 | 0) | ($79 | 0) == ($68 | 0) & $77 >>> 0 < $67 >>> 0)) {
   $$pre = $__wch & 8;
   if (!(($67 | 0) == 0 & ($68 | 0) == 0)) {
    if ($$pre | 0) if (!(HEAP32[$this + 12 >> 2] | 0)) {
     $101 = $agg$result;
     HEAP32[$101 >> 2] = 0;
     HEAP32[$101 + 4 >> 2] = 0;
     $106 = $agg$result + 8 | 0;
     HEAP32[$106 >> 2] = -1;
     HEAP32[$106 + 4 >> 2] = -1;
     return;
    }
    if (($__wch & 16 | 0) != 0 & ($5 | 0) == 0) {
     $113 = $agg$result;
     HEAP32[$113 >> 2] = 0;
     HEAP32[$113 + 4 >> 2] = 0;
     $118 = $agg$result + 8 | 0;
     HEAP32[$118 >> 2] = -1;
     HEAP32[$118 + 4 >> 2] = -1;
     return;
    }
   }
   if ($$pre | 0) {
    HEAP32[$this + 12 >> 2] = (HEAP32[$this + 8 >> 2] | 0) + $67;
    HEAP32[$this + 16 >> 2] = $53;
   }
   if ($__wch & 16 | 0) HEAP32[$4 >> 2] = (HEAP32[$this + 20 >> 2] | 0) + $67;
   $133 = $agg$result;
   HEAP32[$133 >> 2] = 0;
   HEAP32[$133 + 4 >> 2] = 0;
   $138 = $agg$result + 8 | 0;
   HEAP32[$138 >> 2] = $67;
   HEAP32[$138 + 4 >> 2] = $68;
   return;
  }
 }
 $85 = $agg$result;
 HEAP32[$85 >> 2] = 0;
 HEAP32[$85 + 4 >> 2] = 0;
 $90 = $agg$result + 8 | 0;
 HEAP32[$90 >> 2] = -1;
 HEAP32[$90 + 4 >> 2] = -1;
 return;
}

function _wcsrtombs($s, $ws, $n, $st) {
 $s = $s | 0;
 $ws = $ws | 0;
 $n = $n | 0;
 $st = $st | 0;
 var $$0 = 0, $$01$lcssa = 0, $$0129 = 0, $$0129$lcssa = 0, $$0218 = 0, $$1 = 0, $$13 = 0, $$223 = 0, $$223$lcssa = 0, $$24$lcssa = 0, $$2428 = 0, $$2428$lcssa = 0, $$3 = 0, $$35 = 0, $$422 = 0, $$422$lcssa = 0, $$422$lcssa83 = 0, $$5 = 0, $$pn = 0, $13 = 0, $14 = 0, $19 = 0, $2 = 0, $27 = 0, $29 = 0, $3 = 0, $30 = 0, $35 = 0, $46 = 0, $5 = 0, $7 = 0, $buf = 0, $ws2$019 = 0, label = 0, sp = 0;
 label = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16 | 0;
 $buf = sp;
 L1 : do if (!$s) {
  $2 = HEAP32[$ws >> 2] | 0;
  $3 = HEAP32[$2 >> 2] | 0;
  if (!$3) $$0 = 0; else {
   $$0218 = 0;
   $5 = $3;
   $ws2$019 = $2;
   while (1) {
    if ($5 >>> 0 > 127) {
     $7 = _wcrtomb($buf, $5, 0) | 0;
     if (($7 | 0) == -1) {
      $$0 = -1;
      break L1;
     } else $$pn = $7;
    } else $$pn = 1;
    $$13 = $$pn + $$0218 | 0;
    $ws2$019 = $ws2$019 + 4 | 0;
    $5 = HEAP32[$ws2$019 >> 2] | 0;
    if (!$5) {
     $$0 = $$13;
     break;
    } else $$0218 = $$13;
   }
  }
 } else {
  L9 : do if ($n >>> 0 > 3) {
   $$0129 = $s;
   $$2428 = $n;
   $14 = HEAP32[$ws >> 2] | 0;
   while (1) {
    $13 = HEAP32[$14 >> 2] | 0;
    if (($13 + -1 | 0) >>> 0 > 126) {
     if (!$13) {
      $$0129$lcssa = $$0129;
      $$2428$lcssa = $$2428;
      break;
     }
     $19 = _wcrtomb($$0129, $13, 0) | 0;
     if (($19 | 0) == -1) {
      $$0 = -1;
      break L1;
     }
     $$1 = $$0129 + $19 | 0;
     $$35 = $$2428 - $19 | 0;
     $27 = $14;
    } else {
     HEAP8[$$0129 >> 0] = $13;
     $$1 = $$0129 + 1 | 0;
     $$35 = $$2428 + -1 | 0;
     $27 = HEAP32[$ws >> 2] | 0;
    }
    $14 = $27 + 4 | 0;
    HEAP32[$ws >> 2] = $14;
    if ($$35 >>> 0 <= 3) {
     $$01$lcssa = $$1;
     $$24$lcssa = $$35;
     break L9;
    } else {
     $$0129 = $$1;
     $$2428 = $$35;
    }
   }
   HEAP8[$$0129$lcssa >> 0] = 0;
   HEAP32[$ws >> 2] = 0;
   $$0 = $n - $$2428$lcssa | 0;
   break L1;
  } else {
   $$01$lcssa = $s;
   $$24$lcssa = $n;
  } while (0);
  if (!$$24$lcssa) $$0 = $n; else {
   $$223 = $$01$lcssa;
   $$422 = $$24$lcssa;
   $30 = HEAP32[$ws >> 2] | 0;
   while (1) {
    $29 = HEAP32[$30 >> 2] | 0;
    if (($29 + -1 | 0) >>> 0 > 126) {
     if (!$29) {
      $$223$lcssa = $$223;
      $$422$lcssa = $$422;
      label = 19;
      break;
     }
     $35 = _wcrtomb($buf, $29, 0) | 0;
     if (($35 | 0) == -1) {
      $$0 = -1;
      break L1;
     }
     if ($$422 >>> 0 < $35 >>> 0) {
      $$422$lcssa83 = $$422;
      label = 22;
      break;
     }
     _wcrtomb($$223, HEAP32[$30 >> 2] | 0, 0) | 0;
     $$3 = $$223 + $35 | 0;
     $$5 = $$422 - $35 | 0;
     $46 = $30;
    } else {
     HEAP8[$$223 >> 0] = $29;
     $$3 = $$223 + 1 | 0;
     $$5 = $$422 + -1 | 0;
     $46 = HEAP32[$ws >> 2] | 0;
    }
    $30 = $46 + 4 | 0;
    HEAP32[$ws >> 2] = $30;
    if (!$$5) {
     $$0 = $n;
     break L1;
    } else {
     $$223 = $$3;
     $$422 = $$5;
    }
   }
   if ((label | 0) == 19) {
    HEAP8[$$223$lcssa >> 0] = 0;
    HEAP32[$ws >> 2] = 0;
    $$0 = $n - $$422$lcssa | 0;
    break;
   } else if ((label | 0) == 22) {
    $$0 = $n - $$422$lcssa83 | 0;
    break;
   }
  }
 } while (0);
 STACKTOP = sp;
 return $$0 | 0;
}

function _mbsnrtowcs($wcs, $src, $n, $wn, $st) {
 $wcs = $wcs | 0;
 $src = $src | 0;
 $n = $n | 0;
 $wn = $wn | 0;
 $st = $st | 0;
 var $$019 = 0, $$02$ = 0, $$0218 = 0, $$1 = 0, $$13 = 0, $$214 = 0, $$24 = 0, $$313 = 0, $$cast = 0, $$lcssa = 0, $$lcssa57 = 0, $0 = 0, $1 = 0, $11 = 0, $13 = 0, $14 = 0, $15 = 0, $18 = 0, $23 = 0, $24 = 0, $32 = 0, $37 = 0, $4 = 0, $5 = 0, $8 = 0, $9 = 0, $cnt$020 = 0, $cnt$1 = 0, $cnt$215 = 0, $cnt$215$lcssa = 0, $cnt$3 = 0, $s = 0, $wbuf = 0, $wcs$ = 0, $wn$ = 0, $ws$010 = 0, $ws$021 = 0, $ws$021$lcssa56 = 0, $ws$1 = 0, $ws$216 = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 1040 | 0;
 $wbuf = sp + 8 | 0;
 $s = sp;
 $0 = HEAP32[$src >> 2] | 0;
 HEAP32[$s >> 2] = $0;
 $1 = ($wcs | 0) != 0;
 $wn$ = $1 ? $wn : 256;
 $wcs$ = $1 ? $wcs : $wbuf;
 $$cast = $0;
 L1 : do if (($wn$ | 0) != 0 & ($0 | 0) != 0) {
  $$019 = $n;
  $$0218 = $wn$;
  $37 = $$cast;
  $cnt$020 = 0;
  $ws$021 = $wcs$;
  while (1) {
   $4 = $$019 >>> 2;
   $5 = $4 >>> 0 >= $$0218 >>> 0;
   if (!($$019 >>> 0 > 131 | $5)) {
    $$1 = $$019;
    $$24 = $$0218;
    $18 = $37;
    $cnt$1 = $cnt$020;
    $ws$010 = $ws$021;
    break L1;
   }
   $$02$ = $5 ? $$0218 : $4;
   $8 = $$019 - $$02$ | 0;
   $9 = _mbsrtowcs($ws$021, $s, $$02$, $st) | 0;
   if (($9 | 0) == -1) {
    $$lcssa57 = $8;
    $ws$021$lcssa56 = $ws$021;
    break;
   }
   $11 = ($ws$021 | 0) == ($wbuf | 0);
   $13 = $11 ? 0 : $9;
   $$13 = $$0218 - $13 | 0;
   $ws$1 = $11 ? $ws$021 : $ws$021 + ($9 << 2) | 0;
   $14 = $9 + $cnt$020 | 0;
   $15 = HEAP32[$s >> 2] | 0;
   if (($$0218 | 0) != ($13 | 0) & ($15 | 0) != 0) {
    $$019 = $8;
    $$0218 = $$13;
    $37 = $15;
    $cnt$020 = $14;
    $ws$021 = $ws$1;
   } else {
    $$1 = $8;
    $$24 = $$13;
    $18 = $15;
    $cnt$1 = $14;
    $ws$010 = $ws$1;
    break L1;
   }
  }
  $$1 = $$lcssa57;
  $$24 = 0;
  $18 = HEAP32[$s >> 2] | 0;
  $cnt$1 = -1;
  $ws$010 = $ws$021$lcssa56;
 } else {
  $$1 = $n;
  $$24 = $wn$;
  $18 = $$cast;
  $cnt$1 = 0;
  $ws$010 = $wcs$;
 } while (0);
 L8 : do if (!$18) $cnt$3 = $cnt$1; else if (($$24 | 0) != 0 & ($$1 | 0) != 0) {
  $$214 = $$1;
  $$313 = $$24;
  $23 = $18;
  $cnt$215 = $cnt$1;
  $ws$216 = $ws$010;
  while (1) {
   $24 = _mbrtowc($ws$216, $23, $$214, $st) | 0;
   if (($24 + 2 | 0) >>> 0 < 3) {
    $$lcssa = $24;
    $cnt$215$lcssa = $cnt$215;
    break;
   }
   $23 = (HEAP32[$s >> 2] | 0) + $24 | 0;
   HEAP32[$s >> 2] = $23;
   $$313 = $$313 + -1 | 0;
   $32 = $cnt$215 + 1 | 0;
   if (!(($$313 | 0) != 0 & ($$214 | 0) != ($24 | 0))) {
    $cnt$3 = $32;
    break L8;
   } else {
    $$214 = $$214 - $24 | 0;
    $cnt$215 = $32;
    $ws$216 = $ws$216 + 4 | 0;
   }
  }
  switch ($$lcssa | 0) {
  case -1:
   {
    $cnt$3 = -1;
    break L8;
    break;
   }
  case 0:
   {
    HEAP32[$s >> 2] = 0;
    $cnt$3 = $cnt$215$lcssa;
    break L8;
    break;
   }
  default:
   {
    HEAP32[$st >> 2] = 0;
    $cnt$3 = $cnt$215$lcssa;
    break L8;
   }
  }
 } else $cnt$3 = $cnt$1; while (0);
 if ($1) HEAP32[$src >> 2] = HEAP32[$s >> 2];
 STACKTOP = sp;
 return $cnt$3 | 0;
}

function __ZNSt3__2L12ucs4_to_utf8EPKjS1_RS1_PhS3_RS3_mNS_12codecvt_modeE($frm, $frm_end, $frm_nxt, $to, $to_end, $to_nxt, $Maxcode, $mode) {
 $frm = $frm | 0;
 $frm_end = $frm_end | 0;
 $frm_nxt = $frm_nxt | 0;
 $to = $to | 0;
 $to_end = $to_end | 0;
 $to_nxt = $to_nxt | 0;
 $Maxcode = $Maxcode | 0;
 $mode = $mode | 0;
 var $$2 = 0, $$pre2 = 0, $10 = 0, $12 = 0, $17 = 0, $24 = 0, $35 = 0, $38 = 0, $40 = 0, $50 = 0, $55 = 0, $6 = 0, $66 = 0, $72 = 0, $77 = 0, $8 = 0, $80 = 0, label = 0;
 label = 0;
 HEAP32[$frm_nxt >> 2] = $frm;
 HEAP32[$to_nxt >> 2] = $to;
 $$pre2 = $to_end;
 if (!($mode & 2)) label = 4; else if (($$pre2 - $to | 0) < 3) $$2 = 1; else {
  HEAP32[$to_nxt >> 2] = $to + 1;
  HEAP8[$to >> 0] = -17;
  $6 = HEAP32[$to_nxt >> 2] | 0;
  HEAP32[$to_nxt >> 2] = $6 + 1;
  HEAP8[$6 >> 0] = -69;
  $8 = HEAP32[$to_nxt >> 2] | 0;
  HEAP32[$to_nxt >> 2] = $8 + 1;
  HEAP8[$8 >> 0] = -65;
  label = 4;
 }
 L4 : do if ((label | 0) == 4) {
  $10 = HEAP32[$frm_nxt >> 2] | 0;
  while (1) {
   if ($10 >>> 0 >= $frm_end >>> 0) {
    $$2 = 0;
    break L4;
   }
   $12 = HEAP32[$10 >> 2] | 0;
   if ($12 >>> 0 > $Maxcode >>> 0 | ($12 & -2048 | 0) == 55296) {
    $$2 = 2;
    break L4;
   }
   do if ($12 >>> 0 < 128) {
    $17 = HEAP32[$to_nxt >> 2] | 0;
    if (($$pre2 - $17 | 0) < 1) {
     $$2 = 1;
     break L4;
    }
    HEAP32[$to_nxt >> 2] = $17 + 1;
    HEAP8[$17 >> 0] = $12;
   } else {
    if ($12 >>> 0 < 2048) {
     $24 = HEAP32[$to_nxt >> 2] | 0;
     if (($$pre2 - $24 | 0) < 2) {
      $$2 = 1;
      break L4;
     }
     HEAP32[$to_nxt >> 2] = $24 + 1;
     HEAP8[$24 >> 0] = $12 >>> 6 | 192;
     $35 = HEAP32[$to_nxt >> 2] | 0;
     HEAP32[$to_nxt >> 2] = $35 + 1;
     HEAP8[$35 >> 0] = $12 & 63 | 128;
     break;
    }
    $38 = HEAP32[$to_nxt >> 2] | 0;
    $40 = $$pre2 - $38 | 0;
    if ($12 >>> 0 < 65536) {
     if (($40 | 0) < 3) {
      $$2 = 1;
      break L4;
     }
     HEAP32[$to_nxt >> 2] = $38 + 1;
     HEAP8[$38 >> 0] = $12 >>> 12 | 224;
     $50 = HEAP32[$to_nxt >> 2] | 0;
     HEAP32[$to_nxt >> 2] = $50 + 1;
     HEAP8[$50 >> 0] = $12 >>> 6 & 63 | 128;
     $55 = HEAP32[$to_nxt >> 2] | 0;
     HEAP32[$to_nxt >> 2] = $55 + 1;
     HEAP8[$55 >> 0] = $12 & 63 | 128;
     break;
    } else {
     if (($40 | 0) < 4) {
      $$2 = 1;
      break L4;
     }
     HEAP32[$to_nxt >> 2] = $38 + 1;
     HEAP8[$38 >> 0] = $12 >>> 18 | 240;
     $66 = HEAP32[$to_nxt >> 2] | 0;
     HEAP32[$to_nxt >> 2] = $66 + 1;
     HEAP8[$66 >> 0] = $12 >>> 12 & 63 | 128;
     $72 = HEAP32[$to_nxt >> 2] | 0;
     HEAP32[$to_nxt >> 2] = $72 + 1;
     HEAP8[$72 >> 0] = $12 >>> 6 & 63 | 128;
     $77 = HEAP32[$to_nxt >> 2] | 0;
     HEAP32[$to_nxt >> 2] = $77 + 1;
     HEAP8[$77 >> 0] = $12 & 63 | 128;
     break;
    }
   } while (0);
   $80 = (HEAP32[$frm_nxt >> 2] | 0) + 4 | 0;
   HEAP32[$frm_nxt >> 2] = $80;
   $10 = $80;
  }
 } while (0);
 return $$2 | 0;
}

function _pop_arg($arg, $type, $ap) {
 $arg = $arg | 0;
 $type = $type | 0;
 $ap = $ap | 0;
 var $105 = 0, $106 = 0.0, $112 = 0, $113 = 0.0, $13 = 0, $14 = 0, $17 = 0, $26 = 0, $27 = 0, $28 = 0, $37 = 0, $38 = 0, $40 = 0, $43 = 0, $44 = 0, $53 = 0, $54 = 0, $56 = 0, $59 = 0, $6 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $79 = 0, $80 = 0, $82 = 0, $85 = 0, $94 = 0, $95 = 0, $96 = 0;
 L1 : do if ($type >>> 0 <= 20) do switch ($type | 0) {
 case 9:
  {
   $6 = (HEAP32[$ap >> 2] | 0) + (4 - 1) & ~(4 - 1);
   $7 = HEAP32[$6 >> 2] | 0;
   HEAP32[$ap >> 2] = $6 + 4;
   HEAP32[$arg >> 2] = $7;
   break L1;
   break;
  }
 case 10:
  {
   $13 = (HEAP32[$ap >> 2] | 0) + (4 - 1) & ~(4 - 1);
   $14 = HEAP32[$13 >> 2] | 0;
   HEAP32[$ap >> 2] = $13 + 4;
   $17 = $arg;
   HEAP32[$17 >> 2] = $14;
   HEAP32[$17 + 4 >> 2] = (($14 | 0) < 0) << 31 >> 31;
   break L1;
   break;
  }
 case 11:
  {
   $26 = (HEAP32[$ap >> 2] | 0) + (4 - 1) & ~(4 - 1);
   $27 = HEAP32[$26 >> 2] | 0;
   HEAP32[$ap >> 2] = $26 + 4;
   $28 = $arg;
   HEAP32[$28 >> 2] = $27;
   HEAP32[$28 + 4 >> 2] = 0;
   break L1;
   break;
  }
 case 12:
  {
   $37 = (HEAP32[$ap >> 2] | 0) + (8 - 1) & ~(8 - 1);
   $38 = $37;
   $40 = HEAP32[$38 >> 2] | 0;
   $43 = HEAP32[$38 + 4 >> 2] | 0;
   HEAP32[$ap >> 2] = $37 + 8;
   $44 = $arg;
   HEAP32[$44 >> 2] = $40;
   HEAP32[$44 + 4 >> 2] = $43;
   break L1;
   break;
  }
 case 13:
  {
   $53 = (HEAP32[$ap >> 2] | 0) + (4 - 1) & ~(4 - 1);
   $54 = HEAP32[$53 >> 2] | 0;
   HEAP32[$ap >> 2] = $53 + 4;
   $56 = ($54 & 65535) << 16 >> 16;
   $59 = $arg;
   HEAP32[$59 >> 2] = $56;
   HEAP32[$59 + 4 >> 2] = (($56 | 0) < 0) << 31 >> 31;
   break L1;
   break;
  }
 case 14:
  {
   $68 = (HEAP32[$ap >> 2] | 0) + (4 - 1) & ~(4 - 1);
   $69 = HEAP32[$68 >> 2] | 0;
   HEAP32[$ap >> 2] = $68 + 4;
   $70 = $arg;
   HEAP32[$70 >> 2] = $69 & 65535;
   HEAP32[$70 + 4 >> 2] = 0;
   break L1;
   break;
  }
 case 15:
  {
   $79 = (HEAP32[$ap >> 2] | 0) + (4 - 1) & ~(4 - 1);
   $80 = HEAP32[$79 >> 2] | 0;
   HEAP32[$ap >> 2] = $79 + 4;
   $82 = ($80 & 255) << 24 >> 24;
   $85 = $arg;
   HEAP32[$85 >> 2] = $82;
   HEAP32[$85 + 4 >> 2] = (($82 | 0) < 0) << 31 >> 31;
   break L1;
   break;
  }
 case 16:
  {
   $94 = (HEAP32[$ap >> 2] | 0) + (4 - 1) & ~(4 - 1);
   $95 = HEAP32[$94 >> 2] | 0;
   HEAP32[$ap >> 2] = $94 + 4;
   $96 = $arg;
   HEAP32[$96 >> 2] = $95 & 255;
   HEAP32[$96 + 4 >> 2] = 0;
   break L1;
   break;
  }
 case 17:
  {
   $105 = (HEAP32[$ap >> 2] | 0) + (8 - 1) & ~(8 - 1);
   $106 = +HEAPF64[$105 >> 3];
   HEAP32[$ap >> 2] = $105 + 8;
   HEAPF64[$arg >> 3] = $106;
   break L1;
   break;
  }
 case 18:
  {
   $112 = (HEAP32[$ap >> 2] | 0) + (8 - 1) & ~(8 - 1);
   $113 = +HEAPF64[$112 >> 3];
   HEAP32[$ap >> 2] = $112 + 8;
   HEAPF64[$arg >> 3] = $113;
   break L1;
   break;
  }
 default:
  break L1;
 } while (0); while (0);
 return;
}

function ___stdio_write($f, $buf, $len) {
 $f = $f | 0;
 $buf = $buf | 0;
 $len = $len | 0;
 var $$0 = 0, $0 = 0, $1 = 0, $10 = 0, $15 = 0, $20 = 0, $25 = 0, $3 = 0, $34 = 0, $36 = 0, $38 = 0, $49 = 0, $5 = 0, $9 = 0, $cnt$0 = 0, $cnt$1 = 0, $iov$0 = 0, $iov$0$lcssa11 = 0, $iov$1 = 0, $iovcnt$0 = 0, $iovcnt$0$lcssa12 = 0, $iovcnt$1 = 0, $iovs = 0, $rem$0 = 0, $vararg_buffer = 0, $vararg_buffer3 = 0, label = 0, sp = 0;
 label = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48 | 0;
 $vararg_buffer3 = sp + 16 | 0;
 $vararg_buffer = sp;
 $iovs = sp + 32 | 0;
 $0 = $f + 28 | 0;
 $1 = HEAP32[$0 >> 2] | 0;
 HEAP32[$iovs >> 2] = $1;
 $3 = $f + 20 | 0;
 $5 = (HEAP32[$3 >> 2] | 0) - $1 | 0;
 HEAP32[$iovs + 4 >> 2] = $5;
 HEAP32[$iovs + 8 >> 2] = $buf;
 HEAP32[$iovs + 12 >> 2] = $len;
 $9 = $f + 60 | 0;
 $10 = $f + 44 | 0;
 $iov$0 = $iovs;
 $iovcnt$0 = 2;
 $rem$0 = $5 + $len | 0;
 while (1) {
  if (!(HEAP32[22824] | 0)) {
   HEAP32[$vararg_buffer3 >> 2] = HEAP32[$9 >> 2];
   HEAP32[$vararg_buffer3 + 4 >> 2] = $iov$0;
   HEAP32[$vararg_buffer3 + 8 >> 2] = $iovcnt$0;
   $cnt$0 = ___syscall_ret(___syscall146(146, $vararg_buffer3 | 0) | 0) | 0;
  } else {
   _pthread_cleanup_push(182, $f | 0);
   HEAP32[$vararg_buffer >> 2] = HEAP32[$9 >> 2];
   HEAP32[$vararg_buffer + 4 >> 2] = $iov$0;
   HEAP32[$vararg_buffer + 8 >> 2] = $iovcnt$0;
   $15 = ___syscall_ret(___syscall146(146, $vararg_buffer | 0) | 0) | 0;
   _pthread_cleanup_pop(0);
   $cnt$0 = $15;
  }
  if (($rem$0 | 0) == ($cnt$0 | 0)) {
   label = 6;
   break;
  }
  if (($cnt$0 | 0) < 0) {
   $iov$0$lcssa11 = $iov$0;
   $iovcnt$0$lcssa12 = $iovcnt$0;
   label = 8;
   break;
  }
  $34 = $rem$0 - $cnt$0 | 0;
  $36 = HEAP32[$iov$0 + 4 >> 2] | 0;
  if ($cnt$0 >>> 0 > $36 >>> 0) {
   $38 = HEAP32[$10 >> 2] | 0;
   HEAP32[$0 >> 2] = $38;
   HEAP32[$3 >> 2] = $38;
   $49 = HEAP32[$iov$0 + 12 >> 2] | 0;
   $cnt$1 = $cnt$0 - $36 | 0;
   $iov$1 = $iov$0 + 8 | 0;
   $iovcnt$1 = $iovcnt$0 + -1 | 0;
  } else if (($iovcnt$0 | 0) == 2) {
   HEAP32[$0 >> 2] = (HEAP32[$0 >> 2] | 0) + $cnt$0;
   $49 = $36;
   $cnt$1 = $cnt$0;
   $iov$1 = $iov$0;
   $iovcnt$1 = 2;
  } else {
   $49 = $36;
   $cnt$1 = $cnt$0;
   $iov$1 = $iov$0;
   $iovcnt$1 = $iovcnt$0;
  }
  HEAP32[$iov$1 >> 2] = (HEAP32[$iov$1 >> 2] | 0) + $cnt$1;
  HEAP32[$iov$1 + 4 >> 2] = $49 - $cnt$1;
  $iov$0 = $iov$1;
  $iovcnt$0 = $iovcnt$1;
  $rem$0 = $34;
 }
 if ((label | 0) == 6) {
  $20 = HEAP32[$10 >> 2] | 0;
  HEAP32[$f + 16 >> 2] = $20 + (HEAP32[$f + 48 >> 2] | 0);
  $25 = $20;
  HEAP32[$0 >> 2] = $25;
  HEAP32[$3 >> 2] = $25;
  $$0 = $len;
 } else if ((label | 0) == 8) {
  HEAP32[$f + 16 >> 2] = 0;
  HEAP32[$0 >> 2] = 0;
  HEAP32[$3 >> 2] = 0;
  HEAP32[$f >> 2] = HEAP32[$f >> 2] | 32;
  if (($iovcnt$0$lcssa12 | 0) == 2) $$0 = 0; else $$0 = $len - (HEAP32[$iov$0$lcssa11 + 4 >> 2] | 0) | 0;
 }
 STACKTOP = sp;
 return $$0 | 0;
}

function _wcsnrtombs($dst, $wcs, $wn, $n, $st) {
 $dst = $dst | 0;
 $wcs = $wcs | 0;
 $wn = $wn | 0;
 $n = $n | 0;
 $st = $st | 0;
 var $$019 = 0, $$02$$0 = 0, $$0218 = 0, $$1 = 0, $$13 = 0, $$214 = 0, $$24 = 0, $$313 = 0, $$cast = 0, $$lcssa = 0, $$lcssa57 = 0, $0 = 0, $1 = 0, $10 = 0, $12 = 0, $13 = 0, $14 = 0, $17 = 0, $23 = 0, $24 = 0, $33 = 0, $38 = 0, $4 = 0, $7 = 0, $8 = 0, $buf = 0, $cnt$020 = 0, $cnt$1 = 0, $cnt$215 = 0, $cnt$215$lcssa = 0, $cnt$3 = 0, $dst$ = 0, $n$ = 0, $s$010 = 0, $s$021 = 0, $s$021$lcssa56 = 0, $s$1 = 0, $s$216 = 0, $ws = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 272 | 0;
 $buf = sp + 8 | 0;
 $ws = sp;
 $0 = HEAP32[$wcs >> 2] | 0;
 HEAP32[$ws >> 2] = $0;
 $1 = ($dst | 0) != 0;
 $n$ = $1 ? $n : 256;
 $dst$ = $1 ? $dst : $buf;
 $$cast = $0;
 L1 : do if (($n$ | 0) != 0 & ($0 | 0) != 0) {
  $$019 = $wn;
  $$0218 = $n$;
  $38 = $$cast;
  $cnt$020 = 0;
  $s$021 = $dst$;
  while (1) {
   $4 = $$019 >>> 0 >= $$0218 >>> 0;
   if (!($4 | $$019 >>> 0 > 32)) {
    $$1 = $$019;
    $$24 = $$0218;
    $17 = $38;
    $cnt$1 = $cnt$020;
    $s$010 = $s$021;
    break L1;
   }
   $$02$$0 = $4 ? $$0218 : $$019;
   $7 = $$019 - $$02$$0 | 0;
   $8 = _wcsrtombs($s$021, $ws, $$02$$0, 0) | 0;
   if (($8 | 0) == -1) {
    $$lcssa57 = $7;
    $s$021$lcssa56 = $s$021;
    break;
   }
   $10 = ($s$021 | 0) == ($buf | 0);
   $12 = $10 ? 0 : $8;
   $$13 = $$0218 - $12 | 0;
   $s$1 = $10 ? $s$021 : $s$021 + $8 | 0;
   $13 = $8 + $cnt$020 | 0;
   $14 = HEAP32[$ws >> 2] | 0;
   if (($$0218 | 0) != ($12 | 0) & ($14 | 0) != 0) {
    $$019 = $7;
    $$0218 = $$13;
    $38 = $14;
    $cnt$020 = $13;
    $s$021 = $s$1;
   } else {
    $$1 = $7;
    $$24 = $$13;
    $17 = $14;
    $cnt$1 = $13;
    $s$010 = $s$1;
    break L1;
   }
  }
  $$1 = $$lcssa57;
  $$24 = 0;
  $17 = HEAP32[$ws >> 2] | 0;
  $cnt$1 = -1;
  $s$010 = $s$021$lcssa56;
 } else {
  $$1 = $wn;
  $$24 = $n$;
  $17 = $$cast;
  $cnt$1 = 0;
  $s$010 = $dst$;
 } while (0);
 L8 : do if (!$17) $cnt$3 = $cnt$1; else if (($$24 | 0) != 0 & ($$1 | 0) != 0) {
  $$214 = $$1;
  $$313 = $$24;
  $23 = $17;
  $cnt$215 = $cnt$1;
  $s$216 = $s$010;
  while (1) {
   $24 = _wcrtomb($s$216, HEAP32[$23 >> 2] | 0, 0) | 0;
   if (($24 + 1 | 0) >>> 0 < 2) {
    $$lcssa = $24;
    $cnt$215$lcssa = $cnt$215;
    break;
   }
   $23 = (HEAP32[$ws >> 2] | 0) + 4 | 0;
   HEAP32[$ws >> 2] = $23;
   $$214 = $$214 + -1 | 0;
   $33 = $cnt$215 + 1 | 0;
   if (!(($$313 | 0) != ($24 | 0) & ($$214 | 0) != 0)) {
    $cnt$3 = $33;
    break L8;
   } else {
    $$313 = $$313 - $24 | 0;
    $cnt$215 = $33;
    $s$216 = $s$216 + $24 | 0;
   }
  }
  if (!$$lcssa) {
   HEAP32[$ws >> 2] = 0;
   $cnt$3 = $cnt$215$lcssa;
  } else $cnt$3 = -1;
 } else $cnt$3 = $cnt$1; while (0);
 if ($1) HEAP32[$wcs >> 2] = HEAP32[$ws >> 2];
 STACKTOP = sp;
 return $cnt$3 | 0;
}

function __ZN8TreeNode18findChildWithValueENSt3__212basic_stringIcNS0_11char_traitsIcEENS0_9allocatorIcEEEE($this, $value) {
 $this = $this | 0;
 $value = $value | 0;
 var $$$0 = 0, $$$0$us = 0, $$$06 = 0, $$$06$us = 0, $$08 = 0, $$08$us = 0, $$12 = 0, $1 = 0, $11 = 0, $12 = 0, $13 = 0, $15 = 0, $21 = 0, $22 = 0, $23 = 0, $26 = 0, $3 = 0, $33 = 0, $34 = 0, $36 = 0, $42 = 0, $43 = 0, $44 = 0, $46 = 0, $6 = 0, $7 = 0, $__begin$sroa$0$07 = 0, $__begin$sroa$0$07$us = 0, $not$ = 0, $not$$us = 0, label = 0;
 label = 0;
 $1 = HEAP32[$this + 20 >> 2] | 0;
 $3 = HEAP32[$this + 24 >> 2] | 0;
 if (($1 | 0) == ($3 | 0)) {
  $$12 = 0;
  return $$12 | 0;
 }
 $6 = HEAP8[$value + 11 >> 0] | 0;
 $7 = $6 << 24 >> 24 < 0;
 $11 = $7 ? HEAP32[$value + 4 >> 2] | 0 : $6 & 255;
 if ($7) {
  $$08$us = 0;
  $__begin$sroa$0$07$us = $1;
  while (1) {
   $12 = HEAP32[$__begin$sroa$0$07$us >> 2] | 0;
   $13 = $12 + 4 | 0;
   $15 = HEAP8[$13 + 11 >> 0] | 0;
   if ($15 << 24 >> 24 < 0) {
    $22 = HEAP32[$12 + 8 >> 2] | 0;
    $26 = HEAP32[$13 >> 2] | 0;
   } else {
    $22 = $15 & 255;
    $26 = $13;
   }
   $21 = $11 >>> 0 < $22 >>> 0;
   $23 = $21 ? $11 : $22;
   if (!$23) label = 8; else if (!(_memcmp($26, HEAP32[$value >> 2] | 0, $23) | 0)) label = 8; else $$$06$us = $$08$us;
   if ((label | 0) == 8) {
    label = 0;
    $not$$us = $22 >>> 0 >= $11 >>> 0;
    $$$0$us = $not$$us & ($21 ^ 1) ? $12 : $$08$us;
    if ($21 | $not$$us ^ 1) $$$06$us = $$$0$us; else {
     $$12 = $$$0$us;
     label = 17;
     break;
    }
   }
   $__begin$sroa$0$07$us = $__begin$sroa$0$07$us + 4 | 0;
   if (($__begin$sroa$0$07$us | 0) == ($3 | 0)) {
    $$12 = 0;
    label = 17;
    break;
   } else $$08$us = $$$06$us;
  }
  if ((label | 0) == 17) return $$12 | 0;
 } else {
  $$08 = 0;
  $__begin$sroa$0$07 = $1;
  while (1) {
   $33 = HEAP32[$__begin$sroa$0$07 >> 2] | 0;
   $34 = $33 + 4 | 0;
   $36 = HEAP8[$34 + 11 >> 0] | 0;
   if ($36 << 24 >> 24 < 0) {
    $43 = HEAP32[$33 + 8 >> 2] | 0;
    $46 = HEAP32[$34 >> 2] | 0;
   } else {
    $43 = $36 & 255;
    $46 = $34;
   }
   $42 = $11 >>> 0 < $43 >>> 0;
   $44 = $42 ? $11 : $43;
   if (!$44) label = 15; else if (!(_memcmp($46, $value, $44) | 0)) label = 15; else $$$06 = $$08;
   if ((label | 0) == 15) {
    label = 0;
    $not$ = $43 >>> 0 >= $11 >>> 0;
    $$$0 = $not$ & ($42 ^ 1) ? $33 : $$08;
    if ($42 | $not$ ^ 1) $$$06 = $$$0; else {
     $$12 = $$$0;
     label = 17;
     break;
    }
   }
   $__begin$sroa$0$07 = $__begin$sroa$0$07 + 4 | 0;
   if (($__begin$sroa$0$07 | 0) == ($3 | 0)) {
    $$12 = 0;
    label = 17;
    break;
   } else $$08 = $$$06;
  }
  if ((label | 0) == 17) return $$12 | 0;
 }
 return 0;
}

function __ZNSt3__26__treeINS_12__value_typeINS_12basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEEN8nlohmann10basic_jsonINS_3mapENS_6vectorES7_bxydS5_NS8_14adl_serializerEEEEENS_19__map_value_compareIS7_SE_NS_4lessIS7_EELb1EEENS5_ISE_EEE12__find_equalIS7_EERPNS_16__tree_node_baseIPvEESQ_RKT_($this, $__parent, $__v) {
 $this = $this | 0;
 $__parent = $__parent | 0;
 $__v = $__v | 0;
 var $$0 = 0, $$lcssa = 0, $$lcssa25 = 0, $$sink = 0, $0 = 0, $1 = 0, $11 = 0, $12 = 0, $14 = 0, $15 = 0, $19 = 0, $20 = 0, $21 = 0, $25 = 0, $29 = 0, $32 = 0, $36 = 0, $39 = 0, $4 = 0, $40 = 0, $5 = 0, $9 = 0, $__nd$0 = 0, $__nd$0$lcssa = 0, $__nd$0$lcssa23 = 0, $__nd$0$lcssa24 = 0, label = 0;
 label = 0;
 $0 = $this + 4 | 0;
 $1 = HEAP32[$0 >> 2] | 0;
 if (!$1) {
  HEAP32[$__parent >> 2] = $0;
  $$0 = $0;
  return $$0 | 0;
 }
 $4 = HEAP8[$__v + 11 >> 0] | 0;
 $5 = $4 << 24 >> 24 < 0;
 $9 = $5 ? HEAP32[$__v + 4 >> 2] | 0 : $4 & 255;
 $11 = $5 ? HEAP32[$__v >> 2] | 0 : $__v;
 $__nd$0 = $1;
 while (1) {
  $12 = $__nd$0 + 16 | 0;
  $14 = HEAP8[$12 + 11 >> 0] | 0;
  $15 = $14 << 24 >> 24 < 0;
  $19 = $15 ? HEAP32[$__nd$0 + 20 >> 2] | 0 : $14 & 255;
  $20 = $19 >>> 0 < $9 >>> 0;
  $21 = $20 ? $19 : $9;
  if (!$21) label = 5; else {
   $25 = _memcmp($11, $15 ? HEAP32[$12 >> 2] | 0 : $12, $21) | 0;
   if (!$25) label = 5; else if (($25 | 0) < 0) label = 7; else label = 9;
  }
  if ((label | 0) == 5) {
   label = 0;
   if ($9 >>> 0 < $19 >>> 0) label = 7; else label = 9;
  }
  if ((label | 0) == 7) {
   label = 0;
   $29 = HEAP32[$__nd$0 >> 2] | 0;
   if (!$29) {
    $$lcssa25 = $__nd$0;
    $__nd$0$lcssa24 = $__nd$0;
    label = 8;
    break;
   } else $$sink = $29;
  } else if ((label | 0) == 9) {
   label = 0;
   $32 = $9 >>> 0 < $19 >>> 0 ? $9 : $19;
   if (!$32) label = 11; else {
    $36 = _memcmp($15 ? HEAP32[$12 >> 2] | 0 : $12, $11, $32) | 0;
    if (!$36) label = 11; else if (($36 | 0) >= 0) {
     $__nd$0$lcssa = $__nd$0;
     label = 16;
     break;
    }
   }
   if ((label | 0) == 11) {
    label = 0;
    if (!$20) {
     $__nd$0$lcssa = $__nd$0;
     label = 16;
     break;
    }
   }
   $39 = $__nd$0 + 4 | 0;
   $40 = HEAP32[$39 >> 2] | 0;
   if (!$40) {
    $$lcssa = $39;
    $__nd$0$lcssa23 = $__nd$0;
    label = 15;
    break;
   } else $$sink = $40;
  }
  $__nd$0 = $$sink;
 }
 if ((label | 0) == 8) {
  HEAP32[$__parent >> 2] = $__nd$0$lcssa24;
  $$0 = $$lcssa25;
  return $$0 | 0;
 } else if ((label | 0) == 15) {
  HEAP32[$__parent >> 2] = $__nd$0$lcssa23;
  $$0 = $$lcssa;
  return $$0 | 0;
 } else if ((label | 0) == 16) {
  HEAP32[$__parent >> 2] = $__nd$0$lcssa;
  $$0 = $__parent;
  return $$0 | 0;
 }
 return 0;
}

function __ZNSt3__29__num_getIwE17__stage2_int_loopEwiPcRS2_RjwRKNS_12basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEEPjRSD_Pw($__ct, $__base, $__a, $__a_end, $__dc, $__thousands_sep, $__grouping, $__g, $__g_end, $__atoms) {
 $__ct = $__ct | 0;
 $__base = $__base | 0;
 $__a = $__a | 0;
 $__a_end = $__a_end | 0;
 $__dc = $__dc | 0;
 $__thousands_sep = $__thousands_sep | 0;
 $__grouping = $__grouping | 0;
 $__g = $__g | 0;
 $__g_end = $__g_end | 0;
 $__atoms = $__atoms | 0;
 var $$0$i = 0, $$0$lcssa$i = 0, $$1 = 0, $0 = 0, $1 = 0, $11 = 0, $19 = 0, $24 = 0, $26 = 0, $33 = 0, $34 = 0, $4 = 0, $46 = 0, $49 = 0, label = 0;
 label = 0;
 $0 = HEAP32[$__a_end >> 2] | 0;
 $1 = ($0 | 0) == ($__a | 0);
 do if ($1) {
  $4 = (HEAP32[$__atoms + 96 >> 2] | 0) == ($__ct | 0);
  if (!$4) if ((HEAP32[$__atoms + 100 >> 2] | 0) != ($__ct | 0)) {
   label = 5;
   break;
  }
  HEAP32[$__a_end >> 2] = $__a + 1;
  HEAP8[$__a >> 0] = $4 ? 43 : 45;
  HEAP32[$__dc >> 2] = 0;
  $$1 = 0;
 } else label = 5; while (0);
 L6 : do if ((label | 0) == 5) {
  $11 = HEAP8[$__grouping + 11 >> 0] | 0;
  if (($__ct | 0) == ($__thousands_sep | 0) ? (($11 << 24 >> 24 < 0 ? HEAP32[$__grouping + 4 >> 2] | 0 : $11 & 255) | 0) != 0 : 0) {
   $19 = HEAP32[$__g_end >> 2] | 0;
   if (($19 - $__g | 0) >= 160) {
    $$1 = 0;
    break;
   }
   $24 = HEAP32[$__dc >> 2] | 0;
   HEAP32[$__g_end >> 2] = $19 + 4;
   HEAP32[$19 >> 2] = $24;
   HEAP32[$__dc >> 2] = 0;
   $$1 = 0;
   break;
  }
  $26 = $__atoms + 104 | 0;
  $$0$i = $__atoms;
  while (1) {
   if (($$0$i | 0) == ($26 | 0)) {
    $$0$lcssa$i = $26;
    break;
   }
   if ((HEAP32[$$0$i >> 2] | 0) == ($__ct | 0)) {
    $$0$lcssa$i = $$0$i;
    break;
   }
   $$0$i = $$0$i + 4 | 0;
  }
  $33 = $$0$lcssa$i - $__atoms | 0;
  $34 = $33 >> 2;
  if (($33 | 0) > 92) $$1 = -1; else {
   switch ($__base | 0) {
   case 10:
   case 8:
    {
     if (($34 | 0) >= ($__base | 0)) {
      $$1 = -1;
      break L6;
     }
     break;
    }
   case 16:
    {
     if (($33 | 0) >= 88) {
      if ($1) {
       $$1 = -1;
       break L6;
      }
      if (($0 - $__a | 0) >= 3) {
       $$1 = -1;
       break L6;
      }
      if ((HEAP8[$0 + -1 >> 0] | 0) != 48) {
       $$1 = -1;
       break L6;
      }
      HEAP32[$__dc >> 2] = 0;
      $46 = HEAP8[80874 + $34 >> 0] | 0;
      HEAP32[$__a_end >> 2] = $0 + 1;
      HEAP8[$0 >> 0] = $46;
      $$1 = 0;
      break L6;
     }
     break;
    }
   default:
    {}
   }
   $49 = HEAP8[80874 + $34 >> 0] | 0;
   HEAP32[$__a_end >> 2] = $0 + 1;
   HEAP8[$0 >> 0] = $49;
   HEAP32[$__dc >> 2] = (HEAP32[$__dc >> 2] | 0) + 1;
   $$1 = 0;
  }
 } while (0);
 return $$1 | 0;
}

function __ZNSt3__29__num_getIcE17__stage2_int_loopEciPcRS2_RjcRKNS_12basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEEPjRSD_S2_($__ct, $__base, $__a, $__a_end, $__dc, $__thousands_sep, $__grouping, $__g, $__g_end, $__atoms) {
 $__ct = $__ct | 0;
 $__base = $__base | 0;
 $__a = $__a | 0;
 $__a_end = $__a_end | 0;
 $__dc = $__dc | 0;
 $__thousands_sep = $__thousands_sep | 0;
 $__grouping = $__grouping | 0;
 $__g = $__g | 0;
 $__g_end = $__g_end | 0;
 $__atoms = $__atoms | 0;
 var $$0$i = 0, $$0$lcssa$i = 0, $$1 = 0, $0 = 0, $1 = 0, $11 = 0, $19 = 0, $24 = 0, $26 = 0, $33 = 0, $4 = 0, $45 = 0, $48 = 0, label = 0;
 label = 0;
 $0 = HEAP32[$__a_end >> 2] | 0;
 $1 = ($0 | 0) == ($__a | 0);
 do if ($1) {
  $4 = (HEAP8[$__atoms + 24 >> 0] | 0) == $__ct << 24 >> 24;
  if (!$4) if ((HEAP8[$__atoms + 25 >> 0] | 0) != $__ct << 24 >> 24) {
   label = 5;
   break;
  }
  HEAP32[$__a_end >> 2] = $__a + 1;
  HEAP8[$__a >> 0] = $4 ? 43 : 45;
  HEAP32[$__dc >> 2] = 0;
  $$1 = 0;
 } else label = 5; while (0);
 L6 : do if ((label | 0) == 5) {
  $11 = HEAP8[$__grouping + 11 >> 0] | 0;
  if ($__ct << 24 >> 24 == $__thousands_sep << 24 >> 24 ? (($11 << 24 >> 24 < 0 ? HEAP32[$__grouping + 4 >> 2] | 0 : $11 & 255) | 0) != 0 : 0) {
   $19 = HEAP32[$__g_end >> 2] | 0;
   if (($19 - $__g | 0) >= 160) {
    $$1 = 0;
    break;
   }
   $24 = HEAP32[$__dc >> 2] | 0;
   HEAP32[$__g_end >> 2] = $19 + 4;
   HEAP32[$19 >> 2] = $24;
   HEAP32[$__dc >> 2] = 0;
   $$1 = 0;
   break;
  }
  $26 = $__atoms + 26 | 0;
  $$0$i = $__atoms;
  while (1) {
   if (($$0$i | 0) == ($26 | 0)) {
    $$0$lcssa$i = $26;
    break;
   }
   if ((HEAP8[$$0$i >> 0] | 0) == $__ct << 24 >> 24) {
    $$0$lcssa$i = $$0$i;
    break;
   }
   $$0$i = $$0$i + 1 | 0;
  }
  $33 = $$0$lcssa$i - $__atoms | 0;
  if (($33 | 0) > 23) $$1 = -1; else {
   switch ($__base | 0) {
   case 10:
   case 8:
    {
     if (($33 | 0) >= ($__base | 0)) {
      $$1 = -1;
      break L6;
     }
     break;
    }
   case 16:
    {
     if (($33 | 0) >= 22) {
      if ($1) {
       $$1 = -1;
       break L6;
      }
      if (($0 - $__a | 0) >= 3) {
       $$1 = -1;
       break L6;
      }
      if ((HEAP8[$0 + -1 >> 0] | 0) != 48) {
       $$1 = -1;
       break L6;
      }
      HEAP32[$__dc >> 2] = 0;
      $45 = HEAP8[80874 + $33 >> 0] | 0;
      HEAP32[$__a_end >> 2] = $0 + 1;
      HEAP8[$0 >> 0] = $45;
      $$1 = 0;
      break L6;
     }
     break;
    }
   default:
    {}
   }
   $48 = HEAP8[80874 + $33 >> 0] | 0;
   HEAP32[$__a_end >> 2] = $0 + 1;
   HEAP8[$0 >> 0] = $48;
   HEAP32[$__dc >> 2] = (HEAP32[$__dc >> 2] | 0) + 1;
   $$1 = 0;
  }
 } while (0);
 return $$1 | 0;
}

function __ZNSt3__26__treeINS_12__value_typeINS_12basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEES7_EENS_19__map_value_compareIS7_S8_NS_4lessIS7_EELb1EEENS5_IS8_EEE12__find_equalIS7_EERPNS_16__tree_node_baseIPvEESK_RKT_($this, $__parent, $__v) {
 $this = $this | 0;
 $__parent = $__parent | 0;
 $__v = $__v | 0;
 var $$0 = 0, $$lcssa = 0, $$lcssa25 = 0, $$sink = 0, $0 = 0, $1 = 0, $11 = 0, $12 = 0, $14 = 0, $15 = 0, $19 = 0, $20 = 0, $21 = 0, $25 = 0, $29 = 0, $32 = 0, $36 = 0, $39 = 0, $4 = 0, $40 = 0, $5 = 0, $9 = 0, $__nd$0 = 0, $__nd$0$lcssa = 0, $__nd$0$lcssa23 = 0, $__nd$0$lcssa24 = 0, label = 0;
 label = 0;
 $0 = $this + 4 | 0;
 $1 = HEAP32[$0 >> 2] | 0;
 if (!$1) {
  HEAP32[$__parent >> 2] = $0;
  $$0 = $0;
  return $$0 | 0;
 }
 $4 = HEAP8[$__v + 11 >> 0] | 0;
 $5 = $4 << 24 >> 24 < 0;
 $9 = $5 ? HEAP32[$__v + 4 >> 2] | 0 : $4 & 255;
 $11 = $5 ? HEAP32[$__v >> 2] | 0 : $__v;
 $__nd$0 = $1;
 while (1) {
  $12 = $__nd$0 + 16 | 0;
  $14 = HEAP8[$12 + 11 >> 0] | 0;
  $15 = $14 << 24 >> 24 < 0;
  $19 = $15 ? HEAP32[$__nd$0 + 20 >> 2] | 0 : $14 & 255;
  $20 = $19 >>> 0 < $9 >>> 0;
  $21 = $20 ? $19 : $9;
  if (!$21) label = 5; else {
   $25 = _memcmp($11, $15 ? HEAP32[$12 >> 2] | 0 : $12, $21) | 0;
   if (!$25) label = 5; else if (($25 | 0) < 0) label = 7; else label = 9;
  }
  if ((label | 0) == 5) {
   label = 0;
   if ($9 >>> 0 < $19 >>> 0) label = 7; else label = 9;
  }
  if ((label | 0) == 7) {
   label = 0;
   $29 = HEAP32[$__nd$0 >> 2] | 0;
   if (!$29) {
    $$lcssa25 = $__nd$0;
    $__nd$0$lcssa24 = $__nd$0;
    label = 8;
    break;
   } else $$sink = $29;
  } else if ((label | 0) == 9) {
   label = 0;
   $32 = $9 >>> 0 < $19 >>> 0 ? $9 : $19;
   if (!$32) label = 11; else {
    $36 = _memcmp($15 ? HEAP32[$12 >> 2] | 0 : $12, $11, $32) | 0;
    if (!$36) label = 11; else if (($36 | 0) >= 0) {
     $__nd$0$lcssa = $__nd$0;
     label = 16;
     break;
    }
   }
   if ((label | 0) == 11) {
    label = 0;
    if (!$20) {
     $__nd$0$lcssa = $__nd$0;
     label = 16;
     break;
    }
   }
   $39 = $__nd$0 + 4 | 0;
   $40 = HEAP32[$39 >> 2] | 0;
   if (!$40) {
    $$lcssa = $39;
    $__nd$0$lcssa23 = $__nd$0;
    label = 15;
    break;
   } else $$sink = $40;
  }
  $__nd$0 = $$sink;
 }
 if ((label | 0) == 8) {
  HEAP32[$__parent >> 2] = $__nd$0$lcssa24;
  $$0 = $$lcssa25;
  return $$0 | 0;
 } else if ((label | 0) == 15) {
  HEAP32[$__parent >> 2] = $__nd$0$lcssa23;
  $$0 = $$lcssa;
  return $$0 | 0;
 } else if ((label | 0) == 16) {
  HEAP32[$__parent >> 2] = $__nd$0$lcssa;
  $$0 = $__parent;
  return $$0 | 0;
 }
 return 0;
}

function __ZNSt3__26__treeINS_12__value_typeINS_12basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEEbEENS_19__map_value_compareIS7_S8_NS_4lessIS7_EELb1EEENS5_IS8_EEE12__find_equalIS7_EERPNS_16__tree_node_baseIPvEESK_RKT_($this, $__parent, $__v) {
 $this = $this | 0;
 $__parent = $__parent | 0;
 $__v = $__v | 0;
 var $$0 = 0, $$lcssa = 0, $$lcssa25 = 0, $$sink = 0, $0 = 0, $1 = 0, $11 = 0, $12 = 0, $14 = 0, $15 = 0, $19 = 0, $20 = 0, $21 = 0, $25 = 0, $29 = 0, $32 = 0, $36 = 0, $39 = 0, $4 = 0, $40 = 0, $5 = 0, $9 = 0, $__nd$0 = 0, $__nd$0$lcssa = 0, $__nd$0$lcssa23 = 0, $__nd$0$lcssa24 = 0, label = 0;
 label = 0;
 $0 = $this + 4 | 0;
 $1 = HEAP32[$0 >> 2] | 0;
 if (!$1) {
  HEAP32[$__parent >> 2] = $0;
  $$0 = $0;
  return $$0 | 0;
 }
 $4 = HEAP8[$__v + 11 >> 0] | 0;
 $5 = $4 << 24 >> 24 < 0;
 $9 = $5 ? HEAP32[$__v + 4 >> 2] | 0 : $4 & 255;
 $11 = $5 ? HEAP32[$__v >> 2] | 0 : $__v;
 $__nd$0 = $1;
 while (1) {
  $12 = $__nd$0 + 16 | 0;
  $14 = HEAP8[$12 + 11 >> 0] | 0;
  $15 = $14 << 24 >> 24 < 0;
  $19 = $15 ? HEAP32[$__nd$0 + 20 >> 2] | 0 : $14 & 255;
  $20 = $19 >>> 0 < $9 >>> 0;
  $21 = $20 ? $19 : $9;
  if (!$21) label = 5; else {
   $25 = _memcmp($11, $15 ? HEAP32[$12 >> 2] | 0 : $12, $21) | 0;
   if (!$25) label = 5; else if (($25 | 0) < 0) label = 7; else label = 9;
  }
  if ((label | 0) == 5) {
   label = 0;
   if ($9 >>> 0 < $19 >>> 0) label = 7; else label = 9;
  }
  if ((label | 0) == 7) {
   label = 0;
   $29 = HEAP32[$__nd$0 >> 2] | 0;
   if (!$29) {
    $$lcssa25 = $__nd$0;
    $__nd$0$lcssa24 = $__nd$0;
    label = 8;
    break;
   } else $$sink = $29;
  } else if ((label | 0) == 9) {
   label = 0;
   $32 = $9 >>> 0 < $19 >>> 0 ? $9 : $19;
   if (!$32) label = 11; else {
    $36 = _memcmp($15 ? HEAP32[$12 >> 2] | 0 : $12, $11, $32) | 0;
    if (!$36) label = 11; else if (($36 | 0) >= 0) {
     $__nd$0$lcssa = $__nd$0;
     label = 16;
     break;
    }
   }
   if ((label | 0) == 11) {
    label = 0;
    if (!$20) {
     $__nd$0$lcssa = $__nd$0;
     label = 16;
     break;
    }
   }
   $39 = $__nd$0 + 4 | 0;
   $40 = HEAP32[$39 >> 2] | 0;
   if (!$40) {
    $$lcssa = $39;
    $__nd$0$lcssa23 = $__nd$0;
    label = 15;
    break;
   } else $$sink = $40;
  }
  $__nd$0 = $$sink;
 }
 if ((label | 0) == 8) {
  HEAP32[$__parent >> 2] = $__nd$0$lcssa24;
  $$0 = $$lcssa25;
  return $$0 | 0;
 } else if ((label | 0) == 15) {
  HEAP32[$__parent >> 2] = $__nd$0$lcssa23;
  $$0 = $$lcssa;
  return $$0 | 0;
 } else if ((label | 0) == 16) {
  HEAP32[$__parent >> 2] = $__nd$0$lcssa;
  $$0 = $__parent;
  return $$0 | 0;
 }
 return 0;
}

function _memchr($src, $c, $n) {
 $src = $src | 0;
 $c = $c | 0;
 $n = $n | 0;
 var $$0$lcssa = 0, $$0$lcssa30 = 0, $$019 = 0, $$1$lcssa = 0, $$110 = 0, $$110$lcssa = 0, $$24 = 0, $$3 = 0, $$lcssa = 0, $0 = 0, $13 = 0, $15 = 0, $17 = 0, $20 = 0, $26 = 0, $27 = 0, $32 = 0, $4 = 0, $5 = 0, $8 = 0, $9 = 0, $s$0$lcssa = 0, $s$0$lcssa29 = 0, $s$020 = 0, $s$15 = 0, $s$2 = 0, $w$0$lcssa = 0, $w$011 = 0, $w$011$lcssa = 0, label = 0;
 label = 0;
 $0 = $c & 255;
 $4 = ($n | 0) != 0;
 L1 : do if ($4 & ($src & 3 | 0) != 0) {
  $5 = $c & 255;
  $$019 = $n;
  $s$020 = $src;
  while (1) {
   if ((HEAP8[$s$020 >> 0] | 0) == $5 << 24 >> 24) {
    $$0$lcssa30 = $$019;
    $s$0$lcssa29 = $s$020;
    label = 6;
    break L1;
   }
   $8 = $s$020 + 1 | 0;
   $9 = $$019 + -1 | 0;
   $13 = ($9 | 0) != 0;
   if ($13 & ($8 & 3 | 0) != 0) {
    $$019 = $9;
    $s$020 = $8;
   } else {
    $$0$lcssa = $9;
    $$lcssa = $13;
    $s$0$lcssa = $8;
    label = 5;
    break;
   }
  }
 } else {
  $$0$lcssa = $n;
  $$lcssa = $4;
  $s$0$lcssa = $src;
  label = 5;
 } while (0);
 if ((label | 0) == 5) if ($$lcssa) {
  $$0$lcssa30 = $$0$lcssa;
  $s$0$lcssa29 = $s$0$lcssa;
  label = 6;
 } else {
  $$3 = 0;
  $s$2 = $s$0$lcssa;
 }
 L8 : do if ((label | 0) == 6) {
  $15 = $c & 255;
  if ((HEAP8[$s$0$lcssa29 >> 0] | 0) == $15 << 24 >> 24) {
   $$3 = $$0$lcssa30;
   $s$2 = $s$0$lcssa29;
  } else {
   $17 = Math_imul($0, 16843009) | 0;
   L11 : do if ($$0$lcssa30 >>> 0 > 3) {
    $$110 = $$0$lcssa30;
    $w$011 = $s$0$lcssa29;
    while (1) {
     $20 = HEAP32[$w$011 >> 2] ^ $17;
     if (($20 & -2139062144 ^ -2139062144) & $20 + -16843009 | 0) {
      $$110$lcssa = $$110;
      $w$011$lcssa = $w$011;
      break;
     }
     $26 = $w$011 + 4 | 0;
     $27 = $$110 + -4 | 0;
     if ($27 >>> 0 > 3) {
      $$110 = $27;
      $w$011 = $26;
     } else {
      $$1$lcssa = $27;
      $w$0$lcssa = $26;
      label = 11;
      break L11;
     }
    }
    $$24 = $$110$lcssa;
    $s$15 = $w$011$lcssa;
   } else {
    $$1$lcssa = $$0$lcssa30;
    $w$0$lcssa = $s$0$lcssa29;
    label = 11;
   } while (0);
   if ((label | 0) == 11) if (!$$1$lcssa) {
    $$3 = 0;
    $s$2 = $w$0$lcssa;
    break;
   } else {
    $$24 = $$1$lcssa;
    $s$15 = $w$0$lcssa;
   }
   while (1) {
    if ((HEAP8[$s$15 >> 0] | 0) == $15 << 24 >> 24) {
     $$3 = $$24;
     $s$2 = $s$15;
     break L8;
    }
    $32 = $s$15 + 1 | 0;
    $$24 = $$24 + -1 | 0;
    if (!$$24) {
     $$3 = 0;
     $s$2 = $32;
     break;
    } else $s$15 = $32;
   }
  }
 } while (0);
 return ($$3 | 0 ? $s$2 : 0) | 0;
}

function __ZNSt3__26__treeINS_12__value_typeINS_12basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEES7_EENS_19__map_value_compareIS7_S8_NS_4lessIS7_EELb1EEENS5_IS8_EEE4findIS7_EENS_15__tree_iteratorIS8_PNS_11__tree_nodeIS8_PvEEiEERKT_($this, $__v) {
 $this = $this | 0;
 $__v = $__v | 0;
 var $$0$ph$lcssa$i = 0, $$0$ph8$i = 0, $$01$ph7$i = 0, $$014$i = 0, $$014$i$lcssa = 0, $$sroa$0$0 = 0, $0 = 0, $1 = 0, $11 = 0, $12 = 0, $14 = 0, $15 = 0, $19 = 0, $21 = 0, $25 = 0, $35 = 0, $37 = 0, $38 = 0, $4 = 0, $42 = 0, $44 = 0, $48 = 0, $5 = 0, $9 = 0, label = 0;
 label = 0;
 $0 = $this + 4 | 0;
 $1 = HEAP32[$0 >> 2] | 0;
 do if ($1 | 0) {
  $4 = HEAP8[$__v + 11 >> 0] | 0;
  $5 = $4 << 24 >> 24 < 0;
  $9 = $5 ? HEAP32[$__v + 4 >> 2] | 0 : $4 & 255;
  $11 = $5 ? HEAP32[$__v >> 2] | 0 : $__v;
  $$0$ph8$i = $0;
  $$01$ph7$i = $1;
  L3 : while (1) {
   $$014$i = $$01$ph7$i;
   while (1) {
    $12 = $$014$i + 16 | 0;
    $14 = HEAP8[$12 + 11 >> 0] | 0;
    $15 = $14 << 24 >> 24 < 0;
    $19 = $15 ? HEAP32[$$014$i + 20 >> 2] | 0 : $14 & 255;
    $21 = $9 >>> 0 < $19 >>> 0 ? $9 : $19;
    if (!$21) label = 6; else {
     $25 = _memcmp($15 ? HEAP32[$12 >> 2] | 0 : $12, $11, $21) | 0;
     if (!$25) label = 6; else if (($25 | 0) >= 0) {
      $$014$i$lcssa = $$014$i;
      break;
     }
    }
    if ((label | 0) == 6) {
     label = 0;
     if ($19 >>> 0 >= $9 >>> 0) {
      $$014$i$lcssa = $$014$i;
      break;
     }
    }
    $$014$i = HEAP32[$$014$i + 4 >> 2] | 0;
    if (!$$014$i) {
     $$0$ph$lcssa$i = $$0$ph8$i;
     break L3;
    }
   }
   $$01$ph7$i = HEAP32[$$014$i$lcssa >> 2] | 0;
   if (!$$01$ph7$i) {
    $$0$ph$lcssa$i = $$014$i$lcssa;
    break;
   } else $$0$ph8$i = $$014$i$lcssa;
  }
  if (($$0$ph$lcssa$i | 0) != ($0 | 0)) {
   $35 = $$0$ph$lcssa$i + 16 | 0;
   $37 = HEAP8[$35 + 11 >> 0] | 0;
   $38 = $37 << 24 >> 24 < 0;
   $42 = $38 ? HEAP32[$$0$ph$lcssa$i + 20 >> 2] | 0 : $37 & 255;
   $44 = $42 >>> 0 < $9 >>> 0 ? $42 : $9;
   if ($44 | 0) {
    $48 = _memcmp($11, $38 ? HEAP32[$35 >> 2] | 0 : $35, $44) | 0;
    if ($48 | 0) {
     if (($48 | 0) < 0) break; else $$sroa$0$0 = $$0$ph$lcssa$i;
     return $$sroa$0$0 | 0;
    }
   }
   if ($9 >>> 0 >= $42 >>> 0) {
    $$sroa$0$0 = $$0$ph$lcssa$i;
    return $$sroa$0$0 | 0;
   }
  }
 } while (0);
 $$sroa$0$0 = $0;
 return $$sroa$0$0 | 0;
}

function __ZNSt3__26__treeINS_12__value_typeINS_12basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEEbEENS_19__map_value_compareIS7_S8_NS_4lessIS7_EELb1EEENS5_IS8_EEE4findIS7_EENS_15__tree_iteratorIS8_PNS_11__tree_nodeIS8_PvEEiEERKT_($this, $__v) {
 $this = $this | 0;
 $__v = $__v | 0;
 var $$0$ph$lcssa$i = 0, $$0$ph8$i = 0, $$01$ph7$i = 0, $$014$i = 0, $$014$i$lcssa = 0, $$sroa$0$0 = 0, $0 = 0, $1 = 0, $11 = 0, $12 = 0, $14 = 0, $15 = 0, $19 = 0, $21 = 0, $25 = 0, $35 = 0, $37 = 0, $38 = 0, $4 = 0, $42 = 0, $44 = 0, $48 = 0, $5 = 0, $9 = 0, label = 0;
 label = 0;
 $0 = $this + 4 | 0;
 $1 = HEAP32[$0 >> 2] | 0;
 do if ($1 | 0) {
  $4 = HEAP8[$__v + 11 >> 0] | 0;
  $5 = $4 << 24 >> 24 < 0;
  $9 = $5 ? HEAP32[$__v + 4 >> 2] | 0 : $4 & 255;
  $11 = $5 ? HEAP32[$__v >> 2] | 0 : $__v;
  $$0$ph8$i = $0;
  $$01$ph7$i = $1;
  L3 : while (1) {
   $$014$i = $$01$ph7$i;
   while (1) {
    $12 = $$014$i + 16 | 0;
    $14 = HEAP8[$12 + 11 >> 0] | 0;
    $15 = $14 << 24 >> 24 < 0;
    $19 = $15 ? HEAP32[$$014$i + 20 >> 2] | 0 : $14 & 255;
    $21 = $9 >>> 0 < $19 >>> 0 ? $9 : $19;
    if (!$21) label = 6; else {
     $25 = _memcmp($15 ? HEAP32[$12 >> 2] | 0 : $12, $11, $21) | 0;
     if (!$25) label = 6; else if (($25 | 0) >= 0) {
      $$014$i$lcssa = $$014$i;
      break;
     }
    }
    if ((label | 0) == 6) {
     label = 0;
     if ($19 >>> 0 >= $9 >>> 0) {
      $$014$i$lcssa = $$014$i;
      break;
     }
    }
    $$014$i = HEAP32[$$014$i + 4 >> 2] | 0;
    if (!$$014$i) {
     $$0$ph$lcssa$i = $$0$ph8$i;
     break L3;
    }
   }
   $$01$ph7$i = HEAP32[$$014$i$lcssa >> 2] | 0;
   if (!$$01$ph7$i) {
    $$0$ph$lcssa$i = $$014$i$lcssa;
    break;
   } else $$0$ph8$i = $$014$i$lcssa;
  }
  if (($$0$ph$lcssa$i | 0) != ($0 | 0)) {
   $35 = $$0$ph$lcssa$i + 16 | 0;
   $37 = HEAP8[$35 + 11 >> 0] | 0;
   $38 = $37 << 24 >> 24 < 0;
   $42 = $38 ? HEAP32[$$0$ph$lcssa$i + 20 >> 2] | 0 : $37 & 255;
   $44 = $42 >>> 0 < $9 >>> 0 ? $42 : $9;
   if ($44 | 0) {
    $48 = _memcmp($11, $38 ? HEAP32[$35 >> 2] | 0 : $35, $44) | 0;
    if ($48 | 0) {
     if (($48 | 0) < 0) break; else $$sroa$0$0 = $$0$ph$lcssa$i;
     return $$sroa$0$0 | 0;
    }
   }
   if ($9 >>> 0 >= $42 >>> 0) {
    $$sroa$0$0 = $$0$ph$lcssa$i;
    return $$sroa$0$0 | 0;
   }
  }
 } while (0);
 $$sroa$0$0 = $0;
 return $$sroa$0$0 | 0;
}

function _mbrtowc($wc, $src, $n, $st) {
 $wc = $wc | 0;
 $src = $src | 0;
 $n = $n | 0;
 $st = $st | 0;
 var $$0 = 0, $$024 = 0, $$1 = 0, $$lcssa = 0, $$lcssa35 = 0, $$st = 0, $1 = 0, $12 = 0, $16 = 0, $17 = 0, $19 = 0, $21 = 0, $30 = 0, $7 = 0, $8 = 0, $c$05 = 0, $c$1 = 0, $c$2 = 0, $dummy = 0, $dummy$wc = 0, $s$06 = 0, $s$1 = 0, label = 0, sp = 0;
 label = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16 | 0;
 $dummy = sp;
 $$st = ($st | 0) == 0 ? 91344 : $st;
 $1 = HEAP32[$$st >> 2] | 0;
 L1 : do if (!$src) if (!$1) $$0 = 0; else label = 15; else {
  $dummy$wc = ($wc | 0) == 0 ? $dummy : $wc;
  if (!$n) $$0 = -2; else {
   if (!$1) {
    $7 = HEAP8[$src >> 0] | 0;
    $8 = $7 & 255;
    if ($7 << 24 >> 24 > -1) {
     HEAP32[$dummy$wc >> 2] = $8;
     $$0 = $7 << 24 >> 24 != 0 & 1;
     break;
    }
    $12 = $8 + -194 | 0;
    if ($12 >>> 0 > 50) {
     label = 15;
     break;
    }
    $16 = HEAP32[3268 + ($12 << 2) >> 2] | 0;
    $17 = $n + -1 | 0;
    if (!$17) $c$2 = $16; else {
     $$024 = $17;
     $c$05 = $16;
     $s$06 = $src + 1 | 0;
     label = 9;
    }
   } else {
    $$024 = $n;
    $c$05 = $1;
    $s$06 = $src;
    label = 9;
   }
   L11 : do if ((label | 0) == 9) {
    $19 = HEAP8[$s$06 >> 0] | 0;
    $21 = ($19 & 255) >>> 3;
    if (($21 + -16 | $21 + ($c$05 >> 26)) >>> 0 > 7) {
     label = 15;
     break L1;
    } else {
     $$1 = $$024;
     $30 = $19;
     $c$1 = $c$05;
     $s$1 = $s$06;
    }
    while (1) {
     $s$1 = $s$1 + 1 | 0;
     $c$1 = ($30 & 255) + -128 | $c$1 << 6;
     $$1 = $$1 + -1 | 0;
     if (($c$1 | 0) >= 0) {
      $$lcssa = $c$1;
      $$lcssa35 = $$1;
      break;
     }
     if (!$$1) {
      $c$2 = $c$1;
      break L11;
     }
     $30 = HEAP8[$s$1 >> 0] | 0;
     if (($30 & -64) << 24 >> 24 != -128) {
      label = 15;
      break L1;
     }
    }
    HEAP32[$$st >> 2] = 0;
    HEAP32[$dummy$wc >> 2] = $$lcssa;
    $$0 = $n - $$lcssa35 | 0;
    break L1;
   } while (0);
   HEAP32[$$st >> 2] = $c$2;
   $$0 = -2;
  }
 } while (0);
 if ((label | 0) == 15) {
  HEAP32[$$st >> 2] = 0;
  HEAP32[(___errno_location() | 0) >> 2] = 84;
  $$0 = -1;
 }
 STACKTOP = sp;
 return $$0 | 0;
}

function __GLOBAL__sub_I_script_cpp() {
 HEAP32[21265] = 0;
 HEAP32[21266] = 0;
 HEAP32[21267] = 0;
 HEAP32[21271] = 0;
 HEAP32[21272] = 0;
 HEAP32[21273] = 0;
 HEAP32[21277] = 0;
 HEAP32[21278] = 0;
 HEAP32[21279] = 0;
 HEAP32[21283] = 0;
 HEAP32[21284] = 0;
 HEAP32[21285] = 0;
 HEAP32[21289] = 0;
 HEAP32[21290] = 0;
 HEAP32[21291] = 0;
 HEAP32[21295] = 0;
 HEAP32[21296] = 0;
 HEAP32[21297] = 0;
 HEAP32[21301] = 0;
 HEAP32[21302] = 0;
 HEAP32[21303] = 0;
 HEAP32[21307] = 0;
 HEAP32[21308] = 0;
 HEAP32[21309] = 0;
 HEAP32[21313] = 0;
 HEAP32[21314] = 0;
 HEAP32[21315] = 0;
 HEAP32[21319] = 0;
 HEAP32[21320] = 0;
 HEAP32[21321] = 0;
 HEAP32[21325] = 0;
 HEAP32[21326] = 0;
 HEAP32[21327] = 0;
 HEAP32[21331] = 0;
 HEAP32[21332] = 0;
 HEAP32[21333] = 0;
 HEAP32[21337] = 0;
 HEAP32[21338] = 0;
 HEAP32[21339] = 0;
 HEAP32[21343] = 0;
 HEAP32[21344] = 0;
 HEAP32[21345] = 0;
 HEAP32[21349] = 0;
 HEAP32[21350] = 0;
 HEAP32[21351] = 0;
 HEAP32[21355] = 0;
 HEAP32[21356] = 0;
 HEAP32[21357] = 0;
 HEAP32[21361] = 0;
 HEAP32[21362] = 0;
 HEAP32[21363] = 0;
 HEAP32[21367] = 0;
 HEAP32[21368] = 0;
 HEAP32[21369] = 0;
 HEAP32[21373] = 0;
 HEAP32[21374] = 0;
 HEAP32[21375] = 0;
 HEAP32[21379] = 0;
 HEAP32[21380] = 0;
 HEAP32[21381] = 0;
 HEAP32[21385] = 0;
 HEAP32[21386] = 0;
 HEAP32[21387] = 0;
 HEAP32[21391] = 0;
 HEAP32[21392] = 0;
 HEAP32[21393] = 0;
 HEAP32[21397] = 0;
 HEAP32[21398] = 0;
 HEAP32[21399] = 0;
 HEAP32[21403] = 0;
 HEAP32[21404] = 0;
 HEAP32[21405] = 0;
 HEAP32[21409] = 0;
 HEAP32[21410] = 0;
 HEAP32[21411] = 0;
 HEAP32[21415] = 0;
 HEAP32[21416] = 0;
 HEAP32[21417] = 0;
 HEAP32[21421] = 0;
 HEAP32[21422] = 0;
 HEAP32[21423] = 0;
 HEAP32[21427] = 0;
 HEAP32[21428] = 0;
 HEAP32[21429] = 0;
 HEAP32[21433] = 0;
 HEAP32[21434] = 0;
 HEAP32[21435] = 0;
 HEAP32[21439] = 0;
 HEAP32[21440] = 0;
 HEAP32[21441] = 0;
 HEAP32[21445] = 0;
 HEAP32[21446] = 0;
 HEAP32[21447] = 0;
 HEAP32[21451] = 0;
 HEAP32[21452] = 0;
 HEAP32[21453] = 0;
 HEAP32[21457] = 0;
 HEAP32[21458] = 0;
 HEAP32[21459] = 0;
 return;
}

function __ZN17SavedVehicleDBRowD2Ev($this) {
 $this = $this | 0;
 var $$lcssa = 0, $0 = 0, $1 = 0, $10 = 0, $14 = 0, $15 = 0, $17 = 0, $18 = 0, $2 = 0, $24 = 0, $27 = 0, $3 = 0, $33 = 0, $34 = 0, $35 = 0, $39 = 0, $40 = 0, $41 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $it$sroa$0$06 = 0, $it1$sroa$0$05 = 0;
 $0 = $this + 160 | 0;
 $1 = HEAP32[$0 >> 2] | 0;
 $2 = $this + 164 | 0;
 $3 = HEAP32[$2 >> 2] | 0;
 if (($1 | 0) != ($3 | 0)) {
  $40 = $3;
  $it$sroa$0$06 = $1;
  while (1) {
   $10 = HEAP32[$it$sroa$0$06 >> 2] | 0;
   if (!$10) $14 = $40; else {
    __ZdlPv($10);
    $14 = HEAP32[$2 >> 2] | 0;
   }
   $it$sroa$0$06 = $it$sroa$0$06 + 4 | 0;
   if (($it$sroa$0$06 | 0) == ($14 | 0)) break; else $40 = $14;
  }
 }
 $5 = $this + 172 | 0;
 $6 = HEAP32[$5 >> 2] | 0;
 $7 = $this + 176 | 0;
 $8 = HEAP32[$7 >> 2] | 0;
 if (($6 | 0) == ($8 | 0)) {
  $15 = $6;
  $18 = $6;
 } else {
  $41 = $8;
  $it1$sroa$0$05 = $6;
  while (1) {
   $35 = HEAP32[$it1$sroa$0$05 >> 2] | 0;
   if (!$35) $39 = $41; else {
    __ZdlPv($35);
    $39 = HEAP32[$7 >> 2] | 0;
   }
   $it1$sroa$0$05 = $it1$sroa$0$05 + 4 | 0;
   if (($it1$sroa$0$05 | 0) == ($39 | 0)) {
    $$lcssa = $39;
    break;
   } else $41 = $39;
  }
  $15 = HEAP32[$5 >> 2] | 0;
  $18 = $$lcssa;
 }
 $17 = $15;
 if ($15 | 0) {
  if (($18 | 0) != ($15 | 0)) HEAP32[$7 >> 2] = $18 + (~(($18 + -4 - $17 | 0) >>> 2) << 2);
  __ZdlPv($15);
 }
 $24 = HEAP32[$0 >> 2] | 0;
 if (!$24) {
  $33 = $this + 84 | 0;
  __ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEED2Ev($33);
  $34 = $this + 4 | 0;
  __ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEED2Ev($34);
  return;
 }
 $27 = HEAP32[$2 >> 2] | 0;
 if (($27 | 0) != ($24 | 0)) HEAP32[$2 >> 2] = $27 + (~(($27 + -4 - $24 | 0) >>> 2) << 2);
 __ZdlPv($24);
 $33 = $this + 84 | 0;
 __ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEED2Ev($33);
 $34 = $this + 4 | 0;
 __ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEED2Ev($34);
 return;
}

function __Z21reset_vehicle_globalsv() {
 var $featureNoSiren = 0, $featureRemoteRadio = 0, $featureTurnLeft = 0, $featureTurnRight = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16 | 0;
 $featureTurnRight = sp + 3 | 0;
 HEAP8[$featureTurnRight >> 0] = 0;
 $featureTurnLeft = sp + 2 | 0;
 HEAP8[$featureTurnLeft >> 0] = 0;
 $featureNoSiren = sp + 1 | 0;
 HEAP8[$featureNoSiren >> 0] = 0;
 $featureRemoteRadio = sp;
 HEAP8[$featureRemoteRadio >> 0] = 0;
 HEAP8[94935] = 0;
 HEAP8[94933] = 0;
 HEAP8[94931] = 0;
 HEAP8[94932] = 0;
 HEAP8[94934] = 0;
 HEAP8[94940] = 0;
 HEAP8[94941] = 0;
 HEAP8[94957] = 0;
 HEAP8[94955] = 0;
 HEAP8[94956] = 0;
 HEAP8[49241] = 1;
 HEAP8[94966] = 0;
 HEAP8[94930] = 0;
 HEAP8[94942] = 0;
 HEAP8[94943] = 0;
 HEAP8[94944] = 0;
 HEAP8[94945] = 0;
 HEAP8[94946] = 0;
 HEAP8[94947] = 0;
 HEAP8[94948] = 0;
 HEAP8[94949] = 0;
 HEAP8[94951] = 0;
 HEAP8[94952] = 0;
 HEAP8[94950] = 0;
 HEAP8[94953] = 0;
 HEAP8[94954] = 0;
 HEAP8[94958] = 0;
 HEAP8[94959] = 0;
 HEAP8[94960] = 0;
 HEAP8[94961] = 0;
 HEAP8[94936] = 0;
 HEAP8[94938] = 0;
 HEAP8[94997] = 0;
 HEAP8[94998] = 0;
 HEAP8[94999] = 0;
 HEAP8[$featureRemoteRadio >> 0] = 0;
 HEAP8[95e3] = 0;
 HEAP8[95001] = 0;
 HEAP8[95002] = 0;
 HEAP8[95003] = 0;
 HEAP8[95004] = 0;
 HEAP8[$featureNoSiren >> 0] = 0;
 HEAP8[$featureTurnLeft >> 0] = 0;
 HEAP8[$featureTurnRight >> 0] = 0;
 HEAP8[94967] = 0;
 HEAP8[94968] = 0;
 HEAP8[94969] = 0;
 HEAP8[94970] = 0;
 HEAP8[94971] = 0;
 HEAP8[94972] = 0;
 HEAP8[94973] = 0;
 HEAP8[94974] = 0;
 HEAP8[94975] = 0;
 HEAP8[94976] = 0;
 HEAP8[94977] = 0;
 HEAP8[94978] = 0;
 HEAP8[94979] = 0;
 HEAP8[94980] = 0;
 HEAP8[94981] = 0;
 HEAP8[94982] = 0;
 HEAP8[94983] = 0;
 HEAP8[94984] = 0;
 HEAP8[94985] = 0;
 HEAP8[94986] = 0;
 HEAP8[94987] = 0;
 HEAP8[94988] = 0;
 HEAP8[94989] = 0;
 HEAP8[94990] = 0;
 HEAP8[94991] = 0;
 HEAP8[94992] = 0;
 HEAP8[94993] = 0;
 HEAP8[94994] = 0;
 HEAP8[94995] = 0;
 HEAP8[94996] = 0;
 STACKTOP = sp;
 return;
}

function __ZN8nlohmann10basic_jsonINSt3__23mapENS1_6vectorENS1_12basic_stringIcNS1_11char_traitsIcEENS1_9allocatorIcEEEEbxydS7_NS_14adl_serializerEED2Ev($this) {
 $this = $this | 0;
 var $10 = 0, $11 = 0, $15 = 0, $16 = 0, $17 = 0, $19 = 0, $20 = 0, $22 = 0, $23 = 0, $26 = 0, $27 = 0, $28 = 0;
 switch (HEAP8[$this >> 0] | 0) {
 case 1:
  {
   if (!(HEAP32[$this + 8 >> 2] | 0)) ___assert_fail(13669, 13724, 1786, 13754);
   $10 = $this + 8 | 0;
   $11 = HEAP32[$10 >> 2] | 0;
   __ZNSt3__26__treeINS_12__value_typeINS_12basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEEN8nlohmann10basic_jsonINS_3mapENS_6vectorES7_bxydS5_NS8_14adl_serializerEEEEENS_19__map_value_compareIS7_SE_NS_4lessIS7_EELb1EEENS5_ISE_EEE7destroyEPNS_11__tree_nodeISE_PvEE($11, HEAP32[$11 + 4 >> 2] | 0);
   __ZdlPv(HEAP32[$10 >> 2] | 0);
   return;
  }
 case 2:
  {
   if (!(HEAP32[$this + 8 >> 2] | 0)) ___assert_fail(13771, 13724, 1787, 13754);
   $15 = $this + 8 | 0;
   $16 = HEAP32[$15 >> 2] | 0;
   $17 = HEAP32[$16 >> 2] | 0;
   if (!$17) $27 = $16; else {
    $19 = $16 + 4 | 0;
    $20 = HEAP32[$19 >> 2] | 0;
    if (($20 | 0) == ($17 | 0)) $26 = $17; else {
     $23 = $20;
     do {
      $22 = $23 + -16 | 0;
      HEAP32[$19 >> 2] = $22;
      __ZN8nlohmann10basic_jsonINSt3__23mapENS1_6vectorENS1_12basic_stringIcNS1_11char_traitsIcEENS1_9allocatorIcEEEEbxydS7_NS_14adl_serializerEED2Ev($22);
      $23 = HEAP32[$19 >> 2] | 0;
     } while (($23 | 0) != ($17 | 0));
     $26 = HEAP32[$16 >> 2] | 0;
    }
    __ZdlPv($26);
    $27 = HEAP32[$15 >> 2] | 0;
   }
   __ZdlPv($27);
   return;
  }
 case 3:
  {
   if (!(HEAP32[$this + 8 >> 2] | 0)) ___assert_fail(13824, 13724, 1788, 13754);
   $28 = $this + 8 | 0;
   __ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEED2Ev(HEAP32[$28 >> 2] | 0);
   __ZdlPv(HEAP32[$28 >> 2] | 0);
   return;
  }
 default:
  return;
 }
}

function __ZN14SavedSkinDBRowD2Ev($this) {
 $this = $this | 0;
 var $$lcssa = 0, $0 = 0, $1 = 0, $10 = 0, $14 = 0, $15 = 0, $17 = 0, $18 = 0, $2 = 0, $24 = 0, $27 = 0, $3 = 0, $33 = 0, $34 = 0, $38 = 0, $39 = 0, $40 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $it$sroa$0$06 = 0, $it1$sroa$0$05 = 0;
 $0 = $this + 20 | 0;
 $1 = HEAP32[$0 >> 2] | 0;
 $2 = $this + 24 | 0;
 $3 = HEAP32[$2 >> 2] | 0;
 if (($1 | 0) != ($3 | 0)) {
  $39 = $3;
  $it$sroa$0$06 = $1;
  while (1) {
   $10 = HEAP32[$it$sroa$0$06 >> 2] | 0;
   if (!$10) $14 = $39; else {
    __ZdlPv($10);
    $14 = HEAP32[$2 >> 2] | 0;
   }
   $it$sroa$0$06 = $it$sroa$0$06 + 4 | 0;
   if (($it$sroa$0$06 | 0) == ($14 | 0)) break; else $39 = $14;
  }
 }
 $5 = $this + 32 | 0;
 $6 = HEAP32[$5 >> 2] | 0;
 $7 = $this + 36 | 0;
 $8 = HEAP32[$7 >> 2] | 0;
 if (($6 | 0) == ($8 | 0)) {
  $15 = $6;
  $18 = $6;
 } else {
  $40 = $8;
  $it1$sroa$0$05 = $6;
  while (1) {
   $34 = HEAP32[$it1$sroa$0$05 >> 2] | 0;
   if (!$34) $38 = $40; else {
    __ZdlPv($34);
    $38 = HEAP32[$7 >> 2] | 0;
   }
   $it1$sroa$0$05 = $it1$sroa$0$05 + 4 | 0;
   if (($it1$sroa$0$05 | 0) == ($38 | 0)) {
    $$lcssa = $38;
    break;
   } else $40 = $38;
  }
  $15 = HEAP32[$5 >> 2] | 0;
  $18 = $$lcssa;
 }
 $17 = $15;
 if ($15 | 0) {
  if (($18 | 0) != ($15 | 0)) HEAP32[$7 >> 2] = $18 + (~(($18 + -4 - $17 | 0) >>> 2) << 2);
  __ZdlPv($15);
 }
 $24 = HEAP32[$0 >> 2] | 0;
 if (!$24) {
  $33 = $this + 4 | 0;
  __ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEED2Ev($33);
  return;
 }
 $27 = HEAP32[$2 >> 2] | 0;
 if (($27 | 0) != ($24 | 0)) HEAP32[$2 >> 2] = $27 + (~(($27 + -4 - $24 | 0) >>> 2) << 2);
 __ZdlPv($24);
 $33 = $this + 4 | 0;
 __ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEED2Ev($33);
 return;
}

function ___stdio_read($f, $buf, $len) {
 $f = $f | 0;
 $buf = $buf | 0;
 $len = $len | 0;
 var $$0 = 0, $$cast = 0, $0 = 0, $1 = 0, $15 = 0, $2 = 0, $27 = 0, $30 = 0, $31 = 0, $7 = 0, $cnt$0 = 0, $iov = 0, $vararg_buffer = 0, $vararg_buffer3 = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48 | 0;
 $vararg_buffer3 = sp + 16 | 0;
 $vararg_buffer = sp;
 $iov = sp + 32 | 0;
 HEAP32[$iov >> 2] = $buf;
 $0 = $iov + 4 | 0;
 $1 = $f + 48 | 0;
 $2 = HEAP32[$1 >> 2] | 0;
 HEAP32[$0 >> 2] = $len - (($2 | 0) != 0 & 1);
 $7 = $f + 44 | 0;
 HEAP32[$iov + 8 >> 2] = HEAP32[$7 >> 2];
 HEAP32[$iov + 12 >> 2] = $2;
 if (!(HEAP32[22824] | 0)) {
  HEAP32[$vararg_buffer3 >> 2] = HEAP32[$f + 60 >> 2];
  HEAP32[$vararg_buffer3 + 4 >> 2] = $iov;
  HEAP32[$vararg_buffer3 + 8 >> 2] = 2;
  $cnt$0 = ___syscall_ret(___syscall145(145, $vararg_buffer3 | 0) | 0) | 0;
 } else {
  _pthread_cleanup_push(183, $f | 0);
  HEAP32[$vararg_buffer >> 2] = HEAP32[$f + 60 >> 2];
  HEAP32[$vararg_buffer + 4 >> 2] = $iov;
  HEAP32[$vararg_buffer + 8 >> 2] = 2;
  $15 = ___syscall_ret(___syscall145(145, $vararg_buffer | 0) | 0) | 0;
  _pthread_cleanup_pop(0);
  $cnt$0 = $15;
 }
 if (($cnt$0 | 0) < 1) {
  HEAP32[$f >> 2] = HEAP32[$f >> 2] | $cnt$0 & 48 ^ 16;
  HEAP32[$f + 8 >> 2] = 0;
  HEAP32[$f + 4 >> 2] = 0;
  $$0 = $cnt$0;
 } else {
  $27 = HEAP32[$0 >> 2] | 0;
  if ($cnt$0 >>> 0 > $27 >>> 0) {
   $30 = HEAP32[$7 >> 2] | 0;
   $31 = $f + 4 | 0;
   HEAP32[$31 >> 2] = $30;
   $$cast = $30;
   HEAP32[$f + 8 >> 2] = $$cast + ($cnt$0 - $27);
   if (!(HEAP32[$1 >> 2] | 0)) $$0 = $len; else {
    HEAP32[$31 >> 2] = $$cast + 1;
    HEAP8[$buf + ($len + -1) >> 0] = HEAP8[$$cast >> 0] | 0;
    $$0 = $len;
   }
  } else $$0 = $cnt$0;
 }
 STACKTOP = sp;
 return $$0 | 0;
}

function __ZNSt3__216__check_groupingERKNS_12basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEEPjS8_Rj($__grouping, $__g, $__g_end, $__err) {
 $__grouping = $__grouping | 0;
 $__g = $__g | 0;
 $__g_end = $__g_end | 0;
 $__err = $__err | 0;
 var $$0$i$i = 0, $$01$i$i = 0, $1 = 0, $11 = 0, $15 = 0, $16 = 0, $19 = 0, $2 = 0, $20 = 0, $22 = 0, $3 = 0, $4 = 0, $5 = 0, $9 = 0, $__ig$0 = 0, $__r$0 = 0, $or$cond2 = 0, label = 0, CSE$0 = 0;
 label = 0;
 $1 = HEAP8[$__grouping + 11 >> 0] | 0;
 $2 = $1 << 24 >> 24 < 0;
 $3 = $__grouping + 4 | 0;
 $4 = HEAP32[$3 >> 2] | 0;
 $5 = $1 & 255;
 do if (($2 ? $4 : $5) | 0) {
  if (($__g | 0) == ($__g_end | 0)) $16 = $4; else {
   $$0$i$i = $__g_end;
   $$01$i$i = $__g;
   while (1) {
    $9 = $$0$i$i + -4 | 0;
    if ($$01$i$i >>> 0 >= $9 >>> 0) break;
    $11 = HEAP32[$$01$i$i >> 2] | 0;
    HEAP32[$$01$i$i >> 2] = HEAP32[$9 >> 2];
    HEAP32[$9 >> 2] = $11;
    $$0$i$i = $9;
    $$01$i$i = $$01$i$i + 4 | 0;
   }
   $16 = HEAP32[$3 >> 2] | 0;
  }
  $15 = $2 ? HEAP32[$__grouping >> 2] | 0 : $__grouping;
  $19 = $__g_end + -4 | 0;
  $20 = $15 + ($2 ? $16 : $5) | 0;
  $__ig$0 = $15;
  $__r$0 = $__g;
  while (1) {
   $22 = HEAP8[$__ig$0 >> 0] | 0;
   CSE$0 = $22 << 24 >> 24 | 0;
   $or$cond2 = (CSE$0 | 0) < 1 | (CSE$0 | 0) == 127;
   if ($__r$0 >>> 0 >= $19 >>> 0) break;
   if (!$or$cond2) if (($22 << 24 >> 24 | 0) != (HEAP32[$__r$0 >> 2] | 0)) {
    label = 10;
    break;
   }
   $__ig$0 = ($20 - $__ig$0 | 0) > 1 ? $__ig$0 + 1 | 0 : $__ig$0;
   $__r$0 = $__r$0 + 4 | 0;
  }
  if ((label | 0) == 10) {
   HEAP32[$__err >> 2] = 4;
   break;
  }
  if (!$or$cond2) if (((HEAP32[$19 >> 2] | 0) + -1 | 0) >>> 0 >= $22 << 24 >> 24 >>> 0) HEAP32[$__err >> 2] = 4;
 } while (0);
 return;
}

function __ZNSt3__214__num_put_base14__format_floatEPcPKcj($__fmtp, $__len, $__flags) {
 $__fmtp = $__fmtp | 0;
 $__len = $__len | 0;
 $__flags = $__flags | 0;
 var $$0 = 0, $$01 = 0, $$1 = 0, $$2 = 0, $$2$lcssa = 0, $$2$ph = 0, $11 = 0, $20 = 0, $6 = 0, $7 = 0, $8 = 0, $specify_precision$0$off0$ph = 0;
 if (!($__flags & 2048)) $$0 = $__fmtp; else {
  HEAP8[$__fmtp >> 0] = 43;
  $$0 = $__fmtp + 1 | 0;
 }
 if (!($__flags & 1024)) $$1 = $$0; else {
  HEAP8[$$0 >> 0] = 35;
  $$1 = $$0 + 1 | 0;
 }
 $6 = $__flags & 260;
 $7 = $__flags >>> 14;
 $8 = ($6 | 0) == 260;
 if ($8) {
  $$2$ph = $$1;
  $specify_precision$0$off0$ph = 0;
 } else {
  HEAP8[$$1 >> 0] = 46;
  HEAP8[$$1 + 1 >> 0] = 42;
  $$2$ph = $$1 + 2 | 0;
  $specify_precision$0$off0$ph = 1;
 }
 $$01 = $__len;
 $$2 = $$2$ph;
 while (1) {
  $11 = HEAP8[$$01 >> 0] | 0;
  if (!($11 << 24 >> 24)) {
   $$2$lcssa = $$2;
   break;
  }
  HEAP8[$$2 >> 0] = $11;
  $$01 = $$01 + 1 | 0;
  $$2 = $$2 + 1 | 0;
 }
 L14 : do switch ($6 | 0) {
 case 4:
  {
   if (!($7 & 1)) {
    HEAP8[$$2$lcssa >> 0] = 102;
    break L14;
   } else {
    HEAP8[$$2$lcssa >> 0] = 70;
    break L14;
   }
   break;
  }
 case 256:
  {
   if (!($7 & 1)) {
    HEAP8[$$2$lcssa >> 0] = 101;
    break L14;
   } else {
    HEAP8[$$2$lcssa >> 0] = 69;
    break L14;
   }
   break;
  }
 default:
  {
   $20 = ($7 & 1 | 0) != 0;
   if ($8) if ($20) {
    HEAP8[$$2$lcssa >> 0] = 65;
    break L14;
   } else {
    HEAP8[$$2$lcssa >> 0] = 97;
    break L14;
   } else if ($20) {
    HEAP8[$$2$lcssa >> 0] = 71;
    break L14;
   } else {
    HEAP8[$$2$lcssa >> 0] = 103;
    break L14;
   }
  }
 } while (0);
 return $specify_precision$0$off0$ph | 0;
}

function __ZN8nlohmann10basic_jsonINSt3__23mapENS1_6vectorENS1_12basic_stringIcNS1_11char_traitsIcEENS1_9allocatorIcEEEEbxydS7_NS_14adl_serializerEEaSESB_($this, $other) {
 $this = $this | 0;
 $other = $other | 0;
 var $0 = 0, $10 = 0, $11 = 0, $12 = 0, $14 = 0, $17 = 0, $18 = 0, $19 = 0, $24 = 0, $25 = 0, $29 = 0;
 $0 = HEAP8[$other >> 0] | 0;
 switch ($0 << 24 >> 24) {
 case 1:
  {
   if (!(HEAP32[$other + 8 >> 2] | 0)) ___assert_fail(13669, 13724, 1786, 13754);
   break;
  }
 case 2:
  {
   if (!(HEAP32[$other + 8 >> 2] | 0)) ___assert_fail(13771, 13724, 1787, 13754);
   break;
  }
 case 3:
  {
   if (!(HEAP32[$other + 8 >> 2] | 0)) ___assert_fail(13824, 13724, 1788, 13754);
   break;
  }
 default:
  {}
 }
 $10 = HEAP8[$this >> 0] | 0;
 HEAP8[$this >> 0] = $0;
 HEAP8[$other >> 0] = $10;
 $11 = $this + 8 | 0;
 $12 = $11;
 $14 = HEAP32[$12 >> 2] | 0;
 $17 = HEAP32[$12 + 4 >> 2] | 0;
 $18 = $other + 8 | 0;
 $19 = $18;
 $24 = HEAP32[$19 + 4 >> 2] | 0;
 $25 = $11;
 HEAP32[$25 >> 2] = HEAP32[$19 >> 2];
 HEAP32[$25 + 4 >> 2] = $24;
 $29 = $18;
 HEAP32[$29 >> 2] = $14;
 HEAP32[$29 + 4 >> 2] = $17;
 switch (HEAP8[$this >> 0] | 0) {
 case 1:
  {
   if (!(HEAP32[$11 >> 2] | 0)) ___assert_fail(13669, 13724, 1786, 13754); else return $this | 0;
   break;
  }
 case 2:
  {
   if (!(HEAP32[$11 >> 2] | 0)) ___assert_fail(13771, 13724, 1787, 13754); else return $this | 0;
   break;
  }
 case 3:
  {
   if (!(HEAP32[$11 >> 2] | 0)) ___assert_fail(13824, 13724, 1788, 13754); else return $this | 0;
   break;
  }
 default:
  return $this | 0;
 }
 return 0;
}

function _mbtowc($wc, $src, $n) {
 $wc = $wc | 0;
 $src = $src | 0;
 $n = $n | 0;
 var $$0 = 0, $10 = 0, $12 = 0, $20 = 0, $21 = 0, $29 = 0, $3 = 0, $33 = 0, $38 = 0, $4 = 0, $42 = 0, $8 = 0, $dummy = 0, $dummy$wc = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16 | 0;
 $dummy = sp;
 L1 : do if (!$src) $$0 = 0; else {
  do if ($n | 0) {
   $dummy$wc = ($wc | 0) == 0 ? $dummy : $wc;
   $3 = HEAP8[$src >> 0] | 0;
   $4 = $3 & 255;
   if ($3 << 24 >> 24 > -1) {
    HEAP32[$dummy$wc >> 2] = $4;
    $$0 = $3 << 24 >> 24 != 0 & 1;
    break L1;
   }
   $8 = $4 + -194 | 0;
   if ($8 >>> 0 <= 50) {
    $10 = $src + 1 | 0;
    $12 = HEAP32[3268 + ($8 << 2) >> 2] | 0;
    if ($n >>> 0 < 4) if ($12 & -2147483648 >>> (($n * 6 | 0) + -6 | 0) | 0) break;
    $20 = HEAPU8[$10 >> 0] | 0;
    $21 = $20 >>> 3;
    if (($21 + -16 | $21 + ($12 >> 26)) >>> 0 <= 7) {
     $29 = $20 + -128 | $12 << 6;
     if (($29 | 0) >= 0) {
      HEAP32[$dummy$wc >> 2] = $29;
      $$0 = 2;
      break L1;
     }
     $33 = HEAPU8[$src + 2 >> 0] | 0;
     if (($33 & 192 | 0) == 128) {
      $38 = $33 + -128 | $29 << 6;
      if (($38 | 0) >= 0) {
       HEAP32[$dummy$wc >> 2] = $38;
       $$0 = 3;
       break L1;
      }
      $42 = HEAPU8[$src + 3 >> 0] | 0;
      if (($42 & 192 | 0) == 128) {
       HEAP32[$dummy$wc >> 2] = $42 + -128 | $38 << 6;
       $$0 = 4;
       break L1;
      }
     }
    }
   }
  } while (0);
  HEAP32[(___errno_location() | 0) >> 2] = 84;
  $$0 = -1;
 } while (0);
 STACKTOP = sp;
 return $$0 | 0;
}

function __ZN8nlohmann10basic_jsonINSt3__23mapENS1_6vectorENS1_12basic_stringIcNS1_11char_traitsIcEENS1_9allocatorIcEEEEbxydS7_NS_14adl_serializerEEC2EOSB_($this, $other) {
 $this = $this | 0;
 $other = $other | 0;
 var $1 = 0, $21 = 0, $3 = 0, $8 = 0, $9 = 0;
 HEAP8[$this >> 0] = HEAP8[$other >> 0] | 0;
 $1 = $other + 8 | 0;
 $3 = $1;
 $8 = HEAP32[$3 + 4 >> 2] | 0;
 $9 = $this + 8 | 0;
 HEAP32[$9 >> 2] = HEAP32[$3 >> 2];
 HEAP32[$9 + 4 >> 2] = $8;
 switch (HEAP8[$other >> 0] | 0) {
 case 1:
  {
   if (!(HEAP32[$1 >> 2] | 0)) ___assert_fail(13669, 13724, 1786, 13754);
   break;
  }
 case 2:
  {
   if (!(HEAP32[$1 >> 2] | 0)) ___assert_fail(13771, 13724, 1787, 13754);
   break;
  }
 case 3:
  {
   if (!(HEAP32[$1 >> 2] | 0)) ___assert_fail(13824, 13724, 1788, 13754);
   break;
  }
 default:
  {}
 }
 HEAP8[$other >> 0] = 0;
 $21 = $other + 8 | 0;
 HEAP32[$21 >> 2] = 0;
 HEAP32[$21 + 4 >> 2] = 0;
 switch (HEAP8[$this >> 0] | 0) {
 case 1:
  {
   if (!(HEAP32[$this + 8 >> 2] | 0)) ___assert_fail(13669, 13724, 1786, 13754); else return;
   break;
  }
 case 2:
  {
   if (!(HEAP32[$this + 8 >> 2] | 0)) ___assert_fail(13771, 13724, 1787, 13754); else return;
   break;
  }
 case 3:
  {
   if (!(HEAP32[$this + 8 >> 2] | 0)) ___assert_fail(13824, 13724, 1788, 13754); else return;
   break;
  }
 default:
  return;
 }
}

function __ZNSt3__26__treeINS_12__value_typeINS_12basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEEN8nlohmann10basic_jsonINS_3mapENS_6vectorES7_bxydS5_NS8_14adl_serializerEEEEENS_19__map_value_compareIS7_SE_NS_4lessIS7_EELb1EEENS5_ISE_EEE7destroyEPNS_11__tree_nodeISE_PvEE($this, $__nd) {
 $this = $this | 0;
 $__nd = $__nd | 0;
 if (!$__nd) return; else {
  __ZNSt3__26__treeINS_12__value_typeINS_12basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEEN8nlohmann10basic_jsonINS_3mapENS_6vectorES7_bxydS5_NS8_14adl_serializerEEEEENS_19__map_value_compareIS7_SE_NS_4lessIS7_EELb1EEENS5_ISE_EEE7destroyEPNS_11__tree_nodeISE_PvEE($this, HEAP32[$__nd >> 2] | 0);
  __ZNSt3__26__treeINS_12__value_typeINS_12basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEEN8nlohmann10basic_jsonINS_3mapENS_6vectorES7_bxydS5_NS8_14adl_serializerEEEEENS_19__map_value_compareIS7_SE_NS_4lessIS7_EELb1EEENS5_ISE_EEE7destroyEPNS_11__tree_nodeISE_PvEE($this, HEAP32[$__nd + 4 >> 2] | 0);
  __ZN8nlohmann10basic_jsonINSt3__23mapENS1_6vectorENS1_12basic_stringIcNS1_11char_traitsIcEENS1_9allocatorIcEEEEbxydS7_NS_14adl_serializerEED2Ev($__nd + 32 | 0);
  __ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEED2Ev($__nd + 16 | 0);
  __ZdlPv($__nd);
  return;
 }
}

function __ZNK10__cxxabiv117__class_type_info29process_static_type_above_dstEPNS_19__dynamic_cast_infoEPKvS4_i($this, $info, $dst_ptr, $current_ptr, $path_below) {
 $this = $this | 0;
 $info = $info | 0;
 $dst_ptr = $dst_ptr | 0;
 $current_ptr = $current_ptr | 0;
 $path_below = $path_below | 0;
 var $16 = 0, $17 = 0, $22 = 0, $25 = 0, $5 = 0, $6 = 0;
 HEAP8[$info + 53 >> 0] = 1;
 do if ((HEAP32[$info + 4 >> 2] | 0) == ($current_ptr | 0)) {
  HEAP8[$info + 52 >> 0] = 1;
  $5 = $info + 16 | 0;
  $6 = HEAP32[$5 >> 2] | 0;
  if (!$6) {
   HEAP32[$5 >> 2] = $dst_ptr;
   HEAP32[$info + 24 >> 2] = $path_below;
   HEAP32[$info + 36 >> 2] = 1;
   if (!(($path_below | 0) == 1 ? (HEAP32[$info + 48 >> 2] | 0) == 1 : 0)) break;
   HEAP8[$info + 54 >> 0] = 1;
   break;
  }
  if (($6 | 0) != ($dst_ptr | 0)) {
   $25 = $info + 36 | 0;
   HEAP32[$25 >> 2] = (HEAP32[$25 >> 2] | 0) + 1;
   HEAP8[$info + 54 >> 0] = 1;
   break;
  }
  $16 = $info + 24 | 0;
  $17 = HEAP32[$16 >> 2] | 0;
  if (($17 | 0) == 2) {
   HEAP32[$16 >> 2] = $path_below;
   $22 = $path_below;
  } else $22 = $17;
  if (($22 | 0) == 1 ? (HEAP32[$info + 48 >> 2] | 0) == 1 : 0) HEAP8[$info + 54 >> 0] = 1;
 } while (0);
 return;
}

function __ZNSt3__215basic_stringbufIcNS_11char_traitsIcEENS_9allocatorIcEEE9pbackfailEi($this, $__c) {
 $this = $this | 0;
 $__c = $__c | 0;
 var $$0 = 0, $$in = 0, $$pre$phi2Z2D = 0, $$pre$phiZ2D = 0, $0 = 0, $1 = 0, $18 = 0, $19 = 0, $3 = 0, $5 = 0, $8 = 0, $9 = 0;
 $0 = $this + 44 | 0;
 $1 = HEAP32[$0 >> 2] | 0;
 $3 = HEAP32[$this + 24 >> 2] | 0;
 if ($1 >>> 0 < $3 >>> 0) {
  HEAP32[$0 >> 2] = $3;
  $$in = $3;
 } else $$in = $1;
 $5 = $$in;
 $8 = $this + 12 | 0;
 $9 = HEAP32[$8 >> 2] | 0;
 if ((HEAP32[$this + 8 >> 2] | 0) >>> 0 >= $9 >>> 0) {
  $$0 = -1;
  return $$0 | 0;
 }
 if (($__c | 0) == -1) {
  HEAP32[$8 >> 2] = $9 + -1;
  HEAP32[$this + 16 >> 2] = $5;
  $$0 = 0;
  return $$0 | 0;
 }
 if (!(HEAP32[$this + 48 >> 2] & 16)) {
  $18 = $__c & 255;
  $19 = $9 + -1 | 0;
  if ($18 << 24 >> 24 == (HEAP8[$19 >> 0] | 0)) {
   $$pre$phi2Z2D = $18;
   $$pre$phiZ2D = $19;
  } else {
   $$0 = -1;
   return $$0 | 0;
  }
 } else {
  $$pre$phi2Z2D = $__c & 255;
  $$pre$phiZ2D = $9 + -1 | 0;
 }
 HEAP32[$8 >> 2] = $$pre$phiZ2D;
 HEAP32[$this + 16 >> 2] = $5;
 HEAP8[$$pre$phiZ2D >> 0] = $$pre$phi2Z2D;
 $$0 = $__c;
 return $$0 | 0;
}

function __ZNK10__cxxabiv117__class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib($this, $info, $current_ptr, $path_below, $use_strcmp) {
 $this = $this | 0;
 $info = $info | 0;
 $current_ptr = $current_ptr | 0;
 $path_below = $path_below | 0;
 $use_strcmp = $use_strcmp | 0;
 var $14 = 0, $20 = 0, $6 = 0;
 do if (($this | 0) == (HEAP32[$info + 8 >> 2] | 0)) {
  if ((HEAP32[$info + 4 >> 2] | 0) == ($current_ptr | 0)) {
   $6 = $info + 28 | 0;
   if ((HEAP32[$6 >> 2] | 0) != 1) HEAP32[$6 >> 2] = $path_below;
  }
 } else if (($this | 0) == (HEAP32[$info >> 2] | 0)) {
  if ((HEAP32[$info + 16 >> 2] | 0) != ($current_ptr | 0)) {
   $14 = $info + 20 | 0;
   if ((HEAP32[$14 >> 2] | 0) != ($current_ptr | 0)) {
    HEAP32[$info + 32 >> 2] = $path_below;
    HEAP32[$14 >> 2] = $current_ptr;
    $20 = $info + 40 | 0;
    HEAP32[$20 >> 2] = (HEAP32[$20 >> 2] | 0) + 1;
    if ((HEAP32[$info + 36 >> 2] | 0) == 1) if ((HEAP32[$info + 24 >> 2] | 0) == 2) HEAP8[$info + 54 >> 0] = 1;
    HEAP32[$info + 44 >> 2] = 4;
    break;
   }
  }
  if (($path_below | 0) == 1) HEAP32[$info + 32 >> 2] = 1;
 } while (0);
 return;
}

function _fmt_u($0, $1, $s) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $s = $s | 0;
 var $$0$lcssa = 0, $$01$lcssa$off0 = 0, $$05 = 0, $$1$lcssa = 0, $$12 = 0, $$lcssa19 = 0, $13 = 0, $14 = 0, $25 = 0, $28 = 0, $7 = 0, $8 = 0, $9 = 0, $y$03 = 0;
 if ($1 >>> 0 > 0 | ($1 | 0) == 0 & $0 >>> 0 > 4294967295) {
  $$05 = $s;
  $7 = $0;
  $8 = $1;
  while (1) {
   $9 = ___uremdi3($7 | 0, $8 | 0, 10, 0) | 0;
   $13 = $$05 + -1 | 0;
   HEAP8[$13 >> 0] = $9 | 48;
   $14 = ___udivdi3($7 | 0, $8 | 0, 10, 0) | 0;
   if ($8 >>> 0 > 9 | ($8 | 0) == 9 & $7 >>> 0 > 4294967295) {
    $$05 = $13;
    $7 = $14;
    $8 = tempRet0;
   } else {
    $$lcssa19 = $13;
    $28 = $14;
    break;
   }
  }
  $$0$lcssa = $$lcssa19;
  $$01$lcssa$off0 = $28;
 } else {
  $$0$lcssa = $s;
  $$01$lcssa$off0 = $0;
 }
 if (!$$01$lcssa$off0) $$1$lcssa = $$0$lcssa; else {
  $$12 = $$0$lcssa;
  $y$03 = $$01$lcssa$off0;
  while (1) {
   $25 = $$12 + -1 | 0;
   HEAP8[$25 >> 0] = ($y$03 >>> 0) % 10 | 0 | 48;
   if ($y$03 >>> 0 < 10) {
    $$1$lcssa = $25;
    break;
   } else {
    $$12 = $25;
    $y$03 = ($y$03 >>> 0) / 10 | 0;
   }
  }
 }
 return $$1$lcssa | 0;
}

function __ZNSt3__213__vector_baseI13tele_locationNS_9allocatorIS1_EEED2Ev($this) {
 $this = $this | 0;
 var $0 = 0, $10 = 0, $11 = 0, $12 = 0, $19 = 0, $2 = 0, $21 = 0, $22 = 0, $23 = 0, $3 = 0, $31 = 0, $5 = 0, $6 = 0, $8 = 0;
 $0 = HEAP32[$this >> 2] | 0;
 if (!$0) return;
 $2 = $this + 4 | 0;
 $3 = HEAP32[$2 >> 2] | 0;
 if (($3 | 0) == ($0 | 0)) $31 = $0; else {
  $6 = $3;
  do {
   $5 = $6 + -52 | 0;
   HEAP32[$2 >> 2] = $5;
   $8 = HEAP32[$6 + -16 >> 2] | 0;
   $10 = $8;
   if ($8 | 0) {
    $11 = $6 + -12 | 0;
    $12 = HEAP32[$11 >> 2] | 0;
    if (($12 | 0) != ($8 | 0)) HEAP32[$11 >> 2] = $12 + (~(($12 + -4 - $10 | 0) >>> 2) << 2);
    __ZdlPv($8);
   }
   $19 = HEAP32[$6 + -28 >> 2] | 0;
   $21 = $19;
   if ($19 | 0) {
    $22 = $6 + -24 | 0;
    $23 = HEAP32[$22 >> 2] | 0;
    if (($23 | 0) != ($19 | 0)) HEAP32[$22 >> 2] = $23 + (~(($23 + -4 - $21 | 0) >>> 2) << 2);
    __ZdlPv($19);
   }
   __ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEED2Ev($5);
   $6 = HEAP32[$2 >> 2] | 0;
  } while (($6 | 0) != ($0 | 0));
  $31 = HEAP32[$this >> 2] | 0;
 }
 __ZdlPv($31);
 return;
}

function __ZNSt3__214__num_put_base12__format_intEPcPKcbj($__fmtp, $__len, $__signd, $__flags) {
 $__fmtp = $__fmtp | 0;
 $__len = $__len | 0;
 $__signd = $__signd | 0;
 $__flags = $__flags | 0;
 var $$0 = 0, $$01 = 0, $$1 = 0, $$1$lcssa = 0, $6 = 0;
 if (!($__flags & 2048)) $$0 = $__fmtp; else {
  HEAP8[$__fmtp >> 0] = 43;
  $$0 = $__fmtp + 1 | 0;
 }
 if (!($__flags & 512)) {
  $$01 = $__len;
  $$1 = $$0;
 } else {
  HEAP8[$$0 >> 0] = 35;
  $$01 = $__len;
  $$1 = $$0 + 1 | 0;
 }
 while (1) {
  $6 = HEAP8[$$01 >> 0] | 0;
  if (!($6 << 24 >> 24)) {
   $$1$lcssa = $$1;
   break;
  }
  HEAP8[$$1 >> 0] = $6;
  $$01 = $$01 + 1 | 0;
  $$1 = $$1 + 1 | 0;
 }
 L10 : do switch ($__flags & 74 | 0) {
 case 64:
  {
   HEAP8[$$1$lcssa >> 0] = 111;
   break;
  }
 case 8:
  {
   if (!($__flags & 16384)) {
    HEAP8[$$1$lcssa >> 0] = 120;
    break L10;
   } else {
    HEAP8[$$1$lcssa >> 0] = 88;
    break L10;
   }
   break;
  }
 default:
  if ($__signd) {
   HEAP8[$$1$lcssa >> 0] = 100;
   break L10;
  } else {
   HEAP8[$$1$lcssa >> 0] = 117;
   break L10;
  }
 } while (0);
 return;
}

function _strlen($s) {
 $s = $s | 0;
 var $$01$lcssa = 0, $$014 = 0, $$1$lcssa = 0, $$lcssa20 = 0, $$pn = 0, $$pn15 = 0, $0 = 0, $18 = 0, $21 = 0, $5 = 0, $9 = 0, $w$0 = 0, $w$0$lcssa = 0, label = 0;
 label = 0;
 $0 = $s;
 L1 : do if (!($0 & 3)) {
  $$01$lcssa = $s;
  label = 4;
 } else {
  $$014 = $s;
  $21 = $0;
  while (1) {
   if (!(HEAP8[$$014 >> 0] | 0)) {
    $$pn = $21;
    break L1;
   }
   $5 = $$014 + 1 | 0;
   $21 = $5;
   if (!($21 & 3)) {
    $$01$lcssa = $5;
    label = 4;
    break;
   } else $$014 = $5;
  }
 } while (0);
 if ((label | 0) == 4) {
  $w$0 = $$01$lcssa;
  while (1) {
   $9 = HEAP32[$w$0 >> 2] | 0;
   if (!(($9 & -2139062144 ^ -2139062144) & $9 + -16843009)) $w$0 = $w$0 + 4 | 0; else {
    $$lcssa20 = $9;
    $w$0$lcssa = $w$0;
    break;
   }
  }
  if (!(($$lcssa20 & 255) << 24 >> 24)) $$1$lcssa = $w$0$lcssa; else {
   $$pn15 = $w$0$lcssa;
   while (1) {
    $18 = $$pn15 + 1 | 0;
    if (!(HEAP8[$18 >> 0] | 0)) {
     $$1$lcssa = $18;
     break;
    } else $$pn15 = $18;
   }
  }
  $$pn = $$1$lcssa;
 }
 return $$pn - $0 | 0;
}

function __ZNKSt3__27codecvtIwc11__mbstate_tE10do_unshiftERS1_PcS4_RS4_($this, $st, $to, $to_end, $to_nxt) {
 $this = $this | 0;
 $st = $st | 0;
 $to = $to | 0;
 $to_end = $to_end | 0;
 $to_nxt = $to_nxt | 0;
 var $$0 = 0, $12 = 0, $13 = 0, $2 = 0, $3 = 0, $5 = 0, $n$0 = 0, $p$0 = 0, $tmp = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16 | 0;
 $tmp = sp;
 HEAP32[$to_nxt >> 2] = $to;
 $2 = _uselocale(HEAP32[$this + 8 >> 2] | 0) | 0;
 $3 = _wcrtomb($tmp, 0, $st) | 0;
 if ($2 | 0) _uselocale($2) | 0;
 L4 : do switch ($3 | 0) {
 case 0:
 case -1:
  {
   $$0 = 2;
   break;
  }
 default:
  {
   $5 = $3 + -1 | 0;
   if ($5 >>> 0 > ($to_end - (HEAP32[$to_nxt >> 2] | 0) | 0) >>> 0) $$0 = 1; else {
    $n$0 = $5;
    $p$0 = $tmp;
    while (1) {
     if (!$n$0) {
      $$0 = 0;
      break L4;
     }
     $12 = HEAP8[$p$0 >> 0] | 0;
     $13 = HEAP32[$to_nxt >> 2] | 0;
     HEAP32[$to_nxt >> 2] = $13 + 1;
     HEAP8[$13 >> 0] = $12;
     $n$0 = $n$0 + -1 | 0;
     $p$0 = $p$0 + 1 | 0;
    }
   }
  }
 } while (0);
 STACKTOP = sp;
 return $$0 | 0;
}

function __ZNSt3__26vectorIPNS_6locale5facetENS_15__sso_allocatorIS3_Lj28EEEE26__swap_out_circular_bufferERNS_14__split_bufferIS3_RS5_EE($this, $__v) {
 $this = $this | 0;
 $__v = $__v | 0;
 var $$pre$phiZ2D = 0, $0 = 0, $1 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $17 = 0, $18 = 0, $19 = 0, $3 = 0, $5 = 0, $9 = 0;
 $0 = HEAP32[$this >> 2] | 0;
 $1 = $this + 4 | 0;
 $3 = $__v + 4 | 0;
 $5 = (HEAP32[$1 >> 2] | 0) - $0 | 0;
 $9 = (HEAP32[$3 >> 2] | 0) + (0 - ($5 >> 2) << 2) | 0;
 HEAP32[$3 >> 2] = $9;
 if (($5 | 0) > 0) {
  _memcpy($9 | 0, $0 | 0, $5 | 0) | 0;
  $$pre$phiZ2D = $3;
  $13 = HEAP32[$3 >> 2] | 0;
 } else {
  $$pre$phiZ2D = $3;
  $13 = $9;
 }
 $12 = HEAP32[$this >> 2] | 0;
 HEAP32[$this >> 2] = $13;
 HEAP32[$$pre$phiZ2D >> 2] = $12;
 $14 = $__v + 8 | 0;
 $15 = HEAP32[$1 >> 2] | 0;
 HEAP32[$1 >> 2] = HEAP32[$14 >> 2];
 HEAP32[$14 >> 2] = $15;
 $17 = $this + 8 | 0;
 $18 = $__v + 12 | 0;
 $19 = HEAP32[$17 >> 2] | 0;
 HEAP32[$17 >> 2] = HEAP32[$18 >> 2];
 HEAP32[$18 >> 2] = $19;
 HEAP32[$__v >> 2] = HEAP32[$$pre$phiZ2D >> 2];
 return;
}

function __ZNKSt3__27codecvtIwc11__mbstate_tE9do_lengthERS1_PKcS5_j($this, $st, $frm, $frm_end, $mx) {
 $this = $this | 0;
 $st = $st | 0;
 $frm = $frm | 0;
 $frm_end = $frm_end | 0;
 $mx = $mx | 0;
 var $$04 = 0, $$15 = 0, $$pn = 0, $0 = 0, $1 = 0, $7 = 0, $8 = 0, $nbytes$0 = 0, $nbytes$0$lcssa = 0, $nwchar_t$0 = 0;
 $0 = $frm_end;
 $1 = $this + 8 | 0;
 $$04 = $frm;
 $nbytes$0 = 0;
 $nwchar_t$0 = 0;
 L1 : while (1) {
  if (($$04 | 0) == ($frm_end | 0) | $nwchar_t$0 >>> 0 >= $mx >>> 0) {
   $nbytes$0$lcssa = $nbytes$0;
   break;
  }
  $7 = _uselocale(HEAP32[$1 >> 2] | 0) | 0;
  $8 = _mbrlen($$04, $0 - $$04 | 0, $st) | 0;
  if ($7 | 0) _uselocale($7) | 0;
  switch ($8 | 0) {
  case -2:
  case -1:
   {
    $nbytes$0$lcssa = $nbytes$0;
    break L1;
    break;
   }
  case 0:
   {
    $$15 = $$04 + 1 | 0;
    $$pn = 1;
    break;
   }
  default:
   {
    $$15 = $$04 + $8 | 0;
    $$pn = $8;
   }
  }
  $$04 = $$15;
  $nbytes$0 = $$pn + $nbytes$0 | 0;
  $nwchar_t$0 = $nwchar_t$0 + 1 | 0;
 }
 return $nbytes$0$lcssa | 0;
}

function __ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE5eraseEjj($this, $__pos, $__n) {
 $this = $this | 0;
 $__pos = $__pos | 0;
 $__n = $__n | 0;
 var $0 = 0, $1 = 0, $10 = 0, $12 = 0, $14 = 0, $15 = 0, $18 = 0, $19 = 0, $2 = 0, $6 = 0;
 $0 = $this + 11 | 0;
 $1 = HEAP8[$0 >> 0] | 0;
 $2 = $1 << 24 >> 24 < 0;
 if ($2) $6 = HEAP32[$this + 4 >> 2] | 0; else $6 = $1 & 255;
 if ($6 >>> 0 < $__pos >>> 0) __ZNKSt3__221__basic_string_commonILb1EE20__throw_out_of_rangeEv($this);
 if ($__n | 0) {
  if ($2) $15 = HEAP32[$this >> 2] | 0; else $15 = $this;
  $10 = $6 - $__pos | 0;
  $12 = $10 >>> 0 < $__n >>> 0 ? $10 : $__n;
  if (($10 | 0) == ($12 | 0)) $19 = $1; else {
   $14 = $15 + $__pos | 0;
   _memmove($14 | 0, $14 + $12 | 0, $10 - $12 | 0) | 0;
   $19 = HEAP8[$0 >> 0] | 0;
  }
  $18 = $6 - $12 | 0;
  if ($19 << 24 >> 24 < 0) HEAP32[$this + 4 >> 2] = $18; else HEAP8[$0 >> 0] = $18;
  HEAP8[$15 + $18 >> 0] = 0;
 }
 return $this | 0;
}

function __ZNSt3__26__treeINS_12__value_typeINS_12basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEES7_EENS_19__map_value_compareIS7_S8_NS_4lessIS7_EELb1EEENS5_IS8_EEE7destroyEPNS_11__tree_nodeIS8_PvEE($this, $__nd) {
 $this = $this | 0;
 $__nd = $__nd | 0;
 if (!$__nd) return; else {
  __ZNSt3__26__treeINS_12__value_typeINS_12basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEES7_EENS_19__map_value_compareIS7_S8_NS_4lessIS7_EELb1EEENS5_IS8_EEE7destroyEPNS_11__tree_nodeIS8_PvEE($this, HEAP32[$__nd >> 2] | 0);
  __ZNSt3__26__treeINS_12__value_typeINS_12basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEES7_EENS_19__map_value_compareIS7_S8_NS_4lessIS7_EELb1EEENS5_IS8_EEE7destroyEPNS_11__tree_nodeIS8_PvEE($this, HEAP32[$__nd + 4 >> 2] | 0);
  __ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEED2Ev($__nd + 28 | 0);
  __ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEED2Ev($__nd + 16 | 0);
  __ZdlPv($__nd);
  return;
 }
}

function __ZNKSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE7compareEjjPKcj($this, $__pos1, $__n1, $__s, $__n2) {
 $this = $this | 0;
 $__pos1 = $__pos1 | 0;
 $__n1 = $__n1 | 0;
 $__s = $__s | 0;
 $__n2 = $__n2 | 0;
 var $1 = 0, $11 = 0, $14 = 0, $15 = 0, $17 = 0, $2 = 0, $6 = 0, $9 = 0;
 $1 = HEAP8[$this + 11 >> 0] | 0;
 $2 = $1 << 24 >> 24 < 0;
 if ($2) $6 = HEAP32[$this + 4 >> 2] | 0; else $6 = $1 & 255;
 if (($__n2 | 0) == -1 | $6 >>> 0 < $__pos1 >>> 0) __ZNKSt3__221__basic_string_commonILb1EE20__throw_out_of_rangeEv($this);
 $9 = $6 - $__pos1 | 0;
 $11 = $9 >>> 0 < $__n1 >>> 0 ? $9 : $__n1;
 if ($2) $14 = HEAP32[$this >> 2] | 0; else $14 = $this;
 $15 = $11 >>> 0 > $__n2 >>> 0;
 $17 = __ZNSt3__211char_traitsIcE7compareEPKcS3_j($14 + $__pos1 | 0, $__s, $15 ? $__n2 : $11) | 0;
 if (!$17) return ($11 >>> 0 < $__n2 >>> 0 ? -1 : $15 & 1) | 0; else return $17 | 0;
 return 0;
}

function __ZNKSt3__210__time_put8__do_putEPwRS1_PK2tmcc($this, $__wb, $__we, $__tm, $__fmt, $__mod) {
 $this = $this | 0;
 $__wb = $__wb | 0;
 $__we = $__we | 0;
 $__tm = $__tm | 0;
 $__fmt = $__fmt | 0;
 $__mod = $__mod | 0;
 var $1 = 0, $10 = 0, $11 = 0, $8 = 0, $__nar = 0, $__nb = 0, $__ne = 0, $mb = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 128 | 0;
 $__nar = sp + 16 | 0;
 $__ne = sp + 12 | 0;
 $mb = sp;
 $__nb = sp + 8 | 0;
 HEAP32[$__ne >> 2] = $__nar + 100;
 __ZNKSt3__210__time_put8__do_putEPcRS1_PK2tmcc($this, $__nar, $__ne, $__tm, $__fmt, $__mod);
 $1 = $mb;
 HEAP32[$1 >> 2] = 0;
 HEAP32[$1 + 4 >> 2] = 0;
 HEAP32[$__nb >> 2] = $__nar;
 $8 = (HEAP32[$__we >> 2] | 0) - $__wb >> 2;
 $10 = _uselocale(HEAP32[$this >> 2] | 0) | 0;
 $11 = _mbsrtowcs($__wb, $__nb, $8, $mb) | 0;
 if ($10 | 0) _uselocale($10) | 0;
 HEAP32[$__we >> 2] = $__wb + ($11 << 2);
 STACKTOP = sp;
 return;
}

function _scalbn($x, $n) {
 $x = +$x;
 $n = $n | 0;
 var $$0 = 0, $1 = 0.0, $12 = 0, $15 = 0, $16 = 0, $2 = 0, $5 = 0, $8 = 0.0, $9 = 0, $y$0 = 0.0;
 if (($n | 0) > 1023) {
  $1 = $x * 89884656743115795.0e291;
  $2 = $n + -1023 | 0;
  if (($2 | 0) > 1023) {
   $5 = $n + -2046 | 0;
   $$0 = ($5 | 0) > 1023 ? 1023 : $5;
   $y$0 = $1 * 89884656743115795.0e291;
  } else {
   $$0 = $2;
   $y$0 = $1;
  }
 } else if (($n | 0) < -1022) {
  $8 = $x * 2.2250738585072014e-308;
  $9 = $n + 1022 | 0;
  if (($9 | 0) < -1022) {
   $12 = $n + 2044 | 0;
   $$0 = ($12 | 0) < -1022 ? -1022 : $12;
   $y$0 = $8 * 2.2250738585072014e-308;
  } else {
   $$0 = $9;
   $y$0 = $8;
  }
 } else {
  $$0 = $n;
  $y$0 = $x;
 }
 $15 = _bitshift64Shl($$0 + 1023 | 0, 0, 52) | 0;
 $16 = tempRet0;
 HEAP32[tempDoublePtr >> 2] = $15;
 HEAP32[tempDoublePtr + 4 >> 2] = $16;
 return +($y$0 * +HEAPF64[tempDoublePtr >> 3]);
}

function _wcrtomb($s, $wc, $st) {
 $s = $s | 0;
 $wc = $wc | 0;
 $st = $st | 0;
 var $$0 = 0;
 do if (!$s) $$0 = 1; else {
  if ($wc >>> 0 < 128) {
   HEAP8[$s >> 0] = $wc;
   $$0 = 1;
   break;
  }
  if ($wc >>> 0 < 2048) {
   HEAP8[$s >> 0] = $wc >>> 6 | 192;
   HEAP8[$s + 1 >> 0] = $wc & 63 | 128;
   $$0 = 2;
   break;
  }
  if ($wc >>> 0 < 55296 | ($wc & -8192 | 0) == 57344) {
   HEAP8[$s >> 0] = $wc >>> 12 | 224;
   HEAP8[$s + 1 >> 0] = $wc >>> 6 & 63 | 128;
   HEAP8[$s + 2 >> 0] = $wc & 63 | 128;
   $$0 = 3;
   break;
  }
  if (($wc + -65536 | 0) >>> 0 < 1048576) {
   HEAP8[$s >> 0] = $wc >>> 18 | 240;
   HEAP8[$s + 1 >> 0] = $wc >>> 12 & 63 | 128;
   HEAP8[$s + 2 >> 0] = $wc >>> 6 & 63 | 128;
   HEAP8[$s + 3 >> 0] = $wc & 63 | 128;
   $$0 = 4;
   break;
  } else {
   HEAP32[(___errno_location() | 0) >> 2] = 84;
   $$0 = -1;
   break;
  }
 } while (0);
 return $$0 | 0;
}

function _strerror($e) {
 $e = $e | 0;
 var $$lcssa = 0, $9 = 0, $i$03 = 0, $i$03$lcssa = 0, $i$12 = 0, $s$0$lcssa = 0, $s$01 = 0, $s$1 = 0, label = 0;
 label = 0;
 $i$03 = 0;
 while (1) {
  if ((HEAPU8[78174 + $i$03 >> 0] | 0) == ($e | 0)) {
   $i$03$lcssa = $i$03;
   label = 2;
   break;
  }
  $i$03 = $i$03 + 1 | 0;
  if (($i$03 | 0) == 87) {
   $i$12 = 87;
   $s$01 = 78262;
   label = 5;
   break;
  }
 }
 if ((label | 0) == 2) if (!$i$03$lcssa) $s$0$lcssa = 78262; else {
  $i$12 = $i$03$lcssa;
  $s$01 = 78262;
  label = 5;
 }
 if ((label | 0) == 5) while (1) {
  label = 0;
  $s$1 = $s$01;
  while (1) {
   $9 = $s$1 + 1 | 0;
   if (!(HEAP8[$s$1 >> 0] | 0)) {
    $$lcssa = $9;
    break;
   } else $s$1 = $9;
  }
  $i$12 = $i$12 + -1 | 0;
  if (!$i$12) {
   $s$0$lcssa = $$lcssa;
   break;
  } else {
   $s$01 = $$lcssa;
   label = 5;
  }
 }
 return $s$0$lcssa | 0;
}

function __ZNSt3__26__treeINS_12__value_typeINS_12basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEEbEENS_19__map_value_compareIS7_S8_NS_4lessIS7_EELb1EEENS5_IS8_EEE7destroyEPNS_11__tree_nodeIS8_PvEE($this, $__nd) {
 $this = $this | 0;
 $__nd = $__nd | 0;
 if (!$__nd) return; else {
  __ZNSt3__26__treeINS_12__value_typeINS_12basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEEbEENS_19__map_value_compareIS7_S8_NS_4lessIS7_EELb1EEENS5_IS8_EEE7destroyEPNS_11__tree_nodeIS8_PvEE($this, HEAP32[$__nd >> 2] | 0);
  __ZNSt3__26__treeINS_12__value_typeINS_12basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEEbEENS_19__map_value_compareIS7_S8_NS_4lessIS7_EELb1EEENS5_IS8_EEE7destroyEPNS_11__tree_nodeIS8_PvEE($this, HEAP32[$__nd + 4 >> 2] | 0);
  __ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEED2Ev($__nd + 16 | 0);
  __ZdlPv($__nd);
  return;
 }
}

function _frexp($x, $e) {
 $x = +$x;
 $e = $e | 0;
 var $$0 = 0.0, $$01 = 0.0, $0 = 0, $1 = 0, $2 = 0, $4 = 0, $7 = 0.0, $storemerge = 0;
 HEAPF64[tempDoublePtr >> 3] = $x;
 $0 = HEAP32[tempDoublePtr >> 2] | 0;
 $1 = HEAP32[tempDoublePtr + 4 >> 2] | 0;
 $2 = _bitshift64Lshr($0 | 0, $1 | 0, 52) | 0;
 $4 = $2 & 2047;
 switch ($4 | 0) {
 case 0:
  {
   if ($x != 0.0) {
    $7 = +_frexp($x * 18446744073709552.0e3, $e);
    $$01 = $7;
    $storemerge = (HEAP32[$e >> 2] | 0) + -64 | 0;
   } else {
    $$01 = $x;
    $storemerge = 0;
   }
   HEAP32[$e >> 2] = $storemerge;
   $$0 = $$01;
   break;
  }
 case 2047:
  {
   $$0 = $x;
   break;
  }
 default:
  {
   HEAP32[$e >> 2] = $4 + -1022;
   HEAP32[tempDoublePtr >> 2] = $0;
   HEAP32[tempDoublePtr + 4 >> 2] = $1 & -2146435073 | 1071644672;
   $$0 = +HEAPF64[tempDoublePtr >> 3];
  }
 }
 return +$$0;
}

function __ZNSt3__214__num_put_base18__identify_paddingEPcS1_RKNS_8ios_baseE($__nb, $__ne, $__iob) {
 $__nb = $__nb | 0;
 $__ne = $__ne | 0;
 $__iob = $__iob | 0;
 var $$0 = 0, $3 = 0, label = 0;
 label = 0;
 L1 : do switch (HEAP32[$__iob + 4 >> 2] & 176 | 0) {
 case 16:
  {
   $3 = HEAP8[$__nb >> 0] | 0;
   switch ($3 << 24 >> 24) {
   case 43:
   case 45:
    {
     $$0 = $__nb + 1 | 0;
     break L1;
     break;
    }
   default:
    {}
   }
   if (($__ne - $__nb | 0) > 1 & $3 << 24 >> 24 == 48) {
    switch (HEAP8[$__nb + 1 >> 0] | 0) {
    case 88:
    case 120:
     break;
    default:
     {
      label = 7;
      break L1;
     }
    }
    $$0 = $__nb + 2 | 0;
   } else label = 7;
   break;
  }
 case 32:
  {
   $$0 = $__ne;
   break;
  }
 default:
  label = 7;
 } while (0);
 if ((label | 0) == 7) $$0 = $__nb;
 return $$0 | 0;
}

function __ZNKSt3__27collateIcE10do_compareEPKcS3_S3_S3_($this, $__lo1, $__hi1, $__lo2, $__hi2) {
 $this = $this | 0;
 $__lo1 = $__lo1 | 0;
 $__hi1 = $__hi1 | 0;
 $__lo2 = $__lo2 | 0;
 $__hi2 = $__hi2 | 0;
 var $$0 = 0, $$01 = 0, $$02 = 0, $$02$lcssa = 0, $2 = 0, $3 = 0, label = 0;
 label = 0;
 $$01 = $__lo2;
 $$02 = $__lo1;
 while (1) {
  if (($$01 | 0) == ($__hi2 | 0)) {
   $$02$lcssa = $$02;
   label = 7;
   break;
  }
  if (($$02 | 0) == ($__hi1 | 0)) {
   $$0 = -1;
   break;
  }
  $2 = HEAP8[$$02 >> 0] | 0;
  $3 = HEAP8[$$01 >> 0] | 0;
  if ($2 << 24 >> 24 < $3 << 24 >> 24) {
   $$0 = -1;
   break;
  }
  if ($3 << 24 >> 24 < $2 << 24 >> 24) {
   $$0 = 1;
   break;
  }
  $$01 = $$01 + 1 | 0;
  $$02 = $$02 + 1 | 0;
 }
 if ((label | 0) == 7) $$0 = ($$02$lcssa | 0) != ($__hi1 | 0) & 1;
 return $$0 | 0;
}

function __ZNKSt3__28time_getIwNS_19istreambuf_iteratorIwNS_11char_traitsIwEEEEE6do_getES4_S4_RNS_8ios_baseERjP2tmcc($this, $__b, $__e, $__iob, $__err, $__tm, $__fmt, $0) {
 $this = $this | 0;
 $__b = $__b | 0;
 $__e = $__e | 0;
 $__iob = $__iob | 0;
 $__err = $__err | 0;
 $__tm = $__tm | 0;
 $__fmt = $__fmt | 0;
 $0 = $0 | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $__b;
  HEAP32[EMTSTACKTOP + 24 >> 2] = $__e;
  HEAP32[EMTSTACKTOP + 32 >> 2] = $__iob;
  HEAP32[EMTSTACKTOP + 40 >> 2] = $__err;
  HEAP32[EMTSTACKTOP + 48 >> 2] = $__tm;
  HEAP32[EMTSTACKTOP + 56 >> 2] = $__fmt;
  HEAP32[EMTSTACKTOP + 64 >> 2] = $0;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 910860 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNKSt3__28time_getIcNS_19istreambuf_iteratorIcNS_11char_traitsIcEEEEE6do_getES4_S4_RNS_8ios_baseERjP2tmcc($this, $__b, $__e, $__iob, $__err, $__tm, $__fmt, $0) {
 $this = $this | 0;
 $__b = $__b | 0;
 $__e = $__e | 0;
 $__iob = $__iob | 0;
 $__err = $__err | 0;
 $__tm = $__tm | 0;
 $__fmt = $__fmt | 0;
 $0 = $0 | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $__b;
  HEAP32[EMTSTACKTOP + 24 >> 2] = $__e;
  HEAP32[EMTSTACKTOP + 32 >> 2] = $__iob;
  HEAP32[EMTSTACKTOP + 40 >> 2] = $__err;
  HEAP32[EMTSTACKTOP + 48 >> 2] = $__tm;
  HEAP32[EMTSTACKTOP + 56 >> 2] = $__fmt;
  HEAP32[EMTSTACKTOP + 64 >> 2] = $0;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 912640 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNKSt3__27collateIwE10do_compareEPKwS3_S3_S3_($this, $__lo1, $__hi1, $__lo2, $__hi2) {
 $this = $this | 0;
 $__lo1 = $__lo1 | 0;
 $__hi1 = $__hi1 | 0;
 $__lo2 = $__lo2 | 0;
 $__hi2 = $__hi2 | 0;
 var $$0 = 0, $$01 = 0, $$02 = 0, $$02$lcssa = 0, $2 = 0, $3 = 0, label = 0;
 label = 0;
 $$01 = $__lo2;
 $$02 = $__lo1;
 while (1) {
  if (($$01 | 0) == ($__hi2 | 0)) {
   $$02$lcssa = $$02;
   label = 7;
   break;
  }
  if (($$02 | 0) == ($__hi1 | 0)) {
   $$0 = -1;
   break;
  }
  $2 = HEAP32[$$02 >> 2] | 0;
  $3 = HEAP32[$$01 >> 2] | 0;
  if (($2 | 0) < ($3 | 0)) {
   $$0 = -1;
   break;
  }
  if (($3 | 0) < ($2 | 0)) {
   $$0 = 1;
   break;
  }
  $$01 = $$01 + 4 | 0;
  $$02 = $$02 + 4 | 0;
 }
 if ((label | 0) == 7) $$0 = ($$02$lcssa | 0) != ($__hi1 | 0) & 1;
 return $$0 | 0;
}

function _realloc($oldmem, $bytes) {
 $oldmem = $oldmem | 0;
 $bytes = $bytes | 0;
 var $12 = 0, $15 = 0, $20 = 0, $9 = 0, $mem$1 = 0;
 if (!$oldmem) {
  $mem$1 = _malloc($bytes) | 0;
  return $mem$1 | 0;
 }
 if ($bytes >>> 0 > 4294967231) {
  HEAP32[(___errno_location() | 0) >> 2] = 12;
  $mem$1 = 0;
  return $mem$1 | 0;
 }
 $9 = _try_realloc_chunk($oldmem + -8 | 0, $bytes >>> 0 < 11 ? 16 : $bytes + 11 & -8) | 0;
 if ($9 | 0) {
  $mem$1 = $9 + 8 | 0;
  return $mem$1 | 0;
 }
 $12 = _malloc($bytes) | 0;
 if (!$12) {
  $mem$1 = 0;
  return $mem$1 | 0;
 }
 $15 = HEAP32[$oldmem + -4 >> 2] | 0;
 $20 = ($15 & -8) - (($15 & 3 | 0) == 0 ? 8 : 4) | 0;
 _memcpy($12 | 0, $oldmem | 0, ($20 >>> 0 < $bytes >>> 0 ? $20 : $bytes) | 0) | 0;
 _free($oldmem);
 $mem$1 = $12;
 return $mem$1 | 0;
}

function __ZNKSt3__29money_getIwNS_19istreambuf_iteratorIwNS_11char_traitsIwEEEEE6do_getES4_S4_bRNS_8ios_baseERjRNS_12basic_stringIwS3_NS_9allocatorIwEEEE($this, $__b, $__e, $__intl, $__iob, $__err, $__v) {
 $this = $this | 0;
 $__b = $__b | 0;
 $__e = $__e | 0;
 $__intl = $__intl | 0;
 $__iob = $__iob | 0;
 $__err = $__err | 0;
 $__v = $__v | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $__b;
  HEAP32[EMTSTACKTOP + 24 >> 2] = $__e;
  HEAP32[EMTSTACKTOP + 32 >> 2] = $__intl;
  HEAP32[EMTSTACKTOP + 40 >> 2] = $__iob;
  HEAP32[EMTSTACKTOP + 48 >> 2] = $__err;
  HEAP32[EMTSTACKTOP + 56 >> 2] = $__v;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1099452 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNKSt3__29money_getIcNS_19istreambuf_iteratorIcNS_11char_traitsIcEEEEE6do_getES4_S4_bRNS_8ios_baseERjRNS_12basic_stringIcS3_NS_9allocatorIcEEEE($this, $__b, $__e, $__intl, $__iob, $__err, $__v) {
 $this = $this | 0;
 $__b = $__b | 0;
 $__e = $__e | 0;
 $__intl = $__intl | 0;
 $__iob = $__iob | 0;
 $__err = $__err | 0;
 $__v = $__v | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $__b;
  HEAP32[EMTSTACKTOP + 24 >> 2] = $__e;
  HEAP32[EMTSTACKTOP + 32 >> 2] = $__intl;
  HEAP32[EMTSTACKTOP + 40 >> 2] = $__iob;
  HEAP32[EMTSTACKTOP + 48 >> 2] = $__err;
  HEAP32[EMTSTACKTOP + 56 >> 2] = $__v;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1105028 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNKSt3__27codecvtIDsc11__mbstate_tE6do_outERS1_PKDsS5_RS5_PcS7_RS7_($this, $0, $frm, $frm_end, $frm_nxt, $to, $to_end, $to_nxt) {
 $this = $this | 0;
 $0 = $0 | 0;
 $frm = $frm | 0;
 $frm_end = $frm_end | 0;
 $frm_nxt = $frm_nxt | 0;
 $to = $to | 0;
 $to_end = $to_end | 0;
 $to_nxt = $to_nxt | 0;
 var $1 = 0, $_frm_nxt = 0, $_to_nxt = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16 | 0;
 $_frm_nxt = sp + 4 | 0;
 $_to_nxt = sp;
 HEAP32[$_frm_nxt >> 2] = $frm;
 HEAP32[$_to_nxt >> 2] = $to;
 $1 = __ZNSt3__2L13utf16_to_utf8EPKtS1_RS1_PhS3_RS3_mNS_12codecvt_modeE($frm, $frm_end, $_frm_nxt, $to, $to_end, $_to_nxt, 1114111, 0) | 0;
 HEAP32[$frm_nxt >> 2] = HEAP32[$_frm_nxt >> 2];
 HEAP32[$to_nxt >> 2] = HEAP32[$_to_nxt >> 2];
 STACKTOP = sp;
 return $1 | 0;
}

function __ZNKSt3__27codecvtIDsc11__mbstate_tE5do_inERS1_PKcS5_RS5_PDsS7_RS7_($this, $0, $frm, $frm_end, $frm_nxt, $to, $to_end, $to_nxt) {
 $this = $this | 0;
 $0 = $0 | 0;
 $frm = $frm | 0;
 $frm_end = $frm_end | 0;
 $frm_nxt = $frm_nxt | 0;
 $to = $to | 0;
 $to_end = $to_end | 0;
 $to_nxt = $to_nxt | 0;
 var $1 = 0, $_frm_nxt = 0, $_to_nxt = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16 | 0;
 $_frm_nxt = sp + 4 | 0;
 $_to_nxt = sp;
 HEAP32[$_frm_nxt >> 2] = $frm;
 HEAP32[$_to_nxt >> 2] = $to;
 $1 = __ZNSt3__2L13utf8_to_utf16EPKhS1_RS1_PtS3_RS3_mNS_12codecvt_modeE($frm, $frm_end, $_frm_nxt, $to, $to_end, $_to_nxt, 1114111, 0) | 0;
 HEAP32[$frm_nxt >> 2] = HEAP32[$_frm_nxt >> 2];
 HEAP32[$to_nxt >> 2] = HEAP32[$_to_nxt >> 2];
 STACKTOP = sp;
 return $1 | 0;
}

function __ZNKSt3__27codecvtIDic11__mbstate_tE6do_outERS1_PKDiS5_RS5_PcS7_RS7_($this, $0, $frm, $frm_end, $frm_nxt, $to, $to_end, $to_nxt) {
 $this = $this | 0;
 $0 = $0 | 0;
 $frm = $frm | 0;
 $frm_end = $frm_end | 0;
 $frm_nxt = $frm_nxt | 0;
 $to = $to | 0;
 $to_end = $to_end | 0;
 $to_nxt = $to_nxt | 0;
 var $1 = 0, $_frm_nxt = 0, $_to_nxt = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16 | 0;
 $_frm_nxt = sp + 4 | 0;
 $_to_nxt = sp;
 HEAP32[$_frm_nxt >> 2] = $frm;
 HEAP32[$_to_nxt >> 2] = $to;
 $1 = __ZNSt3__2L12ucs4_to_utf8EPKjS1_RS1_PhS3_RS3_mNS_12codecvt_modeE($frm, $frm_end, $_frm_nxt, $to, $to_end, $_to_nxt, 1114111, 0) | 0;
 HEAP32[$frm_nxt >> 2] = HEAP32[$_frm_nxt >> 2];
 HEAP32[$to_nxt >> 2] = HEAP32[$_to_nxt >> 2];
 STACKTOP = sp;
 return $1 | 0;
}

function __ZNKSt3__27codecvtIDic11__mbstate_tE5do_inERS1_PKcS5_RS5_PDiS7_RS7_($this, $0, $frm, $frm_end, $frm_nxt, $to, $to_end, $to_nxt) {
 $this = $this | 0;
 $0 = $0 | 0;
 $frm = $frm | 0;
 $frm_end = $frm_end | 0;
 $frm_nxt = $frm_nxt | 0;
 $to = $to | 0;
 $to_end = $to_end | 0;
 $to_nxt = $to_nxt | 0;
 var $1 = 0, $_frm_nxt = 0, $_to_nxt = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16 | 0;
 $_frm_nxt = sp + 4 | 0;
 $_to_nxt = sp;
 HEAP32[$_frm_nxt >> 2] = $frm;
 HEAP32[$_to_nxt >> 2] = $to;
 $1 = __ZNSt3__2L12utf8_to_ucs4EPKhS1_RS1_PjS3_RS3_mNS_12codecvt_modeE($frm, $frm_end, $_frm_nxt, $to, $to_end, $_to_nxt, 1114111, 0) | 0;
 HEAP32[$frm_nxt >> 2] = HEAP32[$_frm_nxt >> 2];
 HEAP32[$to_nxt >> 2] = HEAP32[$_to_nxt >> 2];
 STACKTOP = sp;
 return $1 | 0;
}

function __ZNK10__cxxabiv117__class_type_info24process_found_base_classEPNS_19__dynamic_cast_infoEPvi($this, $info, $adjustedPtr, $path_below) {
 $this = $this | 0;
 $info = $info | 0;
 $adjustedPtr = $adjustedPtr | 0;
 $path_below = $path_below | 0;
 var $0 = 0, $1 = 0, $6 = 0, $9 = 0;
 $0 = $info + 16 | 0;
 $1 = HEAP32[$0 >> 2] | 0;
 do if (!$1) {
  HEAP32[$0 >> 2] = $adjustedPtr;
  HEAP32[$info + 24 >> 2] = $path_below;
  HEAP32[$info + 36 >> 2] = 1;
 } else {
  if (($1 | 0) != ($adjustedPtr | 0)) {
   $9 = $info + 36 | 0;
   HEAP32[$9 >> 2] = (HEAP32[$9 >> 2] | 0) + 1;
   HEAP32[$info + 24 >> 2] = 2;
   HEAP8[$info + 54 >> 0] = 1;
   break;
  }
  $6 = $info + 24 | 0;
  if ((HEAP32[$6 >> 2] | 0) == 2) HEAP32[$6 >> 2] = $path_below;
 } while (0);
 return;
}

function __ZNKSt3__29money_getIwNS_19istreambuf_iteratorIwNS_11char_traitsIwEEEEE6do_getES4_S4_bRNS_8ios_baseERjRe($this, $__b, $__e, $__intl, $__iob, $__err, $__v) {
 $this = $this | 0;
 $__b = $__b | 0;
 $__e = $__e | 0;
 $__intl = $__intl | 0;
 $__iob = $__iob | 0;
 $__err = $__err | 0;
 $__v = $__v | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $__b;
  HEAP32[EMTSTACKTOP + 24 >> 2] = $__e;
  HEAP32[EMTSTACKTOP + 32 >> 2] = $__intl;
  HEAP32[EMTSTACKTOP + 40 >> 2] = $__iob;
  HEAP32[EMTSTACKTOP + 48 >> 2] = $__err;
  HEAP32[EMTSTACKTOP + 56 >> 2] = $__v;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1080916 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNKSt3__29money_getIcNS_19istreambuf_iteratorIcNS_11char_traitsIcEEEEE6do_getES4_S4_bRNS_8ios_baseERjRe($this, $__b, $__e, $__intl, $__iob, $__err, $__v) {
 $this = $this | 0;
 $__b = $__b | 0;
 $__e = $__e | 0;
 $__intl = $__intl | 0;
 $__iob = $__iob | 0;
 $__err = $__err | 0;
 $__v = $__v | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $__b;
  HEAP32[EMTSTACKTOP + 24 >> 2] = $__e;
  HEAP32[EMTSTACKTOP + 32 >> 2] = $__intl;
  HEAP32[EMTSTACKTOP + 40 >> 2] = $__iob;
  HEAP32[EMTSTACKTOP + 48 >> 2] = $__err;
  HEAP32[EMTSTACKTOP + 56 >> 2] = $__v;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1088412 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNKSt3__29money_putIcNS_19ostreambuf_iteratorIcNS_11char_traitsIcEEEEE6do_putES4_bRNS_8ios_baseEcRKNS_12basic_stringIcS3_NS_9allocatorIcEEEE($this, $__s, $__intl, $__iob, $__fl, $__digits) {
 $this = $this | 0;
 $__s = $__s | 0;
 $__intl = $__intl | 0;
 $__iob = $__iob | 0;
 $__fl = $__fl | 0;
 $__digits = $__digits | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $__s;
  HEAP32[EMTSTACKTOP + 24 >> 2] = $__intl;
  HEAP32[EMTSTACKTOP + 32 >> 2] = $__iob;
  HEAP32[EMTSTACKTOP + 40 >> 2] = $__fl;
  HEAP32[EMTSTACKTOP + 48 >> 2] = $__digits;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1062040 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNKSt3__29money_putIwNS_19ostreambuf_iteratorIwNS_11char_traitsIwEEEEE6do_putES4_bRNS_8ios_baseEwRKNS_12basic_stringIwS3_NS_9allocatorIwEEEE($this, $__s, $__intl, $__iob, $__fl, $__digits) {
 $this = $this | 0;
 $__s = $__s | 0;
 $__intl = $__intl | 0;
 $__iob = $__iob | 0;
 $__fl = $__fl | 0;
 $__digits = $__digits | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $__s;
  HEAP32[EMTSTACKTOP + 24 >> 2] = $__intl;
  HEAP32[EMTSTACKTOP + 32 >> 2] = $__iob;
  HEAP32[EMTSTACKTOP + 40 >> 2] = $__fl;
  HEAP32[EMTSTACKTOP + 48 >> 2] = $__digits;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1061e3 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNSt3__215basic_stringbufIcNS_11char_traitsIcEENS_9allocatorIcEEE9underflowEv($this) {
 $this = $this | 0;
 var $$0 = 0, $0 = 0, $1 = 0, $10 = 0, $12 = 0, $14 = 0, $16 = 0, $3 = 0, $9 = 0;
 $0 = $this + 44 | 0;
 $1 = HEAP32[$0 >> 2] | 0;
 $3 = HEAP32[$this + 24 >> 2] | 0;
 if ($1 >>> 0 < $3 >>> 0) {
  HEAP32[$0 >> 2] = $3;
  $12 = $3;
 } else $12 = $1;
 if (!(HEAP32[$this + 48 >> 2] & 8)) {
  $$0 = -1;
  return $$0 | 0;
 }
 $9 = $this + 16 | 0;
 $10 = HEAP32[$9 >> 2] | 0;
 if ($10 >>> 0 < $12 >>> 0) {
  HEAP32[$9 >> 2] = $12;
  $16 = $12;
 } else $16 = $10;
 $14 = HEAP32[$this + 12 >> 2] | 0;
 if ($14 >>> 0 >= $16 >>> 0) {
  $$0 = -1;
  return $$0 | 0;
 }
 $$0 = HEAPU8[$14 >> 0] | 0;
 return $$0 | 0;
}

function __ZNKSt3__210__time_put8__do_putEPcRS1_PK2tmcc($this, $__nb, $__ne, $__tm, $__fmt, $__mod) {
 $this = $this | 0;
 $__nb = $__nb | 0;
 $__ne = $__ne | 0;
 $__tm = $__tm | 0;
 $__fmt = $__fmt | 0;
 $__mod = $__mod | 0;
 var $0 = 0, $1 = 0, $fmt = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16 | 0;
 $fmt = sp;
 HEAP8[$fmt >> 0] = 37;
 $0 = $fmt + 1 | 0;
 HEAP8[$0 >> 0] = $__fmt;
 $1 = $fmt + 2 | 0;
 HEAP8[$1 >> 0] = $__mod;
 HEAP8[$fmt + 3 >> 0] = 0;
 if ($__mod << 24 >> 24) {
  HEAP8[$0 >> 0] = $__mod;
  HEAP8[$1 >> 0] = $__fmt;
 }
 HEAP32[$__ne >> 2] = $__nb + (_strftime_l($__nb | 0, (HEAP32[$__ne >> 2] | 0) - $__nb | 0, $fmt | 0, $__tm | 0, HEAP32[$this >> 2] | 0) | 0);
 STACKTOP = sp;
 return;
}

function __ZNKSt3__28time_putIwNS_19ostreambuf_iteratorIwNS_11char_traitsIwEEEEE6do_putES4_RNS_8ios_baseEwPK2tmcc($this, $__s, $0, $1, $__tm, $__fmt, $__mod) {
 $this = $this | 0;
 $__s = $__s | 0;
 $0 = $0 | 0;
 $1 = $1 | 0;
 $__tm = $__tm | 0;
 $__fmt = $__fmt | 0;
 $__mod = $__mod | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $__s;
  HEAP32[EMTSTACKTOP + 24 >> 2] = $0;
  HEAP32[EMTSTACKTOP + 32 >> 2] = $1;
  HEAP32[EMTSTACKTOP + 40 >> 2] = $__tm;
  HEAP32[EMTSTACKTOP + 48 >> 2] = $__fmt;
  HEAP32[EMTSTACKTOP + 56 >> 2] = $__mod;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1183932 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNKSt3__28time_putIcNS_19ostreambuf_iteratorIcNS_11char_traitsIcEEEEE6do_putES4_RNS_8ios_baseEcPK2tmcc($this, $__s, $0, $1, $__tm, $__fmt, $__mod) {
 $this = $this | 0;
 $__s = $__s | 0;
 $0 = $0 | 0;
 $1 = $1 | 0;
 $__tm = $__tm | 0;
 $__fmt = $__fmt | 0;
 $__mod = $__mod | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $__s;
  HEAP32[EMTSTACKTOP + 24 >> 2] = $0;
  HEAP32[EMTSTACKTOP + 32 >> 2] = $1;
  HEAP32[EMTSTACKTOP + 40 >> 2] = $__tm;
  HEAP32[EMTSTACKTOP + 48 >> 2] = $__fmt;
  HEAP32[EMTSTACKTOP + 56 >> 2] = $__mod;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1180424 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNKSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE4findEcj($this, $__c, $__pos) {
 $this = $this | 0;
 $__c = $__c | 0;
 $__pos = $__pos | 0;
 var $$1$i = 0, $0 = 0, $11 = 0, $13 = 0, $2 = 0, $8 = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16 | 0;
 $0 = sp;
 $2 = HEAP8[$this + 11 >> 0] | 0;
 if ($2 << 24 >> 24 < 0) {
  $11 = HEAP32[$this >> 2] | 0;
  $8 = HEAP32[$this + 4 >> 2] | 0;
 } else {
  $11 = $this;
  $8 = $2 & 255;
 }
 HEAP8[$0 >> 0] = $__c;
 if ($8 >>> 0 > $__pos >>> 0) {
  $13 = __ZNSt3__211char_traitsIcE4findEPKcjRS2_($11 + $__pos | 0, $8 - $__pos | 0, $0) | 0;
  $$1$i = ($13 | 0) == 0 ? -1 : $13 - $11 | 0;
 } else $$1$i = -1;
 STACKTOP = sp;
 return $$1$i | 0;
}

function __ZNK10__cxxabiv121__vmi_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib($this, $info, $dst_ptr, $current_ptr, $path_below, $use_strcmp) {
 $this = $this | 0;
 $info = $info | 0;
 $dst_ptr = $dst_ptr | 0;
 $current_ptr = $current_ptr | 0;
 $path_below = $path_below | 0;
 $use_strcmp = $use_strcmp | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $info;
  HEAP32[EMTSTACKTOP + 24 >> 2] = $dst_ptr;
  HEAP32[EMTSTACKTOP + 32 >> 2] = $current_ptr;
  HEAP32[EMTSTACKTOP + 40 >> 2] = $path_below;
  HEAP32[EMTSTACKTOP + 48 >> 2] = $use_strcmp;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1167480 | 0);
}

function __ZNK10__cxxabiv120__si_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib($this, $info, $dst_ptr, $current_ptr, $path_below, $use_strcmp) {
 $this = $this | 0;
 $info = $info | 0;
 $dst_ptr = $dst_ptr | 0;
 $current_ptr = $current_ptr | 0;
 $path_below = $path_below | 0;
 $use_strcmp = $use_strcmp | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $info;
  HEAP32[EMTSTACKTOP + 24 >> 2] = $dst_ptr;
  HEAP32[EMTSTACKTOP + 32 >> 2] = $current_ptr;
  HEAP32[EMTSTACKTOP + 40 >> 2] = $path_below;
  HEAP32[EMTSTACKTOP + 48 >> 2] = $use_strcmp;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1212620 | 0);
}

function _memcpy(dest, src, num) {
 dest = dest | 0;
 src = src | 0;
 num = num | 0;
 var ret = 0;
 if ((num | 0) >= 4096) return _emscripten_memcpy_big(dest | 0, src | 0, num | 0) | 0;
 ret = dest | 0;
 if ((dest & 3) == (src & 3)) {
  while (dest & 3) {
   if (!num) return ret | 0;
   HEAP8[dest >> 0] = HEAP8[src >> 0] | 0;
   dest = dest + 1 | 0;
   src = src + 1 | 0;
   num = num - 1 | 0;
  }
  while ((num | 0) >= 4) {
   HEAP32[dest >> 2] = HEAP32[src >> 2];
   dest = dest + 4 | 0;
   src = src + 4 | 0;
   num = num - 4 | 0;
  }
 }
 while ((num | 0) > 0) {
  HEAP8[dest >> 0] = HEAP8[src >> 0] | 0;
  dest = dest + 1 | 0;
  src = src + 1 | 0;
  num = num - 1 | 0;
 }
 return ret | 0;
}

function __ZNKSt3__29money_putIwNS_19ostreambuf_iteratorIwNS_11char_traitsIwEEEEE6do_putES4_bRNS_8ios_baseEwe($this, $__s, $__intl, $__iob, $__fl, $__units) {
 $this = $this | 0;
 $__s = $__s | 0;
 $__intl = $__intl | 0;
 $__iob = $__iob | 0;
 $__fl = $__fl | 0;
 $__units = +$__units;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $__s;
  HEAP32[EMTSTACKTOP + 24 >> 2] = $__intl;
  HEAP32[EMTSTACKTOP + 32 >> 2] = $__iob;
  HEAP32[EMTSTACKTOP + 40 >> 2] = $__fl;
  HEAPF64[EMTSTACKTOP + 48 >> 3] = $__units;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1046144 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNKSt3__29money_putIcNS_19ostreambuf_iteratorIcNS_11char_traitsIcEEEEE6do_putES4_bRNS_8ios_baseEce($this, $__s, $__intl, $__iob, $__fl, $__units) {
 $this = $this | 0;
 $__s = $__s | 0;
 $__intl = $__intl | 0;
 $__iob = $__iob | 0;
 $__fl = $__fl | 0;
 $__units = +$__units;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $__s;
  HEAP32[EMTSTACKTOP + 24 >> 2] = $__intl;
  HEAP32[EMTSTACKTOP + 32 >> 2] = $__iob;
  HEAP32[EMTSTACKTOP + 40 >> 2] = $__fl;
  HEAPF64[EMTSTACKTOP + 48 >> 3] = $__units;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1047204 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNKSt3__28time_getIwNS_19istreambuf_iteratorIwNS_11char_traitsIwEEEEE16do_get_monthnameES4_S4_RNS_8ios_baseERjP2tm($this, $__b, $__e, $__iob, $__err, $__tm) {
 $this = $this | 0;
 $__b = $__b | 0;
 $__e = $__e | 0;
 $__iob = $__iob | 0;
 $__err = $__err | 0;
 $__tm = $__tm | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $__b;
  HEAP32[EMTSTACKTOP + 24 >> 2] = $__e;
  HEAP32[EMTSTACKTOP + 32 >> 2] = $__iob;
  HEAP32[EMTSTACKTOP + 40 >> 2] = $__err;
  HEAP32[EMTSTACKTOP + 48 >> 2] = $__tm;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1200788 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNKSt3__28time_getIcNS_19istreambuf_iteratorIcNS_11char_traitsIcEEEEE16do_get_monthnameES4_S4_RNS_8ios_baseERjP2tm($this, $__b, $__e, $__iob, $__err, $__tm) {
 $this = $this | 0;
 $__b = $__b | 0;
 $__e = $__e | 0;
 $__iob = $__iob | 0;
 $__err = $__err | 0;
 $__tm = $__tm | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $__b;
  HEAP32[EMTSTACKTOP + 24 >> 2] = $__e;
  HEAP32[EMTSTACKTOP + 32 >> 2] = $__iob;
  HEAP32[EMTSTACKTOP + 40 >> 2] = $__err;
  HEAP32[EMTSTACKTOP + 48 >> 2] = $__tm;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1201036 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNKSt3__28time_getIwNS_19istreambuf_iteratorIwNS_11char_traitsIwEEEEE14do_get_weekdayES4_S4_RNS_8ios_baseERjP2tm($this, $__b, $__e, $__iob, $__err, $__tm) {
 $this = $this | 0;
 $__b = $__b | 0;
 $__e = $__e | 0;
 $__iob = $__iob | 0;
 $__err = $__err | 0;
 $__tm = $__tm | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $__b;
  HEAP32[EMTSTACKTOP + 24 >> 2] = $__e;
  HEAP32[EMTSTACKTOP + 32 >> 2] = $__iob;
  HEAP32[EMTSTACKTOP + 40 >> 2] = $__err;
  HEAP32[EMTSTACKTOP + 48 >> 2] = $__tm;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1200912 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNKSt3__28time_getIcNS_19istreambuf_iteratorIcNS_11char_traitsIcEEEEE14do_get_weekdayES4_S4_RNS_8ios_baseERjP2tm($this, $__b, $__e, $__iob, $__err, $__tm) {
 $this = $this | 0;
 $__b = $__b | 0;
 $__e = $__e | 0;
 $__iob = $__iob | 0;
 $__err = $__err | 0;
 $__tm = $__tm | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $__b;
  HEAP32[EMTSTACKTOP + 24 >> 2] = $__e;
  HEAP32[EMTSTACKTOP + 32 >> 2] = $__iob;
  HEAP32[EMTSTACKTOP + 40 >> 2] = $__err;
  HEAP32[EMTSTACKTOP + 48 >> 2] = $__tm;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1201160 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function _memset(ptr, value, num) {
 ptr = ptr | 0;
 value = value | 0;
 num = num | 0;
 var stop = 0, value4 = 0, stop4 = 0, unaligned = 0;
 stop = ptr + num | 0;
 if ((num | 0) >= 20) {
  value = value & 255;
  unaligned = ptr & 3;
  value4 = value | value << 8 | value << 16 | value << 24;
  stop4 = stop & ~3;
  if (unaligned) {
   unaligned = ptr + 4 - unaligned | 0;
   while ((ptr | 0) < (unaligned | 0)) {
    HEAP8[ptr >> 0] = value;
    ptr = ptr + 1 | 0;
   }
  }
  while ((ptr | 0) < (stop4 | 0)) {
   HEAP32[ptr >> 2] = value4;
   ptr = ptr + 4 | 0;
  }
 }
 while ((ptr | 0) < (stop | 0)) {
  HEAP8[ptr >> 0] = value;
  ptr = ptr + 1 | 0;
 }
 return ptr - num | 0;
}

function __ZNKSt3__28time_getIwNS_19istreambuf_iteratorIwNS_11char_traitsIwEEEEE11do_get_yearES4_S4_RNS_8ios_baseERjP2tm($this, $__b, $__e, $__iob, $__err, $__tm) {
 $this = $this | 0;
 $__b = $__b | 0;
 $__e = $__e | 0;
 $__iob = $__iob | 0;
 $__err = $__err | 0;
 $__tm = $__tm | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $__b;
  HEAP32[EMTSTACKTOP + 24 >> 2] = $__e;
  HEAP32[EMTSTACKTOP + 32 >> 2] = $__iob;
  HEAP32[EMTSTACKTOP + 40 >> 2] = $__err;
  HEAP32[EMTSTACKTOP + 48 >> 2] = $__tm;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1201988 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNKSt3__28time_getIwNS_19istreambuf_iteratorIwNS_11char_traitsIwEEEEE11do_get_timeES4_S4_RNS_8ios_baseERjP2tm($this, $__b, $__e, $__iob, $__err, $__tm) {
 $this = $this | 0;
 $__b = $__b | 0;
 $__e = $__e | 0;
 $__iob = $__iob | 0;
 $__err = $__err | 0;
 $__tm = $__tm | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $__b;
  HEAP32[EMTSTACKTOP + 24 >> 2] = $__e;
  HEAP32[EMTSTACKTOP + 32 >> 2] = $__iob;
  HEAP32[EMTSTACKTOP + 40 >> 2] = $__err;
  HEAP32[EMTSTACKTOP + 48 >> 2] = $__tm;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1203596 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNKSt3__28time_getIwNS_19istreambuf_iteratorIwNS_11char_traitsIwEEEEE11do_get_dateES4_S4_RNS_8ios_baseERjP2tm($this, $__b, $__e, $__iob, $__err, $__tm) {
 $this = $this | 0;
 $__b = $__b | 0;
 $__e = $__e | 0;
 $__iob = $__iob | 0;
 $__err = $__err | 0;
 $__tm = $__tm | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $__b;
  HEAP32[EMTSTACKTOP + 24 >> 2] = $__e;
  HEAP32[EMTSTACKTOP + 32 >> 2] = $__iob;
  HEAP32[EMTSTACKTOP + 40 >> 2] = $__err;
  HEAP32[EMTSTACKTOP + 48 >> 2] = $__tm;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1189668 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNKSt3__28time_getIcNS_19istreambuf_iteratorIcNS_11char_traitsIcEEEEE11do_get_yearES4_S4_RNS_8ios_baseERjP2tm($this, $__b, $__e, $__iob, $__err, $__tm) {
 $this = $this | 0;
 $__b = $__b | 0;
 $__e = $__e | 0;
 $__iob = $__iob | 0;
 $__err = $__err | 0;
 $__tm = $__tm | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $__b;
  HEAP32[EMTSTACKTOP + 24 >> 2] = $__e;
  HEAP32[EMTSTACKTOP + 32 >> 2] = $__iob;
  HEAP32[EMTSTACKTOP + 40 >> 2] = $__err;
  HEAP32[EMTSTACKTOP + 48 >> 2] = $__tm;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1202112 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNKSt3__28time_getIcNS_19istreambuf_iteratorIcNS_11char_traitsIcEEEEE11do_get_timeES4_S4_RNS_8ios_baseERjP2tm($this, $__b, $__e, $__iob, $__err, $__tm) {
 $this = $this | 0;
 $__b = $__b | 0;
 $__e = $__e | 0;
 $__iob = $__iob | 0;
 $__err = $__err | 0;
 $__tm = $__tm | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $__b;
  HEAP32[EMTSTACKTOP + 24 >> 2] = $__e;
  HEAP32[EMTSTACKTOP + 32 >> 2] = $__iob;
  HEAP32[EMTSTACKTOP + 40 >> 2] = $__err;
  HEAP32[EMTSTACKTOP + 48 >> 2] = $__tm;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1203496 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNKSt3__28time_getIcNS_19istreambuf_iteratorIcNS_11char_traitsIcEEEEE11do_get_dateES4_S4_RNS_8ios_baseERjP2tm($this, $__b, $__e, $__iob, $__err, $__tm) {
 $this = $this | 0;
 $__b = $__b | 0;
 $__e = $__e | 0;
 $__iob = $__iob | 0;
 $__err = $__err | 0;
 $__tm = $__tm | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $__b;
  HEAP32[EMTSTACKTOP + 24 >> 2] = $__e;
  HEAP32[EMTSTACKTOP + 32 >> 2] = $__iob;
  HEAP32[EMTSTACKTOP + 40 >> 2] = $__err;
  HEAP32[EMTSTACKTOP + 48 >> 2] = $__tm;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1190968 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNKSt3__28messagesIwE6do_getEiiiRKNS_12basic_stringIwNS_11char_traitsIwEENS_9allocatorIwEEEE($agg$result, $this, $__c, $__set, $__msgid, $__dflt) {
 $agg$result = $agg$result | 0;
 $this = $this | 0;
 $__c = $__c | 0;
 $__set = $__set | 0;
 $__msgid = $__msgid | 0;
 $__dflt = $__dflt | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $agg$result;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $this;
  HEAP32[EMTSTACKTOP + 24 >> 2] = $__c;
  HEAP32[EMTSTACKTOP + 32 >> 2] = $__set;
  HEAP32[EMTSTACKTOP + 40 >> 2] = $__msgid;
  HEAP32[EMTSTACKTOP + 48 >> 2] = $__dflt;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1118740 | 0);
}

function __ZNKSt3__28messagesIcE6do_getEiiiRKNS_12basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEE($agg$result, $this, $__c, $__set, $__msgid, $__dflt) {
 $agg$result = $agg$result | 0;
 $this = $this | 0;
 $__c = $__c | 0;
 $__set = $__set | 0;
 $__msgid = $__msgid | 0;
 $__dflt = $__dflt | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $agg$result;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $this;
  HEAP32[EMTSTACKTOP + 24 >> 2] = $__c;
  HEAP32[EMTSTACKTOP + 32 >> 2] = $__set;
  HEAP32[EMTSTACKTOP + 40 >> 2] = $__msgid;
  HEAP32[EMTSTACKTOP + 48 >> 2] = $__dflt;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1163628 | 0);
}

function __ZNKSt3__27num_getIwNS_19istreambuf_iteratorIwNS_11char_traitsIwEEEEE6do_getES4_S4_RNS_8ios_baseERjS8_($this, $__b, $__e, $__iob, $__err, $__v) {
 $this = $this | 0;
 $__b = $__b | 0;
 $__e = $__e | 0;
 $__iob = $__iob | 0;
 $__err = $__err | 0;
 $__v = $__v | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $__b;
  HEAP32[EMTSTACKTOP + 24 >> 2] = $__e;
  HEAP32[EMTSTACKTOP + 32 >> 2] = $__iob;
  HEAP32[EMTSTACKTOP + 40 >> 2] = $__err;
  HEAP32[EMTSTACKTOP + 48 >> 2] = $__v;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1204936 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNKSt3__27num_getIwNS_19istreambuf_iteratorIwNS_11char_traitsIwEEEEE6do_getES4_S4_RNS_8ios_baseERjRPv($this, $__b, $__e, $__iob, $__err, $__v) {
 $this = $this | 0;
 $__b = $__b | 0;
 $__e = $__e | 0;
 $__iob = $__iob | 0;
 $__err = $__err | 0;
 $__v = $__v | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $__b;
  HEAP32[EMTSTACKTOP + 24 >> 2] = $__e;
  HEAP32[EMTSTACKTOP + 32 >> 2] = $__iob;
  HEAP32[EMTSTACKTOP + 40 >> 2] = $__err;
  HEAP32[EMTSTACKTOP + 48 >> 2] = $__v;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1008628 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNKSt3__27num_getIcNS_19istreambuf_iteratorIcNS_11char_traitsIcEEEEE6do_getES4_S4_RNS_8ios_baseERjS8_($this, $__b, $__e, $__iob, $__err, $__v) {
 $this = $this | 0;
 $__b = $__b | 0;
 $__e = $__e | 0;
 $__iob = $__iob | 0;
 $__err = $__err | 0;
 $__v = $__v | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $__b;
  HEAP32[EMTSTACKTOP + 24 >> 2] = $__e;
  HEAP32[EMTSTACKTOP + 32 >> 2] = $__iob;
  HEAP32[EMTSTACKTOP + 40 >> 2] = $__err;
  HEAP32[EMTSTACKTOP + 48 >> 2] = $__v;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1205020 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNKSt3__27num_getIcNS_19istreambuf_iteratorIcNS_11char_traitsIcEEEEE6do_getES4_S4_RNS_8ios_baseERjRPv($this, $__b, $__e, $__iob, $__err, $__v) {
 $this = $this | 0;
 $__b = $__b | 0;
 $__e = $__e | 0;
 $__iob = $__iob | 0;
 $__err = $__err | 0;
 $__v = $__v | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $__b;
  HEAP32[EMTSTACKTOP + 24 >> 2] = $__e;
  HEAP32[EMTSTACKTOP + 32 >> 2] = $__iob;
  HEAP32[EMTSTACKTOP + 40 >> 2] = $__err;
  HEAP32[EMTSTACKTOP + 48 >> 2] = $__v;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1030552 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNKSt3__27num_getIwNS_19istreambuf_iteratorIwNS_11char_traitsIwEEEEE6do_getES4_S4_RNS_8ios_baseERjRy($this, $__b, $__e, $__iob, $__err, $__v) {
 $this = $this | 0;
 $__b = $__b | 0;
 $__e = $__e | 0;
 $__iob = $__iob | 0;
 $__err = $__err | 0;
 $__v = $__v | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $__b;
  HEAP32[EMTSTACKTOP + 24 >> 2] = $__e;
  HEAP32[EMTSTACKTOP + 32 >> 2] = $__iob;
  HEAP32[EMTSTACKTOP + 40 >> 2] = $__err;
  HEAP32[EMTSTACKTOP + 48 >> 2] = $__v;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1205104 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNKSt3__27num_getIwNS_19istreambuf_iteratorIwNS_11char_traitsIwEEEEE6do_getES4_S4_RNS_8ios_baseERjRx($this, $__b, $__e, $__iob, $__err, $__v) {
 $this = $this | 0;
 $__b = $__b | 0;
 $__e = $__e | 0;
 $__iob = $__iob | 0;
 $__err = $__err | 0;
 $__v = $__v | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $__b;
  HEAP32[EMTSTACKTOP + 24 >> 2] = $__e;
  HEAP32[EMTSTACKTOP + 32 >> 2] = $__iob;
  HEAP32[EMTSTACKTOP + 40 >> 2] = $__err;
  HEAP32[EMTSTACKTOP + 48 >> 2] = $__v;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1205608 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNKSt3__27num_getIwNS_19istreambuf_iteratorIwNS_11char_traitsIwEEEEE6do_getES4_S4_RNS_8ios_baseERjRt($this, $__b, $__e, $__iob, $__err, $__v) {
 $this = $this | 0;
 $__b = $__b | 0;
 $__e = $__e | 0;
 $__iob = $__iob | 0;
 $__err = $__err | 0;
 $__v = $__v | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $__b;
  HEAP32[EMTSTACKTOP + 24 >> 2] = $__e;
  HEAP32[EMTSTACKTOP + 32 >> 2] = $__iob;
  HEAP32[EMTSTACKTOP + 40 >> 2] = $__err;
  HEAP32[EMTSTACKTOP + 48 >> 2] = $__v;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1205188 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNKSt3__27num_getIwNS_19istreambuf_iteratorIwNS_11char_traitsIwEEEEE6do_getES4_S4_RNS_8ios_baseERjRm($this, $__b, $__e, $__iob, $__err, $__v) {
 $this = $this | 0;
 $__b = $__b | 0;
 $__e = $__e | 0;
 $__iob = $__iob | 0;
 $__err = $__err | 0;
 $__v = $__v | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $__b;
  HEAP32[EMTSTACKTOP + 24 >> 2] = $__e;
  HEAP32[EMTSTACKTOP + 32 >> 2] = $__iob;
  HEAP32[EMTSTACKTOP + 40 >> 2] = $__err;
  HEAP32[EMTSTACKTOP + 48 >> 2] = $__v;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1205272 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNKSt3__27num_getIwNS_19istreambuf_iteratorIwNS_11char_traitsIwEEEEE6do_getES4_S4_RNS_8ios_baseERjRl($this, $__b, $__e, $__iob, $__err, $__v) {
 $this = $this | 0;
 $__b = $__b | 0;
 $__e = $__e | 0;
 $__iob = $__iob | 0;
 $__err = $__err | 0;
 $__v = $__v | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $__b;
  HEAP32[EMTSTACKTOP + 24 >> 2] = $__e;
  HEAP32[EMTSTACKTOP + 32 >> 2] = $__iob;
  HEAP32[EMTSTACKTOP + 40 >> 2] = $__err;
  HEAP32[EMTSTACKTOP + 48 >> 2] = $__v;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1205692 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNKSt3__27num_getIwNS_19istreambuf_iteratorIwNS_11char_traitsIwEEEEE6do_getES4_S4_RNS_8ios_baseERjRf($this, $__b, $__e, $__iob, $__err, $__v) {
 $this = $this | 0;
 $__b = $__b | 0;
 $__e = $__e | 0;
 $__iob = $__iob | 0;
 $__err = $__err | 0;
 $__v = $__v | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $__b;
  HEAP32[EMTSTACKTOP + 24 >> 2] = $__e;
  HEAP32[EMTSTACKTOP + 32 >> 2] = $__iob;
  HEAP32[EMTSTACKTOP + 40 >> 2] = $__err;
  HEAP32[EMTSTACKTOP + 48 >> 2] = $__v;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1203688 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNKSt3__27num_getIwNS_19istreambuf_iteratorIwNS_11char_traitsIwEEEEE6do_getES4_S4_RNS_8ios_baseERjRe($this, $__b, $__e, $__iob, $__err, $__v) {
 $this = $this | 0;
 $__b = $__b | 0;
 $__e = $__e | 0;
 $__iob = $__iob | 0;
 $__err = $__err | 0;
 $__v = $__v | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $__b;
  HEAP32[EMTSTACKTOP + 24 >> 2] = $__e;
  HEAP32[EMTSTACKTOP + 32 >> 2] = $__iob;
  HEAP32[EMTSTACKTOP + 40 >> 2] = $__err;
  HEAP32[EMTSTACKTOP + 48 >> 2] = $__v;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1203772 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNKSt3__27num_getIwNS_19istreambuf_iteratorIwNS_11char_traitsIwEEEEE6do_getES4_S4_RNS_8ios_baseERjRd($this, $__b, $__e, $__iob, $__err, $__v) {
 $this = $this | 0;
 $__b = $__b | 0;
 $__e = $__e | 0;
 $__iob = $__iob | 0;
 $__err = $__err | 0;
 $__v = $__v | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $__b;
  HEAP32[EMTSTACKTOP + 24 >> 2] = $__e;
  HEAP32[EMTSTACKTOP + 32 >> 2] = $__iob;
  HEAP32[EMTSTACKTOP + 40 >> 2] = $__err;
  HEAP32[EMTSTACKTOP + 48 >> 2] = $__v;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1203856 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNKSt3__27num_getIwNS_19istreambuf_iteratorIwNS_11char_traitsIwEEEEE6do_getES4_S4_RNS_8ios_baseERjRb($this, $__b, $__e, $__iob, $__err, $__v) {
 $this = $this | 0;
 $__b = $__b | 0;
 $__e = $__e | 0;
 $__iob = $__iob | 0;
 $__err = $__err | 0;
 $__v = $__v | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $__b;
  HEAP32[EMTSTACKTOP + 24 >> 2] = $__e;
  HEAP32[EMTSTACKTOP + 32 >> 2] = $__iob;
  HEAP32[EMTSTACKTOP + 40 >> 2] = $__err;
  HEAP32[EMTSTACKTOP + 48 >> 2] = $__v;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1138660 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNKSt3__27num_getIcNS_19istreambuf_iteratorIcNS_11char_traitsIcEEEEE6do_getES4_S4_RNS_8ios_baseERjRy($this, $__b, $__e, $__iob, $__err, $__v) {
 $this = $this | 0;
 $__b = $__b | 0;
 $__e = $__e | 0;
 $__iob = $__iob | 0;
 $__err = $__err | 0;
 $__v = $__v | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $__b;
  HEAP32[EMTSTACKTOP + 24 >> 2] = $__e;
  HEAP32[EMTSTACKTOP + 32 >> 2] = $__iob;
  HEAP32[EMTSTACKTOP + 40 >> 2] = $__err;
  HEAP32[EMTSTACKTOP + 48 >> 2] = $__v;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1205356 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNKSt3__27num_getIcNS_19istreambuf_iteratorIcNS_11char_traitsIcEEEEE6do_getES4_S4_RNS_8ios_baseERjRx($this, $__b, $__e, $__iob, $__err, $__v) {
 $this = $this | 0;
 $__b = $__b | 0;
 $__e = $__e | 0;
 $__iob = $__iob | 0;
 $__err = $__err | 0;
 $__v = $__v | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $__b;
  HEAP32[EMTSTACKTOP + 24 >> 2] = $__e;
  HEAP32[EMTSTACKTOP + 32 >> 2] = $__iob;
  HEAP32[EMTSTACKTOP + 40 >> 2] = $__err;
  HEAP32[EMTSTACKTOP + 48 >> 2] = $__v;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1205776 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNKSt3__27num_getIcNS_19istreambuf_iteratorIcNS_11char_traitsIcEEEEE6do_getES4_S4_RNS_8ios_baseERjRt($this, $__b, $__e, $__iob, $__err, $__v) {
 $this = $this | 0;
 $__b = $__b | 0;
 $__e = $__e | 0;
 $__iob = $__iob | 0;
 $__err = $__err | 0;
 $__v = $__v | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $__b;
  HEAP32[EMTSTACKTOP + 24 >> 2] = $__e;
  HEAP32[EMTSTACKTOP + 32 >> 2] = $__iob;
  HEAP32[EMTSTACKTOP + 40 >> 2] = $__err;
  HEAP32[EMTSTACKTOP + 48 >> 2] = $__v;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1205440 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNKSt3__27num_getIcNS_19istreambuf_iteratorIcNS_11char_traitsIcEEEEE6do_getES4_S4_RNS_8ios_baseERjRm($this, $__b, $__e, $__iob, $__err, $__v) {
 $this = $this | 0;
 $__b = $__b | 0;
 $__e = $__e | 0;
 $__iob = $__iob | 0;
 $__err = $__err | 0;
 $__v = $__v | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $__b;
  HEAP32[EMTSTACKTOP + 24 >> 2] = $__e;
  HEAP32[EMTSTACKTOP + 32 >> 2] = $__iob;
  HEAP32[EMTSTACKTOP + 40 >> 2] = $__err;
  HEAP32[EMTSTACKTOP + 48 >> 2] = $__v;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1205524 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNKSt3__27num_getIcNS_19istreambuf_iteratorIcNS_11char_traitsIcEEEEE6do_getES4_S4_RNS_8ios_baseERjRl($this, $__b, $__e, $__iob, $__err, $__v) {
 $this = $this | 0;
 $__b = $__b | 0;
 $__e = $__e | 0;
 $__iob = $__iob | 0;
 $__err = $__err | 0;
 $__v = $__v | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $__b;
  HEAP32[EMTSTACKTOP + 24 >> 2] = $__e;
  HEAP32[EMTSTACKTOP + 32 >> 2] = $__iob;
  HEAP32[EMTSTACKTOP + 40 >> 2] = $__err;
  HEAP32[EMTSTACKTOP + 48 >> 2] = $__v;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1205860 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNKSt3__27num_getIcNS_19istreambuf_iteratorIcNS_11char_traitsIcEEEEE6do_getES4_S4_RNS_8ios_baseERjRf($this, $__b, $__e, $__iob, $__err, $__v) {
 $this = $this | 0;
 $__b = $__b | 0;
 $__e = $__e | 0;
 $__iob = $__iob | 0;
 $__err = $__err | 0;
 $__v = $__v | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $__b;
  HEAP32[EMTSTACKTOP + 24 >> 2] = $__e;
  HEAP32[EMTSTACKTOP + 32 >> 2] = $__iob;
  HEAP32[EMTSTACKTOP + 40 >> 2] = $__err;
  HEAP32[EMTSTACKTOP + 48 >> 2] = $__v;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1203940 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNKSt3__27num_getIcNS_19istreambuf_iteratorIcNS_11char_traitsIcEEEEE6do_getES4_S4_RNS_8ios_baseERjRe($this, $__b, $__e, $__iob, $__err, $__v) {
 $this = $this | 0;
 $__b = $__b | 0;
 $__e = $__e | 0;
 $__iob = $__iob | 0;
 $__err = $__err | 0;
 $__v = $__v | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $__b;
  HEAP32[EMTSTACKTOP + 24 >> 2] = $__e;
  HEAP32[EMTSTACKTOP + 32 >> 2] = $__iob;
  HEAP32[EMTSTACKTOP + 40 >> 2] = $__err;
  HEAP32[EMTSTACKTOP + 48 >> 2] = $__v;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1204024 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNKSt3__27num_getIcNS_19istreambuf_iteratorIcNS_11char_traitsIcEEEEE6do_getES4_S4_RNS_8ios_baseERjRd($this, $__b, $__e, $__iob, $__err, $__v) {
 $this = $this | 0;
 $__b = $__b | 0;
 $__e = $__e | 0;
 $__iob = $__iob | 0;
 $__err = $__err | 0;
 $__v = $__v | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $__b;
  HEAP32[EMTSTACKTOP + 24 >> 2] = $__e;
  HEAP32[EMTSTACKTOP + 32 >> 2] = $__iob;
  HEAP32[EMTSTACKTOP + 40 >> 2] = $__err;
  HEAP32[EMTSTACKTOP + 48 >> 2] = $__v;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1204108 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNKSt3__27num_getIcNS_19istreambuf_iteratorIcNS_11char_traitsIcEEEEE6do_getES4_S4_RNS_8ios_baseERjRb($this, $__b, $__e, $__iob, $__err, $__v) {
 $this = $this | 0;
 $__b = $__b | 0;
 $__e = $__e | 0;
 $__iob = $__iob | 0;
 $__err = $__err | 0;
 $__v = $__v | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $__b;
  HEAP32[EMTSTACKTOP + 24 >> 2] = $__e;
  HEAP32[EMTSTACKTOP + 32 >> 2] = $__iob;
  HEAP32[EMTSTACKTOP + 40 >> 2] = $__err;
  HEAP32[EMTSTACKTOP + 48 >> 2] = $__v;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1139072 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNSt3__220__shared_ptr_emplaceI28FunctionDrivenToggleMenuItemIiENS_9allocatorIS2_EEED0Ev($this) {
 $this = $this | 0;
 var $0 = 0, $2 = 0, $4 = 0, $5 = 0, $6 = 0;
 HEAP32[$this >> 2] = 3248;
 $0 = $this + 12 | 0;
 HEAP32[$0 >> 2] = 3212;
 $2 = HEAP32[$this + 60 >> 2] | 0;
 $4 = $2;
 if ($2 | 0) {
  $5 = $this + 64 | 0;
  $6 = HEAP32[$5 >> 2] | 0;
  if (($6 | 0) != ($2 | 0)) HEAP32[$5 >> 2] = $6 + (~(($6 + -4 - $4 | 0) >>> 2) << 2);
  __ZdlPv($2);
 }
 HEAP32[$0 >> 2] = 2172;
 __ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEED2Ev($this + 16 | 0);
 __ZNSt3__214__shared_countD2Ev($this);
 __ZdlPv($this);
 return;
}

function _memcmp($vl, $vr, $n) {
 $vl = $vl | 0;
 $vr = $vr | 0;
 $n = $n | 0;
 var $$03 = 0, $$lcssa = 0, $$lcssa19 = 0, $1 = 0, $11 = 0, $2 = 0, $l$04 = 0, $r$05 = 0;
 L1 : do if (!$n) $11 = 0; else {
  $$03 = $n;
  $l$04 = $vl;
  $r$05 = $vr;
  while (1) {
   $1 = HEAP8[$l$04 >> 0] | 0;
   $2 = HEAP8[$r$05 >> 0] | 0;
   if ($1 << 24 >> 24 != $2 << 24 >> 24) {
    $$lcssa = $1;
    $$lcssa19 = $2;
    break;
   }
   $$03 = $$03 + -1 | 0;
   if (!$$03) {
    $11 = 0;
    break L1;
   } else {
    $l$04 = $l$04 + 1 | 0;
    $r$05 = $r$05 + 1 | 0;
   }
  }
  $11 = ($$lcssa & 255) - ($$lcssa19 & 255) | 0;
 } while (0);
 return $11 | 0;
}

function ___stdio_seek($f, $off, $whence) {
 $f = $f | 0;
 $off = $off | 0;
 $whence = $whence | 0;
 var $5 = 0, $ret = 0, $vararg_buffer = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32 | 0;
 $vararg_buffer = sp;
 $ret = sp + 20 | 0;
 HEAP32[$vararg_buffer >> 2] = HEAP32[$f + 60 >> 2];
 HEAP32[$vararg_buffer + 4 >> 2] = 0;
 HEAP32[$vararg_buffer + 8 >> 2] = $off;
 HEAP32[$vararg_buffer + 12 >> 2] = $ret;
 HEAP32[$vararg_buffer + 16 >> 2] = $whence;
 if ((___syscall_ret(___syscall140(140, $vararg_buffer | 0) | 0) | 0) < 0) {
  HEAP32[$ret >> 2] = -1;
  $5 = -1;
 } else $5 = HEAP32[$ret >> 2] | 0;
 STACKTOP = sp;
 return $5 | 0;
}

function __ZNKSt3__27num_putIwNS_19ostreambuf_iteratorIwNS_11char_traitsIwEEEEE6do_putES4_RNS_8ios_baseEwy($this, $__s, $__iob, $__fl, $0, $1) {
 $this = $this | 0;
 $__s = $__s | 0;
 $__iob = $__iob | 0;
 $__fl = $__fl | 0;
 $0 = $0 | 0;
 $1 = $1 | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $__s;
  HEAP32[EMTSTACKTOP + 24 >> 2] = $__iob;
  HEAP32[EMTSTACKTOP + 32 >> 2] = $__fl;
  HEAP32[EMTSTACKTOP + 40 >> 2] = $0;
  HEAP32[EMTSTACKTOP + 48 >> 2] = $1;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1171028 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNKSt3__27num_putIwNS_19ostreambuf_iteratorIwNS_11char_traitsIwEEEEE6do_putES4_RNS_8ios_baseEwx($this, $__s, $__iob, $__fl, $0, $1) {
 $this = $this | 0;
 $__s = $__s | 0;
 $__iob = $__iob | 0;
 $__fl = $__fl | 0;
 $0 = $0 | 0;
 $1 = $1 | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $__s;
  HEAP32[EMTSTACKTOP + 24 >> 2] = $__iob;
  HEAP32[EMTSTACKTOP + 32 >> 2] = $__fl;
  HEAP32[EMTSTACKTOP + 40 >> 2] = $0;
  HEAP32[EMTSTACKTOP + 48 >> 2] = $1;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1171272 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNKSt3__27num_putIcNS_19ostreambuf_iteratorIcNS_11char_traitsIcEEEEE6do_putES4_RNS_8ios_baseEcy($this, $__s, $__iob, $__fl, $0, $1) {
 $this = $this | 0;
 $__s = $__s | 0;
 $__iob = $__iob | 0;
 $__fl = $__fl | 0;
 $0 = $0 | 0;
 $1 = $1 | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $__s;
  HEAP32[EMTSTACKTOP + 24 >> 2] = $__iob;
  HEAP32[EMTSTACKTOP + 32 >> 2] = $__fl;
  HEAP32[EMTSTACKTOP + 40 >> 2] = $0;
  HEAP32[EMTSTACKTOP + 48 >> 2] = $1;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1171516 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNKSt3__27num_putIcNS_19ostreambuf_iteratorIcNS_11char_traitsIcEEEEE6do_putES4_RNS_8ios_baseEcx($this, $__s, $__iob, $__fl, $0, $1) {
 $this = $this | 0;
 $__s = $__s | 0;
 $__iob = $__iob | 0;
 $__fl = $__fl | 0;
 $0 = $0 | 0;
 $1 = $1 | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $__s;
  HEAP32[EMTSTACKTOP + 24 >> 2] = $__iob;
  HEAP32[EMTSTACKTOP + 32 >> 2] = $__fl;
  HEAP32[EMTSTACKTOP + 40 >> 2] = $0;
  HEAP32[EMTSTACKTOP + 48 >> 2] = $1;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1171752 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNSt3__220__shared_ptr_emplaceI28FunctionDrivenToggleMenuItemIiENS_9allocatorIS2_EEED2Ev($this) {
 $this = $this | 0;
 var $0 = 0, $2 = 0, $4 = 0, $5 = 0, $6 = 0;
 HEAP32[$this >> 2] = 3248;
 $0 = $this + 12 | 0;
 HEAP32[$0 >> 2] = 3212;
 $2 = HEAP32[$this + 60 >> 2] | 0;
 $4 = $2;
 if ($2 | 0) {
  $5 = $this + 64 | 0;
  $6 = HEAP32[$5 >> 2] | 0;
  if (($6 | 0) != ($2 | 0)) HEAP32[$5 >> 2] = $6 + (~(($6 + -4 - $4 | 0) >>> 2) << 2);
  __ZdlPv($2);
 }
 HEAP32[$0 >> 2] = 2172;
 __ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEED2Ev($this + 16 | 0);
 __ZNSt3__214__shared_countD2Ev($this);
 return;
}

function __ZNK10__cxxabiv121__vmi_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib($this, $info, $current_ptr, $path_below, $use_strcmp) {
 $this = $this | 0;
 $info = $info | 0;
 $current_ptr = $current_ptr | 0;
 $path_below = $path_below | 0;
 $use_strcmp = $use_strcmp | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $info;
  HEAP32[EMTSTACKTOP + 24 >> 2] = $current_ptr;
  HEAP32[EMTSTACKTOP + 32 >> 2] = $path_below;
  HEAP32[EMTSTACKTOP + 40 >> 2] = $use_strcmp;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1037196 | 0);
}

function __ZNK10__cxxabiv120__si_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib($this, $info, $current_ptr, $path_below, $use_strcmp) {
 $this = $this | 0;
 $info = $info | 0;
 $current_ptr = $current_ptr | 0;
 $path_below = $path_below | 0;
 $use_strcmp = $use_strcmp | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $info;
  HEAP32[EMTSTACKTOP + 24 >> 2] = $current_ptr;
  HEAP32[EMTSTACKTOP + 32 >> 2] = $path_below;
  HEAP32[EMTSTACKTOP + 40 >> 2] = $use_strcmp;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1146768 | 0);
}

function _strcmp($l, $r) {
 $l = $l | 0;
 $r = $r | 0;
 var $$014 = 0, $$05 = 0, $$lcssa = 0, $$lcssa2 = 0, $0 = 0, $1 = 0, $6 = 0, $7 = 0;
 $0 = HEAP8[$l >> 0] | 0;
 $1 = HEAP8[$r >> 0] | 0;
 if ($0 << 24 >> 24 == 0 ? 1 : $0 << 24 >> 24 != $1 << 24 >> 24) {
  $$lcssa = $0;
  $$lcssa2 = $1;
 } else {
  $$014 = $l;
  $$05 = $r;
  do {
   $$014 = $$014 + 1 | 0;
   $$05 = $$05 + 1 | 0;
   $6 = HEAP8[$$014 >> 0] | 0;
   $7 = HEAP8[$$05 >> 0] | 0;
  } while (!($6 << 24 >> 24 == 0 ? 1 : $6 << 24 >> 24 != $7 << 24 >> 24));
  $$lcssa = $6;
  $$lcssa2 = $7;
 }
 return ($$lcssa & 255) - ($$lcssa2 & 255) | 0;
}

function _wmemmove($d, $s, $n) {
 $d = $d | 0;
 $s = $s | 0;
 $n = $n | 0;
 var $$025 = 0, $$07 = 0, $$16 = 0, $$in = 0, $5 = 0;
 $5 = ($n | 0) == 0;
 if ($d - $s >> 2 >>> 0 < $n >>> 0) {
  if (!$5) {
   $$in = $n;
   do {
    $$in = $$in + -1 | 0;
    HEAP32[$d + ($$in << 2) >> 2] = HEAP32[$s + ($$in << 2) >> 2];
   } while (($$in | 0) != 0);
  }
 } else if (!$5) {
  $$025 = $s;
  $$07 = $d;
  $$16 = $n;
  while (1) {
   $$16 = $$16 + -1 | 0;
   HEAP32[$$07 >> 2] = HEAP32[$$025 >> 2];
   if (!$$16) break; else {
    $$025 = $$025 + 4 | 0;
    $$07 = $$07 + 4 | 0;
   }
  }
 }
 return $d | 0;
}

function __ZN13ERDatabaseKVSD0Ev($this) {
 $this = $this | 0;
 HEAP32[$this >> 2] = 2328;
 __ZNSt3__26__treeINS_12__value_typeINS_12basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEES7_EENS_19__map_value_compareIS7_S8_NS_4lessIS7_EELb1EEENS5_IS8_EEE7destroyEPNS_11__tree_nodeIS8_PvEE($this + 16 | 0, HEAP32[$this + 20 >> 2] | 0);
 __ZNSt3__26__treeINS_12__value_typeINS_12basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEEbEENS_19__map_value_compareIS7_S8_NS_4lessIS7_EELb1EEENS5_IS8_EEE7destroyEPNS_11__tree_nodeIS8_PvEE($this + 4 | 0, HEAP32[$this + 8 >> 2] | 0);
 __ZdlPv($this);
 return;
}

function __ZNKSt3__27num_putIwNS_19ostreambuf_iteratorIwNS_11char_traitsIwEEEEE6do_putES4_RNS_8ios_baseEwPKv($this, $__s, $__iob, $__fl, $__v) {
 $this = $this | 0;
 $__s = $__s | 0;
 $__iob = $__iob | 0;
 $__fl = $__fl | 0;
 $__v = $__v | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $__s;
  HEAP32[EMTSTACKTOP + 24 >> 2] = $__iob;
  HEAP32[EMTSTACKTOP + 32 >> 2] = $__fl;
  HEAP32[EMTSTACKTOP + 40 >> 2] = $__v;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1169928 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNKSt3__27num_putIcNS_19ostreambuf_iteratorIcNS_11char_traitsIcEEEEE6do_putES4_RNS_8ios_baseEcPKv($this, $__s, $__iob, $__fl, $__v) {
 $this = $this | 0;
 $__s = $__s | 0;
 $__iob = $__iob | 0;
 $__fl = $__fl | 0;
 $__v = $__v | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $__s;
  HEAP32[EMTSTACKTOP + 24 >> 2] = $__iob;
  HEAP32[EMTSTACKTOP + 32 >> 2] = $__fl;
  HEAP32[EMTSTACKTOP + 40 >> 2] = $__v;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1170272 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNKSt3__27num_putIwNS_19ostreambuf_iteratorIwNS_11char_traitsIwEEEEE6do_putES4_RNS_8ios_baseEwm($this, $__s, $__iob, $__fl, $__v) {
 $this = $this | 0;
 $__s = $__s | 0;
 $__iob = $__iob | 0;
 $__fl = $__fl | 0;
 $__v = $__v | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $__s;
  HEAP32[EMTSTACKTOP + 24 >> 2] = $__iob;
  HEAP32[EMTSTACKTOP + 32 >> 2] = $__fl;
  HEAP32[EMTSTACKTOP + 40 >> 2] = $__v;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1164688 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNKSt3__27num_putIwNS_19ostreambuf_iteratorIwNS_11char_traitsIwEEEEE6do_putES4_RNS_8ios_baseEwl($this, $__s, $__iob, $__fl, $__v) {
 $this = $this | 0;
 $__s = $__s | 0;
 $__iob = $__iob | 0;
 $__fl = $__fl | 0;
 $__v = $__v | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $__s;
  HEAP32[EMTSTACKTOP + 24 >> 2] = $__iob;
  HEAP32[EMTSTACKTOP + 32 >> 2] = $__fl;
  HEAP32[EMTSTACKTOP + 40 >> 2] = $__v;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1164996 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNKSt3__27num_putIwNS_19ostreambuf_iteratorIwNS_11char_traitsIwEEEEE6do_putES4_RNS_8ios_baseEwb($this, $__s, $__iob, $__fl, $__v) {
 $this = $this | 0;
 $__s = $__s | 0;
 $__iob = $__iob | 0;
 $__fl = $__fl | 0;
 $__v = $__v | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $__s;
  HEAP32[EMTSTACKTOP + 24 >> 2] = $__iob;
  HEAP32[EMTSTACKTOP + 32 >> 2] = $__fl;
  HEAP32[EMTSTACKTOP + 40 >> 2] = $__v;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1146348 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNKSt3__27num_putIcNS_19ostreambuf_iteratorIcNS_11char_traitsIcEEEEE6do_putES4_RNS_8ios_baseEcm($this, $__s, $__iob, $__fl, $__v) {
 $this = $this | 0;
 $__s = $__s | 0;
 $__iob = $__iob | 0;
 $__fl = $__fl | 0;
 $__v = $__v | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $__s;
  HEAP32[EMTSTACKTOP + 24 >> 2] = $__iob;
  HEAP32[EMTSTACKTOP + 32 >> 2] = $__fl;
  HEAP32[EMTSTACKTOP + 40 >> 2] = $__v;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1165304 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNKSt3__27num_putIcNS_19ostreambuf_iteratorIcNS_11char_traitsIcEEEEE6do_putES4_RNS_8ios_baseEcl($this, $__s, $__iob, $__fl, $__v) {
 $this = $this | 0;
 $__s = $__s | 0;
 $__iob = $__iob | 0;
 $__fl = $__fl | 0;
 $__v = $__v | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $__s;
  HEAP32[EMTSTACKTOP + 24 >> 2] = $__iob;
  HEAP32[EMTSTACKTOP + 32 >> 2] = $__fl;
  HEAP32[EMTSTACKTOP + 40 >> 2] = $__v;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1165608 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNKSt3__27num_putIcNS_19ostreambuf_iteratorIcNS_11char_traitsIcEEEEE6do_putES4_RNS_8ios_baseEcb($this, $__s, $__iob, $__fl, $__v) {
 $this = $this | 0;
 $__s = $__s | 0;
 $__iob = $__iob | 0;
 $__fl = $__fl | 0;
 $__v = $__v | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $__s;
  HEAP32[EMTSTACKTOP + 24 >> 2] = $__iob;
  HEAP32[EMTSTACKTOP + 32 >> 2] = $__fl;
  HEAP32[EMTSTACKTOP + 40 >> 2] = $__v;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1150124 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNKSt3__27num_putIwNS_19ostreambuf_iteratorIwNS_11char_traitsIwEEEEE6do_putES4_RNS_8ios_baseEwe($this, $__s, $__iob, $__fl, $__v) {
 $this = $this | 0;
 $__s = $__s | 0;
 $__iob = $__iob | 0;
 $__fl = $__fl | 0;
 $__v = +$__v;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $__s;
  HEAP32[EMTSTACKTOP + 24 >> 2] = $__iob;
  HEAP32[EMTSTACKTOP + 32 >> 2] = $__fl;
  HEAPF64[EMTSTACKTOP + 40 >> 3] = $__v;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1101628 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNKSt3__27num_putIwNS_19ostreambuf_iteratorIwNS_11char_traitsIwEEEEE6do_putES4_RNS_8ios_baseEwd($this, $__s, $__iob, $__fl, $__v) {
 $this = $this | 0;
 $__s = $__s | 0;
 $__iob = $__iob | 0;
 $__fl = $__fl | 0;
 $__v = +$__v;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $__s;
  HEAP32[EMTSTACKTOP + 24 >> 2] = $__iob;
  HEAP32[EMTSTACKTOP + 32 >> 2] = $__fl;
  HEAPF64[EMTSTACKTOP + 40 >> 3] = $__v;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1102144 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNKSt3__27num_putIcNS_19ostreambuf_iteratorIcNS_11char_traitsIcEEEEE6do_putES4_RNS_8ios_baseEce($this, $__s, $__iob, $__fl, $__v) {
 $this = $this | 0;
 $__s = $__s | 0;
 $__iob = $__iob | 0;
 $__fl = $__fl | 0;
 $__v = +$__v;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $__s;
  HEAP32[EMTSTACKTOP + 24 >> 2] = $__iob;
  HEAP32[EMTSTACKTOP + 32 >> 2] = $__fl;
  HEAPF64[EMTSTACKTOP + 40 >> 3] = $__v;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1102660 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNKSt3__27num_putIcNS_19ostreambuf_iteratorIcNS_11char_traitsIcEEEEE6do_putES4_RNS_8ios_baseEcd($this, $__s, $__iob, $__fl, $__v) {
 $this = $this | 0;
 $__s = $__s | 0;
 $__iob = $__iob | 0;
 $__fl = $__fl | 0;
 $__v = +$__v;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $__s;
  HEAP32[EMTSTACKTOP + 24 >> 2] = $__iob;
  HEAP32[EMTSTACKTOP + 32 >> 2] = $__fl;
  HEAPF64[EMTSTACKTOP + 40 >> 3] = $__v;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1103160 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZN13ERDatabaseKVSD2Ev($this) {
 $this = $this | 0;
 HEAP32[$this >> 2] = 2328;
 __ZNSt3__26__treeINS_12__value_typeINS_12basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEES7_EENS_19__map_value_compareIS7_S8_NS_4lessIS7_EELb1EEENS5_IS8_EEE7destroyEPNS_11__tree_nodeIS8_PvEE($this + 16 | 0, HEAP32[$this + 20 >> 2] | 0);
 __ZNSt3__26__treeINS_12__value_typeINS_12basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEEbEENS_19__map_value_compareIS7_S8_NS_4lessIS7_EELb1EEENS5_IS8_EEE7destroyEPNS_11__tree_nodeIS8_PvEE($this + 4 | 0, HEAP32[$this + 8 >> 2] | 0);
 return;
}

function __ZNSt3__214__split_bufferIPNS_6locale5facetERNS_15__sso_allocatorIS3_Lj28EEEED2Ev($this) {
 $this = $this | 0;
 var $1 = 0, $2 = 0, $3 = 0, $5 = 0, $6 = 0, $9 = 0;
 $1 = HEAP32[$this + 4 >> 2] | 0;
 $2 = $this + 8 | 0;
 $3 = HEAP32[$2 >> 2] | 0;
 while (1) {
  if (($3 | 0) == ($1 | 0)) break;
  $5 = $3 + -4 | 0;
  HEAP32[$2 >> 2] = $5;
  $3 = $5;
 }
 $6 = HEAP32[$this >> 2] | 0;
 do if ($6 | 0) {
  $9 = HEAP32[$this + 16 >> 2] | 0;
  if (($9 | 0) == ($6 | 0)) {
   HEAP8[$9 + 112 >> 0] = 0;
   break;
  } else {
   __ZdlPv($6);
   break;
  }
 } while (0);
 return;
}

function _remove($path) {
 $path = $path | 0;
 var $1 = 0, $8 = 0, $vararg_buffer = 0, $vararg_buffer1 = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16 | 0;
 $vararg_buffer1 = sp + 8 | 0;
 $vararg_buffer = sp;
 HEAP32[$vararg_buffer >> 2] = $path;
 $1 = ___syscall_ret(___syscall10(10, $vararg_buffer | 0) | 0) | 0;
 if (!$1) $8 = 0; else if ((HEAP32[(___errno_location() | 0) >> 2] | 0) == 21) {
  HEAP32[$vararg_buffer1 >> 2] = $path;
  $8 = ___syscall_ret(___syscall40(40, $vararg_buffer1 | 0) | 0) | 0;
 } else $8 = $1;
 STACKTOP = sp;
 return $8 | 0;
}

function __ZNKSt3__25ctypeIwE5do_isEPKwS3_Pt($this, $low, $high, $vec) {
 $this = $this | 0;
 $low = $low | 0;
 $high = $high | 0;
 $vec = $vec | 0;
 var $$0 = 0, $$01 = 0, $11 = 0, $2 = 0, $4 = 0;
 $2 = ($high - $low | 0) >>> 2;
 $$0 = $vec;
 $$01 = $low;
 while (1) {
  if (($$01 | 0) == ($high | 0)) break;
  $4 = HEAP32[$$01 >> 2] | 0;
  if ($4 >>> 0 < 128) $11 = HEAPU16[(HEAP32[(___ctype_b_loc() | 0) >> 2] | 0) + ($4 << 1) >> 1] | 0; else $11 = 0;
  HEAP16[$$0 >> 1] = $11;
  $$0 = $$0 + 2 | 0;
  $$01 = $$01 + 4 | 0;
 }
 return $low + ($2 << 2) | 0;
}

function ___stdout_write($f, $buf, $len) {
 $f = $f | 0;
 $buf = $buf | 0;
 $len = $len | 0;
 var $9 = 0, $vararg_buffer = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 80 | 0;
 $vararg_buffer = sp;
 HEAP32[$f + 36 >> 2] = 4;
 if (!(HEAP32[$f >> 2] & 64)) {
  HEAP32[$vararg_buffer >> 2] = HEAP32[$f + 60 >> 2];
  HEAP32[$vararg_buffer + 4 >> 2] = 21505;
  HEAP32[$vararg_buffer + 8 >> 2] = sp + 12;
  if (___syscall54(54, $vararg_buffer | 0) | 0) HEAP8[$f + 75 >> 0] = -1;
 }
 $9 = ___stdio_write($f, $buf, $len) | 0;
 STACKTOP = sp;
 return $9 | 0;
}

function __ZNKSt3__25ctypeIwE11do_scan_notEtPKwS3_($this, $m, $low, $high) {
 $this = $this | 0;
 $m = $m | 0;
 $low = $low | 0;
 $high = $high | 0;
 var $$0 = 0, $$0$lcssa = 0, $1 = 0;
 $$0 = $low;
 while (1) {
  if (($$0 | 0) == ($high | 0)) {
   $$0$lcssa = $high;
   break;
  }
  $1 = HEAP32[$$0 >> 2] | 0;
  if ($1 >>> 0 >= 128) {
   $$0$lcssa = $$0;
   break;
  }
  if (!((HEAP16[(HEAP32[(___ctype_b_loc() | 0) >> 2] | 0) + ($1 << 1) >> 1] & $m) << 16 >> 16)) {
   $$0$lcssa = $$0;
   break;
  }
  $$0 = $$0 + 4 | 0;
 }
 return $$0$lcssa | 0;
}

function __ZNK10__cxxabiv121__vmi_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi($this, $info, $adjustedPtr, $path_below) {
 $this = $this | 0;
 $info = $info | 0;
 $adjustedPtr = $adjustedPtr | 0;
 $path_below = $path_below | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $info;
  HEAP32[EMTSTACKTOP + 24 >> 2] = $adjustedPtr;
  HEAP32[EMTSTACKTOP + 32 >> 2] = $path_below;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1196580 | 0);
}

function __ZNK10__cxxabiv120__si_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi($this, $info, $adjustedPtr, $path_below) {
 $this = $this | 0;
 $info = $info | 0;
 $adjustedPtr = $adjustedPtr | 0;
 $path_below = $path_below | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $info;
  HEAP32[EMTSTACKTOP + 24 >> 2] = $adjustedPtr;
  HEAP32[EMTSTACKTOP + 32 >> 2] = $path_below;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1216140 | 0);
}

function __ZN13ERDatabaseKVS12save_vehicleEiNSt3__212basic_stringIcNS0_11char_traitsIcEENS0_9allocatorIcEEEEi($this, $veh, $saveName, $slot) {
 $this = $this | 0;
 $veh = $veh | 0;
 $saveName = $saveName | 0;
 $slot = $slot | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $veh;
  HEAP32[EMTSTACKTOP + 24 >> 2] = $saveName;
  HEAP32[EMTSTACKTOP + 32 >> 2] = $slot;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 634292 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNSt3__26vectorIPNS_6locale5facetENS_15__sso_allocatorIS3_Lj28EEEE10deallocateEv($this) {
 $this = $this | 0;
 var $0 = 0, $2 = 0, $3 = 0, $5 = 0;
 $0 = HEAP32[$this >> 2] | 0;
 if ($0 | 0) {
  $2 = $this + 4 | 0;
  $3 = HEAP32[$2 >> 2] | 0;
  while (1) {
   if (($3 | 0) == ($0 | 0)) break;
   $5 = $3 + -4 | 0;
   HEAP32[$2 >> 2] = $5;
   $3 = $5;
  }
  if (($this + 16 | 0) == ($0 | 0)) HEAP8[$this + 128 >> 0] = 0; else __ZdlPv($0);
  HEAP32[$this + 8 >> 2] = 0;
  HEAP32[$2 >> 2] = 0;
  HEAP32[$this >> 2] = 0;
 }
 return;
}

function __ZNK10__cxxabiv117__class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib($this, $info, $dst_ptr, $current_ptr, $path_below, $use_strcmp) {
 $this = $this | 0;
 $info = $info | 0;
 $dst_ptr = $dst_ptr | 0;
 $current_ptr = $current_ptr | 0;
 $path_below = $path_below | 0;
 $use_strcmp = $use_strcmp | 0;
 if (($this | 0) == (HEAP32[$info + 8 >> 2] | 0)) __ZNK10__cxxabiv117__class_type_info29process_static_type_above_dstEPNS_19__dynamic_cast_infoEPKvS4_i(0, $info, $dst_ptr, $current_ptr, $path_below);
 return;
}

function ___string_read($f, $buf, $len) {
 $f = $f | 0;
 $buf = $buf | 0;
 $len = $len | 0;
 var $0 = 0, $1 = 0, $11 = 0, $2 = 0, $3 = 0, $k$0 = 0, $k$0$len = 0;
 $0 = $f + 84 | 0;
 $1 = HEAP32[$0 >> 2] | 0;
 $2 = $len + 256 | 0;
 $3 = _memchr($1, 0, $2) | 0;
 $k$0 = ($3 | 0) == 0 ? $2 : $3 - $1 | 0;
 $k$0$len = $k$0 >>> 0 < $len >>> 0 ? $k$0 : $len;
 _memcpy($buf | 0, $1 | 0, $k$0$len | 0) | 0;
 HEAP32[$f + 4 >> 2] = $1 + $k$0$len;
 $11 = $1 + $k$0 | 0;
 HEAP32[$f + 8 >> 2] = $11;
 HEAP32[$0 >> 2] = $11;
 return $k$0$len | 0;
}

function _calloc($n_elements, $elem_size) {
 $n_elements = $n_elements | 0;
 $elem_size = $elem_size | 0;
 var $1 = 0, $6 = 0, $req$0 = 0;
 if (!$n_elements) $req$0 = 0; else {
  $1 = Math_imul($elem_size, $n_elements) | 0;
  if (($elem_size | $n_elements) >>> 0 > 65535) $req$0 = (($1 >>> 0) / ($n_elements >>> 0) | 0 | 0) == ($elem_size | 0) ? $1 : -1; else $req$0 = $1;
 }
 $6 = _malloc($req$0) | 0;
 if (!$6) return $6 | 0;
 if (!(HEAP32[$6 + -4 >> 2] & 3)) return $6 | 0;
 _memset($6 | 0, 0, $req$0 | 0) | 0;
 return $6 | 0;
}

function ___muldi3($a$0, $a$1, $b$0, $b$1) {
 $a$0 = $a$0 | 0;
 $a$1 = $a$1 | 0;
 $b$0 = $b$0 | 0;
 $b$1 = $b$1 | 0;
 var $x_sroa_0_0_extract_trunc = 0, $y_sroa_0_0_extract_trunc = 0, $1$0 = 0, $1$1 = 0;
 $x_sroa_0_0_extract_trunc = $a$0;
 $y_sroa_0_0_extract_trunc = $b$0;
 $1$0 = ___muldsi3($x_sroa_0_0_extract_trunc, $y_sroa_0_0_extract_trunc) | 0;
 $1$1 = tempRet0;
 return (tempRet0 = (Math_imul($a$1, $y_sroa_0_0_extract_trunc) | 0) + (Math_imul($b$1, $x_sroa_0_0_extract_trunc) | 0) + $1$1 | $1$1 & 0, $1$0 | 0 | 0) | 0;
}

function __ZNSt3__215basic_stringbufIcNS_11char_traitsIcEENS_9allocatorIcEEE7seekposENS_4fposI11__mbstate_tEEj($agg$result, $this, $__sp, $__wch) {
 $agg$result = $agg$result | 0;
 $this = $this | 0;
 $__sp = $__sp | 0;
 $__wch = $__wch | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $agg$result;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $this;
  HEAP32[EMTSTACKTOP + 24 >> 2] = $__sp;
  HEAP32[EMTSTACKTOP + 32 >> 2] = $__wch;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1220820 | 0);
}

function __ZNSt3__213__vector_baseIPNS_6locale5facetENS_15__sso_allocatorIS3_Lj28EEEED2Ev($this) {
 $this = $this | 0;
 var $0 = 0, $2 = 0, $3 = 0, $5 = 0;
 $0 = HEAP32[$this >> 2] | 0;
 do if ($0 | 0) {
  $2 = $this + 4 | 0;
  $3 = HEAP32[$2 >> 2] | 0;
  while (1) {
   if (($3 | 0) == ($0 | 0)) break;
   $5 = $3 + -4 | 0;
   HEAP32[$2 >> 2] = $5;
   $3 = $5;
  }
  if (($this + 16 | 0) == ($0 | 0)) {
   HEAP8[$this + 128 >> 0] = 0;
   break;
  } else {
   __ZdlPv($0);
   break;
  }
 } while (0);
 return;
}

function _newlocale($mask, $name, $base) {
 $mask = $mask | 0;
 $name = $name | 0;
 $base = $base | 0;
 var $$01 = 0, label = 0;
 label = 0;
 if (!(HEAP8[$name >> 0] | 0)) label = 4; else if (!(_strcmp($name, 80907) | 0)) label = 4; else if (!(_strcmp($name, 80119) | 0)) label = 4; else $$01 = 0;
 do if ((label | 0) == 4) if (!$base) if (!(HEAP32[22837] | 0)) {
  HEAP32[22837] = 1;
  $$01 = 91352;
  break;
 } else {
  $$01 = _calloc(1, 4) | 0;
  break;
 } else $$01 = $base; while (0);
 return $$01 | 0;
}

function __ZNKSt3__25ctypeIwE9do_narrowEPKwS3_cPc($this, $low, $high, $dfault, $dest) {
 $this = $this | 0;
 $low = $low | 0;
 $high = $high | 0;
 $dfault = $dfault | 0;
 $dest = $dest | 0;
 var $$0 = 0, $$01 = 0, $2 = 0, $4 = 0;
 $2 = ($high - $low | 0) >>> 2;
 $$0 = $dest;
 $$01 = $low;
 while (1) {
  if (($$01 | 0) == ($high | 0)) break;
  $4 = HEAP32[$$01 >> 2] | 0;
  HEAP8[$$0 >> 0] = $4 >>> 0 < 128 ? $4 & 255 : $dfault;
  $$0 = $$0 + 1 | 0;
  $$01 = $$01 + 4 | 0;
 }
 return $low + ($2 << 2) | 0;
}

function __ZNKSt3__25ctypeIwE10do_scan_isEtPKwS3_($this, $m, $low, $high) {
 $this = $this | 0;
 $m = $m | 0;
 $low = $low | 0;
 $high = $high | 0;
 var $$0 = 0, $$0$lcssa = 0, $1 = 0;
 $$0 = $low;
 while (1) {
  if (($$0 | 0) == ($high | 0)) {
   $$0$lcssa = $high;
   break;
  }
  $1 = HEAP32[$$0 >> 2] | 0;
  if ($1 >>> 0 < 128) if ((HEAP16[(HEAP32[(___ctype_b_loc() | 0) >> 2] | 0) + ($1 << 1) >> 1] & $m) << 16 >> 16) {
   $$0$lcssa = $$0;
   break;
  }
  $$0 = $$0 + 4 | 0;
 }
 return $$0$lcssa | 0;
}

function __ZNSt3__28numpunctIwEC2Ej($this, $refs) {
 $this = $this | 0;
 $refs = $refs | 0;
 var $4 = 0, $__i$0$i$i = 0;
 HEAP32[$this + 4 >> 2] = $refs + -1;
 HEAP32[$this >> 2] = 10068;
 HEAP32[$this + 8 >> 2] = 46;
 HEAP32[$this + 12 >> 2] = 44;
 $4 = $this + 16 | 0;
 HEAP32[$4 >> 2] = 0;
 HEAP32[$4 + 4 >> 2] = 0;
 HEAP32[$4 + 8 >> 2] = 0;
 $__i$0$i$i = 0;
 while (1) {
  if (($__i$0$i$i | 0) == 3) break;
  HEAP32[$4 + ($__i$0$i$i << 2) >> 2] = 0;
  $__i$0$i$i = $__i$0$i$i + 1 | 0;
 }
 return;
}

function __ZN28FunctionDrivenToggleMenuItemIiED0Ev($this) {
 $this = $this | 0;
 var $1 = 0, $3 = 0, $4 = 0, $5 = 0;
 HEAP32[$this >> 2] = 3212;
 $1 = HEAP32[$this + 48 >> 2] | 0;
 $3 = $1;
 if ($1 | 0) {
  $4 = $this + 52 | 0;
  $5 = HEAP32[$4 >> 2] | 0;
  if (($5 | 0) != ($1 | 0)) HEAP32[$4 >> 2] = $5 + (~(($5 + -4 - $3 | 0) >>> 2) << 2);
  __ZdlPv($1);
 }
 HEAP32[$this >> 2] = 2172;
 __ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEED2Ev($this + 4 | 0);
 __ZdlPv($this);
 return;
}

function ___towrite($f) {
 $f = $f | 0;
 var $$0 = 0, $0 = 0, $13 = 0, $2 = 0, $6 = 0;
 $0 = $f + 74 | 0;
 $2 = HEAP8[$0 >> 0] | 0;
 HEAP8[$0 >> 0] = $2 + 255 | $2;
 $6 = HEAP32[$f >> 2] | 0;
 if (!($6 & 8)) {
  HEAP32[$f + 8 >> 2] = 0;
  HEAP32[$f + 4 >> 2] = 0;
  $13 = HEAP32[$f + 44 >> 2] | 0;
  HEAP32[$f + 28 >> 2] = $13;
  HEAP32[$f + 20 >> 2] = $13;
  HEAP32[$f + 16 >> 2] = $13 + (HEAP32[$f + 48 >> 2] | 0);
  $$0 = 0;
 } else {
  HEAP32[$f >> 2] = $6 | 32;
  $$0 = -1;
 }
 return $$0 | 0;
}

function __ZNSt3__28numpunctIcEC2Ej($this, $refs) {
 $this = $this | 0;
 $refs = $refs | 0;
 var $4 = 0, $__i$0$i$i = 0;
 HEAP32[$this + 4 >> 2] = $refs + -1;
 HEAP32[$this >> 2] = 10028;
 HEAP8[$this + 8 >> 0] = 46;
 HEAP8[$this + 9 >> 0] = 44;
 $4 = $this + 12 | 0;
 HEAP32[$4 >> 2] = 0;
 HEAP32[$4 + 4 >> 2] = 0;
 HEAP32[$4 + 8 >> 2] = 0;
 $__i$0$i$i = 0;
 while (1) {
  if (($__i$0$i$i | 0) == 3) break;
  HEAP32[$4 + ($__i$0$i$i << 2) >> 2] = 0;
  $__i$0$i$i = $__i$0$i$i + 1 | 0;
 }
 return;
}

function __ZNK10__cxxabiv117__class_type_info9can_catchEPKNS_16__shim_type_infoERPv($this, $thrown_type, $adjustedPtr) {
 $this = $this | 0;
 $thrown_type = $thrown_type | 0;
 $adjustedPtr = $adjustedPtr | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $thrown_type;
  HEAP32[EMTSTACKTOP + 24 >> 2] = $adjustedPtr;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1196120 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNKSt3__25ctypeIwE10do_toupperEPwPKw($this, $low, $high) {
 $this = $this | 0;
 $low = $low | 0;
 $high = $high | 0;
 var $$0 = 0, $2 = 0, $4 = 0, $9 = 0;
 $2 = ($high - $low | 0) >>> 2;
 $$0 = $low;
 while (1) {
  if (($$0 | 0) == ($high | 0)) break;
  $4 = HEAP32[$$0 >> 2] | 0;
  if ($4 >>> 0 < 128) $9 = HEAP32[(HEAP32[(___ctype_toupper_loc() | 0) >> 2] | 0) + ($4 << 2) >> 2] | 0; else $9 = $4;
  HEAP32[$$0 >> 2] = $9;
  $$0 = $$0 + 4 | 0;
 }
 return $low + ($2 << 2) | 0;
}

function __ZNKSt3__25ctypeIwE10do_tolowerEPwPKw($this, $low, $high) {
 $this = $this | 0;
 $low = $low | 0;
 $high = $high | 0;
 var $$0 = 0, $2 = 0, $4 = 0, $9 = 0;
 $2 = ($high - $low | 0) >>> 2;
 $$0 = $low;
 while (1) {
  if (($$0 | 0) == ($high | 0)) break;
  $4 = HEAP32[$$0 >> 2] | 0;
  if ($4 >>> 0 < 128) $9 = HEAP32[(HEAP32[(___ctype_tolower_loc() | 0) >> 2] | 0) + ($4 << 2) >> 2] | 0; else $9 = $4;
  HEAP32[$$0 >> 2] = $9;
  $$0 = $$0 + 4 | 0;
 }
 return $low + ($2 << 2) | 0;
}

function __ZN28FunctionDrivenToggleMenuItemIiED2Ev($this) {
 $this = $this | 0;
 var $1 = 0, $3 = 0, $4 = 0, $5 = 0;
 HEAP32[$this >> 2] = 3212;
 $1 = HEAP32[$this + 48 >> 2] | 0;
 $3 = $1;
 if ($1 | 0) {
  $4 = $this + 52 | 0;
  $5 = HEAP32[$4 >> 2] | 0;
  if (($5 | 0) != ($1 | 0)) HEAP32[$4 >> 2] = $5 + (~(($5 + -4 - $3 | 0) >>> 2) << 2);
  __ZdlPv($1);
 }
 HEAP32[$this >> 2] = 2172;
 __ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEED2Ev($this + 4 | 0);
 return;
}

function __ZNKSt3__27collateIwE7do_hashEPKwS3_($this, $__lo, $__hi) {
 $this = $this | 0;
 $__lo = $__lo | 0;
 $__hi = $__hi | 0;
 var $3 = 0, $4 = 0, $__h$0 = 0, $__h$0$lcssa = 0, $__p$0 = 0;
 $__h$0 = 0;
 $__p$0 = $__lo;
 while (1) {
  if (($__p$0 | 0) == ($__hi | 0)) {
   $__h$0$lcssa = $__h$0;
   break;
  }
  $3 = (HEAP32[$__p$0 >> 2] | 0) + ($__h$0 << 4) | 0;
  $4 = $3 & -268435456;
  $__h$0 = ($4 >>> 24 | $4) ^ $3;
  $__p$0 = $__p$0 + 4 | 0;
 }
 return $__h$0$lcssa | 0;
}

function __ZNKSt3__27collateIcE7do_hashEPKcS3_($this, $__lo, $__hi) {
 $this = $this | 0;
 $__lo = $__lo | 0;
 $__hi = $__hi | 0;
 var $4 = 0, $5 = 0, $__h$0 = 0, $__h$0$lcssa = 0, $__p$0 = 0;
 $__h$0 = 0;
 $__p$0 = $__lo;
 while (1) {
  if (($__p$0 | 0) == ($__hi | 0)) {
   $__h$0$lcssa = $__h$0;
   break;
  }
  $4 = (HEAP8[$__p$0 >> 0] | 0) + ($__h$0 << 4) | 0;
  $5 = $4 & -268435456;
  $__h$0 = ($5 >>> 24 | $5) ^ $4;
  $__p$0 = $__p$0 + 1 | 0;
 }
 return $__h$0$lcssa | 0;
}

function __ZNKSt3__27codecvtIwc11__mbstate_tE11do_encodingEv($this) {
 $this = $this | 0;
 var $$0 = 0, $0 = 0, $2 = 0, $3 = 0, $6 = 0, $8 = 0;
 $0 = $this + 8 | 0;
 $2 = _uselocale(HEAP32[$0 >> 2] | 0) | 0;
 $3 = _mbtowc(0, 0, 4) | 0;
 if ($2 | 0) _uselocale($2) | 0;
 if (!$3) {
  $6 = HEAP32[$0 >> 2] | 0;
  if (!$6) $$0 = 1; else {
   $8 = _uselocale($6) | 0;
   if (!$8) $$0 = 0; else {
    _uselocale($8) | 0;
    $$0 = 0;
   }
  }
 } else $$0 = -1;
 return $$0 | 0;
}

function __ZNSt3__220__shared_ptr_emplaceI14ToggleMenuItemINS_12basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEEENS5_IS8_EEED0Ev($this) {
 $this = $this | 0;
 HEAP32[$this >> 2] = 2628;
 HEAP32[$this + 12 >> 2] = 2596;
 __ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEED2Ev($this + 28 | 0);
 __ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEED2Ev($this + 16 | 0);
 __ZNSt3__214__shared_countD2Ev($this);
 __ZdlPv($this);
 return;
}

function __ZNKSt3__27collateIwE12do_transformEPKwS3_($agg$result, $this, $__lo, $__hi) {
 $agg$result = $agg$result | 0;
 $this = $this | 0;
 $__lo = $__lo | 0;
 $__hi = $__hi | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $agg$result;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $this;
  HEAP32[EMTSTACKTOP + 24 >> 2] = $__lo;
  HEAP32[EMTSTACKTOP + 32 >> 2] = $__hi;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1219888 | 0);
}

function __ZNKSt3__27collateIcE12do_transformEPKcS3_($agg$result, $this, $__lo, $__hi) {
 $agg$result = $agg$result | 0;
 $this = $this | 0;
 $__lo = $__lo | 0;
 $__hi = $__hi | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $agg$result;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $this;
  HEAP32[EMTSTACKTOP + 24 >> 2] = $__lo;
  HEAP32[EMTSTACKTOP + 32 >> 2] = $__hi;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1219936 | 0);
}

function __ZNSt3__220__shared_ptr_emplaceI8MenuItemINS_12basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEEENS5_IS8_EEED0Ev($this) {
 $this = $this | 0;
 HEAP32[$this >> 2] = 2656;
 HEAP32[$this + 12 >> 2] = 2596;
 __ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEED2Ev($this + 28 | 0);
 __ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEED2Ev($this + 16 | 0);
 __ZNSt3__214__shared_countD2Ev($this);
 __ZdlPv($this);
 return;
}

function __ZNKSt3__25ctypeIcE10do_toupperEPcPKc($this, $low, $high) {
 $this = $this | 0;
 $low = $low | 0;
 $high = $high | 0;
 var $$0 = 0, $1 = 0, $8 = 0;
 $$0 = $low;
 while (1) {
  if (($$0 | 0) == ($high | 0)) break;
  $1 = HEAP8[$$0 >> 0] | 0;
  if ($1 << 24 >> 24 > -1) $8 = HEAP32[(HEAP32[(___ctype_toupper_loc() | 0) >> 2] | 0) + ($1 << 24 >> 24 << 2) >> 2] & 255; else $8 = $1;
  HEAP8[$$0 >> 0] = $8;
  $$0 = $$0 + 1 | 0;
 }
 return $high | 0;
}

function __ZNKSt3__25ctypeIcE10do_tolowerEPcPKc($this, $low, $high) {
 $this = $this | 0;
 $low = $low | 0;
 $high = $high | 0;
 var $$0 = 0, $1 = 0, $8 = 0;
 $$0 = $low;
 while (1) {
  if (($$0 | 0) == ($high | 0)) break;
  $1 = HEAP8[$$0 >> 0] | 0;
  if ($1 << 24 >> 24 > -1) $8 = HEAP32[(HEAP32[(___ctype_tolower_loc() | 0) >> 2] | 0) + ($1 << 24 >> 24 << 2) >> 2] & 255; else $8 = $1;
  HEAP8[$$0 >> 0] = $8;
  $$0 = $$0 + 1 | 0;
 }
 return $high | 0;
}

function __ZNKSt3__25ctypeIcE9do_narrowEPKcS3_cPc($this, $low, $high, $dfault, $dest) {
 $this = $this | 0;
 $low = $low | 0;
 $high = $high | 0;
 $dfault = $dfault | 0;
 $dest = $dest | 0;
 var $$0 = 0, $$01 = 0, $1 = 0;
 $$0 = $dest;
 $$01 = $low;
 while (1) {
  if (($$01 | 0) == ($high | 0)) break;
  $1 = HEAP8[$$01 >> 0] | 0;
  HEAP8[$$0 >> 0] = $1 << 24 >> 24 > -1 ? $1 : $dfault;
  $$0 = $$0 + 1 | 0;
  $$01 = $$01 + 1 | 0;
 }
 return $high | 0;
}

function __ZNSt3__220__shared_ptr_emplaceI14ToggleMenuItemINS_12basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEEENS5_IS8_EEED2Ev($this) {
 $this = $this | 0;
 HEAP32[$this >> 2] = 2628;
 HEAP32[$this + 12 >> 2] = 2596;
 __ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEED2Ev($this + 28 | 0);
 __ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEED2Ev($this + 16 | 0);
 __ZNSt3__214__shared_countD2Ev($this);
 return;
}

function __ZNK10__cxxabiv117__class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi($this, $info, $adjustedPtr, $path_below) {
 $this = $this | 0;
 $info = $info | 0;
 $adjustedPtr = $adjustedPtr | 0;
 $path_below = $path_below | 0;
 if (($this | 0) == (HEAP32[$info + 8 >> 2] | 0)) __ZNK10__cxxabiv117__class_type_info24process_found_base_classEPNS_19__dynamic_cast_infoEPvi(0, $info, $adjustedPtr, $path_below);
 return;
}

function __ZNSt3__220__shared_ptr_emplaceI8MenuItemINS_12basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEEENS5_IS8_EEED2Ev($this) {
 $this = $this | 0;
 HEAP32[$this >> 2] = 2656;
 HEAP32[$this + 12 >> 2] = 2596;
 __ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEED2Ev($this + 28 | 0);
 __ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEED2Ev($this + 16 | 0);
 __ZNSt3__214__shared_countD2Ev($this);
 return;
}

function ___muldsi3($a, $b) {
 $a = $a | 0;
 $b = $b | 0;
 var $1 = 0, $2 = 0, $3 = 0, $6 = 0, $8 = 0, $11 = 0, $12 = 0;
 $1 = $a & 65535;
 $2 = $b & 65535;
 $3 = Math_imul($2, $1) | 0;
 $6 = $a >>> 16;
 $8 = ($3 >>> 16) + (Math_imul($2, $6) | 0) | 0;
 $11 = $b >>> 16;
 $12 = Math_imul($11, $1) | 0;
 return (tempRet0 = ($8 >>> 16) + (Math_imul($11, $6) | 0) + ((($8 & 65535) + $12 | 0) >>> 16) | 0, $8 + $12 << 16 | $3 & 65535 | 0) | 0;
}

function _memmove(dest, src, num) {
 dest = dest | 0;
 src = src | 0;
 num = num | 0;
 var ret = 0;
 if ((src | 0) < (dest | 0) & (dest | 0) < (src + num | 0)) {
  ret = dest;
  src = src + num | 0;
  dest = dest + num | 0;
  while ((num | 0) > 0) {
   dest = dest - 1 | 0;
   src = src - 1 | 0;
   num = num - 1 | 0;
   HEAP8[dest >> 0] = HEAP8[src >> 0] | 0;
  }
  dest = ret;
 } else _memcpy(dest, src, num) | 0;
 return dest | 0;
}

function ___cxa_can_catch($catchType, $excpType, $thrown) {
 $catchType = $catchType | 0;
 $excpType = $excpType | 0;
 $thrown = $thrown | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $catchType;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $excpType;
  HEAP32[EMTSTACKTOP + 24 >> 2] = $thrown;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1219452 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNKSt3__210moneypunctIwLb1EE16do_positive_signEv($agg$result, $this) {
 $agg$result = $agg$result | 0;
 $this = $this | 0;
 var $__i$0$i$i = 0;
 HEAP32[$agg$result >> 2] = 0;
 HEAP32[$agg$result + 4 >> 2] = 0;
 HEAP32[$agg$result + 8 >> 2] = 0;
 $__i$0$i$i = 0;
 while (1) {
  if (($__i$0$i$i | 0) == 3) break;
  HEAP32[$agg$result + ($__i$0$i$i << 2) >> 2] = 0;
  $__i$0$i$i = $__i$0$i$i + 1 | 0;
 }
 return;
}

function __ZNKSt3__210moneypunctIwLb0EE16do_positive_signEv($agg$result, $this) {
 $agg$result = $agg$result | 0;
 $this = $this | 0;
 var $__i$0$i$i = 0;
 HEAP32[$agg$result >> 2] = 0;
 HEAP32[$agg$result + 4 >> 2] = 0;
 HEAP32[$agg$result + 8 >> 2] = 0;
 $__i$0$i$i = 0;
 while (1) {
  if (($__i$0$i$i | 0) == 3) break;
  HEAP32[$agg$result + ($__i$0$i$i << 2) >> 2] = 0;
  $__i$0$i$i = $__i$0$i$i + 1 | 0;
 }
 return;
}

function __ZNKSt3__210moneypunctIcLb1EE16do_positive_signEv($agg$result, $this) {
 $agg$result = $agg$result | 0;
 $this = $this | 0;
 var $__i$0$i$i = 0;
 HEAP32[$agg$result >> 2] = 0;
 HEAP32[$agg$result + 4 >> 2] = 0;
 HEAP32[$agg$result + 8 >> 2] = 0;
 $__i$0$i$i = 0;
 while (1) {
  if (($__i$0$i$i | 0) == 3) break;
  HEAP32[$agg$result + ($__i$0$i$i << 2) >> 2] = 0;
  $__i$0$i$i = $__i$0$i$i + 1 | 0;
 }
 return;
}

function __ZNKSt3__210moneypunctIcLb0EE16do_positive_signEv($agg$result, $this) {
 $agg$result = $agg$result | 0;
 $this = $this | 0;
 var $__i$0$i$i = 0;
 HEAP32[$agg$result >> 2] = 0;
 HEAP32[$agg$result + 4 >> 2] = 0;
 HEAP32[$agg$result + 8 >> 2] = 0;
 $__i$0$i$i = 0;
 while (1) {
  if (($__i$0$i$i | 0) == 3) break;
  HEAP32[$agg$result + ($__i$0$i$i << 2) >> 2] = 0;
  $__i$0$i$i = $__i$0$i$i + 1 | 0;
 }
 return;
}

function _copysign($x, $y) {
 $x = +$x;
 $y = +$y;
 var $1 = 0, $5 = 0, $fabs = 0.0;
 HEAPF64[tempDoublePtr >> 3] = $y;
 $1 = HEAP32[tempDoublePtr + 4 >> 2] | 0;
 $fabs = +Math_abs(+$x);
 HEAPF64[tempDoublePtr >> 3] = $fabs;
 $5 = $1 & -2147483648 | HEAP32[tempDoublePtr + 4 >> 2];
 HEAP32[tempDoublePtr >> 2] = HEAP32[tempDoublePtr >> 2];
 HEAP32[tempDoublePtr + 4 >> 2] = $5;
 return +(+HEAPF64[tempDoublePtr >> 3]);
}

function __ZNKSt3__210moneypunctIwLb1EE14do_curr_symbolEv($agg$result, $this) {
 $agg$result = $agg$result | 0;
 $this = $this | 0;
 var $__i$0$i$i = 0;
 HEAP32[$agg$result >> 2] = 0;
 HEAP32[$agg$result + 4 >> 2] = 0;
 HEAP32[$agg$result + 8 >> 2] = 0;
 $__i$0$i$i = 0;
 while (1) {
  if (($__i$0$i$i | 0) == 3) break;
  HEAP32[$agg$result + ($__i$0$i$i << 2) >> 2] = 0;
  $__i$0$i$i = $__i$0$i$i + 1 | 0;
 }
 return;
}

function __ZNKSt3__210moneypunctIwLb0EE14do_curr_symbolEv($agg$result, $this) {
 $agg$result = $agg$result | 0;
 $this = $this | 0;
 var $__i$0$i$i = 0;
 HEAP32[$agg$result >> 2] = 0;
 HEAP32[$agg$result + 4 >> 2] = 0;
 HEAP32[$agg$result + 8 >> 2] = 0;
 $__i$0$i$i = 0;
 while (1) {
  if (($__i$0$i$i | 0) == 3) break;
  HEAP32[$agg$result + ($__i$0$i$i << 2) >> 2] = 0;
  $__i$0$i$i = $__i$0$i$i + 1 | 0;
 }
 return;
}

function __ZNKSt3__210moneypunctIcLb1EE14do_curr_symbolEv($agg$result, $this) {
 $agg$result = $agg$result | 0;
 $this = $this | 0;
 var $__i$0$i$i = 0;
 HEAP32[$agg$result >> 2] = 0;
 HEAP32[$agg$result + 4 >> 2] = 0;
 HEAP32[$agg$result + 8 >> 2] = 0;
 $__i$0$i$i = 0;
 while (1) {
  if (($__i$0$i$i | 0) == 3) break;
  HEAP32[$agg$result + ($__i$0$i$i << 2) >> 2] = 0;
  $__i$0$i$i = $__i$0$i$i + 1 | 0;
 }
 return;
}

function __ZNKSt3__210moneypunctIcLb0EE14do_curr_symbolEv($agg$result, $this) {
 $agg$result = $agg$result | 0;
 $this = $this | 0;
 var $__i$0$i$i = 0;
 HEAP32[$agg$result >> 2] = 0;
 HEAP32[$agg$result + 4 >> 2] = 0;
 HEAP32[$agg$result + 8 >> 2] = 0;
 $__i$0$i$i = 0;
 while (1) {
  if (($__i$0$i$i | 0) == 3) break;
  HEAP32[$agg$result + ($__i$0$i$i << 2) >> 2] = 0;
  $__i$0$i$i = $__i$0$i$i + 1 | 0;
 }
 return;
}

function __ZNKSt3__210moneypunctIwLb1EE11do_groupingEv($agg$result, $this) {
 $agg$result = $agg$result | 0;
 $this = $this | 0;
 var $__i$0$i$i = 0;
 HEAP32[$agg$result >> 2] = 0;
 HEAP32[$agg$result + 4 >> 2] = 0;
 HEAP32[$agg$result + 8 >> 2] = 0;
 $__i$0$i$i = 0;
 while (1) {
  if (($__i$0$i$i | 0) == 3) break;
  HEAP32[$agg$result + ($__i$0$i$i << 2) >> 2] = 0;
  $__i$0$i$i = $__i$0$i$i + 1 | 0;
 }
 return;
}

function __ZNKSt3__210moneypunctIwLb0EE11do_groupingEv($agg$result, $this) {
 $agg$result = $agg$result | 0;
 $this = $this | 0;
 var $__i$0$i$i = 0;
 HEAP32[$agg$result >> 2] = 0;
 HEAP32[$agg$result + 4 >> 2] = 0;
 HEAP32[$agg$result + 8 >> 2] = 0;
 $__i$0$i$i = 0;
 while (1) {
  if (($__i$0$i$i | 0) == 3) break;
  HEAP32[$agg$result + ($__i$0$i$i << 2) >> 2] = 0;
  $__i$0$i$i = $__i$0$i$i + 1 | 0;
 }
 return;
}

function __ZNKSt3__210moneypunctIcLb1EE11do_groupingEv($agg$result, $this) {
 $agg$result = $agg$result | 0;
 $this = $this | 0;
 var $__i$0$i$i = 0;
 HEAP32[$agg$result >> 2] = 0;
 HEAP32[$agg$result + 4 >> 2] = 0;
 HEAP32[$agg$result + 8 >> 2] = 0;
 $__i$0$i$i = 0;
 while (1) {
  if (($__i$0$i$i | 0) == 3) break;
  HEAP32[$agg$result + ($__i$0$i$i << 2) >> 2] = 0;
  $__i$0$i$i = $__i$0$i$i + 1 | 0;
 }
 return;
}

function __ZNKSt3__210moneypunctIcLb0EE11do_groupingEv($agg$result, $this) {
 $agg$result = $agg$result | 0;
 $this = $this | 0;
 var $__i$0$i$i = 0;
 HEAP32[$agg$result >> 2] = 0;
 HEAP32[$agg$result + 4 >> 2] = 0;
 HEAP32[$agg$result + 8 >> 2] = 0;
 $__i$0$i$i = 0;
 while (1) {
  if (($__i$0$i$i | 0) == 3) break;
  HEAP32[$agg$result + ($__i$0$i$i << 2) >> 2] = 0;
  $__i$0$i$i = $__i$0$i$i + 1 | 0;
 }
 return;
}

function __ZNSt3__215basic_streambufIwNS_11char_traitsIwEEE6xsputnEPKwi($this, $__s, $__n) {
 $this = $this | 0;
 $__s = $__s | 0;
 $__n = $__n | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $__s;
  HEAP32[EMTSTACKTOP + 24 >> 2] = $__n;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1197896 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNSt3__215basic_streambufIcNS_11char_traitsIcEEE6xsputnEPKci($this, $__s, $__n) {
 $this = $this | 0;
 $__s = $__s | 0;
 $__n = $__n | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $__s;
  HEAP32[EMTSTACKTOP + 24 >> 2] = $__n;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1197228 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNSt3__215basic_streambufIwNS_11char_traitsIwEEE6xsgetnEPwi($this, $__s, $__n) {
 $this = $this | 0;
 $__s = $__s | 0;
 $__n = $__n | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $__s;
  HEAP32[EMTSTACKTOP + 24 >> 2] = $__n;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1206236 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNSt3__215basic_streambufIcNS_11char_traitsIcEEE6xsgetnEPci($this, $__s, $__n) {
 $this = $this | 0;
 $__s = $__s | 0;
 $__n = $__n | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $__s;
  HEAP32[EMTSTACKTOP + 24 >> 2] = $__n;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1206092 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNSt3__215basic_streambufIwNS_11char_traitsIwEEE7seekoffExNS_8ios_base7seekdirEj($agg$result, $this, $0, $1, $2, $3) {
 $agg$result = $agg$result | 0;
 $this = $this | 0;
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 $3 = $3 | 0;
 var $4 = 0, $9 = 0;
 $4 = $agg$result;
 HEAP32[$4 >> 2] = 0;
 HEAP32[$4 + 4 >> 2] = 0;
 $9 = $agg$result + 8 | 0;
 HEAP32[$9 >> 2] = -1;
 HEAP32[$9 + 4 >> 2] = -1;
 return;
}

function __ZNSt3__215basic_streambufIcNS_11char_traitsIcEEE7seekoffExNS_8ios_base7seekdirEj($agg$result, $this, $0, $1, $2, $3) {
 $agg$result = $agg$result | 0;
 $this = $this | 0;
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 $3 = $3 | 0;
 var $4 = 0, $9 = 0;
 $4 = $agg$result;
 HEAP32[$4 >> 2] = 0;
 HEAP32[$4 + 4 >> 2] = 0;
 $9 = $agg$result + 8 | 0;
 HEAP32[$9 >> 2] = -1;
 HEAP32[$9 + 4 >> 2] = -1;
 return;
}

function __ZNSt3__211__stdoutbufIwE6xsputnEPKwi($this, $__s, $__n) {
 $this = $this | 0;
 $__s = $__s | 0;
 $__n = $__n | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $__s;
  HEAP32[EMTSTACKTOP + 24 >> 2] = $__n;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1215512 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNSt3__211__stdoutbufIcE6xsputnEPKci($this, $__s, $__n) {
 $this = $this | 0;
 $__s = $__s | 0;
 $__n = $__n | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $__s;
  HEAP32[EMTSTACKTOP + 24 >> 2] = $__n;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1215628 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZN13ERDatabaseKVS18get_saved_vehiclesEi($agg$result, $this, $index) {
 $agg$result = $agg$result | 0;
 $this = $this | 0;
 $index = $index | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $agg$result;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $this;
  HEAP32[EMTSTACKTOP + 24 >> 2] = $index;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 818352 | 0);
}

function ___uremdi3($a$0, $a$1, $b$0, $b$1) {
 $a$0 = $a$0 | 0;
 $a$1 = $a$1 | 0;
 $b$0 = $b$0 | 0;
 $b$1 = $b$1 | 0;
 var $rem = 0, __stackBase__ = 0;
 __stackBase__ = STACKTOP;
 STACKTOP = STACKTOP + 16 | 0;
 $rem = __stackBase__ | 0;
 ___udivmoddi4($a$0, $a$1, $b$0, $b$1, $rem) | 0;
 STACKTOP = __stackBase__;
 return (tempRet0 = HEAP32[$rem + 4 >> 2] | 0, HEAP32[$rem >> 2] | 0) | 0;
}

function __ZN13ERDatabaseKVS27store_feature_enabled_pairsENSt3__26vectorI29FeatureEnabledLocalDefinitionNS0_9allocatorIS2_EEEE($this, $values) {
 $this = $this | 0;
 $values = $values | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $values;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 961092 | 0);
}

function __ZN13ERDatabaseKVS26load_feature_enabled_pairsENSt3__26vectorI29FeatureEnabledLocalDefinitionNS0_9allocatorIS2_EEEE($this, $values) {
 $this = $this | 0;
 $values = $values | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $values;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1042860 | 0);
}

function __ZNSt3__25ctypeIcEC2EPKtbj($this, $tab, $del, $refs) {
 $this = $this | 0;
 $tab = $tab | 0;
 $del = $del | 0;
 $refs = $refs | 0;
 var $2 = 0;
 HEAP32[$this + 4 >> 2] = $refs + -1;
 HEAP32[$this >> 2] = 9976;
 $2 = $this + 8 | 0;
 HEAP32[$2 >> 2] = $tab;
 HEAP8[$this + 12 >> 0] = $del & 1;
 if (!$tab) HEAP32[$2 >> 2] = HEAP32[(___ctype_b_loc() | 0) >> 2];
 return;
}

function __ZNSt3__215basic_streambufIwNS_11char_traitsIwEEE7seekposENS_4fposI11__mbstate_tEEj($agg$result, $this, $0, $1) {
 $agg$result = $agg$result | 0;
 $this = $this | 0;
 $0 = $0 | 0;
 $1 = $1 | 0;
 var $2 = 0, $7 = 0;
 $2 = $agg$result;
 HEAP32[$2 >> 2] = 0;
 HEAP32[$2 + 4 >> 2] = 0;
 $7 = $agg$result + 8 | 0;
 HEAP32[$7 >> 2] = -1;
 HEAP32[$7 + 4 >> 2] = -1;
 return;
}

function __ZNSt3__215basic_streambufIcNS_11char_traitsIcEEE7seekposENS_4fposI11__mbstate_tEEj($agg$result, $this, $0, $1) {
 $agg$result = $agg$result | 0;
 $this = $this | 0;
 $0 = $0 | 0;
 $1 = $1 | 0;
 var $2 = 0, $7 = 0;
 $2 = $agg$result;
 HEAP32[$2 >> 2] = 0;
 HEAP32[$2 + 4 >> 2] = 0;
 $7 = $agg$result + 8 | 0;
 HEAP32[$7 >> 2] = -1;
 HEAP32[$7 + 4 >> 2] = -1;
 return;
}

function _rand() {
 var $0 = 0, $10 = 0, $14 = 0, $6 = 0, $8 = 0, $9 = 0;
 $0 = 84024;
 $6 = ___muldi3(HEAP32[$0 >> 2] | 0, HEAP32[$0 + 4 >> 2] | 0, 1284865837, 1481765933) | 0;
 $8 = _i64Add($6 | 0, tempRet0 | 0, 1, 0) | 0;
 $9 = tempRet0;
 $10 = 84024;
 HEAP32[$10 >> 2] = $8;
 HEAP32[$10 + 4 >> 2] = $9;
 $14 = _bitshift64Lshr($8 | 0, $9 | 0, 33) | 0;
 return $14 | 0;
}

function _llvm_cttz_i32(x) {
 x = x | 0;
 var ret = 0;
 ret = HEAP8[cttz_i8 + (x & 255) >> 0] | 0;
 if ((ret | 0) < 8) return ret | 0;
 ret = HEAP8[cttz_i8 + (x >> 8 & 255) >> 0] | 0;
 if ((ret | 0) < 8) return ret + 8 | 0;
 ret = HEAP8[cttz_i8 + (x >> 16 & 255) >> 0] | 0;
 if ((ret | 0) < 8) return ret + 16 | 0;
 return (HEAP8[cttz_i8 + (x >>> 24) >> 0] | 0) + 24 | 0;
}

function __ZNKSt3__25ctypeIcE8do_widenEPKcS3_Pc($this, $low, $high, $dest) {
 $this = $this | 0;
 $low = $low | 0;
 $high = $high | 0;
 $dest = $dest | 0;
 var $$0 = 0, $$01 = 0;
 $$0 = $dest;
 $$01 = $low;
 while (1) {
  if (($$01 | 0) == ($high | 0)) break;
  HEAP8[$$0 >> 0] = HEAP8[$$01 >> 0] | 0;
  $$0 = $$0 + 1 | 0;
  $$01 = $$01 + 1 | 0;
 }
 return $high | 0;
}

function __ZNSt3__215basic_stringbufIcNS_11char_traitsIcEENS_9allocatorIcEEE8overflowEi($this, $__c) {
 $this = $this | 0;
 $__c = $__c | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $__c;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1130076 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNKSt3__25ctypeIwE8do_widenEPKcS3_Pw($this, $low, $high, $dest) {
 $this = $this | 0;
 $low = $low | 0;
 $high = $high | 0;
 $dest = $dest | 0;
 var $$0 = 0, $$01 = 0;
 $$0 = $dest;
 $$01 = $low;
 while (1) {
  if (($$01 | 0) == ($high | 0)) break;
  HEAP32[$$0 >> 2] = HEAP8[$$01 >> 0];
  $$0 = $$0 + 4 | 0;
  $$01 = $$01 + 1 | 0;
 }
 return $high | 0;
}

function __ZN13ERDatabaseKVS19store_setting_pairsENSt3__26vectorI22StringPairSettingDBRowNS0_9allocatorIS2_EEEE($this, $values) {
 $this = $this | 0;
 $values = $values | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $values;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 999916 | 0);
}

function _wmemcpy($d, $s, $n) {
 $d = $d | 0;
 $s = $s | 0;
 $n = $n | 0;
 var $$014 = 0, $$023 = 0, $$05 = 0;
 if ($n | 0) {
  $$014 = $n;
  $$023 = $s;
  $$05 = $d;
  while (1) {
   $$014 = $$014 + -1 | 0;
   HEAP32[$$05 >> 2] = HEAP32[$$023 >> 2];
   if (!$$014) break; else {
    $$023 = $$023 + 4 | 0;
    $$05 = $$05 + 4 | 0;
   }
  }
 }
 return $d | 0;
}

function __ZN14ToggleMenuItemINSt3__212basic_stringIcNS0_11char_traitsIcEENS0_9allocatorIcEEEEED0Ev($this) {
 $this = $this | 0;
 HEAP32[$this >> 2] = 2596;
 __ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEED2Ev($this + 16 | 0);
 __ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEED2Ev($this + 4 | 0);
 __ZdlPv($this);
 return;
}

function ___shlim($f, $lim) {
 $f = $f | 0;
 $lim = $lim | 0;
 var $2 = 0, $4 = 0, $5 = 0;
 HEAP32[$f + 104 >> 2] = $lim;
 $2 = HEAP32[$f + 8 >> 2] | 0;
 $4 = HEAP32[$f + 4 >> 2] | 0;
 $5 = $2 - $4 | 0;
 HEAP32[$f + 108 >> 2] = $5;
 if (($lim | 0) != 0 & ($5 | 0) > ($lim | 0)) HEAP32[$f + 100 >> 2] = $4 + $lim; else HEAP32[$f + 100 >> 2] = $2;
 return;
}

function __Z38onconfirm_spawn_menu_vehicle_selection8MenuItemINSt3__212basic_stringIcNS0_11char_traitsIcEENS0_9allocatorIcEEEEE($choice) {
 $choice = $choice | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $choice;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1212376 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __Z37onconfirm_skinchanger_choices_players8MenuItemINSt3__212basic_stringIcNS0_11char_traitsIcEENS0_9allocatorIcEEEEE($choice) {
 $choice = $choice | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $choice;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1199916 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __Z37onconfirm_skinchanger_choices_animals8MenuItemINSt3__212basic_stringIcNS0_11char_traitsIcEENS0_9allocatorIcEEEEE($choice) {
 $choice = $choice | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $choice;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1200116 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZN8MenuItemINSt3__212basic_stringIcNS0_11char_traitsIcEENS0_9allocatorIcEEEEED0Ev($this) {
 $this = $this | 0;
 HEAP32[$this >> 2] = 2596;
 __ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEED2Ev($this + 16 | 0);
 __ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEED2Ev($this + 4 | 0);
 __ZdlPv($this);
 return;
}

function __Z21onconfirm_speedo_menu8MenuItemIiE($choice) {
 $choice = $choice | 0;
 switch (HEAP32[21674] | 0) {
 case 0:
  {
   HEAP8[94959] = 0;
   HEAP8[94960] = 0;
   break;
  }
 case 1:
  {
   HEAP8[94958] = 0;
   HEAP8[94960] = 0;
   break;
  }
 case 2:
  {
   HEAP8[94958] = 0;
   HEAP8[94959] = 0;
   break;
  }
 default:
  {}
 }
 return 0;
}

function __Z34onconfirm_skinchanger_choices_misc8MenuItemINSt3__212basic_stringIcNS0_11char_traitsIcEENS0_9allocatorIcEEEEE($choice) {
 $choice = $choice | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $choice;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1200316 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNKSt3__27codecvtIcc11__mbstate_tE6do_outERS1_PKcS5_RS5_PcS7_RS7_($this, $0, $frm, $1, $frm_nxt, $to, $2, $to_nxt) {
 $this = $this | 0;
 $0 = $0 | 0;
 $frm = $frm | 0;
 $1 = $1 | 0;
 $frm_nxt = $frm_nxt | 0;
 $to = $to | 0;
 $2 = $2 | 0;
 $to_nxt = $to_nxt | 0;
 HEAP32[$frm_nxt >> 2] = $frm;
 HEAP32[$to_nxt >> 2] = $to;
 return 3;
}

function __ZNKSt3__27codecvtIcc11__mbstate_tE5do_inERS1_PKcS5_RS5_PcS7_RS7_($this, $0, $frm, $1, $frm_nxt, $to, $2, $to_nxt) {
 $this = $this | 0;
 $0 = $0 | 0;
 $frm = $frm | 0;
 $1 = $1 | 0;
 $frm_nxt = $frm_nxt | 0;
 $to = $to | 0;
 $2 = $2 | 0;
 $to_nxt = $to_nxt | 0;
 HEAP32[$frm_nxt >> 2] = $frm;
 HEAP32[$to_nxt >> 2] = $to;
 return 3;
}

function _sn_write($f, $s, $l) {
 $f = $f | 0;
 $s = $s | 0;
 $l = $l | 0;
 var $2 = 0, $3 = 0, $4 = 0, $l$ = 0;
 $2 = $f + 20 | 0;
 $3 = HEAP32[$2 >> 2] | 0;
 $4 = (HEAP32[$f + 16 >> 2] | 0) - $3 | 0;
 $l$ = $4 >>> 0 > $l >>> 0 ? $l : $4;
 _memcpy($3 | 0, $s | 0, $l$ | 0) | 0;
 HEAP32[$2 >> 2] = (HEAP32[$2 >> 2] | 0) + $l$;
 return $l | 0;
}

function __Z22set_weaponmod_equippedbNSt3__26vectorIiNS_9allocatorIiEEEE($equipped, $extras) {
 $equipped = $equipped | 0;
 $extras = $extras | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $equipped;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $extras;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1077320 | 0);
}

function __ZNKSt3__28messagesIwE7do_openERKNS_12basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEERKNS_6localeE($this, $__nm, $0) {
 $this = $this | 0;
 $__nm = $__nm | 0;
 $0 = $0 | 0;
 var $6 = 0;
 $6 = _catopen((HEAP8[$__nm + 11 >> 0] | 0) < 0 ? HEAP32[$__nm >> 2] | 0 : $__nm, 1) | 0;
 return $6 >>> (($6 | 0) != (-1 | 0) & 1) | 0;
}

function __ZNKSt3__28messagesIcE7do_openERKNS_12basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEERKNS_6localeE($this, $__nm, $0) {
 $this = $this | 0;
 $__nm = $__nm | 0;
 $0 = $0 | 0;
 var $6 = 0;
 $6 = _catopen((HEAP8[$__nm + 11 >> 0] | 0) < 0 ? HEAP32[$__nm >> 2] | 0 : $__nm, 1) | 0;
 return $6 >>> (($6 | 0) != (-1 | 0) & 1) | 0;
}

function __Z19set_weapon_equippedbNSt3__26vectorIiNS_9allocatorIiEEEE($equipped, $extras) {
 $equipped = $equipped | 0;
 $extras = $extras | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $equipped;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $extras;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1087456 | 0);
}

function __Z21set_bulletproof_tyresbNSt3__26vectorIiNS_9allocatorIiEEEE($applied, $extras) {
 $applied = $applied | 0;
 $extras = $extras | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $applied;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $extras;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1191696 | 0);
}

function __Z20set_xenon_headlightsbNSt3__26vectorIiNS_9allocatorIiEEEE($applied, $extras) {
 $applied = $applied | 0;
 $extras = $extras | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $applied;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $extras;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1191152 | 0);
}

function __Z22onconfirm_weather_menu8MenuItemINSt3__212basic_stringIcNS0_11char_traitsIcEENS0_9allocatorIcEEEEE($choice) {
 $choice = $choice | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $choice;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 841124 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __Z17set_extra_enabledbNSt3__26vectorIiNS_9allocatorIiEEEE($applied, $extras) {
 $applied = $applied | 0;
 $extras = $extras | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $applied;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $extras;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1184140 | 0);
}

function __ZN8MenuItemINSt3__212basic_stringIcNS0_11char_traitsIcEENS0_9allocatorIcEEEEED2Ev($this) {
 $this = $this | 0;
 HEAP32[$this >> 2] = 2596;
 __ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEED2Ev($this + 16 | 0);
 __ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEED2Ev($this + 4 | 0);
 return;
}

function __Z16set_turbochargedbNSt3__26vectorIiNS_9allocatorIiEEEE($applied, $extras) {
 $applied = $applied | 0;
 $extras = $extras | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $applied;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $extras;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1191424 | 0);
}

function __Z16set_custom_tyresbNSt3__26vectorIiNS_9allocatorIiEEEE($applied, $extras) {
 $applied = $applied | 0;
 $extras = $extras | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $applied;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $extras;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1137420 | 0);
}

function __ZNSt3__220__shared_ptr_emplaceI16WantedSymbolItemIiENS_9allocatorIS2_EEED0Ev($this) {
 $this = $this | 0;
 HEAP32[$this >> 2] = 2532;
 HEAP32[$this + 12 >> 2] = 2172;
 __ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEED2Ev($this + 16 | 0);
 __ZNSt3__214__shared_countD2Ev($this);
 __ZdlPv($this);
 return;
}

function __ZNSt3__220__shared_ptr_emplaceI14ToggleMenuItemIiENS_9allocatorIS2_EEED0Ev($this) {
 $this = $this | 0;
 HEAP32[$this >> 2] = 2472;
 HEAP32[$this + 12 >> 2] = 2172;
 __ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEED2Ev($this + 16 | 0);
 __ZNSt3__214__shared_countD2Ev($this);
 __ZdlPv($this);
 return;
}

function __ZNKSt3__210moneypunctIwLb1EE16do_negative_signEv($agg$result, $this) {
 $agg$result = $agg$result | 0;
 $this = $this | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $agg$result;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $this;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1222232 | 0);
}

function __ZNKSt3__210moneypunctIwLb0EE16do_negative_signEv($agg$result, $this) {
 $agg$result = $agg$result | 0;
 $this = $this | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $agg$result;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $this;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1222288 | 0);
}

function __ZNKSt3__210moneypunctIcLb1EE16do_negative_signEv($agg$result, $this) {
 $agg$result = $agg$result | 0;
 $this = $this | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $agg$result;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $this;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1222344 | 0);
}

function __ZNKSt3__210moneypunctIcLb0EE16do_negative_signEv($agg$result, $this) {
 $agg$result = $agg$result | 0;
 $this = $this | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $agg$result;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $this;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1222400 | 0);
}

function __ZNSt3__220__shared_ptr_emplaceI14ToggleMenuItemINS_12basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEEENS5_IS8_EEE16__on_zero_sharedEv($this) {
 $this = $this | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1224324 | 0);
}

function __ZNSt3__211__stdoutbufIwE8overflowEj($this, $__c) {
 $this = $this | 0;
 $__c = $__c | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $__c;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1161576 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNSt3__211__stdoutbufIcE8overflowEi($this, $__c) {
 $this = $this | 0;
 $__c = $__c | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $__c;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1161144 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNSt3__210__stdinbufIwE9pbackfailEj($this, $__c) {
 $this = $this | 0;
 $__c = $__c | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $__c;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1169228 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNSt3__210__stdinbufIcE9pbackfailEi($this, $__c) {
 $this = $this | 0;
 $__c = $__c | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $__c;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1169576 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNSt3__220__shared_ptr_emplaceI8MenuItemIiENS_9allocatorIS2_EEED0Ev($this) {
 $this = $this | 0;
 HEAP32[$this >> 2] = 2204;
 HEAP32[$this + 12 >> 2] = 2172;
 __ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEED2Ev($this + 16 | 0);
 __ZNSt3__214__shared_countD2Ev($this);
 __ZdlPv($this);
 return;
}

function __ZN13ERDatabaseKVS22populate_saved_vehicleEP17SavedVehicleDBRow($this, $entry) {
 $this = $this | 0;
 $entry = $entry | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $entry;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 873140 | 0);
}

function __ZNSt3__220__shared_ptr_emplaceI8MenuItemINS_12basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEEENS5_IS8_EEE16__on_zero_sharedEv($this) {
 $this = $this | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1224588 | 0);
}

function __ZN13ERDatabaseKVS18load_setting_pairsEv($agg$result, $this) {
 $agg$result = $agg$result | 0;
 $this = $this | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $agg$result;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $this;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1059196 | 0);
}

function __ZNKSt3__28numpunctIwE12do_falsenameEv($agg$result, $this) {
 $agg$result = $agg$result | 0;
 $this = $this | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $agg$result;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $this;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1222004 | 0);
}

function __ZNKSt3__28numpunctIcE12do_falsenameEv($agg$result, $this) {
 $agg$result = $agg$result | 0;
 $this = $this | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $agg$result;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $this;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1223016 | 0);
}

function __ZNKSt3__28numpunctIwE11do_truenameEv($agg$result, $this) {
 $agg$result = $agg$result | 0;
 $this = $this | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $agg$result;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $this;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1222068 | 0);
}

function __ZNKSt3__28numpunctIwE11do_groupingEv($agg$result, $this) {
 $agg$result = $agg$result | 0;
 $this = $this | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $agg$result;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $this;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1225652 | 0);
}

function __ZNKSt3__28numpunctIcE11do_truenameEv($agg$result, $this) {
 $agg$result = $agg$result | 0;
 $this = $this | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $agg$result;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $this;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1223076 | 0);
}

function __ZNKSt3__28numpunctIcE11do_groupingEv($agg$result, $this) {
 $agg$result = $agg$result | 0;
 $this = $this | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $agg$result;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $this;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1225680 | 0);
}

function __ZNK14comma_numpunct11do_groupingEv($agg$result, $this) {
 $agg$result = $agg$result | 0;
 $this = $this | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $agg$result;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $this;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1223136 | 0);
}

function dynCall_iiiiiiiii(index, a1, a2, a3, a4, a5, a6, a7, a8) {
 index = index | 0;
 a1 = a1 | 0;
 a2 = a2 | 0;
 a3 = a3 | 0;
 a4 = a4 | 0;
 a5 = a5 | 0;
 a6 = a6 | 0;
 a7 = a7 | 0;
 a8 = a8 | 0;
 return FUNCTION_TABLE_iiiiiiiii[index & 15](a1 | 0, a2 | 0, a3 | 0, a4 | 0, a5 | 0, a6 | 0, a7 | 0, a8 | 0) | 0;
}

function __ZNSt3__220__shared_ptr_emplaceI16WantedSymbolItemIiENS_9allocatorIS2_EEED2Ev($this) {
 $this = $this | 0;
 HEAP32[$this >> 2] = 2532;
 HEAP32[$this + 12 >> 2] = 2172;
 __ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEED2Ev($this + 16 | 0);
 __ZNSt3__214__shared_countD2Ev($this);
 return;
}

function __ZNSt3__220__shared_ptr_emplaceI14ToggleMenuItemIiENS_9allocatorIS2_EEED2Ev($this) {
 $this = $this | 0;
 HEAP32[$this >> 2] = 2472;
 HEAP32[$this + 12 >> 2] = 2172;
 __ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEED2Ev($this + 16 | 0);
 __ZNSt3__214__shared_countD2Ev($this);
 return;
}

function ___stdio_close($f) {
 $f = $f | 0;
 var $3 = 0, $vararg_buffer = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16 | 0;
 $vararg_buffer = sp;
 HEAP32[$vararg_buffer >> 2] = HEAP32[$f + 60 >> 2];
 $3 = ___syscall_ret(___syscall6(6, $vararg_buffer | 0) | 0) | 0;
 STACKTOP = sp;
 return $3 | 0;
}

function __ZNSt3__220__shared_ptr_emplaceI8MenuItemIiENS_9allocatorIS2_EEED2Ev($this) {
 $this = $this | 0;
 HEAP32[$this >> 2] = 2204;
 HEAP32[$this + 12 >> 2] = 2172;
 __ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEED2Ev($this + 16 | 0);
 __ZNSt3__214__shared_countD2Ev($this);
 return;
}

function __ZNSt3__211__stdoutbufIwE5imbueERKNS_6localeE($this, $__loc) {
 $this = $this | 0;
 $__loc = $__loc | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $__loc;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1221076 | 0);
}

function __ZNSt3__211__stdoutbufIcE5imbueERKNS_6localeE($this, $__loc) {
 $this = $this | 0;
 $__loc = $__loc | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $__loc;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1221168 | 0);
}

function __ZNSt3__210__stdinbufIwE5imbueERKNS_6localeE($this, $__loc) {
 $this = $this | 0;
 $__loc = $__loc | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $__loc;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1217412 | 0);
}

function __ZNSt3__210__stdinbufIcE5imbueERKNS_6localeE($this, $__loc) {
 $this = $this | 0;
 $__loc = $__loc | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  HEAP32[EMTSTACKTOP + 16 >> 2] = $__loc;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1217536 | 0);
}

function __ZNKSt3__27codecvtIDsc11__mbstate_tE9do_lengthERS1_PKcS5_j($this, $0, $frm, $frm_end, $mx) {
 $this = $this | 0;
 $0 = $0 | 0;
 $frm = $frm | 0;
 $frm_end = $frm_end | 0;
 $mx = $mx | 0;
 return __ZNSt3__2L20utf8_to_utf16_lengthEPKhS1_jmNS_12codecvt_modeE($frm, $frm_end, $mx, 1114111, 0) | 0;
}

function __ZNKSt3__27codecvtIDic11__mbstate_tE9do_lengthERS1_PKcS5_j($this, $0, $frm, $frm_end, $mx) {
 $this = $this | 0;
 $0 = $0 | 0;
 $frm = $frm | 0;
 $frm_end = $frm_end | 0;
 $mx = $mx | 0;
 return __ZNSt3__2L19utf8_to_ucs4_lengthEPKhS1_jmNS_12codecvt_modeE($frm, $frm_end, $mx, 1114111, 0) | 0;
}

function __Z24reset_teleporter_globalsv() {
 var $0 = 0, $1 = 0, $4 = 0;
 $0 = HEAP32[21625] | 0;
 $1 = HEAP32[21624] | 0;
 if (($0 | 0) == ($1 | 0)) {
  HEAP32[712] = 0;
  return;
 }
 $4 = ($0 - $1 | 0) / 12 | 0;
 _memset(86356, 0, ($4 >>> 0 > 1 ? $4 : 1) << 2 | 0) | 0;
 HEAP32[712] = 0;
 return;
}

function __Z21is_weaponmod_equippedNSt3__26vectorIiNS_9allocatorIiEEEE($extras) {
 $extras = $extras | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $extras;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1103660 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNSt3__220__shared_ptr_emplaceI28FunctionDrivenToggleMenuItemIiENS_9allocatorIS2_EEE16__on_zero_sharedEv($this) {
 $this = $this | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1225532 | 0);
}

function __Z20is_bulletproof_tyresNSt3__26vectorIiNS_9allocatorIiEEEE($extras) {
 $extras = $extras | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $extras;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1193452 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __Z19is_xenon_headlightsNSt3__26vectorIiNS_9allocatorIiEEEE($extras) {
 $extras = $extras | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $extras;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1192660 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __Z18is_weapon_equippedNSt3__26vectorIiNS_9allocatorIiEEEE($extras) {
 $extras = $extras | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $extras;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1151052 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNKSt3__27codecvtIwc11__mbstate_tE13do_max_lengthEv($this) {
 $this = $this | 0;
 var $1 = 0, $3 = 0, $5 = 0;
 $1 = HEAP32[$this + 8 >> 2] | 0;
 if (!$1) $5 = 1; else {
  $3 = _uselocale($1) | 0;
  if (!$3) $5 = 4; else {
   _uselocale($3) | 0;
   $5 = 4;
  }
 }
 return $5 | 0;
}

function __Z23onconfirm_relative_menu8MenuItemIiE($choice) {
 $choice = $choice | 0;
 switch (HEAP32[21532] | 0) {
 case 0:
  {
   if (!(HEAP8[94886] | 0)) HEAP8[94886] = 0;
   break;
  }
 case 1:
  {
   if (!(HEAP8[94887] | 0)) HEAP8[94887] = 0;
   break;
  }
 default:
  {}
 }
 return 0;
}

function __Z16is_extra_enabledNSt3__26vectorIiNS_9allocatorIiEEEE($extras) {
 $extras = $extras | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $extras;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1185896 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __Z15is_turbochargedNSt3__26vectorIiNS_9allocatorIiEEEE($extras) {
 $extras = $extras | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $extras;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1192924 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __Z15is_custom_tyresNSt3__26vectorIiNS_9allocatorIiEEEE($extras) {
 $extras = $extras | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $extras;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1193188 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function dynCall_iiiiiiii(index, a1, a2, a3, a4, a5, a6, a7) {
 index = index | 0;
 a1 = a1 | 0;
 a2 = a2 | 0;
 a3 = a3 | 0;
 a4 = a4 | 0;
 a5 = a5 | 0;
 a6 = a6 | 0;
 a7 = a7 | 0;
 return FUNCTION_TABLE_iiiiiiii[index & 7](a1 | 0, a2 | 0, a3 | 0, a4 | 0, a5 | 0, a6 | 0, a7 | 0) | 0;
}

function __ZN14ToggleMenuItemINSt3__212basic_stringIcNS0_11char_traitsIcEENS0_9allocatorIcEEEEE9onConfirmEv($this) {
 $this = $this | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1220872 | 0);
}

function __Z36onconfirm_online_player_options_menu8MenuItemIiE($choice) {
 $choice = $choice | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $choice;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 666408 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __Z35onconfirm_skinchanger_drawable_menu8MenuItemIiE($choice) {
 $choice = $choice | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $choice;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1217660 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __Z34onconfirm_skinchanger_texture_menu8MenuItemIiE($choice) {
 $choice = $choice | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $choice;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1212484 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNSt3__215basic_streambufIwNS_11char_traitsIwEEE5uflowEv($this) {
 $this = $this | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1221532 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNSt3__215basic_streambufIcNS_11char_traitsIcEEE5uflowEv($this) {
 $this = $this | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1221604 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __Z33onconfirm_skinchanger_detail_menu8MenuItemIiE($choice) {
 $choice = $choice | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $choice;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1216352 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZN28FunctionDrivenToggleMenuItemIiE16get_toggle_valueEv($this) {
 $this = $this | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1216208 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __Z33onconfirm_vehicle_invincible_menu8MenuItemIiE($choice) {
 $choice = $choice | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $choice;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 883260 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function _wmemset($d, $c, $n) {
 $d = $d | 0;
 $c = $c | 0;
 $n = $n | 0;
 var $$012 = 0, $$03 = 0;
 if ($n | 0) {
  $$012 = $n;
  $$03 = $d;
  while (1) {
   $$012 = $$012 + -1 | 0;
   HEAP32[$$03 >> 2] = $c;
   if (!$$012) break; else $$03 = $$03 + 4 | 0;
  }
 }
 return $d | 0;
}

function __ZNSt3__220__shared_ptr_emplaceI16WantedSymbolItemIiENS_9allocatorIS2_EEE16__on_zero_sharedEv($this) {
 $this = $this | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1225572 | 0);
}

function __Z31onconfirm_online_player_options8MenuItemIiE($choice) {
 $choice = $choice | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $choice;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1150556 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __Z30onconfirm_weapon_mod_menu_tint8MenuItemIiE($choice) {
 $choice = $choice | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $choice;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1163200 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __Z30onconfirm_vehspawnoptions_menu8MenuItemIiE($choice) {
 $choice = $choice | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $choice;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1117236 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __Z30onconfirm_color_menu_selection8MenuItemIiE($choice) {
 $choice = $choice | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $choice;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1101016 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNSt3__220__shared_ptr_emplaceI14ToggleMenuItemIiENS_9allocatorIS2_EEE16__on_zero_sharedEv($this) {
 $this = $this | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1225612 | 0);
}

function __Z30onconfirm_vehmod_category_menu8MenuItemIiE($choice) {
 $choice = $choice | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $choice;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 892168 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __Z29onconfirm_vehsuspoptions_menu8MenuItemIiE($choice) {
 $choice = $choice | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $choice;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1181960 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __Z29onconfirm_savedskin_slot_menu8MenuItemIiE($choice) {
 $choice = $choice | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $choice;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1156016 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __Z29onconfirm_props_drawable_menu8MenuItemIiE($choice) {
 $choice = $choice | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $choice;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1191960 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZN8MenuItemINSt3__212basic_stringIcNS0_11char_traitsIcEENS0_9allocatorIcEEEEE9onConfirmEv($this) {
 $this = $this | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1199304 | 0);
}

function __Z29onconfirm_voiceproximity_menu8MenuItemIiE($choice) {
 $choice = $choice | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $choice;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 897368 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __Z29onconfirm_vehicle_torque_menu8MenuItemIiE($choice) {
 $choice = $choice | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $choice;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 731756 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __Z29onconfirm_rainbowoptions_menu8MenuItemIiE($choice) {
 $choice = $choice | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $choice;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 831776 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __Z28onconfirm_weapon_in_category8MenuItemIiE($choice) {
 $choice = $choice | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $choice;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1225332 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __Z28onconfirm_savedveh_slot_menu8MenuItemIiE($choice) {
 $choice = $choice | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $choice;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1154956 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __Z28onconfirm_props_texture_menu8MenuItemIiE($choice) {
 $choice = $choice | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $choice;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1213320 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __Z28onconfirm_vehicle_power_menu8MenuItemIiE($choice) {
 $choice = $choice | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $choice;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 868320 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __Z27onconfirm_teleport_category8MenuItemIiE($choice) {
 $choice = $choice | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $choice;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1204192 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __Z27onconfirm_voicechannel_menu8MenuItemIiE($choice) {
 $choice = $choice | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $choice;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 938208 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __Z27onconfirm_teleport_location8MenuItemIiE($choice) {
 $choice = $choice | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $choice;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 865684 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __Z27onconfirm_ownedvehicle_menu8MenuItemIiE($choice) {
 $choice = $choice | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $choice;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 619096 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __Z26onconfirm_spawn_menu_indus8MenuItemIiE($choice) {
 $choice = $choice | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $choice;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1104376 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __Z26onconfirm_perspective_menu8MenuItemIiE($choice) {
 $choice = $choice | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $choice;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1217764 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __Z26onconfirm_skinchanger_menu8MenuItemIiE($choice) {
 $choice = $choice | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $choice;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 962368 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __Z25onconfirm_spawn_menu_cars8MenuItemIiE($choice) {
 $choice = $choice | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $choice;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1121736 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __Z25onconfirm_weaponlist_menu8MenuItemIiE($choice) {
 $choice = $choice | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $choice;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 880776 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __Z25onconfirm_paint_menu_type8MenuItemIiE($choice) {
 $choice = $choice | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $choice;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 959544 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __Z24onconfirm_savedskin_menu8MenuItemIiE($choice) {
 $choice = $choice | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $choice;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1220572 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __Z24onconfirm_animation_menu8MenuItemIiE($choice) {
 $choice = $choice | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $choice;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1100116 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNKSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE7compareEPKc($this, $__s) {
 $this = $this | 0;
 $__s = $__s | 0;
 return __ZNKSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE7compareEjjPKcj($this, 0, -1, $__s, _strlen($__s) | 0) | 0;
}

function __Z23onconfirm_savedveh_menu8MenuItemIiE($choice) {
 $choice = $choice | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $choice;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1220428 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __Z23onconfirm_reset_globals8MenuItemIiE($choice) {
 $choice = $choice | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $choice;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1228144 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __Z23onconfirm_carspawn_menu8MenuItemIiE($choice) {
 $choice = $choice | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $choice;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1059904 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __Z23onconfirm_anim_top_menu8MenuItemIiE($choice) {
 $choice = $choice | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $choice;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1188356 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function runPostSets() {}
function _i64Subtract(a, b, c, d) {
 a = a | 0;
 b = b | 0;
 c = c | 0;
 d = d | 0;
 var h = 0, CSE$0 = 0;
 CSE$0 = b - d | 0;
 h = (CSE$0 | 0) >>> 0;
 h = (CSE$0 | 0) - (c >>> 0 > a >>> 0 | 0) >>> 0;
 return (tempRet0 = h, a - c >>> 0 | 0) | 0;
}

function __ZNSt3__220__shared_ptr_emplaceI8MenuItemIiENS_9allocatorIS2_EEE16__on_zero_sharedEv($this) {
 $this = $this | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1225924 | 0);
}

function __ZNKSt3__220__time_get_c_storageIwE8__monthsEv($this) {
 $this = $this | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1125696 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNKSt3__220__time_get_c_storageIcE8__monthsEv($this) {
 $this = $this | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1124824 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNKSt3__210moneypunctIwLb1EE13do_pos_formatEv($agg$result, $this) {
 $agg$result = $agg$result | 0;
 $this = $this | 0;
 HEAP8[$agg$result >> 0] = 2;
 HEAP8[$agg$result + 1 >> 0] = 3;
 HEAP8[$agg$result + 2 >> 0] = 0;
 HEAP8[$agg$result + 3 >> 0] = 4;
 return;
}

function __ZNKSt3__210moneypunctIwLb1EE13do_neg_formatEv($agg$result, $this) {
 $agg$result = $agg$result | 0;
 $this = $this | 0;
 HEAP8[$agg$result >> 0] = 2;
 HEAP8[$agg$result + 1 >> 0] = 3;
 HEAP8[$agg$result + 2 >> 0] = 0;
 HEAP8[$agg$result + 3 >> 0] = 4;
 return;
}

function __ZNKSt3__210moneypunctIwLb0EE13do_pos_formatEv($agg$result, $this) {
 $agg$result = $agg$result | 0;
 $this = $this | 0;
 HEAP8[$agg$result >> 0] = 2;
 HEAP8[$agg$result + 1 >> 0] = 3;
 HEAP8[$agg$result + 2 >> 0] = 0;
 HEAP8[$agg$result + 3 >> 0] = 4;
 return;
}

function __ZNKSt3__210moneypunctIwLb0EE13do_neg_formatEv($agg$result, $this) {
 $agg$result = $agg$result | 0;
 $this = $this | 0;
 HEAP8[$agg$result >> 0] = 2;
 HEAP8[$agg$result + 1 >> 0] = 3;
 HEAP8[$agg$result + 2 >> 0] = 0;
 HEAP8[$agg$result + 3 >> 0] = 4;
 return;
}

function __ZNKSt3__210moneypunctIcLb1EE13do_pos_formatEv($agg$result, $this) {
 $agg$result = $agg$result | 0;
 $this = $this | 0;
 HEAP8[$agg$result >> 0] = 2;
 HEAP8[$agg$result + 1 >> 0] = 3;
 HEAP8[$agg$result + 2 >> 0] = 0;
 HEAP8[$agg$result + 3 >> 0] = 4;
 return;
}

function __ZNKSt3__210moneypunctIcLb1EE13do_neg_formatEv($agg$result, $this) {
 $agg$result = $agg$result | 0;
 $this = $this | 0;
 HEAP8[$agg$result >> 0] = 2;
 HEAP8[$agg$result + 1 >> 0] = 3;
 HEAP8[$agg$result + 2 >> 0] = 0;
 HEAP8[$agg$result + 3 >> 0] = 4;
 return;
}

function __ZNKSt3__210moneypunctIcLb0EE13do_pos_formatEv($agg$result, $this) {
 $agg$result = $agg$result | 0;
 $this = $this | 0;
 HEAP8[$agg$result >> 0] = 2;
 HEAP8[$agg$result + 1 >> 0] = 3;
 HEAP8[$agg$result + 2 >> 0] = 0;
 HEAP8[$agg$result + 3 >> 0] = 4;
 return;
}

function __ZNKSt3__210moneypunctIcLb0EE13do_neg_formatEv($agg$result, $this) {
 $agg$result = $agg$result | 0;
 $this = $this | 0;
 HEAP8[$agg$result >> 0] = 2;
 HEAP8[$agg$result + 1 >> 0] = 3;
 HEAP8[$agg$result + 2 >> 0] = 0;
 HEAP8[$agg$result + 3 >> 0] = 4;
 return;
}

function __ZN12_GLOBAL__N_114__libcpp_nmstrD2Ev($this) {
 $this = $this | 0;
 var $1 = 0, $2 = 0;
 $1 = (HEAP32[$this >> 2] | 0) + -4 | 0;
 $2 = HEAP32[$1 >> 2] | 0;
 HEAP32[$1 >> 2] = $2 + -1;
 if (($2 + -1 | 0) < 0) __ZdlPv((HEAP32[$this >> 2] | 0) + -12 | 0);
 return;
}

function __ZNKSt3__220__time_get_c_storageIwE7__weeksEv($this) {
 $this = $this | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1157696 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNKSt3__220__time_get_c_storageIwE7__am_pmEv($this) {
 $this = $this | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1206828 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNKSt3__220__time_get_c_storageIcE7__weeksEv($this) {
 $this = $this | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1157104 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNKSt3__220__time_get_c_storageIcE7__am_pmEv($this) {
 $this = $this | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1206572 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __Z22onconfirm_vehdoor_menu8MenuItemIiE($choice) {
 $choice = $choice | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $choice;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 952424 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __Z21onconfirm_camera_menu8MenuItemIiE($choice) {
 $choice = $choice | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $choice;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1225156 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZTv0_n12_NSt3__219basic_ostringstreamIcNS_11char_traitsIcEENS_9allocatorIcEEED0Ev($this) {
 $this = $this | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1217308 | 0);
}

function __Z21onconfirm_weapon_menu8MenuItemIiE($choice) {
 $choice = $choice | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $choice;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 980748 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __Z21onconfirm_vehmod_menu8MenuItemIiE($choice) {
 $choice = $choice | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $choice;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 427380 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __Z21onconfirm_remote_menu8MenuItemIiE($choice) {
 $choice = $choice | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $choice;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 541280 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __Z21onconfirm_player_menu8MenuItemIiE($choice) {
 $choice = $choice | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $choice;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 986880 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __Z20onconfirm_world_menu8MenuItemIiE($choice) {
 $choice = $choice | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $choice;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1221416 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __Z20onconfirm_voice_menu8MenuItemIiE($choice) {
 $choice = $choice | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $choice;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1172664 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __Z20onconfirm_props_menu8MenuItemIiE($choice) {
 $choice = $choice | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $choice;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1227508 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __Z20onconfirm_paint_menu8MenuItemIiE($choice) {
 $choice = $choice | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $choice;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1219528 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __Z20onconfirm_leave_menu8MenuItemIiE($choice) {
 $choice = $choice | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $choice;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1136036 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZTv0_n12_NSt3__219basic_ostringstreamIcNS_11char_traitsIcEENS_9allocatorIcEEED1Ev($this) {
 $this = $this | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1218e3 | 0);
}

function __ZTv0_n12_NSt3__218basic_stringstreamIcNS_11char_traitsIcEENS_9allocatorIcEEED1Ev($this) {
 $this = $this | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1217008 | 0);
}

function __ZTv0_n12_NSt3__218basic_stringstreamIcNS_11char_traitsIcEENS_9allocatorIcEEED0Ev($this) {
 $this = $this | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1216652 | 0);
}

function __Z20onconfirm_smoke_menu8MenuItemIiE($choice) {
 $choice = $choice | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $choice;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 595300 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __Z20onconfirm_neons_menu8MenuItemIiE($choice) {
 $choice = $choice | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $choice;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 514684 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __Z20onconfirm_light_menu8MenuItemIiE($choice) {
 $choice = $choice | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $choice;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 773452 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __Z19onconfirm_time_menu8MenuItemIiE($choice) {
 $choice = $choice | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $choice;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1031916 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __Z19onconfirm_task_menu8MenuItemIiE($choice) {
 $choice = $choice | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $choice;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1177516 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __Z19onconfirm_main_menu8MenuItemIiE($choice) {
 $choice = $choice | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $choice;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1214216 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNSt3__217__call_once_proxyINS_5tupleIJONS_12_GLOBAL__N_111__fake_bindEEEEEEvPv($__vp) {
 $__vp = $__vp | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $__vp;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1217228 | 0);
}

function __Z19onconfirm_trim_menu8MenuItemIiE($choice) {
 $choice = $choice | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $choice;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 780032 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __Z19onconfirm_misc_menu8MenuItemIiE($choice) {
 $choice = $choice | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $choice;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 875164 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __Z19onconfirm_anim_menu8MenuItemIiE($choice) {
 $choice = $choice | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $choice;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 965528 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __Z18onconfirm_ani_menu8MenuItemIiE($choice) {
 $choice = $choice | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $choice;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1223804 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNKSt3__27codecvtIcc11__mbstate_tE9do_lengthERS1_PKcS5_j($this, $0, $frm, $end, $mx) {
 $this = $this | 0;
 $0 = $0 | 0;
 $frm = $frm | 0;
 $end = $end | 0;
 $mx = $mx | 0;
 var $3 = 0;
 $3 = $end - $frm | 0;
 return ($3 >>> 0 < $mx >>> 0 ? $3 : $mx) | 0;
}

function __ZNKSt3__220__time_get_c_storageIwE3__xEv($this) {
 $this = $this | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1222456 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNKSt3__220__time_get_c_storageIwE3__rEv($this) {
 $this = $this | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1222596 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNKSt3__220__time_get_c_storageIwE3__cEv($this) {
 $this = $this | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1222736 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNKSt3__220__time_get_c_storageIwE3__XEv($this) {
 $this = $this | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1222876 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNKSt3__220__time_get_c_storageIcE3__xEv($this) {
 $this = $this | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1223532 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNKSt3__220__time_get_c_storageIcE3__rEv($this) {
 $this = $this | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1223260 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNKSt3__220__time_get_c_storageIcE3__cEv($this) {
 $this = $this | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1223396 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNKSt3__220__time_get_c_storageIcE3__XEv($this) {
 $this = $this | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1223668 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __Z18onconfirm_veh_menu8MenuItemIiE($choice) {
 $choice = $choice | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $choice;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 836716 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZThn8_NSt3__218basic_stringstreamIcNS_11char_traitsIcEENS_9allocatorIcEEED1Ev($this) {
 $this = $this | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1218424 | 0);
}

function __ZThn8_NSt3__218basic_stringstreamIcNS_11char_traitsIcEENS_9allocatorIcEEED0Ev($this) {
 $this = $this | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1218212 | 0);
}

function __Z17onconfirm_vc_menu8MenuItemIiE($choice) {
 $choice = $choice | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $choice;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 972480 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __Z17onconfirm_hc_menu8MenuItemIiE($choice) {
 $choice = $choice | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $choice;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 975160 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function _bitshift64Shl(low, high, bits) {
 low = low | 0;
 high = high | 0;
 bits = bits | 0;
 if ((bits | 0) < 32) {
  tempRet0 = high << bits | (low & (1 << bits) - 1 << 32 - bits) >>> 32 - bits;
  return low << bits;
 }
 tempRet0 = low << bits - 32;
 return 0;
}

function __ZNSt3__27codecvtIwc11__mbstate_tED2Ev($this) {
 $this = $this | 0;
 var $0 = 0, $1 = 0;
 HEAP32[$this >> 2] = 9908;
 $0 = $this + 8 | 0;
 $1 = HEAP32[$0 >> 2] | 0;
 if (($1 | 0) != (__ZNSt3__26__clocEv() | 0)) _freelocale(HEAP32[$0 >> 2] | 0);
 return;
}

function __ZNKSt3__25ctypeIwE5do_isEtw($this, $m, $c) {
 $this = $this | 0;
 $m = $m | 0;
 $c = $c | 0;
 var $6 = 0;
 if ($c >>> 0 < 128) $6 = (HEAP16[(HEAP32[(___ctype_b_loc() | 0) >> 2] | 0) + ($c << 1) >> 1] & $m) << 16 >> 16 != 0; else $6 = 0;
 return $6 | 0;
}

function __ZNSt3__219basic_ostringstreamIcNS_11char_traitsIcEENS_9allocatorIcEEED1Ev($this) {
 $this = $this | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1219808 | 0);
}

function __ZNSt3__219basic_ostringstreamIcNS_11char_traitsIcEENS_9allocatorIcEEED0Ev($this) {
 $this = $this | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1219364 | 0);
}

function __ZNSt3__210__stdinbufIwE9underflowEv($this) {
 $this = $this | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1228392 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNSt3__210__stdinbufIcE9underflowEv($this) {
 $this = $this | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1228420 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZN13ERDatabaseKVS15get_saved_skinsEi($agg$result, $this, $index) {
 $agg$result = $agg$result | 0;
 $this = $this | 0;
 $index = $index | 0;
 HEAP32[$agg$result >> 2] = 0;
 HEAP32[$agg$result + 4 >> 2] = 0;
 HEAP32[$agg$result + 8 >> 2] = 0;
 return;
}

function _bitshift64Lshr(low, high, bits) {
 low = low | 0;
 high = high | 0;
 bits = bits | 0;
 if ((bits | 0) < 32) {
  tempRet0 = high >>> bits;
  return low >>> bits | (high & (1 << bits) - 1) << 32 - bits;
 }
 tempRet0 = 0;
 return high >>> bits - 32 | 0;
}

function __ZNSt3__218basic_stringstreamIcNS_11char_traitsIcEENS_9allocatorIcEEED1Ev($this) {
 $this = $this | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1218868 | 0);
}

function __ZNSt3__218basic_stringstreamIcNS_11char_traitsIcEENS_9allocatorIcEEED0Ev($this) {
 $this = $this | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1218620 | 0);
}

function dynCall_iiiiiii(index, a1, a2, a3, a4, a5, a6) {
 index = index | 0;
 a1 = a1 | 0;
 a2 = a2 | 0;
 a3 = a3 | 0;
 a4 = a4 | 0;
 a5 = a5 | 0;
 a6 = a6 | 0;
 return FUNCTION_TABLE_iiiiiii[index & 63](a1 | 0, a2 | 0, a3 | 0, a4 | 0, a5 | 0, a6 | 0) | 0;
}

function __ZNSt3__215basic_stringbufIcNS_11char_traitsIcEENS_9allocatorIcEEED2Ev($this) {
 $this = $this | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1224224 | 0);
}

function __ZNSt3__215basic_stringbufIcNS_11char_traitsIcEENS_9allocatorIcEEED0Ev($this) {
 $this = $this | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1223896 | 0);
}

function __ZNSt3__211__stdoutbufIwE4syncEv($this) {
 $this = $this | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1198284 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNSt3__211__stdoutbufIcE4syncEv($this) {
 $this = $this | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1198508 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNSt3__210__stdinbufIwE5uflowEv($this) {
 $this = $this | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1228480 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNSt3__210__stdinbufIcE5uflowEv($this) {
 $this = $this | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1228508 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZNKSt3__25ctypeIcE10do_tolowerEc($this, $c) {
 $this = $this | 0;
 $c = $c | 0;
 var $6 = 0;
 if ($c << 24 >> 24 > -1) $6 = HEAP32[(HEAP32[(___ctype_tolower_loc() | 0) >> 2] | 0) + ($c << 24 >> 24 << 2) >> 2] & 255; else $6 = $c;
 return $6 | 0;
}

function __ZNKSt3__25ctypeIcE10do_toupperEc($this, $c) {
 $this = $this | 0;
 $c = $c | 0;
 var $6 = 0;
 if ($c << 24 >> 24 > -1) $6 = HEAP32[(HEAP32[(___ctype_toupper_loc() | 0) >> 2] | 0) + (($c & 255) << 2) >> 2] & 255; else $6 = $c;
 return $6 | 0;
}

function dynCall_iiiiiid(index, a1, a2, a3, a4, a5, a6) {
 index = index | 0;
 a1 = a1 | 0;
 a2 = a2 | 0;
 a3 = a3 | 0;
 a4 = a4 | 0;
 a5 = a5 | 0;
 a6 = +a6;
 return FUNCTION_TABLE_iiiiiid[index & 3](a1 | 0, a2 | 0, a3 | 0, a4 | 0, a5 | 0, +a6) | 0;
}

function __Z37onhighlight_skinchanger_drawable_menu8MenuItemIiE($choice) {
 $choice = $choice | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $choice;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1170592 | 0);
}

function __ZTv0_n12_NSt3__214basic_iostreamIcNS_11char_traitsIcEEED1Ev($this) {
 $this = $this | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1227096 | 0);
}

function __ZTv0_n12_NSt3__214basic_iostreamIcNS_11char_traitsIcEEED0Ev($this) {
 $this = $this | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1225884 | 0);
}

function __Z36onhighlight_skinchanger_texture_menu8MenuItemIiE($choice) {
 $choice = $choice | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $choice;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1175260 | 0);
}

function dynCall_viiiiii(index, a1, a2, a3, a4, a5, a6) {
 index = index | 0;
 a1 = a1 | 0;
 a2 = a2 | 0;
 a3 = a3 | 0;
 a4 = a4 | 0;
 a5 = a5 | 0;
 a6 = a6 | 0;
 FUNCTION_TABLE_viiiiii[index & 15](a1 | 0, a2 | 0, a3 | 0, a4 | 0, a5 | 0, a6 | 0);
}

function ___cxa_is_pointer_type($type) {
 $type = $type | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $type;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1227572 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function __ZTv0_n12_NSt3__213basic_ostreamIwNS_11char_traitsIwEEED1Ev($this) {
 $this = $this | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1227140 | 0);
}

function __ZTv0_n12_NSt3__213basic_ostreamIwNS_11char_traitsIwEEED0Ev($this) {
 $this = $this | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1226228 | 0);
}

function __ZTv0_n12_NSt3__213basic_ostreamIcNS_11char_traitsIcEEED1Ev($this) {
 $this = $this | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1227184 | 0);
}

function __ZTv0_n12_NSt3__213basic_ostreamIcNS_11char_traitsIcEEED0Ev($this) {
 $this = $this | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1226268 | 0);
}

function __ZTv0_n12_NSt3__213basic_istreamIwNS_11char_traitsIwEEED1Ev($this) {
 $this = $this | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1227228 | 0);
}

function __ZTv0_n12_NSt3__213basic_istreamIwNS_11char_traitsIwEEED0Ev($this) {
 $this = $this | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1226308 | 0);
}

function __ZTv0_n12_NSt3__213basic_istreamIcNS_11char_traitsIcEEED1Ev($this) {
 $this = $this | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1227272 | 0);
}

function __ZTv0_n12_NSt3__213basic_istreamIcNS_11char_traitsIcEEED0Ev($this) {
 $this = $this | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1226348 | 0);
}

function __ZThn8_NSt3__214basic_iostreamIcNS_11char_traitsIcEEED1Ev($this) {
 $this = $this | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1228192 | 0);
}

function __ZThn8_NSt3__214basic_iostreamIcNS_11char_traitsIcEEED0Ev($this) {
 $this = $this | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1227480 | 0);
}

function __Z32onhighlight_weapon_mod_menu_tint8MenuItemIiE($choice) {
 $choice = $choice | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $choice;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1212692 | 0);
}

function __Z32onhighlight_color_menu_selection8MenuItemIiE($choice) {
 $choice = $choice | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $choice;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1212824 | 0);
}

function __Z31onhighlight_props_drawable_menu8MenuItemIiE($choice) {
 $choice = $choice | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $choice;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1162712 | 0);
}

function __Z30onhighlight_props_texture_menu8MenuItemIiE($choice) {
 $choice = $choice | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $choice;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1197648 | 0);
}

function __ZNSt3__215basic_streambufIwNS_11char_traitsIwEEED2Ev($this) {
 $this = $this | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1227652 | 0);
}

function __ZNSt3__215basic_streambufIwNS_11char_traitsIwEEED0Ev($this) {
 $this = $this | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1227316 | 0);
}

function __ZNSt3__215basic_streambufIcNS_11char_traitsIcEEED2Ev($this) {
 $this = $this | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1227688 | 0);
}

function __ZNSt3__215basic_streambufIcNS_11char_traitsIcEEED0Ev($this) {
 $this = $this | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1227360 | 0);
}

function __ZNSt3__214basic_iostreamIcNS_11char_traitsIcEEED1Ev($this) {
 $this = $this | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1228252 | 0);
}

function __ZNSt3__214basic_iostreamIcNS_11char_traitsIcEEED0Ev($this) {
 $this = $this | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1227764 | 0);
}

function __ZNSt3__213basic_ostreamIwNS_11char_traitsIwEEED1Ev($this) {
 $this = $this | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1228280 | 0);
}

function __ZNSt3__213basic_ostreamIwNS_11char_traitsIwEEED0Ev($this) {
 $this = $this | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1227900 | 0);
}

function __ZNSt3__213basic_ostreamIcNS_11char_traitsIcEEED1Ev($this) {
 $this = $this | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1228308 | 0);
}

function __ZNSt3__213basic_ostreamIcNS_11char_traitsIcEEED0Ev($this) {
 $this = $this | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1227936 | 0);
}

function __ZNSt3__213basic_istreamIwNS_11char_traitsIwEEED1Ev($this) {
 $this = $this | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1228336 | 0);
}

function __ZNSt3__213basic_istreamIwNS_11char_traitsIwEEED0Ev($this) {
 $this = $this | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1227972 | 0);
}

function __ZNSt3__213basic_istreamIcNS_11char_traitsIcEEED1Ev($this) {
 $this = $this | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1228364 | 0);
}

function __ZNSt3__213basic_istreamIcNS_11char_traitsIcEEED0Ev($this) {
 $this = $this | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1228008 | 0);
}

function __ZNKSt3__28ios_base6getlocEv($this) {
 $this = $this | 0;
 var $0 = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16 | 0;
 $0 = sp;
 __ZNSt3__26localeC2ERKS0_($0, $this + 28 | 0);
 STACKTOP = sp;
 return HEAP32[$0 >> 2] | 0;
}

function __ZNKSt3__25ctypeIwE10do_toupperEw($this, $c) {
 $this = $this | 0;
 $c = $c | 0;
 var $4 = 0;
 if ($c >>> 0 < 128) $4 = HEAP32[(HEAP32[(___ctype_toupper_loc() | 0) >> 2] | 0) + ($c << 2) >> 2] | 0; else $4 = $c;
 return $4 | 0;
}

function __ZNKSt3__25ctypeIwE10do_tolowerEw($this, $c) {
 $this = $this | 0;
 $c = $c | 0;
 var $4 = 0;
 if ($c >>> 0 < 128) $4 = HEAP32[(HEAP32[(___ctype_tolower_loc() | 0) >> 2] | 0) + ($c << 2) >> 2] | 0; else $4 = $c;
 return $4 | 0;
}

function __ZN28FunctionDrivenToggleMenuItemIiE9onConfirmEv($this) {
 $this = $this | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1197404 | 0);
}

function __ZN13ERDatabaseKVS9save_skinEiNSt3__212basic_stringIcNS0_11char_traitsIcEENS0_9allocatorIcEEEEi($this, $ped, $saveName, $slot) {
 $this = $this | 0;
 $ped = $ped | 0;
 $saveName = $saveName | 0;
 $slot = $slot | 0;
 return 1;
}

function __Z24onconfirm_open_tint_menu8MenuItemIiE($choice) {
 $choice = $choice | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $choice;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1070452 | 0);
}

function __ZNKSt3__27codecvtIDsc11__mbstate_tE10do_unshiftERS1_PcS4_RS4_($this, $0, $to, $1, $to_nxt) {
 $this = $this | 0;
 $0 = $0 | 0;
 $to = $to | 0;
 $1 = $1 | 0;
 $to_nxt = $to_nxt | 0;
 HEAP32[$to_nxt >> 2] = $to;
 return 3;
}

function __ZNKSt3__27codecvtIDic11__mbstate_tE10do_unshiftERS1_PcS4_RS4_($this, $0, $to, $1, $to_nxt) {
 $this = $this | 0;
 $0 = $0 | 0;
 $to = $to | 0;
 $1 = $1 | 0;
 $to_nxt = $to_nxt | 0;
 HEAP32[$to_nxt >> 2] = $to;
 return 3;
}

function __ZN16WantedSymbolItemIiE16handleRightPressEv($this) {
 $this = $this | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1089196 | 0);
}

function __ZNSt3__211char_traitsIcE4findEPKcjRS2_($__s, $__n, $__a) {
 $__s = $__s | 0;
 $__n = $__n | 0;
 $__a = $__a | 0;
 var $4 = 0;
 if (!$__n) $4 = 0; else $4 = _memchr($__s, HEAPU8[$__a >> 0] | 0, $__n) | 0;
 return $4 | 0;
}

function __ZNKSt3__27codecvtIcc11__mbstate_tE10do_unshiftERS1_PcS4_RS4_($this, $0, $to, $1, $to_nxt) {
 $this = $this | 0;
 $0 = $0 | 0;
 $to = $to | 0;
 $1 = $1 | 0;
 $to_nxt = $to_nxt | 0;
 HEAP32[$to_nxt >> 2] = $to;
 return 3;
}

function __ZN16WantedSymbolItemIiE15handleLeftPressEv($this) {
 $this = $this | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1085556 | 0);
}

function dynCall_iiiiii(index, a1, a2, a3, a4, a5) {
 index = index | 0;
 a1 = a1 | 0;
 a2 = a2 | 0;
 a3 = a3 | 0;
 a4 = a4 | 0;
 a5 = a5 | 0;
 return FUNCTION_TABLE_iiiiii[index & 31](a1 | 0, a2 | 0, a3 | 0, a4 | 0, a5 | 0) | 0;
}

function __ZNSt3__26locale5facet16__on_zero_sharedEv($this) {
 $this = $this | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1227440 | 0);
}

function __Z18onhighlight_livery8MenuItemIiE($choice) {
 $choice = $choice | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $choice;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1129420 | 0);
}

function __Z16give_weapon_clip8MenuItemIiE($choice) {
 $choice = $choice | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $choice;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1086492 | 0);
}

function __Z16fill_weapon_ammo8MenuItemIiE($choice) {
 $choice = $choice | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $choice;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1109404 | 0);
}

function __ZNSt3__211char_traitsIwE4moveEPwPKwj($__s1, $__s2, $__n) {
 $__s1 = $__s1 | 0;
 $__s2 = $__s2 | 0;
 $__n = $__n | 0;
 var $2 = 0;
 if (!$__n) $2 = $__s1; else $2 = _wmemmove($__s1, $__s2, $__n) | 0;
 return $2 | 0;
}

function __Z14set_plate_text8MenuItemIiE($choice) {
 $choice = $choice | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $choice;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1164008 | 0);
}

function __ZNSt3__211char_traitsIwE4copyEPwPKwj($__s1, $__s2, $__n) {
 $__s1 = $__s1 | 0;
 $__s2 = $__s2 | 0;
 $__n = $__n | 0;
 var $2 = 0;
 if (!$__n) $2 = $__s1; else $2 = _wmemcpy($__s1, $__s2, $__n) | 0;
 return $2 | 0;
}

function __ZNSt3__211char_traitsIcE7compareEPKcS3_j($__s1, $__s2, $__n) {
 $__s1 = $__s1 | 0;
 $__s2 = $__s2 | 0;
 $__n = $__n | 0;
 var $2 = 0;
 if (!$__n) $2 = 0; else $2 = _memcmp($__s1, $__s2, $__n) | 0;
 return $2 | 0;
}

function dynCall_iiiiid(index, a1, a2, a3, a4, a5) {
 index = index | 0;
 a1 = a1 | 0;
 a2 = a2 | 0;
 a3 = a3 | 0;
 a4 = a4 | 0;
 a5 = +a5;
 return FUNCTION_TABLE_iiiiid[index & 7](a1 | 0, a2 | 0, a3 | 0, a4 | 0, +a5) | 0;
}

function __ZN14ToggleMenuItemIiE9onConfirmEv($this) {
 $this = $this | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1198732 | 0);
}

function dynCall_viiiii(index, a1, a2, a3, a4, a5) {
 index = index | 0;
 a1 = a1 | 0;
 a2 = a2 | 0;
 a3 = a3 | 0;
 a4 = a4 | 0;
 a5 = a5 | 0;
 FUNCTION_TABLE_viiiii[index & 3](a1 | 0, a2 | 0, a3 | 0, a4 | 0, a5 | 0);
}

function __ZN10__cxxabiv112_GLOBAL__N_19destruct_EPv($p) {
 $p = $p | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $p;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1225232 | 0);
}

function __ZNSt3__211__stdoutbufIwED0Ev($this) {
 $this = $this | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1227836 | 0);
}

function __ZNSt3__211__stdoutbufIcED0Ev($this) {
 $this = $this | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1227868 | 0);
}

function __ZNSt3__211char_traitsIwE6assignEPwjw($__s, $__n, $__a) {
 $__s = $__s | 0;
 $__n = $__n | 0;
 $__a = $__a | 0;
 var $2 = 0;
 if (!$__n) $2 = $__s; else $2 = _wmemset($__s, $__a, $__n) | 0;
 return $2 | 0;
}

function __ZNSt3__210__stdinbufIwED0Ev($this) {
 $this = $this | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1228044 | 0);
}

function __ZNSt3__210__stdinbufIcED0Ev($this) {
 $this = $this | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1228076 | 0);
}

function __ZN8MenuItemIiE9onConfirmEv($this) {
 $this = $this | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1211528 | 0);
}

function __ZNSt3__26locale5__impD2Ev($this) {
 $this = $this | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1215920 | 0);
}

function __ZNSt3__26locale5__impD0Ev($this) {
 $this = $this | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1228600 | 0);
}

function __ZNSt3__28ios_baseD2Ev($this) {
 $this = $this | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1222132 | 0);
}

function __ZNSt3__28ios_baseD0Ev($this) {
 $this = $this | 0;
 if ((asyncState | 0) != 2) {
  HEAP32[EMTSTACKTOP + 8 >> 2] = $this;
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1228656 | 0);
}

function __ZNSt3__220__shared_ptr_emplaceI14ToggleMenuItemINS_12basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEEENS5_IS8_EEE21__on_zero_shared_weakEv($this) {
 $this = $this | 0;
 __ZdlPv($this);
 return;
}

function __ZN13ERDatabaseKVS20rename_saved_vehicleENSt3__212basic_stringIcNS0_11char_traitsIcEENS0_9allocatorIcEEEEi($this, $name, $slot) {
 $this = $this | 0;
 $name = $name | 0;
 $slot = $slot | 0;
 return;
}

function __ZN16WantedSymbolItemIiED0Ev($this) {
 $this = $this | 0;
 HEAP32[$this >> 2] = 2172;
 __ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEED2Ev($this + 4 | 0);
 __ZdlPv($this);
 return;
}

function _wcslen($s) {
 $s = $s | 0;
 var $$0 = 0, $$0$lcssa = 0;
 $$0 = $s;
 while (1) if (!(HEAP32[$$0 >> 2] | 0)) {
  $$0$lcssa = $$0;
  break;
 } else $$0 = $$0 + 4 | 0;
 return $$0$lcssa - $s >> 2 | 0;
}

function __ZNSt3__26localeC2ERKS0_($this, $l) {
 $this = $this | 0;
 $l = $l | 0;
 var $0 = 0;
 $0 = HEAP32[$l >> 2] | 0;
 HEAP32[$this >> 2] = $0;
 __ZNSt3__214__shared_count12__add_sharedEv($0);
 return;
}

function __ZN14ToggleMenuItemIiED0Ev($this) {
 $this = $this | 0;
 HEAP32[$this >> 2] = 2172;
 __ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEED2Ev($this + 4 | 0);
 __ZdlPv($this);
 return;
}

function __ZN13ERDatabaseKVS17rename_saved_skinENSt3__212basic_stringIcNS0_11char_traitsIcEENS0_9allocatorIcEEEEi($this, $name, $slot) {
 $this = $this | 0;
 $name = $name | 0;
 $slot = $slot | 0;
 return;
}

function __ZN14ToggleMenuItemINSt3__212basic_stringIcNS0_11char_traitsIcEENS0_9allocatorIcEEEEE16get_toggle_valueEv($this) {
 $this = $this | 0;
 return (HEAP8[HEAP32[$this + 40 >> 2] >> 0] | 0) != 0 | 0;
}

function __ZNSt3__25ctypeIcED2Ev($this) {
 $this = $this | 0;
 var $1 = 0;
 HEAP32[$this >> 2] = 9976;
 $1 = HEAP32[$this + 8 >> 2] | 0;
 if ($1 | 0) if (HEAP8[$this + 12 >> 0] | 0) __ZdaPv($1);
 return;
}

function __ZNSt3__220__shared_ptr_emplaceI8MenuItemINS_12basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEEENS5_IS8_EEE21__on_zero_shared_weakEv($this) {
 $this = $this | 0;
 __ZdlPv($this);
 return;
}

function __Z20reset_weapon_globalsv() {
 HEAP32[22049] = 0;
 HEAP8[95012] = 0;
 HEAP8[95011] = 0;
 HEAP8[95010] = 0;
 HEAP8[95009] = 0;
 HEAP8[95008] = 0;
 HEAP8[95007] = 0;
 HEAP8[95006] = 0;
 return;
}

function dynCall_iiiii(index, a1, a2, a3, a4) {
 index = index | 0;
 a1 = a1 | 0;
 a2 = a2 | 0;
 a3 = a3 | 0;
 a4 = a4 | 0;
 return FUNCTION_TABLE_iiiii[index & 7](a1 | 0, a2 | 0, a3 | 0, a4 | 0) | 0;
}

function __ZNSt3__210__time_putD2Ev($this) {
 $this = $this | 0;
 var $0 = 0;
 $0 = HEAP32[$this >> 2] | 0;
 if (($0 | 0) != (__ZNSt3__26__clocEv() | 0)) _freelocale(HEAP32[$this >> 2] | 0);
 return;
}

function __ZN8MenuItemIiED0Ev($this) {
 $this = $this | 0;
 HEAP32[$this >> 2] = 2172;
 __ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEED2Ev($this + 4 | 0);
 __ZdlPv($this);
 return;
}

function dynCall_viiii(index, a1, a2, a3, a4) {
 index = index | 0;
 a1 = a1 | 0;
 a2 = a2 | 0;
 a3 = a3 | 0;
 a4 = a4 | 0;
 FUNCTION_TABLE_viiii[index & 15](a1 | 0, a2 | 0, a3 | 0, a4 | 0);
}

function __ZNSt3__212basic_stringIwNS_11char_traitsIwEENS_9allocatorIwEEED2Ev($this) {
 $this = $this | 0;
 if ((HEAP8[$this + 8 + 3 >> 0] | 0) < 0) __ZdlPv(HEAP32[$this >> 2] | 0);
 return;
}

function __ZNSt3__28numpunctIwED2Ev($this) {
 $this = $this | 0;
 HEAP32[$this >> 2] = 10068;
 __ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEED2Ev($this + 16 | 0);
 return;
}

function __ZNSt3__28numpunctIcED2Ev($this) {
 $this = $this | 0;
 HEAP32[$this >> 2] = 10028;
 __ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEED2Ev($this + 12 | 0);
 return;
}

function __ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEED2Ev($this) {
 $this = $this | 0;
 if ((HEAP8[$this + 11 >> 0] | 0) < 0) __ZdlPv(HEAP32[$this >> 2] | 0);
 return;
}

function __Z22vehicle_menu_interruptv() {
 if ((asyncState | 0) != 2) {
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1174852 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function ___syscall_ret($r) {
 $r = $r | 0;
 var $$0 = 0;
 if ($r >>> 0 > 4294963200) {
  HEAP32[(___errno_location() | 0) >> 2] = 0 - $r;
  $$0 = -1;
 } else $$0 = $r;
 return $$0 | 0;
}

function __ZNSt3__28time_putIwNS_19ostreambuf_iteratorIwNS_11char_traitsIwEEEEED0Ev($this) {
 $this = $this | 0;
 __ZNSt3__210__time_putD2Ev($this + 8 | 0);
 __ZdlPv($this);
 return;
}

function __ZNSt3__28time_putIcNS_19ostreambuf_iteratorIcNS_11char_traitsIcEEEEED0Ev($this) {
 $this = $this | 0;
 __ZNSt3__210__time_putD2Ev($this + 8 | 0);
 __ZdlPv($this);
 return;
}

function b12(p0, p1, p2, p3, p4, p5, p6, p7) {
 p0 = p0 | 0;
 p1 = p1 | 0;
 p2 = p2 | 0;
 p3 = p3 | 0;
 p4 = p4 | 0;
 p5 = p5 | 0;
 p6 = p6 | 0;
 p7 = p7 | 0;
 abort(12);
 return 0;
}

function __ZN8MenuItemIiED2Ev($this) {
 $this = $this | 0;
 HEAP32[$this >> 2] = 2172;
 __ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEED2Ev($this + 4 | 0);
 return;
}

function _i64Add(a, b, c, d) {
 a = a | 0;
 b = b | 0;
 c = c | 0;
 d = d | 0;
 var l = 0;
 l = a + c >>> 0;
 return (tempRet0 = b + d + (l >>> 0 < a >>> 0 | 0) >>> 0, l | 0) | 0;
}

function __ZNSt3__28ios_base33__set_badbit_and_consider_rethrowEv($this) {
 $this = $this | 0;
 var $0 = 0;
 $0 = $this + 16 | 0;
 HEAP32[$0 >> 2] = HEAP32[$0 >> 2] | 1;
 return;
}

function _uselocale($l) {
 $l = $l | 0;
 var $1 = 0, $2 = 0;
 $1 = (_pthread_self() | 0) + 180 | 0;
 $2 = HEAP32[$1 >> 2] | 0;
 if ($l | 0) HEAP32[$1 >> 2] = $l;
 return $2 | 0;
}

function __ZNSt3__28ios_base5clearEj($this, $state) {
 $this = $this | 0;
 $state = $state | 0;
 HEAP32[$this + 16 >> 2] = (HEAP32[$this + 24 >> 2] | 0) == 0 | $state;
 return;
}

function __ZNSt3__26__clocEv() {
 if (!(HEAP8[84032] | 0)) if (___cxa_guard_acquire(84032) | 0) HEAP32[23231] = _newlocale(2147483647, 80907, 0) | 0;
 return HEAP32[23231] | 0;
}

function __ZNSt3__220__shared_ptr_emplaceI28FunctionDrivenToggleMenuItemIiENS_9allocatorIS2_EEE21__on_zero_shared_weakEv($this) {
 $this = $this | 0;
 __ZdlPv($this);
 return;
}

function dynCall_iiii(index, a1, a2, a3) {
 index = index | 0;
 a1 = a1 | 0;
 a2 = a2 | 0;
 a3 = a3 | 0;
 return FUNCTION_TABLE_iiii[index & 31](a1 | 0, a2 | 0, a3 | 0) | 0;
}

function __ZNSt3__26locale2id6__initEv($this) {
 $this = $this | 0;
 var $0 = 0;
 $0 = HEAP32[23228] | 0;
 HEAP32[23228] = $0 + 1;
 HEAP32[$this + 4 >> 2] = $0 + 1;
 return;
}

function __ZNKSt3__25ctypeIwE9do_narrowEwc($this, $c, $dfault) {
 $this = $this | 0;
 $c = $c | 0;
 $dfault = $dfault | 0;
 return ($c >>> 0 < 128 ? $c & 255 : $dfault) | 0;
}

function __ZNKSt3__25ctypeIcE9do_narrowEcc($this, $c, $dfault) {
 $this = $this | 0;
 $c = $c | 0;
 $dfault = $dfault | 0;
 return ($c << 24 >> 24 > -1 ? $c : $dfault) | 0;
}

function ___udivdi3($a$0, $a$1, $b$0, $b$1) {
 $a$0 = $a$0 | 0;
 $a$1 = $a$1 | 0;
 $b$0 = $b$0 | 0;
 $b$1 = $b$1 | 0;
 return ___udivmoddi4($a$0, $a$1, $b$0, $b$1, 0) | 0;
}

function __ZNSt3__214__shared_count12__add_sharedEv($this) {
 $this = $this | 0;
 var $0 = 0;
 $0 = $this + 4 | 0;
 HEAP32[$0 >> 2] = (HEAP32[$0 >> 2] | 0) + 1;
 return;
}

function __ZNSt3__28time_putIwNS_19ostreambuf_iteratorIwNS_11char_traitsIwEEEEED2Ev($this) {
 $this = $this | 0;
 __ZNSt3__210__time_putD2Ev($this + 8 | 0);
 return;
}

function __ZNSt3__28time_putIcNS_19ostreambuf_iteratorIcNS_11char_traitsIcEEEEED2Ev($this) {
 $this = $this | 0;
 __ZNSt3__210__time_putD2Ev($this + 8 | 0);
 return;
}

function __ZN10__cxxabiv112_GLOBAL__N_110construct_Ev() {
 if ((asyncState | 0) != 2) {
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1226140 | 0);
}

function _main() {
 if ((asyncState | 0) != 2) {
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1228900 | 0);
 return HEAP32[EMTSTACKTOP >> 2] | 0;
}

function ___cxa_guard_acquire($p) {
 $p = $p | 0;
 var $$0 = 0;
 if ((HEAP8[$p >> 0] | 0) == 1) $$0 = 0; else {
  HEAP8[$p >> 0] = 1;
  $$0 = 1;
 }
 return $$0 | 0;
}

function __ZNSt3__220__shared_ptr_emplaceI16WantedSymbolItemIiENS_9allocatorIS2_EEE21__on_zero_shared_weakEv($this) {
 $this = $this | 0;
 __ZdlPv($this);
 return;
}

function dynCall_viii(index, a1, a2, a3) {
 index = index | 0;
 a1 = a1 | 0;
 a2 = a2 | 0;
 a3 = a3 | 0;
 FUNCTION_TABLE_viii[index & 7](a1 | 0, a2 | 0, a3 | 0);
}

function b0(p0, p1, p2, p3, p4, p5, p6) {
 p0 = p0 | 0;
 p1 = p1 | 0;
 p2 = p2 | 0;
 p3 = p3 | 0;
 p4 = p4 | 0;
 p5 = p5 | 0;
 p6 = p6 | 0;
 abort(0);
 return 0;
}

function __ZNSt3__220__shared_ptr_emplaceI14ToggleMenuItemIiENS_9allocatorIS2_EEE21__on_zero_shared_weakEv($this) {
 $this = $this | 0;
 __ZdlPv($this);
 return;
}

function __ZN8MenuItemINSt3__212basic_stringIcNS0_11char_traitsIcEENS0_9allocatorIcEEEEE29isAbsorbingLeftAndRightEventsEv($this) {
 $this = $this | 0;
 return 0;
}

function stackAlloc(size) {
 size = size | 0;
 var ret = 0;
 ret = STACKTOP;
 STACKTOP = STACKTOP + size | 0;
 STACKTOP = STACKTOP + 15 & -16;
 return ret | 0;
}

function __Z32vehicle_save_slot_menu_interruptv() {
 var $$0 = 0;
 if (!(HEAP8[94963] | 0)) $$0 = 0; else {
  HEAP8[94963] = 0;
  $$0 = 1;
 }
 return $$0 | 0;
}

function ___errno_location() {
 var $$0 = 0;
 if (!(HEAP32[22824] | 0)) $$0 = 91340; else $$0 = HEAP32[(_pthread_self() | 0) + 64 >> 2] | 0;
 return $$0 | 0;
}

function __ZNSt11logic_errorD2Ev($this) {
 $this = $this | 0;
 HEAP32[$this >> 2] = 10488;
 __ZN12_GLOBAL__N_114__libcpp_nmstrD2Ev($this + 4 | 0);
 return;
}

function __Z29skin_save_slot_menu_interruptv() {
 var $$0 = 0;
 if (!(HEAP8[94926] | 0)) $$0 = 0; else {
  HEAP8[94926] = 0;
  $$0 = 1;
 }
 return $$0 | 0;
}

function _isxdigit($c) {
 $c = $c | 0;
 var $4 = 0;
 if (($c + -48 | 0) >>> 0 < 10) $4 = 1; else $4 = (($c | 32) + -97 | 0) >>> 0 < 6;
 return $4 & 1 | 0;
}

function __ZNSt3__220__shared_ptr_emplaceI8MenuItemIiENS_9allocatorIS2_EEE21__on_zero_shared_weakEv($this) {
 $this = $this | 0;
 __ZdlPv($this);
 return;
}

function __ZNSt3__215basic_streambufIwNS_11char_traitsIwEEE6setbufEPwi($this, $0, $1) {
 $this = $this | 0;
 $0 = $0 | 0;
 $1 = $1 | 0;
 return $this | 0;
}

function __ZNSt3__215basic_streambufIcNS_11char_traitsIcEEE6setbufEPci($this, $0, $1) {
 $this = $this | 0;
 $0 = $0 | 0;
 $1 = $1 | 0;
 return $this | 0;
}

function __ZL25default_terminate_handlerv() {
 if ((asyncState | 0) != 2) {
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1178604 | 0);
}

function __Z27vehicle_save_menu_interruptv() {
 var $$0 = 0;
 if (!(HEAP8[94962] | 0)) $$0 = 0; else {
  HEAP8[94962] = 0;
  $$0 = 1;
 }
 return $$0 | 0;
}

function __GLOBAL__sub_I_teleportation_cpp() {
 if ((asyncState | 0) != 2) {
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 564944 | 0);
}

function __ZNSt3__27codecvtIwc11__mbstate_tED0Ev($this) {
 $this = $this | 0;
 __ZNSt3__27codecvtIwc11__mbstate_tED2Ev($this);
 __ZdlPv($this);
 return;
}

function establishStackSpace(stackBase, stackMax) {
 stackBase = stackBase | 0;
 stackMax = stackMax | 0;
 STACKTOP = stackBase;
 STACK_MAX = stackMax;
}

function __GLOBAL__sub_I_vehmodmenu_cpp() {
 if ((asyncState | 0) != 2) {
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1074336 | 0);
}

function __Z24skin_save_menu_interruptv() {
 var $$0 = 0;
 if (!(HEAP8[94925] | 0)) $$0 = 0; else {
  HEAP8[94925] = 0;
  $$0 = 1;
 }
 return $$0 | 0;
}

function __GLOBAL__sub_I_paintmenu_cpp() {
 if ((asyncState | 0) != 2) {
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 456004 | 0);
}

function __GLOBAL__sub_I_weapons_cpp() {
 if ((asyncState | 0) != 2) {
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 149456 | 0);
}

function _catgets($catd, $set_id, $msg_id, $s) {
 $catd = $catd | 0;
 $set_id = $set_id | 0;
 $msg_id = $msg_id | 0;
 $s = $s | 0;
 return $s | 0;
}

function __ZNKSt3__221__basic_string_commonILb1EE20__throw_out_of_rangeEv($this) {
 $this = $this | 0;
 ___assert_fail(83172, 83093, 1194, 83201);
}

function __ZNKSt3__221__basic_string_commonILb1EE20__throw_length_errorEv($this) {
 $this = $this | 0;
 ___assert_fail(83064, 83093, 1183, 83151);
}

function __ZN8MenuItemINSt3__212basic_stringIcNS0_11char_traitsIcEENS0_9allocatorIcEEEEE16handleRightPressEv($this) {
 $this = $this | 0;
 return;
}

function __Z19onconfirm_exit_menu8MenuItemIiE($choice) {
 $choice = $choice | 0;
 if (HEAP32[21543] | 0) return 0;
 _system(22991) | 0;
 return 0;
}

function __GLOBAL__sub_I_anims_cpp() {
 if ((asyncState | 0) != 2) {
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1214708 | 0);
}

function dynCall_iii(index, a1, a2) {
 index = index | 0;
 a1 = a1 | 0;
 a2 = a2 | 0;
 return FUNCTION_TABLE_iii[index & 31](a1 | 0, a2 | 0) | 0;
}

function __ZN8MenuItemINSt3__212basic_stringIcNS0_11char_traitsIcEENS0_9allocatorIcEEEEE15handleLeftPressEv($this) {
 $this = $this | 0;
 return;
}

function __GLOBAL__sub_I_skins_cpp() {
 if ((asyncState | 0) != 2) {
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 786612 | 0);
}

function _wctomb($s, $wc) {
 $s = $s | 0;
 $wc = $wc | 0;
 var $$0 = 0;
 if (!$s) $$0 = 0; else $$0 = _wcrtomb($s, $wc, 0) | 0;
 return $$0 | 0;
}

function __ZNKSt3__220__vector_base_commonILb1EE20__throw_out_of_rangeEv($this) {
 $this = $this | 0;
 ___assert_fail(82984, 82926, 315, 83201);
}

function __ZNKSt3__220__vector_base_commonILb1EE20__throw_length_errorEv($this) {
 $this = $this | 0;
 ___assert_fail(82903, 82926, 304, 83151);
}

function b8(p0, p1, p2, p3, p4, p5) {
 p0 = p0 | 0;
 p1 = p1 | 0;
 p2 = p2 | 0;
 p3 = p3 | 0;
 p4 = p4 | 0;
 p5 = p5 | 0;
 abort(8);
 return 0;
}

function __GLOBAL__sub_I_vehicles_cpp() {
 if ((asyncState | 0) != 2) {
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 0 | 0);
}

function __ZN14ToggleMenuItemIiE16get_toggle_valueEv($this) {
 $this = $this | 0;
 return (HEAP8[HEAP32[$this + 32 >> 2] >> 0] | 0) != 0 | 0;
}

function __Z15update_featuresv() {
 if ((asyncState | 0) != 2) {
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 489248 | 0);
}

function b4(p0, p1, p2, p3, p4, p5) {
 p0 = p0 | 0;
 p1 = p1 | 0;
 p2 = p2 | 0;
 p3 = p3 | 0;
 p4 = p4 | 0;
 p5 = +p5;
 abort(4);
 return 0;
}

function __ZNSt3__29money_putIwNS_19ostreambuf_iteratorIwNS_11char_traitsIwEEEEED0Ev($this) {
 $this = $this | 0;
 __ZdlPv($this);
 return;
}

function __ZNSt3__29money_putIcNS_19ostreambuf_iteratorIcNS_11char_traitsIcEEEEED0Ev($this) {
 $this = $this | 0;
 __ZdlPv($this);
 return;
}

function __ZNSt3__29money_getIwNS_19istreambuf_iteratorIwNS_11char_traitsIwEEEEED0Ev($this) {
 $this = $this | 0;
 __ZdlPv($this);
 return;
}

function __ZNSt3__29money_getIcNS_19istreambuf_iteratorIcNS_11char_traitsIcEEEEED0Ev($this) {
 $this = $this | 0;
 __ZdlPv($this);
 return;
}

function __GLOBAL__I_000101() {
 if ((asyncState | 0) != 2) {
  if ((asyncState | 0) == 1) asyncState = 3;
 }
 emterpret(eb + 1228848 | 0);
}

function setThrew(threw, value) {
 threw = threw | 0;
 value = value | 0;
 if (!__THREW__) {
  __THREW__ = threw;
  threwValue = value;
 }
}

function __ZNSt3__28time_getIwNS_19istreambuf_iteratorIwNS_11char_traitsIwEEEEED0Ev($this) {
 $this = $this | 0;
 __ZdlPv($this);
 return;
}

function __ZNSt3__28time_getIcNS_19istreambuf_iteratorIcNS_11char_traitsIcEEEEED0Ev($this) {
 $this = $this | 0;
 __ZdlPv($this);
 return;
}

function __ZNSt3__27num_putIwNS_19ostreambuf_iteratorIwNS_11char_traitsIwEEEEED0Ev($this) {
 $this = $this | 0;
 __ZdlPv($this);
 return;
}

function __ZNSt3__27num_putIcNS_19ostreambuf_iteratorIcNS_11char_traitsIcEEEEED0Ev($this) {
 $this = $this | 0;
 __ZdlPv($this);
 return;
}

function __ZNSt3__27num_getIwNS_19istreambuf_iteratorIwNS_11char_traitsIwEEEEED0Ev($this) {
 $this = $this | 0;
 __ZdlPv($this);
 return;
}

function __ZNSt3__27num_getIcNS_19istreambuf_iteratorIcNS_11char_traitsIcEEEEED0Ev($this) {
 $this = $this | 0;
 __ZdlPv($this);
 return;
}

function __ZNKSt3__28time_getIwNS_19istreambuf_iteratorIwNS_11char_traitsIwEEEEE13do_date_orderEv($this) {
 $this = $this | 0;
 return 2;
}

function __ZNKSt3__28time_getIcNS_19istreambuf_iteratorIcNS_11char_traitsIcEEEEE13do_date_orderEv($this) {
 $this = $this | 0;
 return 2;
}

function __ZNSt3__215basic_streambufIwNS_11char_traitsIwEEE5imbueERKNS_6localeE($this, $0) {
 $this = $this | 0;
 $0 = $0 | 0;
 return;
}

function __ZNSt3__215basic_streambufIcNS_11char_traitsIcEEE5imbueERKNS_6localeE($this, $0) {
 $this = $this | 0;
 $0 = $0 | 0;
 return;
}

function __ZN13ERDatabaseKVS19populate_saved_skinEP14SavedSkinDBRow($this, $entry) {
 $this = $this | 0;
 $entry = $entry | 0;
 return;
}

function dynCall_vii(index, a1, a2) {
 index = index | 0;
 a1 = a1 | 0;
 a2 = a2 | 0;
 FUNCTION_TABLE_vii[index & 63](a1 | 0, a2 | 0);
}

function b2(p0, p1, p2, p3, p4, p5) {
 p0 = p0 | 0;
 p1 = p1 | 0;
 p2 = p2 | 0;
 p3 = p3 | 0;
 p4 = p4 | 0;
 p5 = p5 | 0;
 abort(2);
}

function _mbsinit($st) {
 $st = $st | 0;
 var $4 = 0;
 if (!$st) $4 = 1; else $4 = (HEAP32[$st >> 2] | 0) == 0;
 return $4 & 1 | 0;
}

function _mbrlen($s, $n, $st) {
 $s = $s | 0;
 $n = $n | 0;
 $st = $st | 0;
 return _mbrtowc(0, $s, $n, $st | 0 ? $st : 91356) | 0;
}

function __ZNSt3__215basic_streambufIwNS_11char_traitsIwEEE9pbackfailEj($this, $0) {
 $this = $this | 0;
 $0 = $0 | 0;
 return -1;
}

function __ZNSt3__215basic_streambufIcNS_11char_traitsIcEEE9pbackfailEi($this, $0) {
 $this = $this | 0;
 $0 = $0 | 0;
 return -1;
}

function _do_read($f, $buf, $len) {
 $f = $f | 0;
 $buf = $buf | 0;
 $len = $len | 0;
 return ___string_read($f, $buf, $len) | 0;
}

function __ZNSt3__215basic_streambufIwNS_11char_traitsIwEEE8overflowEj($this, $0) {
 $this = $this | 0;
 $0 = $0 | 0;
 return -1;
}

function __ZNSt3__215basic_streambufIcNS_11char_traitsIcEEE8overflowEi($this, $0) {
 $this = $this | 0;
 $0 = $0 | 0;
 return -1;
}

function __ZNKSt3__219__shared_weak_count13__get_deleterERKSt9type_info($this, $0) {
 $this = $this | 0;
 $0 = $0 | 0;
 return 0;
}

function b17(p0, p1, p2, p3, p4) {
 p0 = p0 | 0;
 p1 = p1 | 0;
 p2 = p2 | 0;
 p3 = p3 | 0;
 p4 = p4 | 0;
 abort(17);
 return 0;
}

function __ZNSt3__28numpunctIwED0Ev($this) {
 $this = $this | 0;
 __ZNSt3__28numpunctIwED2Ev($this);
 __ZdlPv($this);
 return;
}

function __ZNSt3__28numpunctIcED0Ev($this) {
 $this = $this | 0;
 __ZNSt3__28numpunctIcED2Ev($this);
 __ZdlPv($this);
 return;
}

function __ZN13ERDatabaseKVS29delete_saved_vehicle_childrenEi($this, $slot) {
 $this = $this | 0;
 $slot = $slot | 0;
 return;
}

function __ZNSt16invalid_argumentD0Ev($this) {
 $this = $this | 0;
 __ZNSt11logic_errorD2Ev($this);
 __ZdlPv($this);
 return;
}

function b16(p0, p1, p2, p3, p4) {
 p0 = p0 | 0;
 p1 = p1 | 0;
 p2 = p2 | 0;
 p3 = p3 | 0;
 p4 = +p4;
 abort(16);
 return 0;
}

function _srand($s) {
 $s = $s | 0;
 var $1 = 0;
 $1 = 84024;
 HEAP32[$1 >> 2] = $s + -1;
 HEAP32[$1 + 4 >> 2] = 0;
 return;
}

function __ZNSt3__214basic_iostreamIcNS_11char_traitsIcEEED2Ev($this, $vtt) {
 $this = $this | 0;
 $vtt = $vtt | 0;
 return;
}

function __ZN14comma_numpunctD0Ev($this) {
 $this = $this | 0;
 __ZNSt3__28numpunctIcED2Ev($this);
 __ZdlPv($this);
 return;
}

function __ZNSt3__213basic_ostreamIcNS_11char_traitsIcEEED2Ev($this, $vtt) {
 $this = $this | 0;
 $vtt = $vtt | 0;
 return;
}

function __ZN13ERDatabaseKVS26delete_saved_skin_childrenEi($this, $slot) {
 $this = $this | 0;
 $slot = $slot | 0;
 return;
}

function __ZNSt3__29money_putIwNS_19ostreambuf_iteratorIwNS_11char_traitsIwEEEEED2Ev($this) {
 $this = $this | 0;
 return;
}

function __ZNSt3__29money_putIcNS_19ostreambuf_iteratorIcNS_11char_traitsIcEEEEED2Ev($this) {
 $this = $this | 0;
 return;
}

function __ZNSt3__29money_getIwNS_19istreambuf_iteratorIwNS_11char_traitsIwEEEEED2Ev($this) {
 $this = $this | 0;
 return;
}

function __ZNSt3__29money_getIcNS_19istreambuf_iteratorIcNS_11char_traitsIcEEEEED2Ev($this) {
 $this = $this | 0;
 return;
}

function __ZNSt3__28time_getIwNS_19istreambuf_iteratorIwNS_11char_traitsIwEEEEED2Ev($this) {
 $this = $this | 0;
 return;
}

function __ZNSt3__28time_getIcNS_19istreambuf_iteratorIcNS_11char_traitsIcEEEEED2Ev($this) {
 $this = $this | 0;
 return;
}

function __ZNSt12out_of_rangeD0Ev($this) {
 $this = $this | 0;
 __ZNSt11logic_errorD2Ev($this);
 __ZdlPv($this);
 return;
}

function __ZNSt12domain_errorD0Ev($this) {
 $this = $this | 0;
 __ZNSt11logic_errorD2Ev($this);
 __ZdlPv($this);
 return;
}

function __ZNSt3__27num_putIwNS_19ostreambuf_iteratorIwNS_11char_traitsIwEEEEED2Ev($this) {
 $this = $this | 0;
 return;
}

function __ZNSt3__27num_putIcNS_19ostreambuf_iteratorIcNS_11char_traitsIcEEEEED2Ev($this) {
 $this = $this | 0;
 return;
}

function __ZNSt3__27num_getIwNS_19istreambuf_iteratorIwNS_11char_traitsIwEEEEED2Ev($this) {
 $this = $this | 0;
 return;
}

function __ZNSt3__27num_getIcNS_19istreambuf_iteratorIcNS_11char_traitsIcEEEEED2Ev($this) {
 $this = $this | 0;
 return;
}

function __ZNSt3__25ctypeIcED0Ev($this) {
 $this = $this | 0;
 __ZNSt3__25ctypeIcED2Ev($this);
 __ZdlPv($this);
 return;
}

function __ZNSt11logic_errorD0Ev($this) {
 $this = $this | 0;
 __ZNSt11logic_errorD2Ev($this);
 __ZdlPv($this);
 return;
}

function dynCall_ii(index, a1) {
 index = index | 0;
 a1 = a1 | 0;
 return FUNCTION_TABLE_ii[index & 255](a1 | 0) | 0;
}

function __ZNKSt3__28numpunctIwE16do_thousands_sepEv($this) {
 $this = $this | 0;
 return HEAP32[$this + 12 >> 2] | 0;
}

function __ZNKSt3__28numpunctIwE16do_decimal_pointEv($this) {
 $this = $this | 0;
 return HEAP32[$this + 8 >> 2] | 0;
}

function __ZN13ERDatabaseKVS20delete_saved_vehicleEi($this, $slot) {
 $this = $this | 0;
 $slot = $slot | 0;
 return;
}

function __ZNKSt3__28numpunctIcE16do_thousands_sepEv($this) {
 $this = $this | 0;
 return HEAP8[$this + 9 >> 0] | 0;
}

function __ZNKSt3__28numpunctIcE16do_decimal_pointEv($this) {
 $this = $this | 0;
 return HEAP8[$this + 8 >> 0] | 0;
}

function __GLOBAL__sub_I_menu_functions_cpp() {
 HEAP32[21183] = 0;
 HEAP32[21184] = 0;
 HEAP32[21185] = 0;
 return;
}

function __ZSt15get_new_handlerv() {
 var $0 = 0;
 $0 = HEAP32[23707] | 0;
 HEAP32[23707] = $0 + 0;
 return $0 | 0;
}

function __ZNKSt3__25ctypeIwE8do_widenEc($this, $c) {
 $this = $this | 0;
 $c = $c | 0;
 return $c << 24 >> 24 | 0;
}

function b3(p0, p1, p2, p3, p4) {
 p0 = p0 | 0;
 p1 = p1 | 0;
 p2 = p2 | 0;
 p3 = p3 | 0;
 p4 = p4 | 0;
 abort(3);
}

function __ZN13ERDatabaseKVS17delete_saved_skinEi($this, $slot) {
 $this = $this | 0;
 $slot = $slot | 0;
 return;
}

function __Z25set_periodic_feature_callPFvvE($method) {
 $method = $method | 0;
 HEAP32[21187] = $method;
 return;
}

function __ZNSt3__215basic_streambufIwNS_11char_traitsIwEEE9underflowEv($this) {
 $this = $this | 0;
 return -1;
}

function __ZNSt3__215basic_streambufIcNS_11char_traitsIcEEE9underflowEv($this) {
 $this = $this | 0;
 return -1;
}

function __ZNSt3__215basic_streambufIwNS_11char_traitsIwEEE9showmanycEv($this) {
 $this = $this | 0;
 return 0;
}

function __ZNSt3__215basic_streambufIcNS_11char_traitsIcEEE9showmanycEv($this) {
 $this = $this | 0;
 return 0;
}

function b13(p0, p1, p2, p3) {
 p0 = p0 | 0;
 p1 = p1 | 0;
 p2 = p2 | 0;
 p3 = p3 | 0;
 abort(13);
 return 0;
}

function __ZNKSt3__210moneypunctIwLb1EE16do_thousands_sepEv($this) {
 $this = $this | 0;
 return 2147483647;
}

function __ZNKSt3__210moneypunctIwLb1EE16do_decimal_pointEv($this) {
 $this = $this | 0;
 return 2147483647;
}

function __ZNKSt3__210moneypunctIwLb0EE16do_thousands_sepEv($this) {
 $this = $this | 0;
 return 2147483647;
}

function __ZNKSt3__210moneypunctIwLb0EE16do_decimal_pointEv($this) {
 $this = $this | 0;
 return 2147483647;
}

function __Z16set_menu_showingb($showing) {
 $showing = $showing | 0;
 HEAP8[94835] = $showing & 1;
 return;
}

function dynCall_vi(index, a1) {
 index = index | 0;
 a1 = a1 | 0;
 FUNCTION_TABLE_vi[index & 255](a1 | 0);
}

function __ZN16WantedSymbolItemIiE29isAbsorbingLeftAndRightEventsEv($this) {
 $this = $this | 0;
 return 1;
}

function __ZN10__cxxabiv121__vmi_class_type_infoD0Ev($this) {
 $this = $this | 0;
 __ZdlPv($this);
 return;
}

function __ZNSt3__215basic_streambufIwNS_11char_traitsIwEEE4syncEv($this) {
 $this = $this | 0;
 return 0;
}

function __ZNSt3__215basic_streambufIcNS_11char_traitsIcEEE4syncEv($this) {
 $this = $this | 0;
 return 0;
}

function __ZNKSt3__27codecvtIDsc11__mbstate_tE16do_always_noconvEv($this) {
 $this = $this | 0;
 return 0;
}

function __ZNKSt3__27codecvtIDic11__mbstate_tE16do_always_noconvEv($this) {
 $this = $this | 0;
 return 0;
}

function __ZN10__cxxabiv120__si_class_type_infoD0Ev($this) {
 $this = $this | 0;
 __ZdlPv($this);
 return;
}

function __Z32onexit_skinchanger_drawable_menub($returnValue) {
 $returnValue = $returnValue | 0;
 return;
}

function __ZNKSt3__28messagesIwE8do_closeEi($this, $__c) {
 $this = $this | 0;
 $__c = $__c | 0;
 return;
}

function __ZNKSt3__28messagesIcE8do_closeEi($this, $__c) {
 $this = $this | 0;
 $__c = $__c | 0;
 return;
}

function __ZNKSt3__27codecvtIwc11__mbstate_tE16do_always_noconvEv($this) {
 $this = $this | 0;
 return 0;
}

function __ZNKSt3__27codecvtIcc11__mbstate_tE16do_always_noconvEv($this) {
 $this = $this | 0;
 return 1;
}

function __Z35onhighlight_skinchanger_detail_menu8MenuItemIiE($choice) {
 $choice = $choice | 0;
 return;
}

function __Z31onexit_skinchanger_texture_menub($returnValue) {
 $returnValue = $returnValue | 0;
 return;
}

function __ZNSt3__27codecvtIDsc11__mbstate_tED0Ev($this) {
 $this = $this | 0;
 __ZdlPv($this);
 return;
}

function __ZNSt3__27codecvtIDic11__mbstate_tED0Ev($this) {
 $this = $this | 0;
 __ZdlPv($this);
 return;
}

function __ZNSt3__217__widen_from_utf8ILj32EED0Ev($this) {
 $this = $this | 0;
 __ZdlPv($this);
 return;
}

function _cleanup_522($p) {
 $p = $p | 0;
 if (!(HEAP32[$p + 68 >> 2] | 0)) ___unlockfile($p);
 return;
}

function _cleanup_517($p) {
 $p = $p | 0;
 if (!(HEAP32[$p + 68 >> 2] | 0)) ___unlockfile($p);
 return;
}

function __ZNSt3__27codecvtIcc11__mbstate_tED0Ev($this) {
 $this = $this | 0;
 __ZdlPv($this);
 return;
}

function __ZNSt3__216__narrow_to_utf8ILj32EED0Ev($this) {
 $this = $this | 0;
 __ZdlPv($this);
 return;
}

function __ZNKSt3__27codecvtIDsc11__mbstate_tE13do_max_lengthEv($this) {
 $this = $this | 0;
 return 4;
}

function __ZNKSt3__27codecvtIDic11__mbstate_tE13do_max_lengthEv($this) {
 $this = $this | 0;
 return 4;
}

function __ZNKSt3__25ctypeIcE8do_widenEc($this, $c) {
 $this = $this | 0;
 $c = $c | 0;
 return $c | 0;
}

function __ZN10__cxxabiv117__class_type_infoD0Ev($this) {
 $this = $this | 0;
 __ZdlPv($this);
 return;
}

function __ZNKSt3__27codecvtIcc11__mbstate_tE13do_max_lengthEv($this) {
 $this = $this | 0;
 return 1;
}

function __ZNKSt3__27codecvtIDsc11__mbstate_tE11do_encodingEv($this) {
 $this = $this | 0;
 return 0;
}

function __ZNKSt3__27codecvtIDic11__mbstate_tE11do_encodingEv($this) {
 $this = $this | 0;
 return 0;
}

function __ZNKSt3__210moneypunctIcLb1EE16do_thousands_sepEv($this) {
 $this = $this | 0;
 return 127;
}

function __ZNKSt3__210moneypunctIcLb1EE16do_decimal_pointEv($this) {
 $this = $this | 0;
 return 127;
}

function __ZNKSt3__210moneypunctIcLb0EE16do_thousands_sepEv($this) {
 $this = $this | 0;
 return 127;
}

function __ZNKSt3__210moneypunctIcLb0EE16do_decimal_pointEv($this) {
 $this = $this | 0;
 return 127;
}

function __ZNKSt11logic_error4whatEv($this) {
 $this = $this | 0;
 return HEAP32[$this + 4 >> 2] | 0;
}

function __ZNKSt3__27codecvtIcc11__mbstate_tE11do_encodingEv($this) {
 $this = $this | 0;
 return 1;
}

function b14(p0, p1, p2, p3) {
 p0 = p0 | 0;
 p1 = p1 | 0;
 p2 = p2 | 0;
 p3 = p3 | 0;
 abort(14);
}

function __ZN8MenuItemIiE29isAbsorbingLeftAndRightEventsEv($this) {
 $this = $this | 0;
 return 0;
}

function _isspace($c) {
 $c = $c | 0;
 return (($c | 0) == 32 | ($c + -9 | 0) >>> 0 < 5) & 1 | 0;
}

function __ZNSt3__217bad_function_callD0Ev($this) {
 $this = $this | 0;
 __ZdlPv($this);
 return;
}

function __ZNSt3__210moneypunctIwLb1EED0Ev($this) {
 $this = $this | 0;
 __ZdlPv($this);
 return;
}

function __ZNSt3__210moneypunctIwLb0EED0Ev($this) {
 $this = $this | 0;
 __ZdlPv($this);
 return;
}

function __ZNSt3__210moneypunctIcLb1EED0Ev($this) {
 $this = $this | 0;
 __ZdlPv($this);
 return;
}

function __ZNSt3__210moneypunctIcLb0EED0Ev($this) {
 $this = $this | 0;
 __ZdlPv($this);
 return;
}

function __ZNKSt3__210moneypunctIwLb1EE14do_frac_digitsEv($this) {
 $this = $this | 0;
 return 0;
}

function __ZNKSt3__210moneypunctIwLb0EE14do_frac_digitsEv($this) {
 $this = $this | 0;
 return 0;
}

function __ZNKSt3__210moneypunctIcLb1EE14do_frac_digitsEv($this) {
 $this = $this | 0;
 return 0;
}

function __ZNKSt3__210moneypunctIcLb0EE14do_frac_digitsEv($this) {
 $this = $this | 0;
 return 0;
}

function _isdigit_l($c, $l) {
 $c = $c | 0;
 $l = $l | 0;
 return ($c + -48 | 0) >>> 0 < 10 | 0;
}

function __ZNSt9bad_allocC2Ev($this) {
 $this = $this | 0;
 HEAP32[$this >> 2] = 10468;
 return;
}

function _catopen($name, $oflag) {
 $name = $name | 0;
 $oflag = $oflag | 0;
 return -1 | 0;
}

function __ZNSt3__26locale5facetD0Ev($this) {
 $this = $this | 0;
 __ZdlPv($this);
 return;
}

function __ZNK14comma_numpunct16do_thousands_sepEv($this) {
 $this = $this | 0;
 return 44;
}

function dynCall_i(index) {
 index = index | 0;
 return FUNCTION_TABLE_i[index & 7]() | 0;
}

function __ZNSt3__28messagesIwED0Ev($this) {
 $this = $this | 0;
 __ZdlPv($this);
 return;
}

function __ZNSt3__28messagesIcED0Ev($this) {
 $this = $this | 0;
 __ZdlPv($this);
 return;
}

function __ZNK10__cxxabiv116__shim_type_info5noop2Ev($this) {
 $this = $this | 0;
 return;
}

function __ZNK10__cxxabiv116__shim_type_info5noop1Ev($this) {
 $this = $this | 0;
 return;
}

function b1(p0, p1, p2) {
 p0 = p0 | 0;
 p1 = p1 | 0;
 p2 = p2 | 0;
 abort(1);
 return 0;
}

function __ZNSt3__27collateIwED0Ev($this) {
 $this = $this | 0;
 __ZdlPv($this);
 return;
}

function __ZNSt3__27collateIcED0Ev($this) {
 $this = $this | 0;
 __ZdlPv($this);
 return;
}

function __Z16onconfirm_livery8MenuItemIiE($choice) {
 $choice = $choice | 0;
 return 1;
}

function __ZNSt3__25ctypeIwED0Ev($this) {
 $this = $this | 0;
 __ZdlPv($this);
 return;
}

function _isxdigit_l($c, $l) {
 $c = $c | 0;
 $l = $l | 0;
 return _isxdigit($c) | 0;
}

function __ZN10__cxxabiv116__shim_type_infoD2Ev($this) {
 $this = $this | 0;
 return;
}

function __ZNSt9bad_allocD0Ev($this) {
 $this = $this | 0;
 __ZdlPv($this);
 return;
}

function __ZN16WantedSymbolItemIiE9onConfirmEv($this) {
 $this = $this | 0;
 return;
}

function __ZN8MenuItemIiE16handleRightPressEv($this) {
 $this = $this | 0;
 return;
}

function _copysignl($x, $y) {
 $x = +$x;
 $y = +$y;
 return +(+_copysign($x, $y));
}

function __ZN8MenuItemIiE15handleLeftPressEv($this) {
 $this = $this | 0;
 return;
}

function _scalbnl($x, $n) {
 $x = +$x;
 $n = $n | 0;
 return +(+_scalbn($x, $n));
}

function __ZNSt3__221__throw_runtime_errorEPKc($msg) {
 $msg = $msg | 0;
 return;
}

function b10(p0, p1, p2) {
 p0 = p0 | 0;
 p1 = p1 | 0;
 p2 = p2 | 0;
 abort(10);
}

function __ZNSt3__210moneypunctIwLb1EED2Ev($this) {
 $this = $this | 0;
 return;
}

function __ZNSt3__210moneypunctIwLb0EED2Ev($this) {
 $this = $this | 0;
 return;
}

function __ZNSt3__210moneypunctIcLb1EED2Ev($this) {
 $this = $this | 0;
 return;
}

function __ZNSt3__210moneypunctIcLb0EED2Ev($this) {
 $this = $this | 0;
 return;
}

function __Z24weapon_reequip_interruptv() {
 return (HEAP8[96004] | 0) != 0 | 0;
}

function dynCall_v(index) {
 index = index | 0;
 FUNCTION_TABLE_v[index & 3]();
}

function _frexpl($x, $e) {
 $x = +$x;
 $e = $e | 0;
 return +(+_frexp($x, $e));
}

function __ZNSt3__214__shared_countD2Ev($this) {
 $this = $this | 0;
 return;
}

function __ZNKSt9exception4whatEv($this) {
 $this = $this | 0;
 return 83827;
}

function __ZNKSt9bad_alloc4whatEv($this) {
 $this = $this | 0;
 return 83812;
}

function __GLOBAL__sub_I_noclip_cpp() {
 _memset(84752, 0, 180) | 0;
 return;
}

function __ZN13ERDatabaseKVS4openEv($this) {
 $this = $this | 0;
 return 1;
}

function _fmodl($x, $y) {
 $x = +$x;
 $y = +$y;
 return +(+_fmod($x, $y));
}

function __ZNSt3__26locale5facetD2Ev($this) {
 $this = $this | 0;
 return;
}

function __ZN13ERDatabaseKVS5closeEv($this) {
 $this = $this | 0;
 return;
}

function b15(p0, p1) {
 p0 = p0 | 0;
 p1 = p1 | 0;
 abort(15);
 return 0;
}

function __ZNSt3__28messagesIwED2Ev($this) {
 $this = $this | 0;
 return;
}

function __ZNSt3__28messagesIcED2Ev($this) {
 $this = $this | 0;
 return;
}

function __ZNSt3__27collateIwED2Ev($this) {
 $this = $this | 0;
 return;
}

function __ZNSt3__27collateIcED2Ev($this) {
 $this = $this | 0;
 return;
}

function __Z15is_menu_showingv() {
 return (HEAP8[94835] | 0) != 0 | 0;
}

function setTempRet0(value) {
 value = value | 0;
 tempRet0 = value;
}

function __ZdaPv($ptr) {
 $ptr = $ptr | 0;
 __ZdlPv($ptr);
 return;
}

function __ZNSt9type_infoD2Ev($this) {
 $this = $this | 0;
 return;
}

function __ZNSt9exceptionD2Ev($this) {
 $this = $this | 0;
 return;
}

function __ZNSt9bad_allocD2Ev($this) {
 $this = $this | 0;
 return;
}

function __ZdlPv($ptr) {
 $ptr = $ptr | 0;
 _free($ptr);
 return;
}

function __ZNSt3__212__do_nothingEPv($0) {
 $0 = $0 | 0;
 return;
}

function __Z14clear_log_filev() {
 _remove(15312) | 0;
 return;
}

function stackRestore(top) {
 top = top | 0;
 STACKTOP = top;
}

function _freelocale($l) {
 $l = $l | 0;
 _free($l);
 return;
}

function b7(p0, p1) {
 p0 = p0 | 0;
 p1 = p1 | 0;
 abort(7);
}

function _pthread_cond_broadcast(x) {
 x = x | 0;
 return 0;
}

function emtStackRestore(x) {
 x = x | 0;
 EMTSTACKTOP = x;
}

function _pthread_mutex_unlock(x) {
 x = x | 0;
 return 0;
}

function _catclose($catd) {
 $catd = $catd | 0;
 return 0;
}

function ___cxa_guard_release($0) {
 $0 = $0 | 0;
 return;
}

function __Z12get_databasev() {
 return HEAP32[21461] | 0;
}

function setAsyncState(x) {
 x = x | 0;
 asyncState = x;
}

function _pthread_mutex_lock(x) {
 x = x | 0;
 return 0;
}

function b9(p0) {
 p0 = p0 | 0;
 abort(9);
 return 0;
}

function ___unlockfile($f) {
 $f = $f | 0;
 return;
}

function ___lockfile($f) {
 $f = $f | 0;
 return 0;
}

function __Z21noclip_switch_pressedv() {
 return 0;
}

function emtStackSave() {
 return EMTSTACKTOP | 0;
}

function __GLOBAL__sub_I_iostream_cpp() {
 return;
}

function ___ctype_toupper_loc() {
 return 5480;
}

function ___ctype_tolower_loc() {
 return 3940;
}

function __ZSt17__throw_bad_allocv() {
 return;
}

function getTempRet0() {
 return tempRet0 | 0;
}

function stackSave() {
 return STACKTOP | 0;
}

function b6(p0) {
 p0 = p0 | 0;
 abort(6);
}

function __Z14update_actionsv() {
 return;
}

function ___ctype_b_loc() {
 return 3936;
}

function b5() {
 abort(5);
 return 0;
}

function _pthread_self() {
 return 0;
}

function b11() {
 abort(11);
}

// EMSCRIPTEN_END_FUNCS

var FUNCTION_TABLE_iiiiiiii = [b0,__ZNKSt3__28time_putIcNS_19ostreambuf_iteratorIcNS_11char_traitsIcEEEEE6do_putES4_RNS_8ios_baseEcPK2tmcc,__ZNKSt3__28time_putIwNS_19ostreambuf_iteratorIwNS_11char_traitsIwEEEEE6do_putES4_RNS_8ios_baseEwPK2tmcc,__ZNKSt3__29money_getIcNS_19istreambuf_iteratorIcNS_11char_traitsIcEEEEE6do_getES4_S4_bRNS_8ios_baseERjRe,__ZNKSt3__29money_getIcNS_19istreambuf_iteratorIcNS_11char_traitsIcEEEEE6do_getES4_S4_bRNS_8ios_baseERjRNS_12basic_stringIcS3_NS_9allocatorIcEEEE,__ZNKSt3__29money_getIwNS_19istreambuf_iteratorIwNS_11char_traitsIwEEEEE6do_getES4_S4_bRNS_8ios_baseERjRe,__ZNKSt3__29money_getIwNS_19istreambuf_iteratorIwNS_11char_traitsIwEEEEE6do_getES4_S4_bRNS_8ios_baseERjRNS_12basic_stringIwS3_NS_9allocatorIwEEEE,b0];
var FUNCTION_TABLE_iiii = [b1,__ZNSt3__215basic_streambufIcNS_11char_traitsIcEEE6setbufEPci,__ZNSt3__215basic_streambufIcNS_11char_traitsIcEEE6xsgetnEPci,__ZNSt3__215basic_streambufIcNS_11char_traitsIcEEE6xsputnEPKci,___stdio_write,___stdio_seek,___stdio_read,___stdout_write,_sn_write,__ZNSt3__215basic_streambufIwNS_11char_traitsIwEEE6setbufEPwi,__ZNSt3__215basic_streambufIwNS_11char_traitsIwEEE6xsgetnEPwi,__ZNSt3__215basic_streambufIwNS_11char_traitsIwEEE6xsputnEPKwi,__ZNSt3__211__stdoutbufIcE6xsputnEPKci,__ZNSt3__211__stdoutbufIwE6xsputnEPKwi,__ZNKSt3__27collateIcE7do_hashEPKcS3_,__ZNKSt3__27collateIwE7do_hashEPKwS3_,__ZNKSt3__28messagesIcE7do_openERKNS_12basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEERKNS_6localeE,__ZNKSt3__28messagesIwE7do_openERKNS_12basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEERKNS_6localeE,__ZNKSt3__25ctypeIcE10do_toupperEPcPKc,__ZNKSt3__25ctypeIcE10do_tolowerEPcPKc,__ZNKSt3__25ctypeIcE9do_narrowEcc,__ZNKSt3__25ctypeIwE5do_isEtw,__ZNKSt3__25ctypeIwE10do_toupperEPwPKw,__ZNKSt3__25ctypeIwE10do_tolowerEPwPKw,__ZNKSt3__25ctypeIwE9do_narrowEwc,__ZNK10__cxxabiv117__class_type_info9can_catchEPKNS_16__shim_type_infoERPv,_do_read,b1,b1
,b1,b1,b1];
var FUNCTION_TABLE_viiiiii = [b2,__ZNSt3__215basic_stringbufIcNS_11char_traitsIcEENS_9allocatorIcEEE7seekoffExNS_8ios_base7seekdirEj,__ZNSt3__215basic_streambufIcNS_11char_traitsIcEEE7seekoffExNS_8ios_base7seekdirEj,__ZNSt3__215basic_streambufIwNS_11char_traitsIwEEE7seekoffExNS_8ios_base7seekdirEj,__ZNKSt3__28messagesIcE6do_getEiiiRKNS_12basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEE,__ZNKSt3__28messagesIwE6do_getEiiiRKNS_12basic_stringIwNS_11char_traitsIwEENS_9allocatorIwEEEE,__ZNK10__cxxabiv117__class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib,__ZNK10__cxxabiv120__si_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib,__ZNK10__cxxabiv121__vmi_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib,b2,b2,b2,b2,b2,b2,b2];
var FUNCTION_TABLE_viiiii = [b3,__ZNK10__cxxabiv117__class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib,__ZNK10__cxxabiv120__si_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib,__ZNK10__cxxabiv121__vmi_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib];
var FUNCTION_TABLE_iiiiiid = [b4,__ZNKSt3__29money_putIcNS_19ostreambuf_iteratorIcNS_11char_traitsIcEEEEE6do_putES4_bRNS_8ios_baseEce,__ZNKSt3__29money_putIwNS_19ostreambuf_iteratorIwNS_11char_traitsIwEEEEE6do_putES4_bRNS_8ios_baseEwe,b4];
var FUNCTION_TABLE_i = [b5,__Z22vehicle_menu_interruptv,__Z24skin_save_menu_interruptv,__Z29skin_save_slot_menu_interruptv,__Z27vehicle_save_menu_interruptv,__Z32vehicle_save_slot_menu_interruptv,__Z24weapon_reequip_interruptv,b5];
var FUNCTION_TABLE_vi = [b6,__ZNSt3__218basic_stringstreamIcNS_11char_traitsIcEENS_9allocatorIcEEED1Ev,__ZNSt3__218basic_stringstreamIcNS_11char_traitsIcEENS_9allocatorIcEEED0Ev,__ZThn8_NSt3__218basic_stringstreamIcNS_11char_traitsIcEENS_9allocatorIcEEED1Ev,__ZThn8_NSt3__218basic_stringstreamIcNS_11char_traitsIcEENS_9allocatorIcEEED0Ev,__ZTv0_n12_NSt3__218basic_stringstreamIcNS_11char_traitsIcEENS_9allocatorIcEEED1Ev,__ZTv0_n12_NSt3__218basic_stringstreamIcNS_11char_traitsIcEENS_9allocatorIcEEED0Ev,__ZNSt3__215basic_stringbufIcNS_11char_traitsIcEENS_9allocatorIcEEED2Ev,__ZNSt3__215basic_stringbufIcNS_11char_traitsIcEENS_9allocatorIcEEED0Ev,__ZNSt3__214basic_iostreamIcNS_11char_traitsIcEEED1Ev,__ZNSt3__214basic_iostreamIcNS_11char_traitsIcEEED0Ev,__ZThn8_NSt3__214basic_iostreamIcNS_11char_traitsIcEEED1Ev,__ZThn8_NSt3__214basic_iostreamIcNS_11char_traitsIcEEED0Ev,__ZTv0_n12_NSt3__214basic_iostreamIcNS_11char_traitsIcEEED1Ev,__ZTv0_n12_NSt3__214basic_iostreamIcNS_11char_traitsIcEEED0Ev,__ZNSt3__213basic_istreamIcNS_11char_traitsIcEEED1Ev,__ZNSt3__213basic_istreamIcNS_11char_traitsIcEEED0Ev,__ZTv0_n12_NSt3__213basic_istreamIcNS_11char_traitsIcEEED1Ev,__ZTv0_n12_NSt3__213basic_istreamIcNS_11char_traitsIcEEED0Ev,__ZN8MenuItemIiED2Ev,__ZN8MenuItemIiED0Ev,__ZN8MenuItemIiE9onConfirmEv,__ZN8MenuItemIiE15handleLeftPressEv,__ZN8MenuItemIiE16handleRightPressEv,__ZNSt3__220__shared_ptr_emplaceI8MenuItemIiENS_9allocatorIS2_EEED2Ev,__ZNSt3__220__shared_ptr_emplaceI8MenuItemIiENS_9allocatorIS2_EEED0Ev,__ZNSt3__220__shared_ptr_emplaceI8MenuItemIiENS_9allocatorIS2_EEE16__on_zero_sharedEv,__ZNSt3__220__shared_ptr_emplaceI8MenuItemIiENS_9allocatorIS2_EEE21__on_zero_shared_weakEv,__ZNSt3__213basic_ostreamIcNS_11char_traitsIcEEED1Ev
,__ZNSt3__213basic_ostreamIcNS_11char_traitsIcEEED0Ev,__ZTv0_n12_NSt3__213basic_ostreamIcNS_11char_traitsIcEEED1Ev,__ZTv0_n12_NSt3__213basic_ostreamIcNS_11char_traitsIcEEED0Ev,__ZNSt3__219basic_ostringstreamIcNS_11char_traitsIcEENS_9allocatorIcEEED1Ev,__ZNSt3__219basic_ostringstreamIcNS_11char_traitsIcEENS_9allocatorIcEEED0Ev,__ZTv0_n12_NSt3__219basic_ostringstreamIcNS_11char_traitsIcEENS_9allocatorIcEEED1Ev,__ZTv0_n12_NSt3__219basic_ostringstreamIcNS_11char_traitsIcEENS_9allocatorIcEEED0Ev,__ZN13ERDatabaseKVSD2Ev,__ZN13ERDatabaseKVSD0Ev,__ZN13ERDatabaseKVS5closeEv,__ZNSt9exceptionD2Ev,__ZNSt3__217bad_function_callD0Ev,__ZN14ToggleMenuItemIiED0Ev,__ZN14ToggleMenuItemIiE9onConfirmEv,__ZNSt3__220__shared_ptr_emplaceI14ToggleMenuItemIiENS_9allocatorIS2_EEED2Ev,__ZNSt3__220__shared_ptr_emplaceI14ToggleMenuItemIiENS_9allocatorIS2_EEED0Ev,__ZNSt3__220__shared_ptr_emplaceI14ToggleMenuItemIiENS_9allocatorIS2_EEE16__on_zero_sharedEv,__ZNSt3__220__shared_ptr_emplaceI14ToggleMenuItemIiENS_9allocatorIS2_EEE21__on_zero_shared_weakEv,__ZN16WantedSymbolItemIiED0Ev,__ZN16WantedSymbolItemIiE9onConfirmEv,__ZN16WantedSymbolItemIiE15handleLeftPressEv,__ZN16WantedSymbolItemIiE16handleRightPressEv,__ZNSt3__220__shared_ptr_emplaceI16WantedSymbolItemIiENS_9allocatorIS2_EEED2Ev,__ZNSt3__220__shared_ptr_emplaceI16WantedSymbolItemIiENS_9allocatorIS2_EEED0Ev,__ZNSt3__220__shared_ptr_emplaceI16WantedSymbolItemIiENS_9allocatorIS2_EEE16__on_zero_sharedEv,__ZNSt3__220__shared_ptr_emplaceI16WantedSymbolItemIiENS_9allocatorIS2_EEE21__on_zero_shared_weakEv,__ZN8MenuItemINSt3__212basic_stringIcNS0_11char_traitsIcEENS0_9allocatorIcEEEEED2Ev,__ZN14ToggleMenuItemINSt3__212basic_stringIcNS0_11char_traitsIcEENS0_9allocatorIcEEEEED0Ev,__ZN14ToggleMenuItemINSt3__212basic_stringIcNS0_11char_traitsIcEENS0_9allocatorIcEEEEE9onConfirmEv,__ZN8MenuItemINSt3__212basic_stringIcNS0_11char_traitsIcEENS0_9allocatorIcEEEEE15handleLeftPressEv
,__ZN8MenuItemINSt3__212basic_stringIcNS0_11char_traitsIcEENS0_9allocatorIcEEEEE16handleRightPressEv,__ZN8MenuItemINSt3__212basic_stringIcNS0_11char_traitsIcEENS0_9allocatorIcEEEEED0Ev,__ZN8MenuItemINSt3__212basic_stringIcNS0_11char_traitsIcEENS0_9allocatorIcEEEEE9onConfirmEv,__ZNSt3__220__shared_ptr_emplaceI14ToggleMenuItemINS_12basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEEENS5_IS8_EEED2Ev,__ZNSt3__220__shared_ptr_emplaceI14ToggleMenuItemINS_12basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEEENS5_IS8_EEED0Ev,__ZNSt3__220__shared_ptr_emplaceI14ToggleMenuItemINS_12basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEEENS5_IS8_EEE16__on_zero_sharedEv,__ZNSt3__220__shared_ptr_emplaceI14ToggleMenuItemINS_12basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEEENS5_IS8_EEE21__on_zero_shared_weakEv,__ZNSt3__220__shared_ptr_emplaceI8MenuItemINS_12basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEEENS5_IS8_EEED2Ev,__ZNSt3__220__shared_ptr_emplaceI8MenuItemINS_12basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEEENS5_IS8_EEED0Ev,__ZNSt3__220__shared_ptr_emplaceI8MenuItemINS_12basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEEENS5_IS8_EEE16__on_zero_sharedEv,__ZNSt3__220__shared_ptr_emplaceI8MenuItemINS_12basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEEENS5_IS8_EEE21__on_zero_shared_weakEv,__ZNSt3__28numpunctIcED2Ev,__ZN14comma_numpunctD0Ev,__ZNSt3__26locale5facet16__on_zero_sharedEv,__ZN28FunctionDrivenToggleMenuItemIiED2Ev,__ZN28FunctionDrivenToggleMenuItemIiED0Ev,__ZN28FunctionDrivenToggleMenuItemIiE9onConfirmEv,__ZNSt3__220__shared_ptr_emplaceI28FunctionDrivenToggleMenuItemIiENS_9allocatorIS2_EEED2Ev,__ZNSt3__220__shared_ptr_emplaceI28FunctionDrivenToggleMenuItemIiENS_9allocatorIS2_EEED0Ev,__ZNSt3__220__shared_ptr_emplaceI28FunctionDrivenToggleMenuItemIiENS_9allocatorIS2_EEE16__on_zero_sharedEv,__ZNSt3__220__shared_ptr_emplaceI28FunctionDrivenToggleMenuItemIiENS_9allocatorIS2_EEE21__on_zero_shared_weakEv,__ZNSt3__28ios_baseD2Ev,__ZNSt3__28ios_baseD0Ev,__ZNSt3__215basic_streambufIcNS_11char_traitsIcEEED2Ev,__ZNSt3__215basic_streambufIcNS_11char_traitsIcEEED0Ev,__ZNSt3__215basic_streambufIwNS_11char_traitsIwEEED2Ev,__ZNSt3__215basic_streambufIwNS_11char_traitsIwEEED0Ev,__ZNSt3__213basic_istreamIwNS_11char_traitsIwEEED1Ev,__ZNSt3__213basic_istreamIwNS_11char_traitsIwEEED0Ev,__ZTv0_n12_NSt3__213basic_istreamIwNS_11char_traitsIwEEED1Ev
,__ZTv0_n12_NSt3__213basic_istreamIwNS_11char_traitsIwEEED0Ev,__ZNSt3__213basic_ostreamIwNS_11char_traitsIwEEED1Ev,__ZNSt3__213basic_ostreamIwNS_11char_traitsIwEEED0Ev,__ZTv0_n12_NSt3__213basic_ostreamIwNS_11char_traitsIwEEED1Ev,__ZTv0_n12_NSt3__213basic_ostreamIwNS_11char_traitsIwEEED0Ev,__ZNSt3__210__stdinbufIcED0Ev,__ZNSt3__210__stdinbufIwED0Ev,__ZNSt3__211__stdoutbufIcED0Ev,__ZNSt3__211__stdoutbufIwED0Ev,__ZNSt3__27collateIcED2Ev,__ZNSt3__27collateIcED0Ev,__ZNSt3__27collateIwED2Ev,__ZNSt3__27collateIwED0Ev,__ZNSt3__27num_getIcNS_19istreambuf_iteratorIcNS_11char_traitsIcEEEEED2Ev,__ZNSt3__27num_getIcNS_19istreambuf_iteratorIcNS_11char_traitsIcEEEEED0Ev,__ZNSt3__27num_getIwNS_19istreambuf_iteratorIwNS_11char_traitsIwEEEEED2Ev,__ZNSt3__27num_getIwNS_19istreambuf_iteratorIwNS_11char_traitsIwEEEEED0Ev,__ZNSt3__27num_putIcNS_19ostreambuf_iteratorIcNS_11char_traitsIcEEEEED2Ev,__ZNSt3__27num_putIcNS_19ostreambuf_iteratorIcNS_11char_traitsIcEEEEED0Ev,__ZNSt3__27num_putIwNS_19ostreambuf_iteratorIwNS_11char_traitsIwEEEEED2Ev,__ZNSt3__27num_putIwNS_19ostreambuf_iteratorIwNS_11char_traitsIwEEEEED0Ev,__ZNSt3__28time_getIcNS_19istreambuf_iteratorIcNS_11char_traitsIcEEEEED2Ev,__ZNSt3__28time_getIcNS_19istreambuf_iteratorIcNS_11char_traitsIcEEEEED0Ev,__ZNSt3__28time_getIwNS_19istreambuf_iteratorIwNS_11char_traitsIwEEEEED2Ev,__ZNSt3__28time_getIwNS_19istreambuf_iteratorIwNS_11char_traitsIwEEEEED0Ev,__ZNSt3__28time_putIcNS_19ostreambuf_iteratorIcNS_11char_traitsIcEEEEED2Ev,__ZNSt3__28time_putIcNS_19ostreambuf_iteratorIcNS_11char_traitsIcEEEEED0Ev,__ZNSt3__28time_putIwNS_19ostreambuf_iteratorIwNS_11char_traitsIwEEEEED2Ev,__ZNSt3__28time_putIwNS_19ostreambuf_iteratorIwNS_11char_traitsIwEEEEED0Ev,__ZNSt3__210moneypunctIcLb0EED2Ev
,__ZNSt3__210moneypunctIcLb0EED0Ev,__ZNSt3__210moneypunctIcLb1EED2Ev,__ZNSt3__210moneypunctIcLb1EED0Ev,__ZNSt3__210moneypunctIwLb0EED2Ev,__ZNSt3__210moneypunctIwLb0EED0Ev,__ZNSt3__210moneypunctIwLb1EED2Ev,__ZNSt3__210moneypunctIwLb1EED0Ev,__ZNSt3__29money_getIcNS_19istreambuf_iteratorIcNS_11char_traitsIcEEEEED2Ev,__ZNSt3__29money_getIcNS_19istreambuf_iteratorIcNS_11char_traitsIcEEEEED0Ev,__ZNSt3__29money_getIwNS_19istreambuf_iteratorIwNS_11char_traitsIwEEEEED2Ev,__ZNSt3__29money_getIwNS_19istreambuf_iteratorIwNS_11char_traitsIwEEEEED0Ev,__ZNSt3__29money_putIcNS_19ostreambuf_iteratorIcNS_11char_traitsIcEEEEED2Ev,__ZNSt3__29money_putIcNS_19ostreambuf_iteratorIcNS_11char_traitsIcEEEEED0Ev,__ZNSt3__29money_putIwNS_19ostreambuf_iteratorIwNS_11char_traitsIwEEEEED2Ev,__ZNSt3__29money_putIwNS_19ostreambuf_iteratorIwNS_11char_traitsIwEEEEED0Ev,__ZNSt3__28messagesIcED2Ev,__ZNSt3__28messagesIcED0Ev,__ZNSt3__28messagesIwED2Ev,__ZNSt3__28messagesIwED0Ev,__ZNSt3__26locale5facetD2Ev,__ZNSt3__216__narrow_to_utf8ILj32EED0Ev,__ZNSt3__217__widen_from_utf8ILj32EED0Ev,__ZNSt3__27codecvtIwc11__mbstate_tED2Ev,__ZNSt3__27codecvtIwc11__mbstate_tED0Ev,__ZNSt3__26locale5__impD2Ev,__ZNSt3__26locale5__impD0Ev,__ZNSt3__25ctypeIcED2Ev,__ZNSt3__25ctypeIcED0Ev,__ZNSt3__28numpunctIcED0Ev,__ZNSt3__28numpunctIwED2Ev
,__ZNSt3__28numpunctIwED0Ev,__ZNSt3__26locale5facetD0Ev,__ZNSt3__25ctypeIwED0Ev,__ZNSt3__27codecvtIcc11__mbstate_tED0Ev,__ZNSt3__27codecvtIDsc11__mbstate_tED0Ev,__ZNSt3__27codecvtIDic11__mbstate_tED0Ev,__ZN10__cxxabiv116__shim_type_infoD2Ev,__ZN10__cxxabiv117__class_type_infoD0Ev,__ZNK10__cxxabiv116__shim_type_info5noop1Ev,__ZNK10__cxxabiv116__shim_type_info5noop2Ev,__ZN10__cxxabiv120__si_class_type_infoD0Ev,__ZNSt9bad_allocD2Ev,__ZNSt9bad_allocD0Ev,__ZNSt11logic_errorD2Ev,__ZNSt11logic_errorD0Ev,__ZNSt12domain_errorD0Ev,__ZNSt16invalid_argumentD0Ev,__ZNSt12out_of_rangeD0Ev,__ZN10__cxxabiv121__vmi_class_type_infoD0Ev,__Z18onhighlight_livery8MenuItemIiE,__Z32onhighlight_color_menu_selection8MenuItemIiE,__Z36onhighlight_skinchanger_texture_menu8MenuItemIiE,__Z31onexit_skinchanger_texture_menub,__Z37onhighlight_skinchanger_drawable_menu8MenuItemIiE,__Z32onexit_skinchanger_drawable_menub,__Z35onhighlight_skinchanger_detail_menu8MenuItemIiE,__Z31onhighlight_props_drawable_menu8MenuItemIiE,__Z30onhighlight_props_texture_menu8MenuItemIiE,__Z14set_plate_text8MenuItemIiE,__Z16give_weapon_clip8MenuItemIiE
,__Z16fill_weapon_ammo8MenuItemIiE,__Z24onconfirm_open_tint_menu8MenuItemIiE,__Z32onhighlight_weapon_mod_menu_tint8MenuItemIiE,_cleanup_522,_cleanup_517,__ZNSt3__26locale2id6__initEv,__ZNSt3__217__call_once_proxyINS_5tupleIJONS_12_GLOBAL__N_111__fake_bindEEEEEEvPv,__ZNSt3__212__do_nothingEPv,_free,__ZN10__cxxabiv112_GLOBAL__N_19destruct_EPv,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6
,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6
,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6];
var FUNCTION_TABLE_vii = [b7,__ZNSt3__215basic_streambufIcNS_11char_traitsIcEEE5imbueERKNS_6localeE,__ZN13ERDatabaseKVS27store_feature_enabled_pairsENSt3__26vectorI29FeatureEnabledLocalDefinitionNS0_9allocatorIS2_EEEE,__ZN13ERDatabaseKVS26load_feature_enabled_pairsENSt3__26vectorI29FeatureEnabledLocalDefinitionNS0_9allocatorIS2_EEEE,__ZN13ERDatabaseKVS19store_setting_pairsENSt3__26vectorI22StringPairSettingDBRowNS0_9allocatorIS2_EEEE,__ZN13ERDatabaseKVS18load_setting_pairsEv,__ZN13ERDatabaseKVS22populate_saved_vehicleEP17SavedVehicleDBRow,__ZN13ERDatabaseKVS19populate_saved_skinEP14SavedSkinDBRow,__ZN13ERDatabaseKVS20delete_saved_vehicleEi,__ZN13ERDatabaseKVS29delete_saved_vehicle_childrenEi,__ZN13ERDatabaseKVS17delete_saved_skinEi,__ZN13ERDatabaseKVS26delete_saved_skin_childrenEi,__ZNK14comma_numpunct11do_groupingEv,__ZNKSt3__28numpunctIcE11do_truenameEv,__ZNKSt3__28numpunctIcE12do_falsenameEv,__ZNSt3__215basic_streambufIwNS_11char_traitsIwEEE5imbueERKNS_6localeE,__ZNSt3__210__stdinbufIcE5imbueERKNS_6localeE,__ZNSt3__210__stdinbufIwE5imbueERKNS_6localeE,__ZNSt3__211__stdoutbufIcE5imbueERKNS_6localeE,__ZNSt3__211__stdoutbufIwE5imbueERKNS_6localeE,__ZNKSt3__210moneypunctIcLb0EE11do_groupingEv,__ZNKSt3__210moneypunctIcLb0EE14do_curr_symbolEv,__ZNKSt3__210moneypunctIcLb0EE16do_positive_signEv,__ZNKSt3__210moneypunctIcLb0EE16do_negative_signEv,__ZNKSt3__210moneypunctIcLb0EE13do_pos_formatEv,__ZNKSt3__210moneypunctIcLb0EE13do_neg_formatEv,__ZNKSt3__210moneypunctIcLb1EE11do_groupingEv,__ZNKSt3__210moneypunctIcLb1EE14do_curr_symbolEv,__ZNKSt3__210moneypunctIcLb1EE16do_positive_signEv
,__ZNKSt3__210moneypunctIcLb1EE16do_negative_signEv,__ZNKSt3__210moneypunctIcLb1EE13do_pos_formatEv,__ZNKSt3__210moneypunctIcLb1EE13do_neg_formatEv,__ZNKSt3__210moneypunctIwLb0EE11do_groupingEv,__ZNKSt3__210moneypunctIwLb0EE14do_curr_symbolEv,__ZNKSt3__210moneypunctIwLb0EE16do_positive_signEv,__ZNKSt3__210moneypunctIwLb0EE16do_negative_signEv,__ZNKSt3__210moneypunctIwLb0EE13do_pos_formatEv,__ZNKSt3__210moneypunctIwLb0EE13do_neg_formatEv,__ZNKSt3__210moneypunctIwLb1EE11do_groupingEv,__ZNKSt3__210moneypunctIwLb1EE14do_curr_symbolEv,__ZNKSt3__210moneypunctIwLb1EE16do_positive_signEv,__ZNKSt3__210moneypunctIwLb1EE16do_negative_signEv,__ZNKSt3__210moneypunctIwLb1EE13do_pos_formatEv,__ZNKSt3__210moneypunctIwLb1EE13do_neg_formatEv,__ZNKSt3__28messagesIcE8do_closeEi,__ZNKSt3__28messagesIwE8do_closeEi,__ZNKSt3__28numpunctIcE11do_groupingEv,__ZNKSt3__28numpunctIwE11do_groupingEv,__ZNKSt3__28numpunctIwE11do_truenameEv,__ZNKSt3__28numpunctIwE12do_falsenameEv,__Z16set_turbochargedbNSt3__26vectorIiNS_9allocatorIiEEEE,__Z20set_xenon_headlightsbNSt3__26vectorIiNS_9allocatorIiEEEE,__Z21set_bulletproof_tyresbNSt3__26vectorIiNS_9allocatorIiEEEE,__Z16set_custom_tyresbNSt3__26vectorIiNS_9allocatorIiEEEE,__Z17set_extra_enabledbNSt3__26vectorIiNS_9allocatorIiEEEE,__Z19set_weapon_equippedbNSt3__26vectorIiNS_9allocatorIiEEEE,__Z22set_weaponmod_equippedbNSt3__26vectorIiNS_9allocatorIiEEEE,b7,b7
,b7,b7,b7,b7,b7];
var FUNCTION_TABLE_iiiiiii = [b8,__ZNKSt3__27num_getIcNS_19istreambuf_iteratorIcNS_11char_traitsIcEEEEE6do_getES4_S4_RNS_8ios_baseERjRb,__ZNKSt3__27num_getIcNS_19istreambuf_iteratorIcNS_11char_traitsIcEEEEE6do_getES4_S4_RNS_8ios_baseERjRl,__ZNKSt3__27num_getIcNS_19istreambuf_iteratorIcNS_11char_traitsIcEEEEE6do_getES4_S4_RNS_8ios_baseERjRx,__ZNKSt3__27num_getIcNS_19istreambuf_iteratorIcNS_11char_traitsIcEEEEE6do_getES4_S4_RNS_8ios_baseERjRt,__ZNKSt3__27num_getIcNS_19istreambuf_iteratorIcNS_11char_traitsIcEEEEE6do_getES4_S4_RNS_8ios_baseERjS8_,__ZNKSt3__27num_getIcNS_19istreambuf_iteratorIcNS_11char_traitsIcEEEEE6do_getES4_S4_RNS_8ios_baseERjRm,__ZNKSt3__27num_getIcNS_19istreambuf_iteratorIcNS_11char_traitsIcEEEEE6do_getES4_S4_RNS_8ios_baseERjRy,__ZNKSt3__27num_getIcNS_19istreambuf_iteratorIcNS_11char_traitsIcEEEEE6do_getES4_S4_RNS_8ios_baseERjRf,__ZNKSt3__27num_getIcNS_19istreambuf_iteratorIcNS_11char_traitsIcEEEEE6do_getES4_S4_RNS_8ios_baseERjRd,__ZNKSt3__27num_getIcNS_19istreambuf_iteratorIcNS_11char_traitsIcEEEEE6do_getES4_S4_RNS_8ios_baseERjRe,__ZNKSt3__27num_getIcNS_19istreambuf_iteratorIcNS_11char_traitsIcEEEEE6do_getES4_S4_RNS_8ios_baseERjRPv,__ZNKSt3__27num_getIwNS_19istreambuf_iteratorIwNS_11char_traitsIwEEEEE6do_getES4_S4_RNS_8ios_baseERjRb,__ZNKSt3__27num_getIwNS_19istreambuf_iteratorIwNS_11char_traitsIwEEEEE6do_getES4_S4_RNS_8ios_baseERjRl,__ZNKSt3__27num_getIwNS_19istreambuf_iteratorIwNS_11char_traitsIwEEEEE6do_getES4_S4_RNS_8ios_baseERjRx,__ZNKSt3__27num_getIwNS_19istreambuf_iteratorIwNS_11char_traitsIwEEEEE6do_getES4_S4_RNS_8ios_baseERjRt,__ZNKSt3__27num_getIwNS_19istreambuf_iteratorIwNS_11char_traitsIwEEEEE6do_getES4_S4_RNS_8ios_baseERjS8_,__ZNKSt3__27num_getIwNS_19istreambuf_iteratorIwNS_11char_traitsIwEEEEE6do_getES4_S4_RNS_8ios_baseERjRm,__ZNKSt3__27num_getIwNS_19istreambuf_iteratorIwNS_11char_traitsIwEEEEE6do_getES4_S4_RNS_8ios_baseERjRy,__ZNKSt3__27num_getIwNS_19istreambuf_iteratorIwNS_11char_traitsIwEEEEE6do_getES4_S4_RNS_8ios_baseERjRf,__ZNKSt3__27num_getIwNS_19istreambuf_iteratorIwNS_11char_traitsIwEEEEE6do_getES4_S4_RNS_8ios_baseERjRd,__ZNKSt3__27num_getIwNS_19istreambuf_iteratorIwNS_11char_traitsIwEEEEE6do_getES4_S4_RNS_8ios_baseERjRe,__ZNKSt3__27num_getIwNS_19istreambuf_iteratorIwNS_11char_traitsIwEEEEE6do_getES4_S4_RNS_8ios_baseERjRPv,__ZNKSt3__27num_putIcNS_19ostreambuf_iteratorIcNS_11char_traitsIcEEEEE6do_putES4_RNS_8ios_baseEcx,__ZNKSt3__27num_putIcNS_19ostreambuf_iteratorIcNS_11char_traitsIcEEEEE6do_putES4_RNS_8ios_baseEcy,__ZNKSt3__27num_putIwNS_19ostreambuf_iteratorIwNS_11char_traitsIwEEEEE6do_putES4_RNS_8ios_baseEwx,__ZNKSt3__27num_putIwNS_19ostreambuf_iteratorIwNS_11char_traitsIwEEEEE6do_putES4_RNS_8ios_baseEwy,__ZNKSt3__28time_getIcNS_19istreambuf_iteratorIcNS_11char_traitsIcEEEEE11do_get_timeES4_S4_RNS_8ios_baseERjP2tm,__ZNKSt3__28time_getIcNS_19istreambuf_iteratorIcNS_11char_traitsIcEEEEE11do_get_dateES4_S4_RNS_8ios_baseERjP2tm
,__ZNKSt3__28time_getIcNS_19istreambuf_iteratorIcNS_11char_traitsIcEEEEE14do_get_weekdayES4_S4_RNS_8ios_baseERjP2tm,__ZNKSt3__28time_getIcNS_19istreambuf_iteratorIcNS_11char_traitsIcEEEEE16do_get_monthnameES4_S4_RNS_8ios_baseERjP2tm,__ZNKSt3__28time_getIcNS_19istreambuf_iteratorIcNS_11char_traitsIcEEEEE11do_get_yearES4_S4_RNS_8ios_baseERjP2tm,__ZNKSt3__28time_getIwNS_19istreambuf_iteratorIwNS_11char_traitsIwEEEEE11do_get_timeES4_S4_RNS_8ios_baseERjP2tm,__ZNKSt3__28time_getIwNS_19istreambuf_iteratorIwNS_11char_traitsIwEEEEE11do_get_dateES4_S4_RNS_8ios_baseERjP2tm,__ZNKSt3__28time_getIwNS_19istreambuf_iteratorIwNS_11char_traitsIwEEEEE14do_get_weekdayES4_S4_RNS_8ios_baseERjP2tm,__ZNKSt3__28time_getIwNS_19istreambuf_iteratorIwNS_11char_traitsIwEEEEE16do_get_monthnameES4_S4_RNS_8ios_baseERjP2tm,__ZNKSt3__28time_getIwNS_19istreambuf_iteratorIwNS_11char_traitsIwEEEEE11do_get_yearES4_S4_RNS_8ios_baseERjP2tm,__ZNKSt3__29money_putIcNS_19ostreambuf_iteratorIcNS_11char_traitsIcEEEEE6do_putES4_bRNS_8ios_baseEcRKNS_12basic_stringIcS3_NS_9allocatorIcEEEE,__ZNKSt3__29money_putIwNS_19ostreambuf_iteratorIwNS_11char_traitsIwEEEEE6do_putES4_bRNS_8ios_baseEwRKNS_12basic_stringIwS3_NS_9allocatorIwEEEE,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8
,b8,b8,b8,b8,b8];
var FUNCTION_TABLE_ii = [b9,__ZNSt3__215basic_streambufIcNS_11char_traitsIcEEE4syncEv,__ZNSt3__215basic_streambufIcNS_11char_traitsIcEEE9showmanycEv,__ZNSt3__215basic_stringbufIcNS_11char_traitsIcEENS_9allocatorIcEEE9underflowEv,__ZNSt3__215basic_streambufIcNS_11char_traitsIcEEE5uflowEv,__ZN8MenuItemIiE29isAbsorbingLeftAndRightEventsEv,__ZN13ERDatabaseKVS4openEv,__ZNKSt9exception4whatEv,__ZN14ToggleMenuItemIiE16get_toggle_valueEv,__ZN16WantedSymbolItemIiE29isAbsorbingLeftAndRightEventsEv,__ZN8MenuItemINSt3__212basic_stringIcNS0_11char_traitsIcEENS0_9allocatorIcEEEEE29isAbsorbingLeftAndRightEventsEv,__ZN14ToggleMenuItemINSt3__212basic_stringIcNS0_11char_traitsIcEENS0_9allocatorIcEEEEE16get_toggle_valueEv,__ZNKSt3__28numpunctIcE16do_decimal_pointEv,__ZNK14comma_numpunct16do_thousands_sepEv,__ZN28FunctionDrivenToggleMenuItemIiE16get_toggle_valueEv,___stdio_close,__ZNSt3__215basic_streambufIcNS_11char_traitsIcEEE9underflowEv,__ZNSt3__215basic_streambufIwNS_11char_traitsIwEEE4syncEv,__ZNSt3__215basic_streambufIwNS_11char_traitsIwEEE9showmanycEv,__ZNSt3__215basic_streambufIwNS_11char_traitsIwEEE9underflowEv,__ZNSt3__215basic_streambufIwNS_11char_traitsIwEEE5uflowEv,__ZNSt3__210__stdinbufIcE9underflowEv,__ZNSt3__210__stdinbufIcE5uflowEv,__ZNSt3__210__stdinbufIwE9underflowEv,__ZNSt3__210__stdinbufIwE5uflowEv,__ZNSt3__211__stdoutbufIcE4syncEv,__ZNSt3__211__stdoutbufIwE4syncEv,__ZNKSt3__28time_getIcNS_19istreambuf_iteratorIcNS_11char_traitsIcEEEEE13do_date_orderEv,__ZNKSt3__220__time_get_c_storageIcE7__weeksEv
,__ZNKSt3__220__time_get_c_storageIcE8__monthsEv,__ZNKSt3__220__time_get_c_storageIcE7__am_pmEv,__ZNKSt3__220__time_get_c_storageIcE3__cEv,__ZNKSt3__220__time_get_c_storageIcE3__rEv,__ZNKSt3__220__time_get_c_storageIcE3__xEv,__ZNKSt3__220__time_get_c_storageIcE3__XEv,__ZNKSt3__28time_getIwNS_19istreambuf_iteratorIwNS_11char_traitsIwEEEEE13do_date_orderEv,__ZNKSt3__220__time_get_c_storageIwE7__weeksEv,__ZNKSt3__220__time_get_c_storageIwE8__monthsEv,__ZNKSt3__220__time_get_c_storageIwE7__am_pmEv,__ZNKSt3__220__time_get_c_storageIwE3__cEv,__ZNKSt3__220__time_get_c_storageIwE3__rEv,__ZNKSt3__220__time_get_c_storageIwE3__xEv,__ZNKSt3__220__time_get_c_storageIwE3__XEv,__ZNKSt3__210moneypunctIcLb0EE16do_decimal_pointEv,__ZNKSt3__210moneypunctIcLb0EE16do_thousands_sepEv,__ZNKSt3__210moneypunctIcLb0EE14do_frac_digitsEv,__ZNKSt3__210moneypunctIcLb1EE16do_decimal_pointEv,__ZNKSt3__210moneypunctIcLb1EE16do_thousands_sepEv,__ZNKSt3__210moneypunctIcLb1EE14do_frac_digitsEv,__ZNKSt3__210moneypunctIwLb0EE16do_decimal_pointEv,__ZNKSt3__210moneypunctIwLb0EE16do_thousands_sepEv,__ZNKSt3__210moneypunctIwLb0EE14do_frac_digitsEv,__ZNKSt3__210moneypunctIwLb1EE16do_decimal_pointEv,__ZNKSt3__210moneypunctIwLb1EE16do_thousands_sepEv,__ZNKSt3__210moneypunctIwLb1EE14do_frac_digitsEv,__ZNKSt3__27codecvtIDic11__mbstate_tE11do_encodingEv,__ZNKSt3__27codecvtIDic11__mbstate_tE16do_always_noconvEv,__ZNKSt3__27codecvtIDic11__mbstate_tE13do_max_lengthEv,__ZNKSt3__27codecvtIwc11__mbstate_tE11do_encodingEv
,__ZNKSt3__27codecvtIwc11__mbstate_tE16do_always_noconvEv,__ZNKSt3__27codecvtIwc11__mbstate_tE13do_max_lengthEv,__ZNKSt3__28numpunctIcE16do_thousands_sepEv,__ZNKSt3__28numpunctIwE16do_decimal_pointEv,__ZNKSt3__28numpunctIwE16do_thousands_sepEv,__ZNKSt3__27codecvtIcc11__mbstate_tE11do_encodingEv,__ZNKSt3__27codecvtIcc11__mbstate_tE16do_always_noconvEv,__ZNKSt3__27codecvtIcc11__mbstate_tE13do_max_lengthEv,__ZNKSt3__27codecvtIDsc11__mbstate_tE11do_encodingEv,__ZNKSt3__27codecvtIDsc11__mbstate_tE16do_always_noconvEv,__ZNKSt3__27codecvtIDsc11__mbstate_tE13do_max_lengthEv,__ZNKSt9bad_alloc4whatEv,__ZNKSt11logic_error4whatEv,__Z24onconfirm_animation_menu8MenuItemIiE,__Z19onconfirm_anim_menu8MenuItemIiE,__Z23onconfirm_anim_top_menu8MenuItemIiE,__Z19onconfirm_task_menu8MenuItemIiE,__Z18onconfirm_ani_menu8MenuItemIiE,__Z16onconfirm_livery8MenuItemIiE,__Z30onconfirm_color_menu_selection8MenuItemIiE,__Z25onconfirm_paint_menu_type8MenuItemIiE,__Z20onconfirm_paint_menu8MenuItemIiE,__Z36onconfirm_online_player_options_menu8MenuItemIiE,__Z31onconfirm_online_player_options8MenuItemIiE,__Z21onconfirm_player_menu8MenuItemIiE,__Z17onconfirm_hc_menu8MenuItemIiE,__Z17onconfirm_vc_menu8MenuItemIiE,__Z26onconfirm_perspective_menu8MenuItemIiE,__Z23onconfirm_relative_menu8MenuItemIiE,__Z21onconfirm_camera_menu8MenuItemIiE
,__Z19onconfirm_time_menu8MenuItemIiE,__Z22onconfirm_weather_menu8MenuItemINSt3__212basic_stringIcNS0_11char_traitsIcEENS0_9allocatorIcEEEEE,__Z20onconfirm_world_menu8MenuItemIiE,__Z27onconfirm_voicechannel_menu8MenuItemIiE,__Z29onconfirm_voiceproximity_menu8MenuItemIiE,__Z20onconfirm_voice_menu8MenuItemIiE,__Z23onconfirm_reset_globals8MenuItemIiE,__Z19onconfirm_misc_menu8MenuItemIiE,__Z20onconfirm_leave_menu8MenuItemIiE,__Z19onconfirm_exit_menu8MenuItemIiE,__Z19onconfirm_main_menu8MenuItemIiE,__Z34onconfirm_skinchanger_texture_menu8MenuItemIiE,__Z35onconfirm_skinchanger_drawable_menu8MenuItemIiE,__Z33onconfirm_skinchanger_detail_menu8MenuItemIiE,__Z37onconfirm_skinchanger_choices_players8MenuItemINSt3__212basic_stringIcNS0_11char_traitsIcEENS0_9allocatorIcEEEEE,__Z37onconfirm_skinchanger_choices_animals8MenuItemINSt3__212basic_stringIcNS0_11char_traitsIcEENS0_9allocatorIcEEEEE,__Z34onconfirm_skinchanger_choices_misc8MenuItemINSt3__212basic_stringIcNS0_11char_traitsIcEENS0_9allocatorIcEEEEE,__Z24onconfirm_savedskin_menu8MenuItemIiE,__Z29onconfirm_savedskin_slot_menu8MenuItemIiE,__Z20onconfirm_props_menu8MenuItemIiE,__Z29onconfirm_props_drawable_menu8MenuItemIiE,__Z28onconfirm_props_texture_menu8MenuItemIiE,__Z26onconfirm_skinchanger_menu8MenuItemIiE,__Z27onconfirm_teleport_category8MenuItemIiE,__Z27onconfirm_teleport_location8MenuItemIiE,__Z22onconfirm_vehdoor_menu8MenuItemIiE,__Z21onconfirm_remote_menu8MenuItemIiE,__Z27onconfirm_ownedvehicle_menu8MenuItemIiE,__Z33onconfirm_vehicle_invincible_menu8MenuItemIiE,__Z28onconfirm_vehicle_power_menu8MenuItemIiE
,__Z29onconfirm_vehicle_torque_menu8MenuItemIiE,__Z29onconfirm_rainbowoptions_menu8MenuItemIiE,__Z30onconfirm_vehspawnoptions_menu8MenuItemIiE,__Z29onconfirm_vehsuspoptions_menu8MenuItemIiE,__Z21onconfirm_speedo_menu8MenuItemIiE,__Z23onconfirm_carspawn_menu8MenuItemIiE,__Z25onconfirm_spawn_menu_cars8MenuItemIiE,__Z38onconfirm_spawn_menu_vehicle_selection8MenuItemINSt3__212basic_stringIcNS0_11char_traitsIcEENS0_9allocatorIcEEEEE,__Z26onconfirm_spawn_menu_indus8MenuItemIiE,__Z23onconfirm_savedveh_menu8MenuItemIiE,__Z28onconfirm_savedveh_slot_menu8MenuItemIiE,__Z18onconfirm_veh_menu8MenuItemIiE,__Z30onconfirm_vehmod_category_menu8MenuItemIiE,__Z20onconfirm_neons_menu8MenuItemIiE,__Z20onconfirm_smoke_menu8MenuItemIiE,__Z20onconfirm_light_menu8MenuItemIiE,__Z19onconfirm_trim_menu8MenuItemIiE,__Z15is_turbochargedNSt3__26vectorIiNS_9allocatorIiEEEE,__Z19is_xenon_headlightsNSt3__26vectorIiNS_9allocatorIiEEEE,__Z20is_bulletproof_tyresNSt3__26vectorIiNS_9allocatorIiEEEE,__Z15is_custom_tyresNSt3__26vectorIiNS_9allocatorIiEEEE,__Z16is_extra_enabledNSt3__26vectorIiNS_9allocatorIiEEEE,__Z21onconfirm_vehmod_menu8MenuItemIiE,__Z18is_weapon_equippedNSt3__26vectorIiNS_9allocatorIiEEEE,__Z21is_weaponmod_equippedNSt3__26vectorIiNS_9allocatorIiEEEE,__Z30onconfirm_weapon_mod_menu_tint8MenuItemIiE,__Z28onconfirm_weapon_in_category8MenuItemIiE,__Z25onconfirm_weaponlist_menu8MenuItemIiE,__Z21onconfirm_weapon_menu8MenuItemIiE,b9
,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9
,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9
,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9
,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9];
var FUNCTION_TABLE_viii = [b10,__ZN13ERDatabaseKVS18get_saved_vehiclesEi,__ZN13ERDatabaseKVS15get_saved_skinsEi,__ZN13ERDatabaseKVS20rename_saved_vehicleENSt3__212basic_stringIcNS0_11char_traitsIcEENS0_9allocatorIcEEEEi,__ZN13ERDatabaseKVS17rename_saved_skinENSt3__212basic_stringIcNS0_11char_traitsIcEENS0_9allocatorIcEEEEi,b10,b10,b10];
var FUNCTION_TABLE_v = [b11,__ZL25default_terminate_handlerv,__Z15update_featuresv,__ZN10__cxxabiv112_GLOBAL__N_110construct_Ev];
var FUNCTION_TABLE_iiiiiiiii = [b12,__ZNKSt3__28time_getIcNS_19istreambuf_iteratorIcNS_11char_traitsIcEEEEE6do_getES4_S4_RNS_8ios_baseERjP2tmcc,__ZNKSt3__28time_getIwNS_19istreambuf_iteratorIwNS_11char_traitsIwEEEEE6do_getES4_S4_RNS_8ios_baseERjP2tmcc,__ZNKSt3__27codecvtIDic11__mbstate_tE6do_outERS1_PKDiS5_RS5_PcS7_RS7_,__ZNKSt3__27codecvtIDic11__mbstate_tE5do_inERS1_PKcS5_RS5_PDiS7_RS7_,__ZNKSt3__27codecvtIwc11__mbstate_tE6do_outERS1_PKwS5_RS5_PcS7_RS7_,__ZNKSt3__27codecvtIwc11__mbstate_tE5do_inERS1_PKcS5_RS5_PwS7_RS7_,__ZNKSt3__27codecvtIcc11__mbstate_tE6do_outERS1_PKcS5_RS5_PcS7_RS7_,__ZNKSt3__27codecvtIcc11__mbstate_tE5do_inERS1_PKcS5_RS5_PcS7_RS7_,__ZNKSt3__27codecvtIDsc11__mbstate_tE6do_outERS1_PKDsS5_RS5_PcS7_RS7_,__ZNKSt3__27codecvtIDsc11__mbstate_tE5do_inERS1_PKcS5_RS5_PDsS7_RS7_,b12,b12,b12,b12,b12];
var FUNCTION_TABLE_iiiii = [b13,__ZN13ERDatabaseKVS12save_vehicleEiNSt3__212basic_stringIcNS0_11char_traitsIcEENS0_9allocatorIcEEEEi,__ZN13ERDatabaseKVS9save_skinEiNSt3__212basic_stringIcNS0_11char_traitsIcEENS0_9allocatorIcEEEEi,__ZNKSt3__25ctypeIcE8do_widenEPKcS3_Pc,__ZNKSt3__25ctypeIwE5do_isEPKwS3_Pt,__ZNKSt3__25ctypeIwE10do_scan_isEtPKwS3_,__ZNKSt3__25ctypeIwE11do_scan_notEtPKwS3_,__ZNKSt3__25ctypeIwE8do_widenEPKcS3_Pw];
var FUNCTION_TABLE_viiii = [b14,__ZNSt3__215basic_stringbufIcNS_11char_traitsIcEENS_9allocatorIcEEE7seekposENS_4fposI11__mbstate_tEEj,__ZNSt3__215basic_streambufIcNS_11char_traitsIcEEE7seekposENS_4fposI11__mbstate_tEEj,__ZNSt3__215basic_streambufIwNS_11char_traitsIwEEE7seekposENS_4fposI11__mbstate_tEEj,__ZNKSt3__27collateIcE12do_transformEPKcS3_,__ZNKSt3__27collateIwE12do_transformEPKwS3_,__ZNK10__cxxabiv117__class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi,__ZNK10__cxxabiv120__si_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi,__ZNK10__cxxabiv121__vmi_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi,b14,b14,b14,b14,b14,b14,b14];
var FUNCTION_TABLE_iii = [b15,__ZNSt3__215basic_stringbufIcNS_11char_traitsIcEENS_9allocatorIcEEE9pbackfailEi,__ZNSt3__215basic_stringbufIcNS_11char_traitsIcEENS_9allocatorIcEEE8overflowEi,__ZNKSt3__219__shared_weak_count13__get_deleterERKSt9type_info,__ZNSt3__215basic_streambufIcNS_11char_traitsIcEEE9pbackfailEi,__ZNSt3__215basic_streambufIcNS_11char_traitsIcEEE8overflowEi,__ZNSt3__215basic_streambufIwNS_11char_traitsIwEEE9pbackfailEj,__ZNSt3__215basic_streambufIwNS_11char_traitsIwEEE8overflowEj,__ZNSt3__210__stdinbufIcE9pbackfailEi,__ZNSt3__210__stdinbufIwE9pbackfailEj,__ZNSt3__211__stdoutbufIcE8overflowEi,__ZNSt3__211__stdoutbufIwE8overflowEj,__ZNKSt3__25ctypeIcE10do_toupperEc,__ZNKSt3__25ctypeIcE10do_tolowerEc,__ZNKSt3__25ctypeIcE8do_widenEc,__ZNKSt3__25ctypeIwE10do_toupperEw,__ZNKSt3__25ctypeIwE10do_tolowerEw,__ZNKSt3__25ctypeIwE8do_widenEc,b15,b15,b15,b15,b15,b15,b15,b15,b15,b15,b15
,b15,b15,b15];
var FUNCTION_TABLE_iiiiid = [b16,__ZNKSt3__27num_putIcNS_19ostreambuf_iteratorIcNS_11char_traitsIcEEEEE6do_putES4_RNS_8ios_baseEcd,__ZNKSt3__27num_putIcNS_19ostreambuf_iteratorIcNS_11char_traitsIcEEEEE6do_putES4_RNS_8ios_baseEce,__ZNKSt3__27num_putIwNS_19ostreambuf_iteratorIwNS_11char_traitsIwEEEEE6do_putES4_RNS_8ios_baseEwd,__ZNKSt3__27num_putIwNS_19ostreambuf_iteratorIwNS_11char_traitsIwEEEEE6do_putES4_RNS_8ios_baseEwe,b16,b16,b16];
var FUNCTION_TABLE_iiiiii = [b17,__ZNKSt3__27collateIcE10do_compareEPKcS3_S3_S3_,__ZNKSt3__27collateIwE10do_compareEPKwS3_S3_S3_,__ZNKSt3__27num_putIcNS_19ostreambuf_iteratorIcNS_11char_traitsIcEEEEE6do_putES4_RNS_8ios_baseEcb,__ZNKSt3__27num_putIcNS_19ostreambuf_iteratorIcNS_11char_traitsIcEEEEE6do_putES4_RNS_8ios_baseEcl,__ZNKSt3__27num_putIcNS_19ostreambuf_iteratorIcNS_11char_traitsIcEEEEE6do_putES4_RNS_8ios_baseEcm,__ZNKSt3__27num_putIcNS_19ostreambuf_iteratorIcNS_11char_traitsIcEEEEE6do_putES4_RNS_8ios_baseEcPKv,__ZNKSt3__27num_putIwNS_19ostreambuf_iteratorIwNS_11char_traitsIwEEEEE6do_putES4_RNS_8ios_baseEwb,__ZNKSt3__27num_putIwNS_19ostreambuf_iteratorIwNS_11char_traitsIwEEEEE6do_putES4_RNS_8ios_baseEwl,__ZNKSt3__27num_putIwNS_19ostreambuf_iteratorIwNS_11char_traitsIwEEEEE6do_putES4_RNS_8ios_baseEwm,__ZNKSt3__27num_putIwNS_19ostreambuf_iteratorIwNS_11char_traitsIwEEEEE6do_putES4_RNS_8ios_baseEwPKv,__ZNKSt3__27codecvtIDic11__mbstate_tE10do_unshiftERS1_PcS4_RS4_,__ZNKSt3__27codecvtIDic11__mbstate_tE9do_lengthERS1_PKcS5_j,__ZNKSt3__27codecvtIwc11__mbstate_tE10do_unshiftERS1_PcS4_RS4_,__ZNKSt3__27codecvtIwc11__mbstate_tE9do_lengthERS1_PKcS5_j,__ZNKSt3__25ctypeIcE9do_narrowEPKcS3_cPc,__ZNKSt3__25ctypeIwE9do_narrowEPKwS3_cPc,__ZNKSt3__27codecvtIcc11__mbstate_tE10do_unshiftERS1_PcS4_RS4_,__ZNKSt3__27codecvtIcc11__mbstate_tE9do_lengthERS1_PKcS5_j,__ZNKSt3__27codecvtIDsc11__mbstate_tE10do_unshiftERS1_PcS4_RS4_,__ZNKSt3__27codecvtIDsc11__mbstate_tE9do_lengthERS1_PKcS5_j,b17,b17,b17,b17,b17,b17,b17,b17
,b17,b17,b17];

  return { _main: _main, ___udivdi3: ___udivdi3, _bitshift64Lshr: _bitshift64Lshr, ___udivmoddi4: ___udivmoddi4, ___cxa_is_pointer_type: ___cxa_is_pointer_type, _llvm_cttz_i32: _llvm_cttz_i32, _memcpy: _memcpy, ___muldi3: ___muldi3, _bitshift64Shl: _bitshift64Shl, ___uremdi3: ___uremdi3, _i64Subtract: _i64Subtract, _memset: _memset, _i64Add: _i64Add, _pthread_self: _pthread_self, _pthread_mutex_unlock: _pthread_mutex_unlock, _pthread_cond_broadcast: _pthread_cond_broadcast, ___errno_location: ___errno_location, ___muldsi3: ___muldsi3, ___cxa_can_catch: ___cxa_can_catch, _free: _free, _memmove: _memmove, _malloc: _malloc, _pthread_mutex_lock: _pthread_mutex_lock, __GLOBAL__I_000101: __GLOBAL__I_000101, __GLOBAL__sub_I_anims_cpp: __GLOBAL__sub_I_anims_cpp, __GLOBAL__sub_I_menu_functions_cpp: __GLOBAL__sub_I_menu_functions_cpp, __GLOBAL__sub_I_noclip_cpp: __GLOBAL__sub_I_noclip_cpp, __GLOBAL__sub_I_paintmenu_cpp: __GLOBAL__sub_I_paintmenu_cpp, __GLOBAL__sub_I_script_cpp: __GLOBAL__sub_I_script_cpp, __GLOBAL__sub_I_skins_cpp: __GLOBAL__sub_I_skins_cpp, __GLOBAL__sub_I_teleportation_cpp: __GLOBAL__sub_I_teleportation_cpp, __GLOBAL__sub_I_vehicles_cpp: __GLOBAL__sub_I_vehicles_cpp, __GLOBAL__sub_I_vehmodmenu_cpp: __GLOBAL__sub_I_vehmodmenu_cpp, __GLOBAL__sub_I_weapons_cpp: __GLOBAL__sub_I_weapons_cpp, __GLOBAL__sub_I_iostream_cpp: __GLOBAL__sub_I_iostream_cpp, runPostSets: runPostSets, stackAlloc: stackAlloc, stackSave: stackSave, stackRestore: stackRestore, establishStackSpace: establishStackSpace, setThrew: setThrew, setTempRet0: setTempRet0, getTempRet0: getTempRet0, emterpret: emterpret, setAsyncState: setAsyncState, emtStackSave: emtStackSave, emtStackRestore: emtStackRestore, dynCall_iiiiiiii: dynCall_iiiiiiii, dynCall_iiii: dynCall_iiii, dynCall_viiiiii: dynCall_viiiiii, dynCall_viiiii: dynCall_viiiii, dynCall_iiiiiid: dynCall_iiiiiid, dynCall_i: dynCall_i, dynCall_vi: dynCall_vi, dynCall_vii: dynCall_vii, dynCall_iiiiiii: dynCall_iiiiiii, dynCall_ii: dynCall_ii, dynCall_viii: dynCall_viii, dynCall_v: dynCall_v, dynCall_iiiiiiiii: dynCall_iiiiiiiii, dynCall_iiiii: dynCall_iiiii, dynCall_viiii: dynCall_viiii, dynCall_iii: dynCall_iii, dynCall_iiiiid: dynCall_iiiiid, dynCall_iiiiii: dynCall_iiiiii };
})
// EMSCRIPTEN_END_ASM
(Module.asmGlobalArg, Module.asmLibraryArg, buffer);

var _main = Module["_main"] = asm["_main"];
var _llvm_cttz_i32 = Module["_llvm_cttz_i32"] = asm["_llvm_cttz_i32"];
var ___udivdi3 = Module["___udivdi3"] = asm["___udivdi3"];
var _bitshift64Lshr = Module["_bitshift64Lshr"] = asm["_bitshift64Lshr"];
var _bitshift64Shl = Module["_bitshift64Shl"] = asm["_bitshift64Shl"];
var ___cxa_is_pointer_type = Module["___cxa_is_pointer_type"] = asm["___cxa_is_pointer_type"];
var __GLOBAL__sub_I_script_cpp = Module["__GLOBAL__sub_I_script_cpp"] = asm["__GLOBAL__sub_I_script_cpp"];
var _memset = Module["_memset"] = asm["_memset"];
var _memcpy = Module["_memcpy"] = asm["_memcpy"];
var ___muldi3 = Module["___muldi3"] = asm["___muldi3"];
var __GLOBAL__sub_I_vehmodmenu_cpp = Module["__GLOBAL__sub_I_vehmodmenu_cpp"] = asm["__GLOBAL__sub_I_vehmodmenu_cpp"];
var ___uremdi3 = Module["___uremdi3"] = asm["___uremdi3"];
var _i64Subtract = Module["_i64Subtract"] = asm["_i64Subtract"];
var __GLOBAL__sub_I_menu_functions_cpp = Module["__GLOBAL__sub_I_menu_functions_cpp"] = asm["__GLOBAL__sub_I_menu_functions_cpp"];
var ___udivmoddi4 = Module["___udivmoddi4"] = asm["___udivmoddi4"];
var __GLOBAL__sub_I_weapons_cpp = Module["__GLOBAL__sub_I_weapons_cpp"] = asm["__GLOBAL__sub_I_weapons_cpp"];
var _i64Add = Module["_i64Add"] = asm["_i64Add"];
var _pthread_self = Module["_pthread_self"] = asm["_pthread_self"];
var _pthread_mutex_unlock = Module["_pthread_mutex_unlock"] = asm["_pthread_mutex_unlock"];
var __GLOBAL__I_000101 = Module["__GLOBAL__I_000101"] = asm["__GLOBAL__I_000101"];
var __GLOBAL__sub_I_anims_cpp = Module["__GLOBAL__sub_I_anims_cpp"] = asm["__GLOBAL__sub_I_anims_cpp"];
var __GLOBAL__sub_I_iostream_cpp = Module["__GLOBAL__sub_I_iostream_cpp"] = asm["__GLOBAL__sub_I_iostream_cpp"];
var _pthread_cond_broadcast = Module["_pthread_cond_broadcast"] = asm["_pthread_cond_broadcast"];
var ___errno_location = Module["___errno_location"] = asm["___errno_location"];
var ___muldsi3 = Module["___muldsi3"] = asm["___muldsi3"];
var __GLOBAL__sub_I_skins_cpp = Module["__GLOBAL__sub_I_skins_cpp"] = asm["__GLOBAL__sub_I_skins_cpp"];
var ___cxa_can_catch = Module["___cxa_can_catch"] = asm["___cxa_can_catch"];
var _free = Module["_free"] = asm["_free"];
var runPostSets = Module["runPostSets"] = asm["runPostSets"];
var __GLOBAL__sub_I_vehicles_cpp = Module["__GLOBAL__sub_I_vehicles_cpp"] = asm["__GLOBAL__sub_I_vehicles_cpp"];
var __GLOBAL__sub_I_teleportation_cpp = Module["__GLOBAL__sub_I_teleportation_cpp"] = asm["__GLOBAL__sub_I_teleportation_cpp"];
var _memmove = Module["_memmove"] = asm["_memmove"];
var _malloc = Module["_malloc"] = asm["_malloc"];
var _pthread_mutex_lock = Module["_pthread_mutex_lock"] = asm["_pthread_mutex_lock"];
var __GLOBAL__sub_I_paintmenu_cpp = Module["__GLOBAL__sub_I_paintmenu_cpp"] = asm["__GLOBAL__sub_I_paintmenu_cpp"];
var __GLOBAL__sub_I_noclip_cpp = Module["__GLOBAL__sub_I_noclip_cpp"] = asm["__GLOBAL__sub_I_noclip_cpp"];
var dynCall_iiiiiiii = Module["dynCall_iiiiiiii"] = asm["dynCall_iiiiiiii"];
var dynCall_iiii = Module["dynCall_iiii"] = asm["dynCall_iiii"];
var dynCall_viiiiii = Module["dynCall_viiiiii"] = asm["dynCall_viiiiii"];
var dynCall_viiiii = Module["dynCall_viiiii"] = asm["dynCall_viiiii"];
var dynCall_iiiiiid = Module["dynCall_iiiiiid"] = asm["dynCall_iiiiiid"];
var dynCall_i = Module["dynCall_i"] = asm["dynCall_i"];
var dynCall_vi = Module["dynCall_vi"] = asm["dynCall_vi"];
var dynCall_vii = Module["dynCall_vii"] = asm["dynCall_vii"];
var dynCall_iiiiiii = Module["dynCall_iiiiiii"] = asm["dynCall_iiiiiii"];
var dynCall_ii = Module["dynCall_ii"] = asm["dynCall_ii"];
var dynCall_viii = Module["dynCall_viii"] = asm["dynCall_viii"];
var dynCall_v = Module["dynCall_v"] = asm["dynCall_v"];
var dynCall_iiiiiiiii = Module["dynCall_iiiiiiiii"] = asm["dynCall_iiiiiiiii"];
var dynCall_iiiii = Module["dynCall_iiiii"] = asm["dynCall_iiiii"];
var dynCall_viiii = Module["dynCall_viiii"] = asm["dynCall_viiii"];
var dynCall_iii = Module["dynCall_iii"] = asm["dynCall_iii"];
var dynCall_iiiiid = Module["dynCall_iiiiid"] = asm["dynCall_iiiiid"];
var dynCall_iiiiii = Module["dynCall_iiiiii"] = asm["dynCall_iiiiii"];
;

Runtime.stackAlloc = asm['stackAlloc'];
Runtime.stackSave = asm['stackSave'];
Runtime.stackRestore = asm['stackRestore'];
Runtime.establishStackSpace = asm['establishStackSpace'];

Runtime.setTempRet0 = asm['setTempRet0'];
Runtime.getTempRet0 = asm['getTempRet0'];



// === Auto-generated postamble setup entry stuff ===



if (memoryInitializer) {
  if (typeof Module['locateFile'] === 'function') {
    memoryInitializer = Module['locateFile'](memoryInitializer);
  } else if (Module['memoryInitializerPrefixURL']) {
    memoryInitializer = Module['memoryInitializerPrefixURL'] + memoryInitializer;
  }
  if (ENVIRONMENT_IS_NODE || ENVIRONMENT_IS_SHELL) {
    var data = Module['readBinary'](memoryInitializer);
    HEAPU8.set(data, Runtime.GLOBAL_BASE);
  } else {
    addRunDependency('memory initializer');
    var applyMemoryInitializer = function(data) {
      if (data.byteLength) data = new Uint8Array(data);
      HEAPU8.set(data, Runtime.GLOBAL_BASE);
      // Delete the typed array that contains the large blob of the memory initializer request response so that
      // we won't keep unnecessary memory lying around. However, keep the XHR object itself alive so that e.g.
      // its .status field can still be accessed later.
      if (Module['memoryInitializerRequest']) delete Module['memoryInitializerRequest'].response;
      removeRunDependency('memory initializer');
    }
    function doBrowserLoad() {
      Module['readAsync'](memoryInitializer, applyMemoryInitializer, function() {
        throw 'could not load memory initializer ' + memoryInitializer;
      });
    }
    if (Module['memoryInitializerRequest']) {
      // a network request has already been created, just use that
      function useRequest() {
        var request = Module['memoryInitializerRequest'];
        if (request.status !== 200 && request.status !== 0) {
          // If you see this warning, the issue may be that you are using locateFile or memoryInitializerPrefixURL, and defining them in JS. That
          // means that the HTML file doesn't know about them, and when it tries to create the mem init request early, does it to the wrong place.
          // Look in your browser's devtools network console to see what's going on.
          console.warn('a problem seems to have happened with Module.memoryInitializerRequest, status: ' + request.status + ', retrying ' + memoryInitializer);
          doBrowserLoad();
          return;
        }
        applyMemoryInitializer(request.response);
      }
      if (Module['memoryInitializerRequest'].response) {
        setTimeout(useRequest, 0); // it's already here; but, apply it asynchronously
      } else {
        Module['memoryInitializerRequest'].addEventListener('load', useRequest); // wait for it
      }
    } else {
      // fetch it from the network ourselves
      doBrowserLoad();
    }
  }
}


function ExitStatus(status) {
  this.name = "ExitStatus";
  this.message = "Program terminated with exit(" + status + ")";
  this.status = status;
};
ExitStatus.prototype = new Error();
ExitStatus.prototype.constructor = ExitStatus;

var initialStackTop;
var preloadStartTime = null;
var calledMain = false;

dependenciesFulfilled = function runCaller() {
  // If run has never been called, and we should call run (INVOKE_RUN is true, and Module.noInitialRun is not false)
  if (!Module['calledRun']) run();
  if (!Module['calledRun']) dependenciesFulfilled = runCaller; // try this again later, after new deps are fulfilled
}

Module['callMain'] = Module.callMain = function callMain(args) {

  args = args || [];

  ensureInitRuntime();

  var argc = args.length+1;
  function pad() {
    for (var i = 0; i < 4-1; i++) {
      argv.push(0);
    }
  }
  var argv = [allocate(intArrayFromString(Module['thisProgram']), 'i8', ALLOC_NORMAL) ];
  pad();
  for (var i = 0; i < argc-1; i = i + 1) {
    argv.push(allocate(intArrayFromString(args[i]), 'i8', ALLOC_NORMAL));
    pad();
  }
  argv.push(0);
  argv = allocate(argv, 'i32', ALLOC_NORMAL);

  var initialEmtStackTop = asm.emtStackSave();

  try {

    var ret = Module['_main'](argc, argv, 0);


    // if we're not running an evented main loop, it's time to exit
    exit(ret, /* implicit = */ true);
  }
  catch(e) {
    if (e instanceof ExitStatus) {
      // exit() throws this once it's done to make sure execution
      // has been stopped completely
      return;
    } else if (e == 'SimulateInfiniteLoop') {
      // running an evented main loop, don't immediately exit
      Module['noExitRuntime'] = true;
      // an infinite loop keeps the C stack around, but the emterpreter stack must be unwound - we do not want to restore the call stack at infinite loop
      asm.emtStackRestore(initialEmtStackTop);
      return;
    } else {
      if (e && typeof e === 'object' && e.stack) Module.printErr('exception thrown: ' + [e, e.stack]);
      throw e;
    }
  } finally {
    calledMain = true;
  }
}




function run(args) {
  args = args || Module['arguments'];

  if (preloadStartTime === null) preloadStartTime = Date.now();

  if (runDependencies > 0) {
    return;
  }


  preRun();

  if (runDependencies > 0) return; // a preRun added a dependency, run will be called later
  if (Module['calledRun']) return; // run may have just been called through dependencies being fulfilled just in this very frame

  function doRun() {
    if (Module['calledRun']) return; // run may have just been called while the async setStatus time below was happening
    Module['calledRun'] = true;

    if (ABORT) return;

    ensureInitRuntime();

    preMain();


    if (Module['onRuntimeInitialized']) Module['onRuntimeInitialized']();

    if (Module['_main'] && shouldRunNow) Module['callMain'](args);

    postRun();
  }

  if (Module['setStatus']) {
    Module['setStatus']('Running...');
    setTimeout(function() {
      setTimeout(function() {
        Module['setStatus']('');
      }, 1);
      doRun();
    }, 1);
  } else {
    doRun();
  }
}
Module['run'] = Module.run = run;

function exit(status, implicit) {
  if (implicit && Module['noExitRuntime']) {
    return;
  }

  if (Module['noExitRuntime']) {
  } else {

    ABORT = true;
    EXITSTATUS = status;
    STACKTOP = initialStackTop;

    exitRuntime();

    if (Module['onExit']) Module['onExit'](status);
  }

  if (ENVIRONMENT_IS_NODE) {
    process['exit'](status);
  } else if (ENVIRONMENT_IS_SHELL && typeof quit === 'function') {
    quit(status);
  }
  // if we reach here, we must throw an exception to halt the current execution
  throw new ExitStatus(status);
}
Module['exit'] = Module.exit = exit;

var abortDecorators = [];

function abort(what) {
  if (what !== undefined) {
    Module.print(what);
    Module.printErr(what);
    what = JSON.stringify(what)
  } else {
    what = '';
  }

  ABORT = true;
  EXITSTATUS = 1;

  var extra = '\nIf this abort() is unexpected, build with -s ASSERTIONS=1 which can give more information.';

  var output = 'abort(' + what + ') at ' + stackTrace() + extra;
  if (abortDecorators) {
    abortDecorators.forEach(function(decorator) {
      output = decorator(output, what);
    });
  }
  throw output;
}
Module['abort'] = Module.abort = abort;

// {{PRE_RUN_ADDITIONS}}

if (Module['preInit']) {
  if (typeof Module['preInit'] == 'function') Module['preInit'] = [Module['preInit']];
  while (Module['preInit'].length > 0) {
    Module['preInit'].pop()();
  }
}

// shouldRunNow refers to calling main(), not run().
var shouldRunNow = true;
if (Module['noInitialRun']) {
  shouldRunNow = false;
}

Module["noExitRuntime"] = true;

run();

// {{POST_RUN_ADDITIONS}}





// {{MODULE_ADDITIONS}}










