'use strict';
const _ = require('underscore');

function stringify(object) {
  if (object === undefined) {
    return object;
  }

  return typeof object === 'string' ? object : JSON.stringify(object, (key, value) =>
      (key !== 'logWrap' && key !== 'isLogWrapped' ? value : undefined)
    );
}

function wrapFunctions(object, moduleName, makeWrapper) {
  const funcs = getAllFuncs(object);
  return _.each(funcs, funcName => (object[funcName] = makeWrapper(funcName, object[funcName], moduleName)));
}

function getAllFuncs(obj) {
  let props = [];
  let current = obj;
  do {
    props = props.concat(Object.getOwnPropertyNames(current));
  } while ((current = Object.getPrototypeOf(current)) && current !== Object.prototype);

  return props.sort()
    .filter((e, i, arr) => (e !== arr[i + 1] && (typeof obj[e] === 'function') && obj[e] !== obj.constructor));
}

module.exports = class Logger {
  constructor(loggerName, roll20) {
    this.prefixString = '';
    const state = roll20.getState('roll20-logger');
    state[loggerName] = state[loggerName] || Logger.levels.INFO;

    roll20.on('chat:message', (msg) => {
      if (msg.type === 'api' && msg.content.startsWith('!logLevel')) {
        const parts = msg.content.split(/\s/);
        if (parts.length > 2) {
          if (!state[parts[1]]) {
            roll20.sendChat('Logger', `Unrecognised logger name ${parts[1]}`);
            return;
          }
          state[parts[1]] = Logger.levels[parts[2].toUpperCase()] || Logger.levels.INFO;
        }
      }
    });

    function shouldLog(level) {
      return level <= state[loggerName];
    }

    function outputLog(level, message) {
      if (!shouldLog(level)) {
        return;
      }

      const args = arguments.length > 2 ? _.toArray(arguments).slice(2) : [];
      let processedMessage = stringify(message);
      if (processedMessage) {
        processedMessage = processedMessage.replace(/\$\$\$/g, () => stringify(args.shift()));
      }
      // noinspection NodeModulesDependencies
      roll20.log(`${loggerName} ${Date.now()} ` +
        `${Logger.getLabel(level)} : ${shouldLog(Logger.levels.TRACE) ? this.prefixString : ''}` +
        `${processedMessage}`);
    }

    _.each(Logger.levels, (level, levelName) => {
      this[levelName.toLowerCase()] = _.partial(outputLog, level);
    });

    this.wrapModule = function wrapModule(modToWrap) {
      if (shouldLog(Logger.levels.TRACE)) {
        wrapFunctions(modToWrap, modToWrap.logWrap, this.wrapFunction.bind(this));
        modToWrap.isLogWrapped = true;
      }
      return modToWrap;
    };

    this.getLogLevel = function getLogLevel() {
      return state[loggerName] || Logger.levels.INFO;
    };

    this.setLogLevel = function setLogLevel(level) {
      if (typeof level === 'string') {
        level = Logger.levels[level.toUpperCase()];
      }
      if (typeof level === 'number' && level >= Logger.levels.OFF && level <= Logger.levels.TRACE) {
        state[loggerName] = level;
      }
    };

    this.getLogTap = function getLogTap(level, messageString) {
      return _.partial(outputLog, level, messageString);
    };

    this.wrapFunction = function wrapFunction(name, func, moduleName) {
      if (shouldLog(Logger.levels.TRACE)) {
        if (name === 'toJSON' || moduleName === 'roll20' && name === 'log') {
          return func;
        }

        return () => {
          this.trace('$$$.$$$ starting with this value: $$$ and args $$$', moduleName, name, this, arguments);
          this.prefixString = `${this.prefixString}  `;
          const retVal = func.apply(this, arguments);
          this.prefixString = this.prefixString.slice(0, -2);
          this.trace('$$$.$$$ ending with return value $$$', moduleName, name, retVal);
          if (retVal && retVal.logWrap && !retVal.isLogWrapped) {
            this.wrapModule(retVal);
          }
          return retVal;
        };
      }
      return func;
    };
  }

  static getLabel(logLevel) {
    const logPair = _.chain(Logger.levels).pairs().find(pair => pair[1] === logLevel).value();
    return logPair ? logPair[0] : 'UNKNOWN';
  }

  static get levels() {
    return {
      OFF: 0,
      ERROR: 1,
      WARN: 2,
      INFO: 3,
      DEBUG: 4,
      TRACE: 5,
    };
  }
};
