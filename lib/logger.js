'use strict';
const _ = require('underscore');
const roll20 = require('roll20-wrapper');

/**
 *
 * @param config
 * @returns {{debug:function, error:function, info:function, trace:function, warn:function}}
 */
module.exports = function Logger(config) {
  const logger = {
    OFF: 0,
    ERROR: 1,
    WARN: 2,
    INFO: 3,
    DEBUG: 4,
    TRACE: 5,
    prefixString: '',
  };

  function stringify(object) {
    if (object === undefined) {
      return object;
    }

    return typeof object === 'string' ? object : JSON.stringify(object, (key, value) =>
      (key !== 'logWrap' && key !== 'isLogWrapped' ? value : undefined)
    );
  }

  function shouldLog(level) {
    let logLevel = logger.INFO;
    if (config && config.logLevel) {
      logLevel = logger[config.logLevel];
    }

    return level <= logLevel;
  }

  function outputLog(level, message, ...params) {
    if (!shouldLog(level)) {
      return;
    }

    let processedMessage = stringify(message);
    if (processedMessage) {
      processedMessage = processedMessage.replace(/\$\$\$/g, () => stringify(params.shift()));
    }
    // noinspection NodeModulesDependencies
    roll20.log(`ShapedScripts ${Date.now()}` +
                `${logger.getLabel(level)} : ${shouldLog(logger.TRACE) ? logger.prefixString : ''}` +
                `${processedMessage}`);
  }

  logger.getLabel = function getLabel(logLevel) {
    const logPair = _.chain(logger).pairs().find(pair => pair[1] === logLevel).value();
    return logPair ? logPair[0] : 'UNKNOWN';
  };

  _.each(logger, (level, levelName) => {
    logger[levelName.toLowerCase()] = _.partial(outputLog, level);
  });

  logger.wrapModule = function wrapModule(modToWrap) {
    if (shouldLog(logger.TRACE)) {
      _.chain(modToWrap)
        .functions()
        .each(funcName => {
          const origFunc = modToWrap[funcName];
          modToWrap[funcName] = logger.wrapFunction(funcName, origFunc, modToWrap.logWrap);
        });
      modToWrap.isLogWrapped = true;
    }
  };

  logger.getLogTap = function getLogTap(level, messageString) {
    return _.partial(outputLog, level, messageString);
  };

  logger.wrapFunction = function wrapFunction(name, func, moduleName) {
    if (shouldLog(logger.TRACE)) {
      if (name === 'toJSON' || moduleName === 'roll20' && name === 'log') {
        return func;
      }
      return function functionWrapper(...args) {
        logger.trace('$$$.$$$ starting with this value: $$$ and args $$$', moduleName, name, this, args);
        logger.prefixString = `${logger.prefixString}  `;
        const retVal = func.apply(this, args);
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
  // noinspection JSValidateTypes
  return logger;
};
