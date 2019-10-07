if (!window.Logger) {
  window.Logger = {
    $el: null,
    /**
     * This is the set of supported logging types.
     *
     * @property Types
     * @type {Object}
     */
    Types: {
      Info: 'INFO',
      Warning: 'WARNING',
      Error: 'ERROR'
    },
    /**
     * This method will write a line to the logger.
     *
     * @method write
     * @param type {String} One of: INFO, WARNING, ERROR.
     * @param str {String} The string to write to the logger.
     */
    write: function(type, str) {
      var $target = $('#logger');

      // print this out to the browser console
      switch (type) {
        case [Logger.Types.Info]: console.log(str); break;
        case [Logger.Types.Warning]: console.warn(str); break;
        case [Logger.Types.Error]: console.error(str); break;
        default: console.log(str); break;
      }
      // if the logger element doesn't exist, then there's
      // nothing left to do here.
      if ($target.length === 0) return;

      // otherwise, we're going to append a new line item
      var $line = $(`<div class="log-item" data-type="${type}" />`);
      $line.html(str);
      $line.appendTo($target);
    }
  };
}
