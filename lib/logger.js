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

module.exports = class Logger {
  constructor(loggerName, config, roll20) {
    this.prefixString = '';

    function shouldLog(level) {
      let logLevel = this.levels.INFO;
      if (config && config.logLevel) {
        logLevel = this.levels[config.logLevel];
      }
      return level <= logLevel;
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
      roll20.log(`${loggerName} ${Date.now()}` +
        `${this.getLabel(level)} : ${shouldLog(this.levels.TRACE) ? this.prefixString : ''}` +
        `${processedMessage}`);
    }

    _.each(this.levels, (level, levelName) => {
      this[levelName.toLowerCase()] = _.partial(outputLog, level);
    });

    this.wrapModule = function wrapModule(modToWrap) {
      if (shouldLog(this.levels.TRACE)) {
        _.chain(modToWrap)
          .functions()
          .each(funcName => {
            const origFunc = modToWrap[funcName];
            modToWrap[funcName] = this.wrapFunction(funcName, origFunc, modToWrap.logWrap);
          });
        modToWrap.isLogWrapped = true;
      }
    };

    this.getLogTap = function getLogTap(level, messageString) {
      return _.partial(outputLog, level, messageString);
    };

    this.wrapFunction = function wrapFunction(name, func, moduleName) {
      if (shouldLog(this.levels.TRACE)) {
        if (name === 'toJSON' || moduleName === 'roll20' && name === 'log') {
          return func;
        }
        const logger = this;
        return function functionWrapper() {
          logger.trace('$$$.$$$ starting with this value: $$$ and args $$$', moduleName, name, this, arguments);
          logger.prefixString = `${logger.prefixString}  `;
          const retVal = func.apply(this, arguments);
          logger.prefixString = logger.prefixString.slice(0, -2);
          logger.trace('$$$.$$$ ending with return value $$$', moduleName, name, retVal);
          if (retVal && retVal.logWrap && !retVal.isLogWrapped) {
            logger.wrapModule(retVal);
          }
          return retVal;
        };
      }
      return func;
    };
  }

  static getLabel(logLevel) {
    const logPair = _.chain(this.levels).pairs().find(pair => pair[1] === logLevel).value();
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
