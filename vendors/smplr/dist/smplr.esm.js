var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __typeError = (msg) => {
  throw TypeError(msg);
};
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
var __accessCheck = (obj, member, msg) => member.has(obj) || __typeError("Cannot " + msg);
var __privateGet = (obj, member, getter) => (__accessCheck(obj, member, "read from private field"), getter ? getter.call(obj) : member.get(obj));
var __privateAdd = (obj, member, value) => member.has(obj) ? __typeError("Cannot add the same private member more than once") : member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
var __privateSet = (obj, member, value, setter) => (__accessCheck(obj, member, "write to private field"), setter ? setter.call(obj, value) : member.set(obj, value), value);
var __privateMethod = (obj, member, method) => (__accessCheck(obj, member, "access private method"), method);
var __privateWrapper = (obj, member, setter, getter) => ({
  set _(value) {
    __privateSet(obj, member, value, setter);
  },
  get _() {
    return __privateGet(obj, member, getter);
  }
});
var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

// src/smplr/as-constructable.ts
function asConstructable(Klass) {
  function factory(...args) {
    return new Klass(...args);
  }
  return factory;
}

// src/storage.ts
var HttpStorage = {
  fetch(url) {
    return fetch(url);
  }
};
var _cache, _CacheStorageImpl_instances, tryFromCache_fn, saveResponse_fn;
var CacheStorageImpl = class {
  constructor(name = "smplr") {
    __privateAdd(this, _CacheStorageImpl_instances);
    __privateAdd(this, _cache);
    if (typeof window === "undefined" || !("caches" in window)) {
      __privateSet(this, _cache, Promise.reject("CacheStorage not supported"));
      __privateGet(this, _cache).catch(() => {
      });
    } else {
      __privateSet(this, _cache, caches.open(name));
    }
  }
  fetch(url) {
    return __async(this, null, function* () {
      const request = new Request(url);
      try {
        return yield __privateMethod(this, _CacheStorageImpl_instances, tryFromCache_fn).call(this, request);
      } catch (err) {
        const response = yield fetch(request);
        yield __privateMethod(this, _CacheStorageImpl_instances, saveResponse_fn).call(this, request, response);
        return response;
      }
    });
  }
};
_cache = new WeakMap();
_CacheStorageImpl_instances = new WeakSet();
tryFromCache_fn = function(request) {
  return __async(this, null, function* () {
    const cache = yield __privateGet(this, _cache);
    const response = yield cache.match(request);
    if (response) return response;
    else throw Error("Not found");
  });
};
saveResponse_fn = function(request, response) {
  return __async(this, null, function* () {
    try {
      const cache = yield __privateGet(this, _cache);
      yield cache.put(request, response.clone());
    } catch (err) {
    }
  });
};
var CacheStorage = asConstructable(CacheStorageImpl);

// src/smplr/connect.ts
function connectSerial(nodes) {
  const _nodes = nodes.filter((x) => !!x);
  _nodes.reduce((a, b) => {
    const left = "output" in a ? a.output : a;
    const right = "input" in b ? b.input : b;
    left.connect(right);
    return b;
  });
  return () => {
    _nodes.reduce((a, b) => {
      const left = "output" in a ? a.output : a;
      const right = "input" in b ? b.input : b;
      left.disconnect(right);
      return b;
    });
  };
}

// src/smplr/signals.ts
function createControl(initialValue) {
  let current = initialValue;
  const listeners = /* @__PURE__ */ new Set();
  function subscribe(listener) {
    listeners.add(listener);
    listener(current);
    return () => {
      listeners.delete(listener);
    };
  }
  function set(value) {
    current = value;
    listeners.forEach((listener) => listener(current));
  }
  function get() {
    return current;
  }
  return { subscribe, set, get };
}

// src/smplr/volume.ts
function midiVelToGain(vel) {
  return vel * vel / 16129;
}
function dbToGain(decibels) {
  return Math.pow(10, decibels / 20);
}

// src/smplr/channel.ts
var _volume, _panner, _sends, _inserts, _disconnect, _unsubscribe, _config, _volumeControl, _disconnected;
var Channel = class {
  constructor(context, options) {
    this.context = context;
    __privateAdd(this, _volume);
    __privateAdd(this, _panner);
    __privateAdd(this, _sends);
    __privateAdd(this, _inserts);
    __privateAdd(this, _disconnect);
    __privateAdd(this, _unsubscribe);
    __privateAdd(this, _config);
    __privateAdd(this, _volumeControl);
    __privateAdd(this, _disconnected, false);
    var _a, _b, _c, _d;
    __privateSet(this, _config, {
      destination: (_a = options == null ? void 0 : options.destination) != null ? _a : context.destination,
      volume: (_b = options == null ? void 0 : options.volume) != null ? _b : 100,
      volumeToGain: (_c = options == null ? void 0 : options.volumeToGain) != null ? _c : midiVelToGain,
      pan: (_d = options == null ? void 0 : options.pan) != null ? _d : 0
    });
    this.input = context.createGain();
    __privateSet(this, _volume, context.createGain());
    __privateSet(this, _panner, context.createStereoPanner());
    __privateGet(this, _panner).pan.value = __privateGet(this, _config).pan;
    __privateSet(this, _disconnect, connectSerial([
      this.input,
      __privateGet(this, _volume),
      __privateGet(this, _panner),
      __privateGet(this, _config).destination
    ]));
    const volume = createControl(__privateGet(this, _config).volume);
    __privateSet(this, _volumeControl, volume);
    this.setVolume = volume.set;
    __privateSet(this, _unsubscribe, volume.subscribe((volume2) => {
      __privateGet(this, _volume).gain.value = __privateGet(this, _config).volumeToGain(volume2);
    }));
  }
  get volume() {
    return __privateGet(this, _volumeControl).get();
  }
  set volume(value) {
    __privateGet(this, _volumeControl).set(value);
  }
  get pan() {
    return __privateGet(this, _panner).pan.value;
  }
  set pan(value) {
    __privateGet(this, _panner).pan.value = value;
  }
  addInsert(effect) {
    var _a;
    if (__privateGet(this, _disconnected)) {
      throw Error("Can't add insert to disconnected channel");
    }
    (_a = __privateGet(this, _inserts)) != null ? _a : __privateSet(this, _inserts, []);
    __privateGet(this, _inserts).push(effect);
    __privateGet(this, _disconnect).call(this);
    __privateSet(this, _disconnect, connectSerial([
      this.input,
      ...__privateGet(this, _inserts),
      __privateGet(this, _volume),
      __privateGet(this, _panner),
      __privateGet(this, _config).destination
    ]));
  }
  addEffect(name, effect, mixValue) {
    var _a;
    if (__privateGet(this, _disconnected)) {
      throw Error("Can't add effect to disconnected channel");
    }
    const mix = this.context.createGain();
    mix.gain.value = mixValue;
    const input = "input" in effect ? effect.input : effect;
    const disconnect = connectSerial([__privateGet(this, _volume), mix, input]);
    (_a = __privateGet(this, _sends)) != null ? _a : __privateSet(this, _sends, []);
    __privateGet(this, _sends).push({ name, mix, disconnect });
  }
  setEffectMix(name, mix) {
    var _a;
    if (__privateGet(this, _disconnected)) {
      throw Error("Can't send effect to disconnected channel");
    }
    const send = (_a = __privateGet(this, _sends)) == null ? void 0 : _a.find((send2) => send2.name === name);
    if (send) {
      send.mix.gain.value = mix;
    } else {
      console.warn("Send bus not found: " + name);
    }
  }
  /** @deprecated Use `setEffectMix(name, mix)` instead. */
  sendEffect(name, mix) {
    this.setEffectMix(name, mix);
  }
  disconnect() {
    var _a;
    if (__privateGet(this, _disconnected)) return;
    __privateSet(this, _disconnected, true);
    __privateGet(this, _disconnect).call(this);
    __privateGet(this, _unsubscribe).call(this);
    (_a = __privateGet(this, _sends)) == null ? void 0 : _a.forEach((send) => send.disconnect());
    __privateSet(this, _sends, void 0);
  }
};
_volume = new WeakMap();
_panner = new WeakMap();
_sends = new WeakMap();
_inserts = new WeakMap();
_disconnect = new WeakMap();
_unsubscribe = new WeakMap();
_config = new WeakMap();
_volumeControl = new WeakMap();
_disconnected = new WeakMap();

// src/smplr/midi.ts
function noteNameToMidi(note) {
  const REGEX = /^([a-gA-G]?)(#{1,}|b{1,}|)(-?\d+)$/;
  const m = REGEX.exec(note);
  if (!m) return;
  const letter = m[1].toUpperCase();
  if (!letter) return;
  const acc = m[2];
  const alt = acc[0] === "b" ? -acc.length : acc.length;
  const oct = m[3] ? +m[3] : 4;
  const step = (letter.charCodeAt(0) + 3) % 7;
  return [0, 2, 4, 5, 7, 9, 11][step] + alt + 12 * (oct + 1);
}
function toMidi(note) {
  return note === void 0 ? void 0 : typeof note === "number" ? note : noteNameToMidi(note);
}

// src/smplr/params.ts
var PARAM_DEFAULTS = {
  volume: 0,
  tune: 0,
  detune: 0,
  ampRelease: 0.3,
  ampAttack: 0,
  lpfCutoffHz: 2e4,
  offset: 0,
  loop: false,
  loopStart: 0,
  loopEnd: 0,
  reverse: false
};
var PLAYBACK_KEYS = Object.keys(PARAM_DEFAULTS);
function pickPlaybackParams(obj) {
  const result = {};
  for (const key of PLAYBACK_KEYS) {
    const value = obj[key];
    if (value !== void 0) result[key] = value;
  }
  return result;
}
function resolveParams(defaults, group, region, midi, velocity, overrides) {
  var _a, _b, _c, _d, _e, _f;
  const merged = __spreadValues(__spreadValues(__spreadValues(__spreadValues({}, PARAM_DEFAULTS), defaults), pickPlaybackParams(group)), pickPlaybackParams(region));
  const pitch = (_b = (_a = region.pitch) != null ? _a : region.key) != null ? _b : midi;
  const semitones = midi - pitch;
  let detune = (semitones + merged.tune) * 100 + merged.detune;
  if ((overrides == null ? void 0 : overrides.detune) !== void 0) detune += overrides.detune;
  return {
    detune,
    velocity,
    volume: merged.volume,
    ampRelease: (_c = overrides == null ? void 0 : overrides.ampRelease) != null ? _c : merged.ampRelease,
    ampAttack: merged.ampAttack,
    lpfCutoffHz: (_d = overrides == null ? void 0 : overrides.lpfCutoffHz) != null ? _d : merged.lpfCutoffHz,
    offset: merged.offset,
    loop: (_e = overrides == null ? void 0 : overrides.loop) != null ? _e : merged.loop,
    loopStart: merged.loopStart,
    loopEnd: merged.loopEnd,
    ampVelCurve: region.ampVelCurve,
    loopAuto: region.loopAuto,
    reverse: (_f = overrides == null ? void 0 : overrides.reverse) != null ? _f : merged.reverse
  };
}

// src/smplr/region-matcher.ts
function processRegion(region) {
  var _a, _b, _c, _d, _e;
  let keyLow;
  let keyHigh;
  let pitch;
  if (region.key !== void 0) {
    keyLow = keyHigh = region.key;
    pitch = region.key;
  } else if (region.keyRange) {
    [keyLow, keyHigh] = region.keyRange;
    pitch = region.pitch;
  } else {
    keyLow = 0;
    keyHigh = 127;
    pitch = region.pitch;
  }
  return {
    keyLow,
    keyHigh,
    pitch,
    velLow: (_b = (_a = region.velRange) == null ? void 0 : _a[0]) != null ? _b : 0,
    velHigh: (_d = (_c = region.velRange) == null ? void 0 : _c[1]) != null ? _d : 127,
    ccRange: region.ccRange,
    seqPosition: (_e = region.seqPosition) != null ? _e : 1,
    group: region.group,
    offBy: region.offBy,
    sample: region.sample,
    ref: region
  };
}
function processGroup(group) {
  var _a, _b, _c, _d, _e, _f, _g, _h;
  return {
    keyLow: (_b = (_a = group.keyRange) == null ? void 0 : _a[0]) != null ? _b : 0,
    keyHigh: (_d = (_c = group.keyRange) == null ? void 0 : _c[1]) != null ? _d : 127,
    velLow: (_f = (_e = group.velRange) == null ? void 0 : _e[0]) != null ? _f : 0,
    velHigh: (_h = (_g = group.velRange) == null ? void 0 : _g[1]) != null ? _h : 127,
    ccRange: group.ccRange,
    seqLength: group.seqLength,
    group: group.group,
    offBy: group.offBy,
    regions: group.regions.map(processRegion),
    ref: group
  };
}
function matchesCc(ccState, ccRange) {
  var _a;
  if (!ccRange) return true;
  for (const [ccStr, [low, high]] of Object.entries(ccRange)) {
    const cc = parseInt(ccStr, 10);
    const value = (_a = ccState.get(cc)) != null ? _a : 0;
    if (value < low || value > high) return false;
  }
  return true;
}
var _groups, _seqCounters;
var RegionMatcher = class {
  // groupIndex → call count
  constructor(json) {
    __privateAdd(this, _groups);
    __privateAdd(this, _seqCounters);
    __privateSet(this, _groups, json.groups.map(processGroup));
    __privateSet(this, _seqCounters, /* @__PURE__ */ new Map());
  }
  /**
   * Match a note event against all groups and regions.
   *
   * For each group that passes key/vel/cc filters:
   *   - Check each region's key/vel/cc filters
   *   - Apply round-robin seqPosition filter if group.seqLength is set
   *   - Advance the per-group round-robin counter (always, when group matched)
   *
   * Returns all matched regions with resolved pitch, group, offBy.
   */
  match(midi, velocity, ccState) {
    var _a, _b, _c, _d;
    const results = [];
    for (let gi = 0; gi < __privateGet(this, _groups).length; gi++) {
      const group = __privateGet(this, _groups)[gi];
      if (midi < group.keyLow || midi > group.keyHigh) continue;
      if (velocity < group.velLow || velocity > group.velHigh) continue;
      if (!matchesCc(ccState, group.ccRange)) continue;
      const counter = (_a = __privateGet(this, _seqCounters).get(gi)) != null ? _a : 0;
      for (const region of group.regions) {
        if (midi < region.keyLow || midi > region.keyHigh) continue;
        if (velocity < region.velLow || velocity > region.velHigh) continue;
        if (!matchesCc(ccState, region.ccRange)) continue;
        if (group.seqLength !== void 0) {
          const seqPos = region.seqPosition - 1;
          if (counter % group.seqLength !== seqPos) continue;
        }
        results.push({
          sample: region.sample,
          // If no pitch is pre-resolved (no key or pitch on region), fall back to
          // the played note so resolveParams computes 0 semitones of transpose
          pitch: (_b = region.pitch) != null ? _b : midi,
          group: (_c = region.group) != null ? _c : group.group,
          offBy: (_d = region.offBy) != null ? _d : group.offBy,
          groupRef: group.ref,
          regionRef: region.ref
        });
      }
      if (group.seqLength !== void 0) {
        __privateGet(this, _seqCounters).set(gi, counter + 1);
      }
    }
    return results;
  }
};
_groups = new WeakMap();
_seqCounters = new WeakMap();

// src/smplr/load-audio.ts
function loadAudioBuffer(context, url, storage) {
  return __async(this, null, function* () {
    url = url.replace(/#/g, "%23").replace(/ /g, "%20").replace(/([^:]\/)\/+/g, "$1");
    const response = yield storage.fetch(url);
    if (response.status !== 200) {
      console.warn(
        "Error loading buffer. Invalid status: ",
        response.status,
        url
      );
      return;
    }
    try {
      const audioData = yield response.arrayBuffer();
      const buffer = yield context.decodeAudioData(audioData);
      return buffer;
    } catch (error) {
      console.warn("Error loading buffer", error, url);
    }
  });
}
function isSafari() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return ua.includes("Safari") && !ua.includes("Chrome") && !ua.includes("Chromium");
}
function findFirstSupportedFormat(formats) {
  if (typeof document === "undefined") return null;
  const skipOgg = isSafari();
  const audio = document.createElement("audio");
  for (let i = 0; i < formats.length; i++) {
    const format = formats[i];
    if (skipOgg && format === "ogg") {
      continue;
    }
    const canPlay = audio.canPlayType(`audio/${format}`);
    if (canPlay === "probably" || canPlay === "maybe") {
      return format;
    }
    if (format === "m4a") {
      const canPlay2 = audio.canPlayType(`audio/aac`);
      if (canPlay2 === "probably" || canPlay2 === "maybe") {
        return format;
      }
    }
  }
  return null;
}

// src/smplr/sample-loader.ts
var _context, _storage, _cache2;
var SampleLoaderImpl = class {
  constructor(context, options) {
    __privateAdd(this, _context);
    __privateAdd(this, _storage);
    __privateAdd(this, _cache2, /* @__PURE__ */ new Map());
    var _a;
    __privateSet(this, _context, context);
    __privateSet(this, _storage, (_a = options == null ? void 0 : options.storage) != null ? _a : HttpStorage);
  }
  load(json, onProgressOrOptions) {
    return __async(this, null, function* () {
      var _a, _b;
      const preloaded = typeof onProgressOrOptions === "object" ? onProgressOrOptions.buffers : void 0;
      const onProgress = typeof onProgressOrOptions === "function" ? onProgressOrOptions : onProgressOrOptions == null ? void 0 : onProgressOrOptions.onProgress;
      const format = (_b = (_a = findFirstSupportedFormat(json.samples.formats)) != null ? _a : json.samples.formats[0]) != null ? _b : "ogg";
      const base = json.samples.baseUrl.replace(/\/$/, "");
      const names = collectSampleNames(json);
      const total = names.length;
      let loaded = 0;
      const result = /* @__PURE__ */ new Map();
      yield Promise.all(
        names.map((name) => __async(this, null, function* () {
          var _a2, _b2;
          const pre = preloaded == null ? void 0 : preloaded.get(name);
          if (pre) {
            result.set(name, pre);
            loaded++;
            onProgress == null ? void 0 : onProgress(loaded, total);
            return;
          }
          const path = (_b2 = (_a2 = json.samples.map) == null ? void 0 : _a2[name]) != null ? _b2 : name;
          const url = `${base}/${path}.${format}`;
          let buffer = __privateGet(this, _cache2).get(url);
          if (!buffer) {
            const fetched = yield loadAudioBuffer(
              __privateGet(this, _context),
              url,
              __privateGet(this, _storage)
            );
            if (fetched) {
              buffer = fetched;
              __privateGet(this, _cache2).set(url, buffer);
            }
          }
          if (buffer) result.set(name, buffer);
          loaded++;
          onProgress == null ? void 0 : onProgress(loaded, total);
        }))
      );
      return result;
    });
  }
};
_context = new WeakMap();
_storage = new WeakMap();
_cache2 = new WeakMap();
function collectSampleNames(json) {
  const seen = /* @__PURE__ */ new Set();
  for (const group of json.groups) {
    for (const region of group.regions) {
      seen.add(region.sample);
    }
  }
  return [...seen];
}
var SampleLoader = asConstructable(SampleLoaderImpl);

// src/smplr/sorted-queue.ts
var _items;
var SortedQueue = class {
  constructor(compare) {
    this.compare = compare;
    __privateAdd(this, _items, []);
  }
  push(item) {
    const len = __privateGet(this, _items).length;
    let left = 0;
    let right = len - 1;
    let index = len;
    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      if (this.compare(item, __privateGet(this, _items)[mid]) < 0) {
        index = mid;
        right = mid - 1;
      } else {
        left = mid + 1;
      }
    }
    __privateGet(this, _items).splice(index, 0, item);
  }
  pop() {
    return __privateGet(this, _items).shift();
  }
  peek() {
    return __privateGet(this, _items)[0];
  }
  removeAll(predicate) {
    const len = __privateGet(this, _items).length;
    __privateSet(this, _items, __privateGet(this, _items).filter((item) => !predicate(item)));
    return __privateGet(this, _items).length !== len;
  }
  clear() {
    __privateSet(this, _items, []);
  }
  size() {
    return __privateGet(this, _items).length;
  }
};
_items = new WeakMap();

// src/smplr/scheduler.ts
var LOOKAHEAD_MS_DEFAULT = 200;
var INTERVAL_MS_DEFAULT = 50;
var _context2, _lookaheadSec, _intervalMs, _queue, _intervalId, _SchedulerImpl_instances, ensureRunning_fn;
var SchedulerImpl = class {
  constructor(context, options) {
    __privateAdd(this, _SchedulerImpl_instances);
    __privateAdd(this, _context2);
    __privateAdd(this, _lookaheadSec);
    __privateAdd(this, _intervalMs);
    __privateAdd(this, _queue);
    __privateAdd(this, _intervalId);
    var _a, _b;
    __privateSet(this, _context2, context);
    __privateSet(this, _lookaheadSec, ((_a = options == null ? void 0 : options.lookaheadMs) != null ? _a : LOOKAHEAD_MS_DEFAULT) / 1e3);
    __privateSet(this, _intervalMs, (_b = options == null ? void 0 : options.intervalMs) != null ? _b : INTERVAL_MS_DEFAULT);
    __privateSet(this, _queue, new SortedQueue((a, b) => a.time - b.time));
  }
  schedule(event, callback) {
    var _a;
    const now = __privateGet(this, _context2).currentTime;
    const time = (_a = getEventTime(event)) != null ? _a : now;
    if (time <= now + __privateGet(this, _lookaheadSec)) {
      callback(event);
      return noOp;
    }
    const item = { time, event, callback };
    __privateGet(this, _queue).push(item);
    __privateMethod(this, _SchedulerImpl_instances, ensureRunning_fn).call(this);
    return () => {
      __privateGet(this, _queue).removeAll((q) => q === item);
    };
  }
  stop() {
    __privateGet(this, _queue).clear();
    if (__privateGet(this, _intervalId) !== void 0) {
      clearInterval(__privateGet(this, _intervalId));
      __privateSet(this, _intervalId, void 0);
    }
  }
};
_context2 = new WeakMap();
_lookaheadSec = new WeakMap();
_intervalMs = new WeakMap();
_queue = new WeakMap();
_intervalId = new WeakMap();
_SchedulerImpl_instances = new WeakSet();
ensureRunning_fn = function() {
  if (__privateGet(this, _intervalId) !== void 0) return;
  __privateSet(this, _intervalId, setInterval(() => {
    const dispatchBefore = __privateGet(this, _context2).currentTime + __privateGet(this, _lookaheadSec);
    while (__privateGet(this, _queue).size() > 0 && __privateGet(this, _queue).peek().time <= dispatchBefore) {
      const item = __privateGet(this, _queue).pop();
      item.callback(item.event);
    }
    if (__privateGet(this, _queue).size() === 0) {
      clearInterval(__privateGet(this, _intervalId));
      __privateSet(this, _intervalId, void 0);
    }
  }, __privateGet(this, _intervalMs)));
};
function getEventTime(event) {
  return typeof event === "object" ? event.time : void 0;
}
var noOp = () => {
};
var Scheduler = asConstructable(SchedulerImpl);

// src/smplr/voice.ts
var _context3, _source, _envelope, _startAt, _ampRelease, _state, _endedCallbacks;
var Voice = class {
  constructor(context, buffer, params, destination, stopId, group, startTime) {
    __privateAdd(this, _context3);
    __privateAdd(this, _source);
    __privateAdd(this, _envelope);
    __privateAdd(this, _startAt);
    __privateAdd(this, _ampRelease);
    __privateAdd(this, _state, "playing");
    __privateAdd(this, _endedCallbacks, []);
    __privateSet(this, _context3, context);
    this.stopId = stopId;
    this.group = group;
    __privateSet(this, _ampRelease, params.ampRelease);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const cents = params.detune;
    if (source.detune) {
      source.detune.value = cents;
    } else {
      source.playbackRate.value = Math.pow(2, cents / 1200);
    }
    if (params.loopAuto) {
      source.loop = true;
      source.loopStart = buffer.duration * params.loopAuto.startRatio;
      source.loopEnd = buffer.duration * params.loopAuto.endRatio;
    } else if (params.loop) {
      source.loop = true;
      source.loopStart = params.loopStart;
      source.loopEnd = params.loopEnd || buffer.duration;
    }
    let lpf;
    if (params.lpfCutoffHz < 2e4) {
      lpf = context.createBiquadFilter();
      lpf.type = "lowpass";
      lpf.frequency.value = params.lpfCutoffHz;
    }
    const gain = context.createGain();
    gain.gain.value = midiVelToGain(params.velocity) * dbToGain(params.volume);
    const envelope = context.createGain();
    envelope.gain.value = 1;
    if (lpf) {
      source.connect(lpf);
      lpf.connect(gain);
    } else {
      source.connect(gain);
    }
    gain.connect(envelope);
    envelope.connect(destination);
    const startAt = startTime != null ? startTime : context.currentTime;
    __privateSet(this, _startAt, startAt);
    let offsetSec = 0;
    if (params.offset > 0) {
      offsetSec = params.reverse ? (buffer.length - params.offset) / buffer.sampleRate : params.offset / buffer.sampleRate;
    }
    source.start(startAt, offsetSec);
    __privateSet(this, _source, source);
    __privateSet(this, _envelope, envelope);
    source.onended = () => {
      __privateSet(this, _state, "stopped");
      envelope.disconnect();
      gain.disconnect();
      lpf == null ? void 0 : lpf.disconnect();
      source.disconnect();
      for (const cb of __privateGet(this, _endedCallbacks)) cb();
      __privateSet(this, _endedCallbacks, []);
    };
  }
  /**
   * Stop the voice, applying a release envelope if time is after the start time.
   * Idempotent — subsequent calls after the first are ignored.
   */
  stop(time) {
    if (__privateGet(this, _state) !== "playing") return;
    __privateSet(this, _state, "stopping");
    const t = time != null ? time : __privateGet(this, _context3).currentTime;
    if (t <= __privateGet(this, _startAt)) {
      __privateGet(this, _source).stop(t);
    } else {
      const stopAt = t + __privateGet(this, _ampRelease);
      __privateGet(this, _envelope).gain.cancelScheduledValues(t);
      __privateGet(this, _envelope).gain.setValueAtTime(1, t);
      __privateGet(this, _envelope).gain.linearRampToValueAtTime(0, stopAt);
      __privateGet(this, _source).stop(stopAt);
    }
  }
  /**
   * Register a callback to be called when the source node fires its onended event.
   * If the voice has already stopped, the callback is invoked immediately.
   */
  onEnded(cb) {
    if (__privateGet(this, _state) === "stopped") {
      cb();
    } else {
      __privateGet(this, _endedCallbacks).push(cb);
    }
  }
  get isActive() {
    return __privateGet(this, _state) !== "stopped";
  }
};
_context3 = new WeakMap();
_source = new WeakMap();
_envelope = new WeakMap();
_startAt = new WeakMap();
_ampRelease = new WeakMap();
_state = new WeakMap();
_endedCallbacks = new WeakMap();

// src/smplr/voice-manager.ts
var _voices, _byStopId, _byGroup, _VoiceManager_instances, remove_fn;
var VoiceManager = class {
  constructor() {
    __privateAdd(this, _VoiceManager_instances);
    __privateAdd(this, _voices, /* @__PURE__ */ new Set());
    __privateAdd(this, _byStopId, /* @__PURE__ */ new Map());
    __privateAdd(this, _byGroup, /* @__PURE__ */ new Map());
  }
  /**
   * Register a voice. Indexes it by stopId and group, then auto-removes it
   * when the voice fires its onEnded callback.
   */
  add(voice) {
    __privateGet(this, _voices).add(voice);
    getOrCreate(__privateGet(this, _byStopId), voice.stopId).add(voice);
    if (voice.group !== void 0) {
      getOrCreate(__privateGet(this, _byGroup), voice.group).add(voice);
    }
    voice.onEnded(() => __privateMethod(this, _VoiceManager_instances, remove_fn).call(this, voice));
  }
  /** Stop all active voices. */
  stopAll(time) {
    for (const voice of [...__privateGet(this, _voices)]) {
      voice.stop(time);
    }
  }
  /** Stop all voices whose stopId matches. */
  stopById(stopId, time) {
    const voices = __privateGet(this, _byStopId).get(stopId);
    if (!voices) return;
    for (const voice of [...voices]) {
      voice.stop(time);
    }
  }
  /** Stop all voices that belong to an exclusive group number. */
  stopGroup(group, time) {
    const voices = __privateGet(this, _byGroup).get(group);
    if (!voices) return;
    for (const voice of [...voices]) {
      voice.stop(time);
    }
  }
  /** Number of voices currently tracked (includes stopping voices not yet ended). */
  get activeCount() {
    return __privateGet(this, _voices).size;
  }
};
_voices = new WeakMap();
_byStopId = new WeakMap();
_byGroup = new WeakMap();
_VoiceManager_instances = new WeakSet();
remove_fn = function(voice) {
  var _a, _b;
  __privateGet(this, _voices).delete(voice);
  (_a = __privateGet(this, _byStopId).get(voice.stopId)) == null ? void 0 : _a.delete(voice);
  if (voice.group !== void 0) {
    (_b = __privateGet(this, _byGroup).get(voice.group)) == null ? void 0 : _b.delete(voice);
  }
};
function getOrCreate(map, key) {
  let set = map.get(key);
  if (!set) {
    set = /* @__PURE__ */ new Set();
    map.set(key, set);
  }
  return set;
}

// src/smplr/smplr.ts
function compose(a, b) {
  if (a && b)
    return (e) => {
      a(e);
      b(e);
    };
  return a != null ? a : b;
}
var EMPTY_JSON = {
  samples: { baseUrl: "", formats: [] },
  groups: []
};
function isSmplrJson(x) {
  return typeof x === "object" && x !== null && "groups" in x && Array.isArray(x.groups);
}
var _loadProgress, _loadToken, _buffers, _reversedBuffers, _defaults, _defaultVelocity, _aliases, _matcher, _voices2, _channel, _onLoadProgress, _onStart, _onEnded, _ccState, _disposed, _SmplrImpl_instances, assertNotDisposed_fn, getBuffer_fn, playNote_fn, normalizeNoteEvent_fn;
var SmplrImpl = class {
  constructor(context, jsonOrOptions, maybeOptions) {
    __privateAdd(this, _SmplrImpl_instances);
    __privateAdd(this, _loadProgress, { loaded: 0, total: 0 });
    __privateAdd(this, _loadToken, 0);
    __privateAdd(this, _buffers, /* @__PURE__ */ new Map());
    __privateAdd(this, _reversedBuffers, /* @__PURE__ */ new Map());
    __privateAdd(this, _defaults);
    __privateAdd(this, _defaultVelocity);
    __privateAdd(this, _aliases);
    __privateAdd(this, _matcher);
    __privateAdd(this, _voices2);
    __privateAdd(this, _channel);
    __privateAdd(this, _onLoadProgress);
    __privateAdd(this, _onStart);
    __privateAdd(this, _onEnded);
    __privateAdd(this, _ccState, /* @__PURE__ */ new Map());
    __privateAdd(this, _disposed, false);
    var _a, _b, _c;
    const json = isSmplrJson(jsonOrOptions) ? jsonOrOptions : void 0;
    const options = isSmplrJson(jsonOrOptions) ? maybeOptions : jsonOrOptions;
    this.context = context;
    __privateSet(this, _defaults, json == null ? void 0 : json.defaults);
    __privateSet(this, _defaultVelocity, (_a = options == null ? void 0 : options.velocity) != null ? _a : 100);
    __privateSet(this, _onLoadProgress, options == null ? void 0 : options.onLoadProgress);
    __privateSet(this, _onStart, options == null ? void 0 : options.onStart);
    __privateSet(this, _onEnded, options == null ? void 0 : options.onEnded);
    if (json == null ? void 0 : json.aliases) {
      __privateSet(this, _aliases, new Map(Object.entries(json.aliases)));
    }
    __privateSet(this, _channel, new Channel(context, {
      destination: options == null ? void 0 : options.destination,
      volume: options == null ? void 0 : options.volume,
      volumeToGain: options == null ? void 0 : options.volumeToGain,
      pan: options == null ? void 0 : options.pan
    }));
    this.scheduler = (_b = options == null ? void 0 : options.scheduler) != null ? _b : Scheduler(context);
    __privateSet(this, _matcher, new RegionMatcher(json != null ? json : EMPTY_JSON));
    __privateSet(this, _voices2, new VoiceManager());
    this.loader = (_c = options == null ? void 0 : options.loader) != null ? _c : SampleLoader(context, { storage: options == null ? void 0 : options.storage });
    if (json) {
      this.ready = this.loader.load(json, {
        onProgress: (loaded, total) => {
          var _a2;
          __privateSet(this, _loadProgress, { loaded, total });
          (_a2 = __privateGet(this, _onLoadProgress)) == null ? void 0 : _a2.call(this, { loaded, total });
        }
      }).then((buffers) => {
        __privateSet(this, _buffers, buffers);
      });
    } else {
      this.ready = Promise.resolve();
    }
  }
  /**
   * @deprecated Use {@link ready} instead. Returns a Promise that resolves
   * to this instance for compatibility with `const x = await new X(ctx).load`.
   */
  get load() {
    return this.ready.then(() => this);
  }
  /**
   * @internal — only the {@link Instrument} builder should call this. Replaces
   * the `ready` promise after plugin setup completes.
   */
  _setReady(p) {
    this.ready = p;
  }
  /**
   * Load (or replace) the instrument descriptor. All state (matcher, defaults,
   * aliases, reversed-buffer cache, sample buffers) swaps atomically when the
   * load resolves. Concurrent calls are serialized: only the latest call's
   * result is committed; earlier in-flight calls resolve but do not mutate
   * state.
   *
   * Pre-loaded buffers (e.g. base64-decoded) can be passed via the `buffers`
   * parameter — those skip the fetch step.
   */
  loadInstrument(json, buffers) {
    __privateMethod(this, _SmplrImpl_instances, assertNotDisposed_fn).call(this, "load an instrument");
    const token = ++__privateWrapper(this, _loadToken)._;
    return this.loader.load(json, {
      buffers,
      onProgress: (loaded, total) => {
        var _a;
        __privateSet(this, _loadProgress, { loaded, total });
        (_a = __privateGet(this, _onLoadProgress)) == null ? void 0 : _a.call(this, { loaded, total });
      }
    }).then((newBuffers) => {
      if (token !== __privateGet(this, _loadToken)) return;
      __privateSet(this, _defaults, json.defaults);
      __privateSet(this, _aliases, json.aliases ? new Map(Object.entries(json.aliases)) : void 0);
      __privateSet(this, _matcher, new RegionMatcher(json));
      __privateSet(this, _reversedBuffers, /* @__PURE__ */ new Map());
      __privateSet(this, _buffers, newBuffers);
    });
  }
  /** Current loading progress snapshot. `total` is known before loading starts. */
  get loadProgress() {
    return __privateGet(this, _loadProgress);
  }
  /** The output channel — use to add effects, adjust volume, or route audio. */
  get output() {
    return __privateGet(this, _channel);
  }
  /**
   * Set a MIDI CC value. Affects region matching for groups/regions that have
   * ccRange constraints (e.g. CC64 sustain pedal).
   */
  setCC(cc, value) {
    __privateMethod(this, _SmplrImpl_instances, assertNotDisposed_fn).call(this, "set CC");
    __privateGet(this, _ccState).set(cc, value);
  }
  /**
   * Read the latest value set via {@link setCC}. Returns `0` for any CC that
   * has not been set (matches MIDI's "undefined controller defaults to 0"
   * convention).
   */
  getCC(cc) {
    var _a;
    __privateMethod(this, _SmplrImpl_instances, assertNotDisposed_fn).call(this, "read CC");
    return (_a = __privateGet(this, _ccState).get(cc)) != null ? _a : 0;
  }
  /**
   * Set the cents detune applied to every future note. Mutates the instrument's
   * playback defaults in place; takes effect on notes scheduled after the call.
   * In-flight notes are unaffected.
   */
  setDetune(cents) {
    __privateMethod(this, _SmplrImpl_instances, assertNotDisposed_fn).call(this, "set detune");
    if (!__privateGet(this, _defaults)) __privateSet(this, _defaults, {});
    __privateGet(this, _defaults).detune = cents;
  }
  /**
   * Set whether every future note plays its sample reversed. The reversed-buffer
   * cache is populated lazily on demand; no cache invalidation is needed in
   * either direction.
   */
  setReverse(reverse) {
    __privateMethod(this, _SmplrImpl_instances, assertNotDisposed_fn).call(this, "set reverse");
    if (!__privateGet(this, _defaults)) __privateSet(this, _defaults, {});
    __privateGet(this, _defaults).reverse = reverse;
  }
  /**
   * Start playing a note. Returns a StopFn that cancels the note if it hasn't
   * played yet, or stops the resulting voices if it has.
   */
  start(event) {
    __privateMethod(this, _SmplrImpl_instances, assertNotDisposed_fn).call(this, "start a note");
    const normalized = __privateMethod(this, _SmplrImpl_instances, normalizeNoteEvent_fn).call(this, event);
    const schedulerStop = this.scheduler.schedule(
      normalized,
      (e) => __privateMethod(this, _SmplrImpl_instances, playNote_fn).call(this, e)
    );
    return (time) => {
      schedulerStop();
      __privateGet(this, _voices2).stopById(normalized.stopId, time);
    };
  }
  /**
   * Stop voices.
   *
   * - No argument → stop all active voices
   * - String or number → stop all voices with that stopId
   * - `{ stopId }` → stop voices with that stopId, optionally at a future time
   * - `{ time }` (no stopId) → stop all voices at a future time
   */
  stop(target) {
    __privateMethod(this, _SmplrImpl_instances, assertNotDisposed_fn).call(this, "stop voices");
    if (target === void 0) {
      __privateGet(this, _voices2).stopAll();
    } else if (typeof target === "string" || typeof target === "number") {
      __privateGet(this, _voices2).stopById(target);
    } else {
      if (target.stopId !== void 0) {
        __privateGet(this, _voices2).stopById(target.stopId, target.time);
      } else {
        __privateGet(this, _voices2).stopAll(target.time);
      }
    }
  }
  /**
   * Stop all voices, dispose the output channel, and stop the scheduler.
   * The instance must not be used after this call — subsequent
   * `start`/`stop`/`setCC`/`getCC`/`loadInstrument` calls throw.
   * Subsequent `dispose()` calls are no-ops.
   */
  dispose() {
    if (__privateGet(this, _disposed)) return;
    __privateSet(this, _disposed, true);
    __privateGet(this, _voices2).stopAll();
    __privateGet(this, _channel).disconnect();
    this.scheduler.stop();
  }
  /** @deprecated Use {@link dispose} instead. */
  disconnect() {
    this.dispose();
  }
};
_loadProgress = new WeakMap();
_loadToken = new WeakMap();
_buffers = new WeakMap();
_reversedBuffers = new WeakMap();
_defaults = new WeakMap();
_defaultVelocity = new WeakMap();
_aliases = new WeakMap();
_matcher = new WeakMap();
_voices2 = new WeakMap();
_channel = new WeakMap();
_onLoadProgress = new WeakMap();
_onStart = new WeakMap();
_onEnded = new WeakMap();
_ccState = new WeakMap();
_disposed = new WeakMap();
_SmplrImpl_instances = new WeakSet();
assertNotDisposed_fn = function(action) {
  if (__privateGet(this, _disposed)) {
    throw Error(`Cannot ${action} on a disposed Smplr instance.`);
  }
};
getBuffer_fn = function(sample, reverse) {
  if (!reverse) return __privateGet(this, _buffers).get(sample);
  const cached = __privateGet(this, _reversedBuffers).get(sample);
  if (cached) return cached;
  const original = __privateGet(this, _buffers).get(sample);
  if (!original) return void 0;
  const reversed = this.context.createBuffer(
    original.numberOfChannels,
    original.length,
    original.sampleRate
  );
  for (let ch = 0; ch < original.numberOfChannels; ch++) {
    const data = original.getChannelData(ch).slice().reverse();
    reversed.copyToChannel(data, ch);
  }
  __privateGet(this, _reversedBuffers).set(sample, reversed);
  return reversed;
};
playNote_fn = function(event) {
  var _a, _b;
  const {
    midi,
    velocity,
    time,
    stopId,
    duration,
    detune,
    lpfCutoffHz,
    loop,
    ampRelease,
    reverse,
    onStart,
    onEnded
  } = event;
  const matches = __privateGet(this, _matcher).match(midi, velocity, __privateGet(this, _ccState));
  for (const match of matches) {
    if (match.offBy !== void 0) {
      __privateGet(this, _voices2).stopGroup(match.offBy, time);
    }
  }
  let voiceStarted = false;
  const effectiveReverse = (_b = reverse != null ? reverse : (_a = __privateGet(this, _defaults)) == null ? void 0 : _a.reverse) != null ? _b : false;
  for (const match of matches) {
    const buffer = __privateMethod(this, _SmplrImpl_instances, getBuffer_fn).call(this, match.sample, effectiveReverse);
    if (!buffer) continue;
    const params = resolveParams(
      __privateGet(this, _defaults),
      match.groupRef,
      match.regionRef,
      midi,
      velocity,
      { detune, lpfCutoffHz, loop, ampRelease, reverse }
    );
    const voice = new Voice(
      this.context,
      buffer,
      params,
      __privateGet(this, _channel).input,
      stopId,
      match.group,
      time
    );
    __privateGet(this, _voices2).add(voice);
    if (!voiceStarted) {
      onStart == null ? void 0 : onStart(event);
      voiceStarted = true;
    }
    if (onEnded) {
      voice.onEnded(() => onEnded(event));
    }
    if (duration != null) {
      const startT = time != null ? time : this.context.currentTime;
      const releaseAt = startT + duration;
      voice.stop(releaseAt);
    }
  }
};
normalizeNoteEvent_fn = function(event) {
  var _a, _b, _c, _d, _e, _f, _g, _h;
  if (typeof event === "string" || typeof event === "number") {
    const midi2 = (_c = (_b = toMidi(event)) != null ? _b : (_a = __privateGet(this, _aliases)) == null ? void 0 : _a.get(String(event))) != null ? _c : 0;
    return {
      note: event,
      midi: midi2,
      velocity: __privateGet(this, _defaultVelocity),
      stopId: event,
      onStart: __privateGet(this, _onStart),
      onEnded: __privateGet(this, _onEnded)
    };
  }
  const midi = (_f = (_e = toMidi(event.note)) != null ? _e : (_d = __privateGet(this, _aliases)) == null ? void 0 : _d.get(String(event.note))) != null ? _f : 0;
  return __spreadProps(__spreadValues({}, event), {
    midi,
    velocity: (_g = event.velocity) != null ? _g : __privateGet(this, _defaultVelocity),
    stopId: (_h = event.stopId) != null ? _h : event.note,
    onStart: compose(__privateGet(this, _onStart), event.onStart),
    onEnded: compose(__privateGet(this, _onEnded), event.onEnded)
  });
};

// src/smplr/instrument.ts
var SMPLR_OPTION_KEYS = [
  "storage",
  "destination",
  "volume",
  "volumeToGain",
  "pan",
  "velocity",
  "loader",
  "scheduler",
  "onLoadProgress",
  "onStart",
  "onEnded"
];
function splitOptions(options) {
  const src = options != null ? options : {};
  const smplrOpts = {};
  for (const key of SMPLR_OPTION_KEYS) {
    if (key in src) smplrOpts[key] = src[key];
  }
  return { smplrOpts, pluginOpts: options };
}
function isPromise(x) {
  return typeof x === "object" && x !== null && typeof x.then === "function";
}
function mergeExtras(target, extras) {
  for (const key of Object.getOwnPropertyNames(extras)) {
    const desc = Object.getOwnPropertyDescriptor(extras, key);
    if (desc) Object.defineProperty(target, key, desc);
  }
}
function Instrument(plugin) {
  function factory(ctx, options) {
    const { smplrOpts, pluginOpts } = splitOptions(
      options != null ? options : {}
    );
    const smplr = new SmplrImpl(ctx, smplrOpts);
    const result = plugin(ctx, pluginOpts, smplr);
    let readyPromise = Promise.resolve();
    if (result != null) {
      if (isPromise(result)) {
        readyPromise = result;
      } else if (typeof result === "object") {
        const maybe = result;
        if (maybe.extras) mergeExtras(smplr, maybe.extras);
        if (isPromise(maybe.ready)) readyPromise = maybe.ready;
      }
    }
    smplr._setReady(readyPromise);
    return smplr;
  }
  return factory;
}

// src/drum-machine/dm-instrument.ts
function isDrumMachineInstrument(instrument) {
  return typeof instrument === "object" && typeof instrument.baseUrl === "string" && typeof instrument.name === "string" && Array.isArray(instrument.samples) && Array.isArray(instrument.groupNames) && typeof instrument.nameToSampleName === "object" && typeof instrument.sampleGroupVariations === "object";
}
var EMPTY_INSTRUMENT = {
  baseUrl: "",
  name: "",
  samples: [],
  groupNames: [],
  nameToSampleName: {},
  sampleGroupVariations: {}
};
function fetchDrumMachineInstrument(url, storage) {
  return __async(this, null, function* () {
    var _a, _b, _c, _d;
    const res = yield storage.fetch(url);
    const json = yield res.json();
    json.baseUrl = url.replace("/dm.json", "");
    json.groupNames = [];
    json.nameToSampleName = {};
    json.sampleGroupVariations = {};
    for (const sample of json.samples) {
      json.nameToSampleName[sample] = sample;
      const separator = sample.indexOf("/") !== -1 ? "/" : "-";
      const [base, variation] = sample.split(separator);
      if (!json.groupNames.includes(base)) {
        json.groupNames.push(base);
      }
      (_b = (_a = json.nameToSampleName)[base]) != null ? _b : _a[base] = sample;
      (_d = (_c = json.sampleGroupVariations)[base]) != null ? _d : _c[base] = [];
      if (variation) {
        json.sampleGroupVariations[base].push(`${base}${separator}${variation}`);
      }
    }
    return json;
  });
}

// src/drum-machine/drum-machine.ts
function getDrumMachineNames() {
  return Object.keys(INSTRUMENTS);
}
var INSTRUMENTS = {
  "TR-808": "https://smpldsnds.github.io/drum-machines/TR-808/dm.json",
  "Casio-RZ1": "https://smpldsnds.github.io/drum-machines/Casio-RZ1/dm.json",
  "LM-2": "https://smpldsnds.github.io/drum-machines/LM-2/dm.json",
  "MFB-512": "https://smpldsnds.github.io/drum-machines/MFB-512/dm.json",
  "Roland CR-8000": "https://smpldsnds.github.io/drum-machines/Roland-CR-8000/dm.json"
};
function getConfig(options) {
  var _a, _b, _c;
  const config = {
    instrument: (_a = options == null ? void 0 : options.instrument) != null ? _a : "TR-808",
    storage: (_b = options == null ? void 0 : options.storage) != null ? _b : HttpStorage,
    url: (_c = options == null ? void 0 : options.url) != null ? _c : ""
  };
  if (typeof config.instrument === "string") {
    config.url || (config.url = INSTRUMENTS[config.instrument]);
    if (!config.url)
      throw new Error("Invalid instrument: " + config.instrument);
  } else if (!isDrumMachineInstrument(config.instrument)) {
    throw new Error("Invalid instrument: " + config.instrument);
  }
  return config;
}
var DrumMachine = Instrument(
  (ctx, options = {}, smplr) => {
    const config = getConfig(options);
    let instrument = EMPTY_INSTRUMENT;
    const baseStart = smplr.start.bind(smplr);
    const extras = {
      getSampleNames: () => instrument.samples.slice(),
      getGroupNames: () => instrument.groupNames.slice(),
      getSampleNamesForGroup: (groupName) => {
        var _a;
        return (_a = instrument.sampleGroupVariations[groupName]) != null ? _a : [];
      },
      // Override start() to inject stopId so re-triggering the same drum
      // cuts the previous voice (one-shot-per-drum semantic).
      start: (sample) => {
        var _a;
        const s = typeof sample === "object" ? sample : { note: sample };
        return baseStart(__spreadProps(__spreadValues({}, s), {
          stopId: (_a = s.stopId) != null ? _a : s.note
        }));
      }
    };
    const instrumentPromise = isDrumMachineInstrument(config.instrument) ? Promise.resolve(config.instrument) : fetchDrumMachineInstrument(config.url, config.storage);
    const ready = instrumentPromise.then((inst) => {
      instrument = inst;
      return smplr.loadInstrument(drumMachineToPreset(inst));
    });
    return { extras, ready };
  }
);
function drumMachineToPreset(instrument) {
  const aliases = {};
  const regions = [];
  const BASE_MIDI = 36;
  instrument.samples.forEach((sampleName, i) => {
    const midi = BASE_MIDI + i;
    aliases[sampleName] = midi;
    regions.push({
      sample: sampleName,
      keyRange: [midi, midi],
      pitch: midi
    });
  });
  for (const [groupName, firstSample] of Object.entries(
    instrument.nameToSampleName
  )) {
    if (firstSample) {
      const idx = instrument.samples.indexOf(firstSample);
      if (idx >= 0) {
        aliases[groupName] = BASE_MIDI + idx;
      }
    }
  }
  return {
    samples: {
      baseUrl: instrument.baseUrl,
      formats: ["ogg", "m4a"]
    },
    groups: [{ regions }],
    aliases
  };
}

// src/drum-abuse/index.ts
var DEFAULT_BASE_URL = "https://smpldsnds.github.io";
var MIDI_BASE = 36;
var DRUM_ABUSE_PACKS = [
  "vol1",
  "vol2",
  "vol3",
  "vol4",
  "vol5"
];
var MACHINES_BY_PACK = {
  vol1: [
    "4-inthefloor-percussioncombo",
    "ace-tone-rhythm-ace-fr-1",
    "ace-tone-rhythm-ace-fr-7l",
    "ace-tone-rhythm-ace-fr6",
    "ace-tone-rhythm-king",
    "ace-tone-rhythm-master",
    "antonelli-2377",
    "arp-axxe",
    "conn-min-o-matic",
    "eko-compu-rhythm",
    "eko-ritmo-12",
    "eko-ritmo-20",
    "elgam-carousel",
    "emu-modular",
    "farfisa-pro",
    "farfisa-rhythm-10",
    "farfisa-rhythm-maker-16",
    "gibson-maestro-g-2",
    "gibson-maestro-rhythm-jester",
    "gibson-maestro-rhythm-king-mrk-1",
    "gulbransen-organ",
    "hammond-rhythm",
    "hammond-rhythm-ii",
    "hohner-automatic-rhythm-player",
    "jen-sx-1000",
    "kay-r-8",
    "keio-checkmate",
    "kent-k-200",
    "kent-rhythm-master",
    "korg-kr-33",
    "korg-krz",
    "korg-minipops-series",
    "korg-s-3",
    "korg-univox-micro-rhythmer-12",
    "korg-univox-sr-120",
    "korg-univox-sr-95",
    "luxor-passat",
    "moog-modular-55",
    "roland-arr",
    "roland-edp-1",
    "roland-sh-3a",
    "roland-system-100",
    "roland-tr-1-prototype",
    "roland-tr-33",
    "roland-tr-41-prototype",
    "roland-tr-66",
    "roland-tr-77",
    "seeburg-rhythm-prince",
    "seeburg-select-a-rhythm",
    "solton-disco-64",
    "sonor-mini-mammut-module",
    "video-tech-rythmic-10",
    "vox-percussion-king",
    "whippany-melo-sonic-350",
    "wurlitzer-swinging-rhythm",
    "yamaha-cs-15d",
    "yamaha-cs-5",
    "yamaha-cs-6",
    "yamaha-ps-1",
    "yamaha-ps-2",
    "yamaha-ps-3"
  ],
  vol2: [
    "bontempi-hf222",
    "boss-dr-55",
    "casio-mt-18",
    "casio-pt-30",
    "casio-vl-1",
    "chaser-computer-drum-pr-80",
    "crb-rhythmboy-480",
    "eko-musicbox-12",
    "electro-harmonix-drm-15",
    "electro-harmonix-drm-16",
    "electro-harmonix-spacedrum",
    "elka-drumstar-80",
    "elka-x-1000",
    "emu-e-drum",
    "gem-drum-15",
    "hammond-autovari-64",
    "hohner-rhythm-80k",
    "korg-kpr-77",
    "korg-kr-55",
    "korg-kr-mini",
    "korg-monopoly",
    "korg-ms-10",
    "korg-trident",
    "linn-lm-1",
    "monacor-rhythmical-choice",
    "mti-auto-orchestra-ao-1",
    "multi-moog",
    "mxr-185",
    "new-england-digital-synclavier",
    "oberheim-dmx",
    "pearl-drum-x",
    "pollard-syndrum-178",
    "roland-cr-1000",
    "roland-cr-68",
    "roland-cr-78",
    "roland-cr-80",
    "roland-cr-8000",
    "roland-dr-55",
    "roland-jupiter-8",
    "roland-pb-300-rhythm-plus",
    "roland-rhy-33",
    "roland-rhy-55",
    "roland-sh-09",
    "roland-tr-55",
    "roland-tr-606",
    "roland-tr-808",
    "simmons-drum",
    "simmons-sds-1",
    "simmons-sds-5",
    "solton-programmer-24",
    "star-instruments-synare-3",
    "star-instruments-synare-ps-1",
    "visco-space-drum",
    "watford-electronics-rhythm-generator",
    "yamaha-cs-40m",
    "yamaha-mr-10",
    "yamaha-ps-55"
  ],
  vol3: [
    "amdek-pck-100",
    "austin-arb-6",
    "bme-rattlesnake-parametric-percussion-system",
    "boss-dr-110",
    "casio-mt-100",
    "coron-drumsynce-ds-7",
    "coron-rds",
    "denon-crb-90",
    "drumfire-df-2000",
    "drumfire-df-500",
    "electro-harmonix-drm-32",
    "emu-drumulator",
    "kay-drm-1",
    "korg-ddm-110",
    "korg-ddm-220",
    "korg-poly-800",
    "linn-linndrum-lm-1-vinyl",
    "linn-lm-2",
    "mattel-electronics-synsonics-drm",
    "mattel-electronics-synsonics-pro",
    "panasonic-rd-9844",
    "pearl-drx-1",
    "roland-ddr-30",
    "roland-mc-202",
    "roland-rhy-77",
    "roland-tr-909",
    "rsf-dd-30",
    "sakata-dpm-48",
    "sequential-circuits-drumtraks",
    "simmons-clap-trap",
    "simmons-sds-200",
    "simmons-sds-400",
    "soundmaster-sm-8",
    "soundmaster-sr-88",
    "tama-ts-206",
    "tama-ts-305",
    "wersi-wm-24",
    "yamaha-dx7"
  ],
  vol4: [
    "atlantex-mpc-1",
    "boss-hc-2",
    "boss-pc-2",
    "casio-ct-310",
    "casio-mt-500",
    "casio-mt-800",
    "casio-pt-68",
    "casio-pt-82",
    "casio-sk-1",
    "dr-b-hm-digital-drums",
    "emu-sp-12",
    "ensoniq-mirage",
    "hing-hon-ek-001",
    "kawai-acr-20",
    "kawai-sx-240",
    "klone-dual-percussion-synthesiser",
    "korg-ddd-1",
    "korg-pss-50",
    "kurzweil-electrodrum-prototype",
    "linn-9000",
    "linn-linndrum-lm-2-vinyl",
    "nasta-hitstix-2",
    "oberheim-dx",
    "pearl-sc-40",
    "rhodes-polaris",
    "roland-juno-106",
    "roland-super-quartet-mks-7",
    "roland-tr-707",
    "roland-tr-727",
    "siel-mdp-40",
    "simmons-sds-1000",
    "simmons-sds-7",
    "simmons-sds-8",
    "simmons-sds-9",
    "sony-drp-1",
    "soundmaster-stix-st-305",
    "suzuki-rpm-40",
    "tama-ts-500",
    "technics-ax-5",
    "technics-pcm-dp-50",
    "wersi-prisma-dx-5",
    "yamaha-dd-5",
    "yamaha-rx-11",
    "yamaha-rx-15",
    "yamaha-rx-21",
    "yamaha-rx-5"
  ],
  vol5: [
    "boss-dr-pad-drp-i",
    "casio-ct-403",
    "casio-cz-230s",
    "casio-ht-700",
    "casio-rz-1",
    "cheetah-spec-drum",
    "forat-f-9000",
    "korg-ddd-5",
    "korg-dss-1",
    "m-p-c-electronics-dsm-1",
    "pearl-sy-1",
    "roland-tr-505",
    "sequential-circuits-studio-440",
    "simmons-sds-2000",
    "simmons-sdx",
    "yamaha-pss-130",
    "yamaha-ptx8",
    "yamaha-rx-21l"
  ]
};
var machineToPack = (() => {
  const m = /* @__PURE__ */ new Map();
  for (const pack of DRUM_ABUSE_PACKS) {
    for (const id of MACHINES_BY_PACK[pack]) m.set(id, pack);
  }
  return m;
})();
function getDrumAbuseMachineNames() {
  return [...machineToPack.keys()];
}
function getDrumAbuseMachinesForPack(pack) {
  return MACHINES_BY_PACK[pack];
}
function getDrumAbusePackNames() {
  return DRUM_ABUSE_PACKS;
}
function getDrumAbuseMachinePack(id) {
  return machineToPack.get(id);
}
var encSeg = (s) => s.split("/").map(encodeURIComponent).join("/");
function packBase(baseUrl, pack) {
  return `${baseUrl}/drum-abuse-${pack}`;
}
function sampleBaseUrl(baseUrl, pack, urlPath) {
  return `${packBase(baseUrl, pack)}/samples/${encSeg(urlPath)}/`;
}
function drumAbuseSampleUrl(pack, urlPath, fileNoExt, format = "wav", baseUrl = DEFAULT_BASE_URL) {
  return `${sampleBaseUrl(baseUrl, pack, urlPath)}${encodeURIComponent(fileNoExt)}.${format}`;
}
function stripExt(filename) {
  return filename.replace(/\.[^.]+$/, "");
}
var jsonCache = /* @__PURE__ */ new Map();
function fetchJSON(url, storage) {
  let p = jsonCache.get(url);
  if (!p) {
    p = storage.fetch(url).then((r) => {
      if (r.status >= 400) throw new Error(`DrumAbuse: ${r.status} ${url}`);
      return r.json();
    });
    jsonCache.set(url, p);
  }
  return p;
}
function buildMachinePreset(machine, setPath, baseUrl, pack) {
  if (machine.sample_sets.length === 0) {
    throw new Error(`DrumAbuse: machine "${machine.id}" has no sample sets`);
  }
  const set = setPath ? machine.sample_sets.find((s) => s.path === setPath) : machine.sample_sets[0];
  if (!set) {
    throw new Error(`DrumAbuse: set "${setPath}" not found on "${machine.id}"`);
  }
  if (set.samples.length === 0) {
    throw new Error(
      `DrumAbuse: set "${set.path}" of "${machine.id}" has no samples`
    );
  }
  const sampleNames = [];
  const groupNames = [];
  const sampleNamesForGroup = {};
  const aliases = {};
  const regions = set.samples.map((file, i) => {
    const key = stripExt(file);
    const midi = MIDI_BASE + i;
    sampleNames.push(key);
    aliases[key] = midi;
    const group = set.sample_instruments[i] || "";
    if (group) {
      if (!sampleNamesForGroup[group]) {
        sampleNamesForGroup[group] = [];
        groupNames.push(group);
        aliases[group] = midi;
      }
      sampleNamesForGroup[group].push(key);
    }
    return {
      sample: key,
      keyRange: [midi, midi],
      pitch: midi
    };
  });
  return {
    preset: {
      samples: {
        baseUrl: sampleBaseUrl(baseUrl, pack, set.url_path),
        formats: ["wav"]
      },
      groups: [{ regions }],
      aliases
    },
    sampleNames,
    groupNames,
    sampleNamesForGroup,
    setPath: set.path
  };
}
function buildPackPreset(list, baseUrl, pack) {
  var _a;
  if (list.length === 0) {
    throw new Error(`DrumAbuse: empty pack-instrument list for pack "${pack}"`);
  }
  const fileCount = {};
  for (const s of list) {
    const f = stripExt(s.file);
    fileCount[f] = ((_a = fileCount[f]) != null ? _a : 0) + 1;
  }
  const sampleNames = [];
  const groupNames = [];
  const sampleNamesForGroup = {};
  const map = {};
  const aliases = {};
  const regions = list.map((s, i) => {
    const fileKey = stripExt(s.file);
    const uniqueKey = `${s.machine_id}/${fileKey}`;
    const midi = MIDI_BASE + i;
    sampleNames.push(uniqueKey);
    aliases[uniqueKey] = midi;
    if (fileCount[fileKey] === 1) aliases[fileKey] = midi;
    map[uniqueKey] = `${packBase(baseUrl, pack)}/samples/${encSeg(s.url_path)}/${encodeURIComponent(s.file)}`;
    if (!sampleNamesForGroup[s.machine_id]) {
      sampleNamesForGroup[s.machine_id] = [];
      groupNames.push(s.machine_id);
      aliases[s.machine_id] = midi;
    }
    sampleNamesForGroup[s.machine_id].push(uniqueKey);
    return {
      sample: uniqueKey,
      keyRange: [midi, midi],
      pitch: midi
    };
  });
  return {
    preset: {
      samples: { baseUrl: "", formats: ["wav"], map },
      groups: [{ regions }],
      aliases
    },
    sampleNames,
    groupNames,
    sampleNamesForGroup,
    setPath: null
  };
}
var DrumAbuse = Instrument(
  (_ctx, options = {}, smplr) => {
    var _a, _b;
    const source = options.source;
    if (!source) {
      throw new Error("DrumAbuse: options.source is required");
    }
    const baseUrl = (_a = options.baseUrl) != null ? _a : DEFAULT_BASE_URL;
    const storage = (_b = options.storage) != null ? _b : HttpStorage;
    let sampleNames = [];
    let groupNames = [];
    let sampleNamesForGroup = {};
    let machineId = null;
    let setPath = null;
    let packId;
    let mode;
    let presetPromise;
    if (source.kind === "machine") {
      mode = "machine";
      const pack = getDrumAbuseMachinePack(source.machine);
      if (!pack) {
        throw new Error(`DrumAbuse: unknown machine "${source.machine}"`);
      }
      packId = pack;
      machineId = source.machine;
      const url = `${packBase(baseUrl, pack)}/machines/${encodeURIComponent(source.machine)}.json`;
      presetPromise = fetchJSON(url, storage).then((machine) => {
        const built = buildMachinePreset(machine, source.set, baseUrl, pack);
        sampleNames = built.sampleNames;
        groupNames = built.groupNames;
        sampleNamesForGroup = built.sampleNamesForGroup;
        setPath = built.setPath;
        return built.preset;
      });
    } else {
      mode = "pack";
      if (!DRUM_ABUSE_PACKS.includes(source.pack)) {
        throw new Error(`DrumAbuse: unknown pack "${source.pack}"`);
      }
      packId = source.pack;
      const url = `${packBase(baseUrl, source.pack)}/instruments/${encodeURIComponent(source.instrument)}.json`;
      presetPromise = fetchJSON(url, storage).then((list) => {
        const built = buildPackPreset(list, baseUrl, source.pack);
        sampleNames = built.sampleNames;
        groupNames = built.groupNames;
        sampleNamesForGroup = built.sampleNamesForGroup;
        return built.preset;
      });
    }
    const baseStart = smplr.start.bind(smplr);
    const extras = {
      get mode() {
        return mode;
      },
      getSampleNames: () => sampleNames.slice(),
      getGroupNames: () => groupNames.slice(),
      getSampleNamesForGroup: (g) => {
        var _a2;
        return ((_a2 = sampleNamesForGroup[g]) != null ? _a2 : []).slice();
      },
      getMachineId: () => machineId,
      getSetPath: () => setPath,
      getPackId: () => packId,
      start: (event) => {
        var _a2;
        const ev = typeof event === "object" ? event : { note: event };
        return baseStart(__spreadProps(__spreadValues({}, ev), { stopId: (_a2 = ev.stopId) != null ? _a2 : ev.note }));
      }
    };
    const ready = presetPromise.then((preset) => smplr.loadInstrument(preset));
    return { extras, ready };
  }
);

// src/offline/wav-encoder.ts
function audioBufferToWav(buffer) {
  return encodeWav(buffer, 32);
}
function audioBufferToWav16(buffer) {
  return encodeWav(buffer, 16);
}
function encodeWav(buffer, bitDepth) {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const length = buffer.length;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = length * blockAlign;
  const headerSize = 44;
  const arrayBuffer = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(arrayBuffer);
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, bitDepth === 32 ? 3 : 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);
  const channels = [];
  for (let ch = 0; ch < numChannels; ch++) {
    channels.push(buffer.getChannelData(ch));
  }
  let offset = headerSize;
  for (let i = 0; i < length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = channels[ch][i];
      if (bitDepth === 32) {
        view.setFloat32(offset, sample, true);
      } else {
        const clamped = Math.max(-1, Math.min(1, sample));
        view.setInt16(
          offset,
          clamped < 0 ? clamped * 32768 : clamped * 32767,
          true
        );
      }
      offset += bytesPerSample;
    }
  }
  return new Blob([arrayBuffer], { type: "audio/wav" });
}
function writeString(view, offset, str2) {
  for (let i = 0; i < str2.length; i++) {
    view.setUint8(offset + i, str2.charCodeAt(i));
  }
}

// src/offline/render-result.ts
var _wavCache, _wav16Cache;
var RenderResult = class {
  constructor(audioBuffer) {
    __privateAdd(this, _wavCache);
    __privateAdd(this, _wav16Cache);
    this.audioBuffer = audioBuffer;
    this.duration = audioBuffer.duration;
    this.sampleRate = audioBuffer.sampleRate;
  }
  /** Encode as 32-bit float WAV. Cached after first call. */
  toWav() {
    if (!__privateGet(this, _wavCache)) {
      __privateSet(this, _wavCache, audioBufferToWav(this.audioBuffer));
    }
    return __privateGet(this, _wavCache);
  }
  /** Encode as 16-bit integer WAV. Cached after first call. */
  toWav16() {
    if (!__privateGet(this, _wav16Cache)) {
      __privateSet(this, _wav16Cache, audioBufferToWav16(this.audioBuffer));
    }
    return __privateGet(this, _wav16Cache);
  }
  /** Download as 32-bit float WAV file. */
  downloadWav(filename = "render.wav") {
    downloadBlob(this.toWav(), filename);
  }
  /** Download as 16-bit integer WAV file. */
  downloadWav16(filename = "render.wav") {
    downloadBlob(this.toWav16(), filename);
  }
};
_wavCache = new WeakMap();
_wav16Cache = new WeakMap();
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// src/offline/trim-silence.ts
var SILENCE_THRESHOLD = 1e-4;
function trimSilence(buffer) {
  const { numberOfChannels, sampleRate, length } = buffer;
  let lastNonSilent = 0;
  for (let ch = 0; ch < numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = length - 1; i >= 0; i--) {
      if (Math.abs(data[i]) > SILENCE_THRESHOLD) {
        if (i > lastNonSilent) lastNonSilent = i;
        break;
      }
    }
  }
  const trimmedLength = Math.max(1, lastNonSilent + 1);
  if (trimmedLength === length) return buffer;
  const trimmed = new AudioBuffer({
    numberOfChannels,
    length: trimmedLength,
    sampleRate
  });
  for (let ch = 0; ch < numberOfChannels; ch++) {
    const source = buffer.getChannelData(ch);
    trimmed.copyToChannel(source.subarray(0, trimmedLength), ch);
  }
  return trimmed;
}

// src/offline/render-offline.ts
var DEFAULT_SAMPLE_RATE = 48e3;
var DEFAULT_CHANNELS = 2;
var DEFAULT_MAX_DURATION = 60;
function renderOffline(callback, options) {
  return __async(this, null, function* () {
    var _a, _b;
    const sampleRate = (_a = options == null ? void 0 : options.sampleRate) != null ? _a : DEFAULT_SAMPLE_RATE;
    const channels = (_b = options == null ? void 0 : options.channels) != null ? _b : DEFAULT_CHANNELS;
    const explicitDuration = options == null ? void 0 : options.duration;
    const duration = explicitDuration != null ? explicitDuration : DEFAULT_MAX_DURATION;
    const length = Math.ceil(duration * sampleRate);
    const offlineContext = new OfflineAudioContext(channels, length, sampleRate);
    yield callback(offlineContext);
    let buffer = yield offlineContext.startRendering();
    if (explicitDuration === void 0) {
      buffer = trimSilence(buffer);
    }
    return new RenderResult(buffer);
  });
}

// src/sequencer/time-parser.ts
function parseTicks(time, ppq, timeSignature) {
  if (typeof time === "number") return time;
  const t = time.trim();
  if (/^\d+(\.\d+)?$/.test(t)) {
    return parseFloat(t);
  }
  const beatTicks = ppq * (4 / timeSignature.denominator);
  const barTicks = beatTicks * timeSignature.numerator;
  const measureMatch = /^(\d+(?:\.\d+)?)m$/.exec(t);
  if (measureMatch) {
    return parseFloat(measureMatch[1]) * barTicks;
  }
  const noteMatch = /^(\d+(?:\.\d+)?)n(\.?)$/.exec(t);
  if (noteMatch) {
    const denominator = parseFloat(noteMatch[1]);
    const dotted = noteMatch[2] === ".";
    let ticks = 4 * ppq / denominator;
    if (dotted) ticks *= 1.5;
    return ticks;
  }
  const posMatch = /^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)(?::(\d+(?:\.\d+)?))?$/.exec(t);
  if (posMatch) {
    const bar = parseFloat(posMatch[1]);
    const beat = parseFloat(posMatch[2]);
    const tick = posMatch[3] ? parseFloat(posMatch[3]) : 0;
    return (bar - 1) * barTicks + (beat - 1) * beatTicks + tick;
  }
  throw new Error(`parseTicks: cannot parse "${time}"`);
}

// src/sequencer/transport-clock.ts
var TransportClock = class {
  constructor(context, options = {}) {
    this._state = "stopped";
    this._checkpoints = [];
    this._pausedAtTick = 0;
    var _a, _b, _c;
    this._context = context;
    this._bpm = (_a = options.bpm) != null ? _a : 120;
    this.ppq = (_b = options.ppq) != null ? _b : 480;
    this._timeSignature = (_c = options.timeSignature) != null ? _c : {
      numerator: 4,
      denominator: 4
    };
  }
  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  get state() {
    return this._state;
  }
  // ---------------------------------------------------------------------------
  // BPM / time signature
  // ---------------------------------------------------------------------------
  get bpm() {
    return this._bpm;
  }
  /**
   * Set BPM. If currently playing, inserts a new checkpoint at the current
   * audio time so that all future tick↔time conversions use the new tempo,
   * while already-converted past events remain unaffected.
   */
  set bpm(value) {
    if (this._state === "playing") {
      const now = this._context.currentTime;
      const tick = this.audioTimeToTick(now);
      this._checkpoints.push({ tick, audioTime: now, bpm: value });
    }
    this._bpm = value;
  }
  get timeSignature() {
    return this._timeSignature;
  }
  set timeSignature(value) {
    this._timeSignature = value;
  }
  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------
  /**
   * Start playback. Records a checkpoint at the current audio time.
   * @param offsetTick  Musical tick to start from (default 0).
   */
  start(offsetTick = 0) {
    const audioTime = this._context.currentTime;
    this._checkpoints = [{ tick: offsetTick, audioTime, bpm: this._bpm }];
    this._state = "playing";
  }
  /**
   * Pause playback. Saves the current tick position so resume can start from
   * the same place.
   */
  pause() {
    if (this._state !== "playing") return;
    this._pausedAtTick = this.currentTick;
    this._state = "paused";
  }
  /**
   * Resume from paused. Creates a new checkpoint at the current audio time
   * anchored to the saved tick position.
   */
  resume() {
    if (this._state !== "paused") return;
    const audioTime = this._context.currentTime;
    this._checkpoints = [
      { tick: this._pausedAtTick, audioTime, bpm: this._bpm }
    ];
    this._state = "playing";
  }
  /**
   * Stop playback and reset position to 0.
   */
  stop() {
    this._checkpoints = [];
    this._pausedAtTick = 0;
    this._state = "stopped";
  }
  // ---------------------------------------------------------------------------
  // Seek
  // ---------------------------------------------------------------------------
  /**
   * Seek to a tick position immediately (at context.currentTime).
   * Replaces all checkpoints with a single new one.
   * Works while playing or paused.
   */
  seek(tick) {
    if (this._state === "playing") {
      const audioTime = this._context.currentTime;
      this._checkpoints = [{ tick, audioTime, bpm: this._bpm }];
    } else {
      this._pausedAtTick = tick;
    }
  }
  /**
   * Re-anchor: at a specific future audio time, the tick position will jump to
   * `tick`. Used for sample-accurate loop restarts.
   *
   * Any checkpoints at or after `audioTime` are removed and replaced with this
   * new anchor, preserving the BPM that was in effect at that time.
   *
   * @internal Leaks checkpoint-list semantics; only called by `Sequencer._flush`
   * for loop-boundary re-anchoring. Not safe to share between Sequencers — see
   * thoughts/research/2026-05-17_20-18-43_shared-transport.md §3. Must not be
   * exported from any barrel.
   */
  seekAt(tick, audioTime) {
    let bpm = this._bpm;
    for (const cp of this._checkpoints) {
      if (cp.audioTime <= audioTime) bpm = cp.bpm;
    }
    this._checkpoints = this._checkpoints.filter(
      (cp) => cp.audioTime < audioTime
    );
    this._checkpoints.push({ tick, audioTime, bpm });
  }
  // ---------------------------------------------------------------------------
  // Position
  // ---------------------------------------------------------------------------
  /**
   * Current tick position.
   * - While playing: derived from context.currentTime.
   * - While paused or stopped: the saved tick position.
   */
  get currentTick() {
    if (this._state === "playing") {
      return this.audioTimeToTick(this._context.currentTime);
    }
    return this._pausedAtTick;
  }
  // ---------------------------------------------------------------------------
  // Time conversion
  // ---------------------------------------------------------------------------
  /**
   * Convert a tick position to an AudioContext time (seconds).
   *
   * Finds the most recent checkpoint (by audioTime) whose tick <= the target
   * tick, then interpolates forward using that checkpoint's BPM.
   *
   * This correctly handles loop restarts: after `seekAt(0, T)`, a new
   * checkpoint with tick=0 is added, so tick=100 in the new iteration maps
   * to T + 100*spt instead of the first-iteration value.
   */
  tickToAudioTime(tick) {
    const cp = this._findCheckpointForTick(tick);
    return cp.audioTime + (tick - cp.tick) * this._secondsPerTick(cp.bpm);
  }
  /**
   * Convert an AudioContext time (seconds) to a tick position.
   *
   * Finds the most recent checkpoint (by audioTime) whose audioTime <= the
   * target time, then interpolates forward.
   */
  audioTimeToTick(audioTime) {
    const cp = this._findCheckpointForAudioTime(audioTime);
    return cp.tick + (audioTime - cp.audioTime) / this._secondsPerTick(cp.bpm);
  }
  /**
   * Convert a tick count to seconds at the current (snapshot) BPM.
   *
   * Uses `this._bpm` directly, not the checkpoint history — so after a
   * mid-play BPM change this returns a value based on the *latest* BPM only.
   * For checkpoint-aware durations, use `tickToAudioTime(end) - tickToAudioTime(start)`.
   */
  ticksToSeconds(ticks) {
    return ticks * this._secondsPerTick(this._bpm);
  }
  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------
  _secondsPerTick(bpm) {
    return 60 / (bpm * this.ppq);
  }
  /**
   * Find the most recent checkpoint (latest audioTime) whose tick <= targetTick.
   * Falls back to a virtual origin checkpoint if none match.
   */
  _findCheckpointForTick(targetTick) {
    let best = null;
    for (const cp of this._checkpoints) {
      if (cp.tick <= targetTick) {
        best = cp;
      }
    }
    return best != null ? best : this._origin();
  }
  /**
   * Find the most recent checkpoint whose audioTime <= targetTime.
   * Falls back to a virtual origin checkpoint if none match.
   */
  _findCheckpointForAudioTime(targetTime) {
    let best = null;
    for (const cp of this._checkpoints) {
      if (cp.audioTime <= targetTime) {
        best = cp;
      }
    }
    return best != null ? best : this._origin();
  }
  /** Virtual origin used before start() is called. */
  _origin() {
    return { tick: 0, audioTime: 0, bpm: this._bpm };
  }
};

// src/sequencer/sequencer.ts
function normaliseTimeSignature(input) {
  if (input === void 0) return { numerator: 4, denominator: 4 };
  if (typeof input === "number") return { numerator: input, denominator: 4 };
  return input;
}
var SequencerImpl = class {
  constructor(context, options = {}) {
    /**
     * Patterns. Always at least one (the implicit default pattern). Replaced
     * atomically by {@link setPatterns}.
     */
    this._patterns = [
      { tracks: [], loopEndOverride: null, totalTicks: 0 }
    ];
    /** Indices into {@link _patterns} defining playback order. */
    this._chainOrder = [0];
    /** Current position within {@link _chainOrder}. */
    this._chainIndex = 0;
    /**
     * True once {@link setPatterns} has been called. After this point,
     * `addTrack` / `removeTrack` / `clearTracks` throw because the chain shape
     * is owned by the patterns array.
     */
    this._patternsExplicit = false;
    this._repeatEvents = [];
    this._listeners = /* @__PURE__ */ new Map();
    /** AudioContext time high-water mark: notes up to here have been scheduled. */
    this._scheduledThrough = 0;
    /** Guards against scheduling the auto-stop setTimeout more than once. */
    this._endScheduled = false;
    /** Active voices keyed by noteId, so individual notes can be stopped. */
    this._activeVoices = /* @__PURE__ */ new Map();
    var _a, _b, _c, _d, _e, _f, _g, _h, _i;
    this._context = context;
    this._ppq = (_a = options.ppq) != null ? _a : 480;
    this._timeSignature = normaliseTimeSignature(options.timeSignature);
    this._clock = new TransportClock(context, {
      bpm: (_b = options.bpm) != null ? _b : 120,
      ppq: this._ppq,
      timeSignature: this._timeSignature
    });
    this._loop = (_c = options.loop) != null ? _c : false;
    this._loopStartTick = options.loopStart !== void 0 ? parseTicks(options.loopStart, this._ppq, this._timeSignature) : 0;
    if (options.loopEnd !== void 0) {
      this._patterns[0].loopEndOverride = parseTicks(
        options.loopEnd,
        this._ppq,
        this._timeSignature
      );
    }
    this._stepTicks = options.stepSize !== void 0 ? parseTicks(options.stepSize, this._ppq, this._timeSignature) : void 0;
    this._lookaheadSec = ((_d = options.lookaheadMs) != null ? _d : 200) / 1e3;
    this._intervalMs = (_e = options.intervalMs) != null ? _e : 50;
    this._humanize = {
      timing: (_g = (_f = options.humanize) == null ? void 0 : _f.timingMs) != null ? _g : 0,
      velocity: (_i = (_h = options.humanize) == null ? void 0 : _h.velocity) != null ? _i : 0
    };
  }
  // ---------------------------------------------------------------------------
  // Tracks
  // ---------------------------------------------------------------------------
  /**
   * Add a track to the (implicit, default) pattern. Throws after
   * {@link setPatterns} has been called — use {@link setPatterns} to mutate
   * the chain.
   */
  addTrack(instrument, notes, options) {
    this._assertImplicitPattern("addTrack");
    const pattern = this._patterns[0];
    pattern.tracks.push(this._buildTrack(instrument, notes, options));
    pattern.totalTicks = this._computePatternTotalTicks(pattern);
    return this;
  }
  removeTrack(instrument) {
    this._assertImplicitPattern("removeTrack");
    const pattern = this._patterns[0];
    pattern.tracks = pattern.tracks.filter((t) => t.instrument !== instrument);
    pattern.totalTicks = this._computePatternTotalTicks(pattern);
    return this;
  }
  clearTracks() {
    this._assertImplicitPattern("clearTracks");
    const pattern = this._patterns[0];
    pattern.tracks = [];
    pattern.totalTicks = 0;
    return this;
  }
  /**
   * Replace the sequencer's patterns. Each pattern owns its own tracks and
   * optional `loopEnd`. After this call, `addTrack` / `removeTrack` /
   * `clearTracks` throw — the chain is owned by the patterns array.
   *
   * `chainOrder` is reset to `[0, 1, …, patterns.length - 1]`.
   */
  setPatterns(patterns) {
    if (patterns.length === 0) {
      throw new Error("setPatterns requires at least one pattern");
    }
    this._patterns = patterns.map((p) => {
      const built = {
        tracks: p.tracks.map((t) => this._buildTrack(t.instrument, t.notes, t)),
        loopEndOverride: p.loopEnd !== void 0 ? parseTicks(p.loopEnd, this._ppq, this._timeSignature) : null,
        totalTicks: 0
      };
      built.totalTicks = this._computePatternTotalTicks(built);
      return built;
    });
    this._chainOrder = this._patterns.map((_, i) => i);
    this._chainIndex = 0;
    this._patternsExplicit = true;
    return this;
  }
  /** Current chain order: indices into the patterns array, in playback order. */
  get chainOrder() {
    return [...this._chainOrder];
  }
  /**
   * Set a new chain order. Each entry must be a valid pattern index.
   * Throws if `order` is empty or contains an out-of-range index.
   */
  set chainOrder(order) {
    if (order.length === 0) {
      throw new Error("chainOrder must not be empty");
    }
    for (const idx of order) {
      if (idx < 0 || idx >= this._patterns.length) {
        throw new Error(`chainOrder index ${idx} out of range`);
      }
    }
    this._chainOrder = [...order];
    if (this._chainIndex >= order.length) this._chainIndex = 0;
  }
  /**
   * Set a track's multiplicative volume scalar. Affects every note dispatched
   * by the track from the next flush onwards. No-op if no track has the
   * given id. Search is scoped to the currently-playing pattern.
   */
  setTrackVolume(id, volume) {
    const t = this._findTrack(id);
    if (t) t.volume = volume;
    return this;
  }
  /** Mute a track by id. No-op if no track has the given id. */
  muteTrack(id) {
    return this._setTrackFlag(id, "muted", true);
  }
  /** Unmute a track by id. No-op if no track has the given id. */
  unmuteTrack(id) {
    return this._setTrackFlag(id, "muted", false);
  }
  /** Solo a track by id. While any track is soloed, non-soloed tracks are silenced. */
  soloTrack(id) {
    return this._setTrackFlag(id, "solo", true);
  }
  /** Remove the solo flag from a track. */
  unsoloTrack(id) {
    return this._setTrackFlag(id, "solo", false);
  }
  /**
   * Locate a track by id, scoped to the currently-playing pattern.
   */
  _findTrack(id) {
    return this._currentPattern().tracks.find((t) => t.id === id);
  }
  _setTrackFlag(id, flag, value) {
    const t = this._findTrack(id);
    if (t) t[flag] = value;
    return this;
  }
  _buildTrack(instrument, notes, options) {
    var _a, _b, _c, _d, _e;
    return {
      instrument,
      notes,
      id: options == null ? void 0 : options.id,
      humanize: (options == null ? void 0 : options.humanize) ? {
        timing: (_a = options.humanize.timingMs) != null ? _a : 0,
        velocity: (_b = options.humanize.velocity) != null ? _b : 0
      } : void 0,
      volume: (_c = options == null ? void 0 : options.volume) != null ? _c : 1,
      muted: (_d = options == null ? void 0 : options.muted) != null ? _d : false,
      solo: (_e = options == null ? void 0 : options.solo) != null ? _e : false
    };
  }
  _currentPattern() {
    var _a;
    return (_a = this._patterns[this._chainOrder[this._chainIndex]]) != null ? _a : this._patterns[0];
  }
  _assertImplicitPattern(method) {
    if (this._patternsExplicit) {
      throw new Error(
        `${method}() is not available after setPatterns(); use setPatterns() to update the chain.`
      );
    }
  }
  _computePatternTotalTicks(pattern) {
    let max = 0;
    for (const track of pattern.tracks) {
      for (const note of track.notes) {
        const atTick = parseTicks(note.at, this._ppq, this._timeSignature);
        const durTick = note.duration !== void 0 ? parseTicks(note.duration, this._ppq, this._timeSignature) : 0;
        max = Math.max(max, atTick + durTick);
      }
    }
    return max;
  }
  // ---------------------------------------------------------------------------
  // Playback
  // ---------------------------------------------------------------------------
  get state() {
    return this._clock.state;
  }
  /**
   * Start playback from `offsetTick`, or resume from pause if no offset given.
   */
  start(offsetTick) {
    if (this._clock.state === "playing") return this;
    if (this._clock.state === "paused" && offsetTick === void 0) {
      this._clock.resume();
      this._scheduledThrough = this._context.currentTime;
      this._startLoop();
      this._emitStateChange("playing");
      return this;
    }
    const startTick = offsetTick != null ? offsetTick : 0;
    this._clock.start(startTick);
    this._scheduledThrough = this._context.currentTime;
    this._endScheduled = false;
    this._chainIndex = 0;
    this._resetRepeatEvents(startTick);
    this._startLoop();
    this._emitStateChange("playing");
    return this;
  }
  pause() {
    if (this._clock.state !== "playing") return this;
    this._clock.pause();
    this._stopLoop();
    this._emitStateChange("paused");
    return this;
  }
  stop() {
    this._clock.stop();
    this._stopLoop();
    this._endScheduled = false;
    for (const stopFn of this._activeVoices.values()) stopFn();
    this._activeVoices.clear();
    this._emitStateChange("stopped");
    return this;
  }
  /**
   * Stop a single note that was scheduled by the sequencer.
   * @param noteId  The id of the note (from SequencerNote.id or auto-assigned index).
   * @param time    Optional AudioContext time to schedule the stop.
   */
  stopNote(noteId, time) {
    const stopFn = this._activeVoices.get(noteId);
    if (stopFn) {
      stopFn(time);
      this._activeVoices.delete(noteId);
    }
    return this;
  }
  /**
   * Toggle between playing and paused. If stopped, starts from the beginning.
   */
  togglePlayPause() {
    if (this._clock.state === "playing") return this.pause();
    return this.start();
  }
  // ---------------------------------------------------------------------------
  // Tempo
  // ---------------------------------------------------------------------------
  get bpm() {
    return this._clock.bpm;
  }
  set bpm(value) {
    this._clock.bpm = value;
  }
  get timeSignature() {
    return __spreadValues({}, this._timeSignature);
  }
  set timeSignature(value) {
    this._timeSignature = normaliseTimeSignature(value);
    this._clock.timeSignature = this._timeSignature;
    for (const p of this._patterns) {
      p.totalTicks = this._computePatternTotalTicks(p);
    }
  }
  // ---------------------------------------------------------------------------
  // Position
  // ---------------------------------------------------------------------------
  /** Current transport position as "bar:beat:tick" (1-indexed). */
  get position() {
    return this._tickToPosition(this._clock.currentTick);
  }
  /**
   * Seek to a position. Accepts ticks or any time string ("2:1", "4n", …).
   * Works while playing (seamless) or stopped/paused.
   */
  set position(value) {
    const targetTick = parseTicks(
      String(value),
      this._ppq,
      this._timeSignature
    );
    this._clock.seek(targetTick);
    if (this._clock.state === "playing") {
      this._scheduledThrough = this._context.currentTime;
      this._endScheduled = false;
      this._resetRepeatEvents(targetTick);
    }
  }
  // ---------------------------------------------------------------------------
  // Loop
  // ---------------------------------------------------------------------------
  get loop() {
    return this._loop;
  }
  set loop(value) {
    this._loop = value;
  }
  /** Loop start in ticks. */
  get loopStart() {
    return this._loopStartTick;
  }
  set loopStart(value) {
    this._loopStartTick = parseTicks(
      String(value),
      this._ppq,
      this._timeSignature
    );
  }
  /**
   * Loop end in ticks for the currently-playing pattern. Defaults to the end
   * of the pattern's longest track.
   */
  get loopEnd() {
    var _a;
    const p = this._currentPattern();
    return (_a = p.loopEndOverride) != null ? _a : p.totalTicks;
  }
  set loopEnd(value) {
    this._currentPattern().loopEndOverride = parseTicks(
      String(value),
      this._ppq,
      this._timeSignature
    );
  }
  /**
   * Normalised loop position [0, 1]. Always 0 when loop=false.
   */
  get progress() {
    if (!this._loop) return 0;
    const loopEnd = this.loopEnd;
    const duration = loopEnd - this._loopStartTick;
    if (duration <= 0) return 0;
    const tick = this._clock.currentTick;
    return Math.max(0, Math.min(1, (tick - this._loopStartTick) / duration));
  }
  // ---------------------------------------------------------------------------
  // Callback scheduling (pattern API)
  // ---------------------------------------------------------------------------
  /**
   * Schedule a callback to fire on every `interval` while the sequencer plays.
   * Returns a cancel function.
   *
   * @param callback  Called with the exact AudioContext time of each firing.
   * @param interval  Musical interval: "4n", "8n", "1m", ticks, etc.
   * @param startAt   First firing position (default 0 = beginning).
   */
  scheduleRepeat(callback, interval, startAt = 0) {
    const intervalTicks = parseTicks(
      String(interval),
      this._ppq,
      this._timeSignature
    );
    const startTick = parseTicks(
      String(startAt),
      this._ppq,
      this._timeSignature
    );
    const event = {
      callback,
      intervalTicks,
      nextTick: startTick,
      startTick
    };
    this._repeatEvents.push(event);
    return () => {
      this._repeatEvents = this._repeatEvents.filter((e) => e !== event);
    };
  }
  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------
  /**
   * Listen to a sequencer event.
   *
   * | Event           | Args                                              |
   * |-----------------|---------------------------------------------------|
   * | "statechange"   | (state: "playing" \| "paused" \| "stopped")       |
   * | "start"         |                                                   |
   * | "stop"          |                                                   |
   * | "pause"         |                                                   |
   * | "end"           |                                                   |
   * | "loop"          |                                                   |
   * | "patternChange" | (patternIndex: number, time: number)              |
   * | "beat"          | (beat: number, time: number)                      |
   * | "bar"           | (bar: number, time: number)                       |
   * | "step"          | (stepIndex: number, time: number)                 |
   * | "noteOn"        | (event: SequencerNoteEvent)                       |
   * | "noteOff"       | (event: SequencerNoteEvent)                       |
   */
  on(event, callback) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, /* @__PURE__ */ new Set());
    }
    this._listeners.get(event).add(callback);
    return this;
  }
  off(event, callback) {
    var _a;
    (_a = this._listeners.get(event)) == null ? void 0 : _a.delete(callback);
    return this;
  }
  // ---------------------------------------------------------------------------
  // Private — interval management
  // ---------------------------------------------------------------------------
  _startLoop() {
    if (this._intervalId !== void 0) return;
    this._intervalId = setInterval(() => this._flush(), this._intervalMs);
  }
  _stopLoop() {
    if (this._intervalId !== void 0) {
      clearInterval(this._intervalId);
      this._intervalId = void 0;
    }
  }
  // ---------------------------------------------------------------------------
  // Private — flush loop (the timing engine)
  // ---------------------------------------------------------------------------
  _flush() {
    var _a;
    const now = this._context.currentTime;
    const windowEnd = now + this._lookaheadSec;
    const fromTick = this._clock.audioTimeToTick(this._scheduledThrough);
    const toTick = this._clock.audioTimeToTick(windowEnd);
    const pattern = this._currentPattern();
    const isMultiPattern = this._chainOrder.length > 1;
    const patternEndTick = (_a = pattern.loopEndOverride) != null ? _a : pattern.totalTicks;
    const isLastInChain = this._chainIndex === this._chainOrder.length - 1;
    const patternStartTick = isMultiPattern ? 0 : this._loopStartTick;
    const willAdvance = patternEndTick > patternStartTick && toTick >= patternEndTick && (isMultiPattern || this._loop) && !(isLastInChain && !this._loop);
    if (willAdvance) {
      this._scheduleWindow(fromTick, patternEndTick);
      const restartAudioTime = this._clock.tickToAudioTime(patternEndTick);
      if (isMultiPattern) {
        this._chainIndex = (this._chainIndex + 1) % this._chainOrder.length;
        this._emit(
          "patternChange",
          this._chainOrder[this._chainIndex],
          restartAudioTime
        );
        if (this._chainIndex === 0) {
          this._emit("loop");
        }
      } else {
        this._emit("loop");
      }
      const nextStartTick = isMultiPattern ? 0 : this._loopStartTick;
      this._clock.seekAt(nextStartTick, restartAudioTime);
      this._resetRepeatEvents(nextStartTick);
      const overflowToTick = this._clock.audioTimeToTick(windowEnd);
      this._scheduleWindow(nextStartTick, overflowToTick);
      this._scheduledThrough = windowEnd;
      return;
    }
    this._scheduleWindow(fromTick, toTick);
    this._scheduledThrough = windowEnd;
    if (!this._loop && !this._endScheduled && isLastInChain && patternEndTick > 0 && toTick >= patternEndTick) {
      this._endScheduled = true;
      const endAudioTime = this._clock.tickToAudioTime(patternEndTick);
      const delay = Math.max(0, (endAudioTime - now) * 1e3);
      setTimeout(() => {
        this._stopLoop();
        this._clock.stop();
        this._emit("end");
        this._emit("statechange", "stopped");
      }, delay);
    }
  }
  // ---------------------------------------------------------------------------
  // Private — window scheduling
  // ---------------------------------------------------------------------------
  _scheduleWindow(fromTick, toTick) {
    var _a, _b, _c, _d;
    const tracks = this._currentPattern().tracks;
    const anySolo = tracks.some((t) => t.solo);
    for (let trackIndex = 0; trackIndex < tracks.length; trackIndex++) {
      const track = tracks[trackIndex];
      if (track.muted) continue;
      if (anySolo && !track.solo) continue;
      const trackHumanize = (_a = track.humanize) != null ? _a : this._humanize;
      for (let noteIndex = 0; noteIndex < track.notes.length; noteIndex++) {
        const note = track.notes[noteIndex];
        const noteTick = parseTicks(note.at, this._ppq, this._timeSignature);
        if (noteTick < fromTick || noteTick >= toTick) continue;
        if (note.chance !== void 0 && note.chance < 100) {
          if (Math.random() * 100 >= note.chance) continue;
        }
        const audioTime = this._clock.tickToAudioTime(noteTick);
        const durationSec = note.duration !== void 0 ? this._clock.ticksToSeconds(
          parseTicks(note.duration, this._ppq, this._timeSignature)
        ) : void 0;
        const timingOffset = trackHumanize.timing ? (Math.random() * 2 - 1) * trackHumanize.timing / 1e3 : 0;
        const velocityOffset = trackHumanize.velocity ? Math.round((Math.random() * 2 - 1) * trackHumanize.velocity) : 0;
        const baseNoteId = (_b = note.id) != null ? _b : noteIndex;
        const noteEvent = {
          noteId: baseNoteId,
          trackIndex,
          noteIndex,
          note
        };
        const ratchetCount = note.ratchet && note.ratchet > 1 && durationSec !== void 0 ? Math.floor(note.ratchet) : 1;
        const ratchetDecay = (_c = note.ratchetVelocityDecay) != null ? _c : 0;
        const ratchetStepSec = ratchetCount > 1 && durationSec !== void 0 ? durationSec / ratchetCount : 0;
        const ratchetDurationSec = ratchetCount > 1 ? ratchetStepSec : durationSec;
        for (let r = 0; r < ratchetCount; r++) {
          const ratchetOffsetSec = r * ratchetStepSec;
          const ratchetVelocityScale = ratchetCount > 1 ? Math.pow(1 - ratchetDecay, r) : 1;
          const subNoteId = ratchetCount > 1 ? `${baseNoteId}#${r}` : baseNoteId;
          const result = track.instrument.start({
            note: note.note,
            time: Math.max(0, audioTime + timingOffset + ratchetOffsetSec),
            duration: ratchetDurationSec,
            velocity: ((_d = note.velocity) != null ? _d : 100) * track.volume * ratchetVelocityScale + velocityOffset,
            noteId: subNoteId,
            onStart: () => this._emit("noteOn", noteEvent),
            onEnded: () => {
              this._activeVoices.delete(subNoteId);
              this._emit("noteOff", noteEvent);
            }
          });
          if (typeof result === "function") {
            this._activeVoices.set(subNoteId, result);
          }
        }
      }
    }
    for (const rep of this._repeatEvents) {
      while (rep.nextTick >= fromTick && rep.nextTick < toTick) {
        rep.callback(this._clock.tickToAudioTime(rep.nextTick));
        rep.nextTick += rep.intervalTicks;
      }
    }
    this._emitBeatsInWindow(fromTick, toTick);
    this._emitStepsInWindow(fromTick, toTick);
  }
  // ---------------------------------------------------------------------------
  // Private — beat / bar events
  // ---------------------------------------------------------------------------
  _emitStepsInWindow(fromTick, toTick) {
    if (!this._stepTicks) return;
    const firstStep = Math.ceil((fromTick - 1e-3) / this._stepTicks) * this._stepTicks;
    for (let t = firstStep; t < toTick; t += this._stepTicks) {
      if (t < 0) continue;
      const stepIndex = Math.floor(t / this._stepTicks);
      const audioTime = this._clock.tickToAudioTime(t);
      this._emit("step", stepIndex, audioTime);
    }
  }
  _emitBeatsInWindow(fromTick, toTick) {
    const beatTicks = this._ppq * (4 / this._timeSignature.denominator);
    const barTicks = beatTicks * this._timeSignature.numerator;
    const firstBeat = Math.ceil((fromTick - 1e-3) / beatTicks) * beatTicks;
    for (let t = firstBeat; t < toTick; t += beatTicks) {
      if (t < 0) continue;
      const audioTime = this._clock.tickToAudioTime(t);
      const beat = Math.floor(t / beatTicks) + 1;
      this._emit("beat", beat, audioTime);
      if (t % barTicks === 0) {
        const bar = Math.floor(t / barTicks) + 1;
        this._emit("bar", bar, audioTime);
      }
    }
  }
  // ---------------------------------------------------------------------------
  // Private — utilities
  // ---------------------------------------------------------------------------
  _emit(event, ...args) {
    const handlers = this._listeners.get(event);
    if (handlers) {
      for (const fn of handlers) {
        fn(...args);
      }
    }
  }
  /** Emit both the specific state event ("start"/"pause"/"stop") and the unified "statechange" event. */
  _emitStateChange(state) {
    const eventName = state === "playing" ? "start" : state === "paused" ? "pause" : "stop";
    this._emit(eventName);
    this._emit("statechange", state);
  }
  /** Format a raw tick count as "bar:beat:tick" (all 1-indexed). */
  _tickToPosition(tick) {
    const beatTicks = this._ppq * (4 / this._timeSignature.denominator);
    const barTicks = beatTicks * this._timeSignature.numerator;
    const bar = Math.floor(tick / barTicks) + 1;
    const ticksInBar = tick % barTicks;
    const beat = Math.floor(ticksInBar / beatTicks) + 1;
    const ticksInBeat = Math.round(ticksInBar % beatTicks);
    return `${bar}:${beat}:${ticksInBeat}`;
  }
  /**
   * Reset all repeat events so their next firing is the first occurrence
   * at or after `fromTick`.
   */
  _resetRepeatEvents(fromTick) {
    for (const rep of this._repeatEvents) {
      rep.nextTick = rep.startTick;
      if (fromTick > rep.startTick && rep.intervalTicks > 0) {
        const steps = Math.ceil((fromTick - rep.startTick) / rep.intervalTicks);
        rep.nextTick = rep.startTick + steps * rep.intervalTicks;
      }
    }
  }
};
var Sequencer = asConstructable(SequencerImpl);

// src/smplr/sfz-convert.ts
function sfzToPreset(sfzText, options) {
  var _a;
  const formats = (_a = options.formats) != null ? _a : ["ogg", "m4a"];
  const tokens = tokenize(resolveDefines(sfzText));
  let mode = "global";
  const globalProps = {};
  let groupProps = {};
  let regionProps = {};
  const groups = [];
  let currentGroup = null;
  function closeScope() {
    if (mode === "global") {
      Object.assign(globalProps, regionProps);
    } else if (mode === "group") {
      groupProps = __spreadValues({}, regionProps);
      currentGroup = buildGroup(groupProps);
      groups.push(currentGroup);
    } else if (mode === "region") {
      const merged = __spreadValues(__spreadValues(__spreadValues({}, globalProps), groupProps), regionProps);
      const region = buildRegion(merged, options.pathFromSampleName);
      if (region) {
        if (!currentGroup) {
          currentGroup = { regions: [] };
          groups.push(currentGroup);
        }
        currentGroup.regions.push(region);
      }
    }
    regionProps = {};
  }
  for (const token of tokens) {
    if (token.type === "header") {
      closeScope();
      mode = token.value;
      if (mode === "group") {
        groupProps = {};
        currentGroup = null;
      }
    } else {
      regionProps[token.key] = token.value;
    }
  }
  closeScope();
  const nonEmptyGroups = groups.filter((g) => g.regions.length > 0);
  return {
    samples: {
      baseUrl: options.baseUrl,
      formats
    },
    groups: nonEmptyGroups
  };
}
function buildGroup(props) {
  const group = { regions: [] };
  const lokey = num(props, "lokey");
  const hikey = num(props, "hikey");
  if (lokey !== void 0 && hikey !== void 0) {
    group.keyRange = [lokey, hikey];
  }
  const lovel = num(props, "lovel");
  const hivel = num(props, "hivel");
  if (lovel !== void 0 && hivel !== void 0) {
    group.velRange = [lovel, hivel];
  }
  const seqLength = num(props, "seq_length");
  if (seqLength !== void 0) group.seqLength = seqLength;
  const groupNum = num(props, "group");
  if (groupNum !== void 0) group.group = groupNum;
  const offBy = num(props, "off_by");
  if (offBy !== void 0) group.offBy = offBy;
  const volume = num(props, "volume");
  if (volume !== void 0) group.volume = volume;
  const ampRelease = num(props, "ampeg_release");
  if (ampRelease !== void 0) group.ampRelease = ampRelease;
  const tune = num(props, "tune");
  if (tune !== void 0) group.tune = tune / 100;
  return group;
}
function buildRegion(props, pathFromSampleName) {
  const sampleRaw = str(props, "sample");
  if (!sampleRaw) return null;
  const sample = pathFromSampleName(sampleRaw);
  const region = { sample };
  const key = num(props, "key");
  if (key !== void 0) {
    region.key = key;
  } else {
    const lokey = num(props, "lokey");
    const hikey = num(props, "hikey");
    if (lokey !== void 0 && hikey !== void 0) {
      region.keyRange = [lokey, hikey];
    }
  }
  const pitchKeycenter = num(props, "pitch_keycenter");
  if (pitchKeycenter !== void 0) {
    region.pitch = pitchKeycenter;
  } else if (region.keyRange) {
    region.pitch = region.keyRange[0];
  } else if (key !== void 0) {
    region.pitch = key;
  }
  const lovel = num(props, "lovel");
  const hivel = num(props, "hivel");
  if (lovel !== void 0 && hivel !== void 0) {
    region.velRange = [lovel, hivel];
  }
  const seqPosition = num(props, "seq_position");
  if (seqPosition !== void 0) region.seqPosition = seqPosition;
  const groupNum = num(props, "group");
  if (groupNum !== void 0) region.group = groupNum;
  const offBy = num(props, "off_by");
  if (offBy !== void 0) region.offBy = offBy;
  const volume = num(props, "volume");
  if (volume !== void 0) region.volume = volume;
  const tune = num(props, "tune");
  if (tune !== void 0) region.tune = tune / 100;
  const ampRelease = num(props, "ampeg_release");
  if (ampRelease !== void 0) region.ampRelease = ampRelease;
  const ampVelcurve = numArr(props, "amp_velcurve");
  if (ampVelcurve) region.ampVelCurve = ampVelcurve;
  return region;
}
function resolveDefines(sfz) {
  const defines = {};
  const lines = sfz.split("\n");
  const output = [];
  for (const line of lines) {
    const trimmed = line.trim();
    const match = trimmed.match(/^#define\s+(\$\w+)\s+(.+)$/);
    if (match) {
      defines[match[1]] = match[2].trim();
    } else {
      output.push(line);
    }
  }
  let result = output.join("\n");
  for (const [key, value] of Object.entries(defines)) {
    result = result.split(key).join(value);
  }
  return result;
}
function tokenize(sfz) {
  const tokens = [];
  for (let line of sfz.split("\n")) {
    const commentIdx = line.indexOf("//");
    if (commentIdx >= 0) line = line.slice(0, commentIdx);
    line = line.trim();
    if (!line) continue;
    let pos = 0;
    while (pos < line.length) {
      while (pos < line.length && line[pos] === " ") pos++;
      if (pos >= line.length) break;
      if (line[pos] === "<") {
        const end = line.indexOf(">", pos);
        if (end < 0) break;
        const headerName = line.slice(pos + 1, end).trim().toLowerCase();
        tokens.push({ type: "header", value: headerName });
        pos = end + 1;
        continue;
      }
      const eqIdx = line.indexOf("=", pos);
      if (eqIdx < 0) break;
      const key = line.slice(pos, eqIdx).trim();
      let valueEnd = eqIdx + 1;
      const rest = line.slice(eqIdx + 1);
      const nextKeyMatch = rest.match(/\s+\S+=\S/);
      let rawValue;
      if (nextKeyMatch && nextKeyMatch.index !== void 0) {
        rawValue = rest.slice(0, nextKeyMatch.index).trim();
        valueEnd = eqIdx + 1 + nextKeyMatch.index + nextKeyMatch[0].length - nextKeyMatch[0].trimStart().length;
      } else {
        rawValue = rest.trim();
        valueEnd = line.length;
      }
      if (key && rawValue !== void 0) {
        const numVal = Number(rawValue);
        tokens.push({
          type: "prop",
          key,
          value: isNaN(numVal) ? rawValue : numVal
        });
      }
      pos = valueEnd;
    }
  }
  return tokens;
}
function num(props, key) {
  const v = props[key];
  if (typeof v === "number") return v;
  return void 0;
}
function str(props, key) {
  const v = props[key];
  if (typeof v === "string") return v;
  return void 0;
}
function numArr(props, _prefix) {
  for (const [k, v] of Object.entries(props)) {
    if (k.startsWith("amp_velcurve_")) {
      const vel = Number(k.slice("amp_velcurve_".length));
      if (!isNaN(vel) && typeof v === "number") {
        return [vel, v];
      }
    }
  }
  return void 0;
}

// src/tremolo.ts
function createTremolo(context, depth) {
  const input = context.createGain();
  const output = context.createGain();
  input.channelCount = 2;
  input.channelCountMode = "explicit";
  const splitter = context.createChannelSplitter(2);
  const ampL = context.createGain();
  const ampR = context.createGain();
  const merger = context.createChannelMerger(2);
  const lfoL = context.createOscillator();
  lfoL.type = "sine";
  lfoL.frequency.value = 1;
  lfoL.start();
  const lfoLAmp = context.createGain();
  const lfoR = context.createOscillator();
  lfoR.type = "sine";
  lfoR.frequency.value = 1.1;
  lfoR.start();
  const lfoRAmp = context.createGain();
  input.connect(splitter);
  splitter.connect(ampL, 0);
  splitter.connect(ampR, 1);
  ampL.connect(merger, 0, 0);
  ampR.connect(merger, 0, 1);
  lfoL.connect(lfoLAmp);
  lfoLAmp.connect(ampL.gain);
  lfoR.connect(lfoRAmp);
  lfoRAmp.connect(ampR.gain);
  merger.connect(output);
  const unsubscribe = depth((depth2) => {
    lfoLAmp.gain.value = depth2;
    lfoRAmp.gain.value = depth2;
  });
  input.disconnect = () => {
    unsubscribe();
    lfoL.stop();
    lfoR.stop();
    input.disconnect(splitter);
    splitter.disconnect(ampL, 0);
    splitter.disconnect(ampR, 1);
    ampL.disconnect(merger, 0, 0);
    ampR.disconnect(merger, 0, 1);
    lfoL.disconnect(lfoLAmp);
    lfoLAmp.disconnect(ampL.gain);
    lfoR.disconnect(lfoRAmp);
    lfoRAmp.disconnect(ampR.gain);
    merger.disconnect(output);
  };
  return { input, output };
}

// src/electric-piano.ts
function getElectricPianoNames() {
  return Object.keys(INSTRUMENTS2);
}
function gsPath(name) {
  return "samples/" + name.replace(/\.\w+$/, "");
}
function vcslPath(name) {
  return name.replace(/\.\w+$/, "");
}
var GS_BASE = "https://smpldsnds.github.io/sfzinstruments-greg-sullivan-e-pianos";
var INSTRUMENTS2 = {
  CP80: {
    sfzUrl: `${GS_BASE}/cp80/CP80.sfz`,
    baseUrl: `${GS_BASE}/cp80`,
    pathFromSampleName: gsPath
  },
  PianetT: {
    sfzUrl: `${GS_BASE}/planet-t/Pianet T.sfz`,
    baseUrl: `${GS_BASE}/planet-t`,
    pathFromSampleName: gsPath
  },
  WurlitzerEP200: {
    sfzUrl: `${GS_BASE}/wurlitzer-ep200/Wurlitzer EP200.sfz`,
    baseUrl: `${GS_BASE}/wurlitzer-ep200`,
    pathFromSampleName: gsPath
  },
  TX81Z: {
    sfzUrl: "https://smpldsnds.github.io/sgossner-vcsl/Electrophones/TX81Z - FM Piano.sfz",
    baseUrl: "https://smpldsnds.github.io/sgossner-vcsl/Electrophones",
    pathFromSampleName: vcslPath
  }
};
var ElectricPiano = Instrument(
  (ctx, options, smplr) => {
    const config = INSTRUMENTS2[options.instrument];
    if (!config) {
      throw new Error(
        `Unknown electric piano: "${options.instrument}". Valid names: ${Object.keys(INSTRUMENTS2).join(", ")}`
      );
    }
    const depth = createControl(0);
    const tremolo = {
      level: (level) => depth.set(midiVelToGain(level))
    };
    const tremoloNode = createTremolo(ctx, depth.subscribe);
    smplr.output.addInsert(tremoloNode);
    const ready = fetch(config.sfzUrl).then((r) => r.text()).then(
      (sfzText) => {
        var _a;
        return smplr.loadInstrument(
          sfzToPreset(sfzText, {
            baseUrl: config.baseUrl,
            pathFromSampleName: config.pathFromSampleName,
            formats: (_a = options.formats) != null ? _a : ["ogg", "m4a"]
          })
        );
      }
    );
    return { extras: { tremolo }, ready };
  }
);

// src/versilian.ts
var VCSL_BASE_URL = "https://smpldsnds.github.io/sgossner-vcsl";
var instrumentsPromise;
function getVersilianInstruments() {
  return instrumentsPromise != null ? instrumentsPromise : instrumentsPromise = fetch(VCSL_BASE_URL + "/sfz_files.json").then(
    (res) => res.json()
  );
}
var Versilian = Instrument(
  (ctx, options = {}, smplr) => loadVersilianInstrument(smplr, options)
);
function loadVersilianInstrument(smplr, options) {
  var _a;
  const instrument = (_a = options.instrument) != null ? _a : "Strings/Violin/Violin - Arco";
  const sfzUrl = `${VCSL_BASE_URL}/${instrument}.sfz`;
  const base = instrument.slice(0, instrument.lastIndexOf("/") + 1);
  const sampleBaseUrl2 = `${VCSL_BASE_URL}/${base}`;
  return fetch(sfzUrl).then((r) => r.text()).then(
    (sfzText) => smplr.loadInstrument(
      sfzToPreset(sfzText, {
        baseUrl: sampleBaseUrl2,
        pathFromSampleName: (name) => name.replace(/\.wav$/i, ""),
        formats: ["ogg", "m4a"]
      })
    )
  );
}

// src/mallet.ts
function getMalletNames() {
  return Object.keys(NAME_TO_PATH);
}
var Mallet = Instrument(
  (ctx, options = {}, smplr) => {
    var _a;
    return loadVersilianInstrument(smplr, __spreadProps(__spreadValues({}, options), {
      instrument: NAME_TO_PATH[(_a = options.instrument) != null ? _a : ""]
    }));
  }
);
var NAME_TO_PATH = {
  "Balafon - Hard Mallet": "Idiophones/Struck Idiophones/Balafon - Hard Mallet",
  "Balafon - Keyswitch": "Idiophones/Struck Idiophones/Balafon - Keyswitch",
  "Balafon - Soft Mallet": "Idiophones/Struck Idiophones/Balafon - Soft Mallet",
  "Balafon - Traditional Mallet": "Idiophones/Struck Idiophones/Balafon - Traditional Mallet",
  "Tubular Bells 1": "Idiophones/Struck Idiophones/Tubular Bells 1",
  "Tubular Bells 2": "Idiophones/Struck Idiophones/Tubular Bells 2",
  "Vibraphone - Bowed": "Idiophones/Struck Idiophones/Vibraphone - Bowed",
  "Vibraphone - Hard Mallets": "Idiophones/Struck Idiophones/Vibraphone - Hard Mallets",
  "Vibraphone - Keyswitch": "Idiophones/Struck Idiophones/Vibraphone - Keyswitch",
  "Vibraphone - Soft Mallets": "Idiophones/Struck Idiophones/Vibraphone - Soft Mallets",
  "Xylophone - Hard Mallets": "Idiophones/Struck Idiophones/Xylophone - Hard Mallets",
  "Xylophone - Keyswitch": "Idiophones/Struck Idiophones/Xylophone - Keyswitch",
  "Xylophone - Medium Mallets": "Idiophones/Struck Idiophones/Xylophone - Medium Mallets",
  "Xylophone - Soft Mallets": "Idiophones/Struck Idiophones/Xylophone - Soft Mallets"
};

// src/smplr/utils.ts
function spreadKeyRanges(samples) {
  if (samples.length === 0) return [];
  const sorted = [...samples].sort(([a], [b]) => a - b);
  return sorted.map(([midi, name], i) => {
    const low = i === 0 ? 0 : Math.floor((sorted[i - 1][0] + midi) / 2) + 1;
    const high = i === sorted.length - 1 ? 127 : Math.floor((midi + sorted[i + 1][0]) / 2);
    return {
      keyRange: [low, high],
      pitch: midi,
      sample: name
    };
  });
}

// src/mellotron.ts
var INSTRUMENT_VARIATIONS = {
  "300 STRINGS CELLO": ["300 STRINGS", "CELL"],
  "300 STRINGS VIOLA": ["300 STRINGS", "VIOL"]
};
function getMellotronNames() {
  return [
    "300 STRINGS CELLO",
    "300 STRINGS VIOLA",
    "8VOICE CHOIR",
    "BASSA+STRNGS",
    "BOYS CHOIR",
    "CHA CHA FLT",
    "CHM CLARINET",
    "CHMB 3 VLNS",
    "CHMB ALTOSAX",
    "CHMB FEMALE",
    "CHMB MALE VC",
    "CHMB TNR SAX",
    "CHMB TRMBONE",
    "CHMB TRUMPET",
    "CHMBLN CELLO",
    "CHMBLN FLUTE",
    "CHMBLN OBOE",
    "DIXIE+TRMBN",
    "FOXTROT+SAX",
    "HALFSP.BRASS",
    "MIXED STRGS",
    "MKII BRASS",
    "MKII GUITAR",
    "MKII ORGAN",
    "MKII SAX",
    "MKII VIBES",
    "MKII VIOLINS",
    "MOVE BS+STGS",
    "STRGS+BRASS",
    "TROMB+TRMPT",
    "TRON 16VLNS",
    "TRON CELLO",
    "TRON FLUTE",
    "TRON VIOLA"
  ];
}
var Mellotron = Instrument(
  (ctx, options = {}, smplr) => {
    var _a;
    const instrument = (_a = options.instrument) != null ? _a : "MKII VIOLINS";
    const variation = INSTRUMENT_VARIATIONS[instrument];
    const instrumentName = variation ? variation[0] : instrument;
    const baseUrl = `https://smpldsnds.github.io/archiveorg-mellotron/${instrumentName}/`;
    return fetch(baseUrl + "files.json").then((r) => r.json()).then(
      (names) => smplr.loadInstrument(
        mellotronToPreset(names, {
          instrument: instrumentName,
          variation: variation == null ? void 0 : variation[1]
        })
      )
    );
  }
);
function mellotronToPreset(sampleNames, config) {
  var _a;
  const entries = [];
  for (const sampleName of sampleNames) {
    if (config.variation && !sampleName.includes(config.variation)) continue;
    const midi = toMidi((_a = sampleName.split(" ")[0]) != null ? _a : "");
    if (midi === void 0) continue;
    entries.push([midi, sampleName]);
  }
  const spread = spreadKeyRanges(entries);
  const baseUrl = `https://smpldsnds.github.io/archiveorg-mellotron/${config.instrument}/`;
  const regions = spread.map(
    ({ keyRange, pitch, sample }) => ({
      sample,
      keyRange,
      pitch,
      loopAuto: { startRatio: 0.1, endRatio: 0.9 }
    })
  );
  return {
    samples: {
      baseUrl,
      formats: ["ogg", "m4a"]
    },
    groups: [{ regions }]
  };
}

// src/reverb/processor.min.ts
var PROCESSOR = `"use strict";(()=>{var f=class extends AudioWorkletProcessor{_pDLength;_preDelay;_pDWrite;_lp1;_lp2;_lp3;_excPhase;_taps;_Delays;sampleRate;static get parameterDescriptors(){return[["preDelay",0,0,sampleRate-1,"k-rate"],["bandwidth",.9999,0,1,"k-rate"],["inputDiffusion1",.75,0,1,"k-rate"],["inputDiffusion2",.625,0,1,"k-rate"],["decay",.5,0,1,"k-rate"],["decayDiffusion1",.7,0,.999999,"k-rate"],["decayDiffusion2",.5,0,.999999,"k-rate"],["damping",.005,0,1,"k-rate"],["excursionRate",.5,0,2,"k-rate"],["excursionDepth",.7,0,2,"k-rate"],["wet",1,0,1,"k-rate"],["dry",0,0,1,"k-rate"]].map(e=>new Object({name:e[0],defaultValue:e[1],minValue:e[2],maxValue:e[3],automationRate:e[4]}))}constructor(e){super(),this.sampleRate=sampleRate,this._Delays=[],this._pDLength=sampleRate+(128-sampleRate%128),this._preDelay=new Float32Array(this._pDLength),this._pDWrite=0,this._lp1=0,this._lp2=0,this._lp3=0,this._excPhase=0,[.004771345,.003595309,.012734787,.009307483,.022579886,.149625349,.060481839,.1249958,.030509727,.141695508,.089244313,.106280031].forEach(a=>this.makeDelay(a,sampleRate)),this._taps=Int16Array.from([.008937872,.099929438,.064278754,.067067639,.066866033,.006283391,.035818689,.011861161,.121870905,.041262054,.08981553,.070931756,.011256342,.004065724],a=>Math.round(a*sampleRate))}makeDelay(e,a){let t=Math.round(e*a),s=2**Math.ceil(Math.log2(t));this._Delays.push([new Float32Array(s),t-1,0,s-1])}writeDelay(e,a){return this._Delays[e][0][this._Delays[e][1]]=a}readDelay(e){return this._Delays[e][0][this._Delays[e][2]]}readDelayAt(e,a){let t=this._Delays[e];return t[0][t[2]+a&t[3]]}readDelayCAt(e,a){let t=this._Delays[e],s=a-~~a,d=~~a+t[2]-1,r=t[3],D=t[0][d++&r],l=t[0][d++&r],h=t[0][d++&r],y=t[0][d&r],u=(3*(l-h)-D+y)/2,m=2*h+D-(5*l+y)/2,c=(h-D)/2;return((u*s+m)*s+c)*s+l}process(e,a,t){let s=~~t.preDelay[0],d=t.bandwidth[0],r=t.inputDiffusion1[0],D=t.inputDiffusion2[0],l=t.decay[0],h=t.decayDiffusion1[0],y=t.decayDiffusion2[0],u=1-t.damping[0],m=t.excursionRate[0]/sampleRate,c=t.excursionDepth[0]*sampleRate/1e3,w=t.wet[0]*.6,A=t.dry[0];if(e[0].length==2)for(let i=127;i>=0;i--)this._preDelay[this._pDWrite+i]=(e[0][0][i]+e[0][1][i])*.5,a[0][0][i]=e[0][0][i]*A,a[0][1][i]=e[0][1][i]*A;else if(e[0].length>0){this._preDelay.set(e[0][0],this._pDWrite);for(let i=127;i>=0;i--)a[0][0][i]=a[0][1][i]=e[0][0][i]*A}else this._preDelay.set(new Float32Array(128),this._pDWrite);let o=0;for(;o<128;){let i=0,b=0;this._lp1+=d*(this._preDelay[(this._pDLength+this._pDWrite-s+o)%this._pDLength]-this._lp1);let p=this.writeDelay(0,this._lp1-r*this.readDelay(0));p=this.writeDelay(1,r*(p-this.readDelay(1))+this.readDelay(0)),p=this.writeDelay(2,r*p+this.readDelay(1)-D*this.readDelay(2)),p=this.writeDelay(3,D*(p-this.readDelay(3))+this.readDelay(2));let k=D*p+this.readDelay(3),g=c*(1+Math.cos(this._excPhase*6.28)),x=c*(1+Math.sin(this._excPhase*6.2847)),_=this.writeDelay(4,k+l*this.readDelay(11)+h*this.readDelayCAt(4,g));this.writeDelay(5,this.readDelayCAt(4,g)-h*_),this._lp2+=u*(this.readDelay(5)-this._lp2),_=this.writeDelay(6,l*this._lp2-y*this.readDelay(6)),this.writeDelay(7,this.readDelay(6)+y*_),_=this.writeDelay(8,k+l*this.readDelay(7)+h*this.readDelayCAt(8,x)),this.writeDelay(9,this.readDelayCAt(8,x)-h*_),this._lp3+=u*(this.readDelay(9)-this._lp3),_=this.writeDelay(10,l*this._lp3-y*this.readDelay(10)),this.writeDelay(11,this.readDelay(10)+y*_),i=this.readDelayAt(9,this._taps[0])+this.readDelayAt(9,this._taps[1])-this.readDelayAt(10,this._taps[2])+this.readDelayAt(11,this._taps[3])-this.readDelayAt(5,this._taps[4])-this.readDelayAt(6,this._taps[5])-this.readDelayAt(7,this._taps[6]),b=this.readDelayAt(5,this._taps[7])+this.readDelayAt(5,this._taps[8])-this.readDelayAt(6,this._taps[9])+this.readDelayAt(7,this._taps[10])-this.readDelayAt(9,this._taps[11])-this.readDelayAt(10,this._taps[12])-this.readDelayAt(11,this._taps[13]),a[0][0][o]+=i*w,a[0][1][o]+=b*w,this._excPhase+=m,o++;for(let R=0,n=this._Delays[0];R<this._Delays.length;n=this._Delays[++R])n[1]=n[1]+1&n[3],n[2]=n[2]+1&n[3]}return this._pDWrite=(this._pDWrite+128)%this._pDLength,!0}};registerProcessor("DattorroReverb",f);})();`;

// src/reverb/reverb.ts
var PARAMS = [
  "preDelay",
  "bandwidth",
  "inputDiffusion1",
  "inputDiffusion2",
  "decay",
  "decayDiffusion1",
  "decayDiffusion2",
  "damping",
  "excursionRate",
  "excursionDepth",
  "wet",
  "dry"
];
var init = /* @__PURE__ */ new WeakMap();
function createDattorroReverbEffect(context) {
  return __async(this, null, function* () {
    if (!context.audioWorklet) {
      console.warn(
        "AudioWorklet not supported in this context. Reverb not available."
      );
      return void 0;
    }
    let ready = init.get(context);
    if (!ready) {
      const blob = new Blob([PROCESSOR], { type: "application/javascript" });
      const url = URL.createObjectURL(blob);
      ready = context.audioWorklet.addModule(url);
      init.set(context, ready);
    }
    yield ready;
    const reverb = new AudioWorkletNode(context, "DattorroReverb", {
      outputChannelCount: [2]
    });
    return reverb;
  });
}
var _effect, _ready, _output;
var ReverbImpl = class {
  constructor(context) {
    __privateAdd(this, _effect);
    __privateAdd(this, _ready);
    __privateAdd(this, _output);
    this.input = context.createGain();
    __privateSet(this, _output, context.destination);
    __privateSet(this, _ready, createDattorroReverbEffect(context).then((reverb) => {
      if (reverb) {
        this.input.connect(reverb);
        reverb.connect(__privateGet(this, _output));
        __privateSet(this, _effect, reverb);
      }
      return this;
    }));
  }
  get paramNames() {
    return PARAMS;
  }
  getParam(name) {
    var _a;
    return (_a = __privateGet(this, _effect)) == null ? void 0 : _a.parameters.get(name);
  }
  get isReady() {
    return __privateGet(this, _effect) !== void 0;
  }
  ready() {
    return __privateGet(this, _ready);
  }
  connect(output) {
    if (__privateGet(this, _effect)) {
      __privateGet(this, _effect).disconnect(__privateGet(this, _output));
      __privateGet(this, _effect).connect(output);
    }
    __privateSet(this, _output, output);
  }
};
_effect = new WeakMap();
_ready = new WeakMap();
_output = new WeakMap();
var Reverb = asConstructable(ReverbImpl);

// src/sampler.ts
function isSmplrPreset(x) {
  return typeof x === "object" && x !== null && "groups" in x && Array.isArray(x.groups);
}
var Sampler = Instrument(
  (ctx, options = {}, smplr) => {
    var _a, _b;
    const storage = (_a = options.storage) != null ? _a : HttpStorage;
    const loadFromInput = (input) => {
      if (isSmplrPreset(input)) {
        return smplr.loadInstrument(input);
      }
      return getSource(ctx, input).then((source) => buildSamplerBuffers(source, ctx, storage, options)).then(({ json, buffers }) => smplr.loadInstrument(json, buffers));
    };
    const initialInput = "preset" in options && options.preset ? options.preset : (_b = options.buffers) != null ? _b : {};
    return {
      extras: { reload: loadFromInput },
      ready: loadFromInput(initialInput)
    };
  }
);
function getSource(ctx, raw) {
  if (typeof raw === "function") {
    const ab = {};
    return raw(ctx, ab).then(
      () => ab
    );
  }
  return Promise.resolve(raw);
}
function buildSamplerBuffers(source, context, storage, options) {
  return __async(this, null, function* () {
    const { json, urlMap, preloaded } = samplerToPreset(source, options);
    yield Promise.all(
      Object.entries(urlMap).map((_0) => __async(null, [_0], function* ([name, url]) {
        const buffer = yield loadAudioBuffer(context, url, storage);
        if (buffer) preloaded.set(name, buffer);
      }))
    );
    return { json, buffers: preloaded };
  });
}
function samplerToPreset(source, options = {}) {
  const keys = Object.keys(source);
  const preloaded = /* @__PURE__ */ new Map();
  const urlMap = {};
  const aliases = {};
  const midiEntries = [];
  const nonMidiKeys = [];
  for (const key of keys) {
    const midi = toMidi(key);
    if (midi !== void 0) {
      midiEntries.push([midi, key]);
    } else {
      nonMidiKeys.push(key);
    }
  }
  const allMidi = nonMidiKeys.length === 0;
  const entries = [];
  if (allMidi && midiEntries.length > 0) {
    const spread = spreadKeyRanges(
      midiEntries.map(([midi, key]) => [midi, key])
    );
    for (let i = 0; i < midiEntries.length; i++) {
      const [midi, key] = midiEntries[i];
      const { keyRange, pitch } = spread[i];
      entries.push({ midi, key, sampleName: key, keyRange, pitch });
    }
  } else {
    for (const [midi, key] of midiEntries) {
      entries.push({
        midi,
        key,
        sampleName: key,
        keyRange: [midi, midi],
        pitch: midi
      });
    }
    let seqMidi = 0;
    for (const key of nonMidiKeys) {
      while (entries.some((e) => e.midi === seqMidi)) seqMidi++;
      const midi = seqMidi++;
      aliases[key] = midi;
      entries.push({
        midi,
        key,
        sampleName: key,
        keyRange: [midi, midi],
        pitch: midi
      });
    }
  }
  for (const { key, sampleName } of entries) {
    const value = source[key];
    if (value instanceof AudioBuffer) {
      preloaded.set(sampleName, value);
    } else if (typeof value === "string") {
      urlMap[sampleName] = value;
    }
  }
  const json = {
    // baseUrl doesn't matter: all samples will be pre-loaded
    samples: { baseUrl: "", formats: ["ogg"] },
    groups: [
      {
        regions: entries.map(({ sampleName, keyRange, pitch }) => ({
          sample: sampleName,
          keyRange,
          pitch
        }))
      }
    ],
    aliases: Object.keys(aliases).length > 0 ? aliases : void 0,
    defaults: {
      ampRelease: options.decayTime,
      lpfCutoffHz: options.lpfCutoffHz,
      detune: options.detune
    }
  };
  return { json, urlMap, preloaded };
}

// src/smolken.ts
function getSmolkenNames() {
  return ["Pizzicato", "Arco", "Switched"];
}
function getSmolkenUrl(instrument) {
  const FILES = {
    Arco: "arco",
    Pizzicato: "pizz",
    Switched: "switched"
  };
  return `https://smpldsnds.github.io/sfzinstruments-dsmolken-double-bass/d_smolken_rubner_bass_${FILES[instrument]}.sfz`;
}
var SMOLKEN_BASE_URL = "https://smpldsnds.github.io/sfzinstruments-dsmolken-double-bass";
var Smolken = Instrument(
  (ctx, options = {}, smplr) => {
    var _a;
    const sfzUrl = getSmolkenUrl((_a = options.instrument) != null ? _a : "Arco");
    return fetch(sfzUrl).then((r) => r.text()).then(
      (sfzText) => smplr.loadInstrument(
        sfzToPreset(sfzText, {
          baseUrl: SMOLKEN_BASE_URL,
          pathFromSampleName: (name) => name.replace(/\\/g, "/").replace(/\.wav$/i, ""),
          formats: ["ogg", "m4a"]
        })
      )
    );
  }
);

// src/soundfont/soundfont-instrument.ts
function gleitzKitUrl(name, kit) {
  var _a;
  const format = (_a = findFirstSupportedFormat(["ogg", "mp3"])) != null ? _a : "mp3";
  console.debug(`Soundfont: using ${format} format for ${name}`);
  return `https://gleitz.github.io/midi-js-soundfonts/${kit}/${name}-${format}.js`;
}
var SOUNDFONT_KITS = ["MusyngKite", "FluidR3_GM"];
var DEFAULT_SOUNDFONT_KIT = SOUNDFONT_KITS[0];
var SOUNDFONT_INSTRUMENTS = [
  "accordion",
  "acoustic_bass",
  "acoustic_grand_piano",
  "acoustic_guitar_nylon",
  "acoustic_guitar_steel",
  "agogo",
  "alto_sax",
  "applause",
  "bagpipe",
  "banjo",
  "baritone_sax",
  "bassoon",
  "bird_tweet",
  "blown_bottle",
  "brass_section",
  "breath_noise",
  "bright_acoustic_piano",
  "celesta",
  "cello",
  "choir_aahs",
  "church_organ",
  "clarinet",
  "clavinet",
  "contrabass",
  "distortion_guitar",
  "drawbar_organ",
  "dulcimer",
  "electric_bass_finger",
  "electric_bass_pick",
  "electric_grand_piano",
  "electric_guitar_clean",
  "electric_guitar_jazz",
  "electric_guitar_muted",
  "electric_piano_1",
  "electric_piano_2",
  "english_horn",
  "fiddle",
  "flute",
  "french_horn",
  "fretless_bass",
  "fx_1_rain",
  "fx_2_soundtrack",
  "fx_3_crystal",
  "fx_4_atmosphere",
  "fx_5_brightness",
  "fx_6_goblins",
  "fx_7_echoes",
  "fx_8_scifi",
  "glockenspiel",
  "guitar_fret_noise",
  "guitar_harmonics",
  "gunshot",
  "harmonica",
  "harpsichord",
  "helicopter",
  "honkytonk_piano",
  "kalimba",
  "koto",
  "lead_1_square",
  "lead_2_sawtooth",
  "lead_3_calliope",
  "lead_4_chiff",
  "lead_5_charang",
  "lead_6_voice",
  "lead_7_fifths",
  "lead_8_bass__lead",
  "marimba",
  "melodic_tom",
  "music_box",
  "muted_trumpet",
  "oboe",
  "ocarina",
  "orchestra_hit",
  "orchestral_harp",
  "overdriven_guitar",
  "pad_1_new_age",
  "pad_2_warm",
  "pad_3_polysynth",
  "pad_4_choir",
  "pad_5_bowed",
  "pad_6_metallic",
  "pad_7_halo",
  "pad_8_sweep",
  "pan_flute",
  "percussive_organ",
  "piccolo",
  "pizzicato_strings",
  "recorder",
  "reed_organ",
  "reverse_cymbal",
  "rock_organ",
  "seashore",
  "shakuhachi",
  "shamisen",
  "shanai",
  "sitar",
  "slap_bass_1",
  "slap_bass_2",
  "soprano_sax",
  "steel_drums",
  "string_ensemble_1",
  "string_ensemble_2",
  "synth_bass_1",
  "synth_bass_2",
  "synth_brass_1",
  "synth_brass_2",
  "synth_choir",
  "synth_drum",
  "synth_strings_1",
  "synth_strings_2",
  "taiko_drum",
  "tango_accordion",
  "telephone_ring",
  "tenor_sax",
  "timpani",
  "tinkle_bell",
  "tremolo_strings",
  "trombone",
  "trumpet",
  "tuba",
  "tubular_bells",
  "vibraphone",
  "viola",
  "violin",
  "voice_oohs",
  "whistle",
  "woodblock",
  "xylophone"
];

// src/soundfont/soundfont-loops.ts
function getGoldstSoundfontLoopsUrl(instrument, kit) {
  if (instrument.startsWith("http")) return void 0;
  return `https://goldst.dev/midi-js-soundfonts/${kit}/${instrument}-loop.json`;
}
function fetchSoundfontLoopData(url, sampleRate = 44100) {
  return __async(this, null, function* () {
    if (!url) return void 0;
    try {
      const req = yield fetch(url);
      if (req.status !== 200) return;
      const raw = yield req.json();
      const loopData = {};
      Object.keys(raw).forEach((key) => {
        const midi = toMidi(key);
        if (midi === void 0) return;
        const offsets = raw[key];
        loopData[midi] = [offsets[0] / sampleRate, offsets[1] / sampleRate];
      });
      return loopData;
    } catch (err) {
      return void 0;
    }
  });
}

// src/soundfont/soundfont.ts
function getSoundfontKits() {
  return SOUNDFONT_KITS;
}
function getSoundfontNames() {
  return SOUNDFONT_INSTRUMENTS;
}
var Soundfont = Instrument(
  (ctx, options = {}, smplr) => {
    const config = getSoundfontConfig(options);
    const gain = ctx.createGain();
    gain.gain.value = config.extraGain;
    smplr.output.addInsert(gain);
    return loadSoundfontData(ctx, config).then(
      ({ buffers, noteNames, loopData }) => smplr.loadInstrument(soundfontToPreset(noteNames, loopData), buffers)
    );
  }
);
function loadSoundfontData(context, config) {
  return __async(this, null, function* () {
    const [{ buffers, noteNames }, loopData] = yield Promise.all([
      decodeSoundfontFile(context, config),
      fetchSoundfontLoopData(config.loopDataUrl)
    ]);
    return { buffers, noteNames, loopData };
  });
}
function decodeSoundfontFile(context, config) {
  return __async(this, null, function* () {
    const sourceFile = yield (yield config.storage.fetch(config.instrumentUrl)).text();
    const json = midiJsToJson(sourceFile);
    const noteNames = Object.keys(json);
    const buffers = /* @__PURE__ */ new Map();
    yield Promise.all(
      noteNames.map((noteName) => __async(null, null, function* () {
        const midi = toMidi(noteName);
        if (midi === void 0) return;
        try {
          const audioData = base64ToArrayBuffer(
            removeBase64Prefix(json[noteName])
          );
          const buffer = yield context.decodeAudioData(audioData);
          buffers.set(noteName, buffer);
        } catch (error) {
          console.warn(
            `Soundfont: failed to decode note ${noteName}`,
            error instanceof Error ? error.message : error
          );
        }
      }))
    );
    return { buffers, noteNames: [...buffers.keys()] };
  });
}
function soundfontToPreset(noteNames, loopData) {
  const entries = [];
  for (const noteName of noteNames) {
    const midi = toMidi(noteName);
    if (midi === void 0) continue;
    entries.push([midi, noteName]);
  }
  const spread = spreadKeyRanges(entries);
  const regions = spread.map(
    ({ keyRange, pitch, sample }) => {
      const region = { sample, keyRange, pitch };
      if (loopData) {
        const loop = loopData[pitch];
        if (loop) {
          region.loop = true;
          region.loopStart = loop[0];
          region.loopEnd = loop[1];
        }
      }
      return region;
    }
  );
  return {
    // baseUrl doesn't matter — all buffers are pre-loaded
    samples: { baseUrl: "", formats: ["ogg"] },
    groups: [{ regions }]
  };
}
function getSoundfontConfig(options) {
  var _a, _b, _c, _d, _e;
  if (!options.instrument && !options.instrumentUrl) {
    throw Error("Soundfont: instrument or instrumentUrl is required");
  }
  const config = {
    kit: (_a = options.kit) != null ? _a : DEFAULT_SOUNDFONT_KIT,
    instrument: options.instrument,
    storage: (_b = options.storage) != null ? _b : HttpStorage,
    extraGain: (_c = options.extraGain) != null ? _c : 5,
    loadLoopData: (_d = options.loadLoopData) != null ? _d : false,
    loopDataUrl: options.loopDataUrl,
    instrumentUrl: (_e = options.instrumentUrl) != null ? _e : ""
  };
  if (config.instrument && config.instrument.startsWith("http")) {
    console.warn(
      "Use 'instrumentUrl' instead of 'instrument' to load from a URL"
    );
    config.instrumentUrl = config.instrument;
    config.instrument = void 0;
  }
  if (!config.instrumentUrl) {
    if (config.instrument) {
      config.instrumentUrl = gleitzKitUrl(config.instrument, config.kit);
    } else {
      throw Error(
        "Soundfont: 'instrument' or 'instrumentUrl' configuration parameter is required"
      );
    }
  } else {
    if (config.kit !== DEFAULT_SOUNDFONT_KIT || config.instrument) {
      console.warn(
        "Soundfont: 'kit' and 'instrument' config parameters are ignored because 'instrumentUrl' is explicitly set."
      );
    }
  }
  if (config.loadLoopData && config.instrument && !config.loopDataUrl) {
    config.loopDataUrl = getGoldstSoundfontLoopsUrl(
      config.instrument,
      config.kit
    );
  }
  return config;
}
function midiJsToJson(source) {
  const header = source.indexOf("MIDI.Soundfont.");
  if (header < 0) throw Error("Invalid MIDI.js Soundfont format");
  const start = source.indexOf("=", header) + 2;
  const end = source.lastIndexOf(",");
  return JSON.parse(source.slice(start, end) + "}");
}
function removeBase64Prefix(audioBase64) {
  return audioBase64.slice(audioBase64.indexOf(",") + 1);
}
function base64ToArrayBuffer(base64) {
  const decoded = window.atob(base64);
  const len = decoded.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = decoded.charCodeAt(i);
  }
  return bytes.buffer;
}

// src/soundfont2.ts
function sf2InstrumentToPreset(sf2Instrument, context) {
  const buffers = /* @__PURE__ */ new Map();
  const regions = [];
  for (const zone of sf2Instrument.zones) {
    const { sample, keyRange } = zone;
    const { header } = sample;
    const sampleName = header.name;
    const float32 = new Float32Array(sample.data.length);
    for (let i = 0; i < sample.data.length; i++)
      float32[i] = sample.data[i] / 32768;
    const audioBuffer = context.createBuffer(
      1,
      float32.length,
      header.sampleRate
    );
    audioBuffer.getChannelData(0).set(float32);
    buffers.set(sampleName, audioBuffer);
    const hasLoop = header.startLoop >= 0 && header.endLoop > header.startLoop;
    regions.push(__spreadValues(__spreadValues({
      sample: sampleName,
      pitch: header.originalPitch
    }, keyRange && {
      keyRange: [keyRange.lo, keyRange.hi]
    }), hasLoop && {
      loop: true,
      loopStart: header.startLoop / header.sampleRate,
      loopEnd: header.endLoop / header.sampleRate
    }));
  }
  return {
    json: { samples: { baseUrl: "", formats: [] }, groups: [{ regions }] },
    buffers
  };
}
var Soundfont2 = Instrument(
  (ctx, options, smplr) => {
    let soundfont = void 0;
    let instrumentNamesList = [];
    const baseLoadInstrument = smplr.loadInstrument.bind(smplr);
    const extras = {
      get instrumentNames() {
        return instrumentNamesList;
      },
      loadInstrument(instrumentName) {
        const sf2inst = soundfont == null ? void 0 : soundfont.instruments.find(
          (inst) => inst.header.name === instrumentName
        );
        if (!sf2inst) return void 0;
        const { json, buffers } = sf2InstrumentToPreset(sf2inst, ctx);
        return baseLoadInstrument(json, buffers);
      }
    };
    const ready = loadSoundfont(options).then((sf2) => {
      soundfont = sf2;
      instrumentNamesList = sf2.instruments.map(
        (inst) => inst.header.name
      );
    });
    return { extras, ready };
  }
);
var Soundfont2Sampler = Soundfont2;
function loadSoundfont(options) {
  return __async(this, null, function* () {
    const buffer = yield fetch(options.url).then((res) => res.arrayBuffer());
    const data = new Uint8Array(buffer);
    return options.createSoundfont(data);
  });
}

// src/splendid-grand-piano.ts
var BASE_URL = "https://smpldsnds.github.io/sfzinstruments-splendid-grand-piano/samples";
var DEFAULTS = {
  baseUrl: BASE_URL,
  storage: HttpStorage,
  detune: 0,
  volume: 100,
  velocity: 100,
  decayTime: 0.5
};
var SplendidGrandPiano = Instrument(
  (ctx, options = {}, smplr) => smplr.loadInstrument(pianoToPreset(__spreadValues(__spreadValues({}, DEFAULTS), options)))
);
function pianoToPreset(options) {
  var _a;
  const { notesToLoad } = options;
  const layers = notesToLoad ? LAYERS.filter(
    (layer) => layer.vel_range[0] <= notesToLoad.velocityRange[1] && layer.vel_range[1] >= notesToLoad.velocityRange[0]
  ) : LAYERS;
  const groups = layers.map((layer) => {
    const samples = notesToLoad ? layer.samples.filter(
      ([midi]) => notesToLoad.notes.includes(midi)
    ) : layer.samples;
    const regions = spreadKeyRanges(samples).map(
      ({ keyRange, pitch, sample }) => ({
        keyRange,
        pitch,
        sample
      })
    );
    const group = {
      velRange: layer.vel_range,
      regions
    };
    if ("cutoff" in layer && layer.cutoff !== void 0) {
      group.lpfCutoffHz = layer.cutoff;
    }
    return group;
  });
  return {
    samples: {
      baseUrl: options.baseUrl,
      formats: (_a = options.formats) != null ? _a : ["ogg", "m4a"]
    },
    defaults: {
      ampRelease: options.decayTime,
      detune: options.detune
    },
    groups
  };
}
var LAYERS = [
  {
    name: "PPP",
    vel_range: [1, 40],
    cutoff: 1e3,
    samples: [
      [23, "PP B-1"],
      [27, "PP D#0"],
      [29, "PP F0"],
      [31, "PP G0"],
      [33, "PP A0"],
      [35, "PP B0"],
      [37, "PP C#1"],
      [38, "PP D1"],
      [40, "PP E1"],
      [41, "PP F1"],
      [43, "PP G1"],
      [45, "PP A1"],
      [47, "PP B1"],
      [48, "PP C2"],
      [50, "PP D2"],
      [52, "PP E2"],
      [53, "PP F2"],
      [55, "PP G2"],
      [56, "PP G#2"],
      [57, "PP A2"],
      [58, "PP A#2"],
      [59, "PP B2"],
      [60, "PP C3"],
      [62, "PP D3"],
      [64, "PP E3"],
      [65, "PP F3"],
      [67, "PP G3"],
      [69, "PP A3"],
      [71, "PP B3"],
      [72, "PP C4"],
      [74, "PP D4"],
      [76, "PP E4"],
      [77, "PP F4"],
      [79, "PP G4"],
      [80, "PP G#4"],
      [81, "PP A4"],
      [82, "PP A#4"],
      [83, "PP B4"],
      [85, "PP C#5"],
      [86, "PP D5"],
      [87, "PP D#5"],
      [89, "PP F5"],
      [90, "PP F#5"],
      [91, "PP G5"],
      [92, "PP G#5"],
      [93, "PP A5"],
      [94, "PP A#5"],
      [95, "PP B5"],
      [96, "PP C6"],
      [97, "PP C#6"],
      [98, "PP D6"],
      [99, "PP D#6"],
      [100, "PP E6"],
      [101, "PP F6"],
      [102, "PP F#6"],
      [103, "PP G6"],
      [104, "PP G#6"],
      [105, "PP A6"],
      [106, "PP A#6"],
      [107, "PP B6"],
      [108, "PP C7"]
    ]
  },
  {
    name: "PP",
    vel_range: [41, 67],
    samples: [
      [23, "PP B-1"],
      [27, "PP D#0"],
      [29, "PP F0"],
      [31, "PP G0"],
      [33, "PP A0"],
      [35, "PP B0"],
      [37, "PP C#1"],
      [38, "PP D1"],
      [40, "PP E1"],
      [41, "PP F1"],
      [43, "PP G1"],
      [45, "PP A1"],
      [47, "PP B1"],
      [48, "PP C2"],
      [50, "PP D2"],
      [52, "PP E2"],
      [53, "PP F2"],
      [55, "PP G2"],
      [56, "PP G#2"],
      [57, "PP A2"],
      [58, "PP A#2"],
      [59, "PP B2"],
      [60, "PP C3"],
      [62, "PP D3"],
      [64, "PP E3"],
      [65, "PP F3"],
      [67, "PP G3"],
      [69, "PP A3"],
      [71, "PP B3"],
      [72, "PP C4"],
      [74, "PP D4"],
      [76, "PP E4"],
      [77, "PP F4"],
      [79, "PP G4"],
      [80, "PP G#4"],
      [81, "PP A4"],
      [82, "PP A#4"],
      [83, "PP B4"],
      [85, "PP C#5"],
      [86, "PP D5"],
      [87, "PP D#5"],
      [89, "PP F5"],
      [90, "PP F#5"],
      [91, "PP G5"],
      [92, "PP G#5"],
      [93, "PP A5"],
      [94, "PP A#5"],
      [95, "PP B5"],
      [96, "PP C6"],
      [97, "PP C#6"],
      [98, "PP D6"],
      [99, "PP D#6"],
      [100, "PP E6"],
      [101, "PP F6"],
      [102, "PP F#6"],
      [103, "PP G6"],
      [104, "PP G#6"],
      [105, "PP A6"],
      [106, "PP A#6"],
      [107, "PP B6"],
      [108, "PP C7"]
    ]
  },
  {
    name: "MP",
    vel_range: [68, 84],
    samples: [
      [23, "Mp B-1"],
      [27, "Mp D#0"],
      [29, "Mp F0"],
      [31, "Mp G0"],
      [33, "Mp A0"],
      [35, "Mp B0"],
      [37, "Mp C#1"],
      [38, "Mp D1"],
      [40, "Mp E1"],
      [41, "Mp F1"],
      [43, "Mp G1"],
      [45, "Mp A1"],
      [47, "Mp B1"],
      [48, "Mp C2"],
      [50, "Mp D2"],
      [52, "Mp E2"],
      [53, "Mp F2"],
      [55, "Mp G2"],
      [56, "Mp G#2"],
      [57, "Mp A2"],
      [58, "Mp A#2"],
      [59, "Mp B2"],
      [60, "Mp C3"],
      [62, "Mp D3"],
      [64, "Mp E3"],
      [65, "Mp F3"],
      [67, "Mp G3"],
      [69, "Mp A3"],
      [71, "Mp B3"],
      [72, "Mp C4"],
      [74, "Mp D4"],
      [76, "Mp E4"],
      [77, "Mp F4"],
      [79, "Mp G4"],
      [80, "Mp G#4"],
      [81, "Mp A4"],
      [82, "Mp A#4"],
      [83, "Mp B4"],
      [85, "Mp C#5"],
      [86, "Mp D5"],
      [87, "Mp D#5"],
      [88, "Mp E5"],
      [89, "Mp F5"],
      [90, "Mp F#5"],
      [91, "Mp G5"],
      [92, "Mp G#5"],
      [93, "Mp A5"],
      [94, "Mp A#5"],
      [95, "Mp B5"],
      [96, "Mp C6"],
      [97, "Mp C#6"],
      [98, "Mp D6"],
      [99, "Mp D#6"],
      [100, "PP E6"],
      [101, "Mp F6"],
      [102, "Mp F#6"],
      [103, "Mp G6"],
      [104, "Mp G#6"],
      [105, "Mp A6"],
      [106, "Mp A#6"],
      [107, "PP B6"],
      [108, "PP C7"]
    ]
  },
  {
    name: "MF",
    vel_range: [85, 100],
    samples: [
      [23, "Mf B-1"],
      [27, "Mf D#0"],
      [29, "Mf F0"],
      [31, "Mf G0"],
      [33, "Mf A0"],
      [35, "Mf B0"],
      [37, "MF C#1"],
      [38, "MF D1"],
      [40, "MF E1"],
      [41, "MF F1"],
      [43, "MF G1"],
      [45, "MF A1"],
      [47, "MF B1"],
      [48, "MF C2"],
      [50, "MF D2"],
      [52, "MF E2"],
      [53, "MF F2"],
      [55, "MF G2"],
      [56, "MF G#2"],
      [57, "MF A2"],
      [58, "MF A#2"],
      [59, "MF B2"],
      [60, "MF C3"],
      [62, "MF D3"],
      [64, "MF E3"],
      [65, "MF F3"],
      [67, "MF G3"],
      [69, "MF A3"],
      [71, "MF B3"],
      [72, "MF C4"],
      [74, "Mf D4"],
      [76, "Mf E4"],
      [77, "Mf F4"],
      [79, "Mf G4"],
      [80, "Mf G#4"],
      [81, "Mf A4"],
      [82, "Mf A#4"],
      [83, "Mf B4"],
      [85, "Mf C#5"],
      [86, "Mf D5"],
      [87, "Mf D#5"],
      [88, "Mf E5"],
      [89, "Mf F5"],
      [90, "Mf F#5"],
      [91, "Mf G5"],
      [92, "Mf G#5"],
      [93, "Mf A5"],
      [94, "Mf A#5"],
      [95, "Mf B5"],
      [96, "Mf C6"],
      [97, "Mf C#6"],
      [98, "Mf D6"],
      [99, "Mf D#6"],
      [100, "Mf E6"],
      [101, "Mf F6"],
      [102, "Mf F#6"],
      [103, "Mf G6"],
      [104, "Mf G#6"],
      [105, "Mf A6"],
      [106, "Mf A#6"],
      [107, "Mf B6"],
      [108, "PP C7"]
    ]
  },
  {
    name: "FF",
    vel_range: [101, 127],
    samples: [
      [23, "FF B-1"],
      [27, "FF D#0"],
      [29, "FF F0"],
      [31, "FF G0"],
      [33, "FF A0"],
      [35, "FF B0"],
      [37, "FF C#1"],
      [38, "FF D1"],
      [40, "FF E1"],
      [41, "FF F1"],
      [43, "FF G1"],
      [45, "FF A1"],
      [47, "FF B1"],
      [48, "FF C2"],
      [50, "FF D2"],
      [52, "FF E2"],
      [53, "FF F2"],
      [55, "FF G2"],
      [56, "FF G#2"],
      [57, "FF A2"],
      [58, "FF A#2"],
      [59, "FF B2"],
      [60, "FF C3"],
      [62, "FF D3"],
      [64, "FF E3"],
      [65, "FF F3"],
      [67, "FF G3"],
      [69, "FF A3"],
      [71, "FF B3"],
      [72, "FF C4"],
      [74, "FF D4"],
      [76, "FF E4"],
      [77, "FF F4"],
      [79, "FF G4"],
      [80, "FF G#4"],
      [81, "FF A4"],
      [82, "FF A#4"],
      [83, "FF B4"],
      [85, "FF C#5"],
      [86, "FF D5"],
      [88, "FF E5"],
      [89, "FF F5"],
      [91, "FF G5"],
      [93, "FF A5"],
      [95, "Mf B5"],
      [96, "Mf C6"],
      [97, "Mf C#6"],
      [98, "Mf D6"],
      [99, "Mf D#6"],
      [100, "Mf E6"],
      [102, "Mf F#6"],
      [103, "Mf G6"],
      [104, "Mf G#6"],
      [105, "Mf A6"],
      [106, "Mf A#6"],
      [107, "Mf B6"],
      [108, "Mf C7"]
    ]
  }
];
export {
  CacheStorage,
  DRUM_ABUSE_PACKS,
  DrumAbuse,
  DrumMachine,
  ElectricPiano,
  HttpStorage,
  Instrument,
  LAYERS,
  Mallet,
  Mellotron,
  NAME_TO_PATH,
  Reverb,
  SampleLoader,
  Sampler,
  Scheduler,
  Sequencer,
  Smolken,
  Soundfont,
  Soundfont2,
  Soundfont2Sampler,
  SplendidGrandPiano,
  Versilian,
  audioBufferToWav,
  audioBufferToWav16,
  drumAbuseSampleUrl,
  drumMachineToPreset,
  getDrumAbuseMachineNames,
  getDrumAbuseMachinePack,
  getDrumAbuseMachinesForPack,
  getDrumAbusePackNames,
  getDrumMachineNames,
  getElectricPianoNames,
  getMalletNames,
  getMellotronNames,
  getSmolkenNames,
  getSoundfontKits,
  getSoundfontNames,
  getVersilianInstruments,
  loadVersilianInstrument,
  mellotronToPreset,
  pianoToPreset,
  renderOffline,
  samplerToPreset,
  sf2InstrumentToPreset,
  soundfontToPreset,
  trimSilence
};
//# sourceMappingURL=index.mjs.map